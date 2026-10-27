import maxCommentLines from "./rules/max-comment-lines.js";

export default {
  meta: { name: "local" },
  rules: { "max-comment-lines": maxCommentLines },
};
