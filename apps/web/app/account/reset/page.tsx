import type { Metadata } from "next";
import { Suspense } from "react";
import "../../home.css";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password · Science Behind It" };

export default function ResetPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Choose a new password</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </main>
  );
}
