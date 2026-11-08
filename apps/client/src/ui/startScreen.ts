import type { MapDraw } from "@mf/map";
import type { StorageSlot } from "../settings/settingsStore.ts";
import { setHidden } from "./dom.ts";
import { SkirmishView, type SkirmishHandlers } from "./skirmish/skirmishView.ts";

/** What the start screen's buttons do. */
export interface StartHandlers extends SkirmishHandlers {
  /** Dev builds only: start a local two-side sandbox match. */
  onSandbox(): void;
}

/** What the start screen needs from the page: the maps to choose from and where the player's name is kept. */
export interface StartDeps {
  draws: readonly MapDraw[];
  nameSlot: StorageSlot;
}

const DEV_LINKS = [
  { href: "/units.html", label: "unit stats" },
  { href: "/map-editor.html", label: "map editor" },
  { href: "/sounds.html", label: "sounds" },
] as const;

/** The start screen, plain DOM over the backdrop: the title, the skirmish setup card and, in dev builds, the dev strip. */
export class StartScreen {
  constructor(private readonly root: HTMLElement, deps: StartDeps, h: StartHandlers) {
    root.replaceChildren(masthead(), new SkirmishView(deps.draws, deps.nameSlot, h).root, ...(import.meta.env.DEV ? [devStrip(h.onSandbox)] : []));
  }

  show(): void {
    setHidden(this.root, false);
  }

  hide(): void {
    setHidden(this.root, true);
  }
}

function masthead(): HTMLElement {
  const head = document.createElement("header");
  head.className = "masthead";
  const title = document.createElement("h1");
  title.className = "title";
  const accent = document.createElement("span");
  accent.textContent = "Siege";
  title.append("Open", accent);
  head.append(title);
  return head;
}

/** One muted strip in the corner: the sandbox and the editors. */
function devStrip(onSandbox: () => void): HTMLElement {
  const strip = document.createElement("nav");
  strip.className = "dev-strip";
  strip.setAttribute("aria-label", "Dev tools");
  const label = document.createElement("span");
  label.textContent = "dev";
  strip.append(label, sandboxButton(onSandbox), ...DEV_LINKS.map(devLink));
  return strip;
}

function sandboxButton(onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = "sandbox";
  b.addEventListener("click", onClick);
  return b;
}

function devLink(link: { href: string; label: string }): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = link.href;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = link.label;
  return a;
}
