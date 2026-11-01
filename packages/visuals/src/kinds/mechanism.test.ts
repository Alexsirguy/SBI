import loadMujoco, { type MainModule } from "@mujoco/mujoco";
import { VisualManifest } from "@sbi/contracts";
import { beforeAll, describe, expect, it } from "vitest";
import { ENGINE, LEVER, REFERENCE_MECHANISMS } from "../references";
import { applyControls, loadMechanism, physicsProblems } from "./mechanism-sim";
import { mjcfTextProblems } from "./mechanism-spec";

let mujoco: MainModule;
beforeAll(async () => {
  mujoco = await loadMujoco();
});

function run(manifest: VisualManifest, values: Record<string, number>, seconds: number) {
  const loaded = loadMechanism(mujoco, manifest);
  if ("problems" in loaded) throw new Error(loaded.problems.join());
  applyControls(loaded, values);
  const steps = Math.round(seconds / loaded.model.opt.timestep);
  for (let step = 0; step < steps; step += 1) mujoco.mj_step(loaded.model, loaded.data);
  const joint = (name: string) => {
    for (let index = 0; index < loaded.model.njnt; index += 1) {
      if (loaded.model.jnt(index)?.name === name) {
        const address = loaded.model.jnt_qposadr[index] as number;
        return {
          qpos: loaded.data.qpos[address] as number,
          qvel: loaded.data.qvel[loaded.model.jnt_dofadr[index] as number] as number,
        };
      }
    }
    throw new Error(`no joint ${name}`);
  };
  return { joint, dispose: loaded.dispose };
}

describe("reference mechanisms", () => {
  it.each(Object.entries(REFERENCE_MECHANISMS))(
    "%s passes the physics check",
    (_name, manifest) => {
      expect(physicsProblems(mujoco, manifest)).toEqual([]);
    },
  );

  it("gears: the back wheel turns twice for each turn of the pedals", () => {
    const sim = run(REFERENCE_MECHANISMS.gears, { push: 0.2 }, 2);
    const pedals = sim.joint("pedals").qpos;
    expect(Math.abs(pedals)).toBeGreaterThan(1);
    expect(sim.joint("wheel").qpos / pedals).toBeCloseTo(2, 2);
    sim.dispose();
  });

  it("lever: balances when push × its distance equals load weight × its distance", () => {
    const balance = (LEVER.load * LEVER.g * LEVER.loadDistance) / LEVER.effortDistance;
    const still = run(REFERENCE_MECHANISMS.lever, { effort: balance }, 1);
    expect(Math.abs(still.joint("pivot").qpos)).toBeLessThan(0.01);
    still.dispose();
    const more = run(REFERENCE_MECHANISMS.lever, { effort: balance + 15 }, 0.3);
    expect(more.joint("pivot").qpos).toBeGreaterThan(0.05);
    more.dispose();
    const less = run(REFERENCE_MECHANISMS.lever, { effort: balance - 15 }, 0.3);
    expect(less.joint("pivot").qpos).toBeLessThan(-0.05);
    less.dispose();
  });

  it("engine: the piston follows the slider-crank law as the crank turns", () => {
    const sim = run(REFERENCE_MECHANISMS.engine, { throttle: 0.2 }, 1.3);
    const angle = sim.joint("crankAngle").qpos;
    expect(Math.abs(angle)).toBeGreaterThan(Math.PI);
    const { crank: r, rod: l } = ENGINE;
    const expected = r * Math.cos(angle) + Math.sqrt(l * l - (r * Math.sin(angle)) ** 2) - (r + l);
    expect(sim.joint("pistonTravel").qpos).toBeCloseTo(expected, 2);
    sim.dispose();
  });
});

describe("mechanism checks", () => {
  const base = REFERENCE_MECHANISMS.lever;

  it.each([
    ['<mujoco><include file="other.xml"/></mujoco>', /remove <include>/],
    ['<mujoco><asset><mesh name="m" file="m.stl"/></asset></mujoco>', /file= attributes/],
    ["<robot/>", /start with <mujoco>/],
  ])("refuses %s before MuJoCo reads it", (mjcf, message) => {
    expect(mjcfTextProblems(mjcf).join()).toMatch(message);
  });

  it("sends back a piston that is not joined to its crank", () => {
    const loose = `<mujoco><worldbody>
      <body name="crankshaft"><joint name="crankSpin" type="hinge"/><geom type="cylinder" size=".05 .01"/></body>
      <body name="piston"><joint name="pistonSlide" type="slide"/><geom type="cylinder" size=".04 .02"/></body>
    </worldbody></mujoco>`;
    expect(mjcfTextProblems(loose).join()).toMatch(/piston is not joined to the crank/);
    const pump = loose.replace(/crank(shaft|Spin)/g, "handle$1");
    expect(mjcfTextProblems(pump)).toEqual([]);
    const engine = (REFERENCE_MECHANISMS.engine.spec as { mjcf: string }).mjcf;
    expect(mjcfTextProblems(engine)).toEqual([]);
  });

  it("refuses a joint range that leaves out where the body starts", () => {
    const engine = (REFERENCE_MECHANISMS.engine.spec as { mjcf: string }).mjcf;
    const mjcf = engine.replace(
      'name="pistonTravel" type="slide"',
      'name="pistonTravel" type="slide" range="0.1 0.28"',
    );
    const ranged = { ...REFERENCE_MECHANISMS.engine, spec: { mjcf } };
    expect(physicsProblems(mujoco, ranged).join()).toMatch(
      /"pistonTravel" has range 0.1 0.28, which leaves out 0/,
    );
  });

  it("refuses a part that turns too fast to follow", () => {
    const engine = REFERENCE_MECHANISMS.engine;
    const mjcf = (engine.spec as { mjcf: string }).mjcf.replace(
      'joint="crankAngle" gear="1"',
      'joint="crankAngle" gear="20"',
    );
    const fast = { ...engine, spec: { ...(engine.spec as object), mjcf } };
    expect(physicsProblems(mujoco, fast).join()).toMatch(
      /"crankAngle" turns \d+ times a second .* at most 10 times a second/,
    );
  });

  it("passes MuJoCo's own error back", () => {
    const broken = {
      ...base,
      spec: { mjcf: "<mujoco><worldbody><geom type='bogus'/></worldbody></mujoco>" },
    };
    expect(physicsProblems(mujoco, broken).join()).toMatch(
      /MuJoCo could not read the model: .*bogus/,
    );
  });

  it("refuses bindings to unknown actuators or sliders", () => {
    const spec = { ...(base.spec as object), bindings: [{ control: "speed", actuator: "rocket" }] };
    const problems = physicsProblems(mujoco, { ...base, spec });
    expect(problems).toContain('binding names unknown control "speed"');
    expect(problems).toContain('binding names unknown actuator "rocket"');
  });

  it("refuses a model where nothing moves", () => {
    const still = VisualManifest.parse({
      ...base,
      controls: [],
      readouts: [],
      spec: {
        mjcf: '<mujoco><option gravity="0 0 0"/><worldbody><body><joint type="hinge"/><geom type="box" size=".1 .1 .1"/></body></worldbody></mujoco>',
      },
    });
    expect(physicsProblems(mujoco, still).join()).toMatch(/nothing moves/);
  });

  it("refuses a model that blows up", () => {
    const wild = VisualManifest.parse({
      ...base,
      controls: [],
      readouts: [],
      spec: {
        mjcf: '<mujoco><option gravity="0 0 0" timestep="0.5"/><worldbody><body><freejoint/><geom type="sphere" size=".01" mass="0.0001"/></body></worldbody><actuator><motor joint="" gear="1e9"/></actuator></mujoco>',
      },
    });
    expect(physicsProblems(mujoco, wild).length).toBeGreaterThan(0);
  });
});
