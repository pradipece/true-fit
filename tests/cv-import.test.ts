import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  cleanCvText,
  docxToText,
  looksLikeLinkedIn,
  rulesCvScan,
  sanitizeCvScan,
  stripContacts,
  type CvModelOutput,
} from "@/lib/cv-import";

const LINKEDIN = `Contact
www.linkedin.com/in/demo-person (LinkedIn)
demo.person@example.com
+358 40 123 4567

Top Skills
SQL

Languages
English (Full Professional)
Finnish (Elementary)

Summary
Eight years in warehouses. I taught myself SQL to fix our weekly reporting.

Experience
Northwind Logistics
Logistics Coordinator
March 2019 - Present (5 years 9 months)
Wrote SQL queries to track late deliveries per carrier.

Education
Example University
Bachelor of Business, 2010 - 2014
Page 1 of 2`;

describe("CV pre-processing", () => {
  it("recognises a LinkedIn export and drops page footers", () => {
    expect(looksLikeLinkedIn(LINKEDIN)).toBe(true);
    expect(cleanCvText(LINKEDIN)).not.toMatch(/Page 1 of 2/);
  });

  it("strips email, phone and profile URLs before any AI call, but keeps year ranges", () => {
    const { text, removed } = stripContacts(LINKEDIN);
    expect(text).not.toMatch(/example\.com|linkedin\.com|123 4567/);
    expect(text).toMatch(/2010 - 2014/);
    expect(removed.map((r) => r.kind)).toEqual(expect.arrayContaining(["contact"]));
    expect(removed.length).toBeGreaterThanOrEqual(3);
  });
});

describe("CV scan guard", () => {
  const { text, removed } = stripContacts(cleanCvText(LINKEDIN));

  it("keeps only catalogue skills with verbatim quotes and scrubs identifying spans", () => {
    const out: CvModelOutput = {
      title: "Logistics Coordinator",
      path: "I ran warehouses at Northwind Logistics and studied at Example University.",
      skills: [
        { skill: "sql", quote: "Wrote SQL queries to track late deliveries per carrier.", why: "ok" },
        { skill: "sql", quote: "Wrote SQL queries", why: "duplicate" },
        { skill: "python", quote: "Built Python tools for the whole company", why: "invented" },
        { skill: "not-a-skill", quote: "Logistics Coordinator", why: "unknown" },
      ],
      languages: ["English", "Finnish", "Klingon"],
      identifying: [
        { text: "Example University", kind: "school" },
        { text: "Northwind Logistics", kind: "other" },
        { text: "Made-up span", kind: "name" },
      ],
    };
    const scan = sanitizeCvScan(out, text, removed);
    expect(scan.skills.map((s) => s.skill)).toEqual(["sql"]);
    expect(scan.languages).toEqual(["English", "Finnish"]);
    expect(scan.path).not.toMatch(/Northwind|Example University/);
    expect(scan.removed.some((r) => r.text === "Made-up span")).toBe(false);
    expect(scan.removed.some((r) => r.kind === "school")).toBe(true);
  });

  it("rules fallback finds the latest title, summary, skills and languages", () => {
    const scan = rulesCvScan(text, removed);
    expect(scan.title).toBe("Logistics Coordinator");
    expect(scan.path).toMatch(/taught myself SQL/);
    expect(scan.skills.map((s) => s.skill)).toContain("sql");
    expect(scan.languages).toEqual(["English", "Finnish"]);
    for (const s of scan.skills) expect(text.toLowerCase()).toContain(s.quote.toLowerCase().slice(0, 20));
  });
});

const ATS = `SAMIRA EXAMPLE
Espoo | samira.example@example.com | +358 40 000 0000

PROFESSIONAL SUMMARY
Practical nurse with six years in elderly care, good at explaining care plans to families.

CORE COMPETENCIES
Patient care | Medication administration | Teamwork

PROFESSIONAL EXPERIENCE
Practical Nurse | Example Home Care Oy | 04/2021 – Present
- Visit elderly clients a day: medication and daily routines.

Care Assistant, Sunny Days Care Home | 2018 – 2021

EDUCATION
Example Vocational College, 2018

LANGUAGES
English – fluent; Finnish – B1; Arabic – native`;

describe("ATS-style CVs", () => {
  it("reads standard upper-case headings, title lines with dates, summary and languages", () => {
    const { text, removed } = stripContacts(cleanCvText(ATS));
    const scan = rulesCvScan(text, removed);
    expect(scan.title).toBe("Practical Nurse");
    expect(scan.path).toMatch(/Practical nurse with six years/);
    expect(scan.languages).toEqual(["English", "Finnish", "Other"]);
    expect(scan.linkedin).toBe(false);
    expect(removed.map((r) => r.text)).toEqual(
      expect.arrayContaining(["samira.example@example.com", "+358 40 000 0000"]),
    );
  });

  it("finds the title when it sits on the line above the company and dates", () => {
    const cv = "Work Experience\nData Analyst\nContoso Ltd, Helsinki\nJan 2020 to Present\n- Built reports";
    expect(rulesCvScan(cv, []).title).toBe("Data Analyst");
  });

  it("keeps numeric date ranges that look like phone numbers", () => {
    const { text, removed } = stripContacts(
      "Developer\n2019-03 - 2021-05\n3.2015 – 5.2019\nCall +358 40 123 4567",
    );
    expect(text).toMatch(/2019-03 - 2021-05/);
    expect(text).toMatch(/3\.2015 – 5\.2019/);
    expect(removed.map((r) => r.text)).toEqual(["+358 40 123 4567"]);
  });

  it("extracts text from a Word .docx, headers first, one line per paragraph", () => {
    const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
    const docx = zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
      "word/header1.xml": strToU8(`<w:hdr>${p("jane@example.com")}</w:hdr>`),
      "word/document.xml": strToU8(
        `<w:document><w:body>${p("EXPERIENCE")}${p("Analyst &amp; Developer<w:tab/>2020 – Present")}</w:body></w:document>`,
      ),
    });
    const text = docxToText(docx);
    expect(text.split("\n").filter(Boolean)).toEqual([
      "jane@example.com",
      "EXPERIENCE",
      "Analyst & Developer\t2020 – Present",
    ]);
    expect(() => docxToText(zipSync({ "a.txt": strToU8("x") }))).toThrow();
  });
});
