import type { Metadata } from "next";
import "../home.css";
import { getT } from "../i18n/server";
import { AccountPanel } from "./account-panel";
import "./account.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("account");
  return { title: t("accountMetaTitle") };
}

export default async function AccountPage() {
  const t = await getT("account");
  return (
    <main id="main" className="account">
      <h1>{t("accountHeading")}</h1>
      <AccountPanel />
    </main>
  );
}
