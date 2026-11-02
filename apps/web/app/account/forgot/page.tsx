import type { Metadata } from "next";
import "../../home.css";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot your password · Science Behind It" };

export default function ForgotPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Forgot your password</h1>
      <p className="home__lead">We will email you a link to choose a new one.</p>
      <ForgotForm />
    </main>
  );
}
