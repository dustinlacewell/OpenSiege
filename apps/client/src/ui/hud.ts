import type { Terrain, VertexBox } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import { groupOf } from "../game/controlGroups.ts";
import type { Session } from "../game/session.ts";
import { NO_GUIDE, type Guide } from "../game/tutorial/guide.ts";
import type { Vision } from "../game/vision.ts";
import type { Actions } from "../input/actions.ts";
import { CommandCard } from "./commandCard.ts";
import { byId, setText } from "./dom.ts";
import { GuidePanel } from "./guidePanel.ts";
import { Leaderboard } from "./leaderboard.ts";
import { Minimap } from "./minimap.ts";
import { hudModel } from "./model.ts";
import { EliminatedBanner } from "./overlays.ts";
import type { Portraits } from "./portraits.ts";
import { UnitPanel } from "./unitPanel.ts";

const HUD_MS = 200;
const MINIMAP_MS = 100;

/** DOM HUD. Called every frame; refreshes at a low rate and writes only changed values. */
export class Hud {
  private readonly credits = byId("credits");
  private readonly units = byId("units");
  private readonly unitPanel: UnitPanel;
  private readonly commandCard: CommandCard;
  private readonly leaderboard: Leaderboard;
  private readonly minimap: Minimap;
  private readonly eliminated = new EliminatedBanner();
  private readonly guidePanel: GuidePanel;
  private hudAt = -Infinity;
  private minimapAt = -Infinity;

  /** `vision` decides which enemies the minimap shows. `guide` locks and points at controls; `NO_GUIDE` outside a tutorial. */
  constructor(
    private readonly session: Session,
    private readonly cam: Camera,
    actions: Actions,
    portraits: Portraits,
    vision: Vision,
    private readonly guide: Guide = NO_GUIDE,
  ) {
    this.leaderboard = new Leaderboard(actions.viewPlayer);
    this.unitPanel = new UnitPanel(actions, portraits);
    this.commandCard = new CommandCard(actions, portraits);
    this.minimap = new Minimap(byId<HTMLCanvasElement>("minimap"), actions, vision);
    this.guidePanel = new GuidePanel(() => actions.acknowledge());
  }

  update(now: number): void {
    if (now - this.minimapAt >= MINIMAP_MS) {
      this.minimapAt = now;
      this.minimap.draw(this.session.world, this.cam);
    }
    if (now - this.hudAt >= HUD_MS) {
      this.hudAt = now;
      this.refresh();
    }
  }

  /** The heights in this vertex box changed in place: the minimap's ground image follows. */
  refreshTerrain(terrain: Terrain, box: VertexBox): void {
    this.minimap.refresh(terrain, box);
  }

  private refresh(): void {
    const world = this.session.world;
    if (!world) return this.eliminated.update(false);
    const s = this.session;
    const m = hudModel(world, {
      me: s.me, self: s.self, selected: s.selected, page: s.buildPage, targetMode: s.targetMode, groupOf: (id) => groupOf(s.groups, id),
      guide: this.guide, guideView: this.guide.view(),
    });
    setText(this.credits, String(m.credits));
    setText(this.units, String(m.unitCount));
    this.unitPanel.update(m);
    this.commandCard.update(m);
    this.leaderboard.update(m.leaders, m.watching || this.session.sandbox);
    this.eliminated.update(m.dead);
    this.guidePanel.update(m.guide);
  }
}
