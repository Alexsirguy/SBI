import { describe, expect, it, vi } from "vitest";
import { createEvidenceJudge } from "./judge";

const answer = (body: unknown) =>
  vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    Response.json({
      model: "m",
      choices: [{ message: { content: JSON.stringify(body) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
  );

describe("createEvidenceJudge", () => {
  it("uses Meta Spark when its key is set", () => {
    const judge = createEvidenceJudge({ META_MODEL_API_KEY: "k", OPENAI_API_KEY: "o" });
    expect(judge.version).toBe("muse-spark-1.3+evidence-judge-p0.2");
  });

  it("falls back to GPT-5.4-mini with storage off", async () => {
    const fetchImpl = answer({ verdict: "insufficient", quote: "", reason: "n/a" });
    const judge = createEvidenceJudge({ OPENAI_API_KEY: "o" }, fetchImpl);
    expect(judge.version).toBe("gpt-5.4-mini+evidence-judge-p0.2");
    await judge.judge({ claim: "c", scope: "s", excerpt: "e", location: "l", sourceTitle: "t" });
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.store).toBe(false);
  });

  it("needs a key", () => {
    expect(() => createEvidenceJudge({})).toThrow(/META_MODEL_API_KEY or OPENAI_API_KEY/);
  });
});
