import type { Metadata } from "next";
import { Suspense } from "react";
import "../../home.css";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · Science Behind It" };

export default function SignInPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Sign in</h1>
      <p className="home__lead">Optional. Every lesson works without an account.</p>
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
