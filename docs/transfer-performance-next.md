# Transfer performance: exact-preserving next iteration

Status: **read-only source review and implementation proposal, written during the v3 candidate C freeze. No runtime edits, profiling, benchmark execution or additional test run were performed for this document.** The reported roughly 20-second hardware forecast/replay is an observation from release QA, not a measurement established by this review. No speedup is claimed.

The last completed full unit run before this review passed **236 tests in 28 files, 128.45 seconds**. That result establishes the current baseline; it does not validate any proposed optimization. The hardware catalogue used by this review has SHA-256 `25a47f24340365b5b52d62708ce987f7a90df4ee6559879b91464a2d24ae9a98`.

## Scope and preservation rule

Improve the time to calculate and replay M03 without reducing aperture samples, omitting attitude dynamics, shortening the flight, changing the integrator partition, relaxing arrival rules or altering received-science credit. Legacy transfer-1.0.0 and hardware transfer-2.0.0 remain separate supported models. Existing model 1.3.0 mission replay must also remain intact when shared assembly/hardware helpers change.

An exact-preserving optimization must produce the same finite numbers, booleans, ordered records, event times and canonical ticks for the same model, validated inputs, integration step and request sequence. A change that merely stays within the existing 300-versus-600-second convergence tolerances does **not** meet that standard. The comparison is old and new implementations using the **same** integration step.

## Source observations

The main integration loop is in [runtime.ts](../src/transfer/runtime.ts). Each committed interval can calculate an environment at its starting time, calculate the same starting environment again in `canonicalNextTime`, calculate midpoint and endpoint environments, then recalculate the endpoint as the next interval's start. Eclipse and battery-threshold searches add more exact-time queries. `stepRuntime` also creates two endpoint telemetry objects around a possible safe-mode transition. These repeated calls are candidates, not measured bottlenecks.

[state.ts](../src/transfer/state.ts) calculates Earth/Mars ephemerides, the relevant local or Sun-centred orbit, shadow geometry and target geometry. With `includeGroundNetwork=true`, it additionally evaluates five authored stations with five reception-time iterations per station. The initial station evaluation precedes those iterations. The ground direction is toward a moving receiving station, not the Earth's centre.

The `false` network mode is numerically different: its contact target is the current Earth-centre position, visibility is false and the one-way time is the centre distance divided by light speed. `canonicalNextTime` and its energy-threshold search deliberately pass this cheaper environment to telemetry, including in some downlink decisions. Replacing it with a previously calculated full-network environment changes the existing model. The two variants must have distinct keys and outputs.

Current optimizations already matter:

- Runtime `resourceCache` evaluates a craft once per craft-object identity.
- `resolveHardware` has a frozen-craft fast path. The M03 runtime freezes the craft recursively, so repeated full `JSON.stringify` is not its normal hot path.
- [assembly.ts](../src/sim/assembly.ts) already caches occluder transforms and world-space aperture samples for immutable designs.
- `actualSolar` rounds body-direction components to `1e-12`, caches the most recent direction's unit-distance result, then applies the current inverse-square distance. Its existing rounding is part of the released calculation. A steadily Sun-pointing spacecraft can already hit this cache.

Consequently, source inspection alone cannot establish that ray intersection, rather than environment calculation, controller stepping or allocation, dominates total CPU time. Measurement must follow the freeze.

## Mutation and alias audit

| Object/API | Observed ownership | Consequence for a proposed cache |
| --- | --- | --- |
| `createTransferRuntime` inputs | Clones the solution and normalizes/clones the craft, then recursively freezes both through [immutable.ts](../src/transfer/immutable.ts). Runtime counters, quaternion, packets and other state remain mutable. | Immutable runtime-owned inputs are suitable identity keys. Do not freeze an editor's original draft as an optimization. |
| Bundled ephemeris tables | [ephemeris.ts](../src/transfer/ephemeris.ts) freezes every numeric row, the rows array, each table and nested source records. | Sharing the immutable tables is safe. Keep model/dataset/source hashes in any cross-runtime key. |
| `ephemerisAt` | Creates fresh position and velocity vectors for each call. | Current returned vectors do not expose table rows. A new memoized result must not accidentally expose mutable shared vectors. |
| `propagateKepler` / `hyperbolicLocalStateAt` | Create result vectors; even the near-zero Kepler-time path copies input vectors. | Current orbital samples do not alias frozen trajectory vectors. Preserve this boundary. |
| `transferStateAt` | Returns a fresh object, but `centerPositionKm`/`centerVelocityKmS` alias the corresponding returned `earth` or `mars` vectors in local phases. | Nested aliases exist within one result even though different calls are currently independent. A shallow copy does not isolate a cached sample. |
| `transferEnvironmentAt` | Returns mutable plain objects and vectors. With network disabled, `contactTargetPositionKm` aliases `state.earth.positionKm`. | Cache-private samples must be deeply immutable or never escape. Public output requires an isolated deep copy, not `{...sample}`. |
| `getTransferTelemetry` | Returns its environment directly. Worker messages are structured-cloned by the platform; direct module callers do not get that protection. | A worker-only assumption is insufficient. Direct-call telemetry must not provide a mutable route into cached state. |
| `transferTrajectory` | Preserves requested phase-local frames at inclusive endpoints by constructing a new wrapper and local vectors. | A cache refactor must preserve these explicit endpoint semantics, rather than return the canonical next-phase frame. |
| `resolveHardware` | The cached derived object, connections, issues, inertia and resolved-part records are not deeply frozen. Part references can refer to the input design; new catalogue definitions are deeply frozen. | Public derived output cannot be treated as a private immutable cache entry merely because its input is frozen. Copy and freeze independently derived data, or establish a separate private resolver boundary. |
| `visibilitySamples` | Public hardware results clone sample origins. A direction vector is shared among samples from the same returned call; cached aperture origins are not exposed. | Preserve inspection output semantics; do not return the internal aperture cache directly. |
| Transfer renderer | Its `vector` helper constructs a new `THREE.Vector3` from numeric components. Reviewed state consumers read orbital vectors. | No renderer mutation of those state vectors was found in the reviewed path. This is a source finding, not a guarantee about every future caller. |

No current environment-cache poisoning defect is claimed: there is currently no shared environment cache. The table identifies the hazards introduced by adding one. The already mutable public hardware-derived cache deserves an explicit boundary test before building more cached calculations on it.

## Proposal A: bounded private environment cache

Use a private runtime computation context, not a serialized state field. Associate it with the runtime's frozen solution identity and retain it only while that runtime/worker needs it. A `WeakMap` from runtime or solution to context permits collection after abandoned previews and terminated sessions. Do not maintain an unbounded global map of every historical timeline.

Suggested initial bounds, to be measured rather than assumed optimal:

- A 32-entry LRU for base orbital/environment-independent state, keyed by exact validated elapsed-time `number`.
- A 64-entry LRU for complete environment variants, keyed by exact elapsed time **and** `includeGroundNetwork` boolean. An implementation can instead use separate 32-entry true/false maps.
- Each miss calls the original arithmetic path. Eviction changes only recomputation cost, never numerical results.

Keep existing validation and endpoint clamping before cache lookup. Do not quantize elapsed seconds, hash a rounded Julian date, bin attitude angles or reuse a nearby time. Avoid keying through a calculation that loses the difference between two elapsed times. If sharing the base state between true/false environments, preserve the original arithmetic order and return-field definitions.

Private samples should be deeply frozen when first inserted, or held behind an equally strong private immutable representation. Public `transferStateAt`, `transferEnvironmentAt`, trajectory and telemetry contracts should retain independent writable output where callers currently receive it. A deep copy at the public boundary is acceptable; internal integration reads should avoid that copy. The existing worker structured-clone boundary may supply the final transport copy, but direct imports must still be safe.

Do not cache an entire `TransferTelemetry` only by time and quaternion. At the same timestamp, `updatePowerMode` can change `safeMode`, acquisition can finish, packets can be transmitted or received, storage can change, events can be appended and failure status can change. The second endpoint telemetry and next interval's start can therefore differ legitimately. Cache immutable geometry; calculate dynamic resource and status fields from the current state.

Lifecycle rules:

1. A new validated plan or restored runtime receives a new context. A discarded solve cannot publish its context as the current session.
2. Runtime termination and worker termination release references. LRU entries never retain prior runtime states or packet histories.
3. A resumed runtime can build a cold context without changing results. Cache contents are neither saved nor trusted from imports.
4. Existing mutable editor designs bypass identity-only caching; use a fresh immutable normalized snapshot when starting a forecast.

## Proposal B: compiled immutable craft calculations

Create one private compiled record for the normalized, deeply frozen runtime craft. Candidate contents are selected radio/antenna identifiers and constant definitions; antenna mounting frame; connected instrument/readout definition; recorder limits; ADCS inertia, acceleration and rate limits; the six ordinary combinations of three operations and slewing/not-slewing; and two safe-mode load values. Preserve the original part-reduction order and arithmetic expression order when computing constants.

The released M03 craft has no in-flight hardware edits, changing mass inertia or instrument selection. Its fixed craft constants therefore can be compiled. Dynamic acquisition state, angular rate, current attitude, distance, pointing loss, data contents and safe-mode status remain runtime values. In particular, the extra active-instrument load while readout continues outside an observation interval must still depend on acquisition state.

Key this first implementation by frozen normalized craft identity. A new model/bus, active radio, connection, mount position, rotation, science profile, hardware version or catalogue hash produces a new immutable craft/context. Do not key only by part kind, model list or bus name. Do not mutate a compiled record after construction. Public `resolveHardware` output should not be retained as a mutable dependency; derive a private copy with safe ownership, and test that public-output mutation cannot contaminate it. Missing components and failed launch designs must retain their original finite results and failures.

The same-craft identity is useful within one forecast. `createTransferRuntime` currently clones/normalizes inputs, so a newly created second runtime has a different identity and is initially cold. Do not describe repeated fresh-runtime forecasts as cache-warm unless a separately designed, validated cross-runtime cache actually exists.

## Proposal C: exact visibility and allocation reductions

These changes are secondary until counters establish their cost:

- Give internal `partVisibility` a streaming weighted reduction over cached aperture samples instead of allocating the public inspection array. Preserve sample order, every weight and all aperture positions. The six-wing array still has 18 apertures with five samples each.
- If a sample fails its pointing/FOV predicate, its contribution to internal visibility is already zero; its occlusion query may be skipped. Public `visibilitySamples` must continue reporting independent `clear` and `pointing` values for inspection graphics.
- For immutable geometry, precompute each aperture origin expressed in each relevant occluder's local frame. For one query direction, calculate that direction in each occluder's frame once and reuse it across samples. Do not reorder intersection arithmetic, intersections, accumulation or tolerance checks. Measure the additional memory for up to 20 parts.
- A private power sampler can avoid building packet totals, UI strings or RF inspection fields that the integration decision does not consume. It must preserve exact EPS load, safe-mode hysteresis, acquisition power and solar output. RF reception/pointing calculations remain in steps that use them.

Do not reduce the solar array to one ray, substitute a cosmetic visibility penalty, cache continuous pointing using coarser angular bins or increase existing solar-direction rounding. Such changes are neither exact nor justified by performance goals.

## Proposal D: trusted forecast checkpoints and responsiveness

This is a separate, later optimization because it crosses replay and worker ownership boundaries.

The current [worker](../src/transfer.worker.ts) sends `solved` after path solution, then computes the complete science/resource preview in chunks of at most 500 canonical steps. The current UI launch guard waits for that preview. The preview runtime is subsequently discarded; launch starts a fresh runtime. Restore calls [parseTransferSave](../src/transfer/persistence.ts), which independently solves the route and replays the checkpoint synchronously inside the worker.

Expose the two existing stages honestly: **path and launch feasibility ready**, then **full resource/science forecast pending/ready**. A valid Lambert path does not establish mission success. If launch before forecast completion becomes a product choice, use a separate preview-cancellation token so cancelling the background forecast cannot invalidate the active runtime session. Do not run an obsolete full forecast alongside active flight unnecessarily. Mission-time fraction is progress through the model; dense encounter/controller work means it is not a linear estimate of remaining wall time.

For repeated identical requests, a small worker-private checkpoint LRU could retain independently generated states at selected canonical boundaries. The key must include the complete normalized craft and plan, exact ordered operational data/IDs, runtime model, catalogue/dataset/source hashes and integration step. Use a canonical representation plus equality verification, not an unchecked hash alone. Limit both entry count and retained bytes; initial proposal: at most two complete input families and eight checkpoints total, with measured byte accounting and oldest-family eviction.

Only internally computed states may populate this cache. Imported coordinates, resources, frames or controller values must never populate it. On restore, still validate schema, all version/hash guards and the independently solved route; then compare the imported checkpoint against an internally trusted/replayed checkpoint. A cache miss performs the original replay. Corrupt imports must fail equally with warm or cold caches.

A warp can resume from a trusted checkpoint at or before its target only when every prior executed input matches. Clone the mutable state; do not share packet arrays, signals or acquisition state between forecast and live flight. The scheduler's `requestedTime` must be set according to the current warp/restore request, not inherited from a preview whose requested target was the end of the mission. Current restore independently checks committed `time`, then restores the separately validated `requestedTime`; retain this semantics. Never replace launch with the terminal preview state or credit future science early.

Cold restore should eventually use chunked replay with progress and cancellation. That improves responsiveness independently of cache hit rate; it does not remove validation work or authorize accepting serialized results.

## Explicitly deferred: `canonicalNextTime` discretization

The current controller refinement uses `angle / ATTITUDE_RATE_DEG_S` with the legacy constant 20 degrees/second even when hardware attitude propagation uses torque/inertia/momentum-derived limits. For errors between 0.25 and 20 degrees, the schedule can demand roughly 0.0125–1-second intervals while the actual hardware controller turns much more slowly. This is a plausible source of many intervals, not a measured attribution.

Changing refinement to a hardware-aware duration can change midpoint sampling, battery events, exposure completion, RF packetization, packet IDs and replay results. It is **not** an exact-preserving cache optimization. Defer it to a new explicitly versioned runtime with new validation and keep old 1.0.0/2.0.0 replay dispatch unchanged. Do not silently modify the current versions or widen their tests to admit a different partition. The future [in-flight operations proposal](m03-inflight-operations-proposal.md) also needs explicit event boundaries; combine any new stepping policy with that model review rather than disguising it as caching.

## Proposed exactness gates

All tests below are proposals for after the freeze. First capture the released executable/source and representative checkpoints as immutable baseline evidence. Do not regenerate expected values from the optimized code.

| Comparison | Required evidence |
| --- | --- |
| Same-grid old/new legacy and hardware | Exact recursive numeric equality, preferably `Object.is`, for canonical committed state, quaternion/controller state, minimum and current energy, fuel, all packet fields, RF signals/pending frames, events/order, tick and scheduler fields. Compare both 300 and 600 separately. |
| Checkpoints | Departure; Earth exit; middle cruise; before/after each observation/downlink boundary; eclipse entry/exit; safe-mode entry/recovery; periapsis; each capture/readout/receipt; Mars exit. Include times adjacent to each boundary and requests that stop before a canonical step. |
| Input families | Both legacy transfer presets; both hardware transfer presets; nightside B-plane route; weak-solar safe-mode route; missing/blocked RF; acquisition in progress; invalid launch; a full 20-part craft. Include relevant M01/M02 fixtures because assembly is shared. |
| Partition/read independence | One long request, tiny and irregular frame requests, maxSteps chunking, intervening telemetry/inspection calls, pause and resumed warp yield identical committed states and the intended requested-time values. |
| Cache isolation | True/false network calls in both orders; mutation of every returned nested public vector/record; different solution/craft with equal timestamps; frozen and mutable caller drafts; deliberate eviction; abandoned worker revisions. No later result changes. |
| Save integrity | Existing [legacy fixtures](../tests/fixtures/hardware-legacy-v2.json), new hardware checkpoints, exact replay and hostile resource/controller/hash edits with cold and warm caches. Existing parser tolerances remain unchanged; the new differential cache test itself does not use those tolerances. |
| Geometry | Every 18-by-5 solar sample, weighted visibility, optical FOV, occlusion and phase-local endpoint frames match before/after. Both radio chains and selected standby-power behavior remain correct. |

Exclude only inherently non-model metadata such as a newly generated `savedAt` from exact checkpoint comparison; do not exclude resources, signal IDs, event text/order, status or numerical state. JSON string equality alone is insufficient because object property order can differ; compare semantic trees, retain array order and check numeric exactness. Serialized checksums can supplement this after canonical serialization. The existing 300/600 convergence tests and independent GMAT/Horizons evidence remain additional gates, not replacements for exact differential checks.

Existing useful suites include [transfer runtime](../tests/transfer-runtime.test.ts), [resource audit](../tests/transfer-resource-audit.test.ts), [numerical audit](../tests/transfer-audit.test.ts), [worker contract](../tests/transfer-worker-contract.test.ts), [hardware transfer](../tests/hardware-transfer.test.ts) and [legacy replay](../tests/hardware-legacy-replay.test.ts). Their prior passing status does not prove a future cache refactor.

## Reproducible CPU benchmark plan

Run only after implementation is separately authorized and exactness gates pass. Record baseline and candidate commit/bundle hashes, model/catalogue/dataset hashes, OS, CPU, memory, Node/browser versions, power mode, worker configuration and fixed scenario JSON files. Run serially on the same machine without concurrent browser GPU QA, test runners or build tasks. Record thermal/power conditions; do not call a fresh worker an OS disk-cache-cold run.

Use the same two legacy and two hardware route/craft inputs, plus one nightside and one weak-solar case. Pin their operation order, exact times and integration steps. Use actual 300 and 600 settings as distinct cases, not a different setting for the faster candidate. A changed craft and a changed route are required cache-miss cases.

Measure separately:

1. Worker/module startup and data loading.
2. Path solve and launch validation, from validated inputs to `solved`.
3. Runtime construction and compilation.
4. Full mission forecast, from initial runtime to its terminal state.
5. Repeated exact-time environment queries in the same context, and public-output copying.
6. Cold strict save replay, trusted-checkpoint-assisted replay if implemented, and serialization separately.
7. Same-session warp after forecast, clearly distinguishing reused work from a fresh forecast.
8. Maximum worker chunk duration/cancellation delay, retained cache entries/bytes and peak memory.

Use `performance.now()` around the same boundaries, pre-load the module for compute-only cases, and report loading separately. Collect at least seven measured repetitions per case, with a declared identical warm-up policy and alternating baseline/candidate order. Report median and observed range; use more repetitions before interpreting a high-percentile latency. Do not hide failed or slower cases.

Define cache temperature precisely: **cold** means a new runtime/context with all proposed caches empty; **warm-query** repeats exact sample inputs in that same context; **warm-checkpoint** reuses an independently generated checkpoint for an identical validated family. A new runtime whose craft/solution was cloned remains cold for identity caches even if JavaScript code and ephemeris modules are already loaded. Report both process/module warmth and model-cache warmth.

In a separate instrumented run, count environment variants, Kepler/ephemeris evaluations, ray intersections, canonical steps and hits/misses/evictions. Do not leave counters enabled in only one side of the wall-time comparison. Checkpoint/output comparisons must establish identical computation results before publishing latency improvements. No promised speed multiplier is justified until these measurements exist.

## Suggested sequence after v3 publication

Implement bounded environment caching and its isolation tests first; then compiled immutable craft values; then only the visibility/allocation work supported by measurements. Each step must pass the exact baseline comparison before the next is added. Treat forecast checkpoint reuse and async restore as a separate worker/persistence change with session-race tests. Keep step-size/controller-policy changes on the explicitly versioned future-model track.
