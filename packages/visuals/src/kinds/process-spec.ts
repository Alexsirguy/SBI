// Diagram types that read as a sequence of stages; the others draw charts or layouts we don't need.
const DIAGRAM_TYPES = [
  "flowchart",
  "graph",
  "stateDiagram-v2",
  "stateDiagram",
  "sequenceDiagram",
  "timeline",
];

/** Problems with a Mermaid spec that no parser would catch: links, scripts and config overrides. */
export function processSpecProblems(spec: unknown): string[] {
  if (typeof spec !== "string" || spec.trim() === "") return ["spec must be Mermaid text"];
  const problems: string[] = [];
  const first = spec.trim().split(/\s+/)[0] ?? "";
  if (!DIAGRAM_TYPES.includes(first)) {
    problems.push(`the diagram must start with one of ${DIAGRAM_TYPES.join(", ")}, not "${first}"`);
  }
  // Directives can lower the security level; click and links can run code or leave the lesson.
  if (/%%\s*\{/.test(spec)) problems.push("remove %%{ }%% directives");
  if (/^\s*(click|href)\b/m.test(spec)) problems.push("remove click and href lines");
  if (/javascript:|https?:\/\/|<\s*\w/i.test(spec))
    problems.push("remove links and HTML from labels");
  return problems;
}

/** The same flowchart drawn top to bottom, for a box too narrow to read a long row of stages. */
export function stackedFlowchart(spec: string): string {
  return spec.replace(/^(\s*(?:flowchart|graph)\s+)(LR|RL)\b/, "$1TD");
}
