"use client";

import type { LessonPack, VisualRef } from "@sbi/contracts";
import { AssetCredits } from "@sbi/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useT } from "../i18n/provider";
import { SourceList } from "../lesson/citations";
import { useLessonExperiment } from "../lesson/lesson-experiment";
import { LessonNotice } from "../lesson/lesson-reader";
import { LessonRail } from "../lesson/lesson-rail";
import { PracticeProvider } from "../lesson/practice";
import { VisualFrame } from "../lesson/visual-frame";
import { visualQuery } from "../lesson/visual-query";

const WITHHELD_KEY = {
  rights: "withheldRights",
  "needs-connection": "withheldConnection",
  unavailable: "withheldUnavailable",
} as const;

/** A saved lesson drawn from its pack alone: no request leaves the device (#116). */
export function OfflineLesson({ pack }: { pack: LessonPack }) {
  const t = useT("offline");
  const client = useQueryClient();
  // Seeded once, before the first draw, so each visual frame finds its manifest and never fetches.
  useState(() => {
    for (const visual of pack.visuals) {
      client.setQueryData(visualQuery(visual.visualId).queryKey, visual);
    }
  });
  const { lesson, sources } = pack;
  const experiment = useLessonExperiment(lesson, lesson.visuals);
  const withheld = new Map(pack.withheld.map((item) => [item.visualId, item]));

  const renderVisual = (visual: VisualRef) => {
    const missing = withheld.get(visual.visualId);
    if (!missing) return <VisualFrame visual={visual} />;
    return (
      <figure className="visual visual--fallback" aria-label={missing.alt}>
        <p className="visual__note">{t(WITHHELD_KEY[missing.reason])}</p>
        <p>{missing.text}</p>
      </figure>
    );
  };

  return (
    <main id="main" className="lesson">
      <header className="lesson-head">
        <Link href="/offline" className="lesson-head__change">
          {t("backToList")}
        </Link>
        <p className="topic-chip">{t("heading")}</p>
        <h1>{lesson.title}</h1>
      </header>
      <LessonNotice items={lesson.disclaimers ?? []} />
      <div className="lesson-body">
        <PracticeProvider experiment={experiment}>
          <LessonRail
            lesson={lesson}
            label={lesson.title}
            askQuestion={null}
            visuals={lesson.visuals}
            renderVisual={renderVisual}
          />
        </PracticeProvider>
        <SourceList sources={sources} lesson={lesson} />
        {pack.visuals.every((visual) => visual.credits.length === 0) ? null : (
          <AssetCredits credits={pack.visuals.flatMap((visual) => visual.credits)} />
        )}
      </div>
    </main>
  );
}
