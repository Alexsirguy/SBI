import type { Metadata } from "next";
import Link from "next/link";
import "../../home.css";
import { SavedList } from "./saved-list";

export const metadata: Metadata = { title: "Saved lessons · Science Behind It" };

export default function SavedLessonsPage() {
  return (
    <main id="main" className="prose-page">
      <p>
        <Link href="/account">Your account</Link>
      </p>
      <h1>Saved lessons</h1>
      <p className="home__lead">
        Each one is kept exactly as you saved it. Only you can see this list.
      </p>
      <SavedList />
    </main>
  );
}
