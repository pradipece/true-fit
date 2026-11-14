import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { StepNav } from "@/components/step-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DemoProvider } from "@/lib/store";
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
    "More signal, less noise: companies describe real needs, talent shows real evidence, and organisers approve explainable matches before, during and after the event.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <DemoProvider>
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <StepNav />
              <footer className="border-t py-6 text-center text-xs text-muted-foreground">
                Prototype for the City of Espoo “Rethinking Recruitment” challenge · all data is synthetic ·
                the AI suggests, people decide
              </footer>
              <Toaster position="bottom-right" />
            </DemoProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
