import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "../auth-card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password · Science Behind It" };

export default function ResetPage() {
  return (
    <AuthCard title="Choose a new password" intro="This signs you out on every other device.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
