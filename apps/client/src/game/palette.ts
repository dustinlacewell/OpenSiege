/** Twelve player colours, indexed by Player.color. */
const HEX = [
  "#4fa3ff", "#ff5a5a", "#5ee07a", "#ffc93c", "#c77dff", "#3de0d6",
  "#ff8a3d", "#ff6fb5", "#a8e05e", "#8a9bff", "#e0e0e0", "#b08560",
];

const RGB: readonly (readonly [number, number, number])[] = HEX.map(hexToRgb);

export function colorCss(color: number): string {
  return HEX[wrap(color)]!;
}

export function colorRgb(color: number): readonly [number, number, number] {
  return RGB[wrap(color)]!;
}

function wrap(color: number): number {
  return ((color % HEX.length) + HEX.length) % HEX.length;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
