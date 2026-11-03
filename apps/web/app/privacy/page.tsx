import type { Metadata } from "next";
import Link from "next/link";
import { PHOTO_RETENTION_DAYS } from "../capture/limits";
import { getT } from "../i18n/server";
import "../home.css";
import { YourChoices } from "./your-choices";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("site");
  return { title: t("privacyMetaTitle") };
}

export default async function PrivacyPage() {
  const t = await getT("site");
  return (
    <main id="main" className="prose-page">
      <h1>{t("privacyHeading")}</h1>
      <p className="home__lead">{t("privacyLead")}</p>

      <h2>{t("privacyPhotoHeading")}</h2>
      <ul>
        <li>{t("privacyPhotoUse")}</li>
        <li>{t("privacyPhotoStrip")}</li>
        <li>{t("privacyPhotoStorage")}</li>
        <li>{t("privacyPhotoRetention", { days: PHOTO_RETENTION_DAYS })}</li>
      </ul>

      <h2>{t("privacyQuestionHeading")}</h2>
      <ul>
        <li>{t("privacyQuestionSent")}</li>
        <li>{t("privacyQuestionSettings")}</li>
      </ul>

      <h2>{t("privacyFeedbackHeading")}</h2>
      <ul>
        <li>{t("privacyFeedbackStored")}</li>
        <li>{t("privacyFeedbackRetention")}</li>
      </ul>

      <h2>{t("privacyAccountHeading")}</h2>
      <ul>
        <li>{t("privacyAccountOptional")}</li>
        <li>{t("privacyAccountKept")}</li>
        <li>{t("privacyAccountEmails")}</li>
        <li>{t("privacyAccountCookie")}</li>
        <li>{t("privacyAccountSaving")}</li>
        <li>{t("privacyAccountLinking")}</li>
        <li>{t("privacyAccountExport")}</li>
      </ul>

      <YourChoices />

      <h2>{t("privacyFontsHeading")}</h2>
      <p>{t("privacyFontsText")}</p>

      <p>
        <Link href="/capture">{t("navStartLesson")}</Link>
      </p>
    </main>
  );
}
