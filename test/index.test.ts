import { describe, expect, it } from 'vitest';
import * as gapStat from '../src/index.js';

describe('public exports (index)', () => {
  it('exports the matrix helpers', () => {
    expect(typeof gapStat.transposed).toBe('function');
    expect(typeof gapStat.columnMin).toBe('function');
    expect(typeof gapStat.columnMax).toBe('function');
    expect(typeof gapStat.columnMean).toBe('function');
    expect(typeof gapStat.columnSum).toBe('function');
  });

  it('exports the rng helper', () => {
    expect(typeof gapStat.mulberry32).toBe('function');
  });

  it('exports the validators', () => {
    expect(typeof gapStat.assertValidMatrix).toBe('function');
    expect(typeof gapStat.assertValidClusterRange).toBe('function');
  });

  it('exports the clustering primitives', () => {
    expect(typeof gapStat.createKMeans).toBe('function');
    expect(typeof gapStat.defaultKMeans).toBe('function');
    expect(typeof gapStat.kmeansPlusPlus).toBe('function');
    expect(gapStat.DEFAULT_MAX_ITERATIONS).toBe(300);
  });

  it('exports the algorithm surface', () => {
    expect(typeof gapStat.dispersion).toBe('function');
    expect(typeof gapStat.uniformReference).toBe('function');
    expect(typeof gapStat.referenceDispersionStats).toBe('function');
    expect(typeof gapStat.gapStatistic).toBe('function');
  });

  it('exports the documented option defaults', () => {
    expect(gapStat.DEFAULT_K_MIN).toBe(1);
    expect(gapStat.DEFAULT_K_MAX).toBe(10);
    expect(gapStat.DEFAULT_BOOTSTRAP_COUNT).toBe(10);
  });
});
