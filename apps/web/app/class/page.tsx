import type { Metadata } from "next";
import { Suspense } from "react";
import "../account/account.css";
import "../home.css";
import { getT } from "../i18n/server";
import "../teach/teach.css";
import { ClassPage } from "./class-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("teach");
  return { title: t("joinMetaTitle") };
}

export default function JoinClassPage() {
  return (
    <Suspense>
      <ClassPage />
    </Suspense>
  );
}
