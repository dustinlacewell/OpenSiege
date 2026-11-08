import { colorCss } from "../../game/palette.ts";
import type { SectionView } from "./model.ts";
import { seatItem, type SeatActions } from "./seatItem.ts";

/** What the roster's buttons do. A button shows only when its handler is set. */
export interface RosterActions extends SeatActions {
  /** Add a bot; `team` is the section's team, null in a free-for-all. */
  addBot: ((team: number | null) => void) | null;
  /** Move the local player to a team. */
  join: (team: number) => void;
}

/** One roster block: the team header (a button when the player may join), the seats, and "+ Bot". */
export function sectionItem(section: SectionView, actions: RosterActions): HTMLElement {
  const el = document.createElement("section");
  el.className = "team";
  const list = document.createElement("ul");
  list.className = "seats";
  list.append(...section.seats.map((s) => seatItem(s, actions)));
  el.append(...(section.team === null ? [] : [header(section, section.team, actions)]), list);
  const addBot = actions.addBot;
  if (addBot) el.append(botButton(!section.canAddBot, () => addBot(section.team)));
  return el;
}

/** The team name in the team colour and its seat count. A button only when the player may join. */
function header(section: SectionView, team: number, actions: RosterActions): HTMLElement {
  const head = document.createElement(section.canJoin ? "button" : "div");
  head.className = "team-head";
  if (section.color !== null) head.style.color = colorCss(section.color);
  const name = document.createElement("span");
  name.textContent = section.name;
  const count = document.createElement("span");
  count.className = "team-count";
  count.textContent = section.count;
  head.append(name, count);
  if (head instanceof HTMLButtonElement) {
    head.type = "button";
    head.title = "Join team";
    head.addEventListener("click", () => actions.join(team));
  }
  return head;
}

function botButton(disabled: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "add-bot";
  b.textContent = "+ Bot";
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}
