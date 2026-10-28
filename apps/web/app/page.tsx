import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Science Behind It</h1>
      <p>Photograph an everyday object and discover how it works.</p>
      <p>
        <Link href="/capture">Start with a photo</Link>
      </p>
    </main>
  );
}
