import { setHidden, setSrc, setText } from "./dom.ts";
import type { MapTile } from "./mapTile.ts";

/** A map tile on the page: a `.map-preview` image, a `.map-random` mark and a `.map-name` chip inside `root`. */
export class MapTileView {
  private readonly preview: HTMLImageElement;
  private readonly random: HTMLElement;
  private readonly name: HTMLElement;

  constructor(root: HTMLElement) {
    this.preview = part<HTMLImageElement>(root, ".map-preview");
    this.random = part(root, ".map-random");
    this.name = part(root, ".map-name");
  }

  /** The preview image, or the "?" mark in a tile of the same size; the name in a chip at the top left. */
  draw(tile: MapTile): void {
    setSrc(this.preview, tile.kind === "preview" ? tile.url : "");
    setHidden(this.preview, tile.kind !== "preview");
    setHidden(this.random, tile.kind === "preview");
    setText(this.name, tile.kind === "random" ? "Random map" : tile.name);
  }
}

function part<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`missing ${selector} in #${root.id}`);
  return el;
}
