import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { VerifyEmail } from "./verify-email";

export const metadata: Metadata = { title: "Confirm your email · Science Behind It" };

export default function VerifyPage() {
  return (
    <AuthCard title="Confirm your email">
      <Suspense>
        <VerifyEmail />
      </Suspense>
    </AuthCard>
  );
}
