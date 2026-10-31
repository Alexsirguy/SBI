import { VisualManifest } from "@sbi/contracts";

/** Crank radius and connecting-rod length of the reference engine, in metres. */
export const ENGINE = { crank: 0.05, rod: 0.15 };

const engineMjcf = `<mujoco model="piston-engine">
  <option timestep="0.002" gravity="0 0 0"/>
  <default><geom rgba="0.62 0.66 0.7 1"/></default>
  <worldbody>
    <geom name="cylinderWall" type="box" pos="0 0.07 0.19" size="0.06 0.004 0.09" rgba="0.75 0.82 0.9 0.35" contype="0" conaffinity="0"/>
    <body name="crankshaft">
      <joint name="crankAngle" type="hinge" axis="0 1 0" damping="0.05"/>
      <geom name="crankDisc" type="cylinder" size="0.07 0.012" euler="90 0 0" contype="0" conaffinity="0"/>
      <body name="connectingRod" pos="0 -0.03 ${ENGINE.crank}">
        <joint name="crankPin" type="hinge" axis="0 1 0"/>
        <geom name="rod" type="capsule" fromto="0 0 0 0 0 ${ENGINE.rod}" size="0.01" rgba="0.85 0.55 0.2 1" contype="0" conaffinity="0"/>
      </body>
    </body>
    <body name="piston" pos="0 -0.03 ${ENGINE.crank + ENGINE.rod}">
      <joint name="pistonTravel" type="slide" axis="0 0 1"/>
      <geom name="pistonHead" type="cylinder" size="0.045 0.025" rgba="0.75 0.3 0.25 1" contype="0" conaffinity="0"/>
    </body>
  </worldbody>
  <equality><connect body1="connectingRod" body2="piston" anchor="0 0 ${ENGINE.rod}"/></equality>
  <actuator><motor name="throttle" joint="crankAngle" gear="1"/></actuator>
</mujoco>`;

const gearsMjcf = `<mujoco model="bicycle-gears">
  <option timestep="0.002" gravity="0 0 0"/>
  <worldbody>
    <body name="chainring" pos="-0.3 0 0">
      <joint name="pedals" type="hinge" axis="0 1 0" damping="0.05"/>
      <geom name="chainringDisc" type="cylinder" size="0.1 0.01" euler="90 0 0" rgba="0.85 0.55 0.2 1"/>
      <geom name="crankArm" type="box" pos="0 -0.02 0.08" size="0.01 0.005 0.08"/>
    </body>
    <body name="sprocket" pos="0.3 0 0">
      <joint name="wheel" type="hinge" axis="0 1 0" damping="0.01"/>
      <geom name="sprocketDisc" type="cylinder" size="0.05 0.01" euler="90 0 0" rgba="0.3 0.5 0.8 1"/>
      <geom name="spoke" type="box" pos="0 -0.02 0.04" size="0.006 0.005 0.04"/>
    </body>
  </worldbody>
  <equality><joint joint1="wheel" joint2="pedals" polycoef="0 2 0 0 0"/></equality>
  <actuator><motor name="legs" joint="pedals" gear="1"/></actuator>
</mujoco>`;

/** Load mass in kg, its distance from the pivot, and where the effort pushes, in metres. */
export const LEVER = { load: 10, loadDistance: 0.5, effortDistance: 1, g: 9.81 };

const leverMjcf = `<mujoco model="lever">
  <option timestep="0.002" gravity="0 0 -${LEVER.g}"/>
  <worldbody>
    <geom name="pivotBlock" type="box" pos="0 0 -0.06" size="0.04 0.06 0.05" rgba="0.4 0.45 0.5 1" contype="0" conaffinity="0"/>
    <body name="beam">
      <joint name="pivot" type="hinge" axis="0 1 0" damping="2" range="-25 25" limited="true"/>
      <geom name="plank" type="box" size="${LEVER.effortDistance} 0.05 0.01" mass="0.001" rgba="0.85 0.55 0.2 1"/>
      <geom name="load" type="box" pos="-${LEVER.loadDistance} 0 0.06" size="0.05 0.05 0.05" mass="${LEVER.load}" rgba="0.3 0.5 0.8 1"/>
    </body>
  </worldbody>
  <actuator><motor name="effort" joint="pivot" gear="${LEVER.effortDistance}"/></actuator>
</mujoco>`;

// The prototype's labs as MJCF, checked by hand and by the reference tests; the generator's examples.
export const REFERENCE_MECHANISMS = {
  engine: VisualManifest.parse({
    visualId: "0192f1a0-0000-7000-8000-0000000000d1",
    kind: "mechanism",
    alt: "A piston engine: the crankshaft turns as the piston slides up and down",
    fallback: {
      text: "Burning fuel pushes the piston down; the connecting rod turns the crankshaft, which turns the wheels.",
    },
    assumptions: ["One cylinder", "No friction", "Slowed down"],
    controls: [
      {
        id: "throttle",
        label: "Accelerator",
        unit: "N·m",
        min: 0.05,
        max: 0.5,
        step: 0.05,
        value: 0.2,
      },
    ],
    readouts: [
      {
        id: "speed",
        label: "Engine speed",
        unit: "rpm",
        formula: "throttle / 0.05 * 60 / (2 * pi)",
      },
    ],
    spec: { mjcf: engineMjcf, bindings: [{ control: "throttle", actuator: "throttle" }] },
  }),
  gears: VisualManifest.parse({
    visualId: "0192f1a0-0000-7000-8000-0000000000d2",
    kind: "mechanism",
    alt: "Bicycle gears: the small back sprocket turns twice for each turn of the pedals",
    fallback: {
      text: "With 44 teeth at the front and 22 at the back, the back wheel turns twice per pedal turn.",
    },
    assumptions: ["The chain never slips", "44 and 22 teeth"],
    controls: [
      { id: "push", label: "Pedal push", unit: "N·m", min: 0, max: 0.4, step: 0.05, value: 0.1 },
    ],
    readouts: [{ id: "distance", label: "Distance per pedal turn", unit: "m", formula: "2 * 2.1" }],
    spec: { mjcf: gearsMjcf, bindings: [{ control: "push", actuator: "legs" }] },
  }),
  lever: VisualManifest.parse({
    visualId: "0192f1a0-0000-7000-8000-0000000000d3",
    kind: "mechanism",
    alt: "A lever: a 10 kg load half a metre from the pivot, lifted by pushing 1 m from it",
    fallback: {
      text: "Pushing twice as far from the pivot as the load needs only half the load's weight.",
    },
    assumptions: ["A stiff, weightless bar", "No friction", "g = 9.81 m/s²"],
    controls: [
      { id: "effort", label: "Your push", unit: "N", min: 0, max: 100, step: 1, value: 60 },
    ],
    readouts: [
      { id: "needed", label: "Push needed to balance", unit: "N", formula: "10 * 9.81 * 0.5 / 1" },
    ],
    spec: { mjcf: leverMjcf, bindings: [{ control: "effort", actuator: "effort" }] },
  }),
};
