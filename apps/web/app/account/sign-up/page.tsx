import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "../../i18n/server";
import { AuthCard } from "../auth-card";
import { SignUpForm } from "./sign-up-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account");
  return { title: t("signUpMetaTitle") };
}

export default async function SignUpPage() {
  const t = await getT("account");
  return (
    <AuthCard
      tab="sign-up"
      title={t("signUpTitle")}
      intro={t("signUpIntro")}
      footer={
        <p>
          {t("signUpHaveAccount")} <Link href="/account/sign-in">{t("signUpSignInLink")}</Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
