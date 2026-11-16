# Clearance cues — scoped handoff

The candidate adds two clickable names to the existing highlighted clearance boxes. Labels use the actual preview guide world centers, the accepted source/request IDs and the supplied sample angle. Blocked and uncertain reports have different wording. These are inspection-box centers, not claimed contact points. Clicking selects the actual part without reframing the camera; closing the preview explicitly returns the player to the existing native placement gesture.

Five production files changed: `src/deployment-ui.ts`, `src/deployment-ui.css`, `src/render/deployment-view.ts`, `src/render/deployment-scene.ts`, and new `src/render/clearance-cue-layout.ts`. No physical-domain, save, candidate-geometry or GPU asset ownership code changed. Placement ghosts without highlighted guide boxes do not receive labels. Flight has no label projection work.

| Evidence | Observed result |
| --- | --- |
| R1 focused CPU | 4/4 passed, 3.23 s suite; actual Three.js box-center transforms, blocked/uncertain metadata, freshness/visibility/context gates, projection and bounded card layout. Synthetic reports are explicitly labelled and do not claim a physical run. |
| R1 build | Passed. Read-only review subsequently found keyboard focus could jump from persistent cue B to A after repaint. R1 was not accepted for native use. |
| R2 focus correction and build | Passed production build. The correction preserves the exact focused persistent cue button. Geometry/layout CPU-tested source was unchanged. |
| R2 Korean native case | Passed, 21.0 s. Real Worker witness IDs/anchors; unchanged craft/programme/camera on name selection; second-cue keyboard focus retained; explicit close; native cable-guide drag makes the actual Worker draft launchable; undo + fresh Sweep; Escape clears preview. |
| R2 original English case | Failed, 24.1 s, at an incorrect harness expectation that all resize events cancel the preview. The preview remained valid and the labels reprojected correctly. This failure and exact script bytes are retained. Later context/preset/flight steps were not reached in this run. |
| R2 English closure | Passed, 32.3 s case / 51.7 s runner. 1920×1080 English large UI and 1600×900 reprojection retain the exact source/request, preview geometry and physical input; actual label centers remain reachable and bounded. Native context loss/restore clears labels; fresh Sweep works; preset and real live launch hide cues. |

All three native case reports retain unchanged before/after frozen identities, zero application errors, zero native audit errors and two observed native contexts. Driver shader warnings are retained in the reports; this is not a zero-warning claim. These are functional checks, not FPS, resource-allocation performance, full-mission completion or overall game acceptance claims.

Screenshots were visually inspected: the Korean1280 and English1920/1600 labels are readable, attached to the correct outlined boxes and clear of the panels, badge and timeline. Both annotation centers and cards fit the available region. Behind-camera/offscreen/too-small-space and uncertain-status behavior were checked in focused CPU tests, not fabricated in the native game.

Historical harnesses remain byte-exact under `docs/clearance-cues-r2-native-harness.txt` and `docs/clearance-cues-r2-closure-native-harness.txt`. Historical freeze manifests record their original runtime paths. The active `tests/browser/deployment-clearance-cues.spec.ts` now combines the already-passed Korean case with the corrected English closure case, using the same shared checks; this combined runner was not repeated. The final manifest distinguishes this test-only packaging from the unchanged R2 product/build. No failed record was rewritten as a pass.

Artifacts: `tests/browser/artifacts/deployment-clearance-cues/clearance-cues-r2/` and `.../clearance-cues-r2-closure/`. Production build identity: `index-BzEePNkK.js`, `deployment-ui-P8rkkv3f.js`. Transfer only the exact five production files after root review; the candidate remains separate from main until that integration is performed.
