import { describe, expect, it } from 'vitest';
import { gapStatistic } from '../src/gapStatistic.js';
import { mulberry32 } from '../src/random.js';
import type { ClusteringFn } from '../src/types.js';
import { plantedClusters } from './fixtures.js';

describe('gapStatistic', () => {
  it('finds 3 clusters in the planted dataset with golden gap values (seed 42)', () => {
    const result = gapStatistic(plantedClusters, { kMax: 5, rng: mulberry32(42) });
    expect(result.clusterSize).toBe(3);
    expect(result.gaps.map((gap) => gap)).toEqual(
      expect.arrayContaining([
        expect.closeTo(-0.5876548855837198, 12),
        expect.closeTo(1.4342847960835874, 12),
        expect.closeTo(2.178340158315848, 12),
        expect.closeTo(1.9484326523892372, 12),
        expect.closeTo(1.9046104708089207, 12),
      ]),
    );
  });

  it('reproduce the identical result for the same seed', () => {
    expect(gapStatistic(plantedClusters, { kMax: 5, rng: mulberry32(42) })).toStrictEqual(
      gapStatistic(plantedClusters, { kMax: 5, rng: mulberry32(42) }),
    );
  });

  it('is stable across seeds for planted data', () => {
    for (const seed of [7, 2025]) {
      const result = gapStatistic(plantedClusters, { kMax: 5, rng: mulberry32(seed) });
      expect(result.clusterSize).toBe(3);
    }
  });

  it('returns a frozen result with the full shape', () => {
    const result = gapStatistic(plantedClusters, { kMax: 5, rng: mulberry32(42) });
    expect(Object.isFrozen(result)).toBe(true);
    for (const key of ['gaps', 'dispersions', 'referenceMeans', 'referenceSds'] as const) {
      expect(result[key]).toHaveLength(5);
      expect(Object.isFrozen(result[key])).toBe(false);
    }
    expect(result.firstSeK).toBeNull();
    expect(result.clusterSize).toBeGreaterThanOrEqual(1);
    expect(result.clusterSize).toBeLessThanOrEqual(5);
  });

  it('computes the 1-SE rule when requested', () => {
    const result = gapStatistic(plantedClusters, {
      kMax: 6,
      bootstrapCount: 50,
      firstSeRule: true,
      rng: mulberry32(42),
    });
    expect(result.clusterSize).toBe(3);
    expect(result.firstSeK).toBe(3);
  });

  it('drives any pluggable ClusteringFn end to end', () => {
    // A deliberately trivial plugin: round-robin labels independent of data.
    const roundRobin: ClusteringFn = (rows, k) =>
      Array.from({ length: rows.length }, (_, i) => i % k);
    const result = gapStatistic(
      [
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ],
      {
        kMax: 2,
        clusteringFn: roundRobin,
        rng: mulberry32(1),
      },
    );
    // k=1: all points → log(10); k=2: round-robin pairs → log(8) for both
    expect(result.dispersions[0]).toBeCloseTo(Math.log(10), 12);
    expect(result.dispersions[1]).toBeCloseTo(Math.log(8), 12);
    expect(result.clusterSize).toBe(1);
  });

  it('respects the kMin/kMax window', () => {
    const result = gapStatistic(plantedClusters, {
      kMin: 3,
      kMax: 4,
      rng: mulberry32(42),
    });
    expect(result.gaps).toHaveLength(2);
    expect(result.dispersions).toHaveLength(2);
    expect(result.clusterSize).toBeGreaterThanOrEqual(3);
    expect(result.clusterSize).toBeLessThanOrEqual(4);
  });

  it('rejects empty data', () => {
    expect(() => gapStatistic([], { kMax: 2 })).toThrow(RangeError);
  });

  it('rejects kMax above the number of points', () => {
    expect(() =>
      gapStatistic(
        [
          [1, 2],
          [3, 4],
        ],
        { kMax: 3 },
      ),
    ).toThrow(/cannot exceed the number of data points/);
  });

  it('rejects invalid bootstrapCount', () => {
    expect(() => gapStatistic(plantedClusters, { bootstrapCount: 0, rng: mulberry32(1) })).toThrow(
      /bootstrapCount must be an integer >= 1/,
    );
    expect(() =>
      gapStatistic(plantedClusters, { bootstrapCount: 2.5, rng: mulberry32(1) }),
    ).toThrow(RangeError);
  });

  it('uses deterministic defaults when no options are passed', () => {
    const seeded = gapStatistic(plantedClusters, { kMax: 3, rng: mulberry32(42) });
    // default rng is Math.random; only assert shape, not values
    const result = gapStatistic(plantedClusters, { kMax: 3 });
    expect(result.gaps).toHaveLength(3);
    expect(result).not.toStrictEqual(seeded);
  });
});
