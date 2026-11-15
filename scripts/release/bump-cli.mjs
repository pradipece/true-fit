#!/usr/bin/env node
// Usage: node scripts/release/bump-cli.mjs [major|minor|patch]
// Without an argument, the bump comes from commits since the last release commit.
// Writes package.json and prints `version=X.Y.Z` (empty when there is nothing to release).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  addToChangelog,
  bumpType,
  changelogEntry,
  nextVersion,
  RELEASE_PREFIX,
  setVersion,
} from "./bump.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function messagesSinceRelease() {
  const last = git("log", "--format=%H", "-1", "--fixed-strings", `--grep=${RELEASE_PREFIX}`);
  const range = last ? `${last}..HEAD` : "HEAD";
  const raw = git("log", "--format=%B%x1e", range);
  return raw
    .split("\x1e")
    .map((m) => m.trim())
    .filter(Boolean);
}

const forced = process.argv[2];
if (forced && !["major", "minor", "patch"].includes(forced)) {
  console.error(`Unknown bump type: ${forced}`);
  process.exit(1);
}
const messages = messagesSinceRelease();
const type = forced || bumpType(messages);
if (!type) {
  console.log("version=");
  process.exit(0);
}

const path = new URL("../../package.json", import.meta.url);
const pkg = readFileSync(path, "utf8");
const version = nextVersion(JSON.parse(pkg).version, type);
writeFileSync(path, setVersion(pkg, version));

// The release commit (`git commit -am` in version.yml) also carries its changelog entry.
const changelogPath = new URL("../../CHANGELOG.md", import.meta.url);
const today = new Date().toISOString().slice(0, 10);
const entry = changelogEntry(version, today, messages);
writeFileSync(changelogPath, addToChangelog(readFileSync(changelogPath, "utf8"), entry));
console.log(`version=${version}`);
