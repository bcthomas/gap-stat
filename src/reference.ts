import { columnMax, columnMin } from './matrix.js';
import type { Rng } from './types.js';

/**
 * Generates a reference distribution by drawing each coordinate uniformly
 * from its column's observed `[min, max)` range — the null model from the
 * gap-statistic paper.
 *
 * Unlike the 0.x implementation, draws are *continuous* (not floored to
 * integers), which keeps the reference distribution smooth and keeps the
 * bootstrap unbiased for real-valued data.
 */
export function uniformReference(data: readonly (readonly number[])[], rng: Rng): number[][] {
  if (data.length === 0) {
    throw new RangeError('data must contain at least one point');
  }
  const mins = columnMin(data);
  const maxs = columnMax(data);
  return Array.from({ length: data.length }, () =>
    Array.from({ length: mins.length }, (_, column) => {
      const low = mins[column]!;
      return low + rng() * (maxs[column]! - low);
    }),
  );
}

export interface ReferenceDispersionStats {
  /** Mean of the bootstrap dispersions. */
  readonly mean: number;
  /**
   * Bootstrap standard deviation with the paper's `sqrt(1 + 1/B)` bias
   * correction — the `s_k` in the gap statistic and its 1-SE rule.
   */
  readonly sd: number;
}

/**
 * Mean and standard deviation of a set of bootstrap reference dispersions.
 * Matches the 0.x formula (population SD divided by `sqrt(1 + 1/B)`), which
 * follows Tibshirani et al. 2001.
 */
export function referenceDispersionStats(dispersions: readonly number[]): ReferenceDispersionStats {
  if (dispersions.length === 0) {
    throw new RangeError('dispersions must contain at least one value');
  }
  const b = dispersions.length;
  const mean = dispersions.reduce((total, value) => total + value, 0) / b;
  const deviates = dispersions.reduce((total, value) => total + (value - mean) ** 2, 0);
  const sd = Math.sqrt(deviates / b) / Math.sqrt(1 + 1 / b);
  return { mean, sd };
}
