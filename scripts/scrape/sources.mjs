/**
 * Source registry. Each source fetches only public data that the site's
 * robots.txt or published open API allows, and keeps only fields useful for
 * matching research. Fields that may identify a person (contact names, phone
 * numbers, emails) are deliberately left out.
 */
import { byLang, crawl, getJson, getText, htmlToText, scrapePages, sitemapUrls } from "./lib.mjs";

const RECRUITMENT_TERMS = [
  "rekrytointi",
  "rekry",
  "työnantajatreffit",
  "työnhaku",
  "työpaikka",
  "työllisyys",
  "recruitment",
  "job fair",
  "career",
  "rekrytering",
];

const pick = (obj = {}, langs = ["fi", "en", "sv"]) =>
  Object.fromEntries(langs.filter((l) => obj?.[l]).map((l) => [l, obj[l]]));

const pickText = (obj = {}) =>
  Object.fromEntries(Object.entries(pick(obj)).map(([l, v]) => [l, htmlToText(v)]));

// ------------------------------------------------------------------ The Hub

async function theHub({ limit, details, log }) {
  const base = "https://thehub.io/api/v2/jobsandfeatured?countryCode=FI";
  const jobs = new Map();
  let suggestions;
  for (let page = 1; ; page++) {
    const { jobs: res } = await getJson(`${base}&page=${page}`);
    suggestions ??= res.suggestions;
    for (const j of res.docs) jobs.set(j.id, j);
    log(`  page ${page}/${res.pages}: ${jobs.size}/${res.total} jobs`);
    if (page >= res.pages || jobs.size >= limit) break;
  }

  const items = [];
  for (const j of [...jobs.values()].slice(0, limit)) {
    const url = `https://thehub.io/jobs/${j.id}`;
    const item = {
      id: j.id,
      url,
      title: j.title,
      company: j.company && {
        name: j.company.name,
        website: j.company.website,
        size: j.company.numberOfEmployees,
        founded: j.company.founded,
      },
      location: j.location,
      remote: j.isRemote,
      positionTypeIds: j.jobPositionTypes,
      roles: j.jobRoles,
      featured: j.isFeatured,
    };
    if (details) {
      try {
        const html = await getText(url);
        const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
          .map((m) => {
            try {
              return JSON.parse(m[1]);
            } catch {
              return null;
            }
          })
          .find((x) => x?.["@type"] === "JobPosting");
        if (ld) {
          item.description = htmlToText(ld.description ?? "");
          item.employmentType = ld.employmentType;
          item.datePosted = ld.datePosted;
          item.validThrough = ld.validThrough;
        }
      } catch (err) {
        log(`  detail ${j.id}: ${err.message}`);
      }
      if (items.length % 25 === 24) log(`  ${items.length + 1} job details`);
    }
    items.push(item);
  }
  return { items, extra: { roleCounts: suggestions?.jobRoles } };
}

// ------------------------------------------------- Linked Events (Espoo, HKI)

function normaliseEvent(e) {
  return {
    id: e.id,
    name: pick(e.name),
    shortDescription: pickText(e.short_description),
    description: pickText(e.description),
    start: e.start_time,
    end: e.end_time,
    status: e.event_status,
    location: e.location?.name
      ? {
          name: pick(e.location.name),
          address: pick(e.location.street_address),
          city: pick(e.location.address_locality),
        }
      : e.location?.["@id"],
    keywords: (e.keywords ?? []).map((k) => pick(k.name)?.fi ?? pick(k.name)?.en ?? k["@id"]).filter(Boolean),
    languages: (e.in_language ?? []).map((l) => l["@id"]?.split("/").filter(Boolean).pop()),
    infoUrl: pick(e.info_url),
    registrationUrl: e.event_registration_link ?? undefined,
    offers: (e.offers ?? []).map((o) => ({ free: o.is_free, price: pick(o.price) })),
    publisher: e.publisher,
    lastModified: e.last_modified_time,
  };
}

const linkedEvents =
  (apiBase) =>
  async ({ limit, log, since }) => {
    const byId = new Map();
    for (const term of RECRUITMENT_TERMS) {
      let url = `${apiBase}/event/?text=${encodeURIComponent(term)}&page_size=100&include=location,keywords&start=${since}`;
      let pages = 0;
      while (url && byId.size < limit && pages < 10) {
        const res = await getJson(url);
        for (const e of res.data)
          if (!byId.has(e.id)) byId.set(e.id, { ...normaliseEvent(e), matchedTerm: term });
        url = res.meta?.next;
        pages++;
      }
      log(`  "${term}": ${byId.size} unique events so far`);
      if (byId.size >= limit) break;
    }
    return { items: [...byId.values()].slice(0, limit) };
  };

// --------------------------------------------------------- Suomi.fi PTV (049)

const EMPLOYMENT_CLASS =
  /work|employ|unemploy|business|entrepreneur|enterprise|education|training|immigra|integrat/i;

async function ptv({ limit, log }) {
  const base = "https://api.palvelutietovaranto.suomi.fi/api/v11/Service/list/area/Municipality/code/049";
  const items = [];
  for (let page = 1; ; page++) {
    const res = await getJson(`${base}?page=${page}`);
    for (const s of res.itemList ?? []) {
      const classes = (s.serviceClasses ?? []).map((c) => ({ code: c.code, name: byLang(c.name) }));
      const ontology = (s.ontologyTerms ?? []).map((t) => byLang(t.name));
      const related =
        classes.some((c) => EMPLOYMENT_CLASS.test(c.name.en ?? "")) ||
        ontology.some((t) => EMPLOYMENT_CLASS.test(t.en ?? ""));
      items.push({
        id: s.id,
        url: `https://www.suomi.fi/palvelut/${s.id}`,
        name: byLang(s.serviceNames, (x) => x.type === "Name"),
        summary: byLang(s.serviceDescriptions, (x) => x.type === "Summary"),
        description: byLang(s.serviceDescriptions, (x) => x.type === "Description"),
        serviceClasses: classes,
        ontologyTerms: ontology,
        targetGroups: (s.targetGroups ?? []).map((t) => byLang(t.name)),
        languages: s.languages,
        chargeType: s.serviceChargeType,
        organizations: (s.organizations ?? []).map((o) => ({ name: o.organization?.name, role: o.roleType })),
        keywords: (s.keywords ?? []).map((k) => k.value),
        employmentRelated: related,
        modified: s.modified,
      });
    }
    log(`  page ${page}/${res.pageCount}: ${items.length} services`);
    if (page >= res.pageCount) break;
  }
  // Employment/business-related services first, so --limit keeps the relevant ones.
  items.sort((a, b) => Number(b.employmentRelated) - Number(a.employmentRelated));
  return {
    items: items.slice(0, limit),
    extra: { employmentRelated: items.filter((i) => i.employmentRelated).length },
  };
}

// ----------------------------------------------------------- sitemap / crawl

const fromSitemap =
  (sitemap, filter = () => true) =>
  async ({ limit, log }) => {
    const urls = [...new Set((await sitemapUrls(sitemap)).filter(filter))];
    log(`  sitemap: ${urls.length} matching URLs, fetching ${Math.min(limit, urls.length)}`);
    return scrapePages(urls.slice(0, limit), { log });
  };

/** Keeps English pages, or unprefixed pages when the site has no /en/. */
const englishOnly = (u) => {
  const seg = new URL(u).pathname.split("/")[1] ?? "";
  return seg === "en" || !/^[a-z]{2}$/.test(seg);
};

// ----------------------------------------------------------------- registry

export const SOURCES = {
  thehub: {
    title: "The Hub: startup jobs in Finland",
    origin: "https://thehub.io",
    kind: "jobs",
    run: theHub,
    notes:
      "Public JSON listing used by the site (robots.txt allows it). Full ad text from each job page's schema.org JobPosting.",
  },
  "espoo-events": {
    title: "Espoo events (Linked Events API): recruitment-related",
    origin: "https://api.espoo.fi/events/v1",
    kind: "events",
    run: linkedEvents("https://api.espoo.fi/events/v1"),
    notes: `Open API. Full-text search for: ${RECRUITMENT_TERMS.join(", ")}.`,
  },
  "helsinki-events": {
    title: "Helsinki region events (Linked Events API): recruitment-related",
    origin: "https://api.hel.fi/linkedevents/v1",
    kind: "events",
    run: linkedEvents("https://api.hel.fi/linkedevents/v1"),
    notes: `Open API. Full-text search for: ${RECRUITMENT_TERMS.join(", ")}.`,
  },
  ptv: {
    title: "Suomi.fi PTV: public services in Espoo (municipality 049)",
    origin: "https://api.palvelutietovaranto.suomi.fi",
    kind: "services",
    run: ptv,
    notes:
      "Suomi.fi PTV Open API v11. `employmentRelated` flags work/business/education/integration services.",
  },
  workinfinland: {
    title: "Work in Finland: English content pages",
    origin: "https://www.workinfinland.com",
    kind: "pages",
    run: fromSitemap("https://www.workinfinland.com/sitemap.xml", (u) => u.includes("/en/")),
    notes: "Pages from the sitemap (robots.txt: Allow /).",
  },
  "business-espoo": {
    title: "Business Espoo: services for companies",
    origin: "https://www.businessespoo.com",
    kind: "pages",
    run: ({ limit, log }) => crawl("https://www.businessespoo.com/", { max: limit, log }),
    notes: "No sitemap; breadth-first crawl of the site (mostly Finnish).",
  },
  "skills-anticipation": {
    title: "National Forum for Skills Anticipation (OPH)",
    origin: "https://www.oph.fi",
    kind: "pages",
    run: fromSitemap("https://www.oph.fi/sitemap.xml", (u) =>
      /ennakoin|anticipat|osaamistarpe|skills-needs|framtidsspaning/i.test(u),
    ),
    notes: "OPH sitemap pages about skills anticipation and future skill needs.",
  },
  tavata: {
    title: "Tavata: event platform (reference)",
    origin: "https://tavata.events",
    kind: "pages",
    run: fromSitemap("https://tavata.events/sitemap.xml", englishOnly),
    notes: "Product pages, for reference on how event platforms present matchmaking.",
  },
  brella: {
    title: "Brella: event networking platform (reference)",
    origin: "https://www.brella.io",
    kind: "pages",
    run: fromSitemap("https://www.brella.io/sitemap.xml", (u) => !/\/(roadmap|legal)\//.test(u)),
    notes: "Product and blog pages, for reference on event matchmaking UX.",
  },
};

/** Sources we intentionally don't scrape, with the reason (written to the manifest). */
export const SKIPPED = {
  duunitori: {
    title: "Duunitori",
    origin: "https://duunitori.fi",
    reason:
      "robots.txt has `User-agent: * / Disallow: /` (and /api/ is disallowed). Use only with written permission or a partner feed from Duunitori.",
  },
  tyomarkkinatori: {
    title: "Job Market Finland (Työmarkkinatori)",
    origin: "https://tyomarkkinatori.fi",
    reason:
      "robots.txt disallows /api/. Job ads are offered through KEHA's registration-based retrieval API (business ID + KIPA-Subscription-Key). See https://tyomarkkinatori.fi/ohjeet-ja-tuki/rajapinnat/tyopaikkailmoitusten-rajapinnat",
  },
  esco: {
    title: "ESCO",
    origin: "https://ec.europa.eu/esco/api",
    reason: "Already handled by `yarn esco:refresh` (data/esco) and the live ESCO routes.",
  },
};
