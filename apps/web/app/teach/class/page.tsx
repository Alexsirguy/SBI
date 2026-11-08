import type { Metadata } from "next";
import { Suspense } from "react";
import "../../account/account.css";
import "../../home.css";
import { getT } from "../../i18n/server";
import "../teach.css";
import { ClassPage } from "../class-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("teach");
  return { title: t("classPageMeta") };
}

export default function TeachClassPage() {
  return (
    <main id="main" className="prose-page teach">
      <Suspense>
        <ClassPage />
      </Suspense>
    </main>
  );
}
