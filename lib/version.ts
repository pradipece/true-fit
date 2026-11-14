/** Build info inlined at build time by `next.config.ts` (from package.json and git). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT || undefined;
export const APP_BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? APP_VERSION;

export type VersionInfo = { version: string; commit?: string; buildId: string };

export const versionInfo: VersionInfo = { version: APP_VERSION, commit: APP_COMMIT, buildId: APP_BUILD_ID };

/** True when the server reports a different build than the one this tab loaded. */
export function isNewerBuild(loaded: string, server: Partial<VersionInfo> | null | undefined): boolean {
  return typeof server?.buildId === "string" && server.buildId.length > 0 && server.buildId !== loaded;
}
