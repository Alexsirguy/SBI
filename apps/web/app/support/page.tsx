import type { Metadata } from "next";
import "../home.css";
import { getT } from "../i18n/server";
import { SupportMapView } from "./support-map";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("site");
  return { title: t("supportMetaTitle") };
}

export default async function SupportPage() {
  const t = await getT("site");
  return (
    <main id="main" className="prose-page support-page">
      <h1>{t("supportTitle")}</h1>
      <p className="home__lead">{t("supportLead")}</p>
      <SupportMapView />
      <h2>{t("supportNextHeading")}</h2>
      <p>{t("supportNext")}</p>
    </main>
  );
}
