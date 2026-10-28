import type { Metadata } from "next";
import type { ReactNode } from "react";
// Validates public env at build and startup.
import "../env";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Science Behind It",
  description: "Explore the science behind everyday objects.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
