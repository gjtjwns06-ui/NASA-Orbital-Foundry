# Retained committed-history trail

This bounded renderer change keeps the history Line, LineBasicMaterial, and position buffer across committed snapshots. It preserves the exact existing Float32 display coordinates, material appearance, depth behavior, and active-geometry bounds. It does not propagate trajectories or change any simulation, craft, Earth, attitude, camera, or physical history data.

## Files for integration

| File | SHA-256 |
| --- | --- |
| `src/render/deployment-scene.ts` | `96fb848cf5961f7f54bedd78617bab4a5b06278cea478287e2ab3ecebc35f07a` |
| `src/render/committed-orbit-trail.ts` | `8f0faa19d2b95832d3f74f4889ab850f43417ccdaaa084c22a8e050f8bf91ce3` |
| `tests/committed-orbit-trail.test.ts` | `f7294e046bcb0059c2eb02f29480bb63968851613a9cd79993faa0393caf72a2` |

Only the first two files are product changes. The test uses `docs/actual-camera-fixture.json`, copied byte-for-byte from the accepted working-face proof. `src/render/deployment-scene-trail-baseline.ts` is a byte-identical test-only baseline for the isolated browser harness; do not integrate it as product code. The complete production diff is `retained-trail-production.diff`.

## Allocation and lifecycle contract

The named `committed-actual-history` Line exists from scene construction. Its initial position BufferAttribute contains 1024 Float32 XYZ positions (12 KiB), using DynamicDrawUsage. The game host keeps no more than 720 active history points. Within that range, Line, geometry, material, attribute, and array identities remain unchanged. Each update sets drawRange to exactly the supplied point count and updates only the active buffer range. Empty and one-point histories are invisible; no fictitious segment or forced offscreen draw is introduced.

Positions use the previous EarthMJ2000Eq-to-Three mapping and Float32 conversion exactly, including `setFromPoints`' canonicalization of the Z signed zero. Bounding box and sphere are computed from active Float32 positions only, excluding stale buffer tail and unused origin values. CPU tests confirm exact old/new bounds and matching visible/offscreen frustum decisions.

For a rare larger input, capacity doubles until every supplied point fits. A new geometry is allocated, swapped onto the same Line/material, and the previous geometry is disposed once. No input is silently truncated. Source replacement and null snapshot reset clear drawRange and hide the Line while retaining allocation. Existing scene context-loss traversal retires GPU registrations without discarding the CPU objects; final disposal is idempotent and removes the Line.

The T0 host may already contain one actual point, so drawRange can be one while invisible. Native GPU registration remains lazy: the first real visible trail can add one geometry/program. This change makes no claim that an empty T0 renderer count equals the later visible-trail count. The original failed performance gate and its declared thresholds remain untouched. Domain/root own the separately declared successor ownership and performance gate.

## Evidence

- CPU: `trail-unit-results.json`, 8/8 passed. Tests cover empty/one point, exact old Float32 points and bounds from actual native-Chrome positions, visible/offscreen frusta, full host-sized growth/decimation, 1025-point capacity growth and retirement, shorter/reset histories, three context-resource retirements, idempotent disposal, and invalid/overflow input rejection.
- TypeScript: `npx.cmd tsc --noEmit`, exit 0, receipt in `trail-typecheck.json`.
- Browser v1: `qa/retained-trail-v1/failure.json`. The matched component scope completed: eight baseline/candidate images at T0/T240/T600/T1385, exact physical snapshots and camera, stable owned identities, native growth to 2048 capacity without truncation, null reset, three actual context restores and disposal. The overall run is retained as rejected because the subsequent real-UI harness waited for idle immediately after launch, which intentionally auto-plays at 8×. It timed out while the game continued to advance. This was a harness sequencing error, not a product fix.
- Browser v2 actual-only closure: `qa/retained-trail-v2-actual-closure/report.json`, PASS, 17,630 ms, native Chrome 157.0.8103.52. Genuine visible compact-design launch, immediate pause, visible 1× selection, and real advancement reached T5. Active positions exactly matched host committed history. Runtime, craft, plan, telemetry, result, and trail remained exactly equal across three native context restores. Visible exit completed. Zero application/HTTP/native errors; one retained shader compiler warning log.
- The v2 runtime SHA-256 is `5e03c13e0da6e2da042d0cfc499d69819c29516f540a1eaac41af611ba7ed726`. It is a native-Chrome observation, not a Node cross-engine replay assertion.
- Terminal baseline/candidate images and the actual restored-flight image were individually inspected. The orbit view is visually unchanged; it joins only the supplied actual points. This component fixture uses four actual committed positions and does not claim a dense trajectory reconstruction.

Rejected CPU v1 is retained in `rejected-trail-unit-v1.json`: tests caught the old Three signed-zero convention and a test camera placed inside the whole-history bounding sphere. The signed-zero implementation and frustum fixture were corrected. The initial test-only TypeScript union-access error was fixed with a BufferAttribute cast. No numerical tolerance or FPS threshold was loosened.

No main product file, performance harness, or asset was changed by this agent. No 120-second FPS claim follows from these component checks. Root integration and successor production performance/Edge regression are separate acceptance. All owned browser and Vite 5186 processes were closed, and GPU was released after the v2 closure.
