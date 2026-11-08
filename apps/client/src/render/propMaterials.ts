/** What a static prop vertex can be made of. A vertex's `part` is an index into this table. */
export interface PropMaterial {
  /** Base colour, sRGB. */
  rgb: readonly [number, number, number];
  /** How much darker the model is at its foot than at its top, 0..1. */
  gradient: number;
  /** How much each flat face differs in brightness from its neighbours, 0..1. */
  facet: number;
  /** Sun highlight strength. */
  spec: number;
}

const TABLE = {
  bark: { rgb: [0.29, 0.2, 0.13], gradient: 0.3, facet: 0, spec: 0 },
  needleDark: { rgb: [0.09, 0.24, 0.12], gradient: 0.4, facet: 0, spec: 0 },
  needle: { rgb: [0.15, 0.34, 0.15], gradient: 0.4, facet: 0, spec: 0 },
  leaf: { rgb: [0.22, 0.4, 0.12], gradient: 0.35, facet: 0.1, spec: 0 },
  leafLight: { rgb: [0.34, 0.5, 0.16], gradient: 0.3, facet: 0.1, spec: 0 },
  leafWarm: { rgb: [0.46, 0.46, 0.14], gradient: 0.3, facet: 0.1, spec: 0 },
  rockCool: { rgb: [0.46, 0.45, 0.44], gradient: 0.35, facet: 0.22, spec: 0.12 },
  rockWarm: { rgb: [0.5, 0.43, 0.35], gradient: 0.35, facet: 0.22, spec: 0.12 },
  boulder: { rgb: [0.42, 0.4, 0.37], gradient: 0.3, facet: 0.15, spec: 0.08 },
  boulderMoss: { rgb: [0.38, 0.42, 0.3], gradient: 0.3, facet: 0.15, spec: 0.06 },
  pebble: { rgb: [0.56, 0.52, 0.46], gradient: 0.15, facet: 0.18, spec: 0.08 },
  grass: { rgb: [0.3, 0.46, 0.15], gradient: 0.6, facet: 0, spec: 0 },
  dryGrass: { rgb: [0.58, 0.52, 0.26], gradient: 0.55, facet: 0, spec: 0 },
  bush: { rgb: [0.2, 0.36, 0.12], gradient: 0.4, facet: 0.08, spec: 0 },
  bushLight: { rgb: [0.28, 0.44, 0.14], gradient: 0.4, facet: 0.08, spec: 0 },
  scrapRust: { rgb: [0.4, 0.25, 0.15], gradient: 0.35, facet: 0.2, spec: 0.1 },
  scrapScorched: { rgb: [0.14, 0.12, 0.11], gradient: 0.3, facet: 0.15, spec: 0.12 },
  scrapSteel: { rgb: [0.5, 0.49, 0.47], gradient: 0.25, facet: 0.2, spec: 0.35 },
  soot: { rgb: [0.07, 0.065, 0.06], gradient: 0.25, facet: 0.15, spec: 0.03 },
  ember: { rgb: [0.24, 0.15, 0.1], gradient: 0.3, facet: 0.2, spec: 0.04 },
} as const satisfies Record<string, PropMaterial>;

export type PropPart = keyof typeof TABLE;

const NAMES = Object.keys(TABLE) as PropPart[];

/** Part id of each material, in table order. */
export const PART = Object.fromEntries(NAMES.map((name, i) => [name, i])) as Record<PropPart, number>;

const f = (n: number) => n.toFixed(3);

/** GLSL constants `MAT_COLOR` (rgb, gradient) and `MAT_FX` (facet, spec), indexed by part. */
export const MATERIAL_GLSL = `
const vec4 MAT_COLOR[${NAMES.length}] = vec4[${NAMES.length}](${NAMES.map((n) => {
  const m: PropMaterial = TABLE[n];
  return `vec4(${f(m.rgb[0])}, ${f(m.rgb[1])}, ${f(m.rgb[2])}, ${f(m.gradient)})`;
}).join(", ")});
const vec2 MAT_FX[${NAMES.length}] = vec2[${NAMES.length}](${NAMES.map((n) => `vec2(${f(TABLE[n].facet)}, ${f(TABLE[n].spec)})`).join(", ")});
`;
