// Which parts of the page show on each screen. Pure.

/** The client's screen state while a match or its start is on: pick → match → ended. No screen at all: the backdrop. */
export type Screen = "pick" | "match" | "ended";

export interface ScreenLayout {
  /** The pick panel and the spot marks, over the terrain. */
  pick: boolean;
  end: boolean;
  /** The in-game HUD: top bar, leaderboard, console, banners. */
  hud: boolean;
}

export function layoutOf(screen: Screen | null): ScreenLayout {
  return {
    pick: screen === "pick",
    end: screen === "ended",
    hud: screen === "match" || screen === "ended",
  };
}
