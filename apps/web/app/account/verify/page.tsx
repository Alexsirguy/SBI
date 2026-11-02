import type { Metadata } from "next";
import { Suspense } from "react";
import "../../home.css";
import { VerifyEmail } from "./verify-email";

export const metadata: Metadata = { title: "Confirm your email · Science Behind It" };

export default function VerifyPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Confirm your email</h1>
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </main>
  );
}
