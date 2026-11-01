import type { VisualManifest } from "@sbi/contracts";
import { z } from "zod";
import { compileFormula, type CompiledFormula } from "../formula";

const Name = z.string().regex(/^[a-z][a-zA-Z0-9]{0,39}$/);

export const GraphSpec = z.object({
  x: z.object({
    name: Name,
    label: z.string().min(1).max(60),
    unit: z.string().max(16).default(""),
    from: z.number(),
    to: z.number(),
    samples: z.int().min(2).max(400).default(60),
  }),
  series: z
    .array(
      z.object({
        name: Name,
        label: z.string().min(1).max(60),
        unit: z.string().max(16).default(""),
        formula: z.string().min(1).max(300),
      }),
    )
    .min(1)
    .max(4),
  /** Only the look: mark and extra encoding. Data comes from the formulas, never from a URL. */
  vegaLite: z.record(z.string(), z.unknown()).default({}),
});
export type GraphSpec = z.infer<typeof GraphSpec>;

// Vega-Lite can fetch data or open links through these; the graph's data is always our own.
const FORBIDDEN_KEYS = new Set([
  "data",
  "datasets",
  "url",
  "href",
  "transform",
  "params",
  "usermeta",
]);

function forbiddenKeys(value: unknown, path = "vegaLite"): string[] {
  if (Array.isArray(value))
    return value.flatMap((item, index) => forbiddenKeys(item, `${path}[${index}]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) =>
    FORBIDDEN_KEYS.has(key)
      ? [`${path}.${key} is not allowed`]
      : forbiddenKeys(item, `${path}.${key}`),
  );
}

export interface GraphPlan {
  spec: GraphSpec;
  series: { name: string; label: string; formula: CompiledFormula }[];
}

/** Reads and checks a graph's spec against its sliders, or lists what to fix. */
export function planGraph(manifest: VisualManifest): GraphPlan | { problems: string[] } {
  const parsed = GraphSpec.safeParse(manifest.spec);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map(
        (issue) => `spec.${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }
  const spec = parsed.data;
  const problems = forbiddenKeys(spec.vegaLite);
  if (spec.x.from >= spec.x.to) problems.push("spec.x.from must be below spec.x.to");
  const names = [spec.x.name, ...manifest.controls.map((control) => control.id)];
  const series: GraphPlan["series"] = [];
  for (const item of spec.series) {
    const compiled = compileFormula(item.formula, names);
    if ("error" in compiled) problems.push(`series "${item.name}": ${compiled.error}`);
    else series.push({ name: item.name, label: item.label, formula: compiled });
  }
  return problems.length > 0 ? { problems } : { spec, series };
}

export interface GraphRow {
  x: number;
  series: string;
  y: number;
}

/** Samples every series across the x range at the current slider values. */
export function graphRows(plan: GraphPlan, values: Record<string, number>): GraphRow[] {
  const { x } = plan.spec;
  const rows: GraphRow[] = [];
  for (let index = 0; index < x.samples; index += 1) {
    const at = x.from + ((x.to - x.from) * index) / (x.samples - 1);
    for (const item of plan.series) {
      rows.push({
        x: at,
        series: item.label,
        y: item.formula.evaluate({ ...values, [x.name]: at }),
      });
    }
  }
  return rows;
}

function titled(label: string, unit: string): string {
  return unit ? `${label} (${unit})` : label;
}

/** The Vega-Lite spec we draw: our data and axes, with only the look taken from the AI's spec. */
export function vegaLiteSpec(plan: GraphPlan, alt: string): Record<string, unknown> {
  const { x, series, vegaLite } = plan.spec;
  const first = series[0];
  const { encoding: extraEncoding, ...look } = vegaLite as { encoding?: Record<string, unknown> };
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    description: alt,
    width: "container",
    height: 240,
    mark: { type: "line", tooltip: true },
    ...look,
    data: { name: "rows" },
    encoding: {
      x: { field: "x", type: "quantitative", title: titled(x.label, x.unit) },
      y: {
        field: "y",
        type: "quantitative",
        title: series.length === 1 && first ? titled(first.label, first.unit) : "Value",
      },
      ...(series.length > 1 ? { color: { field: "series", type: "nominal", title: null } } : {}),
      ...extraEncoding,
    },
  };
}

/** Every series must give a finite number across the range, at each slider's start and ends. */
export function graphProblems(manifest: VisualManifest): string[] {
  const plan = planGraph(manifest);
  if ("problems" in plan) return plan.problems;
  const base = Object.fromEntries(manifest.controls.map((control) => [control.id, control.value]));
  const cases = [
    base,
    ...manifest.controls.flatMap((c) => [
      { ...base, [c.id]: c.min },
      { ...base, [c.id]: c.max },
    ]),
  ];
  for (const values of cases) {
    try {
      graphRows(plan, values);
    } catch (error) {
      return [`${(error as Error).message} at ${JSON.stringify(values)}`];
    }
  }
  return [];
}
