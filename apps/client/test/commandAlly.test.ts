import assert from "node:assert/strict";
import { test } from "node:test";
import type { Intent, Player, Unit } from "@mf/sim";
import type { Camera } from "../src/game/camera.ts";
import type { Session } from "../src/game/session.ts";
import type { Vision } from "../src/game/vision.ts";
import { commandActions } from "../src/input/actions/command.ts";
import { actionContext, type ActionContext } from "../src/input/actions/context.ts";

const player = (id: number, team: number): Player => ({ id, name: `p${id}`, color: 0, credits: 0, alive: true, connected: true, team });
const unit = (id: number, owner: number): Unit => ({ id, owner, kind: "tank" }) as Unit;

/** Right-click on `target` with unit 10 selected. Player 1 is me, 2 is on my team, 3 is not. */
function rightClick(target: Unit): Intent[] {
  const world = { players: [player(1, 1), player(2, 1), player(3, 2)], features: [], terrain: { cols: 2, rows: 2, cell: 100, heights: [0, 0, 0, 0], seaLevel: -1 } };
  const session = { me: 1, world, selected: [10] } as unknown as Session;
  const sent: Intent[] = [];
  const base = actionContext(session, {} as Camera, {} as Vision, (i) => sent.push(i));
  const ctx: ActionContext = {
    ...base,
    groundPoint: () => [50, 60, 0] as never,
    pickAt: (_sx, _sy, accept) => (accept(target) ? target : undefined),
  };
  commandActions(ctx).command(0, 0, { force: false, queue: false }, false);
  return sent;
}

test("right-click on an enemy unit attacks it", () => {
  const sent = rightClick(unit(30, 3));
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.t, "attack");
});

test("right-click on an ally unit moves instead of attacking", () => {
  const sent = rightClick(unit(20, 2));
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.t, "move");
});

test("right-click on an own unit moves", () => {
  const sent = rightClick(unit(11, 1));
  assert.equal(sent[0]!.t, "move");
});
