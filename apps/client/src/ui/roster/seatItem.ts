import type { SeatView } from "./model.ts";

/** What a seat row's buttons do. A button shows only when its handler is set. */
export interface SeatActions {
  remove: ((id: number) => void) | null;
  /** Step the bot to the next difficulty. */
  cycle: ((id: number) => void) | null;
}

export function seatItem(seat: SeatView, actions: SeatActions): HTMLLIElement {
  return seat.kind === "player" ? playerItem(seat) : botItem(seat, actions);
}

function botItem(bot: Extract<SeatView, { kind: "bot" }>, actions: SeatActions): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "bot";
  const name = document.createElement("span");
  name.textContent = bot.name;
  const right = document.createElement("span");
  right.append(levelLabel(bot, actions.cycle));
  if (actions.remove) {
    const remove = actions.remove;
    const x = document.createElement("button");
    x.type = "button";
    x.className = "bot-remove";
    x.textContent = "×";
    x.title = "Remove bot";
    x.addEventListener("click", () => remove(bot.id));
    right.append(x);
  }
  li.append(name, right);
  return li;
}

/** The difficulty text; a button that cycles it when the player may. */
function levelLabel(bot: Extract<SeatView, { kind: "bot" }>, cycle: ((id: number) => void) | null): HTMLElement {
  const level = document.createElement(cycle ? "button" : "span");
  level.className = "bot-level";
  level.textContent = bot.difficulty;
  if (cycle && level instanceof HTMLButtonElement) {
    level.type = "button";
    level.title = "Change difficulty";
    level.addEventListener("click", () => cycle(bot.id));
  }
  return level;
}

function playerItem(seat: Extract<SeatView, { kind: "player" }>): HTMLLIElement {
  const li = document.createElement("li");
  const name = document.createElement("span");
  name.textContent = seat.name;
  if (seat.tag !== "") name.append(tag("seat-tag", seat.tag));
  li.append(name, tag("seat-note", seat.note));
  li.className = seat.me ? "me" : "";
  return li;
}

function tag(className: string, text: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}
