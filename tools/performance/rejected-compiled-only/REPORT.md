# Compiled hardware constants only: not adopted

The bounded single-pair gate preserved exact results but did not demonstrate the predeclared material improvement of approximately 10% or more in heavy whole-mission forecast and strict replay. **Do not integrate this candidate.** No further repetitions are planned; game functionality takes priority over this marginal optimization.

| Scenario | Measurement | Original seconds | Candidate seconds | Observed reduction |
| --- | --- | --- | --- | --- |
| Legacy balanced | Cold forecast | 2.043 | 1.995 | 2.4% |
| Legacy balanced | Independent strict replay | 1.979 | 1.894 | 4.3% |
| Hardware balanced | Cold forecast | 26.695 | 25.475 | 4.6% |
| Hardware balanced | Independent strict replay | 27.038 | 25.242 | 6.6% |

These are one observation per engine and case, not stable distributions or a browser speed claim. Both original/candidate pairs matched exact inputs, state, result, environment and public-telemetry hashes. All four independently replayed saves reproduced their exact final-state hash. Canonical steps and model versions were unchanged. Seven bounded correctness tests and TypeScript check had passed; the six expensive full-flight unit cases were deliberately deferred to this performance gate rather than repeated without a demonstrated benefit.

Both variants used the unchanged uncached environment implementation. The candidate only compiled immutable hardware constants; `state.ts`, `immutable.ts` and the original public telemetry return path were restored. There was no warm environment cache or checkpoint reuse. Each forecast started in a new worker/runtime; replay started a new model runtime but ran in the already loaded/JIT-warmed worker. The same distinction applies to both engines. All other agent browser/build/test jobs were explicitly closed during measurement; all four benchmark workers were terminated before releasing the exclusive window.

Raw evidence: [results-compiled-only-singlepair.json](tools/performance/results-compiled-only-singlepair.json). This evidence directory preserves the exact source overlay, test/harness source and self-contained worker bundle. Its [archive manifest](archive-manifest.json) hashes all 12 preserved files. Reconstruct by overlaying its four `src` files onto the unchanged original `orbital-foundry-next-performance/baseline/src` sibling snapshot; archived source paths alone are not a standalone project. The self-contained worker bundle includes both measured engines and their tables. Archived tests are outside the active test include path.

Worker bundle SHA-256: `b6586c557867d5a8f8e61aa7600b7a01dcaf8bbb1829b4621524e0d05a893115`. Original manifest SHA-256: `3bbe2195390abadf5da979916b0b20123b61199c21b1ffa55554adc6efadd3dc`, covering all 57 source/data files including actual orbital JSON bytes. The raw report records Node, OS, CPU, memory, power scheme and exact hashes. No production application source was changed by either performance experiment.
