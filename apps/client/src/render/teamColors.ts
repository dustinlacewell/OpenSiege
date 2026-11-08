import type { Player } from "@mf/sim";
import { playerById } from "../game/lookup.ts";
import { colorRgb } from "../game/palette.ts";

const NEUTRAL_RGB = [0.6, 0.6, 0.6] as const;

/** Owner id → player colour for this frame's players. */
export class TeamColors {
  private players: readonly Player[] = [];

  use(players: readonly Player[]): void {
    this.players = players;
  }

  of(owner: number): readonly number[] {
    const p = playerById(this.players, owner);
    return p ? colorRgb(p.color) : NEUTRAL_RGB;
  }
}
