import { bench, describe } from 'vitest';
import { dispersion } from '../src/dispersion.js';
import { defaultKMeans } from '../src/kmeans.js';
import { mulberry32 } from '../src/random.js';

// 1000 points × 5 dimensions, four loose clusters
function makeData(): number[][] {
  const data: number[][] = [];
  for (let i = 0; i < 1000; i++) {
    const rng = mulberry32(i);
    const group = Math.floor(i / 250) * 50;
    const row: number[] = [];
    for (let d = 0; d < 5; d++) {
      row.push(group + rng() * 10 + d);
    }
    data.push(row);
  }
  return data;
}

const data = makeData();

describe('dispersion @ 1000×5', () => {
  bench('single cluster (k=1 labels)', () => {
    dispersion(
      data,
      data.map(() => 0),
    );
  });

  bench('five hand-labelled clusters', () => {
    dispersion(
      data,
      data.map((_, i) => Math.floor(i / 250)),
    );
  });
});

describe('defaultKMeans @ 1000×5', () => {
  bench('k=5, seed 42', () => {
    defaultKMeans(data, 5, mulberry32(42));
  });
});
