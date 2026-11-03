"use client";

import { Mark } from "@sbi/ui";
import { useState } from "react";
import { useT } from "./i18n/provider";
import { RayArt, ScanArt, TryArt } from "./home-art";
import "./home-reel.css";

/** The hero's looping walkthrough of one lesson; the step list below it says the same in words. */
export function HomeReel() {
  const t = useT("site");
  const [paused, setPaused] = useState(false);
  const steps = [t("reelStepShow"), t("reelStepGuess"), t("reelStepWatch"), t("reelStepTry")];
  return (
    <figure className={`reel${paused ? " reel--paused" : ""}`} aria-labelledby="reel-caption">
      <figcaption id="reel-caption" className="reel__caption">
        {t("reelCaption")}
      </figcaption>
      <div className="reel__stage" aria-hidden="true">
        <div className="reel__scene reel__scene--show">
          <ScanArt className="reel__art" />
          <p className="reel__chip">{t("reelObject")}</p>
        </div>
        <div className="reel__scene reel__scene--guess">
          <p className="reel__problem">
            {t("exampleProblemStart")} <Mark>{t("exampleProblemMarked")}</Mark>{" "}
            {t("exampleProblemEnd")}
          </p>
          <div className="reel__answers">
            <span className="reel__answer reel__answer--chosen">{t("reelGuessClose")}</span>
            <span className="reel__answer">{t("reelGuessFar")}</span>
          </div>
        </div>
        <div className="reel__scene reel__scene--watch">
          <RayArt className="reel__art" />
          <p className="reel__note">{t("reelWatchText")}</p>
        </div>
        <div className="reel__scene reel__scene--try">
          <TryArt className="reel__art" />
          <p className="reel__note">{t("reelTryText")}</p>
        </div>
      </div>
      <ol className="reel__steps">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="reel__foot">
        <p className="reel__sources">
          {t("exampleSourcesTag")}: LibreTexts Physics, CC BY 4.0 · LibreTexts Physics, CC BY-SA 2.5
        </p>
        <button
          type="button"
          className="reel__pause"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            {paused ? <path d="M4 2l10 6-10 6z" /> : <path d="M3 2h4v12H3zM9 2h4v12H9z" />}
          </svg>
          <span className="sbi-visually-hidden">{paused ? t("reelPlay") : t("reelPause")}</span>
        </button>
      </div>
    </figure>
  );
}
