import type { Metadata } from "next";
import "../home.css";
import { AccountPanel } from "./account-panel";

export const metadata: Metadata = { title: "Account · Science Behind It" };

export default function AccountPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Account</h1>
      <p className="home__lead">Optional. Every lesson works without signing in.</p>
      <AccountPanel />
    </main>
  );
}
