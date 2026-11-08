// The tutorial's scripted enemy: a LocalBot that sends each step's `enemy` intents once, when the step starts.
import type { LocalBot } from "../../match/localMatch.ts";
import type { Lesson } from "./types.ts";

/**
 * Fires every step entered since the last think, in order, once each. Bots do not think while a note pauses
 * the match, so a note's intents go out on the turn after it ends; time stood still, so the world is the same.
 */
export function tutorialEnemy(lesson: Lesson, guide: { stepIndex(): number | null }, player: number): LocalBot {
  let next = 0;
  return {
    player,
    think(world, me) {
      const index = guide.stepIndex();
      if (index === null || index < next) return [];
      const entered = lesson.steps.slice(next, index + 1);
      next = index + 1;
      return entered.flatMap((s) => s.enemy?.(world, me) ?? []);
    },
  };
}
