import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import pkg from "./package.json" with { type: "json" };

/** Short commit of this build: the host's env var when deployed, else local git, else none. */
function commitSha(): string | undefined {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

const sha = commitSha();
// Unique per build, so a redeploy of the same version still triggers the update notice.
const buildId = `${pkg.version}+${sha ?? Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_COMMIT: sha ?? "",
    NEXT_PUBLIC_APP_BUILD_ID: buildId,
  },
  experimental: {
    agentFeedback: true,
  },
  // The old meetings picker: each role now has its own meetings page, chosen on the home page.
  // Candidate review and insights moved from the company to the organiser (the broker).
  async redirects() {
    return [
      { source: "/meetings", destination: "/", permanent: false },
      { source: "/company/candidates", destination: "/organiser", permanent: false },
      { source: "/company/insights", destination: "/organiser/insights", permanent: false },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
