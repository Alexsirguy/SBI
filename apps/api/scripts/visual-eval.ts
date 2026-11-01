import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Lesson, LessonVisuals, VisualManifest } from "@sbi/contracts";

// Usage: pnpm --filter @sbi/api eval:visuals [api url] — needs the API running with a lesson model.
const API = (
  process.argv.slice(2).find((arg) => arg.startsWith("http")) ?? "http://localhost:4100"
).replace(/\/+$/, "");
const ROOT = join(import.meta.dirname, "../../..");
// One question per object across the five categories; refusals and redirects have no lesson to show.
const SAMPLE = [
  "seed-001",
  "seed-003",
  "seed-005",
  "seed-006",
  "seed-007",
  "seed-010",
  "seed-011",
  "seed-017",
  "seed-020",
  "seed-022",
  "seed-024",
  "seed-026",
  "seed-028",
  "seed-030",
  "seed-032",
  "seed-035",
];
const PARALLEL = 3;

interface SeedPrompt {
  id: string;
  category: string;
  label: string;
  question: string;
}

interface Outcome {
  id: string;
  category: string;
  label: string;
  kind: string;
  visualId?: string;
  /** Seconds from the lesson arriving to its visual arriving. */
  visualSeconds?: number;
  labels: number;
  labelsCiteLesson: boolean;
  controls: number;
  readouts: number;
  error?: string;
}

async function* events(response: Response): AsyncGenerator<{ type: string; data: unknown }> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const type = /^event: (.+)$/m.exec(frame)?.[1];
      const data = /^data: (.+)$/m.exec(frame)?.[1];
      if (type && data) yield { type, data: JSON.parse(data) };
    }
  }
}

async function evaluate(prompt: SeedPrompt): Promise<Outcome> {
  const outcome: Outcome = {
    id: prompt.id,
    category: prompt.category,
    label: prompt.label,
    kind: "none",
    labels: 0,
    labelsCiteLesson: true,
    controls: 0,
    readouts: 0,
  };
  const response = await fetch(`${API}/lessons`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      question: prompt.question,
      subject: prompt.label,
      audience: "general",
      readingLevel: "plain",
      locale: "en",
      safetyClass: "low",
      fresh: true,
    }),
  });
  let lesson: Lesson | undefined;
  let lessonAt = 0;
  for await (const event of events(response)) {
    if (event.type === "lesson") {
      lesson = Lesson.parse(event.data);
      lessonAt = Date.now();
    } else if (event.type === "error") {
      outcome.error = (event.data as { error?: string }).error;
    } else if (event.type === "visuals") {
      const [ref] = LessonVisuals.parse(event.data).visuals;
      outcome.visualSeconds = Math.round((Date.now() - lessonAt) / 100) / 10;
      if (!ref) continue;
      const manifest = VisualManifest.parse(await (await fetch(`${API}${ref.manifestUri}`)).json());
      const claims = new Set(lesson?.claims.map((claim) => claim.claimId));
      Object.assign(outcome, {
        kind: manifest.kind,
        visualId: manifest.visualId,
        labels: manifest.labels.length,
        labelsCiteLesson: manifest.labels.every((label) => claims.has(label.claimId)),
        controls: manifest.controls.length,
        readouts: manifest.readouts.length,
      });
    }
  }
  if (!lesson && !outcome.error) outcome.error = "no lesson";
  return outcome;
}

const seed = JSON.parse(
  readFileSync(join(ROOT, "docs/research/seed-set/v2/prompts.json"), "utf8"),
) as { prompts: SeedPrompt[] };
const queue = seed.prompts.filter((prompt) => SAMPLE.includes(prompt.id));
const outcomes: Outcome[] = [];
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let prompt = queue.shift(); prompt; prompt = queue.shift()) {
      const outcome = await evaluate(prompt).catch((error: unknown) => ({
        id: prompt.id,
        category: prompt.category,
        label: prompt.label,
        kind: "none",
        labels: 0,
        labelsCiteLesson: true,
        controls: 0,
        readouts: 0,
        error: String(error),
      }));
      outcomes.push(outcome);
      console.log(JSON.stringify(outcome));
    }
  }),
);
outcomes.sort((a, b) => a.id.localeCompare(b.id));
const file = join(
  ROOT,
  `docs/research/visuals/generation-${new Date().toISOString().slice(0, 10)}.json`,
);
writeFileSync(
  file,
  `${JSON.stringify({ api: API, ranAt: new Date().toISOString(), outcomes }, null, 2)}\n`,
);
console.log(`Wrote ${file}`);
