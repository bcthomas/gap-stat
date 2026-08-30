---
"gap-stat": major
---

Modern TypeScript rewrite: ESM-only package built from `src/` with generated
declarations; zero runtime dependencies (underscore and clusterfck removed);
pluggable clustering via the new `ClusteringFn` API (`gapStatistic(data, {
clusteringFn, rng, kMin, kMax, bootstrapCount, ... })`) with a deterministic
seeded k-means++/Lloyd's default; full-precision dispersion (no intermediate
rounding); optional 1-SE-rule pick; seeded PRNG (`mulberry32`) export.
See the README migration notes.