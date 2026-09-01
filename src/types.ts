/**
 * Public type definitions for gap-stat.
 *
 * These types exist up front (Phase 1) so that every later module — the
 * built-in k-means, the dispersion function, and `gapStatistic` itself —
 * can be written against the final public API contract.
 */

/**
 * A source of uniform randomness returning values in `[0, 1)`.
 *
 * Replaces direct `Math.random()` calls so that every part of the
 * algorithm (reference bootstraps, k-means initialization) can be made
 * deterministic in tests by injecting a seeded generator, e.g. `mulberry32(42)`.
 */
export type Rng = () => number;

/**
 * The pluggable clustering seam of the library.
 *
 * A `ClusteringFn` assigns each point in `data` to one of `k` clusters:
 * the returned labels array must have the same length as `data`, where
 * `labels[i]` is the cluster index (a non-negative integer `< k`) of `data[i]`.
 *
 * The built-in k-means implementation (k-means++ init + Lloyd's iterations)
 * is the default; users may supply any algorithm of their choice here.
 */
export type ClusteringFn = (
  data: readonly (readonly number[])[],
  k: number,
  rng: Rng,
) => readonly number[];

/**
 * Generates a reference distribution — a matrix with the same dimensions
 * as `data` drawn from a null model (uniform-in-range by default, per
 * Tibshirani, Walther & Hastie 2001).
 */
export type ReferenceDistributionFn = (
  data: readonly (readonly number[])[],
  rng: Rng,
) => number[][];

export interface GapStatisticOptions {
  /** Smallest cluster count to evaluate. Must be an integer >= 1. Default: 1. */
  readonly kMin?: number;
  /** Largest cluster count to evaluate. Must be an integer >= kMin and <= data.length. Default: 10. */
  readonly kMax?: number;
  /**
   * Number of bootstrap reference distributions. Default: 10.
   * The 1-SE rule (`firstSeRule`) is only meaningful with a larger count
   * (the paper suggests B = 50+).
   */
  readonly bootstrapCount?: number;
  /** Clustering algorithm to evaluate. Default: built-in k-means. */
  readonly clusteringFn?: ClusteringFn;
  /** Reference distribution generator. Default: uniform over each column's range. */
  readonly referenceDistribution?: ReferenceDistributionFn;
  /** Source of randomness. Default: `Math.random`. */
  readonly rng?: Rng;
  /** Also compute the Tibshirani 1-SE rule pick (`firstSeK`). Default: false. */
  readonly firstSeRule?: boolean;
}

export interface GapStatisticResult {
  /** `k` with the largest gap value (the recommended number of clusters). */
  readonly clusterSize: number;
  /** GAP_k = mean reference dispersion − observed dispersion, per requested k.
   * Fully degenerate data (all observed and reference W_k equal 0) yields NaN
   * gaps; `clusterSize` then falls back to the smallest requested k. */
  readonly gaps: readonly number[];
  /** Observed log(W_k) dispersion for each requested k. */
  readonly dispersions: readonly number[];
  /** Mean dispersion of the bootstrap reference distributions, per k. */
  readonly referenceMeans: readonly number[];
  /** Bootstrap standard deviation (with the paper's 1+1/B correction), per k. */
  readonly referenceSds: readonly number[];
  /**
   * Smallest k such that GAP(k) >= GAP(k+1) − (k+1)-th reference SD,
   * per the 1-SE rule; `null` if `firstSeRule` was disabled.
   */
  readonly firstSeK: number | null;
}
