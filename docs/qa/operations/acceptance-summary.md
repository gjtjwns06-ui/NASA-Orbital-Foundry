# Operations3 domain handoff — 2026-11-15

The frozen domain source passes41 tests across7 files, plus TypeScript compilation. This is domain acceptance, not browser/worker/renderer or publication acceptance. Root owns those remaining gates.

| Evidence | Result | Recorded wall time |
| --- | --- | --- |
| Link, journal/knowledge, guards, save schema, released preservation |35/35 PASS |3.98 s |
| Actual early/no/late flights, four numerical profiles, strict replay, five save phases, request partitioning |5/5 PASS |347.35 s |
| Dense active-slew comparison |1/1 PASS |42.92 s |
| `npx tsc --noEmit` after final test type annotations |PASS |No performance claim |

The dense supplemental test compares217 matching canonical committed timestamps per profile, including34 during0.25–10° of remaining actual slew. Render requests that do not reach a canonical integration event do not invent a state at their requested timestamp. The test's initial assumption that every5-second request must commit was corrected; the physical model and accuracy limits were unchanged.

Numerical gates remain the predeclared values. Active1/.5/.25 s and cruise300/600 s produce the same installed/ACK times and12 received packet identities. Maximum active attitude difference is0.01000834° (limit0.05°), maximum margin difference0.01079849 dB (limit0.1 dB). Minimum battery energies range68.56479992–68.57028475 Wh (difference0.00548484 Wh, limit0.10 Wh); all final energies are172 Wh. See `lesson-runtime-evidence.json` and `active-slew-convergence.json` for raw results.

## Actual lesson outcomes

All cases complete the actual modeled flight at22,648,321.688840948 elapsed TDB seconds. They share the same initial craft/plan and actual computed prefix; no checkpoint or physical values are injected. `record-negative-cases.mjs` computes that prefix once and forks deterministic continuations solely to record counterfactual evidence. Separate unit cases also execute each complete flight from departure.

| Ground action | Received/required | Result | Onboard schedule |
| --- | --- | --- | --- |
| None |0/3 |Failed science goal; flight complete |Revision0 |
| Late, cut−300 s |0/3 |Failed science goal; flight complete |Revision0 |
| Early, periapsis−8200 s |12/3 |Success |Revision1 |

The late signal misses the preloaded listening opportunity. Its actual antenna direction causes receiver input to fall outside the supported tracking range; the frame is lost before decoding. Therefore it produces **no onboard rejection ACK**, and Earth remains unconfirmed. Do not relabel this case as an acknowledged expiry rejection. Separate protocol tests cover actual decoded commands just before/on/after expiry and replacement cut.

For the fixed `schedule-1` command in the numerical suite: emission22455800→22455847.40625; complete reception/installation22456735.982217953; ACK emission22456735.982217953→22456745.982217953; Earth ACK receipt22457634.711317446. These times are identical across the tested numerical profiles. A UI-generated UUID changes the encoded command length and consequently the exact times; preview must use its real command ID.

The count-recording tool's non-exclusive functional run took9.539 s for the common prefix, then15.386/13.573/18.160 s for none/late/early continuations. These share warmed inputs/caches and are **not** a cold forecast benchmark or performance comparison.

## Integrity and implementation limits

- Network identity `omf-command-network-1.0.0`; canonical JSON SHA-256 `1eb4ebd04d12efb8ea2bf36e30a8b88c0ee198e504ca6efbc7d992fa8159fff6`.
- The network hash pins real used station coordinates, zero altitude, spherical radius and the reused approximate Earth rotation constants, along with link/framing assumptions.
- `model-definition.json` pins15 production source files and the declared convergence limits. `integration-manifest.json` lists approved files; no performance-experiment code or baseline source archive is part of integration.
-26 released numerical/resource/catalogue/data files remain byte-identical. Added shared code consists only of pure station exports, an optional erased event field and a facade barrel. Old profiles still dispatch to their unchanged engines.
- The bounded trajectory speed certificate is41.74854229 km/s for the spacecraft and30.80747113 km/s for a ground station, below the conservative guard bound. The certificate uses whole-conic/periapsis and polynomial ephemeris bounds, not sparse samples.
- Command and ACK intervals receive the new conservative checks. The existing science channel retains its released60-second batching/midpoint approximation. Iris is the supported command chain; no real DSN allocation, stochastic BER, flight-radio acquisition software or bit-level FEC is claimed.

During development, independent review found and closed actual TX-off ACK continuation, zero-step emission mutation and post-install EPS synchronization defects. Earlier exploratory/mixed-cache test runs are not used as acceptance evidence. The final frozen-source runs above and their generated artifacts are the handoff records.

Source/meaningful implementation details: [model boundary](../../m03-operations-implementation.md). Root must still pass real worker session/control-epoch tests, mouse timeline edits, English/Korean UI, save/storage failure and signal-renderer/browser validation before exposing the feature publicly.
