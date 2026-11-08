import { UNIT_KINDS } from "@mf/sim";
import { setSrc } from "../../ui/dom.ts";
import { loadHeadshots } from "./headshots.ts";
import { unitLabel } from "./unitRules.ts";

/**
 * Fills each unit column's header slot with a kind-letter tile under the unit's headshot. The headshot arrives
 * after the first draw; without WebGL2 the letter stays.
 */
export function showPortraits(slotOf: (column: string) => HTMLElement): void {
  const images = new Map<string, HTMLImageElement>();
  for (const kind of UNIT_KINDS) {
    const letter = document.createElement("span");
    letter.textContent = unitLabel(kind).charAt(0);
    const img = document.createElement("img");
    img.alt = "";
    slotOf(kind).append(letter, img);
    images.set(kind, img);
  }
  loadHeadshots((kind, url) => {
    const img = images.get(kind);
    if (img) setSrc(img, url);
  });
}
