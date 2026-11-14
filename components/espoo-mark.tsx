import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const MASK = "url(/images/espoo-mark.png) center / contain no-repeat";
const style: CSSProperties = { mask: MASK, WebkitMask: MASK };

/**
 * The City of Espoo swirl mark (cropped from public/images/Espoon-kaupunki-logo.webp),
 * drawn as a mask so it sizes like a lucide icon. Espoo blue in light mode, a lighter
 * blue in dark mode so it stays readable.
 */
export function EspooMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn("inline-block size-4 shrink-0 bg-[#004397] dark:bg-[#8ab4ff]", className)}
    />
  );
}
