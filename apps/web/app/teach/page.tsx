import type { Metadata } from "next";
import "../account/account.css";
import "../home.css";
import { getT } from "../i18n/server";
import "./teach.css";
import { TeachHome } from "./teach-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("teach");
  return { title: t("metaTitle") };
}

export default async function TeachPage() {
  const t = await getT("teach");
  return (
    <main id="main" className="prose-page teach">
      <h1>{t("heading")}</h1>
      <p className="home__lead">{t("lead")}</p>
      <TeachHome />
    </main>
  );
}
