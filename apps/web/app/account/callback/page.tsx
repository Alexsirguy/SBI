import type { Metadata } from "next";
import "../../home.css";
import { FinishSignIn } from "./finish-sign-in";

export const metadata: Metadata = { title: "Signing in · Science Behind It" };

export default function CallbackPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Signing in</h1>
      <FinishSignIn />
    </main>
  );
}
