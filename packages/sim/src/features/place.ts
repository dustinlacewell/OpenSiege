import { dist2 } from "../math.ts";
import { edgeMargin, mapSize, scaledCount } from "../mapSize.ts";
import { randInt } from "../rng.ts";
import { roughness } from "../flatness.ts";
import { heightAt } from "../terrain.ts";
import { cellGrade } from "../nav/cellGrade.ts";
import { BLOCKED, buildNavGrid, colOf, navShape, rowOf, type NavGrid, type NavShape } from "../nav/navGrid.ts";
import type { Feature, MapFeatureKind, MapSize, World } from "../types.ts";
import { keepConnected } from "./connect.ts";
import { createFeatureIndex, type FeatureIndex } from "./featureIndex.ts";
import { FEATURE_STATS } from "./featureStats.ts";

const EDGE = 500;
/** Gap kept between a feature's edge and a resource field's edge. */
const FIELD_MARGIN = 100;
/** Two features may overlap by a quarter of their combined radii, no more. Percent of the sum. */
const PACK_PCT = 75;

/** Counts and tries are for the reference map area; `scaledCount` scales them to the map. */
const FOREST_COUNT = 60;
const FOREST_TRIES = 3000;
const FOREST_RADIUS: readonly [number, number] = [350, 800];
const FOREST_SPOTS = 200;
/** A forest grows around a spot that is low and flat. */
const FOREST_HEIGHT_MAX = 560;
const FOREST_ROUGH_MAX = 70;

const ROCK_COUNT = 90;
const BOULDER_COUNT = 130;
const SCATTER_TRIES = 6000;

/** Radius range of each kind. Stays under MAX_FEATURE_RADIUS. */
const RADIUS: Record<MapFeatureKind, readonly [number, number]> = {
  tree: [50, 80],
  rock: [100, 190],
  boulder: [55, 90],
};

/** Where a kind may stand, by the grade (percent) and height of the cell. Trees: low and gentle. Rocks: steeper ground. */
const GROUND: Record<MapFeatureKind, (grade: number, height: number) => boolean> = {
  tree: (grade, height) => grade <= 16 && height <= FOREST_HEIGHT_MAX,
  rock: (grade) => grade >= 16,
  boulder: () => true,
};

interface Placement {
  world: World;
  map: MapSize;
  shape: NavShape;
  /** Margin kept between a placement spot and the map edge. */
  edge: number;
  /** Features placed so far, for the spacing test. */
  index: FeatureIndex;
  /** Terrain-only grid of the heavy class: a cell blocked here (a cliff) takes no feature. */
  open: NavGrid;
  near: Feature[];
}

/**
 * Fill `world.features` from the world rng, in id order: forests of trees on low gentle ground, then rocks on
 * steeper ground, then scattered boulders. Not on resource fields, not in cells the heavy class cannot enter,
 * not packed into each other. Then `keepConnected` removes any blocker that seals ground off.
 * Spawn spots are not known yet; `spawn.ts` keeps clear of features.
 */
export function placeFeatures(world: World): void {
  const map = mapSize(world.terrain), shape = navShape(world.terrain);
  const ctx: Placement = {
    world, map, shape, edge: edgeMargin(EDGE, map),
    index: createFeatureIndex([], map), near: [],
    open: buildNavGrid(world.terrain, "heavy", new Uint8Array(shape.cols * shape.rows)),
  };
  placeForests(ctx);
  scatter(ctx, "rock", scaledCount(ROCK_COUNT, map));
  scatter(ctx, "boulder", scaledCount(BOULDER_COUNT, map));
  keepConnected(world);
}

function placeForests(ctx: Placement): void {
  const w = ctx.world, { map, edge } = ctx;
  const count = scaledCount(FOREST_COUNT, map), tries = scaledCount(FOREST_TRIES, map);
  let forests = 0;
  for (let i = 0; i < tries && forests < count; i++) {
    const radius = randInt(w, FOREST_RADIUS[0], FOREST_RADIUS[1]);
    const x = randInt(w, edge, map.width - edge), y = randInt(w, edge, map.height - edge);
    if (heightAt(w.terrain, x, y) > FOREST_HEIGHT_MAX || roughness(w.terrain, x, y, FOREST_RADIUS[0]) > FOREST_ROUGH_MAX) continue;
    plantForest(ctx, x, y, radius);
    forests++;
  }
}

/** Random spots inside the forest disc. Spots the ground, a field or a neighbour refuses are skipped. */
function plantForest(ctx: Placement, cx: number, cy: number, radius: number): void {
  for (let i = 0; i < FOREST_SPOTS; i++) {
    const x = cx + randInt(ctx.world, -radius, radius), y = cy + randInt(ctx.world, -radius, radius);
    if (dist2(x, y, cx, cy) <= radius * radius) tryPlace(ctx, "tree", x, y);
  }
}

/** Random spots over the whole map until `count` of this kind stand or the tries run out. */
function scatter(ctx: Placement, kind: MapFeatureKind, count: number): void {
  const { map, edge } = ctx, tries = scaledCount(SCATTER_TRIES, map);
  let placed = 0;
  for (let i = 0; i < tries && placed < count; i++) {
    const x = randInt(ctx.world, edge, map.width - edge), y = randInt(ctx.world, edge, map.height - edge);
    if (tryPlace(ctx, kind, x, y)) placed++;
  }
}

/** Draws the radius and variant itself, so a refused spot costs the same rng every run. */
function tryPlace(ctx: Placement, kind: MapFeatureKind, x: number, y: number): boolean {
  const w = ctx.world;
  const radius = randInt(w, RADIUS[kind][0], RADIUS[kind][1]);
  if (!groundOk(ctx, kind, x, y) || onField(w, x, y, radius) || crowded(ctx, x, y, radius)) return false;
  const f: Feature = { id: w.nextId++, kind, x, y, radius, hp: FEATURE_STATS[kind].maxHp, variant: randInt(w, 0, 3) };
  w.features.push(f);
  ctx.index.add(f);
  return true;
}

function groundOk(ctx: Placement, kind: MapFeatureKind, x: number, y: number): boolean {
  const i = colOf(ctx.shape, x), j = rowOf(ctx.shape, y);
  if (ctx.open[j * ctx.shape.cols + i] === BLOCKED) return false;
  return GROUND[kind](cellGrade(ctx.world.terrain, i, j), heightAt(ctx.world.terrain, x, y));
}

function onField(world: World, x: number, y: number, radius: number): boolean {
  return world.fields.some((r) => dist2(x, y, r.x, r.y) < (r.radius + radius + FIELD_MARGIN) ** 2);
}

function crowded(ctx: Placement, x: number, y: number, radius: number): boolean {
  return ctx.index.query(x, y, radius, ctx.near).some((f) => dist2(x, y, f.x, f.y) * 10000 < ((f.radius + radius) * PACK_PCT) ** 2);
}
