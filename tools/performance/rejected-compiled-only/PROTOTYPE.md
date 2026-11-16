# Isolated transfer cache prototype

This sibling directory is an experiment. Nothing here has been integrated into the frozen production candidate. It has no Git checkout, deployment artifact or copied dependency tree; `node_modules` is a junction to the existing workspace installation. `baseline/src` is an unchanged source snapshot captured before the experiment. Do not edit it.

The initial broad environment cache was **rejected**: whole-mission forecast and strict replay regressed in all three measured cases despite exact results. Full source/bundle and negative measurements are retained in `tools/performance/archive/broad-environment-v1` and `tools/performance/results-approved-3round.json`. See [the report](tools/performance/REPORT-broad-environment-v1.md).

The **active candidate is now compiled hardware constants only**. Its production-source change list is exactly:

- `src/transfer/compiled-craft.ts` (new private immutable hardware compilation and frozen-input eligibility check).
- `src/transfer/runtime.ts` (uses compiled hardware constants; original environment/public telemetry paths restored).
- `src/hardware/resolve.ts` (extracts identical RF arithmetic for compiled parameters).
- `src/hardware/attitude.ts` (extracts identical controller arithmetic for compiled limits).

`src/transfer/state.ts` and `immutable.ts` have been restored byte-for-byte from the baseline. There is no environment cache or extra public telemetry clone. Legacy calculations bypass hardware compilation. TypeScript and seven bounded correctness tests passed for this candidate; its six expensive full-mission differential cases have not yet been repeated. The next authorized gate is one pair each of legacy-balanced and hardware-balanced, including strict replay, after an exclusive CPU handoff. No benefit is currently claimed.

Archived broad-cache version changes:

- `src/transfer/state.ts`: private bounded 32-entry-per-map base state and true/false environment caches, with exact elapsed-time keys and distinct negative zero. Public state/environment functions remain independent.
- `src/transfer/immutable.ts`: a WeakSet certifies the objects actually recursively frozen by the model helper; shallow freezing is insufficient for a cache key.
- `src/transfer/compiled-craft.ts`: private compiled power, RF selection/transform, instrument, data and attitude constants. It derives from an owned cloned craft so mutable public resolver results cannot poison this cache.
- `src/transfer/runtime.ts`: uses those internal computations, and deep-copies the cached environment at public telemetry boundaries.
- `src/hardware/resolve.ts` and `src/hardware/attitude.ts`: extract existing RF/controller arithmetic into parameterized functions without changing its order or formulas.
- `tests/transfer-cache-exact.test.ts`: original-versus-prototype exact full-mission checkpoints, 300/600 as separate comparisons, mutation/alias/network/LRU boundaries and telemetry/request-chunk independence.
- `tools/performance/{worker.ts,benchmark.mjs,integrity.ts}`: serial, isolated worker CPU benchmark with manifest-verified original source, independent original factories, type-tagged finite input/output hashes and separate forecast, warm query, public telemetry, serialization and optional replay timing.

`canonicalNextTime`, its constants, intervals, event splitting and tolerances are unchanged. No visibility-ray count or solar rounding change is included. Trusted forecast checkpoint reuse is not implemented.

Archived broad-cache validation after the v3 publication CPU handoff:

- TypeScript check passed.
- `transfer-cache-exact.test.ts`: 10/10 passed, 185.54 s. Six full original-versus-prototype missions cover both legacy/hardware presets at 600 s and balanced legacy/hardware at 300 s, with ten checkpoints per mission, exact telemetry/results/serialized checkpoints and alias/eviction/ownership tests.
- `transfer-cache-boundary.test.ts`: 3/3 passed, 5.34 s. All 57 baseline source hashes and inventory verified; independent factories match; the hash encoder distinguishes types and signed zero and rejects nonfinite model numbers. A launchable weak-solar hardware craft reaches actual SAFE_MODE and RECOVERED events with identical state under smaller requests, worker chunks and mutated public telemetry.
- Existing `hardware-legacy-replay.test.ts` and `hardware-audit.test.ts`: 18/18 passed, 7.07 s. These cover historical checkpoints, RF/power/input compatibility and strict replay guards after the shared helper extraction.

Total for that archived version: 31 passing targeted tests across four files. Those correctness-run durations are not performance measurements. Its subsequent isolated benchmark completed and rejected that candidate; see the report above. No main-workspace production changes have been integrated.

Commands for the authorized CPU window (run from this directory):

```powershell
node_modules\.bin\vitest.cmd run tests/transfer-cache-exact.test.ts --maxWorkers=1
node tools/performance/benchmark.mjs --rounds=1 --cases=legacy-balanced,hardware-balanced --steps=600 --restore --output=tools/performance/results-compiled-only-singlepair.json
```

The full default benchmark includes both legacy presets, both hardware presets, a nightside route and weak solar. Do not invoke that broad default without authorization. The current gate above is deliberately bounded and is not a statistically stable benchmark. `--steps=300,600` measures both released step settings separately.

Every benchmark variant uses a fresh worker and runtime, so its model caches start cold. Repeated exact-time queries use the unchanged uncached environment implementation in both active variants; only the rejected archive has a warm environment cache. The worker bundle includes both engines for identical import setup, so its startup metric is shared-harness startup, not application-bundle cold loading. Heap delta is not peak heap. Alternating original/optimized order reduces, but does not eliminate, thermal/JIT/OS variation. Same-input final state, result, environment and public telemetry hashes must agree or the runner aborts. Optional restore must reproduce the exact final state hash.
