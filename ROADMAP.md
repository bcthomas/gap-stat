# gap-stat 1.0.0 — Modernization Roadmap

Target: rebuild `gap-stat` as a modern TypeScript ESM library with **zero runtime
dependencies**, a **pluggable clustering algorithm** API, and a **Vitest** test suite,
released as a clean **1.0.0**.

---

## 1. Current State (audit summary)

| Area | Today | Problem |
|---|---|---|
| Language | Plain JS, `var`-era, CommonJS | No types, no strictness, outdated idiom |
| Dependencies | `underscore`, `clusterfck` | Only used for `zip/min/max/reduce` and one `cf.kmeans(data, k)` call inside `dispersion()` — both replaceable |
| Tests | `mocha` + `chai`, `*` version ranges | Unpinned, non-deterministic RNG-dependent assertions, no coverage |
| Config | None | No tsconfig, lint, CI, exports map, engines |

Key seam discovered: `clusterfck` is used in exactly **one place**(`dispersion()`),
so the plugin boundary should live there: the gap statistic only needs
**cluster labels per point** from any clustering algorithm.

---

## 2. Decisions (agreed)

1. **ESM-only** publish (`"type": "module"`, build with plain `tsc` — no tsup/tshy needed).
2. **Ship a built-in default k-means** (Lloyd's + k-means++ init) that a user can override.
3. **Clean API break** at 1.0.0 — no deprecated shims.
4. **Biome** for lint + format (single tool, single devDependency).
5. Tooling devDeps (the only allowed deps): `typescript`, `vitest`, `@biomejs/biome`, `@changesets/cli`.

`engines`: `node >= 20` (Node 18 is EOL). CI matrix: 20 / 22 / 24.

---

## 3. Target API (design sketch)

```ts
// types.ts
export type Rng = () => number;                       // returns [0, 1)

/** Maps each data point to a cluster index: labels[i] = cluster of data[i]. */
export type ClusteringFn = (
  data: readonly (readonly number[])[],
  k: number,
  rng: Rng,
) => readonly number[];

export type ReferenceDistributionFn = (
  data: readonly (readonly number[])[],
  rng: Rng,
) => number[][];

export interface GapStatisticOptions {
  kMin?: number;                              // default 1
  kMax?: number;                              // default 10, must be <= data.length
  bootstrapCount?: number;                    // default 10 (paper: B=50+ for the 1-SE rule)
  clusteringFn?: ClusteringFn;                // default: built-in kmeans
  referenceDistribution?: ReferenceDistributionFn; // default: uniform per-column range
  rng?: Rng;                                  // default Math.random
  firstSeRule?: boolean;                      // also report Tibshirani 1-SE pick
}

export interface GapStatisticResult {
  readonly clusterSize: number;               // argmax of gap
  readonly gaps: readonly number[];
  readonly dispersions: readonly number[];    // log(W_k) on real data
  readonly referenceMeans: readonly number[]; // added — 0.0.4 kept these private
  readonly referenceSds: readonly number[];   // replaces gap_stddevs
  readonly firstSeK: number | null;
}
```

```ts
// index.ts (public surface)
export function gapStatistic(
  data: readonly (readonly number[])[],
  options?: GapStatisticOptions,
): GapStatisticResult;

export { kmeans, kmeansPlusPlus } from './kmeans.js';
export { mulberry32 } from './random.js';       // seeded deterministic RNG helper
// matrix helpers exported for reuse + tests
export { transposed, columnMin, columnMax, columnMean, columnSum } from './matrix.js';
export type { ClusteringFn, Rng, ReferenceDistributionFn, ... } from './types.js';
```

**Plugin example** (docs):

```ts
import { gapStatistic, type ClusteringFn } from 'gap-stat';

const myAgglomerative: ClusteringFn = (data, k, rng) => {
  // any algorithm — just return a label per point
  return cluster(data, k);
};

const result = gapStatistic(data, { kMax: 8, clusteringFn: myAgglomerative, rng: mulberry32(42) });
```

---

## 4. Deliberate behavior changes (document in CHANGELOG)

| 0.0.4 | 1.0.0 |
|---|---|
| Intermediate results rounded to 2/5 decimal places | No intermediate rounding; full double precision (results will differ slightly — golden tests regenerated with seeded RNG) |
| `Math.random()` baked in | Injected `Rng`; built-in k-means deterministic under seed |
| `Math.log(sum)` can yield `-Infinity`/`NaN` on degenerate data | Validate inputs (finite, non-empty, rectangular, `kMin ≥ 1`, `kMax ≤ n`); degenerate zero-SS → `-Infinity` documented & tested |
| Sample SD formula `sd/N × √(1+1/B)` (paper-correct) | Kept as-is (it matches Tibshirani et al. 2001), renamed & unit-tested |
| Max-gap only | Adds optional **1-SE rule** pick (`firstSeK`), standard practice |
| `GapStatResult` class with mutable fields | Frozen `interface`-typed result object |
| snake_case exports (`column_mins`, …) | camelCase; positional args → options object |

---

## 5. Target module layout

```
├── src/
│   ├── index.ts            # public exports only
│   ├── gapStatistic.ts     # orchestration of the paper's algorithm
│   ├── dispersion.ts       # log Σ within-cluster SS from labels (pure)
│   ├── kmeans.ts           # default clustering fn (Lloyd's + k-means++, seeded)
│   ├── reference.ts        # uniform reference points + bootstrap loop (pure)
│   ├── matrix.ts           # transpose, column stats (replaces underscore)
│   ├── random.ts           # mulberry32 + helpers (replaces implicit Math.random)
│   ├── validate.ts         # input validation → typed errors
│   └── types.ts
├── test/                   # colocated-by-name with src/
├── biome.json
├── tsconfig.json           # strict, NodeNext, ES2022
├── vitest.config.ts
├── .github/workflows/ci.yml
└── package.json
```

Every module is pure (no I/O, no globals); randomness only enters via injected `Rng`.

---

## 6. Implementation phases (PR-sized, each independently mergeable)

### Phase 0 — Toolchain foundation  *(one PR, no behavior change)*

- [ ] `package.json`: `"type": "module"`, `engines.node >= 20`, `exports` map:
  ```json
  {
    "exports": {
      ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js"
      }
    },
    "types": "./dist/index.d.ts",
    "files": ["dist"],
    "sideEffects": false,
    "scripts": {
      "build": "tsc -p tsconfig.build.json",
      "typecheck": "tsc -p tsconfig.json --noEmit",
      "test": "vitest run",
      "test:watch": "vitest",
      "lint": "biome check .",
      "lint:fix": "biome check --write .",
      "prepack": "npm run build"
    }
  }
  ```
  Runtime `dependencies` field **deleted entirely** (keep `underscore`/`clusterfck`/
  `mocha`/`chai` as temporary devDeps only until Phase 2 removes them together with the old code).
- [ ] `tsconfig.json` (strictest useful set for a published lib):
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2022"],
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "verbatimModuleSyntax": true,
      "isolatedModules": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "skipLibCheck": true,
      "noEmit": true
    },
    "include": ["src", "test"]
  }
  ```
  `tsconfig.build.json` extends it, `include: ["src"]`, emits to `dist/`.
- [ ] `biome.json` (format + lint, 2-space, double or single quotes per taste).
- [ ] `vitest.config.ts` with v8 coverage pointed at `src/`.
- [ ] Sanity: old mocha tests still runnable (`vitest` will happily run the old JS
  tests during transition) — proves toolchain before refactor.
- **Acceptance:** `npm run typecheck && npm run lint && npm test` all green.

### Phase 1 — Pure-function core in TS  *(replaces `underscore`)*

- [ ] `matrix.ts`: `transposed`, `columnMin/Max/Mean/Sum` as strict generics over
  `readonly (readonly number[])[]` — native `map`/`reduce`, no transposition cost
  hoop-jumping (the old `_.each(_.zip.apply(...))` back-flip goes away).
- [ ] `random.ts`: `mulberry32(seed)` (≈10 lines, zero deps) + `RANDOM` default.
- [ ] `validate.ts`: `RangeError`/`TypeError` for non-numeric, non-rectangular,
  empty, NaN/±Infinity data, bad `kMin/kMax` bounds.
- [ ] Vitest coverage for every exported helper (ports all 6 underscore-dependent
  tests; adds edge cases: single row, single column, negative values, large ints).
- **Acceptance:** helpers fully covered; no `underscore` import remains anywhere.

### Phase 2 — Algorithm + plugin seam  *(removes `clusterfck`; the core PR)*

- [ ] `kmeans.ts`: built-in default `kmeans: ClusteringFn` —
  - k-means++ init (seeded), Lloyd's iterations, `maxIterations` cap (default 300),
    empty-cluster re-seeding policy (drop to `k`-means on furthest point),
    deterministic under seed.
- [ ] `dispersion.ts`: `dispersion(data, labels) → log Σ within-cluster SS` —
  **no clustering call inside**; takes labels so it tests pure, and any
  `ClusteringFn` output feeds it.
- [ ] `reference.ts`: `uniformReference(data, rng)` per-column-min/max generator
  (fix the O(n·2d) clear-the-array dance — plain `Array.from`), plus
  `bootstrapReferenceDispersion` loop.
- [ ] `gapStatistic.ts`: options-object orchestration; picks argmax gap; optional
  1-SE rule; returns frozen result object.
- [ ] Delete `lib/`, old `mocha`/`chai` tests, and **uninstall `underscore`,
  `clusterfck`, `mocha`, `chai`, `any-*` — `dependencies` stays empty.
- [ ] Port behavioral tests using **seeded RNG** (deterministic, no flaky CI):
  - golden `dispersion` value regenerated from fixed data (document the new value),
  - `gapStatistic` returns `GapStatisticResult` with all fields,
  - planted-clusters dataset ⇒ correct `clusterSize` (existing test data is good),
  - **plugin test**: hand-rolled trivial `ClusteringFn` (e.g. round-robin labels)
    drives the statistic end-to-end,
  - k-means reproducibility: same seed ⇒ identical labels.
- **Acceptance:** `npm ls` shows zero runtime deps; coverage ≥ 90% lines;
  all tests pass on the Node matrix.

### Phase 3 — Hardening & DX

- [ ] Coverage thresholds in `vitest.config.ts` (e.g. `lines: 90`, `branches: 85`).
- [ ] Edge-case suite: `k > n`, duplicate points, k=n, high-dimension data,
  extreme scale disparity, `bootstrapCount: 1`.
- [ ] Benchmarks (optional): `vitest bench` for dispersion on 1k×5 data.
- [ ] `.nvmrc`, `.gitignore` for `dist/`, `coverage/`.
- [ ] Optional: `@fast-check` devDep for property tests
  (e.g. dispersion monotonicity *decreasing-ish* in k, permutation invariance of row order).

### Phase 4 — CI / release plumbing

- [ ] GitHub Actions `ci.yml`: Node 20/22/24 × [lint → typecheck → test+coverage → build];
  upload to Codecov (free) and add badge.
- [ ] Changesets (`@changesets/cli`) for versioned CHANGELOG; PRs carry changesets.
- [ ] Release workflow with **npm provenance** (`npm publish --provenance`, OIDC) —
  modern supply-chain best practice. 1.0.0 tagged as `latest`.
- [ ] Branch protection: CI required before merge.

### Phase 5 — Docs

- [ ] README rewrite: ESM quickstart, pluggable-algorithm example (custom
  hierarchical or GPA wrapper), seeded-reproducibility example, API tables.
- [ ] **Migration guide 0.0.4 → 1.0.0**: mapping table of old↔new names
  (`gap_statistic(d,1,5)` → `gapStatistic(d, {kMin:1, kMax:5})`,
  `result.gap_stddevs` → `result.referenceSds`, …).
- [ ] JSDoc on every public export so `tsc` emits hand-quality `.d.ts`; note the
  Tibshirani, Walther & Hastie (2001) citation in `gapStatistic` docs.

---

## 7. Suggested PR sequence

| PR | Title | Depends on |
|---|---|---|
| #1 | `chore: ESM toolchain, tsconfig, biome, vitest scaffolding` | — |
| #2 | `feat: pure TS matrix + rng + validation helpers (drop underscore)` | #1 |
| #3 | `feat!: gap statistic core with pluggable ClusteringFn; built-in kmeans (drop clusterfck); 1.0.0 API` | #2 |
| #4 | `test: edge cases, seeded golden values, coverage gates` | #3 |
| #5 | `ci: workflow matrix, codecov, changesets, provenance release` | #3 |
| #6 | `docs: README, migration guide, typed API` | #3 |

Phases 2–4 are the only ones touching `src/`; everything else is additive.

---

## 8. Risks / open questions

1. **Numeric drift** — removing intermediate rounding changes outputs vs 0.0.4.
   Acceptable (documented), but regenerate any downstream golden values.
2. **`clusterfck` parity** — built-in k-means won't match clusterfck's exact
   centroids; seeded goldens + planted-cluster tests replace "same number" checks.
3. **Sizes in SE rule** — 1-SE needs `bootstrapCount ≥ ~50` to be meaningful;
   default stays 10 for speed, docs recommend 50 when `firstSeRule: true`.
4. **ESM-only consequences** — CJS `require()` consumers must be on Node ≥ 22.12
   or use `import()`. Decided acceptable.

**Out of scope (future):** Worker-thread parallel bootstraps, PCA-style reference
distribution, streaming/incremental API, browser bundle (works as-is in modern
bundlers via the exports map).

---

## 9. Definition of done

- `npm publish` produces a dual-checked-for `dist/` with `.d.ts`, `.d.ts.map`, `.js.map`
- Zero `dependencies` in package.json
- Deterministic test suite (no `Math.random` outside seeded helpers)
- ≥ 90% coverage enforced in CI
- 1.0.0 published with CHANGELOG, provenance attestation, and migration guide