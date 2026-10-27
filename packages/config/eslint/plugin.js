import maxCommentLines from "./rules/max-comment-lines.js";
import noCrossPackageInternals from "./rules/no-cross-package-internals.js";

export default {
  meta: { name: "local" },
  rules: {
    "max-comment-lines": maxCommentLines,
    "no-cross-package-internals": noCrossPackageInternals,
  },
};
