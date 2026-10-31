import { kindRenderer } from "../kind";
import { graphRows, planGraph, vegaLiteSpec } from "./graph-spec";

const noNetwork = () => Promise.reject(new Error("graphs load no data from the network"));

export const graphRenderer = kindRenderer({
  kind: "graph",
  async draw(manifest, stage, values) {
    const plan = planGraph(manifest);
    if ("problems" in plan) throw new Error(plan.problems.join("; "));
    const [{ default: embed }, { expressionInterpreter }] = await Promise.all([
      import("vega-embed"),
      import("vega-interpreter"),
    ]);
    const holder = stage.ownerDocument.createElement("div");
    holder.className = "visual-graph";
    stage.append(holder);
    // The interpreter evaluates Vega expressions without eval, so the page's CSP can forbid it.
    const result = await embed(holder, vegaLiteSpec(plan, manifest.alt) as never, {
      actions: false,
      renderer: "svg",
      ast: true,
      expr: expressionInterpreter,
      loader: { load: noNetwork, sanitize: noNetwork, http: noNetwork, file: noNetwork } as never,
    });
    await result.view.data("rows", graphRows(plan, values)).runAsync();
    return {
      update(next) {
        void result.view.data("rows", graphRows(plan, next)).runAsync();
      },
      destroy() {
        result.finalize();
        holder.remove();
      },
    };
  },
});

export default graphRenderer;
