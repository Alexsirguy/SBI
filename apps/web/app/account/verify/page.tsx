import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "../../i18n/server";
import { AuthCard } from "../auth-card";
import { VerifyEmail } from "./verify-email";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account");
  return { title: t("verifyMetaTitle") };
}

export default async function VerifyPage() {
  const t = await getT("account");
  return (
    <AuthCard title={t("verifyTitle")}>
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthCard>
  );
}
