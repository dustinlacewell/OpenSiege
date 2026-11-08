// The tutorial lesson: from "move the camera" to "destroy the enemy factory", one small action per step.
// Zones are the map's field, the pass and the hill top (`packages/map/scripts/tutorial.ts`, `maps/tutorial/tutorial.json`).
// Each task lets the player select only the units it is about, and order only what it teaches.
import type { Unit, UnitKind, World } from "@mf/sim";
import {
  allOwnOf, arrived, buildDone, detectedOthers, engineerSiegedAtFactory, inZone, isOwnOf, moveStaysAway, otherIds, ownIds, ownKinds, ownOfKind,
  panned, reclaimDrag, scrapNear, sentDragWith, siegedInZone, siegedOnField, turned, unitStaysAway,
} from "./checks.ts";
import { FREE_POLICY } from "./policy.ts";
import { rule, type ControlId, type Focus, type Gesture, type IntentRule, type Lesson, type NoteStep, type Policy, type TaskStep, type Zone } from "./types.ts";
import { ENEMY_BASE } from "./world.ts";

export const FIELD_ZONE: Zone = { name: "field", x: 2600, y: 2000, radius: 500 };
/** The flat top of the hill. The ramp comes up from the west. */
export const HILL_ZONE: Zone = { name: "hill", x: 3900, y: 1100, radius: 450 };
/** The south-east edge of the hill top: from here a sieged radar reaches the enemy factory. Inside `hill`. */
export const LOOKOUT_ZONE: Zone = { name: "lookout", x: 4100, y: 1300, radius: 120 };
/** Flat, clear land between the hill (north) and the trees at (3600, 3300) (south), east of the field. */
export const PASS_ZONE: Zone = { name: "pass", x: 3650, y: 2150, radius: 400 };
/** Where the enemy tanks gather before they attack the pass: due east of it, beyond a sieged tank's range. */
const PASS_APPROACH = { x: 4550, y: 2100 };
/** The drag the renderer acts out on the tanks-to-pass step: a line across the pass, north to south, facing the enemy. */
const PASS_DRAG: Gesture = { shape: "line", from: { x: PASS_ZONE.x, y: PASS_ZONE.y - 260 }, to: { x: PASS_ZONE.x, y: PASS_ZONE.y + 260 } };
/** The wrecks of the pass fight lie within this distance of the pass centre. */
const BATTLE_RADIUS = 1500;

const TANKS = 3;
/** Before the last step, no move or attack may aim within this distance of the enemy base. The match cannot end early. */
const ENEMY_BASE_KEEP_OUT = 1500;
/** The harvester build is this far along when the siege note stops time: the player sieges while still waiting on it. */
const HARVESTER_PAUSE_AT = 0.3;
/** The camera steps end once the camera has moved this far (world units) or turned this far (radians). */
const CAMERA_PAN = 600;
const CAMERA_TURN = 0.5;

const SIEGE: ControlId = { t: "cmd", name: "siege" };
const GUARD: ControlId = { t: "cmd", name: "guard" };
const slot = (kind: UnitKind): ControlId => ({ t: "slot", kind });

/** Commandable before the last step: a move, guard or stop never takes the factory along. */
const notFactory = (u: Unit) => u.kind !== "factory";

// ---- Rules ----

/** Build `kind` at an own factory. */
const build = (kind: UnitKind) => rule("build", (i, w, me) => i.kind === kind && isOwnOf(w, me, i.factory, "factory"));
/** Siege or unsiege a selection that holds only these own kinds. */
const siege = (...kinds: UnitKind[]) => rule("siege", (i, w, me) => allOwnOf(w, me, i.units, kinds));
/** A move or attack-move that stays clear of the enemy base. */
const move = rule("move", (i) => moveStaysAway(i, ENEMY_BASE, ENEMY_BASE_KEEP_OUT));
/** An attack on a unit that stays clear of the enemy base. */
const attack = rule("attack", (i, w) => unitStaysAway(w, i.target, ENEMY_BASE, ENEMY_BASE_KEEP_OUT));
/** Engineers guard an own tank. */
const guardTankRule = rule("guard", (i, w, me) => allOwnOf(w, me, i.units, ["engineer"]) && isOwnOf(w, me, i.target, "tank"));
/** Engineers reclaim a wreck. */
const reclaim = rule("reclaim", (i, w, me) => allOwnOf(w, me, i.units, ["engineer"]));

/** A step's policy: only own `select` kinds are selectable, only `rules` pass. The factory is never commandable. */
function allow(select: UnitKind[], ...rules: IntentRule[]): Policy {
  return { intents: rules, selectable: ownKinds(...select), commandable: notFactory };
}

const own = (...kinds: UnitKind[]) => (w: World, me: number) => ownIds(w, me, ...kinds);
const focus = (controls: ControlId[], units: Focus["units"], zones: string[] = []): Focus => ({ controls, units, zones });
const none = () => [];
const battleScrap = (w: World) => scrapNear(w, PASS_ZONE, BATTLE_RADIUS);
/** Every own unit of `kind` while any of them still has a move order. For the camera to follow a group on the move. */
const onTheMove = (kind: UnitKind) => (w: World, me: number) => {
  const units = ownOfKind(w, me, kind);
  return units.some((u) => !arrived(u)) ? units.map((u) => u.id) : [];
};
/** The enemy tanks the player can see. */
const seenEnemyTanks = (w: World, me: number) => detectedOthers(w, me, "tank");

/**
 * Select a unit of `kind`, and nothing else. Time stops until the click, and the click alone ends the step.
 * `skip`: the step is done anyway, as when there is nothing left for the unit to do.
 */
function select(id: string, prompt: string, kind: UnitKind, skip: (w: World) => boolean = () => false): TaskStep {
  return {
    t: "task",
    id,
    prompt,
    policy: allow([kind]),
    focus: focus([], own(kind)),
    done: ({ world, me, selected }) => skip(world) || selected.some((u) => isOwnOf(world, me, u, kind)),
    freeze: true,
  };
}

/** Build a tank and wait until `n` tanks exist. */
function buildTank(id: string, prompt: string, n: number): TaskStep {
  return {
    t: "task",
    id,
    prompt,
    policy: allow(["factory"], build("tank")),
    focus: focus([slot("tank")], own("factory")),
    done: ({ world, me }) => ownOfKind(world, me, "tank").length >= n,
  };
}

// ---- Camera ----

const panCamera: TaskStep = {
  t: "task",
  id: "pan-camera",
  prompt: "Welcome, commander. First, move the camera. Hold the middle mouse button and drag. The arrow keys work too.",
  policy: allow([]),
  focus: focus([], none),
  done: ({ camera, cameraStart }) => panned(cameraStart, camera) >= CAMERA_PAN,
  freeze: true,
};

const turnCamera: TaskStep = {
  t: "task",
  id: "turn-camera",
  prompt: "Now turn the camera. Hold Ctrl, then hold the middle mouse button and drag left or right.",
  policy: allow([]),
  focus: focus([], none),
  done: ({ camera, cameraStart }) => turned(cameraStart, camera) >= CAMERA_TURN,
  freeze: true,
};

// ---- Factory and harvester ----

const selectFactory = select("select-factory", "Good. Now left-click your factory to select it.", "factory");

const buildHarvester: TaskStep = {
  t: "task",
  id: "build-harvester",
  prompt: "Your factory builds all your units. Click the harvester button to build one.",
  policy: allow(["factory"], build("harvester")),
  focus: focus([slot("harvester")], own("factory")),
  done: ({ world, me }) => buildDone(world, me, "harvester") >= HARVESTER_PAUSE_AT || ownOfKind(world, me, "harvester").length > 0,
};

const aboutSiege: NoteStep = {
  t: "note",
  id: "about-siege",
  prompt: "This is taking a while! Siege the factory to build four times faster. "
    + "Sieged units can't move, but every unit gets a bonus while sieged.",
  focus: focus([SIEGE], own("factory")),
};

const siegeFactory: TaskStep = {
  t: "task",
  id: "siege-factory",
  prompt: "Press Siege. Careful: unsieging takes a few seconds.",
  policy: allow(["factory"], siege("factory")),
  focus: focus([SIEGE], own("factory")),
  done: ({ world, me }) => ownOfKind(world, me, "factory").some((f) => f.mode === "deploying" || f.mode === "sieged"),
  freeze: true,
};

const harvesterReady: TaskStep = {
  t: "task",
  id: "harvester-ready",
  prompt: "Much better. Your harvester is almost done.",
  policy: allow([]),
  focus: focus([], own("factory")),
  done: ({ world, me }) => ownOfKind(world, me, "harvester").length > 0,
};

const aboutHarvester: NoteStep = {
  t: "note",
  id: "about-harvester",
  prompt: "Harvesters mine crystal. Crystal is credits, and credits pay for every unit you build.",
  focus: focus([], own("harvester"), [FIELD_ZONE.name]),
};

const selectHarvester = select("select-harvester", "Click the harvester to select it.", "harvester");

const harvesterToField: TaskStep = {
  t: "task",
  id: "harvester-to-field",
  prompt: "Now right-click the crystal field to send it there.",
  policy: allow(["harvester"], move),
  focus: focus([], none, [FIELD_ZONE.name]),
  done: ({ world, me }) => ownOfKind(world, me, "harvester").some((h) => inZone(h, FIELD_ZONE) && arrived(h)),
  freeze: true,
};

const siegeHarvester: TaskStep = {
  t: "task",
  id: "siege-harvester",
  prompt: "Put the harvester in siege mode which causes it to mine faster.",
  policy: allow(["harvester"], siege("harvester"), move),
  focus: focus([SIEGE], own("harvester"), [FIELD_ZONE.name]),
  done: ({ world, me }) => ownOfKind(world, me, "harvester").some((h) => siegedOnField(world, h)),
  freeze: true,
};

// ---- Tanks and the engineer ----

const selectFactoryForTank = select("select-factory-for-tank", "Now you need some muscle. Click your factory.", "factory");

const firstTank = buildTank("first-tank", "Click the tank button to build a tank.", 1);

const buildEngineer: TaskStep = {
  t: "task",
  id: "build-engineer",
  prompt: "That took a while. An engineer can help. Click the engineer button.",
  policy: allow(["factory"], build("engineer")),
  focus: focus([slot("engineer")], own("factory")),
  done: ({ world, me }) => ownOfKind(world, me, "engineer").length > 0,
};

const aboutEngineers: NoteStep = {
  t: "note",
  id: "about-engineers",
  prompt: "Engineers have no gun. They repair your units, and they speed up any factory they stand next to.",
  focus: focus([], own("engineer")),
};

const secondTank = buildTank("second-tank", "Build another tank. The engineer beside the factory speeds it up a little.", 2);

const selectEngineer = select("select-engineer", "A sieged engineer helps a lot more. Click the engineer.", "engineer");

const siegeEngineer: TaskStep = {
  t: "task",
  id: "siege-engineer",
  prompt: "Press Siege.",
  policy: allow(["engineer"], siege("engineer")),
  focus: focus([SIEGE], own("engineer")),
  done: ({ world, me }) => engineerSiegedAtFactory(world, me),
  freeze: true,
};

const selectFactoryAgain = select("select-factory-again", "Click your factory again.", "factory");

const thirdTank = buildTank("third-tank", "Build a third tank. Watch how much faster this one comes out.", TANKS);

const selectEngineerToGuard = select("select-engineer-to-guard", "Your engineer can look after the tanks too. Click the engineer.", "engineer");

const guardTank: TaskStep = {
  t: "task",
  id: "guard-tank",
  prompt: "Press Guard, then click one of your tanks. The engineer will follow your tanks and keep them repaired.",
  policy: allow(["engineer"], guardTankRule),
  focus: focus([GUARD], own("tank")),
  done: ({ world, me }) => ownOfKind(world, me, "engineer").some((e) =>
    e.orders.some((o) => o.type === "guard" && isOwnOf(world, me, o.target, "tank"))),
  freeze: true,
};

// ---- The pass ----

const selectTanks: TaskStep = {
  t: "task",
  id: "select-tanks",
  prompt: "Time to move out. Double-click a tank to select every tank on screen.",
  policy: allow(["tank"]),
  focus: focus([], own("tank")),
  done: ({ world, me, selected }) => selected.filter((id) => isOwnOf(world, me, id, "tank")).length >= TANKS,
  freeze: true,
};

const tanksToPass: TaskStep = {
  t: "task",
  id: "tanks-to-pass",
  prompt: "Right-click and drag to place units in a line. Hold right-click at one end of the pass, "
    + "drag to the other end and let go.",
  policy: allow(["tank"], move),
  focus: {
    ...focus([], none, [PASS_ZONE.name]),
    gesture: (w, me) => (onTheMove("tank")(w, me).length > 0 ? null : PASS_DRAG),
    follow: onTheMove("tank"),
  },
  done: ({ world, me, sent }) =>
    sentDragWith(sent, world, me, "tank") && ownOfKind(world, me, "tank").filter((t) => inZone(t, PASS_ZONE) && arrived(t)).length >= TANKS,
  freeze: true,
};

const siegeTanks: TaskStep = {
  t: "task",
  id: "siege-tanks",
  prompt: "Now press Siege to dig them in.",
  policy: allow(["tank"], siege("tank"), move),
  focus: focus([SIEGE], own("tank"), [PASS_ZONE.name]),
  done: ({ world, me }) => siegedInZone(world, me, "tank", PASS_ZONE).length >= TANKS,
  freeze: true,
};

const aboutSiegedTanks: NoteStep = {
  t: "note",
  id: "about-sieged-tanks",
  prompt: "Sieged tanks hit harder, shoot farther and take less damage. Here comes the proof.",
  focus: focus([], own("tank"), [PASS_ZONE.name]),
};

/**
 * The scripted enemy's three tanks drive to a point east of the pass, out of the player's range, then attack-move west
 * into it. The first leg keeps them north of the rock at (4147, 2414): from behind it they and the player cannot hit each other.
 */
const holdPass: TaskStep = {
  t: "task",
  id: "hold-pass",
  prompt: "Enemy tanks incoming! Hold the pass.",
  policy: allow(["tank"], siege("tank"), move, attack),
  focus: { ...focus([], seenEnemyTanks, [PASS_ZONE.name]), follow: seenEnemyTanks },
  enemy: (world, enemy) => {
    const units = world.units.filter((u) => u.owner === enemy && u.kind === "tank" && u.hp > 0).map((u) => u.id);
    if (units.length === 0) return [];
    return [
      { t: "move", units, ...PASS_APPROACH, force: false, queue: false, attack: false },
      { t: "move", units, x: PASS_ZONE.x, y: PASS_ZONE.y, force: false, queue: true, attack: true },
    ];
  },
  done: ({ world, me }) => otherIds(world, me, "tank").length === 0,
};

// ---- Scrap ----

const noScrap = (w: World) => battleScrap(w).length === 0;
/** An own engineer has a reclaim order: the player's drag went out. */
const reclaiming = (w: World, me: number) => ownOfKind(w, me, "engineer").some((e) => e.orders.some((o) => o.type === "reclaim"));

const selectEngineerForScrap = select(
  "select-engineer-for-scrap", "Pass held! Wrecks leave scrap, and engineers turn scrap into credits. Click the engineer.", "engineer", noScrap,
);

const reclaimScrap: TaskStep = {
  t: "task",
  id: "reclaim-scrap",
  prompt: "Hold right-click on a wreck, drag out a circle over the others, and let go. The engineer picks up every wreck inside it.",
  policy: allow(["engineer"], reclaim),
  focus: { ...focus([], none), gesture: (w, me) => (reclaiming(w, me) ? null : reclaimDrag(battleScrap(w))) },
  done: ({ world }) => noScrap(world),
  freeze: true,
};

// ---- Radar ----

const selectFactoryForRadar = select("select-factory-for-radar", "Now find their base. Click your factory.", "factory");

const buildRadar: TaskStep = {
  t: "task",
  id: "build-radar",
  prompt: "Click the radar button to build a radar.",
  policy: allow(["factory"], build("radar")),
  focus: focus([slot("radar")], own("factory")),
  done: ({ world, me }) => ownOfKind(world, me, "radar").length > 0,
};

const selectRadar = select("select-radar", "Click the radar to select it.", "radar");

const radarToHill: TaskStep = {
  t: "task",
  id: "radar-to-hill",
  prompt: "Right-click the ring on the hill top. The radar drives up the ramp.",
  policy: allow(["radar"], move, siege("radar")),
  focus: { ...focus([], none, [LOOKOUT_ZONE.name]), follow: onTheMove("radar") },
  done: ({ world, me }) => ownOfKind(world, me, "radar").some((r) => inZone(r, LOOKOUT_ZONE) && arrived(r)),
  freeze: true,
};

const siegeRadar: TaskStep = {
  t: "task",
  id: "siege-radar",
  prompt: "Now press Siege. A sieged radar sees much farther.",
  policy: allow(["radar"], siege("radar"), move),
  focus: focus([SIEGE], own("radar"), [LOOKOUT_ZONE.name]),
  done: ({ world, me }) => siegedInZone(world, me, "radar", LOOKOUT_ZONE).length > 0 && detectedOthers(world, me, "factory").length > 0,
  freeze: true,
};

const aboutRadar: NoteStep = {
  t: "note",
  id: "about-radar",
  prompt: "There they are. From the hill, your radar spots the enemy factory and harvester.",
  focus: focus([], (w, me) => [...otherIds(w, me, "factory"), ...otherIds(w, me, "harvester")]),
};

const destroyFactory: TaskStep = {
  t: "task",
  id: "destroy-factory",
  prompt: "Last job: build an army and destroy their factory. Everything is unlocked. You've got this.",
  policy: FREE_POLICY,
  focus: focus([], (w, me) => otherIds(w, me, "factory")),
  done: ({ world, me }) => otherIds(world, me, "factory").length === 0,
};

export const TUTORIAL: Lesson = {
  zones: [FIELD_ZONE, PASS_ZONE, HILL_ZONE, LOOKOUT_ZONE],
  steps: [
    panCamera, turnCamera,
    selectFactory, buildHarvester, aboutSiege, siegeFactory, harvesterReady,
    aboutHarvester, selectHarvester, harvesterToField, siegeHarvester,
    selectFactoryForTank, firstTank, buildEngineer, aboutEngineers, secondTank,
    selectEngineer, siegeEngineer, selectFactoryAgain, thirdTank, selectEngineerToGuard, guardTank,
    selectTanks, tanksToPass, siegeTanks, aboutSiegedTanks, holdPass,
    selectEngineerForScrap, reclaimScrap,
    selectFactoryForRadar, buildRadar, selectRadar, radarToHill, siegeRadar, aboutRadar,
    destroyFactory,
  ],
};
