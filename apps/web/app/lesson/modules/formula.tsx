"use client";

import type { Experiment, Formula, FormulaSymbol } from "@sbi/contracts";
import { Button, TextField } from "@sbi/ui";
import { useId, useState, useSyncExternalStore } from "react";
import type { ExperimentController } from "../experiment";
import { useLocale, useT } from "../../i18n/provider";
import { formatReading } from "../goal";
import { useExperiment } from "../practice";

function useQuantity(controller: ExperimentController, id: string, readout: boolean) {
  return useSyncExternalStore(
    controller.subscribe,
    () => (readout ? controller.readout(id) : controller.values()[id]),
    () => undefined,
  );
}

function LiveValue({
  controller,
  symbol,
  readout,
}: {
  controller: ExperimentController;
  symbol: FormulaSymbol & { quantityId: string };
  readout: boolean;
}) {
  const locale = useLocale();
  const value = useQuantity(controller, symbol.quantityId, readout);
  return (
    <li>
      <span className="formula__symbol">{symbol.symbol}</span> ={" "}
      <span className="challenge__value">
        {value === undefined ? "—" : formatReading(value, symbol.unit, locale, 3)}
      </span>
    </li>
  );
}

/** The formula's lab quantities as the sliders stand, so moving one shows the formula at work. */
function LiveLine({ formula, experiment }: { formula: Formula; experiment?: Experiment }) {
  const t = useT("lesson");
  const readoutIds = new Set(experiment?.readouts.map((readout) => readout.id) ?? []);
  const linked = formula.symbols.filter(
    (symbol): symbol is FormulaSymbol & { quantityId: string } => Boolean(symbol.quantityId),
  );
  const { controller } = useExperiment({
    controls: linked.filter((s) => !readoutIds.has(s.quantityId)).map((s) => s.quantityId),
    readouts: linked.filter((s) => readoutIds.has(s.quantityId)).map((s) => s.quantityId),
  });
  if (!controller || linked.length === 0) return null;
  // Inputs first, then the result, as the formula is read.
  const ordered = [...linked].sort(
    (a, b) => Number(readoutIds.has(a.quantityId)) - Number(readoutIds.has(b.quantityId)),
  );
  return (
    <div className="formula__live">
      <p className="formula__label">{t("formulaLive")}</p>
      <ul aria-live="polite">
        {ordered.map((symbol) => (
          <LiveValue
            key={symbol.symbol}
            controller={controller}
            symbol={symbol}
            readout={readoutIds.has(symbol.quantityId)}
          />
        ))}
      </ul>
    </div>
  );
}

/** A formula the topic is taught with: the relation, its letters, and a worked example (#434). */
export function FormulaCard({
  formula,
  experiment,
}: {
  formula: Formula;
  experiment?: Experiment;
}) {
  const t = useT("lesson");
  const headingId = useId();
  return (
    <article className="formula sbi-card" aria-labelledby={headingId}>
      <p className="formula__label">{t("formulaLabel")}</p>
      <h3 id={headingId}>{formula.name}</h3>
      <p className="formula__expression" translate="no">
        {formula.expression}
      </p>
      <p>{formula.words}</p>
      <h4>{t("formulaSymbols")}</h4>
      <dl className="formula__symbols">
        {formula.symbols.map((symbol) => (
          <div key={symbol.symbol}>
            <dt className="formula__symbol" translate="no">
              {symbol.symbol}
            </dt>
            <dd>
              {symbol.meaning} ({symbol.unit || t("formulaNoUnit")})
            </dd>
          </div>
        ))}
      </dl>
      <LiveLine formula={formula} experiment={experiment} />
      <h4>{t("formulaExample")}</h4>
      <p>{formula.example.problem}</p>
      <ol className="formula__steps">
        {formula.example.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <p className="formula__answer">{t("formulaAnswer", { answer: formula.example.answer })}</p>
    </article>
  );
}

/** Accepts "0,25" and "1 500" as well as "0.25", as learners write numbers in either locale. */
export function parseAnswer(text: string): number | undefined {
  const cleaned = text
    .trim()
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(cleaned)) return undefined;
  return Number(cleaned);
}

/** The formula's own problem, worked by the learner; the working shows once they have tried. */
export function FormulaPracticeCard({ formula }: { formula: Formula }) {
  const t = useT("lesson");
  const locale = useLocale();
  const headingId = useId();
  const { practice } = formula;
  const [text, setText] = useState("");
  const [result, setResult] = useState<"right" | "wrong" | "invalid">();
  const [showWorking, setShowWorking] = useState(false);
  const check = () => {
    const value = parseAnswer(text);
    if (value === undefined) return setResult("invalid");
    const right = Math.abs(value - practice.answer) <= practice.tolerance;
    setResult(right ? "right" : "wrong");
    if (right) setShowWorking(true);
  };
  return (
    <article className="challenge sbi-card" aria-labelledby={headingId}>
      <h3 id={headingId}>{t("calcHeading", { name: formula.name })}</h3>
      <p className="challenge__prompt">{practice.prompt}</p>
      <form
        className="challenge__actions"
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <TextField
          label={practice.unit ? t("calcAnswerIn", { unit: practice.unit }) : t("calcAnswer")}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit">{t("check")}</Button>
      </form>
      <div role="status" className="challenge__result">
        {result === "invalid" ? <p>{t("calcNotNumber")}</p> : null}
        {result === "right" ? <p className="challenge__verdict">{t("calcRight")}</p> : null}
        {result === "wrong" ? <p>{t("calcWrong")}</p> : null}
      </div>
      {result === "wrong" && !showWorking ? (
        <Button variant="quiet" onClick={() => setShowWorking(true)}>
          {t("calcShowWorking")}
        </Button>
      ) : null}
      {showWorking ? (
        <div className="formula__working">
          <h4>{t("calcWorking")}</h4>
          <ol className="formula__steps">
            {practice.working.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          <p className="formula__answer">
            {t("calcExpected", { answer: formatReading(practice.answer, practice.unit, locale) })}
          </p>
        </div>
      ) : null}
    </article>
  );
}
