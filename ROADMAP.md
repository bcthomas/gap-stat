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

### Phase 0 — Toolchain foundation  *(one PR, no behavior change)* — ✅ LANDED

- [x] `package.json`: `"type": "module"`, `engines.node >= 20`, `sideEffects: false`,
  build/typecheck/test/lint scripts. **Deviation:** the `exports` map is deferred to
  Phase 2 — during the transition `main` points at the renamed legacy
  `lib/gap_stat.cjs` so the package stays `require()`-able at every commit.
- [x] `tsconfig.json` (strictest useful set for a published lib) + `tsconfig.build.json`
  (emits `dist/` for Phase 2):
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
      "skipLibCheck": true,
      "noEmit": true
    },
    "include": ["src", "test", "vitest.config.ts"]
  }
  ```
- [x] `biome.json` (format + lint, 2-space, single quotes; `src/**` + `test/**` only
  until legacy code is deleted; `noNonNullAssertion` off for bounds-checked matrix indexing).
  **Gotchas learned on this Biome version (2.x):** `biome.json` is strict JSON —
  JSONC comments silently prevent the config from loading; the deprecated
  `"recommended": true` field must be migrated via `biome migrate` to
  `"preset": "recommended"`; folder exclusions go in `files.includes` as `"!lib"`
  (no glob) per `lint/suspicious/useBiomeIgnoreFolder`.
- [x] `vitest.config.ts` (coverage on `src/**` opt-in; thresholds + `@vitest/coverage-v8` in Phase 3).
- [x] Legacy mocha suite preserved: `lib/gap_stat.js` → `lib/gap_stat.cjs`,
  `test/index.js` → `test/index.cjs` (extensionless `.cjs` requires updated), run via
  `npm run test:legacy` so the package stays functional at every commit.
  **Discovery:** the inherited `suggests a cluster size` assertion is nondeterministic —
  clusterfck seeds k-means from `Math.random()`, so k=3 vs k=4 flips run to run at
  `bootstrap_count=10`. Annotated `this.retries(3)` with a pointer to the Phase 2
  deterministic replacement. This flake is the motivating case for seeded RNGs.
- **Acceptance:** `npm run typecheck && npm run lint && npm test` all green
  (after `npm install` of the new devDeps).

### Phase 1 — Pure-function core in TS  *(replaces `underscore`)* — ✅ LANDED

- [x] `src/matrix.ts`: `transposed`, `columnMin/Max/Mean/Sum` — native `map`/`reduce`,
  no transposition hoop-jumping, full double precision (0.x rounded intermediates).
- [x] `src/random.ts`: `mulberry32(seed)` (zero deps, golden-value tested) as the
  seeded `Rng` for reproducible bootstraps/k-means/tests.
- [x] `src/types.ts`: full public contract defined up front — `Rng`, `ClusteringFn`,
  `ReferenceDistributionFn`, `GapStatisticOptions`, `GapStatisticResult` — so Phase 2
  modules are written against the final API.
- [x] `src/validate.ts`: `RangeError`/`TypeError` for non-array, non-rectangular, empty,
  NaN/±Infinity data and bad `kMin`/`kMax` bounds.
- [x] `src/index.ts` exports helpers + types.
- [x] Vitest coverage: all 5 underscore-dependent tests ported plus edge cases
  (single row/column, negatives/floats, rectangular, non-mutation, golden PRNG values,
  every validation branch, export surface).
- [x] Logic smoke-tested by running the TS directly under Node's type stripping.
- **Status:** `src/` has zero `underscore` imports; the `underscore` dependency itself
  still sits in `package.json` only for the legacy `test:legacy` suite and is removed with
  the legacy files in Phase 2.

### Phase 2 — Algorithm + plugin seam  *(removes `clusterfck`; the core PR)* — ✅ LANDED

- [x] `kmeans.ts`: built-in default `kmeans: ClusteringFn` —
  - `createKMeans({ maxIterations })` factory + `defaultKMeans` singleton,
    `DEFAULT_MAX_ITERATIONS = 300`; k-means++ init (`kmeansPlusPlus`, seeded),
    Lloyd's iterations with lowest-index tie-breaks, empty-cluster repair that
    steals the globally furthest point (never emptying a singleton),
    deterministic under seed. **Bug caught pre-test via golden smoke run:**
    the empty-cluster repair originally returned centroids where the loop
    expected labels — silently poisoning the next iteration; restructured so
    it mutates labels in place and the caller binds arrays explicitly.
- [x] `dispersion.ts`: `dispersion(data, labels) → log Σ within-cluster SS` —
  **no clustering call inside**; validates labels (length/integer/non-negative),
  single O(nd) pass, clamps float-cancelled tiny negatives to 0 before the log,
  returns `-Infinity` for W_k = 0 (documented + tested).
- [x] `reference.ts`: `uniformReference(data, rng)` — continuous per-column
  `[min, max)` draws (0.x floored to integers); `referenceDispersionStats`
  keeps the paper's `sd/B × √(1+1/B)` bias correction; bootstrap loop lives
  in `gapStatistic.ts`.
- [x] `gapStatistic.ts`: options-object orchestration (`kMin/kMax/bootstrapCount/
  clusteringFn/referenceDistribution/rng/firstSeRule` with exported
  `DEFAULT_K_MIN/K_MAX/BOOTSTRAP_COUNT`); argmax gap; optional 1-SE rule with
  argmax fallback; returns an `Object.freeze`d result.
- [x] Deleted `lib/gap_stat.cjs` + `test/index.cjs`; removed `mocha`, `chai`,
  `test:legacy`; **`dependencies` key deleted outright** (`underscore` and
  `clusterfck` are gone); `package.json` now carries `exports` map (types +
  import → `dist/`), `files: ["dist"]`, and the updated description.
- [x] Behavioral tests, all seeded RNG (zero flakiness): dispersion golden
  (`1.9924301646902063`) + row-permutation invariance + −∞ cases; planted
  clusters ⇒ `clusterSize 3` across seeds 42/7/2025 (full-precision golden
  gaps captured); **plugin test** — round-robin `ClusteringFn` drives the
  whole statistic (dispersions `log 10`, `log 8` verified against theory);
  1-SE rule at B=50 ⇒ `firstSeK 3`; frozen result shape; k-means golden
  labels, k=1/k=n/empty-cluster-repair cases; validation errors.
- **Acceptance:** `npm install` (prunes removed deps) ⇒ zero runtime deps;
  typecheck + biome + vitest green locally.

### Phase 3 — Hardening & DX

- [ ] Coverage thresholds in `vitest.config.ts` (e.g. `lines: 90`, `branches: 85`).
- [ ] Edge-case suite: `k > n`, duplicate points, k=n, high-dimension data,
  extreme scale disparity, `bootstrapCount: 1`.
- [ ] Benchmarks (optional): `vitest bench` for dispersion on 1k×5 data.
- [ ] `.nvmrc`, `.gitignore` for `dist/`, `coverage/`.
- [ ] Optional: `@fast-check` devDep for property tests
  (e.g. dispersion monotonicity *decreasing-ish* in k, permutation invariance of row order).

### Phase 4 — CI / release plumbing — ✅ LANDED (workflows ready; manual activation below)

- [x] `.github/workflows/ci.yml`: Node 20/22/24 matrix × lint → typecheck →
  test → build; coverage (v8, lcov via `npm run test:coverage`) runs once on
  Node 22 and uploads to Codecov (`codecov/codecov-action@v5`, tokenless for
  public repos, `CODECOV_TOKEN` optional); minimal `permissions`, concurrency
  cancel-in-progress, `npm ci` + setup-node npm cache; `@vitest/coverage-v8`
  added as devDep (thresholds still land in Phase 3).
- [x] Changesets: `.changeset/config.json` (public, baseBranch main) + starter
  changeset declaring the **major** bump for the 1.0.0 rewrite; scripts wired:
  `changeset`, `version-packages` (`changeset version`), `release`
  (`changeset publish --provenance`).
- [x] `.github/workflows/release.yml`: on merge to main, changesets/action
  opens/updates a *Version Packages* PR; merging it publishes to npm with
  **provenance** (`NPM_CONFIG_PROVENANCE` + `id-token: write` OIDC) and pushes
  the tag — the 1.0.0 release ships as `latest`.
- [x] README CI + Codecov badges.
- [ ] **Manual (GitHub UI, one-time):**
  1. Add secret `NPM_TOKEN` (npm automation token for the `bcthomas` account).
  2. Optional: link repo on codecov.io and add `CODECOV_TOKEN` secret.
  3. Settings → Branches → protect `main`: require PR + require status check
     `Verify (Node 22)` (or all matrix jobs); consider requiring linear history.
  4. First merge to main triggers CI; first Version PR merge triggers the
     npm publish + tag (double-check the entry on npmjs.com shows a provenance badge).
- [ ] Optional hardening (defer): SHA-pin actions instead of major tags (`gh`):
  `actions/checkout@11bd719...`, etc.
- **Acceptance:** CI green on all three Node versions; release workflow
  publishes with provenance on the next Version PR merge.

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