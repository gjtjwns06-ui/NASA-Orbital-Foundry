# Hardware renderer and encounter controls — integration record

2026-11-15. This records the next source iteration after the deployed v2 milestone. **Candidate A has four unique interaction cases passing across an initial3/4 run and a targeted1/1 retry. Candidate B final integration is pending.** Do not replace the previous v2 release evidence with these source checks.

## Art and shared geometry

The sixteen model meshes and two bus interiors are original procedural Three.js work in [parts.ts](../src/render/parts.ts), using the physical boxes, metre coordinates and apertures in [the hardware catalogue](../src/hardware/catalog.ts). They are simplified educational representations, not manufacturer CAD, product-qualified assemblies or redistributed vendor artwork. Numerical provenance and authored geometry are distinct in [the hardware proposal](hardware-expansion-proposal.md).

- Both new buses retain the exact 1.30×1.60×1.30 m external envelope. Surveyor uses a smaller usable bay with teal partitions; Pathfinder uses the larger bay with amber trim. Floor and rail locations read the shared bay profile.
- The fixed wing has three distinct photovoltaic surfaces; the six-wing array has eighteen. The shared descriptor also includes rear rails and structural spars. Each patch participates in the weighted geometric power model; the bus EPS can limit total accepted power.
- Radio carriers expose boards, standoffs and original electronics representations. Iris uses a stacked carrier. XACT representations have three orthogonal wheel axes within the common envelope, without claiming to show the vendor's exact internal arrangement.
- Single/dual batteries and small/large recorders have different actual sizes and identifiable cell/chip groupings. Optical bodies retain the catalogue's different physical depth and aperture; the inspection reads the current authored 12°/4° half-angle models. The reflector feed stem belongs to the shared physical descriptor.
- New static parts are batched by material; solar patches remain separate surfaces and removable bus panels preserve their `bayCover` tag. This reduces draws without hiding logical part identity or changing the mechanical bounds.
- Legacy factory bodies were compared with the deployed HEAD source and retained exactly, aside from internal function renaming. Model-free saves continue to call those factories.

No external asset-generation API, paid generation or new third-party bitmap/model download was used for these meshes. Common metal, solar-cell and insulation textures are the existing original procedural materials.

## Interaction integration

`createBus(design?)` and `createPart(kindOrPart, design?)` preserve the old API while resolving new hardware by version/model ID. Assembly, drag ghost, move, duplicate, same-ID replacement, stow inspection and M03 flight all use the same definition and mounting transform. The scene invalidates the cached bus/model when profile identity changes.

Selected new hardware shows its actual optical/solar axis and resolved power/data/RF status. These labels describe logical compatibility; they do not invent a physical harness route. `focusSelectedPart()` and double-click use a closer camera, not enlarged hardware. The normal build framing and distance limits are restored by craft/axis/mount views or mode changes. Internal boards open the service bay for inspection.

M03 has two additional planning handles in the Mars view:

1. Amber handle: actual periapsis location; drag changes altitude within the solver's 250–10,000 km range.
2. Blue handle: the incoming B-plane impact point; drag changes its angle within ±π. It is a planning construction, not another spacecraft location.

The local guide holds the last accepted incoming asymptote fixed and uses the actual hyperbola equations. It does not redraw the accepted full transfer or call the full solver on every pointer event. Commit calls the parent `encounterChange(altitudeKm, angleRad, true)`; the parent updates the plan and requests a fresh full solve. Escape/pointer cancellation restores the hint without committing. Runtime disables all these editing handles.

`setPlanningPending(true)` mutes the retained path to 28% of its accepted opacity, labels it as the previous accepted solution, and disables the editing handles. Changing view preserves that state; a new accepted solution restores normal display. Invalid solutions still clear the path rather than leaving an approved-looking stale trajectory.

TransferScene also accepts a third constructor argument `{quality}` and exposes `setQuality()`/`getRenderSettings()`. Medium caps DPR at1, uses64×48 planet meshes and48×32 cloud/atmosphere meshes, and caps anisotropy at4. High preserves96×64/DPR1.5/anisotropy8; low uses40×28/DPR0.85/anisotropy2 and disables decorative cloud/atmosphere layers. Old geometry is disposed on changes, late textures honor the current setting, and all scientific trajectories, handles and diagnostics retain their samples. Root UI inheritance and actual browser behavior still require the frozen pass.

## Completed checks and pending checks

| Evidence | Current result and scope |
|---|---|
| [Hardware geometry/inspection tests](../tests/hardware-render.test.ts) | **22/22 PASS**: every rendered vertex of all16 models lies in shared boxes, both bus envelopes/bay metadata, three/eighteen solar surfaces, legacy overload, actual optical angles/UHF pattern, ninety weighted panel rays and EPS cap |
| [Encounter guide tests](../tests/transfer-encounter-guide.test.ts) | **2/2 PASS**: actual periapsis radius, orthogonal B-plane impact vector and analytic impact radius across valid altitude/angle values; angle rotation and input immutability |
| [Existing inspection tests](../tests/inspection.test.ts) | **6/6 PASS** after dispatch changes: legacy power, shadow movement, pointing and disposal stay correct |
| [Initial model contact sheet](qa/hardware/models-v2.png), [metadata](qa/hardware/models-v2.json) | Eighteen models/buses rendered, Chrome157, zero console/page errors. Cameras fit each thumbnail; the sheet is not a common-scale comparison. This image predates the orthogonal-wheel/feed-stem/material-batching refinements and must be refreshed before final delivery |
| [Browser suite](../tests/browser/hardware-interaction.spec.ts) | Candidate A `index-BQvbEXhp.js`, Chrome157.0.8103.52,1280×720: four unique PASS across initial3 + targeted1. All16 catalogue cards actually dragged onto the3D bus; focus/double-click/bus undo; same-ID model/duplicate; Mars altitude/B-plane commit/Escape/pending. Zero browser errors. Initial focus test clicked a clipped shelf card; adding scrollIntoView corrected the harness. This is not one full4/4 rerun |
| [Diagnostic smoke](qa/hardware/actual-hardware-smoke.json) | Candidate A diagnostic reproduces the clipped-card harness: elementFromPoint returned canvas at an unscrolled card centre and no ghost started. Superseded by the passing corrected focus case; not a product defect or a passing proof |
| [20-part fixture](../tests/browser/artifacts/performance-standard-prep/legality-report.json) | Prepared without browser/GPU execution. All20 real model placements pass geometry validation. It retains instrument/power/budget warnings and is explicitly a planning stress fixture, not a successful mission |

The source checks do not establish browser layout, final screenshot quality, long-run memory or original NFR01 performance. Those still need the frozen candidate's actual pointer tests and coordinated GPU measurements. Static stow inspection remains a compact-envelope preview; no folding mechanism, swept deployment validation or flight deployment animation was added in this slice.

## Candidate A visual review and candidate B source fixes

The refreshed [production18-model sheet](qa/hardware/models-v2-production.png) and [mesh/bundle metadata](qa/hardware/models-v2-production.json) extract actual candidateA meshes. All18 rendered with zero browser errors. Orthogonal wheel axes, continuous reflector support and batched carriers are visible. Thumbnail cameras fit each model; actual dimensions remain unchanged. Audit camera clipping planes scale with the model so small surface offsets retain depth precision.

Actual1280screens are [radio focus](../tests/browser/artifacts/hardware-interaction/radio-focused-1280.png), [same-ID Iris replacement](../tests/browser/artifacts/hardware-interaction/iris-model-swap-1280.png), and [Mars handles](../tests/browser/artifacts/hardware-interaction/mars-approach-handles-1280.png). Review found that the old lower legend overlapped the blue B-plane grip even though pointer input worked. Source moves only the legend to the upper safe strip in Mars planning; physical points stay fixed. The browser test now asserts grip/legend separation, pending candidateB execution.

CandidateB source also dispatches the target region to the hardware10km precision radius (legacy70km unchanged), and uses the actual selected/first camera4° or12° half-FOV for the explicitly labelled nadir reference. A hardware design without a camera has no footprint; legacy remains28°. Two new target-render regressions cover radius and camera-FOV updates. These source fixes passed TypeScript; the domain agent owns the final full unit run.


## Candidate E closure and local standard measurement

The minimal bus-surface fix is in candidate E (`index-C6OHa66y.js`, shared `index-DEyCQVOp.js`, transfer `transfer-ui-Da1kv3FN.js`). The new hardware lid had overlapping white/dark surfaces at exactly y=0.800 m, and side foil hid the existing plaque and vents. Only the new hardware foil thickness changed from 0.035 to 0.028 m, and the dark top/bottom slab from 0.050 to 0.044 m. Centres, posts, white plate, outer bus bounds, physical descriptors and legacy factories remain unchanged. Two new raycast regressions failed on the old coincident geometry, then the complete hardware-render file passed **24/24** after the fix. No isolated next-art prototype was integrated.

Candidate E renderer browser checks passed **3/3 in 20.9 s**, Chrome 157.0.8103.52, 1280×720, with zero captured page/console errors. They cover actual radio placement/focus, bus undo/redo selection synchronization, actual Mars altitude/B-plane commit/Escape/pending behavior and grip/legend separation, and hardware Earth reference geometry. At 600 km, the actual wide-camera 12° half-FOV gives 127.8146975 km footprint radius and the narrow-camera 4° half-FOV gives 41.9660441 km; the hardware precision target is 10 km. Removing the hardware camera removes the footprint. These are explicitly nadir references, not actual slewing sensor projections or proof of mission success. The exact values are in [physical-earth-reference.json](../tests/browser/artifacts/hardware-interaction/physical-earth-reference.json).

The [candidate C before image](qa/hardware/closed-hatch-before-c.png), [its browser record](qa/hardware/closed-hatch-before-c.json), and [candidate E after image](../tests/browser/artifacts/hardware-interaction/closed-hatch-balanced-1280.png) were visually inspected. The lid is clean and the SURVEYOR plaque, vents and accent are visible. The [latest Mars image](../tests/browser/artifacts/hardware-interaction/mars-approach-handles-1280.png) shows both grips and their labels clear of the explanatory legend. Original candidate A interaction evidence is retained separately in [its artifact directory](../tests/browser/artifacts/hardware-interaction-candidate-a/); these are distinct snapshots, not a claim that all cases ran together on E.

The isolated **local diagnostic** standard run completed after functional browsers closed and all prototype compilation/simulation stopped. [Raw report](../tests/browser/artifacts/performance-standard/report.json), [final screenshot](../tests/browser/artifacts/performance-standard/planning-20parts-1920x1080-after120s.png).

| Condition or metric | Actual local result |
|---|---|
| Machine | Intel Core Ultra 5 226V; Intel Arc 130V 8 GB; Windows 10.0.26200; Chrome 157.0.8103.52 |
| Actual rendering | 1920×1080, native DPR1, medium, AA/ACES retained, 64×48 planet tessellation; 20 real hardware components |
| Fixture | All placements geometrically valid; 73.3545 kg, 884 C spacecraft cost; retains instrument/power/budget errors and is not launchable. The M03 stage is added separately in its displayed total |
| Duration/input | 10 s warmup, 120.013 s measured, 7,200 frame intervals; actual 12 right-button drags and 12 wheel events |
| FPS and frame times | Raw mean 60.000650007 FPS; p50 16.7 ms, p95 16.9 ms, p99 17.0 ms, maximum 17.3 ms |
| Stalls/errors | Zero intervals above 33.3 ms, zero long tasks, zero captured errors |
| Stable resources | All six snapshots: 125 geometries, 9 textures, 17 programs; 126 draws and 118,464 triangles. Inactive primary renderer retains 180 geometries and 14 textures |
| Actual paths | 100+360+100 spacecraft samples, two 300-point planet orbit curves, plus a separate 2-point dashed Mars-date guide. The initial raw `planetPoints` field contains `[300,300,2]`; the guide is not a third orbit. The next/deployed harness separates `guidePoints` explicitly |

All measured local timing thresholds passed. This is planning-view performance on one machine, with approximately 1,000 plotted path/orbit samples (1,160 plus the two-point guide), not a successful 20-part mission or a 1,000-point spacecraft-only path. The original requirement also asks for the deployed web URL: **that acceptance condition remains pending the coordinator's post-publication measurement**. No cold-network claim follows from this warm local run.

The harness now supports private deployed warm runs through `--private-site` with `{url,token}` supplied only on stdin. Exact-origin authorization uses non-following routed requests and preserves response status; tokens are not written to artifacts. Its report explicitly discloses this authentication transport and makes no network-throughput claim. Hosted results use a separate artifact directory so they do not overwrite this local baseline.
