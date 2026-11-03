import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · Science Behind It" };

export default function SignInPage() {
  return (
    <AuthCard
      tab="sign-in"
      title="Welcome back"
      intro="Sign in with Google or your email. Every lesson still works without an account."
      footer={
        <p>
          New here? <Link href="/account/sign-up">Create an account</Link>
        </p>
      }
    >
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
