import type { Palette } from "@mf/map";
import type { MapFeatureKind } from "@mf/sim";
import { setText } from "../../ui/dom.ts";
import { button, el } from "../build.ts";
import { RANGES, type Channel, type FeatureMode, type FieldMode, type NumberSetting, type Settings } from "./settings.ts";

export interface PanelHandlers {
  onChange(patch: Partial<Settings>): void;
  onColor(channel: Channel, color: [number, number, number]): void;
}

interface Choice {
  node: HTMLButtonElement;
  on(s: Settings): boolean;
}

interface Slider {
  key: NumberSetting;
  input: HTMLInputElement;
  value: HTMLSpanElement;
}

interface Swatch {
  chip: HTMLSpanElement;
  color: HTMLInputElement;
}

const HEIGHT_TOOLS = [["raise", "Raise"], ["lower", "Lower"], ["smooth", "Smooth"], ["flatten", "Flatten"], ["noise", "Noise"]] as const;
const KINDS: readonly [MapFeatureKind, string][] = [["tree", "Tree"], ["rock", "Rock"], ["boulder", "Boulder"]];
const FEATURE_MODES: readonly [FeatureMode, string][] = [["place", "Place"], ["scatter", "Scatter"], ["erase", "Erase"]];
const FIELD_MODES: readonly [FieldMode, string][] = [["place", "Place zone"], ["erase", "Erase zones"]];
const SYMMETRY_MODES: readonly [boolean, string][] = [[false, "Rotate"], [true, "Mirror"]];
const SLIDERS: readonly [NumberSetting, string][] = [
  ["radius", "Radius"], ["strength", "Strength"], ["falloff", "Falloff"], ["density", "Density"],
  ["fieldRadius", "Zone radius"], ["fieldAmount", "Zone amount"],
];
const CHANNELS: readonly Channel[] = [0, 1, 2, 3];

/** The left panel: height tools, the four materials with their colours, feature and zone tools, and the brush sliders. */
export class ToolPanelView {
  private readonly choices: Choice[] = [];
  private readonly sliders: Slider[] = [];
  private readonly swatches: Swatch[] = [];

  constructor(root: HTMLElement, private readonly h: PanelHandlers) {
    root.append(
      this.section("Height", HEIGHT_TOOLS.map(([tool, label]) => this.choice(label, { tool }, (s) => s.tool === tool))),
      this.section("Paint", CHANNELS.map((k) => this.swatch(k))),
      this.section("Features", [
        ...KINDS.map(([kind, label]) => this.choice(label, { tool: "feature", featureKind: kind }, (s) => s.tool === "feature" && s.featureKind === kind)),
        el("span", "break"),
        ...FEATURE_MODES.map(([mode, label]) => this.choice(label, { tool: "feature", featureMode: mode }, (s) => s.tool === "feature" && s.featureMode === mode)),
      ]),
      this.section("Resource zones", FIELD_MODES.map(([mode, label]) => this.choice(label, { tool: "field", fieldMode: mode }, (s) => s.tool === "field" && s.fieldMode === mode))),
      this.section("Brush", SLIDERS.map(([key, label]) => this.slider(key, label))),
      this.section("Symmetry", [
        ...SYMMETRY_MODES.map(([mirror, label]) => this.choice(label, { mirror }, (s) => s.mirror === mirror)),
        this.slider("symmetry", "Copies"),
      ]),
    );
  }

  update(s: Settings): void {
    for (const c of this.choices) c.node.classList.toggle("on", c.on(s));
    for (const sl of this.sliders) {
      const v = s[sl.key];
      if (document.activeElement !== sl.input) sl.input.value = String(v);
      setText(sl.value, shown(v, RANGES[sl.key].step));
    }
  }

  /** Swatch chips and colour inputs follow the map's palette. */
  setPalette(p: Palette): void {
    this.swatches.forEach((sw, k) => {
      const hex = toHex(p[k]!.color);
      sw.chip.style.background = hex;
      if (document.activeElement !== sw.color) sw.color.value = hex;
    });
  }

  private section(title: string, items: HTMLElement[]): HTMLElement {
    const box = el("section", "group");
    const row = el("div", "items");
    row.append(...items);
    box.append(el("h2", "", title), row);
    return box;
  }

  private choice(label: string, patch: Partial<Settings>, on: (s: Settings) => boolean): HTMLButtonElement {
    const node = button(label, "tool", () => this.h.onChange(patch));
    this.choices.push({ node, on });
    return node;
  }

  private swatch(k: Channel): HTMLElement {
    const wrap = el("div", "swatch");
    const node = this.choice(`${k + 1}`, { tool: "paint", channel: k }, (s) => s.tool === "paint" && s.channel === k);
    node.title = `Paint material ${k + 1} (key ${k + 1})`;
    const chip = el("span", "chip");
    node.prepend(chip);
    const color = el("input");
    color.type = "color";
    color.title = `Colour of material ${k + 1}`;
    color.addEventListener("input", () => this.h.onColor(k, fromHex(color.value)));
    this.swatches.push({ chip, color });
    wrap.append(node, color);
    return wrap;
  }

  private slider(key: NumberSetting, label: string): HTMLElement {
    const r = RANGES[key];
    const row = el("label", "slider");
    const input = el("input");
    input.type = "range";
    input.min = String(r.min);
    input.max = String(r.max);
    input.step = String(r.step);
    input.addEventListener("input", () => this.h.onChange({ [key]: Number(input.value) }));
    const value = el("span", "value");
    this.sliders.push({ key, input, value });
    row.append(el("span", "name", label), input, value);
    return row;
  }
}

/** A value at its slider's precision: the wheel leaves values between steps. */
function shown(v: number, step: number): string {
  return step >= 1 ? String(Math.round(v)) : v.toFixed(2);
}

function toHex(c: readonly [number, number, number]): string {
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function fromHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
