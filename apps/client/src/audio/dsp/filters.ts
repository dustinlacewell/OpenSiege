/** Low-pass, high-pass, or band-pass (constant 0 dB peak gain). */
export type FilterType = "lp" | "hp" | "bp";

/** A cutoff in Hz, fixed or as a function of time in seconds. */
export type Cutoff = number | ((t: number) => number);

/** One RBJ biquad section with its own state. */
export class Biquad {
  x1 = 0;
  x2 = 0;
  y1 = 0;
  y2 = 0;
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private readonly sr: number;

  constructor(sr: number) {
    this.sr = sr;
  }

  /** Sets the coefficients. `f` is clamped to 5 Hz .. 0.45 × the sample rate. */
  set(type: FilterType, f: number, q: number): this {
    const w = (2 * Math.PI * Math.min(Math.max(f, 5), this.sr * 0.45)) / this.sr;
    const c = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (type === "lp") {
      b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0;
    } else if (type === "hp") {
      b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0;
    } else {
      b0 = a; b1 = 0; b2 = -a;
    }
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
    return this;
  }

  /** Clears the state, keeps the coefficients. */
  reset(): void {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }

  /** Filters one sample. */
  p(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Filters `buf` in place through `stages` cascaded sections and returns it.
 * A time-varying cutoff is re-read every 32 samples.
 */
export function filt(buf: Float32Array, sr: number, type: FilterType, f: Cutoff, q = 0.707, stages = 1): Float32Array {
  for (let k = 0; k < stages; k++) {
    const bq = new Biquad(sr).set(type, typeof f === "function" ? f(0) : f, q);
    for (let i = 0; i < buf.length; i++) {
      if (typeof f === "function" && i % 32 === 0) bq.set(type, f(i / sr), q);
      buf[i] = bq.p(buf[i]!);
    }
  }
  return buf;
}
