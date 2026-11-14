#!/usr/bin/env node
// Vercel "Ignored Build Step" (vercel.json → ignoreCommand).
// Exit 0 = skip this build, exit 1 = build.
//
// Every push to main triggers the version workflow, which pushes a
// "chore(release): vX.Y.Z" commit a moment later. Building both would deploy the same
// code twice, so production builds only run for the release commit. Previews always build.
import { RELEASE_PREFIX } from "./bump.mjs";

const env = process.env.VERCEL_ENV;
const message = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "";

if (env !== "production") {
  console.log(`Building: ${env ?? "unknown"} deployment.`);
  process.exit(1);
}
if (message.startsWith(RELEASE_PREFIX)) {
  console.log(`Building release commit: ${message.split("\n")[0]}`);
  process.exit(1);
}
console.log("Skipping: production builds wait for the version bump commit from GitHub Actions.");
process.exit(0);
