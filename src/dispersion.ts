/**
 * Computes log(W_k), the logarithm of the pooled within-cluster sum of
 * squares around cluster means (W_k in Tibshirani, Walther & Hastie 2001).
 *
 * Unlike the 0.x implementation, this function is **pure**: it receives
 * cluster labels instead of calling a clustering algorithm itself, so any
 * `ClusteringFn` output can feed it, and it can be tested without
 * randomness.
 *
 * Numerical notes:
 * - no intermediate rounding is applied (0.x rounded means to 5 decimals and
 *   squared terms to 2 — unnecessary precision loss);
 * - a point set whose within-cluster sum of squares is exactly 0 (e.g. all
 *   points identical, or k = n) yields `log(0) = -Infinity` by construction;
 * - tiny negative sums caused by floating-point cancellation are clamped to
 *   0 before the logarithm is taken.
 *
 * @param data validated rectangular matrix
 * @param labels one integer cluster index (>= 0) per row of `data`
 * @returns log(W_k); `-Infinity` when W_k is 0
 */
export function dispersion(
  data: readonly (readonly number[])[],
  labels: readonly number[],
): number {
  if (data.length === 0) {
    throw new RangeError('data must contain at least one point');
  }
  if (labels.length !== data.length) {
    throw new RangeError(
      `labels (${labels.length}) must have one entry per data point (${data.length})`,
    );
  }

  // Sparse per-cluster accumulators: sums and sums of squares per dimension.
  const sums: number[][] = [];
  const sumsOfSquares: number[][] = [];
  const counts: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const label = labels[i];
    if (label === undefined || !Number.isInteger(label) || label < 0) {
      throw new RangeError(`labels[${i}] must be a non-negative integer, got ${labels[i]}`);
    }
    const row = data[i]!;
    let clusterSums = sums[label];
    if (clusterSums === undefined) {
      clusterSums = [];
      sums[label] = clusterSums;
    }
    let clusterSquares = sumsOfSquares[label];
    if (clusterSquares === undefined) {
      clusterSquares = [];
      sumsOfSquares[label] = clusterSquares;
    }
    for (let j = 0; j < row.length; j++) {
      const value = row[j]!;
      clusterSquares[j] = (clusterSquares[j] ?? 0) + value * value;
      clusterSums[j] = (clusterSums[j] ?? 0) + value;
    }
    counts[label] = (counts[label] ?? 0) + 1;
  }

  let withinClusterSumOfSquares = 0;
  for (let c = 0; c < counts.length; c++) {
    const count = counts[c];
    if (count === undefined) {
      // Sparse label set: this cluster index was never used by any point.
      continue;
    }
    const clusterSums = sums[c]!;
    const clusterSquares = sumsOfSquares[c]!;
    for (let j = 0; j < clusterSums.length; j++) {
      withinClusterSumOfSquares += clusterSquares[j]! - clusterSums[j]! ** 2 / count;
    }
  }

  // Floating-point cancellation can push the total a hair below 0 when
  // clusters are perfectly tight; clamp before taking the log.
  return Math.log(Math.max(withinClusterSumOfSquares, 0));
}
