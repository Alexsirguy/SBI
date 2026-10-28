import { describe, expect, it, vi } from "vitest";
import {
  assertNoTrainingReuse,
  createRecognitionProvider,
  RECOGNITION_PROVIDERS,
  type RecognitionProviderConfig,
} from "./providers";

const reply = {
  model: "m",
  choices: [
    {
      message: {
        content: JSON.stringify({ status: "unsupported", candidates: [], observations: [] }),
      },
    },
  ],
};

function recordingFetch() {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(reply)));
}

function sentBodies(fetchImpl: ReturnType<typeof recordingFetch>) {
  return fetchImpl.mock.calls.map(([url, init]) => ({
    url: String(url),
    body: JSON.parse(String(init?.body)),
  }));
}

const image = { bytes: new Uint8Array([1]), mime: "image/jpeg" };
const keys = { META_MODEL_API_KEY: "meta-key", OPENAI_API_KEY: "openai-key" };

describe("RECOGNITION_PROVIDERS", () => {
  it("follows ADR 0006: Meta Spark first, GPT-5.4-mini as fallback", () => {
    expect(RECOGNITION_PROVIDERS.map((provider) => provider.model)).toEqual([
      "muse-spark-1.3",
      "gpt-5.4-mini",
    ]);
  });

  it.each(RECOGNITION_PROVIDERS)("$id never opts in to training reuse", (config) => {
    expect(() => assertNoTrainingReuse(config)).not.toThrow();
  });
});

describe("assertNoTrainingReuse", () => {
  const base = RECOGNITION_PROVIDERS[0] as RecognitionProviderConfig;

  it("rejects Meta contributor-mode models", () => {
    expect(() => assertNoTrainingReuse({ ...base, model: "muse-spark-1.3-contributor" })).toThrow(
      /contributor/,
    );
  });

  it("rejects a body that asks the vendor to store completions", () => {
    expect(() => assertNoTrainingReuse({ ...base, extraBody: { store: true } })).toThrow(/store/);
  });
});

describe("createRecognitionProvider", () => {
  it("tries Meta first, then OpenAI, with training reuse off on the wire", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("bad", { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(reply)));
    const recogniser = createRecognitionProvider(keys, { fetchImpl });

    const result = await recogniser.recognise(image);

    const [meta, openai] = sentBodies(fetchImpl);
    expect(meta?.url).toBe("https://api.meta.ai/v1/chat/completions");
    expect(meta?.body.model).toBe("muse-spark-1.3");
    expect(openai?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(openai?.body).toMatchObject({ model: "gpt-5.4-mini", store: false });
    expect(result).toMatchObject({ provider: "openai-mini", fallbackFrom: ["meta-spark"] });
  });

  it("skips providers without a key", async () => {
    const fetchImpl = recordingFetch();
    const recogniser = createRecognitionProvider({ OPENAI_API_KEY: "k" }, { fetchImpl });

    await recogniser.recognise(image);

    expect(sentBodies(fetchImpl).map(({ body }) => body.model)).toEqual(["gpt-5.4-mini"]);
  });

  it("honours RECOGNITION_PROVIDERS order", async () => {
    const fetchImpl = recordingFetch();
    const recogniser = createRecognitionProvider(
      { ...keys, RECOGNITION_PROVIDERS: "openai-mini" },
      { fetchImpl },
    );

    await recogniser.recognise(image);

    expect(sentBodies(fetchImpl).map(({ body }) => body.model)).toEqual(["gpt-5.4-mini"]);
  });

  it("refuses to start without any configured provider", () => {
    expect(() => createRecognitionProvider({})).toThrow(/META_MODEL_API_KEY|OPENAI_API_KEY/);
  });

  it("rejects unknown provider ids", () => {
    expect(() =>
      createRecognitionProvider({ ...keys, RECOGNITION_PROVIDERS: "meta-wonder" }),
    ).toThrow(/meta-wonder/);
  });
});
