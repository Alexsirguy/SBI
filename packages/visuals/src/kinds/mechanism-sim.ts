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
