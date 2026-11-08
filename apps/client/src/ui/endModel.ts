// What the end card shows. Pure.

export interface EndResult {
  title: string;
  /** The title's style class: "" for a draw. */
  tone: "won" | "lost" | "";
  /** The winners, joined; "" when nobody won. For the tutorial, the invitation. */
  line: string;
  /** The button's label. */
  button: string;
}

/** `winners` are the names of the winning team. `me` is the local name. `button` is the host's label for the way out. */
export function endResult(winners: readonly string[], me: string, button: string): EndResult {
  if (winners.length === 0) return { title: "Draw", tone: "", line: "No winner", button };
  const line = `${winners.join(", ")} ${winners.length === 1 ? "wins" : "win"}`;
  return winners.includes(me) ? { title: "Victory", tone: "won", line, button } : { title: "Defeat", tone: "lost", line, button };
}

/** The tutorial's end: thanks, and an invitation to a real match. */
export const TUTORIAL_END: EndResult = {
  title: "Thanks for playing!",
  tone: "won",
  line: "You know the basics now. Find some real opponents and put them to work.",
  button: "Play a real game",
};
