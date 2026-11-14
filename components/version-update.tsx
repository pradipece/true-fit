"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { APP_BUILD_ID, isNewerBuild, type VersionInfo } from "@/lib/version";

const POLL_MS = 60_000;
const TOAST_ID = "version-update";

/**
 * Polls /api/version and, once a newer deployment is live, shows a persistent
 * toast with a Refresh button. Demo state lives in localStorage, so a reload keeps it.
 */
export function VersionUpdate() {
  const shown = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    async function check() {
      if (shown.current || document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const server = (await res.json()) as VersionInfo;
        if (cancelled || !isNewerBuild(APP_BUILD_ID, server)) return;
        shown.current = true;
        toast.info(`A new version (v${server.version}) is available`, {
          id: TOAST_ID,
          description: "Refresh to load the latest update. Your demo progress is kept.",
          duration: Infinity,
          action: { label: "Refresh", onClick: () => window.location.reload() },
          onDismiss: () => {
            // Ask again on the next check if the person dismisses without refreshing.
            shown.current = false;
          },
        });
      } catch {
        // Offline or server restarting: try again on the next tick.
      }
    }

    const interval = window.setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    check();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, []);

  return null;
}
