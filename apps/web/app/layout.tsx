import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";
// Validates public env at build and startup.
import "../env";
import "@sbi/ui/styles.css";
import "./globals.css";
import "./site-chrome.css";
import { Providers } from "./providers";
import { SiteFooter, SiteHeader } from "./site-chrome";

// Self-hosted at build time, so learners' browsers never contact a font host (ADR 0012).
const bodyFace = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--sbi-font-body-face",
  display: "swap",
});
const displayFace = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--sbi-font-display-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Science Behind It",
  description: "Explore the science behind everyday objects.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bodyFace.variable} ${displayFace.variable}`}>
      <body>
        <SiteHeader />
        <Providers>{children}</Providers>
        <SiteFooter />
      </body>
    </html>
  );
}
