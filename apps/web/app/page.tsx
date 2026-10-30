import { Mark } from "@sbi/ui";
import Link from "next/link";
import { PHOTO_RETENTION_DAYS } from "./capture/limits";
import { MODULE_LABELS } from "./lesson/modules/labels";
import "./home.css";

const MODULE_BLURBS: Record<keyof typeof MODULE_LABELS, string> = {
  "what-youre-seeing": "Starts from what you can see and touch.",
  "short-answer": "The answer in a sentence or two, first.",
  "first-principles": "The basic ideas the answer is built on.",
  "how-parts-work": "Each part and the job it does.",
  "try-an-idea": "A small thing to try or notice yourself.",
  history: "Where the idea and the object came from.",
  "check-thinking": "A question to test what you have learned.",
  "go-further": "Where to read more, with sources.",
};

const TRUST = [
  {
    title: "Sources you can open",
    text: "Answers come from open textbooks and public science institutions, and every lesson lists the sources it used.",
    icon: "M5 4h10l4 4v12H5z M9 12h6 M9 16h6",
  },
  {
    title: "Every statement checked",
    text: "Each statement is checked against the passage it comes from before it can appear in a lesson.",
    icon: "M5 12l4 4 10-10",
  },
  {
    title: "Honest about gaps",
    text: "Where no trusted source covers a point, the AI fills it from general knowledge and the lesson says so at the top.",
    icon: "M12 4v9 M12 17v2",
  },
  {
    title: "Safety comes first",
    text: "Lessons about medicines, chemicals, electricity and wild mushrooms start with a safety note and stay with the ideas.",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  },
] as const;

const DEPTHS = [
  {
    name: "Quick",
    who: "Curious right now",
    text: "Short, simple words for a first look while the object is in your hand.",
  },
  {
    name: "Explore",
    who: "Learning something new",
    text: "An everyday explanation that builds the answer one step at a time.",
  },
  {
    name: "Deeper",
    who: "Studying or teaching",
    text: "More technical detail, with the sources to follow up.",
  },
] as const;

export default function HomePage() {
  return (
    <main id="main" className="home">
      <section className="home__hero" aria-labelledby="home-title">
        <div className="home__pitch">
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
            Photos are only used to recognise the object and are deleted within{" "}
            {PHOTO_RETENTION_DAYS} days. <Link href="/privacy">How we handle your photo</Link>
          </p>
        </div>

        <figure className="home__example" aria-labelledby="example-caption">
          <figcaption id="example-caption" className="eyebrow">
            Example lesson, shortened
          </figcaption>
          <div className="home__object">
            <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="4" />
              <path d="M30 30 L42 42" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <p>
              <span className="home__tag">You showed</span>
              <strong>A magnifying glass</strong>
            </p>
          </div>
          <div className="home__answer">
            <p className="home__tag">The short answer</p>
            <p>
              The lens makes a <Mark>larger, upright image</Mark> of the object, and that image
              takes up a larger angle in your eye.
            </p>
          </div>
          <ol className="home__reasons">
            <li>
              <strong>Glass bends light.</strong> A curved lens bends rays so they seem to come from
              a larger object.
            </li>
            <li>
              <strong>The lens and your eye work together.</strong> Your eye sees the image at a
              larger angle than the object alone.
            </li>
          </ol>
          <p className="home__sources">
            <span className="home__tag">Sources</span> LibreTexts Physics, CC BY 4.0 · LibreTexts
            Physics, CC BY-SA 2.5
          </p>
        </figure>
      </section>

      <section id="how" aria-labelledby="how-heading" className="home__band">
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

      <section id="inside" aria-labelledby="inside-heading" className="home__band">
        <h2 id="inside-heading">What&apos;s in every lesson</h2>
        <p className="home__intro">
          The same eight sections, in the same order, so you always know where you are.
        </p>
        <ol className="home__modules" role="list">
          {(Object.keys(MODULE_LABELS) as (keyof typeof MODULE_LABELS)[]).map((module) => (
            <li key={module}>
              <strong>{MODULE_LABELS[module]}</strong>
              <span>{MODULE_BLURBS[module]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="trust" aria-labelledby="trust-heading" className="home__band">
        <h2 id="trust-heading">Built so you can trust it</h2>
        <ul className="home__trust" role="list">
          {TRUST.map((item) => (
            <li key={item.title} className="sbi-card">
              <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d={item.icon}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/about#checks">Read how lessons are checked</Link>
        </p>
      </section>

      <section id="for-you" aria-labelledby="for-heading" className="home__band">
        <h2 id="for-heading">For anyone who asks why</h2>
        <p className="home__intro">
          Choose how deep to go. You can also set an age band, Child, Teen or Adult, if you want; we
          never guess your age.
        </p>
        <ul className="home__depths" role="list">
          {DEPTHS.map((depth) => (
            <li key={depth.name}>
              <p className="home__tag">{depth.name}</p>
              <h3>{depth.who}</h3>
              <p>{depth.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cta-heading" className="home__cta">
        <h2 id="cta-heading">Everyday objects hide clever science.</h2>
        <p>Pick one near you and find out how it works.</p>
        <Link href="/capture" className="sbi-button sbi-button--primary">
          Start your first lesson
        </Link>
      </section>
    </main>
  );
}
