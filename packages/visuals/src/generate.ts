import { canonicalJson, newId, sha256Hex, VisualManifest, type VisualAsset } from "@sbi/contracts";
import { projectOutputAsset } from "@sbi/rights";
import { z } from "zod";
import { RAINBOW_CODE } from "./kinds/rainbow";
import { REFERENCE_MECHANISMS, REFERENCE_VISUALS } from "./references";

export const VISUAL_PROMPT = { id: "visual-generate", version: "v5" } as const;

const Named = z.string();
// One flat object with a field per format, because strict JSON schema mode allows no free-form spec.
export const GeneratedVisual = z.object({
  kind: z.enum(["mechanism", "molecule", "process", "graph", "playground", "none"]),
  alt: z.string(),
  longDescription: z.string(),
  fallbackText: z.string(),
  assumptions: z.array(z.string()),
  labels: z.array(z.object({ id: Named, text: z.string(), claimId: z.string() })),
  controls: z.array(
    z.object({
      id: Named,
      label: z.string(),
      unit: z.string(),
      min: z.number(),
      max: z.number(),
      step: z.number(),
      value: z.number(),
    }),
  ),
  readouts: z.array(
    z.object({ id: Named, label: z.string(), unit: z.string(), formula: z.string() }),
  ),
  mjcf: z.string(),
  bindings: z.array(z.object({ control: z.string(), actuator: z.string() })),
  mermaid: z.string(),
  graph: z.object({
    x: z.object({
      name: Named,
      label: z.string(),
      unit: z.string(),
      from: z.number(),
      to: z.number(),
    }),
    series: z.array(
      z.object({ name: Named, label: z.string(), unit: z.string(), formula: z.string() }),
    ),
    mark: z.enum(["line", "area", "point", "bar"]),
  }),
  molecules: z.array(z.object({ name: z.string(), caption: z.string() })),
  code: z.string(),
});
export type GeneratedVisual = z.infer<typeof GeneratedVisual>;

const text = { type: "string" };
const number = { type: "number" };
function object(properties: Record<string, unknown>) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}
const list = (items: unknown) => ({ type: "array", items });

export const GENERATED_VISUAL_SCHEMA = object({
  kind: { type: "string", enum: GeneratedVisual.shape.kind.options },
  alt: text,
  longDescription: text,
  fallbackText: text,
  assumptions: list(text),
  labels: list(object({ id: text, text, claimId: text })),
  controls: list(
    object({
      id: text,
      label: text,
      unit: text,
      min: number,
      max: number,
      step: number,
      value: number,
    }),
  ),
  readouts: list(object({ id: text, label: text, unit: text, formula: text })),
  mjcf: text,
  bindings: list(object({ control: text, actuator: text })),
  mermaid: text,
  graph: object({
    x: object({ name: text, label: text, unit: text, from: number, to: number }),
    series: list(object({ name: text, label: text, unit: text, formula: text })),
    mark: { type: "string", enum: ["line", "area", "point", "bar"] },
  }),
  molecules: list(object({ name: text, caption: text })),
  code: text,
});

const LEVER_MJCF = (REFERENCE_MECHANISMS.lever.spec as { mjcf: string }).mjcf;
const HEATING_SERIES = (REFERENCE_VISUALS.heating.spec as { series: unknown }).series;

export const VISUAL_SYSTEM_PROMPT = `You design one interactive picture that shows how an everyday thing works, for a science lesson.
Pick the kind that best shows the lesson's mechanism, and fill only that kind's fields; leave the others empty ("" or []).

Kinds:
- mechanism: moving parts (engines, gears, levers, hinges, pumps, springs, pendulums, wheels). Write "mjcf", a MuJoCo model:
  start with <mujoco>; z is up; metres and kilograms; use only primitive geoms (box, sphere, capsule, cylinder, ellipsoid, plane);
  never use files, meshes, <include> or plugins; at most 30 bodies; give joints damping; turn gravity off unless gravity is the point;
  add a <motor name=".." joint=".." gear=".."/> actuator for each slider that drives something and list it in "bindings"
  ({control: slider id, actuator: actuator name}); the slider sets the motor's control, so never write ctrl= or ctrlrange= yourself;
  name bodies with short camelCase names, and use those names as label ids so labels point at parts. Colour parts with rgba;
  make casings, cylinders and housings see-through (alpha 0.25) so the moving parts inside stay visible; add no floor plane.
  Example (a lever):
${LEVER_MJCF}
- molecule: the substance itself matters (water, salt, sugar, caffeine, carbon dioxide). List up to 3 common names in "molecules"; never write coordinates.
- process: stages or flows (photosynthesis, the water cycle, digestion, the four strokes). Write "mermaid": a "flowchart LR" with at most 12 short nodes;
  plain words only, no links, HTML, click lines or %% directives.
- graph: one quantity changing with another (temperature over time, speed against gear). Fill "graph": an x range and up to 4 series
  whose formulas use x's name and slider ids. Example (a kettle; sliders power, mass and height):
  ${JSON.stringify({ x: { name: "t", label: "Time", unit: "s", from: 0, to: 600 }, series: HEATING_SERIES, mark: "line" })}
- playground: only when none of the kinds above can show it (light, colour, heat, particles, weather, cells).
  Write "code": JavaScript that calls kit.onFrame((ctx, state) => { ... }) and draws on a 2D canvas with ctx.
  state has width, height, time (seconds), dt and values (slider values by id). kit.colors has ink, soft, action,
  marker, caution, note, paper and sky; kit.arrow(ctx, x1, y1, x2, y2, colour) and kit.marker(ctx, number, x, y)
  draw arrows and numbered part markers (use the label's position in the labels list as its number).
  Use only ctx, state, kit, Math and plain JavaScript: no window, document, timers, network, eval or canvas.
  Example (sunlight split by a raindrop):
${RAINBOW_CODE}
- none: nothing visual would help.

Every kind:
- alt: under 120 characters, says what the picture shows.
- longDescription and fallbackText: 1 to 2 plain sentences a screen reader or a learner without the picture can follow.
- assumptions: the simplifications, such as "No friction" or "One cylinder".
- labels: up to 6 named parts; text is the part's name in 1 to 3 words ("Piston", "Exhaust valve");
  claimId must be one of the lesson's claim ids given below, or leave the label out.
- controls: up to 4 sliders with a camelCase id, label, unit, and min < value < max; step divides the range into at most 100 steps.
- every label, control and readout id is different from all the others.
- readouts: up to 3 numbers worked out from slider ids with plain arithmetic (mathjs syntax: + - * / ^, min, max, sqrt, sin, cos, pi).
Use real physical values and units. Be correct: a learner will trust it.`;

export interface LessonForVisual {
  lessonId: string;
  title: string;
  summary: string;
  readingLevel: string;
  claims: { claimId: string; text: string }[];
}

export function visualUserPrompt(lesson: LessonForVisual): string {
  const claims = lesson.claims.map((claim) => `- ${claim.claimId}: ${claim.text}`).join("\n");
  return `Lesson: ${lesson.title}\nReading level: ${lesson.readingLevel}\nSummary: ${lesson.summary}\nClaims:\n${claims}`;
}

/** Turns the AI's flat answer into a manifest; labels citing claims outside the lesson are dropped. */
export function toManifest(
  output: GeneratedVisual,
  lesson: LessonForVisual,
): VisualManifest | undefined {
  if (output.kind === "none") return undefined;
  const claims = new Set(lesson.claims.map((claim) => claim.claimId));
  const spec = {
    mechanism: { mjcf: output.mjcf, bindings: output.bindings },
    molecule: {
      molecules: output.molecules.map(({ name, caption }) => ({
        name,
        caption: caption || undefined,
      })),
    },
    process: output.mermaid,
    playground: { code: output.code },
    graph: {
      x: { ...output.graph.x, samples: 60 },
      series: output.graph.series,
      vegaLite: { mark: output.graph.mark },
    },
  }[output.kind];
  return VisualManifest.parse({
    visualId: newId(),
    kind: output.kind,
    alt: output.alt.slice(0, 200) || lesson.title,
    longDescription: output.longDescription || undefined,
    fallback: { text: output.fallbackText || output.alt || lesson.summary },
    assumptions: output.assumptions.filter(Boolean),
    labels: output.labels.filter(
      (label, index) =>
        claims.has(label.claimId) &&
        // A repeated label is a duplicate, not a mistake worth a repair round.
        output.labels.findIndex((other) => other.id === label.id) === index &&
        !output.controls.some((control) => control.id === label.id) &&
        !output.readouts.some((readout) => readout.id === label.id),
    ),
    controls: output.controls,
    readouts: output.readouts,
    spec,
  });
}

/** Our own record for a generated spec, which the rights gate needs before the lesson can show it. */
export async function generatedSpecAsset(
  manifest: VisualManifest,
  lessonId: string,
): Promise<VisualAsset> {
  const body = canonicalJson(manifest.spec ?? null);
  return projectOutputAsset({
    assetId: newId(),
    kind: manifest.kind === "mechanism" ? "simulation" : "data",
    format: manifest.kind,
    sha256: await sha256Hex(body),
    sizeBytes: new TextEncoder().encode(body).length,
    accessibilityFallback: manifest.fallback.text,
    lessonId,
  });
}

export const PLAYGROUND_REVIEW_PROMPT = { id: "visual-playground-review", version: "v1" } as const;

export const PLAYGROUND_REVIEW_SCHEMA = object({ problems: list(text) });
export const PlaygroundReview = z.object({ problems: z.array(z.string()) });

/** A second reading of playground code against the lesson, because code is hard to check by rule. */
export function playgroundReviewMessages(
  lesson: LessonForVisual,
  manifest: VisualManifest,
  code: string,
) {
  return [
    {
      role: "system" as const,
      content:
        "You check a small canvas drawing written for a science lesson. List each statement it draws or animates that is physically wrong or contradicts the lesson's claims, and each slider it ignores. Return an empty list when it is correct. Do not judge style.",
    },
    {
      role: "user" as const,
      content: `${visualUserPrompt(lesson)}\nPicture: ${manifest.alt}\nSliders: ${manifest.controls.map((c) => `${c.id} (${c.label}, ${c.unit})`).join(", ") || "none"}\nCode:\n${code}`,
    },
  ];
}
