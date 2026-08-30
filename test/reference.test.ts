import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/random.js';
import { referenceDispersionStats, uniformReference } from '../src/reference.js';

describe('uniformReference', () => {
  it('preserves dimensions', () => {
    const data = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const reference = uniformReference(data, mulberry32(42));
    expect(reference).toHaveLength(3);
    for (const row of reference) {
      expect(row).toHaveLength(3);
    }
  });

  it('draws within each column’s [min, max) range, including negatives', () => {
    const data = [
      [-10, 2, 90],
      [2, 7, 98],
      [3, 9, 92],
      [1, 3, 95],
    ];
    const reference = uniformReference(data, mulberry32(42));
    expect(reference).toHaveLength(4);
    for (const row of reference) {
      expect(row[0]).toBeGreaterThanOrEqual(-10);
      expect(row[0]).toBeLessThan(3);
      expect(row[1]).toBeGreaterThanOrEqual(2);
      expect(row[1]).toBeLessThan(9);
      expect(row[2]).toBeGreaterThanOrEqual(90);
      expect(row[2]).toBeLessThan(98);
    }
  });

  it('produces continuous (non-integer) draws', () => {
    const data = [
      [0, 0],
      [10, 10],
    ];
    const values = uniformReference(data, mulberry32(42)).flat();
    expect(values.some((value) => !Number.isInteger(value))).toBe(true);
  });

  it('is reproducible for a given seed', () => {
    const data = [
      [1, 2],
      [5, 9],
      [2, 3],
    ];
    expect(uniformReference(data, mulberry32(7))).toStrictEqual(
      uniformReference(data, mulberry32(7)),
    );
  });

  it('produces different draws for different seeds', () => {
    const data = [
      [1, 2],
      [5, 9],
      [2, 3],
    ];
    expect(uniformReference(data, mulberry32(1))).not.toStrictEqual(
      uniformReference(data, mulberry32(2)),
    );
  });

  it('rejects empty data', () => {
    expect(() => uniformReference([], mulberry32(1))).toThrow(RangeError);
  });
});

describe('referenceDispersionStats', () => {
  it('matches the golden mean and bias-corrected SD for [0, 2]', () => {
    // mean = 1; sd = sqrt(((0-1)^2+(2-1)^2)/2) / sqrt(1 + 1/2)
    //          = 1 / sqrt(1.5) = 0.8164965809277261
    const { mean, sd } = referenceDispersionStats([0, 2]);
    expect(mean).toBe(1);
    expect(sd).toBeCloseTo(0.8164965809277261, 12);
  });

  it('yields sd 0 for a single bootstrap value', () => {
    const { mean, sd } = referenceDispersionStats([5]);
    expect(mean).toBe(5);
    expect(sd).toBe(0);
  });

  it('rejects an empty dispersion set', () => {
    expect(() => referenceDispersionStats([])).toThrow(RangeError);
  });
});
