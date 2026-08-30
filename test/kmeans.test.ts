import { describe, expect, it } from 'vitest';
import {
  createKMeans,
  DEFAULT_MAX_ITERATIONS,
  defaultKMeans,
  kmeansPlusPlus,
} from '../src/kmeans.js';
import { mulberry32 } from '../src/random.js';
import { plantedClusters } from './fixtures.js';

describe('defaultKMeans', () => {
  it('is deterministic for a given seed', () => {
    const first = defaultKMeans(plantedClusters, 3, mulberry32(42));
    const second = defaultKMeans(plantedClusters, 3, mulberry32(42));
    expect(first).toStrictEqual(second);
  });

  it('matches the golden labels for the planted dataset (seed 42, k=3)', () => {
    const labels = defaultKMeans(plantedClusters, 3, mulberry32(42));
    expect(labels).toStrictEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    ]);
  });

  it('separates three planted clusters without mixing groups', () => {
    const labels = defaultKMeans(plantedClusters, 3, mulberry32(42));
    const groupALabels = new Set(labels.slice(0, 10));
    const groupBLabels = new Set(labels.slice(10, 20));
    const groupCLabels = new Set(labels.slice(20, 30));
    for (const group of [groupALabels, groupBLabels, groupCLabels]) {
      expect(group.size).toBe(1);
    }
    expect([...groupALabels][0]).not.toBe([...groupBLabels][0]);
    expect([...groupBLabels][0]).not.toBe([...groupCLabels][0]);
  });

  it('assigns everything to one cluster for k=1', () => {
    expect(defaultKMeans(plantedClusters, 1, mulberry32(42))).toStrictEqual(new Array(30).fill(0));
  });

  it('gives every point its own cluster for k=n', () => {
    const simple = [
      [0, 0],
      [1, 1],
      [5, 5],
      [6, 6],
      [10, 10],
      [11, 11],
    ];
    const labels = defaultKMeans(simple, 6, mulberry32(42));
    expect(new Set(labels).size).toBe(6);
  });

  it('repairs empty clusters (all-identical points, k=3)', () => {
    // Every point is identical: k-means++ converges on cluster 0, so two
    // clusters start empty and are re-seeded from the furthest points.
    const duplicates = new Array(6).fill([3, 3]);
    const labels = defaultKMeans(duplicates, 3, mulberry32(42));
    expect(labels).toHaveLength(6);
    expect(new Set(labels).size).toBe(3);
    for (const label of labels) {
      expect(label).toBeGreaterThanOrEqual(0);
      expect(label).toBeLessThan(3);
    }
  });

  it('throws for invalid k', () => {
    expect(() => defaultKMeans(plantedClusters, 0, mulberry32(42))).toThrow(RangeError);
    expect(() => defaultKMeans(plantedClusters, 1.5, mulberry32(42))).toThrow(RangeError);
    expect(() => defaultKMeans(plantedClusters, 31, mulberry32(42))).toThrow(
      /cannot exceed the number of points/,
    );
  });
});

describe('createKMeans', () => {
  it('exposes the default iteration cap', () => {
    expect(DEFAULT_MAX_ITERATIONS).toBe(300);
  });

  it('accepts a custom maxIterations and still returns valid labels', () => {
    const meanFaultyKMeans = createKMeans({ maxIterations: 0 });
    const labels = meanFaultyKMeans(plantedClusters, 3, mulberry32(42));
    expect(labels).toHaveLength(30);
    for (const label of labels) {
      expect(label).toBeGreaterThanOrEqual(0);
      expect(label).toBeLessThan(3);
    }
  });

  it('defaultKMeans shares the createKMeans implementation', () => {
    const manual = createKMeans()(plantedClusters, 3, mulberry32(42));
    expect(defaultKMeans(plantedClusters, 3, mulberry32(42))).toStrictEqual(manual);
  });
});

describe('kmeansPlusPlus', () => {
  it('picks k well-separated centroids deterministically', () => {
    const simple = [
      [0, 0],
      [1, 1],
      [5, 5],
      [6, 6],
      [10, 10],
      [11, 11],
    ];
    expect(kmeansPlusPlus(simple, 3, mulberry32(42))).toStrictEqual([
      [6, 6],
      [1, 1],
      [11, 11],
    ]);
    // same seed => same centroids
    expect(kmeansPlusPlus(simple, 3, mulberry32(42))).toStrictEqual(
      kmeansPlusPlus(simple, 3, mulberry32(42)),
    );
  });

  it('handles duplicate-only points (zero remaining weight)', () => {
    const duplicates = new Array(4).fill([3, 3]);
    const centroids = kmeansPlusPlus(duplicates, 3, mulberry32(42));
    expect(centroids).toHaveLength(3);
  });
});
