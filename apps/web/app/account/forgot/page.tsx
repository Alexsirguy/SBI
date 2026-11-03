import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot your password · Science Behind It" };

export default function ForgotPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      intro="Enter your email and we will send you a link to choose a new one."
      footer={
        <p>
          Remembered it? <Link href="/account/sign-in">Sign in</Link>
        </p>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
