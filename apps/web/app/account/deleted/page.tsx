import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Account deleted · Science Behind It" };

export default function DeletedPage() {
  return (
    <AuthCard
      title="Your account is deleted"
      intro="Your details, saved lessons and linked photos are gone. Copies in our backups are gone within 30 days."
    >
      <p className="auth__done">
        Every lesson still works without an account. <Link href="/capture">Start a lesson</Link>
      </p>
    </AuthCard>
  );
}
