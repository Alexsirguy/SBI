import type { Metadata } from "next";
import Link from "next/link";
import { PHOTO_RETENTION_DAYS } from "../capture/limits";
import "../home.css";
import { YourChoices } from "./your-choices";

export const metadata: Metadata = { title: "Privacy · Science Behind It" };

export default function PrivacyPage() {
  return (
    <main id="main" className="prose-page">
      <h1>Privacy</h1>
      <p className="home__lead">
        What happens to your photo, your question and your feedback, in plain words.
      </p>

      <h2>Your photo</h2>
      <ul>
        <li>We use it only to recognise the object for your lesson.</li>
        <li>
          Before upload, your device removes location and camera details from the photo, and we
          remove them again when it arrives.
        </li>
        <li>
          It is stored privately on Cloudflare R2 and never shown to other learners. When photo
          recognition is on, it is sent to Meta&apos;s model API, or to OpenAI&apos;s if Meta is
          unavailable; neither may train on it.
        </li>
        <li>
          It is deleted within {PHOTO_RETENTION_DAYS} days, or sooner once recognised, unless you
          choose to keep it. A kept photo stays until you delete it, below.
        </li>
      </ul>

      <h2>Your question</h2>
      <ul>
        <li>
          Your question and what the lesson is about (the name we recognised or the words you typed)
          are sent to the AI model that writes your lesson. The lesson is stored with its sources
          and checks so a reviewer can look at it; your photo is never part of a lesson.
        </li>
        <li>
          Your choice of depth and age band stays in this browser tab and is only used to ask for
          the right version of a lesson. We never guess your age.
        </li>
      </ul>

      <h2>Your feedback</h2>
      <ul>
        <li>
          Ratings and problem reports are stored with the lesson they are about, not with you.
        </li>
        <li>
          Anything you type in a report is deleted after 90 days. Please leave out your name and
          other personal details.
        </li>
      </ul>

      <YourChoices />

      <h2>Fonts and other sites</h2>
      <p>
        Fonts are served by us, so reading a lesson does not contact a font company. Links to
        sources open the source&apos;s own site, which has its own privacy rules.
      </p>

      <p>
        <Link href="/capture">Start a lesson</Link>
      </p>
    </main>
  );
}
