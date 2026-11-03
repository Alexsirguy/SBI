import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
// Validates public env at build and startup.
import "../env";
import "@sbi/ui/styles.css";
import "./globals.css";
import "./site-chrome.css";
import { getLocale, getMessages } from "./i18n/load";
import { I18nProvider } from "./i18n/provider";
import { Providers } from "./providers";
import { SiteHeader } from "./site-chrome";
import { SiteFooter } from "./site-footer";

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

// One weight keeps the font budget (#259); labels are short and set in one weight anyway.
const monoFace = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--sbi-font-mono-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Science Behind It",
  description: "Explore the science behind everyday objects.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages(locale);
  return (
    <html
      lang={locale}
      className={`${bodyFace.variable} ${displayFace.variable} ${monoFace.variable}`}
    >
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <SiteHeader />
          <Providers>{children}</Providers>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
