import { colorCss } from "../game/palette.ts";
import { byId } from "./dom.ts";
import type { LeaderRow } from "./leaderModel.ts";

/** Top players by total unit cost. Rebuilds the list only when a row changed. A watcher can click a row to take that player's view. */
export class Leaderboard {
  private readonly list = byId("lb-list");
  private last = "";

  constructor(private readonly onView: (id: number) => void) {}

  update(rows: readonly LeaderRow[], clickable: boolean): void {
    const key = JSON.stringify([rows, clickable]);
    if (key === this.last) return;
    this.last = key;
    this.list.replaceChildren(...rows.map((r) => rowElement(r, clickable ? this.onView : null)));
  }
}

function rowElement(row: LeaderRow, onView: ((id: number) => void) | null): HTMLElement {
  const li = document.createElement("li");
  const name = document.createElement("span");
  name.textContent = row.name;
  name.style.color = colorCss(row.color);
  const numbers = [row.credits, row.factories, row.harvesters, row.power].map((n) => {
    const cell = document.createElement("span");
    cell.textContent = String(n);
    return cell;
  });
  li.append(name, ...numbers);
  const classes = [row.me ? "me" : "", onView ? "view" : ""].filter(Boolean);
  li.className = classes.join(" ");
  if (onView) li.addEventListener("click", () => onView(row.id));
  return li;
}
