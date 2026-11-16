# Active-flight resource attribution — 2026-11-15

The original `m8-v8b-active-r1` remains **FAILED** under its declared exact resource-count rule. Its other gates passed: mean 60.000783 FPS, p99 17 ms, 120 actual simulated seconds, 564 J motor consumption, real inputs, renderer/Worker pose agreement, and zero application/resource/native-ownership errors. This diagnostic does not convert that result into a pass.

## Observed cause

At T0 there is only one actual history point and no history line. The baseline therefore has 81 uploaded geometries and 11 programs. Once the genuine history has at least two points, its line adds one geometry and one program. Exact equality with the T0 baseline is already unsuitable for that legitimate first appearance.

`DeploymentScene.updateTrail()` clears and disposes the previous `BufferGeometry` and `LineBasicMaterial` on every accepted snapshot, then creates replacements. Three's installed `WebGLGeometries.get()` counts a geometry only when it is submitted for rendering; disposal decrements it immediately. Material disposal releases its program reference, and the program is deleted when its last reference is released.

A short diagnostic used visible settings, Compact selection, launch/pause/1x controls, a real `+60s` computation, four actual right-drags while paused, then three seconds of actual 1x flight. No runtime, camera, geometry, or Worker result was injected. The diagnostic reads scene ownership and existing renderer upload state and records native create/delete calls without suppressing them.

- The paused T60 runtime was byte-for-byte unchanged by all four right-drags. Its history object/geometry/material and every native allocation counter stayed unchanged.
- Eight Worker-message/next-rAF pairs reproduced **81 geometries / 11 programs → 82 / 12**. The same replacement history was inside the frustum in both observations. It had no renderer upload state immediately after the Worker message, then had upload state after the next real render.
- Those eight messages retained the same physical T60 yet changed the history geometry/material identity each time. Rebuilding is triggered by snapshot adoption, even before another physical step has completed.
- Across the three-second active interval, native creation/deletion was exactly 174 buffers, 174 vertex arrays, 174 programs, and 348 shaders. Texture, framebuffer, and renderbuffer counters did not change. Shader pairs are deleted immediately after linking. Live counts returned to the same values.
- Every non-history geometry and material identity remained stable. The scene owned 164 unique geometries, 42 materials, and 297 renderable objects at every observation after the line appeared. Ground marker `Mesh` objects are replaced, but reuse the same geometry/materials and introduce no additional native allocations in this probe.

This attributes the observed three-second native churn to the history lifecycle. The original run's approximately 34,000 total native objects also include startup; the probe does not claim each original allocation was a history object. It demonstrates the cause of the intermediate dips without requiring a frustum-culling explanation. It also identifies real avoidable allocation/program-compilation churn, rather than dismissing the count failure as harmless measurement noise.

## Proposed replacement resource contract (requires explicit acceptance)

Keep the original FPS, p99, duration, actual 1x progression, input, mechanics, render-FK, error, native-ownership, and frozen-input gates unchanged. Preserve R1 and run any accepted revised contract as a new candidate/test identity.

For the retained-history implementation, predeclare an ownership/lifetime rule:

1. Read the actual named `committed-actual-history` line from the scene. At most one can exist. Exclude only that identified object when comparing the complete non-history geometry/material identity sets; those sets must remain exactly equal to the warmed baseline.
2. Once the history line exists, its object, geometry, material, and position-buffer attribute identities must remain unchanged through the measured flight. Active points must match the committed history, with the declared maximum of 720 points. The draw range and bounds must use actual populated points, not unused capacity. No empty history is forcibly rendered to warm counters.
3. Account for GPU upload state explicitly: uploaded geometry count minus the identified history's actual upload indicator must equal the baseline non-history count. Compare program identity sets after removing only programs exclusively owned by the identified history material; shared programs are never removed. Textures must remain exactly stable. This is an attribution equation, not an arbitrary ±1 tolerance.
4. Separate the legitimate first real history upload from subsequent updates. Once uploaded, retain its GPU geometry/program and show no recurring buffer/VAO/program/shader create/delete cycle during history updates. Native counters and observed ownership must account for any first-upload changes; an unexplained allocation or disposal fails.
5. Retain the existing visible exit and native deletion audit so actual disposal is checked after measurement. This verifies ownership retirement; it does not imply unrelated driver-owned context resources must all be zero.

The retained-line optimization and this explicit gate revision solve different issues: retaining the resource removes real churn; accounting for first upload correctly handles a previously absent physical path. Neither justifies changing the original failed verdict or the frame-time targets.

## Evidence

- `report.json`: raw ownership, per-kind native counters, paused-runtime comparison, eight paired observations, and exact before/after source/public/dist/test manifests.
- `analysis.json`: count differences and exact non-history identity comparisons.
- `probe.mjs`: exact diagnostic implementation. Node syntax check passed; the actual diagnostic completed with zero app/native errors and unchanged frozen inputs. Browser closed after completion.
- Original failed run remains at `tests/browser/artifacts/performance-deployment/m8-v8b-active-r1/chrome/report.json`.

No production source, public asset, dist file, original performance harness, or original failed report was edited for this diagnosis.
