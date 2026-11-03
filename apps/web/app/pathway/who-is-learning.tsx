"use client";

import { Button } from "@sbi/ui";
import { useState } from "react";
import { useT } from "../i18n/provider";
import { GrownUpGate } from "./grown-up-gate";
import type { Pathway } from "./pathway";
import { usePathway } from "./provider";

/** Who's learning, chosen not guessed; leaving the child pathway needs a grown-up. */
export function WhoIsLearning({ compact = false }: { compact?: boolean }) {
  const t = useT("pathway");
  const { pathway, choose } = usePathway();
  const [gating, setGating] = useState(false);

  const pick = (next: Pathway) => {
    if (pathway === "child" && next === "self") setGating(true);
    else choose(next);
  };

  if (gating) {
    return (
      <GrownUpGate
        reason={t("gateLeaveChild")}
        onPass={() => {
          setGating(false);
          choose("self");
        }}
        onCancel={() => setGating(false)}
      />
    );
  }

  return (
    <section
      aria-labelledby="who-heading"
      className={compact ? "who-learning who-learning--compact" : "who-learning"}
    >
      <h2 id="who-heading">{t("whoHeading")}</h2>
      {pathway ? (
        <p role="status">{t(pathway === "child" ? "nowChild" : "nowSelf")}</p>
      ) : (
        <p>{t("whoExplain")}</p>
      )}
      <div className="who-learning__choices">
        <Button
          variant={pathway === "self" ? "primary" : "quiet"}
          size="small"
          aria-pressed={pathway === "self"}
          onClick={() => pick("self")}
        >
          {t("chooseSelf")}
        </Button>
        <Button
          variant={pathway === "child" ? "primary" : "quiet"}
          size="small"
          aria-pressed={pathway === "child"}
          onClick={() => pick("child")}
        >
          {t("chooseChild")}
        </Button>
      </div>
    </section>
  );
}

/** Asked once: shown when no one has chosen yet, and kept after choosing so the choice is confirmed. */
export function FirstTimePathwayPrompt() {
  const { pathway } = usePathway();
  const [asking] = useState(pathway === undefined);
  return asking ? <WhoIsLearning compact /> : null;
}
