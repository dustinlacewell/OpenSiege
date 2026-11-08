import { blob } from "./meshBlob.ts";
import { MeshBuilder } from "./meshBuilder.ts";
import { PART, type PropPart } from "./propMaterials.ts";

/** Ground cover kinds. The number is the index into `SCATTER_MESHES`. */
export const TUFT = 0;
export const DRY_TUFT = 1;
export const PEBBLES = 2;
export const BUSH = 3;

const BLADES = 7;
/** Radians between blades around the tuft: spreads them without a visible pattern. */
const GOLDEN = 2.4;
/** How far a blade's tip leans outward, as a fraction of its height. */
const LEAN = 0.35;
/** Radius of a blade at its foot, in model units. */
const BLADE_WIDTH = 0.16;

/** A fan of thin cones, 1 wide and 1 tall, the first upright and the rest leaning outward. */
function tuft(part: PropPart): Float32Array {
  const b = new MeshBuilder();
  for (let k = 0; k < BLADES; k++) {
    const a = k * GOLDEN;
    const reach = k === 0 ? 0 : 0.2 + 0.07 * k;
    const height = k === 0 ? 1 : 0.55 + 0.12 * (k % 4);
    const dx = Math.cos(a), dy = Math.sin(a);
    const lean = LEAN * height;
    b.cone([dx * reach, dy * reach, 0], [dx * (reach + lean), dy * (reach + lean), height], BLADE_WIDTH, 0, 3, PART[part]);
  }
  return b.build();
}

/** Three small stones. The height scale flattens them. */
function pebbles(): Float32Array {
  const b = new MeshBuilder();
  blob(b, { at: [-0.35, 0.1, 0.4], radii: [0.5, 0.4, 0.45], jitter: 0.25, seed: 41, level: 0, part: PART.pebble, cut: -0.7 });
  blob(b, { at: [0.4, -0.2, 0.35], radii: [0.4, 0.38, 0.4], jitter: 0.25, seed: 42, level: 0, part: PART.pebble, cut: -0.7 });
  blob(b, { at: [0.05, 0.55, 0.3], radii: [0.28, 0.25, 0.3], jitter: 0.25, seed: 43, level: 0, part: PART.pebble, cut: -0.7 });
  return b.build();
}

/** Three leafy lumps. */
function bush(): Float32Array {
  const b = new MeshBuilder();
  blob(b, { at: [0, 0, 0.45], radii: [1, 0.95, 0.45], jitter: 0.2, seed: 44, level: 0, part: PART.bush, cut: -0.8 });
  blob(b, { at: [0.5, 0.3, 0.6], radii: [0.6, 0.6, 0.4], jitter: 0.2, seed: 45, level: 0, part: PART.bushLight });
  blob(b, { at: [-0.45, -0.3, 0.55], radii: [0.6, 0.6, 0.4], jitter: 0.2, seed: 46, level: 0, part: PART.bush });
  return b.build();
}

export const SCATTER_MESHES: readonly (() => Float32Array)[] = [
  () => tuft("grass"),
  () => tuft("dryGrass"),
  pebbles,
  bush,
];
