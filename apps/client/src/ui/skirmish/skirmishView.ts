import type { MapDraw } from "@mf/map";
import type { SkirmishSetup } from "../../game/skirmish/plan.ts";
import type { StorageSlot } from "../../settings/settingsStore.ts";
import { setDisabled, setText } from "../dom.ts";
import { mapTile } from "../mapTile.ts";
import { MapTileView } from "../mapTileView.ts";
import { sectionItem, type RosterActions } from "../roster/sectionItem.ts";
import { TEAM_CHOICES } from "../teamModel.ts";
import {
  addBot, cycleBot, initialSkirmish, joinTeam, NAME_MAX, problem, removeBot, setAuto, setName, setTeams, stepMap, toPlan,
  type SkirmishState,
} from "./skirmishModel.ts";
import { skirmishSections } from "./skirmishSections.ts";
import { button, checkbox, mapFrame, node, teamChoice } from "./skirmishParts.ts";
import "./skirmish.css";

/** What the card's buttons do. */
export interface SkirmishHandlers {
  /** Play was pressed with a playable setup. */
  onPlay(setup: SkirmishSetup): void;
  onTutorial(): void;
}

/** The skirmish setup card: the map, the teams, who sits where, the player's name, Play and Tutorial. */
export class SkirmishView {
  readonly root = node("div", "panel");
  private state: SkirmishState;
  private readonly ids: readonly (string | null)[];
  private readonly tile: MapTileView;
  private readonly teams: HTMLElement;
  private readonly roster = node("div", "roster");
  private readonly note = node("div", "note");
  private readonly play = node("button", "primary", "Play");
  private readonly auto = checkbox("Auto start spot", (on) => this.apply(setAuto(this.state, on)));
  private readonly name = node("input");

  constructor(private readonly draws: readonly MapDraw[], private readonly nameSlot: StorageSlot, private readonly h: SkirmishHandlers) {
    this.state = initialSkirmish(nameSlot.get() ?? "");
    this.ids = draws.map((d) => d.info?.id ?? null);
    this.root.id = "skirmish";
    const map = mapFrame((by) => this.apply(stepMap(this.state, this.ids, by)));
    this.tile = new MapTileView(map);
    this.teams = teamChoice((teams) => this.apply(setTeams(this.state, teams)));
    this.root.replaceChildren(this.side(map), this.main());
    this.draw();
  }

  private side(map: HTMLElement): HTMLElement {
    const side = node("section", "side");
    side.append(map, node("h2", "", "Teams"), this.teams);
    return side;
  }

  private main(): HTMLElement {
    const main = node("section", "main");
    this.name.maxLength = NAME_MAX;
    this.name.placeholder = "Your name";
    this.name.value = this.state.name;
    this.name.autocomplete = "off";
    this.name.spellcheck = false;
    this.name.setAttribute("aria-label", "Your name");
    this.name.addEventListener("input", () => this.apply(setName(this.state, this.name.value)));
    this.name.addEventListener("change", () => this.nameSlot.set(this.state.name));
    this.name.addEventListener("keydown", (e) => e.key === "Enter" && this.name.blur());
    this.play.type = "button";
    this.play.addEventListener("click", () => this.start());
    const foot = node("div", "foot");
    foot.append(this.name, this.auto.root);
    const actions = node("div", "actions");
    actions.append(this.play, button("Tutorial", "", this.h.onTutorial));
    main.append(this.roster, this.note, foot, actions);
    return main;
  }

  private start(): void {
    const draw = this.draws.find((d) => (d.info?.id ?? null) === this.state.mapId) ?? this.draws[0];
    if (!draw || problem(this.state) !== null) return;
    this.nameSlot.set(this.state.name);
    this.h.onPlay({ draw, plan: toPlan(this.state), auto: this.state.auto });
  }

  private apply(next: SkirmishState): void {
    this.state = next;
    this.draw();
  }

  private draw(): void {
    const s = this.state;
    const draw = this.draws.find((d) => (d.info?.id ?? null) === s.mapId);
    this.tile.draw(mapTile(draw?.info ?? null));
    [...this.teams.children].forEach((b, i) => b.classList.toggle("on", TEAM_CHOICES[i] === s.teams));
    this.roster.replaceChildren(...skirmishSections(s).map((section) => sectionItem(section, this.actions())));
    this.auto.input.checked = s.auto;
    setText(this.note, problem(s) ?? "");
    setDisabled(this.play, problem(s) !== null);
  }

  private actions(): RosterActions {
    return {
      addBot: (team) => this.apply(addBot(this.state, team)),
      join: (team) => this.apply(joinTeam(this.state, team)),
      remove: (id) => this.apply(removeBot(this.state, id)),
      cycle: (id) => this.apply(cycleBot(this.state, id)),
    };
  }
}
