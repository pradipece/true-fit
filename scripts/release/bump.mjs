// Next semantic version from conventional commit subjects/bodies since the last release.
// Used by .github/workflows/version.yml; kept dependency-free so CI needs no install.

/** Commit subject of a release commit. Vercel only builds production for these. */
export const RELEASE_PREFIX = "chore(release):";

/** "major" | "minor" | "patch" | null (nothing to release). */
export function bumpType(messages) {
  const real = messages.filter((m) => m.trim() && !m.startsWith(RELEASE_PREFIX));
  if (!real.length) return null;
  if (real.some((m) => /^\w+(\([^)]*\))?!:/.test(m) || /^BREAKING[ -]CHANGE:/m.test(m))) return "major";
  if (real.some((m) => /^feat(\([^)]*\))?:/.test(m))) return "minor";
  return "patch";
}

export function nextVersion(current, type) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!m) throw new Error(`Not a semantic version: ${current}`);
  let [major, minor, patch] = m.slice(1).map(Number);
  // Before 1.0.0, a breaking change bumps the minor version (semver convention for 0.x).
  if (type === "major" && major === 0) type = "minor";
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const CONVENTIONAL = /^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/;
/** Types that describe a change people notice; others (docs, chore, test…) only when nothing else. */
const NOTABLE = new Set(["feat", "fix", "perf"]);

/**
 * A CHANGELOG.md entry for a release, from the commit subjects since the last one:
 * "## [X.Y.Z] - YYYY-MM-DD" (plus "· `sha`" when given) and one line per change.
 */
export function changelogEntry(version, date, messages, sha = "") {
  const parsed = messages
    .map((m) => m.split("\n")[0].trim())
    .filter((s) => s && !s.startsWith(RELEASE_PREFIX) && !/^Merge\b/.test(s))
    .map((s) => {
      const m = CONVENTIONAL.exec(s);
      return m ? { type: m[1], text: m[2] } : { type: "", text: s };
    });
  const notable = parsed.filter((p) => NOTABLE.has(p.type));
  const shown = [...new Set((notable.length ? notable : parsed).map((p) => p.text))];
  const lines = shown.length
    ? shown.map((t) => `- ${t.charAt(0).toUpperCase()}${t.slice(1)}`)
    : ["- Maintenance release."];
  return `## [${version}] - ${date}${sha ? ` · \`${sha}\`` : ""}\n\n${lines.join("\n")}\n`;
}

/** Insert an entry above the newest one (or at the end), unless that version is already listed. */
export function addToChangelog(changelog, entry) {
  const heading = entry.split("\n")[0].replace(/ - .*/, "");
  if (changelog.includes(`${heading} `) || changelog.includes(`${heading}\n`)) return changelog;
  const i = changelog.indexOf("\n## [");
  if (i < 0) return `${changelog.trimEnd()}\n\n${entry}`;
  return `${changelog.slice(0, i + 1)}${entry}\n${changelog.slice(i + 1)}`;
}

/** Replace only the "version" field, so the rest of package.json keeps its formatting. */
export function setVersion(packageJson, version) {
  const out = packageJson.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
  if (out === packageJson) throw new Error('No "version" field found in package.json');
  return out;
}
