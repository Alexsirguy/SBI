import { canonicalJson, newId, sha256Hex, VisualManifest, type VisualAsset } from "@sbi/contracts";
import { projectOutputAsset } from "@sbi/rights";
import { z } from "zod";
import { alignedControls, type ExperimentForVisual } from "./experiment";
import { RAINBOW_CODE } from "./kinds/rainbow";
import { REFERENCE_MECHANISMS, REFERENCE_VISUALS } from "./references";

export const VISUAL_PROMPT = { id: "visual-generate", version: "v8" } as const;
export const DIAGRAM_PROMPT = { id: "visual-diagram", version: "v4" } as const;
/** A sequence shorter than this is one change, which the experiment already shows. */
export const MIN_DIAGRAM_STAGES = 3;

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
const ENGINE_MJCF = (REFERENCE_MECHANISMS.engine.spec as { mjcf: string }).mjcf;
const HEATING_SERIES = (REFERENCE_VISUALS.heating.spec as { series: unknown }).series;

/** A string's pitch against its length (Mersenne's law), so sound topics get a graph, not a playground. */
export const PITCH_EXAMPLE = {
  x: { name: "length", label: "String length", unit: "m", from: 0.3, to: 0.9 },
  series: [
    {
      name: "pitch",
      label: "Pitch",
      unit: "Hz",
      formula: "sqrt(tension / massPerMetre) / (2 * length)",
    },
  ],
  mark: "line",
};

export const VISUAL_SYSTEM_PROMPT = `You design one interactive picture that shows how an everyday thing works, for a science lesson.
The learner changes sliders and watches the result, so prefer a kind with sliders and readouts.
Try the kinds in this order and pick the first that can show the lesson's mechanism: mechanism, graph, molecule, process, playground.
Fill only that kind's fields; leave the others empty ("" or []).

Kinds:
- mechanism: moving parts (engines, gears, levers, hinges, pumps, springs, pendulums, wheels). Write "mjcf", a MuJoCo model:
  start with <mujoco>; z is up; metres and kilograms; use only primitive geoms (box, sphere, capsule, cylinder, ellipsoid, plane);
  never use files, meshes, <include> or plugins; at most 30 bodies; give joints damping; turn gravity off unless gravity is the point;
  add a <motor name=".." joint=".." gear=".."/> actuator for each slider that drives something and list it in "bindings"
  ({control: slider id, actuator: actuator name}); the slider sets the motor's control, so never write ctrl= or ctrlrange= yourself;
  the picture runs in real time, so pick each gear for at most 2 turns a second at the slider's largest value
  (steady speed in radians a second is about gear × slider value ÷ the joint's damping);
  a joint's range is measured from where its body starts, so it must include 0, and a piston needs no range because its crank limits it;
  name bodies with short camelCase names, and use those names as label ids so labels point at parts. Colour parts with rgba;
  make casings, cylinders and housings see-through (alpha 0.25) so the moving parts inside stay visible; add no floor plane.
  Example (a lever):
${LEVER_MJCF}
  A piston turning a crank (car engines, steam engines, compressors) is a slider-crank: a motor turns the crank, a rod hangs
  from the crank pin, and <equality><connect> joins the rod's top end to the piston, so the piston can only follow the crank.
  Start from this engine: keep its joints, the connect and the motor on the crank, and change only sizes, colours and names.
  A slider that moves nothing, such as fuel or compression, has no binding and changes only the readouts.
${ENGINE_MJCF}
- molecule: the substance itself matters (water, ice, sugar, caffeine, carbon dioxide). List up to 3 common names in "molecules"; never write coordinates.
  Only small covalent molecules work: never ionic solids, metals, rust, minerals or polymers (salt, iron oxide, glass, starch).
- process: stages or flows (photosynthesis, the water cycle, digestion, the four strokes). Write "mermaid": a "flowchart LR" with at most 12 short nodes;
  plain words only, no links, HTML, click lines or %% directives.
- graph: one quantity changing with another (heating over time, pitch against string length or drum size, speed against gear). Fill "graph": an x range and up to 4 series
  whose formulas use x's name and slider ids. Example (a kettle; sliders power, mass and height):
  ${JSON.stringify({ x: { name: "t", label: "Time", unit: "s", from: 0, to: 600 }, series: HEATING_SERIES, mark: "line" })}
  Example (a guitar string; sliders length in m, tension in N, mass per metre in kg/m):
  ${JSON.stringify(PITCH_EXAMPLE)}
- playground: only when none of the kinds above can show it (light, colour, geometry, particles, weather, cells).
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
- controls: 1 to 4 sliders (none only for molecule and process) with a camelCase id, label, unit, and min < value < max; step divides the range into at most 100 steps.
- every label, control and readout id is different from all the others.
- readouts: 1 to 3 numbers (none only for molecule and process) worked out from slider ids with plain arithmetic (mathjs syntax: + - * / ^, min, max, sqrt, sin, cos, pi).
The lesson's experiment, when given, is what the learner will be asked to change and watch, so pick a kind with sliders.
For every kind except molecule, process and none: give a control for each experiment control with the SAME id, min, max and value,
and a readout for each experiment readout with the SAME id, writing its formula yourself from the controls. Keep within the limits above.
Use real physical values and units. Be correct: a learner will trust it.`;

// A second, optional picture for stage-and-flow topics; the experiment visual stays the one to drive.
export const DIAGRAM_SYSTEM_PROMPT = `You decide whether a science lesson needs a stage diagram beside its interactive experiment, and draw it if so.
First decide topic, what kind of idea the lesson teaches:
- "quantity": one amount changes another (a string's pitch with its tension, a seesaw's balance, how fast water heats with power).
- "mechanism": parts push, turn or act on each other (gears, a lever, a compass needle turning to a magnet).
- "structure": a shape, arrangement or set of parts (a honeycomb's cells, a salt crystal, the parts of a flower).
- "process": matter or energy passes through a series of different states or places, each changing it (photosynthesis, the water cycle, digestion, rusting, a fridge moving heat round its loop).
Any idea can be told as steps, and every lesson's demonstration is, so judge the idea itself, not how it is told.
Then fill stages: for a process, its distinct stages in order, a few words each; otherwise leave it empty.
Draw only a process with three or more stages: kind "process", one node per stage in that order. Otherwise kind "none".
For a diagram, leave every other kind's fields empty ("" or []), with no controls and no readouts.
- mermaid: a "flowchart LR" with at most 12 short nodes in plain words; no links, HTML, click lines or %% directives. Follow the demonstration's steps in order when they are given.
- alt: under 120 characters, says what the diagram shows.
- longDescription and fallbackText: 1 to 2 plain sentences a screen reader or a learner without the picture can follow.
- assumptions: the simplifications, such as "Only the main stages".
- labels: up to 6 named stages; claimId must be one of the lesson's claim ids given below, or leave the label out.
Every stage and arrow must be correct: a learner will trust it.`;

// topic and stages come first, so the model judges the idea before it decides to draw it.
export const GENERATED_DIAGRAM_SCHEMA: Record<string, unknown> = object({
  topic: { type: "string", enum: ["quantity", "mechanism", "structure", "process"] },
  stages: list(text),
  ...(GENERATED_VISUAL_SCHEMA.properties as Record<string, unknown>),
  kind: { type: "string", enum: ["process", "none"] },
});

/** The stages of a diagram answer that judged its topic a process; anything else counts as none. */
export function diagramStages(answer: string): string[] {
  try {
    const { topic, stages } = JSON.parse(answer) as { topic?: unknown; stages?: unknown };
    if (topic !== "process" || !Array.isArray(stages)) return [];
    return stages.filter(
      (stage): stage is string => typeof stage === "string" && stage.trim() !== "",
    );
  } catch {
    return [];
  }
}

export interface LessonForVisual {
  lessonId: string;
  title: string;
  summary: string;
  readingLevel: string;
  claims: { claimId: string; text: string }[];
  /** The demonstration's worked steps, which a stage diagram follows. */
  steps?: string[];
  /** The sliders and readouts the lesson's demonstration and challenges name. */
  experiment?: ExperimentForVisual;
  /** The formulas the lesson teaches; readouts must compute the same relation (#434). */
  formulas?: FormulaForVisual[];
}

export interface FormulaForVisual {
  expression: string;
  symbols: { symbol: string; meaning: string; unit: string; quantityId?: string }[];
}

function renderFormulas(formulas: FormulaForVisual[] | undefined): string {
  if (!formulas?.length) return "";
  const lines = formulas.map((formula) => {
    const symbols = formula.symbols.map(
      (symbol) =>
        `${symbol.symbol} = ${symbol.meaning}${symbol.unit ? ` (${symbol.unit})` : ""}` +
        (symbol.quantityId ? ` is ${symbol.quantityId}` : ""),
    );
    return `- ${formula.expression}, where ${symbols.join("; ")}`;
  });
  return `\nFormulas the lesson teaches (each readout's formula must compute the same relation):\n${lines.join("\n")}`;
}

function renderExperiment(experiment: ExperimentForVisual | undefined): string {
  if (!experiment) return "";
  const unit = (text: string) => text || "no unit";
  const controls = experiment.controls.map(
    (control) =>
      `- control ${control.id} (${control.label}, ${unit(control.unit)}): min ${control.min}, max ${control.max}, value ${control.value}`,
  );
  const readouts = experiment.readouts.map(
    (readout) => `- readout ${readout.id} (${readout.label}, ${unit(readout.unit)})`,
  );
  return `\nExperiment (keep these ids):\n${[...controls, ...readouts].join("\n")}`;
}

export function visualUserPrompt(lesson: LessonForVisual): string {
  const claims = lesson.claims.map((claim) => `- ${claim.claimId}: ${claim.text}`).join("\n");
  const steps = lesson.steps?.length
    ? `\nDemonstration steps:\n${lesson.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`
    : "";
  return `Lesson: ${lesson.title}\nReading level: ${lesson.readingLevel}\nSummary: ${lesson.summary}\nClaims:\n${claims}${steps}${renderExperiment(lesson.experiment)}${renderFormulas(lesson.formulas)}`;
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
    controls: alignedControls(output.controls, lesson.experiment),
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
