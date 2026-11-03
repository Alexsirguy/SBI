import { CaptureForm } from "./capture-form";
import { PHOTO_RETENTION_DAYS } from "./limits";
import { getT } from "../i18n/server";
import { getPathway } from "../pathway/server";
import { WhoIsLearning } from "../pathway/who-is-learning";
import { DescribeForm } from "./confirm/describe-form";
import "./capture.css";

export default async function CapturePage() {
  const t = await getT("capture");
  const pathway = await getPathway();
  return (
    <main id="main" className="capture">
      <header className="capture__intro">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
      </header>
      {/* Asked once, before the first lesson; afterwards it lives in "Your choices". */}
      {pathway ? null : <WhoIsLearning compact />}
      {/* Shown before any photo is taken, so learners decide knowing what happens to it. */}
      <section aria-labelledby="privacy-cue" className="privacy-cue">
        <h2 id="privacy-cue">{t("privacyHeading")}</h2>
        <ul>
          <li>{t("privacyPeople")}</li>
          <li>{t("privacyUse")}</li>
          <li>{t("privacyStorage")}</li>
          <li>{t("privacyRetention", { days: PHOTO_RETENTION_DAYS })}</li>
        </ul>
      </section>
      <CaptureForm />
      <section aria-labelledby="text-entry" className="capture-path">
        <h2 id="text-entry">{t("describeHeading")}</h2>
        <DescribeForm />
      </section>
    </main>
  );
}
