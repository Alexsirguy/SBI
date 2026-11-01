import { describe, expect, it } from "vitest";
import { activityReason, findUnsafeActivities, safeActivityRulesApply } from "./activities";

const hazardsIn = (text: string) => findUnsafeActivities(text).map((finding) => finding.hazard);

describe("findUnsafeActivities", () => {
  it.each([
    ["Mix a few cleaning products in a cup and watch them fizz.", "unknown-substance"],
    ["Sniff the unlabelled bottle to guess what is inside.", "unknown-substance"],
    ["Touch the powder you found in the shed.", undefined],
  ])("flags unknown substances: %s", (text, hazard) => {
    if (hazard) expect(hazardsIn(text)).toEqual([hazard]);
    else expect(hazardsIn(text)).toEqual([]);
  });

  it.each([
    "Unscrew the plug and look at the wires inside.",
    "Take the back off an old toaster to find the heating coil.",
    "Poke a paperclip into the socket to see what happens.",
  ])("flags mains devices: %s", (text) => {
    expect(hazardsIn(text)).toEqual(["mains-device"]);
  });

  it.each([
    "Taste the berries on the hedge to see if they are sweet.",
    "Eat a leaf from the garden and notice how bitter it is.",
    "Lick the crystals once they form.",
  ])("flags ingestion: %s", (text) => {
    expect(hazardsIn(text)).toEqual(["ingestion"]);
  });

  it.each([
    "Pick up a bee gently and look at its wings.",
    "Feed the wild birds by hand.",
    "Get close to the jellyfish on the beach and look at its tentacles.",
  ])("flags wildlife: %s", (text) => {
    expect(hazardsIn(text)).toEqual(["wildlife"]);
  });

  it.each([
    "Light a candle and watch the flame flicker.",
    "Put foil in the microwave and watch the sparks.",
    "Connect both ends of a battery with a wire.",
  ])("flags hazardous experiments: %s", (text) => {
    expect(hazardsIn(text)).toEqual(["hazardous-experiment"]);
  });

  it.each([
    "Next time the kettle clicks off, listen for the change in sound.",
    "Watch a bee visit a flower from a few steps away.",
    "Never touch a wild mushroom; just notice its shape.",
    "Don't open a charger: mains electricity can kill.",
    "Taste a slice of lemon and notice how sour it is.",
    "Ask an adult to light a candle, then watch the flame from a safe distance.",
    "Imagine taking apart a toaster: what would you expect to find?",
    "Notice how a candle burns down over an evening.",
  ])("leaves safe activities alone: %s", (text) => {
    expect(hazardsIn(text)).toEqual([]);
  });

  it("finds each unsafe sentence in a longer passage, with the sentence quoted", () => {
    const findings = findUnsafeActivities(
      "Look at your kettle. Unscrew the kettle's base to see the element! Then taste the mixture.",
    );
    expect(findings).toEqual([
      { hazard: "mains-device", sentence: "Unscrew the kettle's base to see the element!" },
      { hazard: "ingestion", sentence: "Then taste the mixture." },
    ]);
  });

  it("explains a finding so a rewrite can act on it", () => {
    const [finding] = findUnsafeActivities("Pick up a wasp and look at its sting.");
    expect(finding && activityReason(finding)).toMatch(
      /^Asks the learner to touch, feed or approach a wild animal: "Pick up a wasp and look at its sting\."/,
    );
  });
});

describe("safeActivityRulesApply", () => {
  it("holds for every audience a child may be in, and not for adults alone", () => {
    expect(safeActivityRulesApply(["child"])).toBe(true);
    expect(safeActivityRulesApply(["general"])).toBe(true);
    expect(safeActivityRulesApply(["teen", "adult"])).toBe(true);
    expect(safeActivityRulesApply(["adult"])).toBe(false);
  });
});
