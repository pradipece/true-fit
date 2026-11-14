import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VersionUpdate } from "@/components/version-update";
import { getEsco, getSeed } from "@/lib/seed-db";
import { DemoProvider } from "@/lib/store";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "True Fit · Evidence-based matchmaking for Espoo recruitment events",
    template: "%s · True Fit",
  },
  description:
    "More signal, less noise: companies describe real needs, talent shows real evidence, the event organiser introduces them and both decide whom to meet, with explainable matches before, during and after the event.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Everything comes from the database (Tiger Data, else Supabase; cached, see lib/seed-db.ts).
  const [{ companies, needs, talent }, esco] = await Promise.all([getSeed(), getEsco()]);
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <DemoProvider seed={{ companies, needs, talent }} esco={esco}>
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <footer className="border-t py-6 text-center text-xs text-muted-foreground">
                Prototype for the City of Espoo “Rethinking Recruitment” challenge · all data is synthetic ·
                the AI suggests, people decide ·{" "}
                <Link href="/responsible" className="underline underline-offset-4 hover:text-foreground">
                  Responsible AI
                </Link>
                <span className="mt-1 block font-mono" title={APP_COMMIT ? `Build ${APP_COMMIT}` : undefined}>
                  v{APP_VERSION}
                  {APP_COMMIT && <span className="opacity-60"> · {APP_COMMIT}</span>}
                </span>
              </footer>
              {/* Raised so toasts don't cover the chat button in the bottom-right corner. */}
              <Toaster position="bottom-right" offset={{ bottom: 88 }} mobileOffset={{ bottom: 88 }} />
              <VersionUpdate />
            </DemoProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
