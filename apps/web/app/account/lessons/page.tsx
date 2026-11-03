import type { Metadata } from "next";
import Link from "next/link";
import "../../home.css";
import { getT } from "../../i18n/server";
import { SavedList } from "./saved-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account");
  return { title: t("savedMetaTitle") };
}

export default async function SavedLessonsPage() {
  const t = await getT("account");
  return (
    <main id="main" className="prose-page">
      <p>
        <Link href="/account">{t("savedAccountLink")}</Link>
      </p>
      <h1>{t("savedHeading")}</h1>
      <p className="home__lead">{t("savedLead")}</p>
      <SavedList />
    </main>
  );
}
