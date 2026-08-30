/**
 * Input validation shared by the public API.
 *
 * Validation errors are `TypeError` for wrong types and `RangeError` for
 * typed-but-invalid values (NaN/Infinity, empty input, out-of-range bounds).
 */

export interface ClusterRangeInput {
  readonly kMin: number;
  readonly kMax: number;
  readonly rowCount: number;
}

/**
 * Asserts that `data` is a non-empty, rectangular matrix of finite numbers.
 * Throws `TypeError` or `RangeError` otherwise.
 */
export function assertValidMatrix(data: readonly (readonly number[])[]): void {
  if (!Array.isArray(data)) {
    throw new TypeError('data must be an array of numeric rows');
  }
  if (data.length === 0) {
    throw new RangeError('data must contain at least one point');
  }
  const firstRow = data[0];
  if (firstRow === undefined || firstRow.length === 0) {
    throw new RangeError('each row of data must contain at least one numeric coordinate');
  }
  const width = firstRow.length;
  for (let row = 0; row < data.length; row++) {
    const values = data[row];
    if (!Array.isArray(values)) {
      throw new TypeError(`data[${row}] must be an array of numbers`);
    }
    if (values.length !== width) {
      throw new RangeError(
        `data must be rectangular: row ${row} has length ${values.length}, expected ${width}`,
      );
    }
    for (let column = 0; column < width; column++) {
      const value = values[column];
      if (typeof value !== 'number') {
        throw new TypeError(`data[${row}][${column}] must be a number, got ${typeof value}`);
      }
      if (!Number.isFinite(value)) {
        throw new RangeError(`data[${row}][${column}] must be finite, got ${value}`);
      }
    }
  }
}

/**
 * Asserts that the requested cluster range is sensible for the given data:
 * `kMin >= 1`, `kMax >= kMin`, and `kMax <=` the number of data points.
 */
export function assertValidClusterRange({ kMin, kMax, rowCount }: ClusterRangeInput): void {
  if (!Number.isInteger(kMin) || kMin < 1) {
    throw new RangeError(`kMin must be an integer >= 1, got ${kMin}`);
  }
  if (!Number.isInteger(kMax)) {
    throw new RangeError(`kMax must be an integer, got ${kMax}`);
  }
  if (kMax < kMin) {
    throw new RangeError(`kMax (${kMax}) must be >= kMin (${kMin})`);
  }
  if (kMax > rowCount) {
    throw new RangeError(`kMax (${kMax}) cannot exceed the number of data points (${rowCount})`);
  }
}
