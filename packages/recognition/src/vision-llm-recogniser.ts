import { RecognitionCandidate } from "@sbi/contracts";
import type { LlmProvider, Usage } from "@sbi/llm";
import { z } from "zod";

export const RECOGNITION_PROMPT_VERSION = "recognition-p0.3";

export interface RecognitionImage {
  bytes: Uint8Array;
  mime: string;
}

// Taxonomy mapping happens downstream, so a raw candidate carries only the model's label.
export const RawCandidate = RecognitionCandidate.omit({ taxonomyId: true });

export const RecognitionOutput = z.object({
  status: z.enum(["recognised", "ambiguous", "unsupported"]),
  candidates: z.array(RawCandidate).max(3),
  observations: z.array(z.string().min(1)),
});

export interface RecognitionOutcome extends z.infer<typeof RecognitionOutput> {
  provider: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  usage: Usage;
}

export interface RecogniseOptions {
  signal?: AbortSignal;
}

/** Identifies the main object in a photo and ranks up to three candidates. */
export interface RecognitionProvider {
  readonly id: string;
  recognise(image: RecognitionImage, options?: RecogniseOptions): Promise<RecognitionOutcome>;
}

const SYSTEM_PROMPT = `You identify the main everyday object in a photo for a science-learning app used by people aged 8 and up.
Return 3 candidate labels, most likely first, each a short common noun phrase (e.g. "bicycle", "electric kettle").
Even when you are sure, add the two closest look-alikes as alternatives with low calibratedConfidence, so the learner can correct you.
certainty: "likely" only when you would bet on it, "possible" when plausible, "unsure" otherwise; calibratedConfidence is your probability from 0 to 1.
status:
- "recognised" when the top candidate is clearly identifiable.
- "ambiguous" when two or more candidates are similarly plausible or key details are hidden (e.g. a clear liquid, a white powder, a wild mushroom).
- "unsupported" when the photo shows medicine, people as the subject, personal documents, or nothing identifiable; return no candidates in that case.
observations: up to 3 short visual details that justify your answer.
Never identify, name or describe a person, even a famous one, and never guess anyone's age, gender, ethnicity or identity; a person is never a candidate.`;

// Words for people as a label's head noun; "baby bottle" is a bottle, "baby" is a person.
const PERSON =
  /^(person|people|man|men|woman|women|boy|boys|girl|girls|child|children|kid|kids|baby|babies|toddler|teen|teens|teenager|teenagers|adult|adults|human|humans|face|faces|selfie|portrait|crowd|family|friend|friends|lady|ladies|gentleman|guy|player|celebrity|me|you|someone)$/;
const MENTIONS_PEOPLE =
  /\b(person|people|man|men|woman|women|boy|girl|child|children|kid|baby|toddler|teen|face|faces|selfie|hand|hands|finger|fingers|someone|he|she|his|her)\b/;

/** The model's answer with any person removed, so recognition can never return who someone is. */
export function withoutPeople(
  output: z.infer<typeof RecognitionOutput>,
): z.infer<typeof RecognitionOutput> {
  const candidates = output.candidates.filter((candidate) => {
    const head = candidate.label.trim().toLowerCase().split(/\s+/).at(-1) ?? "";
    return !PERSON.test(head.replace(/[^a-z]/g, ""));
  });
  const observations = output.observations.filter(
    (observation) => !MENTIONS_PEOPLE.test(observation.toLowerCase()),
  );
  const emptied = candidates.length === 0 && output.candidates.length > 0;
  return { status: emptied ? "unsupported" : output.status, candidates, observations };
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "candidates", "observations"],
  properties: {
    status: { type: "string", enum: ["recognised", "ambiguous", "unsupported"] },
    candidates: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "certainty", "calibratedConfidence", "reasons"],
        properties: {
          label: { type: "string" },
          certainty: { type: "string", enum: ["likely", "possible", "unsure"] },
          calibratedConfidence: { type: "number" },
          reasons: { type: "array", items: { type: "string" } },
        },
      },
    },
    observations: { type: "array", items: { type: "string" } },
  },
};

/** Recognition backed by any vision-capable LLM provider. */
export function createVisionLlmRecogniser(llm: LlmProvider): RecognitionProvider {
  return {
    id: llm.id,
    async recognise(image, options = {}) {
      const completion = await llm.complete({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "What is the main object in this photo?" },
              {
                type: "image",
                mime: image.mime,
                base64: Buffer.from(image.bytes).toString("base64"),
              },
            ],
          },
        ],
        jsonSchema: { name: "RecognitionOutput", schema: OUTPUT_SCHEMA },
        maxTokens: 2000,
        signal: options.signal,
      });
      const output = withoutPeople(RecognitionOutput.parse(JSON.parse(completion.text)));
      return {
        ...output,
        provider: llm.id,
        model: completion.model,
        promptVersion: RECOGNITION_PROMPT_VERSION,
        latencyMs: completion.latencyMs,
        usage: completion.usage,
      };
    },
  };
}
