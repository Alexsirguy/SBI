"use client";

import { Button, TextField } from "@sbi/ui";
import { useState } from "react";
import { useT } from "../i18n/provider";

function problem() {
  // Two-digit answers from 6–9 tables: quick for an adult, a real pause for a young child.
  const pick = () => 6 + Math.floor(Math.random() * 4);
  return { a: pick(), b: pick() };
}

/** A speed bump before a child changes a setting; it checks for a grown-up, not who they are. */
export function GrownUpGate({
  reason,
  onPass,
  onCancel,
}: {
  reason: string;
  onPass: () => void;
  onCancel: () => void;
}) {
  const t = useT("pathway");
  const [question, setQuestion] = useState(problem);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);

  const check = (event: React.FormEvent) => {
    event.preventDefault();
    if (Number(answer) === question.a * question.b) {
      onPass();
      return;
    }
    setWrong(true);
    setAnswer("");
    setQuestion(problem());
  };

  return (
    <form className="grown-up-gate" onSubmit={check} noValidate>
      <p className="grown-up-gate__title">{t("gateTitle")}</p>
      <p>{reason}</p>
      <TextField
        label={t("gateQuestion", { a: question.a, b: question.b })}
        inputMode="numeric"
        autoComplete="off"
        value={answer}
        error={wrong ? t("gateWrong") : undefined}
        onChange={(event) => setAnswer(event.target.value.replace(/\D/g, ""))}
      />
      <div className="grown-up-gate__actions">
        <Button type="submit" size="small">
          {t("gateCheck")}
        </Button>
        <Button variant="quiet" size="small" onClick={onCancel}>
          {t("gateCancel")}
        </Button>
      </div>
    </form>
  );
}
