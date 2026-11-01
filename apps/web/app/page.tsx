import { Mark } from "@sbi/ui";
import Link from "next/link";
import { PHOTO_RETENTION_DAYS } from "./capture/limits";
import { MERRILL_MODULES } from "@sbi/contracts";
import { MODULE_LABELS } from "./lesson/modules/labels";
import "./home.css";

const MODULE_BLURBS: Partial<Record<(typeof MERRILL_MODULES)[number], string>> = {
  problem: "A real task with your object, to start from.",
  activate: "Links it to what you already know, then you make a guess.",
  demonstrate: "The answer worked out step by step, in a live experiment.",
  apply: "Solve new challenges yourself by changing the experiment.",
  integrate: "Something to notice or try in your own day.",
};

const TRUST = [
  {
    title: "Sources you can open",
    text: "Lessons draw on open textbooks and public science institutions, and every lesson lists the sources it used.",
    icon: "M5 4h10l4 4v12H5z M9 12h6 M9 16h6",
  },
  {
    title: "Sourced statements checked",
    text: "Each sourced statement is checked against the passage it comes from before it can appear in a lesson.",
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
            Point your camera at an everyday object, or describe it. You get a real problem to
            solve, watch it worked out, then try it yourself by changing a live experiment.
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
            <p className="home__tag">The problem</p>
            <p>
              The print on a medicine bottle is too small to read.{" "}
              <Mark>Where do you hold the glass</Mark> to make it bigger?
            </p>
          </div>
          <ol className="home__reasons">
            <li>
              <strong>You guess first.</strong> Close to the print, or far above it?
            </li>
            <li>
              <strong>Then you try it.</strong> Move the lens in the experiment and watch the
              magnification change until the print is big enough.
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
              <strong>Show us the object.</strong> Take a photo or type what it is. We name what we
              see and start your lesson; if we get it wrong, you can say what it is.
            </span>
          </li>
          <li>
            <span>
              <strong>Start with a problem.</strong> A real task with your object, and a guess
              before anything is explained.
            </span>
          </li>
          <li>
            <span>
              <strong>Watch it, then do it.</strong> See the answer worked out, then change the
              experiment yourself to solve new challenges.
            </span>
          </li>
        </ol>
      </section>

      <section id="inside" aria-labelledby="inside-heading" className="home__band">
        <h2 id="inside-heading">What&apos;s in every lesson</h2>
        <p className="home__intro">
          The same five steps, in the same order, so you always know where you are.
        </p>
        <ol className="home__modules" role="list">
          {MERRILL_MODULES.map((module) => (
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
