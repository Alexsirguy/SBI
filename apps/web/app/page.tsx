import { Mark } from "@sbi/ui";
import Link from "next/link";
import { PHOTO_RETENTION_DAYS } from "./capture/limits";
import { MERRILL_MODULES } from "@sbi/contracts";
import { MODULE_LABEL_KEYS } from "./lesson/modules/labels";
import type { Messages } from "./i18n/messages";
import { getT } from "./i18n/server";
import "./home.css";

type SiteKey = keyof Messages["site"];

const MODULE_BLURBS: Partial<Record<(typeof MERRILL_MODULES)[number], SiteKey>> = {
  problem: "moduleBlurbProblem",
  activate: "moduleBlurbActivate",
  demonstrate: "moduleBlurbDemonstrate",
  apply: "moduleBlurbApply",
  integrate: "moduleBlurbIntegrate",
};

const TRUST = [
  {
    id: "sources",
    title: "trustSourcesTitle",
    text: "trustSourcesText",
    icon: "M5 4h10l4 4v12H5z M9 12h6 M9 16h6",
  },
  { id: "checked", title: "trustCheckedTitle", text: "trustCheckedText", icon: "M5 12l4 4 10-10" },
  { id: "gaps", title: "trustGapsTitle", text: "trustGapsText", icon: "M12 4v9 M12 17v2" },
  {
    id: "safety",
    title: "trustSafetyTitle",
    text: "trustSafetyText",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  },
] as const;

const DEPTHS = [
  { id: "quick", name: "depthQuickName", who: "depthQuickWho", text: "depthQuickText" },
  { id: "explore", name: "depthExploreName", who: "depthExploreWho", text: "depthExploreText" },
  { id: "deeper", name: "depthDeeperName", who: "depthDeeperWho", text: "depthDeeperText" },
] as const;

export default async function HomePage() {
  const t = await getT("site");
  const tLesson = await getT("lesson");
  return (
    <main id="main" className="home">
      <section className="home__hero" aria-labelledby="home-title">
        <div className="home__pitch">
          <p className="eyebrow">Science Behind It</p>
          <h1 id="home-title">{t("homeTitle")}</h1>
          <p className="home__lead">{t("homeLead")}</p>
          <div className="home__actions">
            <Link href="/capture" className="sbi-button sbi-button--primary">
              {t("homeTakePhoto")}
            </Link>
            <Link href="/capture#text-entry" className="sbi-button sbi-button--quiet">
              {t("homeDescribeInstead")}
            </Link>
          </div>
          <p className="home__privacy">
            {t("homePhotoPrivacy", { days: PHOTO_RETENTION_DAYS })}{" "}
            <Link href="/privacy">{t("homePhotoPrivacyLink")}</Link>
          </p>
        </div>

        <figure className="home__example" aria-labelledby="example-caption">
          <figcaption id="example-caption" className="eyebrow">
            {t("exampleCaption")}
          </figcaption>
          <div className="home__object">
            <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="4" />
              <path d="M30 30 L42 42" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <p>
              <span className="home__tag">{t("exampleYouShowed")}</span>
              <strong>{t("exampleObject")}</strong>
            </p>
          </div>
          <div className="home__answer">
            <p className="home__tag">{t("exampleProblemTag")}</p>
            <p>
              {t("exampleProblemStart")} <Mark>{t("exampleProblemMarked")}</Mark>{" "}
              {t("exampleProblemEnd")}
            </p>
          </div>
          <ol className="home__reasons">
            <li>
              <strong>{t("exampleGuessLead")}</strong> {t("exampleGuessText")}
            </li>
            <li>
              <strong>{t("exampleTryLead")}</strong> {t("exampleTryText")}
            </li>
          </ol>
          <p className="home__sources">
            <span className="home__tag">{t("exampleSourcesTag")}</span> LibreTexts Physics, CC BY
            4.0 · LibreTexts Physics, CC BY-SA 2.5
          </p>
        </figure>
      </section>

      <section id="how" aria-labelledby="how-heading" className="home__band">
        <h2 id="how-heading">{t("howHeading")}</h2>
        <ol className="home__steps" role="list">
          <li>
            <span>
              <strong>{t("howShowLead")}</strong> {t("howShowText")}
            </span>
          </li>
          <li>
            <span>
              <strong>{t("howProblemLead")}</strong> {t("howProblemText")}
            </span>
          </li>
          <li>
            <span>
              <strong>{t("howWatchLead")}</strong> {t("howWatchText")}
            </span>
          </li>
        </ol>
      </section>

      <section id="inside" aria-labelledby="inside-heading" className="home__band">
        <h2 id="inside-heading">{t("insideHeading")}</h2>
        <p className="home__intro">{t("insideIntro")}</p>
        <ol className="home__modules" role="list">
          {MERRILL_MODULES.map((module) => {
            const blurb = MODULE_BLURBS[module];
            return (
              <li key={module}>
                <strong>{tLesson(MODULE_LABEL_KEYS[module])}</strong>
                <span>{blurb ? t(blurb) : null}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section id="trust" aria-labelledby="trust-heading" className="home__band">
        <h2 id="trust-heading">{t("trustHeading")}</h2>
        <ul className="home__trust" role="list">
          {TRUST.map((item) => (
            <li key={item.id} className="sbi-card">
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
              <h3>{t(item.title)}</h3>
              <p>{t(item.text)}</p>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/about#checks">{t("trustLink")}</Link>
        </p>
      </section>

      <section id="for-you" aria-labelledby="for-heading" className="home__band">
        <h2 id="for-heading">{t("forHeading")}</h2>
        <p className="home__intro">{t("forIntro")}</p>
        <ul className="home__depths" role="list">
          {DEPTHS.map((depth) => (
            <li key={depth.id}>
              <p className="home__tag">{t(depth.name)}</p>
              <h3>{t(depth.who)}</h3>
              <p>{t(depth.text)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cta-heading" className="home__cta">
        <h2 id="cta-heading">{t("ctaHeading")}</h2>
        <p>{t("ctaText")}</p>
        <Link href="/capture" className="sbi-button sbi-button--primary">
          {t("ctaButton")}
        </Link>
      </section>
    </main>
  );
}
