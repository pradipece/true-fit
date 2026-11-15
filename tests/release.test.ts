import { describe, expect, it } from "vitest";
import {
  addToChangelog,
  bumpType,
  changelogEntry,
  nextVersion,
  RELEASE_PREFIX,
  setVersion,
} from "../scripts/release/bump.mjs";

describe("version bump", () => {
  it("picks the bump from conventional commits", () => {
    expect(bumpType(["fix: typo", "chore: deps"])).toBe("patch");
    expect(bumpType(["fix: typo", "feat(ui): dashboard"])).toBe("minor");
    expect(bumpType(["feat!: new data model"])).toBe("major");
    expect(bumpType(["refactor: x\n\nBREAKING CHANGE: drops /meetings"])).toBe("major");
    expect(bumpType(["Merge pull request #5"])).toBe("patch");
  });

  it("has nothing to release when only release commits are new", () => {
    expect(bumpType([`${RELEASE_PREFIX} v0.11.0`])).toBeNull();
    expect(bumpType([])).toBeNull();
  });

  it("computes the next semantic version, keeping breaking changes minor before 1.0", () => {
    expect(nextVersion("0.10.0", "patch")).toBe("0.10.1");
    expect(nextVersion("0.10.3", "minor")).toBe("0.11.0");
    expect(nextVersion("0.10.3", "major")).toBe("0.11.0");
    expect(nextVersion("1.4.2", "major")).toBe("2.0.0");
  });

  it("writes a changelog entry from the notable commits since the last release", () => {
    const entry = changelogEntry("0.31.0", "2026-11-15", [
      "feat(ui): add the job board\n\nlong body",
      "fix: typo on the login page",
      "docs: update README",
      "Merge branch 'main'",
      `${RELEASE_PREFIX} v0.30.0`,
      "feat: add the job board",
    ]);
    expect(entry).toBe("## [0.31.0] - 2026-11-15\n\n- Add the job board\n- Typo on the login page\n");
    expect(changelogEntry("0.31.1", "2026-11-15", ["docs: update README"])).toContain("- Update README");
    expect(changelogEntry("0.31.1", "2026-11-15", [])).toContain("- Maintenance release.");
  });

  it("adds the entry above the newest one, once", () => {
    const log = "# Changelog\n\nIntro.\n\n## [0.10.0] - 2026-11-14\n\n- Old\n";
    const entry = changelogEntry("0.11.0", "2026-11-15", ["feat: new"]);
    const out = addToChangelog(log, entry);
    expect(out).toBe(
      "# Changelog\n\nIntro.\n\n## [0.11.0] - 2026-11-15\n\n- New\n\n## [0.10.0] - 2026-11-14\n\n- Old\n",
    );
    expect(addToChangelog(out, entry)).toBe(out);
    expect(addToChangelog("# Changelog\n", entry)).toBe(`# Changelog\n\n${entry}`);
  });

  it("rewrites only the version field", () => {
    const pkg = '{\n  "name": "true-fit",\n  "version": "0.10.0",\n  "private": true\n}\n';
    expect(setVersion(pkg, "0.11.0")).toBe(pkg.replace("0.10.0", "0.11.0"));
  });
});
