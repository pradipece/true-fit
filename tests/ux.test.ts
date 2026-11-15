import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanSignUp } from "@/lib/auth/job-seekers";
import { access, HOME, ROLE_IDS } from "@/lib/auth/rbac";
import { contactProblem, EMPTY_CONTACT } from "@/lib/contact";
import { feedbackError } from "@/lib/impact";
import { COMPANY_LABEL, STAGE_LABEL, STEPS, TALENT_LABEL, type Stage } from "@/lib/pipeline";
import { activePage, roleOf, ROLES } from "@/lib/roles";

/**
 * UX checks that don't need a browser: navigation is consistent with access rules, copy is
 * plain language for non-technical people, messages are clear, and controls are labelled
 * for screen readers.
 */

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const pageFile = (href: string) => join(ROOT, "app", href, "page.tsx");

/** Words the UI copy guide keeps out of user-facing text (they stay on /responsible). */
const JARGON = /\b(ESCO|Gemini|overlap|evidenced|self-reported|LLM|embedding|pool)\b/i;

// ── Navigation ───────────────────────────────────────────────────────────────

describe("navigation", () => {
  it("every page in the header exists", () => {
    for (const r of ROLES) for (const p of r.pages) expect(existsSync(pageFile(p.href)), p.href).toBe(true);
  });

  it("every role lands on one of its own pages after signing in", () => {
    for (const id of ROLE_IDS) {
      const role = ROLES.find((r) => r.id === id)!;
      expect(role.pages.map((p) => p.href)).toContain(HOME[id]);
    }
  });

  it("shows each role only pages it can open, and sends others to sign in", () => {
    for (const r of ROLES)
      for (const p of r.pages) {
        expect(access(p.href, r.id), `${r.id} → ${p.href}`).toEqual({ ok: true });
        expect(access(p.href, undefined)).toEqual({ ok: false, reason: "signed-out" });
        for (const other of ROLE_IDS.filter((x) => x !== r.id))
          expect(access(p.href, other)).toMatchObject({ ok: false, reason: "forbidden", need: [r.id] });
      }
  });

  it("keeps the landing, sign-in and responsible-AI pages open to everyone", () => {
    for (const p of ["/", "/login", "/responsible"]) {
      expect(access(p, undefined)).toEqual({ ok: true });
      expect(roleOf(p)).toBeUndefined();
    }
  });

  it("highlights the most specific tab for nested pages", () => {
    const talent = ROLES.find((r) => r.id === "talent")!;
    expect(roleOf("/talent/explore")?.id).toBe("talent");
    expect(activePage(talent, "/talent/explore")?.label).toBe("Find jobs");
    expect(activePage(talent, "/talent")?.label).toBe("My profile");
    expect(activePage(talent, "/talent/agenda")?.label).toBe("My agenda");
    expect(roleOf("/meetings/company")?.id).toBe("company");
    // A path that merely starts with the same letters is not the same section.
    expect(roleOf("/talented")).toBeUndefined();
    expect(roleOf("/companyx")).toBeUndefined();
  });

  it("has short, unique tab labels in every role", () => {
    for (const r of ROLES) {
      const labels = r.pages.map((p) => p.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const l of labels) expect(l.length, l).toBeLessThanOrEqual(24);
    }
  });
});

// ── "How this page works" guide ──────────────────────────────────────────────

describe("page guide", () => {
  const MAIN = [
    "/company",
    "/organiser",
    "/talent",
    "/talent/explore",
    "/meetings/company",
    "/meetings/talent",
  ];

  it("each main page shows a three-step guide in plain words", () => {
    for (const href of MAIN) {
      const src = readFileSync(pageFile(href), "utf8");
      const start = src.indexOf("<PageGuide");
      expect(start, `${href} has a PageGuide`).toBeGreaterThan(-1);
      const block = src.slice(start, src.indexOf("/>", src.indexOf("]}", start)));
      expect(block.match(/\btitle:/g)?.length, href).toBe(3);
      expect(block).not.toMatch(JARGON);
      expect(block).toMatch(/\bid="[^"]+"/);
    }
  });

  it("uses a different id per page so hiding one doesn't hide the others", () => {
    const ids = MAIN.map(
      (href) => readFileSync(pageFile(href), "utf8").match(/<PageGuide[\s\S]*?\bid="([^"]+)"/)?.[1],
    );
    expect(new Set(ids).size).toBe(MAIN.length);
  });
});

// ── Pipeline copy ────────────────────────────────────────────────────────────

describe("pipeline status copy", () => {
  const stages = Object.keys(STAGE_LABEL) as Stage[];

  it("has a label for every stage, for the organiser, the candidate and the company", () => {
    for (const s of stages.filter((x) => x !== "none")) {
      expect(STAGE_LABEL[s], s).toBeTruthy();
      expect(TALENT_LABEL[s], s).toBeTruthy();
      expect(COMPANY_LABEL[s], s).toBeTruthy();
    }
    expect(Object.keys(TALENT_LABEL).sort()).toEqual([...stages].sort());
    expect(Object.keys(COMPANY_LABEL).sort()).toEqual([...stages].sort());
  });

  it("keeps the candidate's and company's labels short enough for a badge", () => {
    for (const s of stages) {
      expect(TALENT_LABEL[s].length, TALENT_LABEL[s]).toBeLessThanOrEqual(45);
      expect(COMPANY_LABEL[s].length, COMPANY_LABEL[s]).toBeLessThanOrEqual(45);
    }
  });

  it("uses plain language and never tells anyone why someone said no", () => {
    const all = [
      ...Object.values(STAGE_LABEL),
      ...Object.values(TALENT_LABEL),
      ...Object.values(COMPANY_LABEL),
    ];
    for (const l of all) {
      expect(l, l).not.toMatch(JARGON);
      expect(l, l).not.toMatch(/\b(because|reason|score|rejected|failed)\b/i);
    }
  });

  it("names six steps, each with a short unique label", () => {
    expect(STEPS).toHaveLength(6);
    expect(new Set(STEPS.map((s) => s.label)).size).toBe(6);
    for (const s of STEPS) expect(s.label.length).toBeLessThanOrEqual(24);
  });
});

// ── Form messages ────────────────────────────────────────────────────────────

describe("form messages", () => {
  const ok = { fullName: "A", email: "a@example.com", phone: "", city: "" };
  const messages = [
    contactProblem(EMPTY_CONTACT),
    contactProblem({ ...ok, email: "x" }),
    contactProblem({ ...ok, phone: "abc" }),
    feedbackError({}),
    feedbackError({ held: true }),
    feedbackError({ held: true, usefulness: 3 }),
    feedbackError({ held: true, usefulness: 3, accuracy: 3 }),
    (cleanSignUp("A", "x") as { error: string }).error,
  ];

  it("are short sentences that say what to do", () => {
    for (const m of messages) {
      expect(m, m ?? "").toMatch(/^[A-Z].{5,70}\.$/);
      expect(m).not.toMatch(JARGON);
      expect(m).not.toMatch(/\b(invalid input|error|null|undefined|regex|field)\b/i);
    }
  });
});

// ── Components: copy and accessibility ───────────────────────────────────────

const COMPONENTS = readdirSync(join(ROOT, "components"), { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".tsx") && !f.startsWith("ui"))
  .map((f) => `components/${f}`);

/** Every opening JSX tag `<Name …>` in `src`, honouring braces and strings inside it. */
function tags(src: string, name: string) {
  const out: { tag: string; index: number; line: number }[] = [];
  const open = `<${name}`;
  let i = 0;
  while ((i = src.indexOf(open, i)) >= 0) {
    if (!/[\s/>]/.test(src[i + open.length] ?? "")) {
      i++;
      continue;
    }
    let j = i + open.length;
    let depth = 0;
    let quote: string | null = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (quote) {
        if (c === quote && src[j - 1] !== "\\") quote = null;
      } else if (c === '"' || ((c === "'" || c === "`") && depth > 0)) quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push({ tag: src.slice(i, j + 1), index: i, line: src.slice(0, i).split("\n").length });
    i = j;
  }
  return out;
}

/** Inside an open <label> … </label> at this position? */
const insideLabel = (src: string, index: number) => {
  const before = src.slice(0, index);
  return before.lastIndexOf("<label") > before.lastIndexOf("</label>");
};

describe("accessibility of components", () => {
  it("every icon-only button has an accessible name", () => {
    const missing: string[] = [];
    for (const f of COMPONENTS) {
      const src = read(f);
      for (const t of tags(src, "Button")) {
        if (!/size="icon/.test(t.tag) || /aria-label|title=/.test(t.tag)) continue;
        const body = t.tag.endsWith("/>")
          ? ""
          : src.slice(t.index + t.tag.length, src.indexOf("</Button>", t.index));
        if (!/sr-only/.test(body)) missing.push(`${f}:${t.line}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every text field and select has a label", () => {
    const missing: string[] = [];
    for (const f of COMPONENTS) {
      const src = read(f);
      for (const name of ["Input", "Textarea", "input", "textarea", "select"])
        for (const t of tags(src, name)) {
          if (/type="(hidden|file)"/.test(t.tag)) continue;
          if (/aria-label|aria-labelledby|\bid=/.test(t.tag) || insideLabel(src, t.index)) continue;
          missing.push(`${f}:${t.line}`);
        }
    }
    expect(missing).toEqual([]);
  });

  it("every image has alt text", () => {
    const missing: string[] = [];
    for (const f of COMPONENTS) {
      const src = read(f);
      for (const name of ["img", "Image"])
        for (const t of tags(src, name)) if (!/\balt=/.test(t.tag)) missing.push(`${f}:${t.line}`);
    }
    expect(missing).toEqual([]);
  });

  it("chat popups say whether they are open", () => {
    for (const f of ["components/company-intake.tsx", "components/organiser-assistant.tsx"])
      expect(read(f), f).toMatch(/aria-expanded=/);
  });
});

describe("plain-language copy in components", () => {
  it("keeps technical terms out of visible text and placeholders", () => {
    const hits: string[] = [];
    for (const f of COMPONENTS) {
      const src = read(f)
        // Code comments aren't shown to anyone.
        .replace(/\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "")
        // A term explained right where it appears is fine ("ESCO, the EU's skills list").
        .replace(/\bESCO, the EU/g, "the EU");
      // Text between tags, and placeholder / aria-label strings.
      const texts = [
        ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
        ...[...src.matchAll(/(?:placeholder|aria-label)="([^"]+)"/g)].map((m) => m[1]),
      ];
      for (const t of texts) if (JARGON.test(t)) hits.push(`${f}: ${t.trim().slice(0, 80)}`);
    }
    expect(hits).toEqual([]);
  });
});
