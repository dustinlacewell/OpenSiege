import { UNIT_KINDS, type UnitKind } from "@mf/sim";
import { colorRgb } from "../../game/palette.ts";
import { Renderer } from "../../render/renderer.ts";

const POLL_MS = 100;
const GIVE_UP_MS = 10_000;

/**
 * The game's own unit headshots, drawn by a renderer on a canvas that is never shown. The images are
 * encoded a little later, so this polls and reports each url once. Does nothing if WebGL2 is missing.
 */
export function loadHeadshots(onUrl: (kind: UnitKind, url: string) => void): void {
  let portraits: Renderer["portraits"];
  try {
    portraits = new Renderer(document.createElement("canvas")).portraits;
    portraits.update(colorRgb(0));
  } catch {
    return;
  }
  const waiting = new Set<UnitKind>(UNIT_KINDS);
  const started = performance.now();
  const timer = setInterval(() => {
    for (const kind of [...waiting]) {
      const url = portraits.url(kind);
      if (url === "") continue;
      waiting.delete(kind);
      onUrl(kind, url);
    }
    if (waiting.size === 0 || performance.now() - started > GIVE_UP_MS) clearInterval(timer);
  }, POLL_MS);
}
