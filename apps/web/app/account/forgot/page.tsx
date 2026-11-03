import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "../../i18n/server";
import { AuthCard } from "../auth-card";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account");
  return { title: t("forgotMetaTitle") };
}

export default async function ForgotPage() {
  const t = await getT("account");
  return (
    <AuthCard
      title={t("forgotTitle")}
      intro={t("forgotIntro")}
      footer={
        <p>
          {t("forgotRemembered")} <Link href="/account/sign-in">{t("forgotSignInLink")}</Link>
        </p>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
