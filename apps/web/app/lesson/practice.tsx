"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ExperimentController } from "./experiment";

/** "pending" while a visual is still expected; "none" or "failed" when there will not be one. */
export type ExperimentState =
  { status: "none" | "pending" | "failed" } | { status: "ready"; controller: ExperimentController };

interface Practice {
  /** The option the learner locked in for the activate guess. */
  guess?: number;
  lockGuess(index: number): void;
  /** True once the guess's explanation has been on screen, for the closing concept check (#81). */
  revealSeen: boolean;
  markRevealSeen(): void;
  experiment: ExperimentState;
}

const PracticeContext = createContext<Practice>({
  lockGuess: () => undefined,
  revealSeen: false,
  markRevealSeen: () => undefined,
  experiment: { status: "none" },
});

/** Holds what the learner has done across a Merrill lesson's guess and challenges. */
export function PracticeProvider({
  experiment,
  children,
}: {
  experiment: ExperimentState;
  children: ReactNode;
}) {
  const [guess, lockGuess] = useState<number>();
  const [revealSeen, setRevealSeen] = useState(false);
  const markRevealSeen = useCallback(() => setRevealSeen(true), []);
  const value = useMemo(
    () => ({ guess, lockGuess, revealSeen, markRevealSeen, experiment }),
    [guess, revealSeen, markRevealSeen, experiment],
  );
  return <PracticeContext value={value}>{children}</PracticeContext>;
}

export const usePractice = () => useContext(PracticeContext);

/** The experiment, only when it offers every id asked for; `pending` while it may still come. */
export function useExperiment(ids: { controls?: string[]; readouts?: string[] }): {
  controller?: ExperimentController;
  pending: boolean;
} {
  const { experiment } = usePractice();
  if (experiment.status === "ready") {
    return experiment.controller.has(ids)
      ? { controller: experiment.controller, pending: false }
      : { pending: false };
  }
  return { pending: experiment.status === "pending" };
}

const noSubscription = () => () => undefined;

/** The readout's current value, kept live as the learner or a button moves the sliders. */
export function useReadout(controller: ExperimentController | undefined, readoutId: string) {
  return useSyncExternalStore(
    controller?.subscribe ?? noSubscription,
    () => controller?.readout(readoutId),
    () => undefined,
  );
}
