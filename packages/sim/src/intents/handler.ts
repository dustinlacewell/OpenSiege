import type { Intent, World } from "../types.ts";

/** The intent variant with tag `K`. */
export type IntentOf<K extends Intent["t"]> = Extract<Intent, { t: K }>;

/** Applies one intent of kind `K` for `player`. Checks every field itself and never throws. */
export type IntentHandler<K extends Intent["t"]> = (world: World, player: number, intent: IntentOf<K>) => void;

/** One handler per intent tag. A new `Intent` variant without a row is a type error. */
export type IntentTable = { readonly [K in Intent["t"]]: IntentHandler<K> };
