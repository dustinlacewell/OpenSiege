import { blob, type BlobSpec } from "./meshBlob.ts";
import { MeshBuilder } from "./meshBuilder.ts";
import { PART } from "./propMaterials.ts";

/** Rock and boulder models: 1 wide (the radius) and 1 tall, the foot sunk a little so they sit in the ground. */

function lumps(...specs: BlobSpec[]): Float32Array {
  const b = new MeshBuilder();
  for (const s of specs) blob(b, s);
  return b.build();
}

/** A craggy dome. */
export function rockDome(): Float32Array {
  return lumps({ at: [0, 0, 0.45], radii: [1, 0.9, 0.55], jitter: 0.3, seed: 21, level: 1, part: PART.rockCool, cut: -0.85 });
}

/** A tall narrow spire with a stone at its foot. */
export function rockSpire(): Float32Array {
  return lumps(
    { at: [0, 0, 0.45], radii: [0.55, 0.5, 0.55], jitter: 0.35, seed: 22, level: 1, part: PART.rockWarm, cut: -0.85 },
    { at: [0.65, 0.2, 0.2], radii: [0.4, 0.35, 0.25], jitter: 0.3, seed: 23, level: 0, part: PART.rockWarm, cut: -0.6 },
  );
}

/** A wide slab with a block on top. */
export function rockSlab(): Float32Array {
  return lumps(
    { at: [0, 0, 0.3], radii: [1, 0.8, 0.35], jitter: 0.25, seed: 24, level: 1, part: PART.rockCool, cut: -0.8 },
    { at: [-0.3, 0.1, 0.55], radii: [0.55, 0.5, 0.45], jitter: 0.3, seed: 25, level: 0, part: PART.rockWarm },
  );
}

/** Three stones leaning together. */
export function rockCluster(): Float32Array {
  return lumps(
    { at: [-0.4, 0.1, 0.4], radii: [0.6, 0.55, 0.55], jitter: 0.3, seed: 26, level: 0, part: PART.rockWarm, cut: -0.8 },
    { at: [0.45, -0.2, 0.32], radii: [0.55, 0.55, 0.42], jitter: 0.3, seed: 27, level: 0, part: PART.rockCool, cut: -0.8 },
    { at: [0.05, 0.5, 0.25], radii: [0.4, 0.4, 0.3], jitter: 0.3, seed: 28, level: 0, part: PART.rockCool, cut: -0.6 },
  );
}

/** A smooth round stone. */
export function boulderRound(): Float32Array {
  return lumps({ at: [0, 0, 0.5], radii: [1, 0.95, 0.55], jitter: 0.1, seed: 31, level: 1, part: PART.boulder, cut: -0.85 });
}

/** A low, long stone. */
export function boulderLow(): Float32Array {
  return lumps({ at: [0, 0, 0.45], radii: [1, 0.8, 0.5], jitter: 0.15, seed: 32, level: 1, part: PART.boulder, cut: -0.85 });
}

/** A big stone and a small one. */
export function boulderPair(): Float32Array {
  return lumps(
    { at: [-0.3, 0, 0.45], radii: [0.7, 0.65, 0.5], jitter: 0.15, seed: 33, level: 0, part: PART.boulder, cut: -0.8 },
    { at: [0.5, 0.1, 0.3], radii: [0.5, 0.5, 0.3], jitter: 0.15, seed: 34, level: 0, part: PART.boulder, cut: -0.6 },
  );
}

/** A mossy stone. */
export function boulderMossy(): Float32Array {
  return lumps({ at: [0, 0, 0.5], radii: [0.9, 1, 0.6], jitter: 0.2, seed: 35, level: 1, part: PART.boulderMoss, cut: -0.85 });
}
