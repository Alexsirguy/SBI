import { canonicalJson, sha256Hex, VisualAsset } from "@sbi/contracts";
import { createRightsRegister } from "@sbi/rights";
import { describe, expect, it } from "vitest";
import { compileFormula } from "./formula";
import { graphRows, planGraph } from "./kinds/graph-spec";
import { HEATING, REFERENCE_VISUALS, referenceAssets } from "./references";
import { manifestProblems } from "./server";

describe("reference visuals", () => {
  it.each(Object.entries(REFERENCE_VISUALS))(
    "%s passes its kind's checks",
    async (_name, manifest) => {
      expect(await manifestProblems(manifest)).toEqual([]);
    },
  );

  it("each has a complete rights record that clears and matches its spec", async () => {
    const assets = await referenceAssets();
    const byId = new Map(assets.map((asset) => [asset.assetId, asset]));
    const register = createRightsRegister({
      assets: { get: async (id) => byId.get(id) },
      manifests: { get: async () => undefined },
      today: () => "2026-10-31",
    });
    for (const manifest of Object.values(REFERENCE_VISUALS)) {
      const [assetId] = manifest.assetIds;
      const asset = VisualAsset.parse(byId.get(assetId ?? ""));
      expect(asset.format).toBe(manifest.kind);
      expect(asset.accessibilityFallback).toBe(manifest.fallback.text);
      expect(await register.checkAsset(asset.assetId)).toEqual({ cleared: true });
      expect(asset.sha256).toBe(await sha256Hex(canonicalJson(manifest.spec)));
    }
  });
});

describe("heating reference", () => {
  const manifest = REFERENCE_VISUALS.heating;
  const plan = planGraph(manifest);
  if ("problems" in plan) throw new Error(plan.problems.join());
  const readout = (id: string, values: Record<string, number>) => {
    const formula = manifest.readouts.find((item) => item.id === id)?.formula ?? "";
    const compiled = compileFormula(formula, ["power", "mass", "height"]);
    if ("error" in compiled) throw new Error(compiled.error);
    return compiled.evaluate(values);
  };

  it("takes m·c·ΔT / P to reach the boil: 1 kg from 20 °C at 2 kW is about 168 s", () => {
    const values = { power: 2000, mass: 1, height: 0 };
    expect(readout("timeToBoil", values)).toBeCloseTo((1 * HEATING.capacity * 80) / 2000, 6);
    const rows = graphRows(plan, values);
    const at = rows.find((row) => row.x >= 160 && row.x <= 170);
    expect(at?.y).toBeCloseTo(20 + (2000 * (at?.x ?? 0)) / HEATING.capacity, 6);
  });

  it("stays flat at the boiling point, which is lower higher up", () => {
    for (const height of [0, 3]) {
      const values = { power: 2000, mass: 1, height };
      const plateau = HEATING.boil - HEATING.perKm * height;
      expect(readout("boilsAt", values)).toBeCloseTo(plateau, 6);
      expect(graphRows(plan, values).at(-1)?.y).toBeCloseTo(plateau, 6);
    }
  });
});
