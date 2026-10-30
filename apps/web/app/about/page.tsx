import type { Metadata } from "next";
import Link from "next/link";
import "../home.css";

export const metadata: Metadata = { title: "About · Science Behind It" };

export default function AboutPage() {
  return (
    <main id="main" className="prose-page">
      <h1>About Science Behind It</h1>
      <p className="home__lead">
        A way to understand how everyday things work, starting from what you can see.
      </p>

      <h2 id="checks">How lessons are made</h2>
      <ol>
        <li>You show us an object and confirm what it is.</li>
        <li>
          We break your question into smaller ones and look for answers in open textbooks and public
          science institutions.
        </li>
        <li>
          Each statement is checked against the passage it comes from before it can appear in a
          lesson, and every lesson lists its sources.
        </li>
        <li>
          Where no trusted source is found, the AI fills the gap from its general knowledge, and the
          lesson says so at the top.
        </li>
        <li>Lessons that have not been checked by a reviewer say that too.</li>
      </ol>

      <h2 id="safety">What it is not</h2>
      <p>
        Lessons explain the science behind an object. They are not advice on using, repairing,
        eating or taking anything. Lessons about medicines, chemicals, electricity and wild
        mushrooms start with a safety note and stay with the ideas.
      </p>

      <h2 id="report">Spotted a mistake?</h2>
      <p>
        Every lesson ends with a way to report a problem. Reports go to a reviewer with the exact
        version of the lesson you read.
      </p>

      <p>
        <Link href="/capture">Start a lesson</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
