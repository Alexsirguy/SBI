import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { buildIntentSignature } from "@sbi/orchestrator";
import { z } from "zod";
import { createRecognitionProvider } from "../src";
import {
  gate,
  RecognitionCase,
  reportMarkdown,
  scoreCase,
  summarise,
  topicMatching,
  type CaseScore,
  type TopicPair,
} from "../src/eval";

const root = join(import.meta.dirname, "../../..");
// The API's own settings, so the eval measures the recognisers learners would get.
for (const file of [join(import.meta.dirname, "../.env"), join(root, "apps/api/.env")]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "v2" },
    limit: { type: "string" },
    out: { type: "string", default: join(root, "docs/research/recognition-eval/results") },
  },
});

// Text-only prompts have nothing to recognise ("not-applicable").
const cases = z
  .object({
    prompts: z.array(
      z.unknown().transform((prompt) => RecognitionCase.safeParse(prompt).data ?? null),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync(join(root, "docs/research/seed-set", values.seed, "prompts.json"), "utf8"),
    ),
  )
  .prompts.filter((item): item is RecognitionCase => Boolean(item?.image))
  .slice(0, values.limit ? Number(values.limit) : undefined);

const cache = join(import.meta.dirname, "../.cache/seed-images");
mkdirSync(cache, { recursive: true });

// Seed photos come from Wikimedia; each is checked against its recorded hash before use.
async function image(item: RecognitionCase): Promise<Uint8Array> {
  const source = item.image;
  if (!source) throw new Error("no image");
  const file = join(cache, `${source.sha256}`);
  const bytes = existsSync(file)
    ? new Uint8Array(readFileSync(file))
    : new Uint8Array(
        await (
          await fetch(source.url, {
            headers: { "user-agent": "ScienceBehindIt-eval/1.0 (recognition benchmark)" },
          })
        ).arrayBuffer(),
      );
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== source.sha256) throw new Error(`image hash mismatch for ${item.id}`);
  if (!existsSync(file)) writeFileSync(file, bytes);
  return bytes;
}

const recogniser = createRecognitionProvider(process.env);
const scores: CaseScore[] = [];
for (const [index, item] of cases.entries()) {
  try {
    const outcome = await recogniser.recognise({
      bytes: await image(item),
      mime: item.image?.mime ?? "image/jpeg",
    });
    scores.push(scoreCase(item, outcome));
  } catch (error) {
    scores.push({
      caseId: item.id,
      expected: item.expected.recognition,
      conditions: item.tags,
      top1: false,
      top3: false,
      abstained: false,
      error: (error as Error).message,
    });
  }
  const last = scores.at(-1);
  console.log(
    `[${index + 1}/${cases.length}] ${item.id} ${item.expected.recognition} → ${last?.error ?? last?.status}`,
  );
}

interface Query {
  taxonomyId: string;
  question: string;
  audience: "child" | "teen" | "adult" | "general";
}
const pairs = z
  .object({ pairs: z.array(z.custom<TopicPair<Query>>()) })
  .parse(
    JSON.parse(
      readFileSync(join(root, "docs/research/recognition-eval/v1/topic-pairs.json"), "utf8"),
    ),
  ).pairs;
// Production reuse is keyed on this signature, so two requests share a lesson exactly when it matches.
const signature = (query: Query) =>
  buildIntentSignature({
    question: query.question,
    taxonomyId: query.taxonomyId,
    conceptIds: [],
    audience: query.audience,
    readingLevel: query.audience === "child" ? "simple" : "plain",
    locale: "en",
    safetyScope: "low",
  });
const topic = topicMatching(pairs, (a, b) => signature(a) === signature(b));

const summary = summarise(scores, cases);
const runAt = new Date().toISOString();
const meta = {
  runAt,
  seedSet: values.seed,
  providers: process.env.RECOGNITION_PROVIDERS ?? "default",
};
mkdirSync(values.out, { recursive: true });
const stamp = runAt.slice(0, 19).replaceAll(":", "-");
writeFileSync(
  join(values.out, `${stamp}.json`),
  `${JSON.stringify({ meta, summary, topic, scores }, null, 2)}\n`,
);
writeFileSync(join(values.out, `${stamp}.md`), reportMarkdown(meta, summary, topic, scores));
const passed = summary.errors === 0 && gate(summary, topic).every((row) => row.passed);
console.log(JSON.stringify({ ...summary, bins: undefined, topic }, null, 2));
console.log(`Gate: ${passed ? "pass" : "fail"} (${join(values.out, `${stamp}.md`)})`);
process.exitCode = passed ? 0 : 1;
