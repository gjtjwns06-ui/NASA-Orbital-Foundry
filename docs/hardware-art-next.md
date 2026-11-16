# Hardware art pass — iteration 7 candidate

Originally prepared on 2026-11-15 from the [candidate A production model sheet](qa/hardware/models-v2-production.png) and [mesh metadata](qa/hardware/models-v2-production.json) while the v3 release was frozen. After v3 publication, the surface, optical and focus work below was implemented in an isolated prototype and then merged into local iteration **7A, `index-pj8dkhVB.js`**. The published private game remains version 3 until the new candidate's verification and publication finish.

## Current evidence

- [New production models](qa/hardware-art/models-v3-production.png), [model metadata](qa/hardware-art/models-v3-production.json), and [transparent library thumbnail provenance](qa/hardware-art/thumbnail-provenance.json). The 16-model 1024×1024 WebP is 77,488 bytes. It uses actual original game meshes, with separate model-to-tile metadata; no paid image service or vendor artwork is involved.
- Local merged source passes TypeScript, production build and **35 focused tests** across hardware geometry, original atlas/optical contracts and inspection. The five real-browser hardware interaction cases pass on 7A, including all sixteen pointer drags and actual optical footprint/encounter handles. This is not a new full 236-test execution.
- The new hardware-only initial camera `(5.9, 3.9, −4.6)` shows the mounted camera and solar cells together. [Normal](qa/hardware-art/closed-bus-final-default.png) and [large UI](qa/hardware-art/closed-bus-final-large.png) captures and [profile-transition proof](qa/hardware-art/angle-proof.json) establish the chosen framing. Legacy framing is retained; a bus change does not reset the player's orbit.
- [Ownership regression](qa/hardware-art/ownership-report.json): three actual hardware assembly↔transfer cycles and a separate legacy control, 29 checks, zero browser errors. All original assembly resources receive zero disposal events; transfer-owned clones are released exactly once. Actual transfer WebGL loss/restoration regenerates its environment, and [returned circuit-board art](qa/hardware-art/ownership-radio-after.png) remains visible. The transfer renderer already cloned shared materials and maps, so no disposal code change was needed.
- Four Korean/English × normal/large assembly layouts pass on 7A. A transient toast overlap found in visual review was fixed in **7B `index-BHzw1aRT.js`**; all four cases pass again with the real visible initial toast separated from its guide by 19–21 px. The single actual Edge hardware context-loss/restoration case also passes on 7B. [Scoped browser reports](../tests/browser/artifacts/candidate-7b-benchmark/batch-summary.json).
- Local 7B standard 20-part performance passes: 1920×1080, medium, native DPR1, 10 s warmup and 120.0073 s of recorded input, 7,199 intervals, mean 60.00091680800768 FPS, p99 17 ms, zero errors/long tasks, stable 125 geometries/10 textures/18 programs. The fixture retains its non-launchable budget/power/instrument warnings. [Raw report](../tests/browser/artifacts/candidate-7b-benchmark/performance-standard/report.json). This is a local warm-render measurement; the prior private v3 HTTPS measurements are not relabelled as measurements of this art pass.

The following design notes retain the constraints and rationale that governed this implementation; deferred features remain deferred.

## Visual objective

The current original models have distinct physical sizes, readable silhouettes and useful close-focus interaction. At close range, their broad flat surfaces still resemble simplified blocks. Improve the visible construction of those surfaces before adding more objects or effects. Keep the ivory aluminium, navy hardware, teal electronics and restrained amber insulation palette. Detail should reward orbiting and focusing a real part, while the normal assembly view remains legible.

The reference is a bright, clear space-program presentation. Do not copy another game's models, textures, interface artwork or compositions. These remain simplified educational models, not manufacturer CAD or electrically meaningful schematics.

## Proposed work, in order

| Priority | Change | Method and boundary | Observable improvement |
|---|---|---|---|
| 1 | PCB copper paths, solder pads, silkscreen and connector markings | Draw one deterministic original atlas with separate AX, Iris, ADCS and recorder regions. Include neutral labels such as PWR, DATA and RF; use invented routing, not a traced vendor circuit. Remap the existing board geometry UVs, reserving a plain atlas region for side faces. Reuse the current board material draw rather than adding floating decal meshes. | In the actual F/double-click close view, the board has readable construction and the two radios look different beyond their stack count. Markings do not flicker or become noisy at normal assembly distance. |
| 2 | Optical depth and retaining hardware | Recess the visible glass within its existing barrel, add a thin retaining ring and modest inner baffles, and add a neutral identification plaque or etched ring. Keep the published/authored entrance aperture at its existing plane and diameter. Use an opaque clearcoat material with controlled roughness; no transmission render pass. | Camera and spectrometer openings look like lenses in housings. The deeper narrow camera remains identifiable at an oblique angle. Glass does not read as a flat blue button or obstruct the functional clear aperture. |
| 3 | Insulation seams, panel joints and fasteners | Author a quieter foil pattern with folded seams and sparse tape edges. Add a few inset fastener heads or joint cuts using existing silver/dark material batches. Keep bump amplitude proportional to thin foil and avoid broad random scratches. | The bus reads as an assembled spacecraft rather than a solid gold box. Surface reflections remain stable while the camera orbits. |
| 4 | Close-focus light and contact shadow tuning | Test a smaller shadow frustum centred on the spacecraft during new-hardware close focus, using the existing light/map. Current build shadow width is 18 m at 2048 pixels, about 8.8 mm per texel; its 25 mm normal bias is large compared with a 100 mm board. Test a roughly 6 m framing and millimetre-scale bias, then choose from actual screenshots. Restore the previous bounds on leaving focus. Avoid extra shadow lights or another post-processing pass. | Small modules appear attached to their carrier or bay floor. Standoffs and stacked boards have separable depth. The fix must not introduce acne, detached shadows, sudden lighting jumps or clipped shadows on large arrays. |

The exact new shadow settings are experiments, not approved constants. A tighter map improves spatial resolution but can omit neighbouring geometry; acceptance requires the whole assembled craft and normal camera transitions to remain convincing.

## Physical and compatibility constraints

- Preserve both bus envelopes at 1.30 × 1.60 × 1.30 m. Their usable bay boundaries and mounting rails still come from the shared bus definitions.
- Every added vertex must remain within the same model's shared deployed boxes. Insets and visual surface relief must not widen a part, alter its mounting transform, change aperture size, or create an invisible collision extension.
- Retain the actual three/eighteen solar patches, their normals and weights. No decorative panel may masquerade as an additional power-generating surface.
- Keep model identity and the `partModel`, `bayCover` and relevant selection metadata through batching. Original materials and transforms must work in the palette ghost, placed object, moving object, duplicate, close focus, stow inspection and transfer renderer.
- Stow remains the existing envelope preview. This art pass must not imply that a folding mechanism, swept deployment collision check or deployment animation has been implemented.
- Keep legacy factory bodies and shared legacy material constants unchanged. Use new-hardware-only material variants and foil generation where needed. A global edit to `lens`, `silver` or `foil()` could change legacy ships despite preserving their geometry.
- Hardware close-focus lighting must restore the previous camera/light state on craft focus, axis view, mode change and design/profile replacement. It must not affect campus or legacy scenes unintentionally.
- Do not change mass, cost, power, link budgets, optical FOV, geometry descriptors or scientific success thresholds to accommodate decoration.

## Resource budget and ownership

Proposed limits are deliberately small. They are targets for the implementation review, not measurements of finished work.

| Resource | Proposed limit |
|---|---|
| Procedural atlases | At most two shared textures: up to 1024² colour and 512² scalar surface detail; approximately 6.7 MiB with complete RGBA8 mip chains before driver overhead |
| Small-module geometry | At most 300 added triangles per model; board routing and lettering primarily use texture UVs |
| Draw calls | Preserve the current material-batched draw count per model wherever possible; any exception must have a visible benefit and be reported explicitly |
| Shader/effect complexity | No transmissive glass, additional dynamic lights, added post-processing pass, or per-frame texture painting |
| Loading | Generate/cache atlases once and reuse them. Keep legacy startup from generating unused hardware details. Measure generation cost and any first-focus shader hitch |

Introduce an explicit shared hardware-texture ownership registry if the atlas is shared. The current solar-only protection is insufficient for new atlas maps: removing a part or disposing a ghost must not dispose a texture still used by another part, renderer or context. Conversely, per-instance label resources must still be released. Context recovery must regenerate render-target environments while retaining or correctly reuploading CPU-backed atlas images.

Do not estimate final speed from triangle count alone. Close-focus shadows, material variants, UI redraws and worker activity also affect the actual frame times.

## Verification checklist

1. **Physical regression:** rerun all-model rendered-vertex bounds, bus bay/envelope, aperture, patch-count, weighted power, optical and legacy dispatch tests. Add focused tests for new descriptor-sensitive geometry, rather than snapshotting every decorative vertex.
2. **Legacy preservation:** compare legacy factory output and stable before/after views. Confirm unchanged material constants and no atlas allocation in a legacy-only session.
3. **Actual visual inspection:** refresh the 18-model production sheet and actual 1280 × 720 normal/large UI screens. Inspect board focus, oblique camera lenses, bus exterior and interior, shadow contact, full six-wing assembly and Mars flight. Thumbnail cameras must use model-appropriate near/far planes to avoid audit-induced depth aliasing.
4. **Pointer interaction:** perform real catalogue drag, move, rotate, duplicate, undo/redo and double-click/F focus. Confirm the ghost matches the placed geometry and small details do not steal intended raycasts.
5. **Ownership and recovery:** repeatedly add/delete models, swap model ID on an existing instance, switch buses and enter/exit transfer view. Renderer texture/geometry/program counts must settle rather than grow. Exercise actual WebGL loss/restoration and shared-map survival.
6. **Performance:** repeat the isolated 20-real-part 1920 × 1080 medium planning measurement with 10 s warmup and 120 s deterministic orbit/wheel input. Keep its non-launchable budget/power/instrument warnings and exact trajectory-sample count visible in the report. Compare frame percentiles, average FPS, long tasks, draw calls and GPU resource counts against the pre-art baseline. Do not change the fixture or lower quality to obtain a pass.
7. **Provenance:** record that the atlas, labels, routes and details are original procedural artwork. Retain numerical hardware sources separately. Do not use vendor logos, certification marks, unlicensed CAD, copied circuit layouts or generated assets that incur API costs.

## Explicitly deferred

Articulated panel deployment, animated reaction wheels, physical cable routing, connector-level electrical simulation, wear/damage systems and a complete visual redesign are outside this pass. They may deserve later gameplay work, but should not delay a focused improvement that is visible when a player handles and inspects a part.
