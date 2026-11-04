import type { LlmProvider } from "@sbi/llm";
import { fetchLesson, requestFor, type ServedLesson } from "./client";
import type { BenchmarkSet } from "./dataset";
import { scoreCase, type CaseRecord } from "./score";

/** Asks the API for every prompt's lesson, a few at a time, and scores each as it arrives. */
export async function runBenchmark(
  options: {
    judge: LlmProvider;
    fetchServed?: (prompt: BenchmarkSet["cases"][number]["prompt"]) => Promise<ServedLesson>;
    apiUrl: string;
    concurrency: number;
    onRecord?: (record: CaseRecord) => void;
  },
  set: BenchmarkSet,
): Promise<CaseRecord[]> {
  const fetchServed =
    options.fetchServed ?? ((prompt) => fetchLesson(options.apiUrl, requestFor(prompt)));
  const records: CaseRecord[] = [];
  const queue = [...set.cases];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      let served: ServedLesson;
      try {
        served = await fetchServed(item.prompt);
      } catch (error) {
        served = { error: (error as Error).message, ms: 0 };
      }
      const record = await scoreCase(options.judge, item, served).catch(
        (error: unknown): CaseRecord => ({
          promptId: item.prompt.id,
          tags: item.prompt.tags,
          expectedSafety: item.prompt.expected.safety,
          outcome: "error",
          safetyCorrect: false,
          ms: served.ms,
          error: `scoring failed: ${(error as Error).message}`,
        }),
      );
      records.push(record);
      options.onRecord?.(record);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
  return records.sort((a, b) => a.promptId.localeCompare(b.promptId));
}
