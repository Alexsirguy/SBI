import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getT } from "../../i18n/server";
import { AuthCard } from "../auth-card";
import { SignInForm } from "./sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account");
  return { title: t("signInMetaTitle") };
}

export default async function SignInPage() {
  const t = await getT("account");
  return (
    <AuthCard
      tab="sign-in"
      title={t("signInTitle")}
      intro={t("signInIntro")}
      footer={
        <p>
          {t("signInNewHere")} <Link href="/account/sign-up">{t("signInCreateLink")}</Link>
        </p>
      }
    >
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
