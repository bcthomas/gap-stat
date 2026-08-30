import type { ClusteringFn, Rng } from './types.js';

/**
 * Maximum number of Lloyd's iterations performed by the built-in k-means.
 * The classic algorithm usually converges far sooner; the cap only guards
 * against pathological non-convergence.
 */
export const DEFAULT_MAX_ITERATIONS = 300;

export interface CreateKMeansOptions {
  /**
   * Cap on Lloyd's reassignment iterations. Default: {@link DEFAULT_MAX_ITERATIONS}.
   */
  readonly maxIterations?: number;
}

/** Squared Euclidean distance for equal-length rows. */
function squaredDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let dimension = 0; dimension < a.length; dimension++) {
    const diff = a[dimension]! - b[dimension]!;
    sum += diff * diff;
  }
  return sum;
}

const sumOf = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/**
 * K-means++ initialization (Arthur & Vassilvitskii 2007):
 * the first centroid is drawn uniformly at random; each subsequent one is
 * drawn with probability proportional to the squared distance to the nearest
 * centroid already chosen. Deterministic for a given `rng`; ties in the
 * weighted walk resolve to the lowest index. When the remaining total weight
 * is 0 (e.g. all remaining points coincide with chosen centroids), the next
 * centroid cycles through points by index.
 */
export function kmeansPlusPlus(
  data: readonly (readonly number[])[],
  k: number,
  rng: Rng,
): number[][] {
  const n = data.length;
  const centroids: number[][] = [];
  const minSquared = new Array<number>(n).fill(Number.POSITIVE_INFINITY);

  const adoptCentroid = (row: readonly number[]): void => {
    const centroid = [...row];
    centroids.push(centroid);
    for (let i = 0; i < n; i++) {
      const d2 = squaredDistance(data[i]!, centroid);
      if (d2 < minSquared[i]!) {
        minSquared[i] = d2;
      }
    }
  };

  adoptCentroid(data[Math.floor(rng() * n) % n]!);
  while (centroids.length < k) {
    const total = sumOf(minSquared);
    if (total === 0) {
      adoptCentroid(data[centroids.length % n]!);
      continue;
    }
    let target = rng() * total;
    let chosen = n - 1;
    for (let i = 0; i < n; i++) {
      target -= minSquared[i]!;
      if (target <= 0) {
        chosen = i;
        break;
      }
    }
    adoptCentroid(data[chosen]!);
  }
  return centroids;
}

function nearestCentroid(
  row: readonly number[],
  centroids: readonly (readonly number[])[],
): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let c = 0; c < centroids.length; c++) {
    const d2 = squaredDistance(row, centroids[c]!);
    if (d2 < bestDistance) {
      best = c;
      bestDistance = d2;
    }
  }
  return best;
}

function assign(
  data: readonly (readonly number[])[],
  centroids: readonly (readonly number[])[],
): number[] {
  return data.map((row) => nearestCentroid(row, centroids));
}

/**
 * Recomputes each centroid as the mean of its assigned points. A cluster
 * that currently has no members retains its previous centroid; empty
 * clusters are repaired afterwards by {@link fixEmptyClusters}.
 */
function recomputeCentroids(
  data: readonly (readonly number[])[],
  labels: readonly number[],
  previous: readonly (readonly number[])[],
): number[][] {
  const k = previous.length;
  const sums: number[][] = Array.from({ length: k }, () => []);
  const counts = new Array<number>(k).fill(0);
  for (let i = 0; i < data.length; i++) {
    const row = data[i]!;
    const clusterSums = sums[labels[i]!]!;
    for (let j = 0; j < row.length; j++) {
      clusterSums[j] = (clusterSums[j] ?? 0) + row[j]!;
    }
    counts[labels[i]!]! += 1;
  }
  return sums.map((clusterSums, c) =>
    counts[c]! > 0 ? clusterSums.map((sum) => sum / counts[c]!) : [...previous[c]!],
  );
}

/**
 * Guarantees no cluster stays empty: for each empty cluster, the point with
 * the largest distance to its own centroid — taken only from a cluster with
 * at least two members — is reassigned to it (and serves as its centroid).
 * Always possible because the caller guarantees `1 <= k <= data.length`, so
 * while an empty cluster exists some other cluster holds >= 2 points.
 * Mutates `labels` in place; the caller must treat the return value of
 * `assign` feeding it as the up-to-date label array.
 */
function repairEmptyClusters(
  data: readonly (readonly number[])[],
  centroids: readonly (readonly number[])[],
  labels: number[],
): void {
  const counts = new Array<number>(centroids.length).fill(0);
  for (const label of labels) {
    counts[label]! += 1;
  }
  const updated = centroids.map((centroid) => [...centroid]);

  for (let c = 0; c < updated.length; c++) {
    if (counts[c]! > 0) {
      continue;
    }
    let chooseIndex = -1;
    let furthest = -1;
    for (let i = 0; i < data.length; i++) {
      const own = labels[i]!;
      if (counts[own]! < 2) {
        continue; // never empty out a singleton cluster
      }
      const d2 = squaredDistance(data[i]!, updated[own]!);
      if (d2 > furthest) {
        furthest = d2;
        chooseIndex = i;
      }
    }
    if (chooseIndex >= 0) {
      const movedFrom = labels[chooseIndex]!;
      labels[chooseIndex] = c;
      counts[movedFrom]! -= 1;
      counts[c]! += 1;
      updated[c] = [...data[chooseIndex]!];
    }
  }
}

function labelsEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((label, i) => label === b[i]);
}

/**
 * Creates the built-in k-means {@link ClusteringFn}: k-means++ seeding
 * followed by Lloyd's iterations.
 *
 * Determinism: identical inputs and equally-seeded `rng` produce identical
 * labels — unlike 0.x, which silently depended on `Math.random()`.
 * Distance ties assign to the lowest centroid index. If a cluster collapses
 * to zero points, it is re-seeded at the globally furthest point (never
 * emptying a singleton cluster), so the returned labels cover exactly `k`
 * distinct, non-empty clusters and are always safe for the dispersion
 * computation.
 */
export function createKMeans(options: CreateKMeansOptions = {}): ClusteringFn {
  return (data, k, rng) => {
    if (!Number.isInteger(k) || k < 1) {
      throw new RangeError(`k must be an integer >= 1, got ${k}`);
    }
    if (k > data.length) {
      throw new RangeError(`k (${k}) cannot exceed the number of points (${data.length})`);
    }
    const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

    let centroids = kmeansPlusPlus(data, k, rng);
    let labels = assign(data, centroids);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const nextCentroids = recomputeCentroids(data, labels, centroids);
      // assign() produces fresh labels; repairEmptyClusters() fixes them in
      // place (no return value), so nextLabels is always label-safe.
      const nextLabels = assign(data, nextCentroids);
      repairEmptyClusters(data, nextCentroids, nextLabels);
      if (labelsEqual(nextLabels, labels)) {
        return nextLabels;
      }
      labels = nextLabels;
      centroids = nextCentroids;
    }
    return labels;
  };
}

/**
 * The default clustering algorithm used by {@link gapStatistic}:
 * k-means++ initialization + Lloyd's iterations (max 300).
 */
export const defaultKMeans: ClusteringFn = createKMeans();
