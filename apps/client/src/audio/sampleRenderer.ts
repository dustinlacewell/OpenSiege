import type { SampledCue } from "./cues.ts";
import { InFlight } from "./inFlight.ts";
import type { RenderRequest, RenderResult } from "./renderMessages.ts";

/** Most renders pending at once. A request past this is refused. */
const MAX_IN_FLIGHT = 8;
/** The render rate until an AudioContext tells the real one. */
const DEFAULT_RATE = 48000;

/** Called with the rendered samples and the rate they were rendered at. */
export type OnReady = (samples: Float32Array<ArrayBuffer>, sr: number) => void;

interface Pending {
  onReady: OnReady;
  sr: number;
}

/**
 * The imperative shell around the render worker. The worker starts at construction; it needs no AudioContext.
 * Every request renders one fresh weapon sound.
 */
export class SampleRenderer {
  private readonly worker: Worker;
  private readonly inFlight = new InFlight<Pending>(MAX_IN_FLIGHT);
  private sr = DEFAULT_RATE;

  constructor() {
    this.worker = new Worker(new URL("./renderWorker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<RenderResult>) => this.deliver(e.data);
    this.worker.onerror = (e) => {
      console.error("Weapon sound render failed:", e.message);
      this.inFlight.clear();
    };
  }

  /** Renders at `sr` from now on. */
  setSampleRate(sr: number): void {
    this.sr = sr;
  }

  /** Asks for one sound. False, and nothing happens, when too many renders are pending. */
  render(cue: SampledCue, size: number, seed: number, onReady: OnReady): boolean {
    const id = this.inFlight.add({ onReady, sr: this.sr });
    if (id === null) return false;
    const req: RenderRequest = { id, cue, seed, size, sr: this.sr };
    this.worker.postMessage(req);
    return true;
  }

  private deliver({ id, samples }: RenderResult): void {
    const pending = this.inFlight.take(id);
    if (pending) pending.onReady(samples, pending.sr);
  }
}
