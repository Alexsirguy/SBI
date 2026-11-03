import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "../../i18n/server";
import { AuthCard } from "../auth-card";
import { ForgetAccount } from "./forget-account";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account");
  return { title: t("deletedMetaTitle") };
}

export default async function DeletedPage() {
  const t = await getT("account");
  return (
    <AuthCard title={t("deletedTitle")} intro={t("deletedIntro")}>
      <ForgetAccount />
      <p className="auth__done">
        {t("deletedText")} <Link href="/capture">{t("startLesson")}</Link>
      </p>
    </AuthCard>
  );
}
