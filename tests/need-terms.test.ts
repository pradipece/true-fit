import { describe, expect, it } from "vitest";
import { sanitizeDraft } from "@/lib/intake";
import { asksNativeSpeaker, languageRule, modeKind, onlyFinnish, speaksRequired } from "@/lib/need-terms";
import { rooms } from "@/lib/schedule";
import type { Need, Talent } from "@/lib/types";

const person = (langs: [string, "Native" | "Fluent" | "Working" | "Learning"][]) =>
  ({ languages: langs.map(([lang, level]) => ({ lang, level })), mode: "Any" }) as unknown as Talent;

describe("free-text working language", () => {
  it("reads the presets the same way as before", () => {
    expect(languageRule("English OK")).toEqual({ langs: ["English"], any: false });
    expect(languageRule("Finnish or English")).toEqual({ langs: ["Finnish", "English"], any: true });
    expect(onlyFinnish("Finnish required")).toBe(true);
    expect(onlyFinnish("Finnish or English")).toBe(false);
  });

  it("understands free wording in English, Finnish and Swedish", () => {
    expect(languageRule("Swedish or English")?.any).toBe(true);
    expect(languageRule("suomi tai englanti")).toEqual({ langs: ["Finnish", "English"], any: true });
    expect(languageRule("venäjä")).toEqual({ langs: ["Russian"], any: false });
    expect(languageRule("whatever works for the team")).toBeNull();
  });

  it("counts working level, not learners, and requires all when not alternatives", () => {
    const sv = person([["Swedish", "Fluent"]]);
    const learner = person([
      ["Swedish", "Learning"],
      ["English", "Working"],
    ]);
    expect(speaksRequired("Swedish or English", sv)).toBe(true);
    expect(speaksRequired("Swedish or English", learner)).toBe(true);
    expect(speaksRequired("Swedish and English", sv)).toBe(false);
    expect(speaksRequired("Swedish", learner)).toBe(false);
    expect(speaksRequired("anything", learner)).toBe(true);
  });

  it("flags native-speaker requirements", () => {
    expect(asksNativeSpeaker("Native Finnish speaker")).toBe(true);
    expect(asksNativeSpeaker("äidinkieli suomi")).toBe(true);
    expect(asksNativeSpeaker("Fluent Finnish")).toBe(false);
  });
});

describe("free-text way of working", () => {
  it("maps wording to the closest standard mode", () => {
    expect(modeKind("Remote")).toBe("Remote");
    expect(modeKind("On-site 3 days a week")).toBe("Hybrid");
    expect(modeKind("office and from home")).toBe("Hybrid");
    expect(modeKind("At the site in Otaniemi")).toBe("On-site");
    expect(modeKind("flexible")).toBeNull();
  });

  it("gives an online room only to fully remote companies", () => {
    const need = (mode: string) => ({ id: "N", companyId: "C-X", company: "X", mode }) as unknown as Need;
    expect(rooms([need("Fully remote, EU time zones")]).find((r) => r.companyId === "C-X")?.online).toBe(
      true,
    );
    expect(rooms([need("Remote 2 days, office 3")]).find((r) => r.companyId === "C-X")?.online).toBe(false);
  });
});

describe("sanitizeDraft", () => {
  it("keeps free text for language, mode and contract, but only catalogue skills", () => {
    const d = sanitizeDraft({
      language: "  Swedish   or English ",
      mode: "On-site 4 days",
      timing: { start: "March", engagement: "6-month project" },
      must: ["python", "not-a-skill"],
    });
    expect(d.language).toBe("Swedish or English");
    expect(d.mode).toBe("On-site 4 days");
    expect(d.timing.engagement).toBe("6-month project");
    expect(d.must).toEqual(["python"]);
  });
});
