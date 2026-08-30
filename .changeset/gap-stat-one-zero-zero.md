---
"gap-stat": major
---

## gap-stat 1.0.0 — modern TypeScript rewrite

Complete rewrite from the 0.x CommonJS codebase to strict TypeScript,
published as ESM-only with **zero runtime dependencies** (`underscore` and
`clusterfck` removed).

### New API

```ts
import { gapStatistic, mulberry32 } from "gap-stat";

const result = gapStatistic(data, {
  kMin: 1,              // default 1
  kMax: 10,             // default 10, must be <= data.length
  bootstrapCount: 10,   // default 10 (use 50+ with firstSeRule)
  clusteringFn,         // any (data, k, rng) => labels — pluggable!
  rng,                  // default Math.random; pass mulberry32(seed) for determinism
  firstSeRule: true,    // additionally reports the 1-SE-rule pick
});
result.clusterSize; // recommended number of clusters
```

### Migration from 0.x

| 0.x | 1.0.0 |
| --- | --- |
| `gs.gap_statistic(d, 1, 5)` (positional) | `gapStatistic(d, { kMin: 1, kMax: 5 })` |
| `result.cluster_size` | `result.clusterSize` |
| `result.gaps` | `result.gaps` |
| `result.gap_stddevs` | `result.referenceSds` |
| `gs.GapStatResult` (class) | plain frozen `GapStatisticResult` interface |
| `gs.gap_statistic` / `gs.t` / `s.column_mins` … (snake_case) | `gapStatistic` / `transposed` / `columnMin` … (camelCase) |

### Behavior changes

- **ESM-only**: consumers on CommonJS need Node >= 22.12 (native `require`
  of ESM) or a dynamic `import()`.
- **No intermediate rounding**: dispersion values are full double precision;
  expect slightly different numbers than 0.x for identical input.
- **Deterministic by default**: the built-in k-means (k-means++ init, Lloyd's
  iterations) depends only on the injected `rng`; the same seed produces the
  same result — 0.x could flip cluster counts between runs.
- **Continuous reference distribution**: bootstrap reference points are drawn
  continuously in `[min, max)` per column instead of floored to integers.
- **Degenerate data is either handled or rejected**: NaN/Infinity/inconsistent
  matrices throw typed errors instead of silently producing NaN results.
- Adds the Tibshirani 1-SE-rule pick (`firstSeK`) as an option.