import type { Metadata } from "next";
import "../home.css";
import { AccountPanel } from "./account-panel";

export const metadata: Metadata = { title: "Account · Science Behind It" };

export default function AccountPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Your account</h1>
      <AccountPanel />
    </main>
  );
}
