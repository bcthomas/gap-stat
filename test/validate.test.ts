import { describe, expect, it } from 'vitest';
import { assertValidClusterRange, assertValidMatrix } from '../src/validate.js';

/** Deliberately lies to the type system: validation exists to reject
 * malformed input at runtime (e.g. from untyped JS callers). */
function asMatrix(value: unknown): readonly (readonly number[])[] {
  return value as readonly (readonly number[])[];
}

describe('assertValidMatrix', () => {
  it('accepts a valid matrix', () => {
    expect(() =>
      assertValidMatrix([
        [1, 2],
        [3, 4],
        [5, 6],
      ]),
    ).not.toThrow();
  });

  it('rejects non-array input with TypeError', () => {
    expect(() => assertValidMatrix(asMatrix('not a matrix'))).toThrow(TypeError);
    expect(() => assertValidMatrix(asMatrix(undefined))).toThrow(TypeError);
  });

  it('rejects an empty matrix with RangeError', () => {
    expect(() => assertValidMatrix([])).toThrow(RangeError);
  });

  it('rejects rows without coordinates with RangeError', () => {
    expect(() => assertValidMatrix([[]])).toThrow(RangeError);
  });

  it('rejects ragged matrices with RangeError and identifies the row', () => {
    expect(() => assertValidMatrix([[1, 2], [3]])).toThrow(/row 1 has length 1, expected 2/);
  });

  it('rejects non-numeric cells with TypeError', () => {
    expect(() => assertValidMatrix([[1, '2' as unknown as number]])).toThrow(TypeError);
    expect(() => assertValidMatrix([[Number('x') as unknown as number]])).toThrow(RangeError);
  });

  it('rejects NaN and Infinity with RangeError', () => {
    expect(() => assertValidMatrix([[Number.NaN]])).toThrow(RangeError);
    expect(() => assertValidMatrix([[Number.POSITIVE_INFINITY]])).toThrow(RangeError);
    expect(() => assertValidMatrix([[Number.NEGATIVE_INFINITY]])).toThrow(RangeError);
  });

  it('rejects nested non-arrays', () => {
    expect(() => assertValidMatrix([1 as unknown as number[]])).toThrow(TypeError);
  });
});

describe('assertValidClusterRange', () => {
  const rowCount = 10;

  it('accepts a valid range', () => {
    expect(() => assertValidClusterRange({ kMin: 1, kMax: 10, rowCount })).not.toThrow();
    expect(() => assertValidClusterRange({ kMin: 5, kMax: 5, rowCount })).not.toThrow();
  });

  it('rejects kMin below 1', () => {
    expect(() => assertValidClusterRange({ kMin: 0, kMax: 5, rowCount })).toThrow(
      /kMin must be an integer >= 1/,
    );
  });

  it('rejects non-integer bounds', () => {
    expect(() => assertValidClusterRange({ kMin: 1.5, kMax: 5, rowCount })).toThrow(RangeError);
    expect(() => assertValidClusterRange({ kMin: 1, kMax: 5.5, rowCount })).toThrow(RangeError);
  });

  it('rejects kMax < kMin', () => {
    expect(() => assertValidClusterRange({ kMin: 3, kMax: 2, rowCount })).toThrow(/>= kMin/);
  });

  it('rejects kMax exceeding the number of points', () => {
    expect(() => assertValidClusterRange({ kMin: 1, kMax: 11, rowCount })).toThrow(
      /cannot exceed the number of data points \(10\)/,
    );
  });
});
