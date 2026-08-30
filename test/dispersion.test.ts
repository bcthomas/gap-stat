import { describe, expect, it } from 'vitest';
import { dispersion } from '../src/dispersion.js';

const twoClusterData = [
  [0, 0],
  [0, 2],
  [2, 0],
  [6, 6],
  [6, 8],
];

describe('dispersion', () => {
  it('computes the golden log within-cluster sum of squares', () => {
    expect(dispersion(twoClusterData, [0, 0, 0, 1, 1])).toBeCloseTo(1.9924301646902063, 12);
  });

  it('matches a direct two-pass computation of the same quantity', () => {
    const labels = [0, 0, 0, 1, 1];
    // Direct definition: sum over clusters of sum over points of squared
    // distance to that cluster's mean.
    let direct = 0;
    for (const cluster of [0, 1]) {
      const members = twoClusterData.filter((_, i) => labels[i] === cluster);
      const dims = 2;
      for (let j = 0; j < dims; j++) {
        const mean = members.reduce((sum, row) => sum + row[j]!, 0) / members.length;
        for (const row of members) {
          direct += (row[j]! - mean) ** 2;
        }
      }
    }
    expect(dispersion(twoClusterData, labels)).toBeCloseTo(Math.log(direct), 12);
  });

  it('yields -Infinity when every cluster is a single point (W_k = 0)', () => {
    expect(
      dispersion(
        [
          [5, 5],
          [1, 1],
        ],
        [0, 1],
      ),
    ).toBe(Number.NEGATIVE_INFINITY);
  });

  it('yields -Infinity for identical duplicate points', () => {
    expect(
      dispersion(
        [
          [3, 3],
          [3, 3],
        ],
        [0, 0],
      ),
    ).toBe(Number.NEGATIVE_INFINITY);
  });

  it('is invariant under row permutation', () => {
    const data = [
      [1, 7],
      [2, 6],
      [9, 1],
      [10, 0],
      [3, 5],
    ];
    const labels = [0, 0, 1, 1, 0];
    const permuted = [
      [10, 0],
      [1, 7],
      [3, 5],
      [2, 6],
      [9, 1],
    ];
    const permutedLabels = [1, 0, 0, 0, 1];
    expect(dispersion(permuted, permutedLabels)).toBeCloseTo(dispersion(data, labels), 12);
  });

  it('rejects label count mismatch', () => {
    expect(() => dispersion(twoClusterData, [0, 0])).toThrow(/must have one entry per data point/);
  });

  it('rejects negative and non-integer labels', () => {
    expect(() => dispersion(twoClusterData, [0, 0, 0, 1, -1])).toThrow(
      /must be a non-negative integer/,
    );
    expect(() => dispersion(twoClusterData, [0, 0, 0, 1, 0.5])).toThrow(
      /must be a non-negative integer/,
    );
  });

  it('rejects empty data', () => {
    expect(() => dispersion([], [])).toThrow(RangeError);
  });

  it('tolerates sparse cluster indices (gaps in labels)', () => {
    // clusters 0 and 2 exist; no points labelled 1 — still valid
    expect(
      dispersion(
        [
          [0, 0],
          [9, 9],
        ],
        [0, 2],
      ),
    ).toBe(Number.NEGATIVE_INFINITY);
  });
});
