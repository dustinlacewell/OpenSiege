// The tutorial's starting world: the tutorial map with the player and one enemy already joined. Pure.
import { parseMapSpec } from "@mf/map";
import { createSimState, createWorld, spawnUnit, step, type MapSpec, type Stamped, type World } from "@mf/sim";
import tutorialFile from "../../../../../maps/tutorial/tutorial.json" with { type: "json" };

/** Base spots the map generator made flat (`packages/map/scripts/tutorial.ts`). */
export const PLAYER_BASE = { x: 1200, y: 2000 };
export const ENEMY_BASE = { x: 6000, y: 2800 };
/** The enemy's crystal field (`packages/map/scripts/tutorial.ts`). */
export const ENEMY_FIELD = { x: 5200, y: 3200 };
/** The enemy's three tanks: on its flat base, west of the factory, out of the player's sight. */
export const ENEMY_TANKS: readonly { x: number; y: number }[] = [{ x: 5650, y: 2700 }, { x: 5700, y: 2550 }, { x: 5800, y: 2420 }];

const YOU = 1;
const ENEMY = 2;

/**
 * Tick 1 of the tutorial: both players joined, on different teams. `you` is the local player's id, `enemy` the scripted one's.
 * The player has only the factory. The enemy has its factory, a harvester on its field and three tanks.
 */
export function tutorialWorld(): { world: World; you: number; enemy: number } {
  const state = createSimState(createWorld(tutorialSpec()));
  step(state, joins());
  const world = state.world;
  removeHarvesters(world);
  spawnUnit(world, ENEMY, "harvester", ENEMY_FIELD.x, ENEMY_FIELD.y);
  for (const t of ENEMY_TANKS) spawnUnit(world, ENEMY, "tank", t.x, t.y);
  return { world, you: YOU, enemy: ENEMY };
}

/** The map file, checked like any other map. A bad file is a bug in the repo, so it throws. */
function tutorialSpec(): MapSpec {
  const parsed = parseMapSpec(JSON.stringify(tutorialFile));
  if ("errors" in parsed) throw new Error(`maps/tutorial/tutorial.json: ${parsed.errors.join("; ")}`);
  return parsed.spec;
}

function joins(): Stamped[] {
  return [
    { player: YOU, intent: { t: "join", name: "You", ...PLAYER_BASE, team: 0 } },
    { player: ENEMY, intent: { t: "join", name: "Enemy", ...ENEMY_BASE, team: 1 } },
  ];
}

/** The joins' starting harvesters. The player builds its own; the enemy's goes back on its field. */
function removeHarvesters(world: World): void {
  world.units = world.units.filter((u) => u.kind !== "harvester");
}
