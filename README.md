# gap-stat

[![CI](https://github.com/bcthomas/gap-stat/actions/workflows/ci.yml/badge.svg)](https://github.com/bcthomas/gap-stat/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/bcthomas/gap-stat/graph/badge.svg)](https://codecov.io/gh/bcthomas/gap-stat)

The **gap statistic** (Tibshirani, Walther & Hastie, 2001) for estimating the
optimal number of clusters in a dataset — implemented in strict, dependency-free
TypeScript for Node and modern bundlers, with **a pluggable clustering API**: use
the built-in k-means, or bring any algorithm of your own.

> Requires **Node >= 20** and ESM consumers (`import gap-stat from …`).

## Install

```bash
npm install gap-stat
```

## Quickstart

```ts
import { gapStatistic } from "gap-stat";

// three tight planted clusters
const data = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [50, 50, 50], [51, 50, 50], [50, 51, 50], [51, 51, 50],
  [100, 0, 50], [101, 0, 50], [100, 1, 50], [101, 1, 50],
];

const result = gapStatistic(data, { kMax: 6 });
console.log(`best cluster size: ${result.clusterSize}`); // → 3
```

`gapStatistic` compares each candidate cluster count `k` against the mean dispersion of
bootstrap reference datasets drawn uniformly over the data's column ranges (the null
model from the paper) and reports the `k` with the largest gap.

> Note: the gap statistic holds **your** clustering up against a null model — it can't
> rescue an algorithm that's a poor fit for your data. Very dispersed or heavy-tailed
> data can produce gaps that keep growing with `k`; that's a signal from your
> clustering, not a bug in the math.

## Bring your own clustering algorithm

The library doesn't care *how* points get clustered — it only needs **cluster labels
per point**. Any function with that contract works, k-means or not:

```ts
import { gapStatistic, type ClusteringFn } from "gap-stat";

// Example: single-linkage agglomerative clustering, entirely independent of k-means.
const singleLinkage: ClusteringFn = (data, k) => {
  let clusters: number[][] = data.map((_, i) => [i]); // clusters as point-index sets
  while (clusters.length > k) {
    // find the two clusters with the smallest pairwise point distance
    let best: [number, number] = [0, 1];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        for (const p of clusters[i]) {
          for (const q of clusters[j]) {
            const d = Math.hypot(...data[p]!.map((x, dim) => x - data[q]![dim]!));
            if (d < bestDistance) {
              bestDistance = d;
              best = [i, j];
            }
          }
        }
      }
    }
    clusters = clusters
      .filter((_, i) => i !== best[0] && i !== best[1])
      .concat([clusters[best[0]]!.concat(clusters[best[1]]!)]);
  }
  // flatten cluster memberships into one label per point
  const labels: number[] = new Array(data.length);
  clusters.forEach((members, label) => members.forEach((i) => (labels[i] = label)));
  return labels;
};

const result = gapStatistic(data, { kMax: 6, clusteringFn: singleLinkage });
```

A custom `ClusteringFn` receives `(data, k, rng)` and must return one integer label
(`0 … k-1`) per point. It is invoked `kRange × (bootstrapCount + 1)` times per run —
once for the real data, and once per bootstrap reference dataset — so expensive
algorithms multiply accordingly. Different algorithms legitimately produce different
picks on the same data (hierarchical methods like the one above behave very
differently from k-means on loose data) — the algorithm choice is yours, and the
gap statistic measures it.

## Reproducibility

All randomness is injected. Locking in a seeded generator and every run is
byte-identical — unlike 0.x, which silently depended on `Math.random()`:

```ts
import { gapStatistic, mulberry32 } from "gap-stat";

// identical output on every call — great for tests and CI
const result = gapStatistic(data, { rng: mulberry32(42) });
const again = gapStatistic(data, { rng: mulberry32(42) });
// result and again are equal
```

## API

### `gapStatistic(data, options?) → GapStatisticResult`

**Options** (all optional):

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `kMin` | `number` | `1` | Smallest cluster count to evaluate (integer ≥ 1) |
| `kMax` | `number` | `10` | Largest cluster count (integer ≤ `data.length`) |
| `bootstrapCount` | `number` | `10` | Bootstraps per `k`. Use **50+** when using the 1-SE rule |
| `clusteringFn` | `ClusteringFn` | built-in k-means | Your algorithm, or `createKMeans({ maxIterations })` |
| `referenceDistribution` | `ReferenceDistributionFn` | uniform per-column range | Generates the bootstrap null model |
| `rng` | `Rng` | `Math.random` | Inject `mulberry32(seed)` for determinism |
| `firstSeRule` | `boolean` | `false` | Also compute the 1-SE-rule pick as `firstSeK` |

**`GapStatisticResult`** (frozen object):

| Field | Description |
| --- | --- |
| `clusterSize` | The `k` with the largest gap |
| `gaps` | `referenceMean − observedDispersion` per requested `k` |
| `dispersions` | Observed `log(W_k)` per `k` |
| `referenceMeans` | Mean bootstrap dispersion per `k` |
| `referenceSds` | Bias-corrected bootstrap SD per `k` (the paper's `s_k`) |
| `firstSeK` | 1-SE-rule pick, or `null` unless `firstSeRule: true` |

### Clustering

- **`defaultKMeans`** — the built-in `ClusteringFn`: k-means++ seeding
  (Arthur & Vassilvitskii 2007) followed by Lloyd's iterations (max 300,
  configurable via `createKMeans`), lowest-index tie-breaking, and automatic
  repair of empty clusters. Deterministic under a seeded `rng`.
- **`kmeansPlusPlus(data, k, rng)`** — the initialization step on its own.

### Also exported

- **PRNG**: `mulberry32(seed)` — tiny seeded generator producing `[0, 1)`.
- **Matrix helpers**: `transposed`, `columnMin`, `columnMax`, `columnMean`, `columnSum`.
- **Building blocks** (for custom pipelines): `dispersion`, `uniformReference`,
  `referenceDispersionStats`.
- **Validation**: `assertValidMatrix`, `assertValidClusterRange`.

Invalid input (empty or ragged matrices, `NaN`/`Infinity`, out-of-range `k`)
throws typed `TypeError`/`RangeError` with descriptive messages.

## Migration from 0.x

1.0.0 is a clean break. Highlights:

| 0.x | 1.0.0 |
| --- | --- |
| `gs.gap_statistic(d, 1, 5)` | `gapStatistic(d, { kMin: 1, kMax: 5 })` |
| `result.gap_stddevs` | `result.referenceSds` |
| `underscore` / `clusterfck` / CommonJS | zero deps / built-in k-means / **ESM-only** |
| `Math.random()` baked in | injected `rng`; same seed ⇒ same result |
| intermediate rounding | full double precision (values differ slightly from 0.x) |

CJS consumers need Node ≥ 22.12 (native `require(esm)`) or a dynamic `import()`.
Full release notes: [v1.0.0 release](https://github.com/bcthomas/gap-stat/releases/tag/v1.0.0).

## Development

```bash
npm ci                  # install tooling
npm run typecheck       # strict TypeScript
npm test                # Vitest, fully deterministic (seeded)
npm run test:coverage   # coverage report (also uploaded in CI)
npm run lint            # Biome lint + format check
npm run build           # emits dist/ (js + d.ts) via tsc
```

Releases are automated with [Changesets](https://github.com/changesets/changesets) and
[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers); every merge to
`master` is verified by CI on Node 20/22/24.

## References

- R. Tibshirani, G. Walther, T. Hastie. *Estimating the number of clusters in a data
  set via the gap statistic.* J. R. Statist. Soc. B (2001) 63, Part 2, 411–423.
- Building on the R implementation by Edwin Chen ([echen/gap-statistic](https://github.com/echen/gap-statistic)).

## License

[MIT](./LICENSE) © Brian C. Thomas
