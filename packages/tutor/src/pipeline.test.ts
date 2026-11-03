import { TutorTurn } from "@sbi/contracts";
import { describe, expect, it } from "vitest";
import { TUTOR_ANSWER_PROMPT_VERSION } from "./answer";
import { runTutorTurn } from "./pipeline";
import {
  classifierSaying,
  LESSON,
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
    expect(turn.response).toEqual({ text: expect.stringContaining("Prueba"), citedClaimIds: [] });
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
});
