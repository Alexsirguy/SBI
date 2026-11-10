import { MERRILL_MODULES, type Lesson } from "@sbi/contracts";
import { withoutInlineIds } from "./inline-ids";

interface FragmentSetting {
  controlId: string;
  value: number;
}

export interface FragmentStep {
  text: string;
  settings?: FragmentSetting[];
}

export interface FragmentTask {
  module: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  feedback: string[];
  setup?: FragmentSetting[];
  goal?: { readoutId: string; op: string; value: number; tolerance?: number };
  claimIds?: string[];
}

export type FragmentExperiment = NonNullable<Lesson["experiment"]>;

const setting = {
  type: "object",
  properties: { controlId: { type: "string" }, value: { type: "number" } },
  required: ["controlId", "value"],
  additionalProperties: false,
};

const strings = { type: "array", items: { type: "string" } };

/** Guides a v7 draft; strict structured output needs every property, so empties stand in. */
export const MERRILL_FRAGMENT_PROPERTIES: Record<string, unknown> = {
  sections: {
    type: "array",
    minItems: MERRILL_MODULES.length,
    maxItems: MERRILL_MODULES.length,
    items: {
      type: "object",
      properties: {
        module: { type: "string", enum: [...MERRILL_MODULES] },
        heading: { type: "string" },
        text: { type: "string" },
        claimIds: strings,
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: { text: { type: "string" }, settings: { type: "array", items: setting } },
            required: ["text", "settings"],
            additionalProperties: false,
          },
        },
      },
      required: ["module", "heading", "text", "claimIds", "steps"],
      additionalProperties: false,
    },
  },
  tasks: {
    type: "array",
    minItems: 3,
    maxItems: 4,
    items: {
      type: "object",
      properties: {
        module: { type: "string", enum: ["activate", "apply"] },
        prompt: { type: "string" },
        options: strings,
        answerIndex: { type: "integer" },
        feedback: strings,
        setup: { type: "array", items: setting },
        goal: {
          type: "object",
          properties: {
            readoutId: { type: "string" },
            op: { type: "string", enum: ["atLeast", "atMost", "near"] },
            value: { type: "number" },
            tolerance: { type: "number" },
          },
          required: ["readoutId", "op", "value", "tolerance"],
          additionalProperties: false,
        },
        claimIds: strings,
      },
      required: [
        "module",
        "prompt",
        "options",
        "answerIndex",
        "feedback",
        "setup",
        "goal",
        "claimIds",
      ],
      additionalProperties: false,
    },
  },
  experiment: {
    type: "object",
    properties: {
      controls: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            unit: { type: "string" },
            min: { type: "number" },
            max: { type: "number" },
            value: { type: "number" },
          },
          required: ["id", "label", "unit", "min", "max", "value"],
          additionalProperties: false,
        },
      },
      readouts: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            unit: { type: "string" },
          },
          required: ["id", "label", "unit"],
          additionalProperties: false,
        },
      },
    },
    required: ["controls", "readouts"],
    additionalProperties: false,
  },
};

const order = (module: string) =>
  MERRILL_MODULES.indexOf(module as Lesson["sections"][number]["module"]);

/** Sections in Merrill order, whatever order the model wrote them in. */
export function inMerrillOrder<T extends { module: string }>(sections: T[]): T[] {
  return [...sections].sort((left, right) => order(left.module) - order(right.module));
}

// Settings naming no control are dropped and values are clamped, so a slip never fails the draft.
function settingsFor(
  experiment: FragmentExperiment | undefined,
  settings: FragmentSetting[] = [],
): FragmentSetting[] {
  const controls = new Map(experiment?.controls.map((control) => [control.id, control]) ?? []);
  return settings.flatMap(({ controlId, value }) => {
    const control = controls.get(controlId);
    if (!control) return [];
    return [{ controlId, value: Math.min(control.max, Math.max(control.min, value)) }];
  });
}

/** A demonstrate section's steps, with inline ids stripped and unknown controls dropped. */
export function draftSteps(
  steps: FragmentStep[] | undefined,
  experiment: FragmentExperiment | undefined,
): Lesson["sections"][number]["steps"] {
  if (!steps || steps.length === 0) return undefined;
  return steps.slice(0, 8).map((step) => ({
    text: withoutInlineIds(step.text),
    settings: settingsFor(experiment, step.settings),
  }));
}

/** Tasks with assigned ids; a goal on an unknown readout is dropped, leaving the options as the task. */
export function draftTasks(
  tasks: FragmentTask[] = [],
  experiment: FragmentExperiment | undefined,
  known: Set<string>,
): Lesson["tasks"] {
  const readouts = new Set(experiment?.readouts.map((readout) => readout.id) ?? []);
  return tasks.map((task, index) => {
    const goal = task.goal;
    const usable = task.module === "apply" && goal !== undefined && readouts.has(goal.readoutId);
    const near = goal?.op === "near" && (goal.tolerance ?? 0) > 0;
    return {
      taskId: `${task.module}-${index + 1}`,
      module: task.module as Lesson["tasks"][number]["module"],
      prompt: withoutInlineIds(task.prompt),
      options: task.options.map(withoutInlineIds),
      answerIndex: task.answerIndex,
      feedback: task.feedback.map(withoutInlineIds),
      setup: task.module === "apply" ? settingsFor(experiment, task.setup) : [],
      goal: usable
        ? {
            readoutId: goal.readoutId,
            op: goal.op as NonNullable<Lesson["tasks"][number]["goal"]>["op"],
            value: goal.value,
            tolerance: near ? goal.tolerance : undefined,
          }
        : undefined,
      claimIds: (task.claimIds ?? []).filter((id) => known.has(id)),
    };
  });
}

export interface FragmentFormula {
  name: string;
  expression: string;
  words: string;
  symbols: { symbol: string; meaning: string; unit: string; quantityId: string }[];
  example: { problem: string; steps: string[]; answer: string };
  practice: { prompt: string; answer: number; unit: string; tolerance: number; working: string[] };
}

const text = { type: "string" };

/** Topic drafts from lesson-draft-topic@2: the formulas the topic is taught with, or []. */
export const FORMULAS_FRAGMENT_PROPERTY: Record<string, unknown> = {
  type: "array",
  maxItems: 2,
  items: {
    type: "object",
    properties: {
      name: text,
      expression: text,
      words: text,
      symbols: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "object",
          properties: { symbol: text, meaning: text, unit: text, quantityId: text },
          required: ["symbol", "meaning", "unit", "quantityId"],
          additionalProperties: false,
        },
      },
      example: {
        type: "object",
        properties: { problem: text, steps: strings, answer: text },
        required: ["problem", "steps", "answer"],
        additionalProperties: false,
      },
      practice: {
        type: "object",
        properties: {
          prompt: text,
          answer: { type: "number" },
          unit: text,
          tolerance: { type: "number" },
          working: strings,
        },
        required: ["prompt", "answer", "unit", "tolerance", "working"],
        additionalProperties: false,
      },
    },
    required: ["name", "expression", "words", "symbols", "example", "practice"],
    additionalProperties: false,
  },
};

// Rounding to two significant figures must still count as right.
const toleranceFor = (answer: number, given: number) =>
  given > 0 ? given : Math.max(Math.abs(answer) * 0.02, 0.01);

/** Formulas with assigned ids; a symbol's quantity that the experiment lacks is dropped. */
export function draftFormulas(
  formulas: FragmentFormula[] = [],
  experiment: FragmentExperiment | undefined,
): Lesson["formulas"] {
  const quantities = new Set([
    ...(experiment?.controls.map((control) => control.id) ?? []),
    ...(experiment?.readouts.map((readout) => readout.id) ?? []),
  ]);
  return formulas.slice(0, 2).map((formula, index) => ({
    formulaId: `formula-${index + 1}`,
    name: withoutInlineIds(formula.name),
    expression: formula.expression.trim(),
    words: withoutInlineIds(formula.words),
    symbols: formula.symbols.map((symbol) => ({
      symbol: symbol.symbol.trim(),
      meaning: withoutInlineIds(symbol.meaning),
      unit: symbol.unit.trim(),
      quantityId: quantities.has(symbol.quantityId) ? symbol.quantityId : undefined,
    })),
    example: {
      problem: withoutInlineIds(formula.example.problem),
      steps: formula.example.steps.slice(0, 6).map(withoutInlineIds),
      answer: withoutInlineIds(formula.example.answer),
    },
    practice: {
      prompt: withoutInlineIds(formula.practice.prompt),
      answer: formula.practice.answer,
      unit: formula.practice.unit.trim(),
      tolerance: toleranceFor(formula.practice.answer, formula.practice.tolerance),
      working: formula.practice.working.slice(0, 6).map(withoutInlineIds),
    },
  }));
}
