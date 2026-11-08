import { test } from "node:test";
import assert from "node:assert/strict";
import { UNIT_STATS, createSimState, heightAt, spawnUnit, step, type Intent, type SimState, type Stamped, type UnitKind } from "@mf/sim";
import { areaReclaim } from "../src/game/commands.ts";
import { detectedOthers, otherIds, ownOfKind, reclaimDrag, scrapNear } from "../src/game/tutorial/checks.ts";
import { tutorialEnemy } from "../src/game/tutorial/enemy.ts";
import { FIELD_ZONE, HILL_ZONE, LOOKOUT_ZONE, PASS_ZONE, TUTORIAL } from "../src/game/tutorial/lesson.ts";
import { admit, allowedSelection } from "../src/game/tutorial/policy.ts";
import { acknowledge, advance, currentStep, finished, isPaused, noteSent, startTutorial, type TutorialState } from "../src/game/tutorial/runner.ts";
import type { CameraPose, Step, TaskStep, Zone } from "../src/game/tutorial/types.ts";
import { ENEMY_BASE, tutorialWorld } from "../src/game/tutorial/world.ts";

/** What a scripted player can do in one tick. `t` = ticks since the step began. */
interface Player {
  sim: SimState;
  me: number;
  t: number;
  send(intent: Intent): void;
  select(ids: number[]): number[];
  /** Moves or turns the camera, as a drag or the arrow keys would. */
  look(pose: Partial<CameraPose>): void;
}

type Script = (p: Player) => void;

/** A line across the pass, north to south. */
const PASS_LINE = [{ x: PASS_ZONE.x, y: PASS_ZONE.y - 160 }, { x: PASS_ZONE.x, y: PASS_ZONE.y + 160 }];
/** Tick budget per task step. 10 ticks = 1 game second. A select step takes none: time stands still for it. */
const BUDGET: Record<string, number> = {
  "pan-camera": 0, "turn-camera": 0, "build-harvester": 300, "siege-factory": 5, "harvester-ready": 400,
  "harvester-to-field": 300, "siege-harvester": 300, "first-tank": 1200, "build-engineer": 600, "second-tank": 1200,
  "siege-engineer": 100, "third-tank": 1200, "guard-tank": 50, "select-tanks": 0, "tanks-to-pass": 1200, "siege-tanks": 300,
  "hold-pass": 1500, "reclaim-scrap": 1500, "build-radar": 600, "radar-to-hill": 1500, "siege-radar": 100, "destroy-factory": 3000,
};

const ids = (p: Player, kind: UnitKind) => ownOfKind(p.sim.world, p.me, kind).map((u) => u.id);
const factory = (p: Player) => ownOfKind(p.sim.world, p.me, "factory")[0]!;
const credits = (p: Player) => p.sim.world.players.find((pl) => pl.id === p.me)!.credits;
const move = (units: number[], x: number, y: number, extra: Partial<Extract<Intent, { t: "move" }>> = {}): Intent =>
  ({ t: "move", units, x, y, force: false, queue: false, attack: false, ...extra });
const siegeOf = (units: number[], queue = false): Intent => ({ t: "siege", units, on: true, queue });

/** A select step's script: click every own unit of `kind`. */
const selectAll = (kind: UnitKind): Script => (p) => {
  assert.deepEqual(p.select(ids(p, kind)), ids(p, kind));
};

/** Queues `kind` until `want` exist or are queued, when credits allow. */
function buildUpTo(p: Player, kind: UnitKind, want: number): boolean {
  const f = factory(p);
  const planned = ids(p, kind).length + f.queue.filter((j) => j.kind === kind).length;
  if (planned >= want) return false;
  if (credits(p) >= UNIT_STATS[kind].cost) p.send({ t: "build", factory: f.id, kind });
  return true;
}

const SCRIPT: Record<string, Script> = {
  "pan-camera": (p) => {
    p.look({ x: 2000 });
  },
  "turn-camera": (p) => {
    p.look({ yaw: -0.7 });
  },
  "select-factory": (p) => {
    if (p.t > 0) return;
    const enemyTank = otherIds(p.sim.world, p.me, "tank")[0]!;
    assert.deepEqual(p.select([factory(p).id, enemyTank]), [factory(p).id], "an enemy unit is selectable in step 1");
  },
  "build-harvester": (p) => {
    if (p.t === 0) p.send({ t: "build", factory: factory(p).id, kind: "harvester" });
  },
  "siege-factory": (p) => {
    if (p.t === 0) p.send(siegeOf([factory(p).id]));
  },
  "harvester-ready": () => {},
  "select-harvester": (p) => {
    assert.deepEqual(p.select([factory(p).id, ...ids(p, "harvester")]), ids(p, "harvester"), "the factory is selectable here");
  },
  "harvester-to-field": (p) => {
    if (p.t === 0) p.send(move([factory(p).id, ...ids(p, "harvester")], FIELD_ZONE.x, FIELD_ZONE.y));
  },
  "siege-harvester": (p) => {
    if (p.t === 0) p.send(siegeOf(ids(p, "harvester"), true));
  },
  "select-factory-for-tank": selectAll("factory"),
  "select-engineer": selectAll("engineer"),
  "select-factory-again": selectAll("factory"),
  "select-engineer-to-guard": selectAll("engineer"),
  "select-engineer-for-scrap": selectAll("engineer"),
  "select-factory-for-radar": selectAll("factory"),
  "select-radar": selectAll("radar"),
  "first-tank": (p) => {
    buildUpTo(p, "tank", 1);
  },
  "build-engineer": (p) => {
    buildUpTo(p, "engineer", 1);
  },
  "second-tank": (p) => {
    buildUpTo(p, "tank", 2);
  },
  "siege-engineer": (p) => {
    if (p.t === 0) p.send(siegeOf(ids(p, "engineer")));
  },
  "third-tank": (p) => {
    buildUpTo(p, "tank", 3);
  },
  "guard-tank": (p) => {
    if (p.t === 0) p.send({ t: "guard", units: ids(p, "engineer"), target: ids(p, "tank")[0]!, queue: false });
  },
  "select-tanks": (p) => {
    assert.deepEqual(p.select(ids(p, "tank")), ids(p, "tank"));
  },
  "tanks-to-pass": (p) => {
    if (p.t > 0) return;
    p.send(move(ids(p, "tank"), PASS_LINE[1]!.x, PASS_LINE[1]!.y, { path: PASS_LINE }));
  },
  "siege-tanks": (p) => {
    if (p.t === 0) p.send(siegeOf(ids(p, "tank"), true));
  },
  "hold-pass": () => {},
  "reclaim-scrap": (p) => {
    if (p.t > 0) return;
    // Do what the acted-out circle shows: press on its centre wreck, let go at its edge.
    const scraps = scrapNear(p.sim.world, PASS_ZONE, 1500);
    assert.ok(scraps.length > 0, "the pass fight left no scrap, so the reclaim step is skipped");
    const g = reclaimDrag(scraps)!;
    const radius = Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y);
    const intents = areaReclaim(p.sim.world, p.me, ids(p, "engineer"), g.from.x, g.from.y, radius, false);
    assert.equal(intents.length, scraps.length, "the acted-out circle misses a wreck");
    for (const i of intents) p.send(i);
  },
  "build-radar": (p) => {
    buildUpTo(p, "radar", 1);
  },
  "radar-to-hill": (p) => {
    if (p.t === 0) p.send(move(ids(p, "radar"), LOOKOUT_ZONE.x, LOOKOUT_ZONE.y));
  },
  "siege-radar": (p) => {
    if (p.t === 0) p.send(siegeOf(ids(p, "radar")));
  },
  "destroy-factory": (p) => {
    buildUpTo(p, "tank", 12);
    if (p.t === 0) p.send({ t: "siege", units: ids(p, "tank"), on: false, queue: false });
    if (p.t < 20) return;
    const tanks = ownOfKind(p.sim.world, p.me, "tank").filter((u) => u.mode === "mobile").map((u) => u.id);
    if (tanks.length === 0) return;
    if (p.t % 40 === 20) p.send(move(tanks, ENEMY_BASE.x, ENEMY_BASE.y, { attack: true }));
    const target = p.sim.world.units.find((u) => u.owner !== p.me && u.kind === "factory");
    if (target && p.t % 40 === 0) p.send({ t: "attack", units: tanks, target: target.id, queue: false });
  },
};

/** A task step, or a failed assertion naming it. */
function task(s: Step): TaskStep {
  assert.equal(s.t, "task", `${s.id} is not a task`);
  return s as TaskStep;
}

const stepNamed = (id: string) => task(TUTORIAL.steps.find((s) => s.id === id)!);

interface Run {
  ticks: Map<string, number>; tanksAfterFight: number; sightAtRadarNote: { factories: number; harvesters: number };
  /** The steps whose camera follow list was not empty on some tick. */
  followed: Set<string>;
}

/**
 * Plays the whole lesson the way TutorialGuide and the tutorial LocalMatch drive it: the enemy script, then send,
 * step the sim, advance. A note is read at once and takes no tick: time stops while it shows. Returns ticks per step.
 */
function playThrough(): Run {
  const { world, you, enemy } = tutorialWorld();
  const sim = createSimState(world);
  let state: TutorialState = startTutorial();
  let selected: number[] = [];
  let camera: CameraPose = { x: 1200, y: 2000, yaw: 0 };
  const seen = () => ({ world: sim.world, me: you, selected, camera });
  const run: Run = { ticks: new Map(), tanksAfterFight: -1, sightAtRadarNote: { factories: -1, harvesters: -1 }, followed: new Set() };
  const bot = tutorialEnemy(TUTORIAL, { stepIndex: () => (finished(TUTORIAL, state) ? null : state.index) }, enemy);
  let t = 0;
  while (!finished(TUTORIAL, state)) {
    const step0 = currentStep(TUTORIAL, state)!;
    if (step0.t === "note") {
      if (step0.id === "about-radar") {
        run.sightAtRadarNote = {
          factories: detectedOthers(sim.world, you, "factory").length, harvesters: detectedOthers(sim.world, you, "harvester").length,
        };
      }
      state = advance(TUTORIAL, acknowledge(state), seen());
      run.ticks.set(step0.id, 0);
      continue;
    }
    const current = task(step0);
    const out: Stamped[] = [];
    const player: Player = {
      sim, me: you, t,
      send(intent) {
        const admitted = admit(current.policy, intent, sim.world, you);
        assert.ok(admitted, `${current.id}: the lesson blocks its own ${intent.t}`);
        state = noteSent(state, admitted);
        out.push({ player: you, intent: admitted });
      },
      select(want) {
        selected = allowedSelection(current.policy, sim.world, you, want);
        return selected;
      },
      look(pose) {
        camera = { ...camera, ...pose };
      },
    };
    if (!state.cameraStart) state = advance(TUTORIAL, state, seen());
    SCRIPT[current.id]!(player);
    if (isPaused(TUTORIAL, state)) {
      // Time stands still: no tick, no bot. Only a step done by selection or camera alone may end here.
      const next = advance(TUTORIAL, state, seen());
      assert.notEqual(next.index, state.index, `${current.id}: frozen, and the script neither sent, selected nor looked enough`);
      run.ticks.set(current.id, t);
      t = 0;
      state = next;
      continue;
    }
    out.unshift(...bot.think(sim.world, enemy).map((intent) => ({ player: enemy, intent })));
    step(sim, out);
    t++;
    if ((current.focus.follow?.(sim.world, you).length ?? 0) > 0) run.followed.add(current.id);
    assert.ok(t <= BUDGET[current.id]!, `${current.id}: not done within ${BUDGET[current.id]} ticks`);
    const next = advance(TUTORIAL, state, seen());
    if (next.index !== state.index) {
      run.ticks.set(current.id, t);
      if (current.id === "hold-pass") run.tanksAfterFight = ownOfKind(sim.world, you, "tank").length;
      t = 0;
    }
    state = next;
  }
  return run;
}

test("tutorial lesson: a scripted player finishes every step with only permitted intents", (t) => {
  const run = playThrough();
  assert.deepEqual([...run.ticks.keys()], TUTORIAL.steps.map((s) => s.id));
  for (const [id, n] of run.ticks) t.diagnostic(`${id}: ${n} ticks (${(n / 10).toFixed(1)} s)`);
  t.diagnostic(`total: ${[...run.ticks.values()].reduce((a, b) => a + b, 0)} ticks`);
  t.diagnostic(`tanks after the pass fight: ${run.tanksAfterFight}`);
  assert.ok(run.tanksAfterFight >= 1, "three sieged tanks lose the pass fight");
  const tank = (id: string) => run.ticks.get(id)!;
  assert.ok(tank("second-tank") < tank("first-tank"), "the engineer does not speed up the second tank");
  assert.ok(tank("third-tank") < tank("second-tank"), "the sieged engineer does not speed up the third tank");
  assert.equal(run.sightAtRadarNote.factories, 1, "the radar on the hill does not detect the enemy factory");
  assert.equal(run.sightAtRadarNote.harvesters, 1, "the radar on the hill does not detect the enemy harvester");
  assert.deepEqual([...run.followed], ["tanks-to-pass", "hold-pass", "radar-to-hill"], "the camera does not follow the moves");
});

test("tutorial lesson: the player starts with only a factory; the enemy with a factory, a harvester on its field and three tanks", () => {
  const { world, you, enemy } = tutorialWorld();
  assert.deepEqual(world.units.filter((u) => u.owner === you).map((u) => u.kind), ["factory"]);
  const theirs = world.units.filter((u) => u.owner === enemy);
  assert.deepEqual(theirs.map((u) => u.kind).sort(), ["factory", "harvester", "tank", "tank", "tank"]);
  assert.ok(ownOfKind(world, enemy, "harvester").every((h) => world.fields.some((f) => Math.hypot(h.x - f.x, h.y - f.y) <= f.radius)));
  assert.deepEqual(detectedOthers(world, you, "tank"), [], "the player sees the enemy tanks at the start");
});

test("tutorial lesson: the camera steps come first, stop time, and allow no order and no selection", () => {
  const { world, you } = tutorialWorld();
  const f = ownOfKind(world, you, "factory")[0]!;
  assert.deepEqual(TUTORIAL.steps.slice(0, 2).map((s) => s.id), ["pan-camera", "turn-camera"]);
  for (const id of ["pan-camera", "turn-camera"]) {
    const s = stepNamed(id);
    assert.equal(s.freeze, true);
    assert.equal(s.policy.intents.length, 0, `${id} allows an order, so time could start`);
    assert.deepEqual(allowedSelection(s.policy, world, you, [f.id]), []);
  }
});

test("tutorial lesson: early steps block what they do not teach", () => {
  const { world, you } = tutorialWorld();
  const first = stepNamed("select-factory"), second = stepNamed("build-harvester");
  const f = ownOfKind(world, you, "factory")[0]!;
  const h = spawnUnit(world, you, "harvester", f.x + 200, f.y);
  assert.equal(admit(first.policy, move([h.id], 2600, 2000), world, you), null);
  assert.deepEqual(allowedSelection(first.policy, world, you, [f.id, h.id]), [f.id]);
  assert.equal(admit(second.policy, { t: "build", factory: f.id, kind: "tank" }, world, you), null);
  assert.ok(admit(second.policy, { t: "build", factory: f.id, kind: "harvester" }, world, you));
});

test("tutorial lesson: a move with the factory selected moves the rest; a factory siege still passes", () => {
  const { world, you } = tutorialWorld();
  const toField = stepNamed("harvester-to-field");
  const siegeStep = stepNamed("siege-factory");
  const f = ownOfKind(world, you, "factory")[0]!;
  const h = spawnUnit(world, you, "harvester", f.x + 200, f.y);
  assert.deepEqual(admit(toField.policy, move([f.id, h.id], 2600, 2000), world, you), move([h.id], 2600, 2000));
  assert.equal(admit(toField.policy, move([f.id], 2600, 2000), world, you), null);
  const siege: Intent = { t: "siege", units: [f.id], on: true, queue: false };
  assert.equal(admit(siegeStep.policy, siege, world, you), siege);
});

test("tutorial lesson: before the last step no move, attack-move or attack aims near the enemy base", () => {
  const { world, you, enemy } = tutorialWorld();
  const tank = spawnUnit(world, you, "tank", PASS_ZONE.x, PASS_ZONE.y);
  const enemyFactory = ownOfKind(world, enemy, "factory")[0]!;
  const last = TUTORIAL.steps.length - 1;
  for (const s of TUTORIAL.steps.slice(0, last)) {
    if (s.t !== "task") continue;
    for (const attack of [false, true]) {
      assert.equal(admit(s.policy, move([tank.id], ENEMY_BASE.x, ENEMY_BASE.y, { attack }), world, you), null, `${s.id}: move to the base`);
      const path = [{ x: PASS_ZONE.x, y: PASS_ZONE.y }, { x: ENEMY_BASE.x - 500, y: ENEMY_BASE.y }];
      assert.equal(admit(s.policy, move([tank.id], PASS_ZONE.x, PASS_ZONE.y, { attack, path }), world, you), null, `${s.id}: path to the base`);
    }
    assert.equal(admit(s.policy, { t: "attack", units: [tank.id], target: enemyFactory.id, queue: false }, world, you), null, `${s.id}: attack`);
    assert.equal(admit(s.policy, { t: "rally", units: [ownOfKind(world, you, "factory")[0]!.id], ...ENEMY_BASE }, world, you), null);
  }
  assert.ok(admit(stepNamed("hold-pass").policy, move([tank.id], PASS_ZONE.x, PASS_ZONE.y, { attack: true }), world, you));
});

/** Height spread over the zone, sampled on a 50-unit grid. */
function heightSpread(z: Zone): number {
  const { world } = tutorialWorld();
  let lo = Infinity, hi = -Infinity;
  for (let dx = -z.radius; dx <= z.radius; dx += 50) {
    for (let dy = -z.radius; dy <= z.radius; dy += 50) {
      if (dx * dx + dy * dy > z.radius * z.radius) continue;
      const h = heightAt(world.terrain, z.x + dx, z.y + dy);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  return hi - lo;
}

test("tutorial lesson: the field zone is a map field, the hill zone is on the hill top, the pass is flat and clear", () => {
  const { world } = tutorialWorld();
  assert.ok(world.fields.some((f) => f.x === FIELD_ZONE.x && f.y === FIELD_ZONE.y && f.radius === FIELD_ZONE.radius));
  const t = world.terrain, { x, y, radius: r } = HILL_ZONE;
  for (const [px, py] of [[x, y], [x + r, y], [x - r, y], [x, y + r], [x, y - r]] as const) {
    assert.ok(Math.abs(heightAt(t, px, py) - 520) <= 10, `hill height at (${px}, ${py}) is ${heightAt(t, px, py)}`);
  }
  const l = LOOKOUT_ZONE;
  assert.ok(Math.hypot(l.x - x, l.y - y) + l.radius <= r, "the lookout is not inside the hill top");
  assert.ok(Math.abs(heightAt(t, l.x, l.y) - 520) <= 10, "the lookout is not on the hill top");
  assert.ok(heightSpread(PASS_ZONE) <= 30, `pass height spread is ${heightSpread(PASS_ZONE)}`);
  const blocking = world.features.filter((f) => Math.hypot(f.x - PASS_ZONE.x, f.y - PASS_ZONE.y) < PASS_ZONE.radius + f.radius);
  assert.deepEqual(blocking.map((f) => `${f.kind}@${f.x},${f.y}`), [], "features in the pass");
});

test("tutorial lesson: the acted-out reclaim circle presses on a wreck and holds them all; none without scrap", () => {
  assert.equal(reclaimDrag([]), null);
  const wreck = (id: number, x: number, y: number) => ({ id, kind: "scrap" as const, x, y, radius: 20, hp: 100, variant: 0, unit: "tank" as const });
  const scraps = [wreck(1, 0, 0), wreck(2, 100, 0), wreck(3, 400, 0)];
  const g = reclaimDrag(scraps)!;
  assert.equal(g.shape, "circle");
  assert.ok(scraps.some((f) => f.x === g.from.x && f.y === g.from.y), "the drag does not start on a wreck");
  const r = Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y);
  assert.ok(scraps.every((f) => Math.hypot(f.x - g.from.x, f.y - g.from.y) < r));
});
