"use client";

import { isMerrillLesson, type Lesson, type LessonVisuals } from "@sbi/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ExperimentController } from "./experiment";
import type { ExperimentState } from "./practice";
import { visualQuery } from "./visual-query";

/** The Merrill lesson's experiment: its first visual's manifest, once that has arrived. */
export function useLessonExperiment(
  lesson: Lesson | undefined,
  visuals: LessonVisuals["visuals"] | undefined,
): ExperimentState {
  const wanted = lesson !== undefined && isMerrillLesson(lesson) && lesson.experiment !== undefined;
  const visualId = wanted ? visuals?.[0]?.visualId : undefined;
  const manifest = useQuery({ ...visualQuery(visualId ?? ""), enabled: visualId !== undefined });
  const [built, setBuilt] = useState<{ visualId: string; controller: ExperimentController }>();
  useEffect(() => {
    const data = manifest.data;
    if (!data) return;
    let live = true;
    // The controller brings mathjs, so it loads only for a lesson that has an experiment.
    void import("./experiment").then(({ createExperimentController }) => {
      if (live) setBuilt({ visualId: data.visualId, controller: createExperimentController(data) });
    });
    return () => {
      live = false;
    };
  }, [manifest.data]);
  const controller = built?.visualId === visualId ? built?.controller : undefined;
  return useMemo(() => {
    if (!wanted) return { status: "none" };
    if (visuals === undefined) return { status: "pending" };
    if (!visualId) return { status: "none" };
    if (controller) return { status: "ready", controller };
    return { status: manifest.isError ? "failed" : "pending" };
  }, [wanted, visuals, visualId, controller, manifest.isError]);
}
