# High16K steady-flight successor — prepared only

**No syntax check, test, build, browser or measurement has been run.** Wait for the root-owned Worker profiling lease to end. This new script leaves `v9-active-first-light.mjs` and its failed high16K r2 report unchanged.

`tools/performance/v9-high16k-steady.mjs` declares **`actual-prefix-retained-history-v1`**. It launches the real Compact preset through visible controls, pauses within T5, selects 1× and the actual high-quality craft view, and waits for real 16K/PBR readiness. It then sends a trusted Resume, advances to `max(T5, initial time + 1 s)` with light 250 ms observation, requires genuine uploaded history, and sends trusted Pause by T10. The prefix is bounded to 15 wall seconds and retained in the report; no runtime, trail, science, or camera state is injected. A ten-second unchanged-runtime paused warmup follows.

The next native Resume begins **120–121 actual wall seconds at 1×**. Raw mean ≥60 FPS, p99≤33.3 ms, ≥115 physical seconds, ≤wall+0.25 s physical lead, actual mechanism work, committed Worker FK, 12 right drags/12 wheels, native input and all visual/error gates remain unchanged. Baseline history is now explicitly visible/uploaded with ≥2 actual points. Every measured native create/delete counter and live object ID, all GPU counts/program IDs, and all history/non-history object identities must match that baseline exactly. **Zero allocation/deletion is allowed during measurement.** The original hidden-baseline/first-upload-delta obligations are replaced by this different declared startup contract, not force-passed. Medium r2 remains separate first-upload evidence.

Startup frame/long-task evidence remains separate from warmed `timing.json`. This measures steady active high-detail flight after genuine startup; it does not certify high-detail startup stutter or repair the earlier numerical FPS failures. The environment still allows uncontrolled unrelated desktop applications.

Run only after lease release, from `orbital-foundry-next-orbit-ui`:

```powershell
node --check tools/performance/v9-high16k-steady.mjs
$env:PERF_ISOLATED='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5191'
$env:PLAYWRIGHT_QA_CANDIDATE='v9-high-steady-r1'
$env:PLAYWRIGHT_BROWSER='chrome'
node tools/performance/v9-high16k-steady.mjs
```

Exact contract/initial script hash: [v9-high16k-steady-contract.json](../tools/performance/v9-high16k-steady-contract.json). Use a new candidate ID for any retry; the 360-second deadline and report-overwrite refusal remain.

# One bounded v8 standard20 diagnostic

After high verification and all automated workloads stop, the coordinator may temporarily stop its own 5191 candidate server and serve **main accepted v8 production `dist` at the same guarded port 5191**. Do not rebuild or mutate v8 product files. Copy exact current `v9-standard20.mjs`, `v9-native-lifetime.mjs` and `v9-scenario-contract.json` into main `tools/performance/`, preserve copy hashes, and keep the existing native-deletion audit (same source after line-ending normalization). Record the accepted v8 checkpoint and `dist` identity before serving it.

Run once from the **main `orbital-foundry` working directory**, so the harness binds its source/public/dist manifests to the actual served v8 product. Use the same browser, original20part fixture/input replay, viewport/settings, observers, numerical gates and disclosed desktop environment:

```powershell
$env:PERF_ISOLATED='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5191'
$env:PLAYWRIGHT_QA_CANDIDATE='v8-standard20-control-r1'
$env:PLAYWRIGHT_BROWSER='chrome'
node tools/performance/v9-standard20.mjs
```

This is one 120-second control, no automatic repetition. A matching shortfall weakens a v9-specific explanation; a v8 pass makes a v9 effect worth investigating. Neither outcome proves causality with uncontrolled background applications or upgrades an existing v9 FAIL. Preserve its separate artifact path and return the coordinator's server to the intended candidate before further work. No copy/server change/control run was performed by this preparation.
