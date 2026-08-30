import { describe, expect, it } from 'vitest';
import { columnMax, columnMean, columnMin, columnSum, transposed } from '../src/matrix.js';

// Ported from the 0.x mocha suite and extended with edge cases.
describe('transposed', () => {
  it('transforms an array', () => {
    const d = [
      [1, 2, 6],
      [6, 7, 8],
      [5, 9, 2],
    ];
    expect(transposed(d)).toStrictEqual([
      [1, 6, 5],
      [2, 7, 9],
      [6, 8, 2],
    ]);
  });

  it('returns [] for an empty matrix', () => {
    expect(transposed([])).toStrictEqual([]);
  });

  it('handles non-square (rectangular) matrices', () => {
    const d = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ];
    expect(transposed(d)).toStrictEqual([
      [1, 5],
      [2, 6],
      [3, 7],
      [4, 8],
    ]);
  });

  it('handles single-row and single-column matrices', () => {
    expect(transposed([[9, 8, 7]])).toStrictEqual([[9], [8], [7]]);
    expect(transposed([[9], [8], [7]])).toStrictEqual([[9, 8, 7]]);
  });

  it('preserves negative and fractional values', () => {
    const d = [
      [-1.5, 0.25],
      [2, -0.75],
    ];
    expect(transposed(d)).toStrictEqual([
      [-1.5, 2],
      [0.25, -0.75],
    ]);
  });

  it('does not mutate the input', () => {
    const d = [
      [1, 2],
      [3, 4],
    ];
    transposed(d);
    expect(d).toStrictEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe('columnMin', () => {
  it('calculates column mins for an array', () => {
    const d = [
      [1, 2, 6],
      [6, 7, 8],
      [5, 9, 2],
    ];
    expect(columnMin(d)).toStrictEqual([1, 2, 2]);
  });

  it('returns [] for an empty matrix', () => {
    expect(columnMin([])).toStrictEqual([]);
  });
});

describe('columnMax', () => {
  it('calculates column maxs for an array', () => {
    const d = [
      [1, 2, 6],
      [6, 7, 8],
      [5, 9, 2],
    ];
    expect(columnMax(d)).toStrictEqual([6, 9, 8]);
  });

  it('returns [] for an empty matrix', () => {
    expect(columnMax([])).toStrictEqual([]);
  });
});

describe('columnMean', () => {
  it('calculates column means for an array', () => {
    const d = [
      [1, 2, 6],
      [6, 7, 8],
      [5, 9, 1],
    ];
    expect(columnMean(d)).toStrictEqual([4, 6, 5]);
  });

  it('carries full precision (no intermediate rounding)', () => {
    const d = [[0.1], [0.2]];
    expect(columnMean(d)).toStrictEqual([0.15000000000000002]);
  });
});

describe('columnSum', () => {
  it('calculates column sums for an array', () => {
    const d = [
      [1, 2, 6],
      [6, 7, 8],
      [5, 9, 1],
    ];
    expect(columnSum(d)).toStrictEqual([12, 18, 15]);
  });
});
