// The tutorial match: its starting world, the local player, and the lesson.
import type { World } from "@mf/sim";
import { TUTORIAL } from "./lesson.ts";
import type { Lesson } from "./types.ts";
import { tutorialWorld } from "./world.ts";

/** The tutorial's starting world (both players already joined), the local and enemy player ids, and the lesson. Pure. */
export function tutorialMatch(): { world: World; you: number; enemy: number; lesson: Lesson } {
  return { ...tutorialWorld(), lesson: TUTORIAL };
}
