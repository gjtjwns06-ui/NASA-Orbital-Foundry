# Broad environment cache: rejected performance experiment

Status: **do not integrate this version**. All 9 original/prototype input pairs were exactly equal, including final state, result, internal environment sample and public telemetry hashes. Every one of the 18 independently replayed checkpoints matched its preceding final-state hash. Nevertheless, cold whole-mission prediction and strict replay became slower in all three scenarios.

## Full-work measurements

Three repetitions per variant and scenario, integration step 600 s, new worker/runtime for every repetition, alternating original/prototype order. Values below are seconds, **median (observed minimum–maximum)**. Three repetitions establish this observed regression; they do not establish a tail-latency percentile or general browser performance claim.

| Scenario | Engine | Cold forecast | Independent strict replay |
| --- | --- | --- | --- |
| legacy-balanced | original | 1.958 (1.877–2.081) | 1.900 (1.830–1.969) |
| legacy-balanced | optimized | 2.730 (2.667–2.790) | 3.777 (3.523–4.106) |
| hardware-balanced | original | 26.740 (26.677–26.923) | 26.768 (26.506–26.782) |
| hardware-balanced | optimized | 30.835 (30.555–31.118) | 30.615 (30.497–30.861) |
| hardware-science | original | 11.240 (11.182–11.314) | 11.210 (10.968–11.216) |
| hardware-science | optimized | 12.961 (12.866–13.004) | 12.801 (12.479–12.851) |

The legacy medians increased by approximately 39% for prediction and 99% for replay. Hardware balanced increased by approximately 15%/14%; hardware science by approximately 15%/14%. This rejects the broad cache even though repeated exact-time queries became much faster.

## Warm work is a separate measurement

The 2,000 repeated identical full-network environment queries took median 26.58→0.473 ms for legacy, 26.90→0.338 ms for hardware balanced and 25.54→0.317 ms for hardware science. These are cache-hit microqueries, not a fresh forecast. The 200 public telemetry calls took median 3.862→3.855 ms, 11.966→10.799 ms and 11.543→10.073 ms respectively. No warm forecast/checkpoint reuse was implemented.

Heap deltas were higher for the prototype, but the harness does not force garbage collection or measure retained/peak heap. These figures do not establish a memory leak. Expensive freeze/allocation work is a plausible explanation for the regression, not a profiled attribution. The next experiment removes the entire environment cache and its additional freeze/copy work to isolate immutable hardware compilation.

## Reproducibility and evidence

- Exact raw timings and hashes: [results-approved-3round.json](tools/performance/results-approved-3round.json).
- Preserved source overlay, test/harness source and self-contained worker bundle are in this evidence directory. The [archive manifest](archive-manifest.json) records every preserved file's SHA-256. These files are outside the active application source and unit-test include path. The original full baseline snapshot remains in the sibling `orbital-foundry-next-performance/baseline` workspace; [its source manifest](baseline-manifest.json) is copied here. Apply the preserved source overlay over that unchanged baseline to reconstruct the rejected implementation; archived relative-source files are not intended to be run as a standalone project. The self-contained `compiled-worker.mjs` contains both measured engines and their input tables.
- Worker bundle SHA-256: `12b67136546dcb1413f29214f2fce0bcd898b56b4b4133f26a073990cc01dcbe`.
- Original source manifest SHA-256: `3bbe2195390abadf5da979916b0b20123b61199c21b1ffa55554adc6efadd3dc`. The preflight verifies all 57 files, including actual Earth/Mars JSON bytes and catalogue TypeScript, and rejects added/changed files. Original runs use original-side factories.
- Node v24.14.0; Windows 10.0.26200; Intel Core Ultra 5 226V, 8 logical CPUs; approximately 16.7 GB physical memory. Power scheme GUID `ab6534a3-bc02-4c44-94d1-a8535b2eb070` (`SAMSUNG MODE`); the localized prefix was console-encoding garbled, but the GUID/name are preserved.
- Other agents explicitly closed browsers/preview/build/test jobs before timing. Root performed only light source/document authoring. All benchmark workers were terminated before the exclusive window was released. No GPU benchmark ran alongside it.
- Startup loads both engines in one common harness. It is not the game's production bundle cold-load measurement. Compute timing starts after worker readiness. Strict replay uses a new runtime and empty model caches, while the worker process/JIT is already warm from the preceding forecast; this distinction applies to both variants.
- Correctness evidence before this timing: 31 targeted passing tests across four files and TypeScript check. The source/controller/integration partition, ray count and model versions were unchanged.

## Next bounded ablation

The active prototype now restores original `src/transfer/state.ts` and `immutable.ts` byte-for-byte and restores the original public telemetry return path. Only hardware immutable constant compilation remains. No environment memoization or additional public deep copy remains; legacy integration uses the original environment and freezer paths. A one-time recursive frozen-input check replaces the previous global certification set for hardware compiled-cache eligibility.

Four original/prototype ownership, input-mutation and short-runtime tests passed (the six expensive full-flight tests were deliberately not repeated yet); three manifest/factory/hash/actual hardware safe-mode-recovery tests also passed, and TypeScript check passed. The next authorized timing gate is **one pair each** for legacy balanced and hardware balanced, with strict replay. Do not infer a benefit or integrate this ablation until that gate passes; use three repetitions only for a candidate whose full-work measurement supports it.
