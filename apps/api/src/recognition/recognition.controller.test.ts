import { RecognisedPhoto, RecognitionResult } from "@sbi/contracts";
import {
  RECOGNITION_PROMPT_VERSION,
  type FallbackOutcome,
  type FallbackRecogniser,
  type RecognitionImage,
} from "@sbi/recognition";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fakeGaps,
  fakeMedia,
  fakeRecognition,
  startTestApp,
  type TestApp,
} from "../testing/test-app";

const KEY = "photos/0192f1a0-0000-7000-8000-000000000001.png";
const SESSION = "0192f1a0-0000-7000-8000-0000000000aa";
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function answering(output: Partial<FallbackOutcome>) {
  const recognise = vi.fn(async (_image: RecognitionImage): Promise<FallbackOutcome> => ({
    status: "recognised",
    candidates: [],
    observations: [],
    provider: "meta-spark",
    model: "muse-spark-1.3",
    promptVersion: RECOGNITION_PROMPT_VERSION,
    latencyMs: 5,
    usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    fallbackFrom: [],
    ...output,
  }));
  return { id: "fake", recognise } satisfies FallbackRecogniser;
}

function storedPhoto() {
  const media = fakeMedia();
  media.objects.set(KEY, PNG);
  return media;
}

describe("recognition routes", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  it("recognises a stored photo, persists only its hash and expires the photo sooner", async () => {
    const media = storedPhoto();
    const recogniser = answering({
      candidates: [
        { label: "bike", certainty: "likely", calibratedConfidence: 0.93, reasons: ["chain"] },
      ],
    });
    const recognition = fakeRecognition(recogniser);
    test = await startTestApp(media, recognition);

    const response = await test.post("/recognitions", { key: KEY, sessionId: SESSION });

    expect(response.status).toBe(200);
    const reply = RecognisedPhoto.parse(await response.json());
    expect(reply).toMatchObject({
      sessionId: SESSION,
      candidates: [
        {
          taxonomyId: "object.bicycle",
          label: "Bicycle",
          certainty: "likely",
          parts: expect.arrayContaining([{ taxonomyId: "object.bicycle:chain", label: "Chain" }]),
        },
      ],
      next: { kind: "proceed", taxonomyId: "object.bicycle" },
    });
    expect(JSON.stringify(reply)).not.toContain("0.93");
    expect(recogniser.recognise.mock.calls[0]?.[0].mime).toBe("image/png");

    const stored = RecognitionResult.parse(recognition.saved.get(reply.resultId));
    expect(stored).toMatchObject({ provider: "meta-spark", imageSha256: expect.any(String) });
    expect(JSON.stringify(stored)).not.toContain(Buffer.from(PNG).toString("base64"));
    expect(media.expiredSooner.has(KEY)).toBe(true);
  });

  it("records labels the taxonomy does not know as catalog gaps", async () => {
    const gaps = fakeGaps();
    test = await startTestApp(
      storedPhoto(),
      fakeRecognition(
        answering({
          status: "ambiguous",
          candidates: [
            { label: "lava lamp", certainty: "possible", calibratedConfidence: 0.6, reasons: [] },
            { label: "bicycle", certainty: "possible", calibratedConfidence: 0.5, reasons: [] },
          ],
        }),
      ),
      gaps,
    );

    const reply = RecognisedPhoto.parse(
      await (await test.post("/recognitions", { key: KEY })).json(),
    );

    expect(gaps.recorded).toEqual([{ source: "recognition-label", term: "lava lamp" }]);
    expect(reply.otherLabels).toEqual(["Lava lamp"]);
  });

  it("recognises the same photo once, giving each session its own record", async () => {
    const recogniser = answering({
      candidates: [
        { label: "bicycle", certainty: "likely", calibratedConfidence: 0.9, reasons: ["chain"] },
      ],
    });
    const recognition = fakeRecognition(recogniser);
    test = await startTestApp(storedPhoto(), recognition);
    const other = "0192f1a0-0000-7000-8000-0000000000bb";

    const first = RecognisedPhoto.parse(
      await (await test.post("/recognitions", { key: KEY, sessionId: SESSION })).json(),
    );
    const again = RecognisedPhoto.parse(
      await (await test.post("/recognitions", { key: KEY, sessionId: other })).json(),
    );

    expect(recogniser.recognise).toHaveBeenCalledTimes(1);
    expect(again).toMatchObject({
      sessionId: other,
      candidates: first.candidates,
      next: first.next,
    });
    expect(again.resultId).not.toBe(first.resultId);
    expect(recognition.saved.get(again.resultId)?.sessionId).toBe(other);
    expect(recognition.saved.get(first.resultId)?.sessionId).toBe(SESSION);
  });

  it("asks the provider again once the earlier result has expired or used an older prompt", async () => {
    const recogniser = answering({});
    const recognition = fakeRecognition(recogniser);
    test = await startTestApp(storedPhoto(), recognition);
    const first = RecognisedPhoto.parse(
      await (await test.post("/recognitions", { key: KEY })).json(),
    );
    const stored = RecognitionResult.parse(recognition.saved.get(first.resultId));
    recognition.saved.set(first.resultId, {
      ...stored,
      modelVersion: "muse-spark-1.3+recognition-p0.1",
    });

    await test.post("/recognitions", { key: KEY });
    for (const result of recognition.saved.values()) {
      recognition.saved.set(result.resultId, { ...result, deleteBy: "2026-01-01T00:00:00.000Z" });
    }
    await test.post("/recognitions", { key: KEY });

    expect(recogniser.recognise).toHaveBeenCalledTimes(3);
  });

  it("issues a session id when none is sent", async () => {
    test = await startTestApp(storedPhoto(), fakeRecognition(answering({})));

    const reply = RecognisedPhoto.parse(
      await (await test.post("/recognitions", { key: KEY })).json(),
    );

    expect(reply.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(reply.next).toEqual({ kind: "describe" });
  });

  it("asks a targeted question for close contenders", async () => {
    test = await startTestApp(
      storedPhoto(),
      fakeRecognition(
        answering({
          status: "ambiguous",
          candidates: [
            { label: "teapot", certainty: "possible", calibratedConfidence: 0.6, reasons: [] },
            { label: "coffee pot", certainty: "possible", calibratedConfidence: 0.55, reasons: [] },
          ],
        }),
      ),
    );

    const reply = RecognisedPhoto.parse(
      await (await test.post("/recognitions", { key: KEY })).json(),
    );

    expect(reply.next).toMatchObject({
      kind: "ask",
      question: "Is it a teapot or a coffee pot?",
      fallback: { taxonomyId: "category.heating" },
    });
  });

  it("answers 503 when no provider is configured or every provider fails", async () => {
    test = await startTestApp(storedPhoto(), fakeRecognition(null));
    expect((await test.post("/recognitions", { key: KEY })).status).toBe(503);
    await test.app.close();

    const failing = {
      id: "fake",
      recognise: vi.fn(async () => {
        throw new Error("all providers down");
      }),
    };
    const recognition = fakeRecognition(failing);
    test = await startTestApp(storedPhoto(), recognition);
    const response = await test.post("/recognitions", { key: KEY });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "We could not recognise the photo right now. Describe the object instead.",
    });
    expect(recognition.saved.size).toBe(0);
  });

  it("answers 404 for a deleted photo and 400 for a malformed key", async () => {
    test = await startTestApp(fakeMedia(), fakeRecognition(answering({})));

    expect((await test.post("/recognitions", { key: KEY })).status).toBe(404);
    expect((await test.post("/recognitions", { key: "../secret" })).status).toBe(400);
  });
});

describe("recording the learner's choice", () => {
  let test: TestApp | undefined;

  afterEach(async () => {
    await test?.app.close();
  });

  async function recognised() {
    const recognition = fakeRecognition(
      answering({
        candidates: [
          { label: "bicycle", certainty: "likely", calibratedConfidence: 0.9, reasons: [] },
          { label: "swing", certainty: "unsure", calibratedConfidence: 0.2, reasons: [] },
        ],
      }),
    );
    test = await startTestApp(storedPhoto(), recognition);
    const reply = RecognisedPhoto.parse(
      await (await test.post("/recognitions", { key: KEY })).json(),
    );
    const select = (selection: unknown) =>
      test?.post("/recognitions/selection", { resultId: reply.resultId, selection });
    const stored = () => RecognitionResult.parse(recognition.saved.get(reply.resultId));
    return { select, stored };
  }

  it("records a confirmed candidate without calling it a correction", async () => {
    const { select, stored } = await recognised();

    const response = await select({ kind: "object", taxonomyId: "object.bicycle" });

    expect(await response?.json()).toEqual({ recorded: true });
    expect(stored().selectedTaxonomyId).toBe("object.bicycle");
    expect(stored().userCorrection).toBeUndefined();
  });

  it("records an alternative or a tapped part as a correction", async () => {
    const { select, stored } = await recognised();

    await select({ kind: "object", taxonomyId: "object.bicycle:chain" });
    expect(stored()).toMatchObject({
      selectedTaxonomyId: "object.bicycle:chain",
      userCorrection: { kind: "selected-alternative", taxonomyId: "object.bicycle:chain" },
    });

    await select({ kind: "object", taxonomyId: "object.teapot" });
    expect(stored().userCorrection).toEqual({
      kind: "selected-alternative",
      taxonomyId: "object.teapot",
    });
  });

  it("records free-text corrections", async () => {
    const { select, stored } = await recognised();

    await select({ kind: "free-text", text: "  a penny-farthing " });

    expect(stored().userCorrection).toEqual({ kind: "free-text", text: "a penny-farthing" });
    expect(stored().selectedTaxonomyId).toBeUndefined();
  });

  it("rejects unknown objects and parts, and results that are gone", async () => {
    const { select } = await recognised();

    for (const taxonomyId of ["object.spaceship", "object.bicycle:wings", "category.heating:x"]) {
      expect((await select({ kind: "object", taxonomyId }))?.status).toBe(400);
    }
    const gone = await test?.post("/recognitions/selection", {
      resultId: "0192f1a0-0000-7000-9000-0000000000ff",
      selection: { kind: "free-text", text: "kettle" },
    });
    expect(gone?.status).toBe(404);
  });
});
