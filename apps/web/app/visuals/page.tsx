import { GALLERY_FIXTURES } from "@sbi/visuals";
import type { Metadata } from "next";
import { connection } from "next/server";
import "../home.css";
import { VisualMount } from "./visual-mount";

// Not linked from the site: a fixed page for checking each kind in tests and the #92 evaluation.
export const metadata: Metadata = {
  title: "Visual kinds · Science Behind It",
  robots: { index: false, follow: false },
};

export default async function VisualsGalleryPage() {
  // Rendered per request, so its scripts carry the nonce the CSP proxy sets.
  await connection();
  return (
    <main id="main" className="prose-page">
      <h1>Visual kinds</h1>
      {GALLERY_FIXTURES.map((manifest) => (
        <section key={manifest.visualId} aria-labelledby={`kind-${manifest.kind}`}>
          <h2 id={`kind-${manifest.kind}`}>{manifest.kind}</h2>
          <VisualMount manifest={manifest} />
        </section>
      ))}
    </main>
  );
}
