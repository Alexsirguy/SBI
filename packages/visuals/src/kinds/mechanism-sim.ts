import type { VisualManifest } from "@sbi/contracts";
import type { MainModule, MjData, MjModel } from "@mujoco/mujoco";
import { MECHANISM_LIMITS, MechanismSpec, mjcfTextProblems } from "./mechanism-spec";

export interface LoadedMechanism {
  model: MjModel;
  data: MjData;
  /** Actuator index for each bound slider id. */
  actuators: Map<string, number>;
  dispose(): void;
}

export function readMechanismSpec(
  manifest: VisualManifest,
): MechanismSpec | { problems: string[] } {
  const parsed = MechanismSpec.safeParse(manifest.spec);
  if (!parsed.success) {
    return {
      problems: parsed.error.issues.map(
        (issue) => `spec.${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }
  const problems = mjcfTextProblems(parsed.data.mjcf);
  return problems.length > 0 ? { problems } : parsed.data;
}

/** Builds the model and its state, or explains in MuJoCo's own words why it can't. */
export function loadMechanism(
  mujoco: MainModule,
  manifest: VisualManifest,
): LoadedMechanism | { problems: string[] } {
  const spec = readMechanismSpec(manifest);
  if ("problems" in spec) return spec;
  let model: MjModel;
  try {
    model = mujoco.MjModel.from_xml_string(spec.mjcf);
  } catch (error) {
    return {
      problems: [
        `MuJoCo could not read the model: ${String((error as Error)?.message ?? error).trim()}`,
      ],
    };
  }
  const problems: string[] = [];
  if (model.nbody - 1 > MECHANISM_LIMITS.bodies)
    problems.push(`use at most ${MECHANISM_LIMITS.bodies} bodies`);
  if (model.ngeom > MECHANISM_LIMITS.geoms)
    problems.push(`use at most ${MECHANISM_LIMITS.geoms} geoms`);
  if (model.nu > MECHANISM_LIMITS.actuators)
    problems.push(`use at most ${MECHANISM_LIMITS.actuators} actuators`);
  const actuators = new Map<string, number>();
  const controls = new Set(manifest.controls.map((control) => control.id));
  for (const binding of spec.bindings) {
    if (!controls.has(binding.control))
      problems.push(`binding names unknown control "${binding.control}"`);
    const index = actuatorIndex(model, binding.actuator);
    if (index < 0) problems.push(`binding names unknown actuator "${binding.actuator}"`);
    else actuators.set(binding.control, index);
  }
  problems.push(...rangeProblems(model));
  if (problems.length > 0) {
    model.delete();
    return { problems };
  }
  const data = new mujoco.MjData(model);
  return {
    model,
    data,
    actuators,
    dispose() {
      data.delete();
      model.delete();
    },
  };
}

const SLIDE = 2;
const HINGE = 3;

// MuJoCo measures a joint's range from where its body starts, so a range missing 0 fights the joint from the start.
function rangeProblems(model: MjModel): string[] {
  const problems: string[] = [];
  for (let index = 0; index < model.njnt; index += 1) {
    const type = model.jnt_type[index] as number;
    if ((type !== SLIDE && type !== HINGE) || !model.jnt_limited[index]) continue;
    const low = model.jnt_range[2 * index] as number;
    const high = model.jnt_range[2 * index + 1] as number;
    if (low > 0 || high < 0) {
      problems.push(
        `joint "${model.jnt(index)?.name ?? index}" has range ${low} ${high}, which leaves out 0: a range is measured from where the body starts, so include 0 or remove the range`,
      );
    }
  }
  return problems;
}

function actuatorIndex(model: MjModel, name: string): number {
  for (let index = 0; index < model.nu; index += 1) {
    if (model.actuator(index)?.name === name) return index;
  }
  return -1;
}

export function applyControls(loaded: LoadedMechanism, values: Record<string, number>): void {
  for (const [control, index] of loaded.actuators) {
    const value = values[control];
    if (value !== undefined) loaded.data.ctrl[index] = value;
  }
}

// MuJoCo's typings declare its typed-array views as any.
function numbers(view: unknown): number[] {
  return Array.from(view as ArrayLike<number>);
}

// Bounds in metres: anything this far away has flown off, which a stable model never does.
const MAX_DISTANCE = 100;
const RUN_SECONDS = 2;
// The picture runs in real time, and a part turning faster than this is a blur the learner cannot follow.
const MAX_TURNS_PER_SECOND = 10;

/** Runs the model for two seconds at each slider's start and ends: it must stay finite and bounded. */
export function physicsProblems(mujoco: MainModule, manifest: VisualManifest): string[] {
  const base = Object.fromEntries(manifest.controls.map((control) => [control.id, control.value]));
  const cases = [
    base,
    ...manifest.controls.flatMap((control) => [
      { ...base, [control.id]: control.min },
      { ...base, [control.id]: control.max },
    ]),
  ];
  let moved = false;
  for (const values of cases) {
    const loaded = loadMechanism(mujoco, manifest);
    if ("problems" in loaded) return loaded.problems;
    try {
      applyControls(loaded, values);
      const start = numbers(loaded.data.qpos);
      const steps = Math.ceil(RUN_SECONDS / loaded.model.opt.timestep);
      for (let step = 0; step < steps; step += 1) mujoco.mj_step(loaded.model, loaded.data);
      const positions = numbers(loaded.data.geom_xpos);
      const qpos = numbers(loaded.data.qpos);
      if (![...qpos, ...positions].every(Number.isFinite)) {
        return [
          `the simulation became unstable at ${JSON.stringify(values)}; lower forces or add damping`,
        ];
      }
      if (positions.some((value) => Math.abs(value) > MAX_DISTANCE)) {
        return [`a part flew more than ${MAX_DISTANCE} m away at ${JSON.stringify(values)}`];
      }
      const fastest = fastestTurn(loaded.model, numbers(loaded.data.qvel));
      if (fastest && fastest.turns > MAX_TURNS_PER_SECOND) {
        return [
          `joint "${fastest.name}" turns ${fastest.turns.toFixed(0)} times a second at ${JSON.stringify(values)}; scale the motor's gear down so every part turns at most ${MAX_TURNS_PER_SECOND} times a second at each slider's ends`,
        ];
      }
      if (values === base) {
        moved = qpos.some((value, index) => Math.abs(value - (start[index] ?? 0)) > 1e-3);
      }
    } finally {
      loaded.dispose();
    }
  }
  return moved
    ? []
    : [
        "nothing moves at the starting slider values; add an actuator with a non-zero control or a joint gravity can move",
      ];
}

function fastestTurn(model: MjModel, qvel: number[]): { name: string; turns: number } | undefined {
  let fastest: { name: string; turns: number } | undefined;
  for (let index = 0; index < model.njnt; index += 1) {
    if (model.jnt_type[index] !== HINGE) continue;
    const turns = Math.abs(qvel[model.jnt_dofadr[index] as number] ?? 0) / (2 * Math.PI);
    if (!fastest || turns > fastest.turns) {
      fastest = { name: model.jnt(index)?.name || `joint ${index}`, turns };
    }
  }
  return fastest;
}
