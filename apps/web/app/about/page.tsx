import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "../i18n/server";
import "../home.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("site");
  return { title: t("aboutMetaTitle") };
}

export default async function AboutPage() {
  const t = await getT("site");
  return (
    <main id="main" className="prose-page">
      <h1>{t("aboutHeading")}</h1>
      <p className="home__lead">{t("aboutLead")}</p>

      <h2 id="checks">{t("aboutMadeHeading")}</h2>
      <ol>
        <li>{t("aboutMadeShow")}</li>
        <li>{t("aboutMadeSearch")}</li>
        <li>{t("aboutMadeCheck")}</li>
        <li>{t("aboutMadeGaps")}</li>
        <li>{t("aboutMadeReviewer")}</li>
      </ol>

      <h2 id="safety">{t("aboutNotHeading")}</h2>
      <p>{t("aboutNotText")}</p>

      <h2 id="report">{t("aboutReportHeading")}</h2>
      <p>{t("aboutReportText")}</p>

      <p>
        <Link href="/capture">{t("navStartLesson")}</Link> ·{" "}
        <Link href="/privacy">{t("navPrivacy")}</Link>
      </p>
    </main>
  );
}
