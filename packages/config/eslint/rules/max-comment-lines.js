const TODO = /\b(TODO|FIXME)\b/;
const TODO_WITH_ISSUE = /\b(TODO|FIXME)\(#\d+\)/;
const DIRECTIVE = /^\s*(eslint|@ts-|global\s|prettier-ignore|\/\s*<reference)/;

function contentLines(comment) {
  return comment.value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?/, "").trim())
    .filter((line) => line.length > 0).length;
}

/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: { description: "Keep comments short and tie TODOs to an issue" },
    schema: [
      {
        type: "object",
        properties: { max: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
    messages: {
      tooLong:
        "Comment spans {{lines}} lines (max {{max}}). Explain why in fewer words or move detail to docs.",
      todoNeedsIssue: "TODO/FIXME must reference an issue, e.g. TODO(#123): short note",
    },
  },
  create(context) {
    const max = context.options[0]?.max ?? 2;
    const comments = context.sourceCode
      .getAllComments()
      .filter((comment) => comment.type !== "Shebang" && !DIRECTIVE.test(comment.value));

    function report(node, lines) {
      context.report({ loc: node.loc, messageId: "tooLong", data: { lines, max } });
    }

    let run = [];
    const flushRun = () => {
      if (run.length > max) {
        report({ loc: { start: run[0].loc.start, end: run.at(-1).loc.end } }, run.length);
      }
      run = [];
    };

    for (const comment of comments) {
      if (TODO.test(comment.value) && !TODO_WITH_ISSUE.test(comment.value)) {
        context.report({ loc: comment.loc, messageId: "todoNeedsIssue" });
      }

      if (comment.type === "Block") {
        flushRun();
        const lines = contentLines(comment);
        if (lines > max) report(comment, lines);
        continue;
      }

      const previous = run.at(-1);
      if (previous && comment.loc.start.line !== previous.loc.end.line + 1) flushRun();
      run.push(comment);
    }
    flushRun();

    return {};
  },
};
