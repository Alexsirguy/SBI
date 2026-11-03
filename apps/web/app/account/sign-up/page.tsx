import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create an account · Science Behind It" };

export default function SignUpPage() {
  return (
    <AuthCard
      tab="sign-up"
      title="Create your account"
      intro="Optional, for people 13 and over. Every lesson works without one."
      footer={
        <p>
          Already have an account? <Link href="/account/sign-in">Sign in</Link>
        </p>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
