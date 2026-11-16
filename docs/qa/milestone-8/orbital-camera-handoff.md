# Orbital inspection camera handoff

Bounded opt-in camera follow is ready for root integration. It preserves the initial Earth-limb composition as the real spacecraft radial changes, while retaining the player's chosen bearing, zoom and selected-part target. It does not improve the underlying Earth texture resolution.

Copy only these production files from this isolated candidate:

| File | SHA256 |
| --- | --- |
| `src/render/deployment-scene.ts` | `a30331d542c587b63eeec9ffb47578841d2a99c3771b0ffd1d7c988a0de6ed57` |
| `src/render/deployment-scene-types.ts` | `407ecaa33d4a95a1d3ac9965daa7d23dc5f16ea9815bf4d0ffdda3d193e8351c` |
| `src/render/orbital-inspection-follow.ts` | `0d2ff215102a4efb2c3464a3a5e16b9ad3a74dfad94982b07d04a1d10ec41055` |

The root host should pass `orbitalInspectionFollow: true` to its DeploymentScene options. Default is false. No root UI, main entry, domain, Earth asset, mesh or material was modified here. The accepted viewport idempotence and mount grab-offset fixes remain in the scene.

For each new committed craft-mode radial, a minimal rotation transports the CURRENT camera offset and up. The existing inspection camera still follows the exact focus position and retains its relative fit-distance zoom. Identical snapshots/render frames do not rotate again. Saved craft mode state includes its radial reference and relative zoom; orbit-map/workshop modes retain independent viewpoints. Source/epoch changes and backwards seek reset the reference rather than transporting through stale history. Existing explicit focus/refit and physical camera-clearance constraints still apply.

Installed Three r182 caches the controls up basis. The narrow adapter synchronizes those two quaternion values without replacing controls, clearing angular damping, or disturbing an active pointer gesture. The CPU test pins the installed revision and verifies this behavior. A future Three upgrade must rerun that adapter test. Cross/atan2 quaternion construction avoids the near-antipodal snap in Three's convenience method, with a deterministic exact-antipode axis. Zero, nonfinite and norm-overflow vectors are rejected.

Validation on exact handoff bytes:

- `docs/camera-unit-results.json`: five CPU tests pass; TypeScript checking passes. These cover radial-bearing/radius preservation, degeneracy/antipodes, commit/source/seek idempotence, copied saved references, actual installed controls/damping, and relative zoom across focus/envelope changes.
- `docs/qa/camera-fixture-browser-result.json`: native Chrome 157.0.8103.52 recomputed the original actual browser repair craft/plan/numerics to completion, matching every terminal checkpoint field exactly. The fixture captures actual T0, T240, T600 and T1385.0067053601188 snapshots. The saved terminal state is compared, never injected into simulation.
- `docs/qa/orbital-camera-v3/report.json`: final component browser gate passes in 33,934 ms. It retains 20 screenshots, matched baseline physical transforms at 1280x720 and 1920x1080, 26 real right-drags, wheel zoom, a committed update during an active drag, selected-part focus, craft/orbit mode restoration, settled pause stability, three native context restores and final disposal. Application/HTTP/native errors are zero. One shader compiler warning log is retained; the run is not warning-free.
- Default matched before/after renderer counts remain equal: 120 calls at T0/T240/T600 and 121 at T1385, with seven textures in all these views. No renderer resources or asset requests were added. This is not an FPS benchmark.

Visual inspection includes final 720p before/after pairs at T240, T600 and T1385, the user-chosen and restored views, plus the matching default T0 and 1080p terminal composition from the earlier unchanged normal-input camera pass. The Earth limb stays visible in the default view rather than drifting across the entire scene. The current 4K day map remains visibly soft in close views; that quality limit is not hidden or claimed solved. A player remains free to orbit toward or away from the Earth.

Preserved rejected evidence: `docs/rejected-camera-cpu-v1.json` records the first near-antipode defect and CPU DOM fixture disposal error. `docs/rejected-node-camera-fixture-v1.json` and `docs/rejected-node-fixture-generator.ts.txt` retain the Node/Chrome angular checkpoint mismatch. Node interchange is NOT certified; native Chrome replay is the accepted proof, with no tolerance or physics change. `docs/qa/orbital-camera-v1/failure.json` preserves the fixed-wait camera comparison rejected while real damping was still active. The corrected harness waits on actual pending damping below 1e-14, never resets it. v2 passed, then v3 reran after adding the norm-overflow guard so final source hashes match.

This is DeploymentScene component acceptance, not full product UI, production bundle or deployment acceptance. The internal hardware art handoff is separate. All owned browser/server5186 processes closed before GPU release.
