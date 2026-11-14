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

/** Replace only the "version" field, so the rest of package.json keeps its formatting. */
export function setVersion(packageJson, version) {
  const out = packageJson.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
  if (out === packageJson) throw new Error('No "version" field found in package.json');
  return out;
}
