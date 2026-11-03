import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "../../i18n/server";
import { AuthCard } from "../auth-card";
import { ResetForm } from "./reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account");
  return { title: t("resetMetaTitle") };
}

export default async function ResetPage() {
  const t = await getT("account");
  return (
    <AuthCard title={t("resetTitle")} intro={t("resetIntro")}>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
