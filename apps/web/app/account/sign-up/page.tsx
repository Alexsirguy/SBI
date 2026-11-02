import type { Metadata } from "next";
import "../../home.css";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Make an account · Science Behind It" };

export default function SignUpPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Make an account</h1>
      <p className="home__lead">
        Optional, and for people 13 and over. Every lesson works without one.
      </p>
      <SignUpForm />
    </main>
  );
}
