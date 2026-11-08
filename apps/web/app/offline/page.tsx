import type { Metadata } from "next";
import { Suspense } from "react";
import "../account/account.css";
import "../home.css";
import { getT } from "../i18n/server";
import "../lesson/lesson.css";
import { OfflinePage } from "./offline-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("offline");
  return { title: t("metaTitle") };
}

export default function SavedOfflinePage() {
  return (
    <Suspense>
      <OfflinePage />
    </Suspense>
  );
}
