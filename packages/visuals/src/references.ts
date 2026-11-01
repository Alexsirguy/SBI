import { canonicalJson, sha256Hex, VisualManifest, type VisualAsset } from "@sbi/contracts";
import { projectOutputAsset } from "@sbi/rights";

/** Crank radius and connecting-rod length of the reference engine, in metres. */
export const ENGINE = { crank: 0.05, rod: 0.15 };

const engineMjcf = `<mujoco model="piston-engine">
  <option timestep="0.002" gravity="0 0 0"/>
  <default><geom rgba="0.62 0.66 0.7 1"/></default>
  <worldbody>
    <geom name="cylinder" type="cylinder" pos="0 -0.03 ${ENGINE.rod + 0.01}" size="0.052 0.08" rgba="0.75 0.82 0.9 0.25" contype="0" conaffinity="0"/>
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
    assetIds: ["2ea12299-6698-4b2c-9e20-16ff55f2f441"],
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
    assetIds: ["4a786b4b-4478-4c32-9d8f-3af65e5d5289"],
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
    assetIds: ["80fd1a5f-c024-41c6-96a5-aa5264b3c250"],
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

/** Water's heat capacity and the fall in boiling point per kilometre of height used by the heating reference. */
export const HEATING = { capacity: 4190, start: 20, boil: 100, perKm: 3.3 };

const heating = VisualManifest.parse({
  visualId: "0192f1a0-0000-7000-8000-0000000000d4",
  assetIds: ["70a893b3-4a2e-4d6b-a7da-2ce4d32e08a7"],
  kind: "graph",
  alt: "Water temperature in a kettle over time, flattening at the boiling point",
  fallback: {
    text: "The water warms steadily, then stays at its boiling point, which is lower high up a mountain.",
  },
  assumptions: [
    "No heat lost",
    "Starts at 20 °C",
    "Boiling point falls about 3.3 °C per km of height",
  ],
  controls: [
    { id: "power", label: "Heater power", unit: "W", min: 500, max: 3000, step: 100, value: 2000 },
    { id: "mass", label: "Water", unit: "kg", min: 0.2, max: 1.7, step: 0.1, value: 1 },
    {
      id: "height",
      label: "Height above the sea",
      unit: "km",
      min: 0,
      max: 5,
      step: 0.5,
      value: 0,
    },
  ],
  readouts: [
    {
      id: "boilsAt",
      label: "Boils at",
      unit: "°C",
      formula: `${HEATING.boil} - ${HEATING.perKm} * height`,
    },
    {
      id: "timeToBoil",
      label: "Time to start boiling",
      unit: "s",
      formula: `mass * ${HEATING.capacity} * (${HEATING.boil} - ${HEATING.perKm} * height - ${HEATING.start}) / power`,
    },
  ],
  spec: {
    x: { name: "t", label: "Time", unit: "s", from: 0, to: 600, samples: 61 },
    series: [
      {
        name: "temperature",
        label: "Temperature",
        unit: "°C",
        formula: `min(${HEATING.start} + power * t / (mass * ${HEATING.capacity}), ${HEATING.boil} - ${HEATING.perKm} * height)`,
      },
    ],
    vegaLite: { mark: "line" },
  },
});

/** The prototype's four labs, checked by hand: the generator's examples and the regression set (#87). */
export const REFERENCE_VISUALS = { ...REFERENCE_MECHANISMS, heating };

/** Rights records for the references: our own work, with checksums of their specs. */
export async function referenceAssets(): Promise<VisualAsset[]> {
  return Promise.all(
    Object.values(REFERENCE_VISUALS).map(async (manifest) => {
      const body = canonicalJson(manifest.spec ?? null);
      return {
        ...projectOutputAsset({
          assetId: manifest.assetIds[0] ?? "",
          kind: manifest.kind === "mechanism" ? "simulation" : "data",
          format: manifest.kind,
          sha256: await sha256Hex(body),
          sizeBytes: new TextEncoder().encode(body).length,
          accessibilityFallback: manifest.fallback.text,
        }),
        creator: "Science Behind It (hand-checked reference)",
        attribution: "Made by Science Behind It from the prototype's labs",
        // Hand-checked once; a yearly review keeps them honest as the renderers change.
        reviewDueOn: "2027-10-31",
      };
    }),
  );
}
