/**
 * Pure matrix primitives shared across the gap statistic implementation.
 *
 * These replace the `underscore` helpers used by the 0.x implementation.
 * All functions expect a validated, rectangular matrix (see
 * `assertValidMatrix`), never mutate their inputs, and return new arrays.
 */

/**
 * Returns the transpose of `matrix` — rows become columns and vice versa.
 * Returns `[]` for an empty matrix.
 */
export function transposed(matrix: readonly (readonly number[])[]): number[][] {
  if (matrix.length === 0) {
    return [];
  }
  const firstRow = matrix[0];
  if (firstRow === undefined) {
    return [];
  }
  const height = matrix.length;
  const width = firstRow.length;
  const output: number[][] = [];
  for (let column = 0; column < width; column++) {
    const valuesOnColumn: number[] = [];
    for (let row = 0; row < height; row++) {
      // Rows and columns are within bounds by loop construction.
      valuesOnColumn.push(matrix[row]![column]!);
    }
    output.push(valuesOnColumn);
  }
  return output;
}

/** Smallest value in each column. Returns `[]` for an empty matrix. */
export function columnMin(matrix: readonly (readonly number[])[]): number[] {
  return transposed(matrix).map((column) =>
    column.reduce((min, value) => (value < min ? value : min)),
  );
}

/** Largest value in each column. Returns `[]` for an empty matrix. */
export function columnMax(matrix: readonly (readonly number[])[]): number[] {
  return transposed(matrix).map((column) =>
    column.reduce((max, value) => (value > max ? value : max)),
  );
}

/** Per-column sum. Returns `[]` for an empty matrix. */
export function columnSum(matrix: readonly (readonly number[])[]): number[] {
  return transposed(matrix).map((column) => column.reduce((sum, value) => sum + value, 0));
}

/**
 * Per-column arithmetic mean. Returns `[]` for an empty matrix.
 *
 * Note: unlike the 0.x implementation, no intermediate rounding is applied —
 * results carry full double precision.
 */
export function columnMean(matrix: readonly (readonly number[])[]): number[] {
  return transposed(matrix).map(
    (column) => column.reduce((sum, value) => sum + value, 0) / column.length,
  );
}
