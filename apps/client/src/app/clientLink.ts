import { hashWorld, step, type World } from "@mf/sim";
import type { MatchMsg } from "@mf/protocol";
import type { Camera } from "../game/camera.ts";
import type { Placement } from "../game/placement.ts";
import type { Session } from "../game/session.ts";
import { NO_GUIDE, type Guide, type GuideSlot } from "../game/tutorial/guide.ts";
import type { TutorialView } from "../game/tutorial/runner.ts";
import { handleMatch, type ScreenEvents } from "../match/handler.ts";
import type { Screens } from "../ui/screens.ts";
import type { EndKind, MatchHost, MatchLink } from "./matchHost.ts";

export interface ClientLinkParts {
  host: MatchHost;
  session: Session;
  cam: Camera;
  /** The one guide input, HUD and loop ask. */
  guide: GuideSlot;
  screens: Screens;
  now(): number;
}

/** The client's side of the seam: what a host may drive. */
export class ClientLink implements MatchLink {
  private endKind: EndKind = "match";
  private guided = false;
  private placement: Placement | null = null;

  constructor(private readonly p: ClientLinkParts) {}

  /** True while a guide runs. Auto-siege is off then: it sends past the guide. */
  get tutoring(): boolean {
    return this.guided;
  }

  /** A click on the ground in the choose-your-start phase. */
  pick(x: number, y: number): void {
    this.placement?.onPick(x, y);
  }

  deliver(msg: MatchMsg): void {
    const { host, session, cam, now } = this.p;
    handleMatch(msg, session, {
      lockstep: { step, hash: hashWorld, onHash: (tick, hash) => host.checkpoint?.(tick, hash) },
      screens: this.screenEvents(),
      cam,
      now,
      restart: () => host.desync(),
    });
  }

  world(): World | null {
    return this.p.session.world;
  }

  paused(): boolean {
    return this.p.guide.paused();
  }

  /** Null until the camera is home, so the jump home does not count as the player's pan. */
  view(): TutorialView | null {
    const { session, cam } = this.p;
    if (!session.world || !session.homed) return null;
    return { world: session.world, me: session.me, selected: session.selected, camera: { x: cam.x, y: cam.y, yaw: cam.yaw } };
  }

  guide(guide: Guide | null): void {
    this.guided = guide !== null;
    this.p.guide.set(guide ?? NO_GUIDE);
  }

  sandbox(on: boolean): void {
    this.p.session.sandbox = on;
  }

  endCard(kind: EndKind): void {
    this.endKind = kind;
  }

  place(placement: Placement | null): void {
    if (placement) {
      this.placement = placement;
      this.p.session.startPick(placement.you, placement.world);
      this.p.screens.picking(placement);
    } else {
      this.placement = null;
      if (this.p.session.pickWorld) this.stop();
    }
  }

  stop(): void {
    this.placement = null;
    this.p.session.stop();
    this.guide(null);
    this.endKind = "match";
    this.p.screens.idle();
  }

  /** The tutorial's end is a thank-you card, not a victory. */
  private screenEvents(): ScreenEvents {
    const { screens } = this.p;
    return {
      match: () => screens.match(),
      ended: (winners) => (this.endKind === "tutorial" ? screens.tutorialEnded() : screens.ended(winners)),
    };
  }
}
