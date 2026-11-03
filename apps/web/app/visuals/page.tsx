import { GALLERY_FIXTURES } from "@sbi/visuals";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getT } from "../i18n/server";
import "../home.css";
import { VisualMount } from "./visual-mount";

// Not linked from the site: a fixed page for checking each kind in tests and the #92 evaluation.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("lesson");
  return { title: t("visualKindsTitle"), robots: { index: false, follow: false } };
}

export default async function VisualsGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  // Rendered per request, so its scripts carry the nonce the CSP proxy sets.
  await connection();
  // One kind alone, so a measurement counts only that kind's downloads (#92).
  const { kind } = await searchParams;
  const t = await getT("lesson");
  const shown = GALLERY_FIXTURES.filter((manifest) => !kind || manifest.kind === kind);
  return (
    <main id="main" className="prose-page">
      <h1>{t("visualKinds")}</h1>
      {shown.map((manifest) => (
        <section key={manifest.visualId} aria-labelledby={`kind-${manifest.kind}`}>
          <h2 id={`kind-${manifest.kind}`}>{manifest.kind}</h2>
          <VisualMount manifest={manifest} />
        </section>
      ))}
    </main>
  );
}
