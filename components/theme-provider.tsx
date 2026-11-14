"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // Run the theme script on the server-rendered HTML only; React warns about <script> during client renders.
      // See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
      scriptProps={{ type: typeof window === "undefined" ? "text/javascript" : "text/plain" }}
    >
      {children}
    </NextThemesProvider>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}
