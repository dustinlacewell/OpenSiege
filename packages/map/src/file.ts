import { TERRAIN_MAX_HEIGHT, validateMapSpec, type MapSpec } from "@mf/sim";
import { propsErrors } from "./props.ts";
import { MATERIAL_CHANNELS, type EditorMap, type MapProps, type Palette } from "./types.ts";

const VERSION = 1;
const CHUNK = 0x8000;

/** Compact JSON text of the whole map. Key order is fixed. */
export function serializeMap(m: EditorMap): string {
  return JSON.stringify({
    version: VERSION, name: m.name, baseHeight: m.baseHeight, spec: m.spec, materials: toBase64(m.materials.weights), palette: m.palette,
  });
}

/** Parse a map file. Never throws. */
export function parseMap(json: string): { map: EditorMap } | { errors: string[] } {
  const root = parseRoot(json);
  if ("errors" in root) return root;
  const { name, baseHeight, spec, materials, palette } = root.value;
  if (typeof name !== "string" || name.trim() === "") return { errors: ["name is missing"] };
  if (!Number.isInteger(baseHeight) || (baseHeight as number) < 0 || (baseHeight as number) > TERRAIN_MAX_HEIGHT) {
    return { errors: [`baseHeight is not an integer in 0..${TERRAIN_MAX_HEIGHT}`] };
  }
  const specErrors = specProblems(spec);
  if (specErrors.length > 0) return { errors: specErrors };
  const s = spec as MapSpec;
  const weights = typeof materials === "string" ? fromBase64(materials) : null;
  const need = (s.width / s.cell + 1) * (s.height / s.cell + 1) * MATERIAL_CHANNELS;
  if (!weights) return { errors: ["materials is not valid base64"] };
  if (weights.length !== need) return { errors: [`materials has ${weights.length} bytes, need ${need}`] };
  const paletteErrors = paletteProblems(palette);
  if (paletteErrors.length > 0) return { errors: paletteErrors };
  return { map: { name, baseHeight: baseHeight as number, spec: s, materials: { weights }, palette: palette as Palette } };
}

/** Parse only the sim spec. Ignores materials and palette. Never throws. */
export function parseMapSpec(json: string): { spec: MapSpec } | { errors: string[] } {
  const root = parseRoot(json);
  if ("errors" in root) return root;
  const errors = specProblems(root.value.spec);
  return errors.length > 0 ? { errors } : { spec: root.value.spec as MapSpec };
}

/** A flat map at the base height: no fields, no features, all weight on channel 0. Throws on bad props. */
export function emptyMap(p: MapProps): EditorMap {
  const errors = propsErrors(p);
  if (errors.length > 0) throw new Error(`emptyMap: ${errors.join("; ")}`);
  const { width, height, cell } = p;
  const count = (width / cell + 1) * (height / cell + 1);
  const weights = new Uint8Array(count * MATERIAL_CHANNELS);
  for (let v = 0; v < count; v++) weights[v * MATERIAL_CHANNELS] = 255;
  const spec: MapSpec = { width, height, cell, heights: new Array<number>(count).fill(p.baseHeight), rng: 1, fields: [], features: [] };
  return { name: p.name, baseHeight: p.baseHeight, spec, materials: { weights }, palette: defaultPalette() };
}

function defaultPalette(): Palette {
  return [
    { name: "grass", color: [86, 130, 62] },
    { name: "dirt", color: [121, 92, 62] },
    { name: "rock", color: [128, 128, 128] },
    { name: "sand", color: [214, 195, 140] },
  ];
}

type Root = Record<string, unknown>;

function parseRoot(json: string): { value: Root } | { errors: string[] } {
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return { errors: ["not valid JSON"] };
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return { errors: ["file is not an object"] };
  const root = v as Root;
  if (root.version !== VERSION) return { errors: [`version is not ${VERSION}`] };
  return { value: root };
}

function specProblems(spec: unknown): string[] {
  if (typeof spec !== "object" || spec === null) return ["spec is missing"];
  const s = spec as Partial<MapSpec>;
  if (!Array.isArray(s.heights) || !Array.isArray(s.fields) || !Array.isArray(s.features) || typeof s.rng !== "number") {
    return ["spec is malformed"];
  }
  return validateMapSpec(s as MapSpec);
}

function paletteProblems(p: unknown): string[] {
  if (!Array.isArray(p) || p.length !== 4) return ["palette needs 4 entries"];
  const bad = p.some((e) => typeof e?.name !== "string" || !Array.isArray(e.color) || e.color.length !== 3 || !e.color.every(isByte));
  return bad ? ["a palette entry needs a name and 3 ints 0..255"] : [];
}

function isByte(n: unknown): boolean {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255;
}

function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  return btoa(parts.join(""));
}

function fromBase64(text: string): Uint8Array | null {
  try {
    const bin = atob(text);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
