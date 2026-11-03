import { TutorTurn } from "@sbi/contracts";
import { SAFE_ACTIVITY_RULE } from "@sbi/safety";
import { describe, expect, it } from "vitest";
import { TUTOR_ANSWER_PROMPT_VERSION } from "./answer";
import { runTutorTurn } from "./pipeline";
import {
  classifierSaying,
  LESSON,
  MANIFEST,
  PRESSURE,
  QUESTION,
  reply,
  scriptedProvider,
  userPrompt,
} from "./test-lesson";

const fixed = {
  now: () => new Date("2026-11-03T10:00:00Z"),
  newId: () => "0192f1a0-0000-7000-8000-00000000d001",
};

describe("runTutorTurn", () => {
  it("returns a valid turn citing the lesson claims it used, with model and prompt versions", async () => {
    const { provider } = scriptedProvider([
      reply("Less air pressure lets water boil cooler.", ["f1"]),
    ]);
    const turn = await runTutorTurn(
      { provider, classify: classifierSaying(), ...fixed },
      { lesson: LESSON, question: QUESTION, history: [] },
    );
    expect(TutorTurn.parse(turn)).toEqual(turn);
    expect(turn.response.citedClaimIds).toEqual([PRESSURE.claimId]);
    expect(turn.retrievedClaimIds).toContain(PRESSURE.claimId);
    expect(turn).toMatchObject({
      modelVersion: "scripted-1@2026",
      promptVersion: TUTOR_ANSWER_PROMPT_VERSION,
      retentionClass: "session",
      safetyCategory: "none",
      createdAt: "2026-11-03T10:00:00.000Z",
    });
  });

  it("retries once after malformed output or a bad citation, then answers", async () => {
    const { provider, requests } = scriptedProvider(["not json", reply("Pressure.", ["f1"])]);
    const turn = await runTutorTurn(
      { provider, classify: classifierSaying(), ...fixed },
      { lesson: LESSON, question: QUESTION, history: [] },
    );
    expect(requests).toHaveLength(2);
    expect(turn.response.text).toBe("Pressure.");
  });

  it("falls back to a safe reply, citing nothing, when both attempts fail validation", async () => {
    const { provider } = scriptedProvider([reply("Yes.", ["f42"]), reply("", [])]);
    const turn = await runTutorTurn(
      { provider, classify: classifierSaying(), ...fixed },
      { lesson: LESSON, question: { ...QUESTION, locale: "es" }, history: [] },
    );
    expect(turn.response).toEqual({
      text: expect.stringContaining("Prueba"),
      citedClaimIds: [],
      kind: "fallback",
    });
  });

  it("never calls the model when safety answers instead", async () => {
    const { provider, requests } = scriptedProvider([]);
    const turn = await runTutorTurn(
      {
        provider,
        classify: classifierSaying({ intent: "harm", categories: ["weapons"] }),
        ...fixed,
      },
      { lesson: LESSON, question: QUESTION, history: [] },
    );
    expect(requests).toHaveLength(0);
    expect(turn.response.policy?.reason).toBe("harm");
    expect(turn.response.text).toBe(turn.response.policy?.message);
    expect(TutorTurn.parse(turn).safetyCategory).toBe("weapons");
  });

  it("throws when the provider is down, so the caller can say the tutor is unavailable", async () => {
    const provider = {
      ...scriptedProvider([]).provider,
      complete: () => Promise.reject(new Error("down")),
    };
    await expect(
      runTutorTurn(
        { provider, classify: classifierSaying(), ...fixed },
        { lesson: LESSON, question: QUESTION, history: [] },
      ),
    ).rejects.toThrow("down");
  });

  it("shows the model only this lesson's recent exchanges, inside nonce tags", async () => {
    const earlier = await runTutorTurn(
      {
        provider: scriptedProvider([reply("It heats water.", ["f1"])]).provider,
        classify: classifierSaying(),
        ...fixed,
      },
      { lesson: LESSON, question: { ...QUESTION, text: "What does the element do?" }, history: [] },
    );
    const other = {
      ...earlier,
      lessonId: "0192f1a0-0000-7000-8000-00000000a999",
      userText: "Other lesson",
    };
    const { provider, requests } = scriptedProvider([reply("Ok.", [])]);
    await runTutorTurn(
      { provider, classify: classifierSaying(), ...fixed },
      { lesson: LESSON, question: QUESTION, history: [earlier, other] },
    );
    const prompt = userPrompt(requests[0]);
    expect(prompt).toMatch(
      /<data-[a-f0-9]+>Earlier messages:\nLearner: What does the element do\?/,
    );
    expect(prompt).not.toContain("Other lesson");
  });

  it("asks for Spanish when the lesson is in Spanish", async () => {
    const { provider, requests } = scriptedProvider([reply("Sí.", [])]);
    await runTutorTurn(
      { provider, classify: classifierSaying(), ...fixed },
      { lesson: LESSON, question: { ...QUESTION, locale: "es" }, history: [] },
    );
    expect(userPrompt(requests[0])).toContain("Reply in Spanish");
  });

  it("answers beyond the lesson, uncited, when its facts don't cover the question", async () => {
    const { provider } = scriptedProvider([reply("Yes, mountains are colder at the top.", [])]);
    const turn = await runTutorTurn(
      { provider, classify: classifierSaying(), ...fixed },
      {
        lesson: LESSON,
        question: { ...QUESTION, text: "Is it colder up a mountain?" },
        history: [],
      },
    );
    expect(turn.response).toMatchObject({ kind: "beyond-lesson", citedClaimIds: [] });
  });

  it("asks one clarifying question, then answers the follow-up instead of asking again", async () => {
    const first = scriptedProvider([reply("Do you mean the kettle or the water?", [], "clarify")]);
    const asked = await runTutorTurn(
      { provider: first.provider, classify: classifierSaying(), ...fixed },
      { lesson: LESSON, question: { ...QUESTION, text: "Why does it do that?" }, history: [] },
    );
    expect(asked.response.kind).toBe("clarifying");

    const second = scriptedProvider([
      reply("Which part of the water?", [], "clarify"),
      reply("The element heats it.", ["f1"]),
    ]);
    const answered = await runTutorTurn(
      { provider: second.provider, classify: classifierSaying(), ...fixed },
      { lesson: LESSON, question: { ...QUESTION, text: "The water" }, history: [asked] },
    );
    expect(userPrompt(second.requests[0])).toContain("answer now with your best reading");
    expect(answered.response.kind).toBe("lesson");
  });

  it("gives the model no photo, only the lesson, and tells it not to describe the object", async () => {
    const { provider, requests } = scriptedProvider([
      reply("I can see it is red.", []),
      reply("The lesson doesn't say what colour it is.", []),
    ]);
    const turn = await runTutorTurn(
      { provider, classify: classifierSaying(), ...fixed },
      { lesson: LESSON, question: { ...QUESTION, text: "What colour is my kettle?" }, history: [] },
    );
    const request = requests[0];
    expect(request?.messages.every((message) => typeof message.content === "string")).toBe(true);
    expect(String(request?.messages[0]?.content)).toContain("You cannot see the learner's photo");
    expect(turn.response.text).toBe("The lesson doesn't say what colour it is.");
  });

  it("gives the safe-activity rule to every reply a child may read", async () => {
    const { provider, requests } = scriptedProvider([reply("Ok.", []), reply("Ok.", [])]);
    const deps = { provider, classify: classifierSaying(), ...fixed };
    await runTutorTurn(deps, { lesson: LESSON, question: QUESTION, history: [] });
    await runTutorTurn(deps, {
      lesson: LESSON,
      question: { ...QUESTION, audience: "adult" },
      history: [],
    });
    expect(userPrompt(requests[0])).toContain(SAFE_ACTIVITY_RULE);
    expect(userPrompt(requests[1])).not.toContain(SAFE_ACTIVITY_RULE);
  });

  it("attaches a checked visual action, and never one to a clarifying question", async () => {
    const show = { settings: [{ control: "altitude", value: 3000 }], step: null, highlight: "x" };
    const { provider, requests } = scriptedProvider([
      reply("Higher up, water boils cooler.", ["f1"], "lesson", show),
      reply("Which kettle do you mean?", [], "clarify", show),
    ]);
    const deps = { provider, classify: classifierSaying(), ...fixed };
    const answered = await runTutorTurn(deps, {
      lesson: LESSON,
      question: QUESTION,
      history: [],
      manifest: MANIFEST,
    });
    expect(userPrompt(requests[0])).toContain("Lesson visual:\nSliders: altitude");
    expect(TutorTurn.parse(answered).response.visualAction).toEqual({
      visualId: MANIFEST.visualId,
      settings: [{ controlId: "altitude", value: 3000 }],
    });
    const asked = await runTutorTurn(deps, {
      lesson: LESSON,
      question: { ...QUESTION, text: "Why?" },
      history: [],
      manifest: MANIFEST,
    });
    expect(asked.response.visualAction).toBeUndefined();
  });
});
