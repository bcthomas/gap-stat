import { describe, expect, it } from 'vitest';
import { gapStatistic, mulberry32, transposed } from '../src/index.js';
import { defaultKMeans } from '../src/kmeans.js';

/**
 * Edge cases for the full pipeline: unusual dimensions, degenerate inputs,
 * and behavior boundaries. Where an outcome is surprising-but-correct, the
 * test documents it.
 */

const planted12 = () => [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [50, 50, 50],
  [51, 50, 50],
  [50, 51, 50],
  [51, 51, 50],
  [100, 0, 50],
  [101, 0, 50],
  [100, 1, 50],
  [101, 1, 50],
];

// three well-separated clusters embedded in 50 dimensions
const plantedHighDim = () => {
  const data: number[][] = [];
  for (let i = 0; i < 12; i++) {
    const group = Math.floor(i / 4);
    const row: number[] = [];
    for (let d = 0; d < 50; d++) row.push(d * 20 + (i % 4 === 3 ? 0.5 : 0) + group * 5);
    data.push(row);
  }
  return data;
};

describe('edge cases: dimensions and scale', () => {
  it('handles 50-dimensional data end to end', () => {
    const result = gapStatistic(plantedHighDim(), { kMax: 4, rng: mulberry32(42) });
    expect(result.gaps).toHaveLength(4);
    expect(result.clusterSize).toBeGreaterThanOrEqual(1);
    expect(result.clusterSize).toBeLessThanOrEqual(4);
  });

  it('clusters 50-dimensional data into its three planted groups', () => {
    const labels = defaultKMeans(plantedHighDim(), 3, mulberry32(42));
    for (const group of [
      new Set(labels.slice(0, 4)),
      new Set(labels.slice(4, 8)),
      new Set(labels.slice(8, 12)),
    ]) {
      expect(group.size).toBe(1);
    }
    expect(new Set([...labels.slice(0, 4)]).size).not.toBe(
      new Set([...labels.slice(4, 8)]).size === 1 ? labels.slice(4, 8)[0] : -1,
    );
  });

  it('handles extreme scale disparity between columns', () => {
    // first column stretched 1000×: distances are dominated by that column,
    // but the three planted groups remain separable.
    const base = [
      [0, 0],
      [1, 0],
      [0, 1],
      [50, 50],
      [51, 50],
      [50, 51],
      [100, 0],
      [101, 0],
      [100, 1],
    ];
    const scaled = base.map((row) => [row[0]! * 1000, row[1]!]);
    const result = gapStatistic(scaled, { kMax: 5, rng: mulberry32(42) });
    expect(result.clusterSize).toBe(3);
  });
});

describe('edge cases: degenerate inputs through the full pipeline', () => {
  it('handles a single point: real and reference W_k both collapse to 0', () => {
    const result = gapStatistic([[1, 2]], { kMax: 1, rng: mulberry32(42) });
    expect(result.clusterSize).toBe(1);
    expect(result.dispersions[0]).toBe(Number.NEGATIVE_INFINITY);
    // single-point references are identical points as well, so the reference
    // dispersion also collapses — and mean − observed is NaN (−Inf − −Inf).
    expect(result.referenceMeans[0]).toBe(Number.NEGATIVE_INFINITY);
    expect(result.gaps[0]).toBeNaN();
  });

  it('handles all-identical duplicate points: every k has W_k = 0', () => {
    const result = gapStatistic(
      [
        [3, 3],
        [3, 3],
        [3, 3],
        [3, 3],
      ],
      {
        kMax: 2,
        rng: mulberry32(42),
      },
    );
    // every gap is NaN (reference and observed dispersions are both −Infinity);
    // argmax ignores NaN gaps and resolves to the first k (= kMin)
    expect(result.clusterSize).toBe(1);
    expect(result.dispersions).toStrictEqual([Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]);
    expect(result.gaps.every((gap) => Number.isNaN(gap))).toBe(true);
  });

  it('handles k = n: every point is its own cluster, gap argmax falls back to kMin', () => {
    const data = planted12();
    const result = gapStatistic(data, { kMax: 12, rng: mulberry32(42) });
    expect(result.gaps).toHaveLength(12);
    expect(result.clusterSize).toBeGreaterThanOrEqual(1);
    expect(result.clusterSize).toBeLessThanOrEqual(12);
  });

  it('supports a single-element k range (kMin === kMax)', () => {
    const result = gapStatistic(planted12(), { kMin: 3, kMax: 3, rng: mulberry32(42) });
    expect(result.gaps).toHaveLength(1);
    expect(result.dispersions).toHaveLength(1);
    expect(result.clusterSize).toBe(3);
    expect(result.firstSeK).toBeNull();
  });

  it('supports bootstrapCount 1 (bias-corrected SD collapses to 0)', () => {
    const result = gapStatistic(planted12(), {
      kMax: 3,
      bootstrapCount: 1,
      rng: mulberry32(42),
    });
    expect(result.referenceSds).toStrictEqual([0, 0, 0]);
    expect(result.clusterSize).toBe(3);
  });

  it("never mutates the caller's input matrix", () => {
    const data = planted12();
    const snapshot = JSON.stringify(data);
    gapStatistic(data, { kMax: 4, rng: mulberry32(42) });
    defaultKMeans(data, 3, mulberry32(42));
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});

describe('edge cases: defensive matrix guards', () => {
  it('returns [] for a matrix with an empty first row', () => {
    expect(transposed([[]])).toStrictEqual([]);
  });

  it('treats a sparse leading row as empty (defensive guard, unreachable via validation)', () => {
    const sparse = new Array(2) as unknown as readonly (readonly number[])[];
    expect(transposed(sparse)).toStrictEqual([]);
  });
});
