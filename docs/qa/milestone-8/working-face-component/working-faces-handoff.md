# Explicit working-face camera handoff

The one-shot `DeploymentScene.focusWorkingFaces()` action exposes the spacecraft's actual current solar and RF working faces. It changes only the inspection camera. It does not change the craft, center of mass, attitude, mechanisms, Earth, physics, telemetry, or mission results.

## Production manifest

| File | SHA-256 |
| --- | --- |
| `src/render/deployment-scene.ts` | `a978cdaf3da76d4156bf94a552b1e0c11d33224a4aa444898842da591e3509a2` |
| `src/render/working-face-direction.ts` | `39cb00a30088c95b1287297bea792d9aa7bc3a7f4fb787f55834da1fdfc3f47e` |
| `tests/working-face-direction.test.ts` | `874a47c7efa42d18e1d5689ee58f7b4a74391e97b08f65575da9c72dad8816af` |

Only the first two files are production changes. The renderer diff is against the accepted orbital-follow scene retained as `deployment-scene-baseline.ts.txt`.

## Contract and deterministic selection

`focusWorkingFaces()` returns a `WorkingFaceChoice` with `applied:boolean` and, on application, `cameraPosition` and `cameraTarget`. `applied` is the action receipt, not a persistent automatic camera mode. A missing actual flight, invalid presentation input, unavailable viewport/context, or no useful exposed face leaves the current camera unchanged and returns an informative reason. The host should expose this action for a live flight and show a localized informational notice on `applied:false`.

The pure helper reads the supplied current aperture and oriented-box geometry. It evaluates 120 fixed azimuths plus the current azimuth on the useful Earth-limb cone. Candidates must remain outside Earth with a clear eye-to-focus segment. Five observer rays per aperture test the actual boxes; only the aperture's own emitting box is skipped. This is camera visibility, not a replacement for physical power or RF visibility calculations.

Area-weighted front cosine and clear-sample fraction are normalized separately for solar and RF apertures. Ranking prefers the number of visible types, then the weakest type's score, total score, and proximity to the user's current direction. Deterministic enumeration resolves ties. The helper accepts finite nonzero direction vectors of different lengths, with no terminal-time or equipment-model condition. Stowed, partial, deployed, and fixed-plate geometry use the same path.

Application frames the whole craft once, sets the selected camera direction/up, and preserves subsequent right-drag, wheel, orbital follow, and mode state. It does not refit automatically on subsequent frames.

## Verification and measured scope

- CPU: 8/8 passed, including actual stowed/partial/terminal geometry, fixed plates with arbitrary identities, rotated occluder fallback, array-order determinism, display-unit scaling, non-unit current/limb directions, malformed and overflow inputs. Raw report: `working-face-unit-results.json`.
- TypeScript: `npx.cmd tsc --noEmit`, exit 0. Recorded separately in `working-face-typecheck.json`.
- Accepted browser report: `qa/working-faces-v3/report.json`; native Chrome 157.0.8103.52; 56,352 ms. Zero application, HTTP, or native context errors; one retained shader compiler warning log. This is not a warning-free claim.
- 12 component images cover matched T0/T240/T600/T1385 at 1280×720, terminal 1920×1080, genuine player orbit/zoom, and native context restoration. Three additional actual-game UI screenshots make 15 images total; the report's `shots` array contains the 12 component images.
- The real game UI strict-replayed the original authored repair export to complete 16,000,000 received bits at T1385.0067053601188. Runtime, craft, plan, telemetry, and result were exactly equal before/after the action, genuine pointer orbit/zoom, and native context restore. The measured runtime JSON SHA-256 is `c4579802ec6c545bdd40190899b99fcefcf7110b0b6af6ad316b33a5f7ddf208`.
- Actual UI proof used an explicitly labeled QA DOM host button calling only the public camera API. It did not inject runtime state or implement the final product UI button. Final production button layout and bundled-game regression belong to root QA.
- The actual terminal view exposes both PV and RF types; its minimum normalized type score is 0.3569297237402532. Component physical snapshots, owned geometry counts, texture pool, and texture count stayed unchanged. Repeated action was idempotent; relative orbital bearing, mode return, three native context restores, and disposal passed.

## Rejected evidence retained

`qa/working-faces-v1` failed because the first helper rejected the renderer's non-unit current offset (length about 0.081). This was a real integration defect. The corrected helper normalizes finite nonzero vectors; the added direction-scale test covers it.

`qa/working-faces-v2` failed because a harness assertion expected renderer-uploaded geometry count to stay exactly 57. A newly visible existing mesh lazily uploaded, making it 58. The corrected harness checks owned scene geometry objects and texture ownership, retains raw render counters, and checks native disposal. No rendering, physics, or tolerance change was used to conceal the failure.

## Visual review and limits

The matched terminal and all three actual UI images were individually inspected. The action makes blue solar surfaces, the gold RF structure, and the service bay legible with the Earth limb below. The restored screenshot preserves the user's subsequent orbit and zoom. Real folded and deployed geometry remains unchanged.

The existing 4K Earth surface remains visibly soft at this close orbital scale. The bus and narrow solar strips retain their actual supplied dimensions; this camera change is not a new spacecraft design or a claim of commercial-game graphics parity. Shader compiler warnings remain in the raw report. No 8K texture was downloaded or added.

Browser replay evidence is native-Chrome evidence. Earlier Node/Chrome floating-point replay interoperability limitations remain documented in the separate orbital-camera package; this change does not relax strict replay or claim cross-engine checkpoint identity.

All owned Chrome sessions and the isolated Vite 5186 server were closed after the accepted run. GPU is released for root's final production QA.
