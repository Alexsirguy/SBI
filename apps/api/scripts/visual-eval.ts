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
  /** Seconds from the request to the lesson. */
  lessonSeconds?: number;
  /** The lesson's experiment ids the visual does not offer; challenges on them fall back. */
  missingIds: string[];
  /** Apply challenges whose goal and setup the visual can drive (ADR 0017). */
  challenges: number;
  challengesInVisual: number;
  unverified: string[];
  /** A stage diagram drawn beside the experiment (ADR 0017). */
  diagram: boolean;
  error?: string;
}

// A challenge can be checked in the visual when its goal readout and every setup control exist.
function usableChallenges(lesson: Lesson, manifest: VisualManifest): number {
  const controls = new Set(manifest.controls.map((control) => control.id));
  const readouts = new Set(manifest.readouts.map((readout) => readout.id));
  return lesson.tasks.filter(
    (task) =>
      task.module === "apply" &&
      task.goal !== undefined &&
      readouts.has(task.goal.readoutId) &&
      task.setup.every((setting) => controls.has(setting.controlId)),
  ).length;
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
    missingIds: [],
    challenges: 0,
    challengesInVisual: 0,
    unverified: [],
    diagram: false,
  };
  const started = Date.now();
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
      outcome.lessonSeconds = Math.round((lessonAt - started) / 100) / 10;
      outcome.challenges = lesson.tasks.filter((task) => task.module === "apply").length;
      outcome.unverified = (lesson.disclaimers ?? [])
        .filter((item) => item.kind === "unverified-sections")
        .flatMap((item) => item.sectionIds);
    } else if (event.type === "error") {
      outcome.error = (event.data as { error?: string }).error;
    } else if (event.type === "visuals") {
      const all = LessonVisuals.parse(event.data).visuals;
      outcome.diagram = all.some((visual) => visual.kind === "process");
      const ref = all.find((visual) => visual.kind !== "process");
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
      if (lesson?.experiment) {
        const offered = new Set([
          ...manifest.controls.map((control) => control.id),
          ...manifest.readouts.map((readout) => readout.id),
        ]);
        outcome.missingIds = [
          ...lesson.experiment.controls.map((control) => control.id),
          ...lesson.experiment.readouts.map((readout) => readout.id),
        ].filter((id) => !offered.has(id));
        outcome.challengesInVisual = usableChallenges(lesson, manifest);
      }
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
        missingIds: [],
        challenges: 0,
        challengesInVisual: 0,
        unverified: [],
        diagram: false,
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
const made = outcomes.filter((outcome) => outcome.kind !== "none");
const kinds = Object.fromEntries(
  [...new Set(made.map((outcome) => outcome.kind))].map((kind) => [
    kind,
    made.filter((outcome) => outcome.kind === kind).length,
  ]),
);
const sum = (pick: (outcome: Outcome) => number) =>
  outcomes.reduce((total, outcome) => total + pick(outcome), 0);
console.log(
  JSON.stringify({
    lessons: outcomes.filter((outcome) => !outcome.error).length,
    visuals: made.length,
    kinds,
    allIdsOffered: made.filter((outcome) => outcome.missingIds.length === 0).length,
    challengesInVisual: `${sum((outcome) => outcome.challengesInVisual)}/${sum((outcome) => outcome.challenges)}`,
    diagrams: outcomes.filter((outcome) => outcome.diagram).length,
    fullyVerified: outcomes.filter((outcome) => !outcome.error && outcome.unverified.length === 0)
      .length,
  }),
);
