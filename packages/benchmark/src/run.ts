import type { LlmProvider, Usage } from "@sbi/llm";
import { createVisionLlmRecogniser, RECOGNITION_PROMPT_VERSION } from "@sbi/recognition";
import { costUsd, type ProviderConfig } from "./providers";
import type { SeedPrompt, SeedSet } from "./seed-set";
import {
  draftToLesson,
  generateDraft,
  LESSON_PROMPT_VERSION,
  scoreLesson,
  type LessonScore,
} from "./tasks/lesson";
import type { GuessJudgement } from "./tasks/guess-judge";
import { scoreRecognition, type RecognitionScore } from "./tasks/recognition";
import {
  classifySafety,
  SAFETY_PROMPT_VERSION,
  scoreSafety,
  type SafetyScore,
} from "./tasks/safety";

export const TASKS = ["recognition", "lesson", "safety"] as const;
export type TaskName = (typeof TASKS)[number];

export interface RunRecord {
  provider: string;
  model: string;
  task: TaskName;
  promptId: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
  usage: Usage;
  costUsd: number;
  score?: RecognitionScore | LessonScore | SafetyScore;
  output?: unknown;
  /** Added by the judge script, not by the run itself. */
  judge?: GuessJudgement;
}

export interface BenchmarkRun {
  runAt: string;
  seedVersion: string;
  promptVersions: Record<TaskName, string>;
  judgedWith?: { provider: string; model: string; promptVersion: string };
  providers: { id: string; vendor: string; model: string }[];
  records: RunRecord[];
}

export interface ConfiguredProvider {
  config: ProviderConfig;
  llm: LlmProvider;
}

export interface RunOptions {
  set: SeedSet;
  providers: ConfiguredProvider[];
  tasks: readonly TaskName[];
  loadImage: (prompt: SeedPrompt) => Promise<Uint8Array>;
  limit?: number;
  concurrency?: number;
  now?: () => Date;
  onRecord?: (record: RunRecord) => void;
}

const NO_USAGE: Usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };

// Lessons are only generated where policy would let the learner see one.
export function promptsFor(task: TaskName, prompts: SeedPrompt[]): SeedPrompt[] {
  if (task === "recognition") return prompts.filter((prompt) => prompt.image);
  if (task === "lesson") {
    return prompts.filter(
      (prompt) => prompt.expected.safety === "allow" && !prompt.tags.includes("unsupported"),
    );
  }
  return prompts;
}

async function runOne(
  task: TaskName,
  { config, llm }: ConfiguredProvider,
  prompt: SeedPrompt,
  options: RunOptions,
): Promise<RunRecord> {
  const base = { provider: config.id, model: llm.model, task, promptId: prompt.id };
  try {
    if (task === "recognition") {
      const bytes = await options.loadImage(prompt);
      const outcome = await createVisionLlmRecogniser(llm).recognise({
        bytes,
        mime: prompt.image?.mime ?? "image/jpeg",
      });
      const { usage, latencyMs, status, candidates, observations } = outcome;
      return {
        ...base,
        ok: true,
        latencyMs,
        usage,
        costUsd: costUsd(usage, config.pricing),
        score: scoreRecognition(prompt, outcome),
        output: { status, candidates, observations },
      };
    }
    if (task === "lesson") {
      const { completion, draft } = await generateDraft(llm, prompt);
      const lesson = await draftToLesson(draft, prompt, {
        provider: config.id,
        model: completion.model,
        generatedAt: (options.now?.() ?? new Date()).toISOString(),
      });
      return {
        ...base,
        ok: true,
        latencyMs: completion.latencyMs,
        usage: completion.usage,
        costUsd: costUsd(completion.usage, config.pricing),
        score: scoreLesson(draft, lesson),
        output: draft,
      };
    }
    const { completion, decision } = await classifySafety(llm, prompt);
    return {
      ...base,
      ok: true,
      latencyMs: completion.latencyMs,
      usage: completion.usage,
      costUsd: costUsd(completion.usage, config.pricing),
      score: scoreSafety(prompt, decision),
      output: decision,
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 500) : String(error),
      latencyMs: 0,
      usage: NO_USAGE,
      costUsd: 0,
    };
  }
}

async function pool<T>(jobs: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++;
      results[index] = await (jobs[index] as () => Promise<T>)();
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, worker));
  return results;
}

/** Runs every task for every provider over the seed set. */
export async function runBenchmark(options: RunOptions): Promise<BenchmarkRun> {
  const prompts = options.set.prompts.slice(0, options.limit ?? options.set.prompts.length);
  const jobs = options.providers.flatMap((provider) =>
    options.tasks.flatMap((task) =>
      promptsFor(task, prompts).map((prompt) => async () => {
        const record = await runOne(task, provider, prompt, options);
        options.onRecord?.(record);
        return record;
      }),
    ),
  );
  return {
    runAt: (options.now?.() ?? new Date()).toISOString(),
    seedVersion: options.set.version,
    promptVersions: {
      recognition: RECOGNITION_PROMPT_VERSION,
      lesson: LESSON_PROMPT_VERSION,
      safety: SAFETY_PROMPT_VERSION,
    },
    providers: options.providers.map(({ config, llm }) => ({
      id: config.id,
      vendor: config.vendor,
      model: llm.model,
    })),
    records: await pool(jobs, options.concurrency ?? 4),
  };
}
