import { dispersion } from './dispersion.js';
import { defaultKMeans } from './kmeans.js';
import { referenceDispersionStats, uniformReference } from './reference.js';
import type { GapStatisticOptions, GapStatisticResult } from './types.js';
import { assertValidClusterRange, assertValidMatrix } from './validate.js';

export const DEFAULT_K_MIN = 1;
export const DEFAULT_K_MAX = 10;
/**
 * Default number of bootstrap reference distributions. The Tibshirani 1-SE
 * rule becomes meaningful only at larger counts (the paper suggests B = 50+),
 * so pass `bootstrapCount` explicitly when using `firstSeRule`.
 */
export const DEFAULT_BOOTSTRAP_COUNT = 10;

/**
 * Estimates the number of clusters in `data` with the gap statistic
 * (Tibshirani, Walther & Hastie 2001).
 *
 * For each k in `[kMin, kMax]` the observed log within-dispersion is
 * compared against the mean dispersion of `bootstrapCount` reference
 * datasets (by default drawn uniformly over each column's observed range).
 * The recommended cluster count is the k with the largest gap; with
 * `firstSeRule: true` the smallest k satisfying GAP(k) >= GAP(k+1) − s_(k+1)
 * is also reported as `firstSeK`.
 *
 * The clustering algorithm itself is pluggable: pass any
 * {@link ClusteringFn} via `options.clusteringFn`. It is invoked once per
 * observed k plus once per bootstrap per k (i.e. `(kMax − kMin + 1) ×
 * (bootstrapCount + 1)` times), so slow algorithms multiply accordingly.
 *
 * @param data validated, rectangular matrix of numeric points
 * @param options see {@link GapStatisticOptions}; all fields optional
 */
export function gapStatistic(
  data: readonly (readonly number[])[],
  options: GapStatisticOptions = {},
): GapStatisticResult {
  assertValidMatrix(data);
  const kMin = options.kMin ?? DEFAULT_K_MIN;
  const kMax = options.kMax ?? DEFAULT_K_MAX;
  const bootstrapCount = options.bootstrapCount ?? DEFAULT_BOOTSTRAP_COUNT;
  if (!Number.isInteger(bootstrapCount) || bootstrapCount < 1) {
    throw new RangeError(`bootstrapCount must be an integer >= 1, got ${bootstrapCount}`);
  }
  const clusteringFn = options.clusteringFn ?? defaultKMeans;
  const referenceDistribution = options.referenceDistribution ?? uniformReference;
  const rng = options.rng ?? Math.random;
  const firstSeRule = options.firstSeRule ?? false;

  assertValidClusterRange({ kMin, kMax, rowCount: data.length });

  const ks = Array.from({ length: kMax - kMin + 1 }, (_, index) => kMin + index);

  const dispersions = ks.map((k) => dispersion(data, clusteringFn(data, k, rng)));

  const referenceMeans: number[] = [];
  const referenceSds: number[] = [];
  for (const k of ks) {
    const bootstrap = Array.from({ length: bootstrapCount }, () => {
      const reference = referenceDistribution(data, rng);
      return dispersion(reference, clusteringFn(reference, k, rng));
    });
    const stats = referenceDispersionStats(bootstrap);
    referenceMeans.push(stats.mean);
    referenceSds.push(stats.sd);
  }

  const gaps = ks.map((_, index) => referenceMeans[index]! - dispersions[index]!);

  let bestIndex = 0;
  for (let index = 1; index < gaps.length; index++) {
    if (gaps[index]! > gaps[bestIndex]!) {
      bestIndex = index;
    }
  }
  const clusterSize = ks[bestIndex]!;

  let firstSeK: number | null = null;
  if (firstSeRule) {
    // Smallest k with GAP(k) >= GAP(k+1) - s_(k+1) (the 1-SE rule). Falls
    // back to the global argmax when no adjacent pair satisfies it.
    for (let index = 0; index < ks.length - 1; index++) {
      if (gaps[index]! >= gaps[index + 1]! - referenceSds[index + 1]!) {
        firstSeK = ks[index]!;
        break;
      }
    }
    firstSeK ??= clusterSize;
  }

  return Object.freeze({
    clusterSize,
    gaps,
    dispersions,
    referenceMeans,
    referenceSds,
    firstSeK,
  });
}
