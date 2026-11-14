import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isNewerBuild } from "@/lib/version";

describe("isNewerBuild", () => {
  it("flags a different build id from the server", () => {
    expect(isNewerBuild("0.10.0+abc1234", { buildId: "0.11.0+def5678" })).toBe(true);
    expect(isNewerBuild("0.10.0+abc1234", { buildId: "0.10.0+def5678" })).toBe(true);
  });

  it("ignores the same build and malformed responses", () => {
    expect(isNewerBuild("0.10.0+abc1234", { buildId: "0.10.0+abc1234" })).toBe(false);
    expect(isNewerBuild("0.10.0+abc1234", { buildId: "" })).toBe(false);
    expect(isNewerBuild("0.10.0+abc1234", {})).toBe(false);
    expect(isNewerBuild("0.10.0+abc1234", null)).toBe(false);
  });
});

describe("package version", () => {
  it("is semver and listed in the changelog", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(readFileSync("CHANGELOG.md", "utf8")).toContain(`## [${version}]`);
  });
});
