// The DOM pieces of the skirmish setup card. Each builds its elements once; the card redraws them.
import { choiceLabel, TEAM_CHOICES } from "../teamModel.ts";

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

export function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = node("button", className, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/** A map tile (the parts `MapTileView` fills) with an arrow on each side. A click on the tile steps forward. */
export function mapFrame(onStep: (by: 1 | -1) => void): HTMLElement {
  const frame = node("div", "map-frame");
  frame.id = "skirmish-map";
  const preview = node("img", "map-preview");
  preview.alt = "";
  const arrow = (label: string, title: string, by: 1 | -1) => {
    const b = button(label, `map-step ${by === 1 ? "next" : "prev"}`, () => onStep(by));
    b.title = title;
    b.addEventListener("click", (e) => e.stopPropagation());
    return b;
  };
  frame.append(preview, node("span", "map-random", "?"), node("span", "map-name"), arrow("‹", "Previous map", -1), arrow("›", "Next map", 1));
  frame.addEventListener("click", () => onStep(1));
  return frame;
}

/** The team-count selector. Its buttons are in `TEAM_CHOICES` order. */
export function teamChoice(onPick: (teams: number) => void): HTMLElement {
  const group = node("div", "segmented");
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", "Teams");
  group.append(...TEAM_CHOICES.map((teams) => button(choiceLabel(teams), "", () => onPick(teams))));
  return group;
}

/** A labelled checkbox. */
export function checkbox(label: string, onChange: (on: boolean) => void): { root: HTMLElement; input: HTMLInputElement } {
  const root = node("label", "check");
  const input = node("input");
  input.type = "checkbox";
  input.addEventListener("change", () => onChange(input.checked));
  root.append(input, node("span", "", label));
  return { root, input };
}
