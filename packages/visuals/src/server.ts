import { VisualManifest } from "@sbi/contracts";
import type { MainModule } from "@mujoco/mujoco";
import type mermaidApi from "mermaid";
import { commonLayerProblems } from "./common/validate";
import { graphProblems, graphRows, planGraph, vegaLiteSpec } from "./kinds/graph-spec";
import { physicsProblems, readMechanismSpec } from "./kinds/mechanism-sim";
import { processSpecProblems } from "./kinds/process-spec";

type Mermaid = typeof mermaidApi;
let mermaid: Promise<Mermaid> | undefined;
let mujoco: Promise<MainModule> | undefined;

// Mermaid parses through DOMPurify, which needs a window; happy-dom gives it one outside a browser.
async function loadMermaid(): Promise<Mermaid> {
  mermaid ??= (async () => {
    const { Window } = await import("happy-dom");
    const window = new Window();
    Object.assign(globalThis, { window, document: window.document });
    return (await import("mermaid")).default;
  })();
  return mermaid;
}

async function kindProblems(manifest: VisualManifest): Promise<string[]> {
  switch (manifest.kind) {
    case "process": {
      const problems = processSpecProblems(manifest.spec);
      if (problems.length > 0) return problems;
      try {
        await (await loadMermaid()).parse(String(manifest.spec));
        return [];
      } catch (error) {
        return [`Mermaid could not read the diagram: ${(error as Error).message}`];
      }
    }
    case "graph": {
      const problems = graphProblems(manifest);
      if (problems.length > 0) return problems;
      const plan = planGraph(manifest);
      if ("problems" in plan) return plan.problems;
      const { compile } = await import("vega-lite");
      const values = Object.fromEntries(manifest.controls.map((c) => [c.id, c.value]));
      try {
        compile({
          ...vegaLiteSpec(plan, manifest.alt),
          data: { values: graphRows(plan, values) },
        } as never);
        return [];
      } catch (error) {
        return [`Vega-Lite could not read the graph: ${(error as Error).message}`];
      }
    }
    case "mechanism": {
      const spec = readMechanismSpec(manifest);
      if ("problems" in spec) return spec.problems;
      const { default: loadMujoco } = await import("@mujoco/mujoco");
      mujoco ??= loadMujoco();
      return physicsProblems(await mujoco, manifest);
    }
    default:
      return [`${manifest.kind} visuals cannot be drawn yet`];
  }
}

/** Everything wrong with a generated manifest, worded for the AI's one repair attempt (ADR 0014). */
export async function manifestProblems(input: unknown): Promise<string[]> {
  const parsed = VisualManifest.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`,
    );
  }
  return [...commonLayerProblems(parsed.data), ...(await kindProblems(parsed.data))];
}
