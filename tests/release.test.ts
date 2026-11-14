import { describe, expect, it } from "vitest";
import { bumpType, nextVersion, RELEASE_PREFIX, setVersion } from "../scripts/release/bump.mjs";

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

  it("rewrites only the version field", () => {
    const pkg = '{\n  "name": "true-fit",\n  "version": "0.10.0",\n  "private": true\n}\n';
    expect(setVersion(pkg, "0.11.0")).toBe(pkg.replace("0.10.0", "0.11.0"));
  });
});
