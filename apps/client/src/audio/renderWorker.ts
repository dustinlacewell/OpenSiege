import { RECIPES } from "./recipes.ts";
import type { RenderRequest, RenderResult } from "./renderMessages.ts";

/** Renders one weapon sound per request, off the main thread, and posts it back. */
self.onmessage = (e: MessageEvent<RenderRequest>) => {
  const { id, cue, seed, size, sr } = e.data;
  const samples = RECIPES[cue](sr, seed, size);
  const msg: RenderResult = { id, samples };
  self.postMessage(msg, { transfer: [samples.buffer] });
};
