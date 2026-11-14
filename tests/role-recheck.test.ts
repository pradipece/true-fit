import { describe, expect, it } from "vitest";
import { SEED_TALENT } from "@/lib/data";
import {
  cardPoolCheck,
  dropStaleSkills,
  EMPTY_DRAFT,
  recheckNote,
  relevantCount,
  roleChanged,
  type NeedDraft,
} from "@/lib/intake";

const card = (patch: Partial<NeedDraft>): NeedDraft => ({ ...EMPTY_DRAFT, ...patch });

const dev = card({
  title: "Software developer",
  occupation: "software-developer",
  must: ["python", "backend"],
  nice: ["testing", "team"],
});
const nurse = card({
  title: "Nurse",
  occupation: "general-nurse",
  must: ["patient-care", "python"],
  nice: ["testing", "team"],
});

describe("role change recheck", () => {
  it("spots a new role but not a refinement of the same one", () => {
    expect(roleChanged(dev, nurse)).toBe(true);
    expect(roleChanged(card({ title: "Developer" }), card({ title: "Back-end developer" }))).toBe(false);
    expect(roleChanged(card({ title: "Developer" }), card({ title: "Nurse" }))).toBe(true);
    expect(roleChanged(EMPTY_DRAFT, nurse)).toBe(false);
  });

  it("drops skills left from the old role, keeps fitting, transversal and named ones", () => {
    const { draft, removed } = dropStaleSkills(dev, nurse, "Actually we need a nurse instead");
    expect(removed.sort()).toEqual(["python", "testing"]);
    expect(draft.must).toEqual(["patient-care"]);
    expect(draft.nice).toEqual(["team"]);

    const kept = dropStaleSkills(dev, nurse, "A nurse instead, but keep Python");
    expect(kept.draft.must).toContain("python");
  });

  it("leaves the card alone when the new role has no known occupation", () => {
    const next = { ...nurse, occupation: "" };
    expect(dropStaleSkills(dev, next, "nurse").removed).toEqual([]);
  });

  it("reports aggregate counts for the new card", () => {
    const after = card({ ...nurse, must: ["patient-care"] });
    const check = cardPoolCheck(after, SEED_TALENT);
    expect(check.people).toBe(SEED_TALENT.length);
    expect(check.relevant).toBe(relevantCount(after, SEED_TALENT));
    expect(check.must[0].people).toBeGreaterThan(0);
    const note = recheckNote({ ...check, removed: ["python"] });
    expect(note).toContain(`${check.relevant} of ${SEED_TALENT.length} people`);
    expect(note).toMatch(/Python.*off the card/);
    // Counts only: no aliases or names leak into the note.
    for (const t of SEED_TALENT) expect(note).not.toContain(t.revealName);
  });
});
