/**
 * Shared helpers for the scrapers: a polite fetch (robots.txt check, per-host
 * rate limit, retries), sitemap reading and dependency-free HTML extraction.
 */

export const USER_AGENT = "true-fit-scraper/0.1 (hackathon research; synthetic-data prototype)";

const MIN_INTERVAL_MS = Number(process.env.SCRAPE_INTERVAL_MS ?? 1000);
const lastHit = new Map(); // host -> timestamp of last request
const robotsCache = new Map(); // origin -> Promise<rules>

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RobotsDisallowed extends Error {}

/** Waits so that requests to one host are at least MIN_INTERVAL_MS apart. */
async function throttle(host) {
  for (;;) {
    const wait = (lastHit.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
    if (wait <= 0) break;
    await sleep(wait);
  }
  lastHit.set(host, Date.now());
}

// ---------------------------------------------------------------- robots.txt

/** Parses the rule groups that apply to `*` or to our own agent token. */
export function parseRobots(text) {
  const rules = [];
  let agents = [];
  let inRules = false;
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === "user-agent") {
      if (inRules) agents = [];
      inRules = false;
      agents.push(value.toLowerCase());
      applies = agents.some((a) => a === "*" || "true-fit-scraper".startsWith(a));
    } else if (k === "allow" || k === "disallow") {
      inRules = true;
      if (applies && value) rules.push({ allow: k === "allow", pattern: value });
    }
  }
  return rules;
}

function ruleRegex(pattern) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; on a tie, Allow wins. No rule → allowed. */
export function isAllowed(rules, pathWithQuery) {
  let best = null;
  for (const r of rules) {
    if (!ruleRegex(r.pattern).test(pathWithQuery)) continue;
    if (
      !best ||
      r.pattern.length > best.pattern.length ||
      (r.pattern.length === best.pattern.length && r.allow)
    )
      best = r;
  }
  return best ? best.allow : true;
}

async function robotsFor(origin) {
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      (async () => {
        try {
          await throttle(new URL(origin).host);
          const res = await fetch(`${origin}/robots.txt`, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(15_000),
          });
          const type = res.headers.get("content-type") ?? "";
          // Some SPAs answer /robots.txt with their HTML shell: treat as "no rules".
          if (!res.ok || type.includes("html")) return [];
          return parseRobots(await res.text());
        } catch {
          return [];
        }
      })(),
    );
  }
  return robotsCache.get(origin);
}

// --------------------------------------------------------------------- fetch

/**
 * GET with robots.txt check, per-host throttle and retries on 429/5xx.
 * Throws RobotsDisallowed when robots.txt forbids the URL.
 */
export async function politeFetch(url, { accept = "*/*", retries = 3 } = {}) {
  const u = new URL(url);
  const rules = await robotsFor(u.origin);
  if (!isAllowed(rules, u.pathname + u.search)) throw new RobotsDisallowed(`robots.txt disallows ${url}`);

  for (let attempt = 0; ; attempt++) {
    await throttle(u.host);
    let res;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "en,fi;q=0.8" },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
}

export const getJson = async (url) => (await politeFetch(url, { accept: "application/json" })).json();
export const getText = async (url) =>
  (await politeFetch(url, { accept: "text/html,application/xml;q=0.9,*/*;q=0.8" })).text();

// ------------------------------------------------------------------ sitemaps

/** Returns every page URL in a sitemap, following nested sitemap indexes. */
export async function sitemapUrls(url, depth = 0) {
  const xml = await getText(url);
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]));
  if (!/<sitemapindex/i.test(xml) || depth > 2) return locs;
  const nested = [];
  for (const loc of locs) nested.push(...(await sitemapUrls(loc, depth + 1).catch(() => [])));
  return nested;
}

// ---------------------------------------------------------------------- HTML

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s = "") {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML fragment → readable plain text. */
export function htmlToText(html = "") {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const meta = (html, attr, name) => {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag
    ? decodeEntities(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "").trim() || undefined
    : undefined;
};

/** Pulls the useful, structured bits out of a page. */
export function extractPage(html, url, { maxText = 6000 } = {}) {
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const text = htmlToText(main);
  return {
    url,
    lang: html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1],
    title: htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || undefined,
    description: meta(html, "name", "description") ?? meta(html, "property", "og:description"),
    h1: htmlToText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") || undefined,
    headings: [...main.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
      .map((m) => htmlToText(m[1]))
      .filter(Boolean)
      .slice(0, 30),
    text: text.length > maxText ? `${text.slice(0, maxText)}…` : text,
    jsonLd: jsonLd.length ? jsonLd : undefined,
  };
}

/** Same-host links found in a page (fragment and query stripped). */
export function sameHostLinks(html, base) {
  const host = new URL(base).host;
  const out = new Set();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)/gi)) {
    try {
      const u = new URL(decodeEntities(m[1]), base);
      if (u.host !== host || !/^https?:$/.test(u.protocol)) continue;
      if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|pptx?|mp4|ics)$/i.test(u.pathname)) continue;
      u.hash = "";
      u.search = "";
      out.add(u.toString());
    } catch {
      /* ignore malformed href */
    }
  }
  return [...out];
}

/** Fetches and extracts a list of pages, skipping ones that fail. */
export async function scrapePages(urls, { log, maxText } = {}) {
  const items = [];
  let failed = 0;
  for (const [i, url] of urls.entries()) {
    try {
      items.push(extractPage(await getText(url), url, { maxText }));
    } catch (err) {
      failed++;
      log?.(`  skip ${url}: ${err.message}`);
    }
    if ((i + 1) % 25 === 0) log?.(`  ${i + 1}/${urls.length} pages`);
  }
  return { items, failed };
}

/** Breadth-first crawl of one host, starting from `start`, up to `max` pages. */
export async function crawl(start, { max = 100, include = () => true, log, maxText } = {}) {
  const queue = [start];
  const seen = new Set(queue);
  const items = [];
  while (queue.length && items.length < max) {
    const url = queue.shift();
    let html;
    try {
      html = await getText(url);
    } catch (err) {
      log?.(`  skip ${url}: ${err.message}`);
      continue;
    }
    items.push(extractPage(html, url, { maxText }));
    for (const link of sameHostLinks(html, url)) {
      if (!seen.has(link) && include(link)) {
        seen.add(link);
        queue.push(link);
      }
    }
    if (items.length % 25 === 0) log?.(`  ${items.length} pages crawled`);
  }
  return { items, failed: 0 };
}

/** Picks a language value from `[{language, value}]` lists (PTV style). */
export function byLang(list = [], filter = () => true) {
  const out = {};
  for (const x of list) if (x?.value && filter(x) && !out[x.language]) out[x.language] = x.value;
  return out;
}
