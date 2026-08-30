import type { Rng } from './types.js';

/**
 * A small, dependency-free, deterministic PRNG (mulberry32).
 *
 * Returns a generator producing values in `[0, 1)` that are fully
 * reproducible for a given `seed`. Use it wherever reproducibility matters:
 * reproducible bootstraps, deterministic k-means initializations, and
 * stable test fixtures. Negative seeds are normalized via unsigned shift.
 *
 * Pass `Math.random` explicitly when non-determinism is acceptable
 * (it is the runtime default in the public API).
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
