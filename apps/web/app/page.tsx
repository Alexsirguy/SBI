import Link from "next/link";
import { PHOTO_RETENTION_DAYS } from "./capture/limits";
import "./home.css";

export default function HomePage() {
  return (
    <main id="main" className="home">
      <section className="home__hero" aria-labelledby="home-title">
        <p className="eyebrow">Science Behind It</p>
        <h1 id="home-title">What&apos;s the science behind that?</h1>
        <p className="home__lead">
          Point your camera at an everyday object, or describe it. You get a short answer first,
          then the reasons, one step at a time, with the sources they come from.
        </p>
        <div className="home__actions">
          <Link href="/capture" className="sbi-button sbi-button--primary">
            Take a photo
          </Link>
          <Link href="/capture#text-entry" className="sbi-button sbi-button--quiet">
            Describe it instead
          </Link>
        </div>
        <p className="home__privacy">
          Photos are only used to recognise the object and are deleted within {PHOTO_RETENTION_DAYS}{" "}
          days. <Link href="/privacy">How we handle your photo</Link>
        </p>
      </section>

      <section aria-labelledby="how-heading" className="home__how">
        <h2 id="how-heading">How a lesson works</h2>
        <ol className="home__steps" role="list">
          <li>
            <span>
              <strong>Show us the object.</strong> Take a photo or type what it is, then confirm we
              have it right.
            </span>
          </li>
          <li>
            <span>
              <strong>Get the short answer.</strong> It arrives first, checked against its sources.
            </span>
          </li>
          <li>
            <span>
              <strong>Go as deep as you like.</strong> Eight short sections build the answer from
              first principles, with every source listed.
            </span>
          </li>
        </ol>
      </section>
    </main>
  );
}
