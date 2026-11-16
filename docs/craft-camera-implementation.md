# M03 live craft camera — original isolated evidence and integration

Integration update: the original isolated report below is retained to distinguish its API-driven camera entry from later product controls. Local9A added the visible `Spacecraft` button, F/Escape routing, actual panel-aware viewport fitting and selected-part labels. The four actual KO/EN × normal/large1280×720 browser cases passed on9A. Its separate loaded-Mars recovery flow then exposed stale GPU registrations during a later path rebuild; that finding was not dismissed because the image initially looked normal. Local9B adds explicit pre-loss GPU-registration retirement. The strict9B causal flight passed three loaded4K restores, path rebuilds, actual command/science, save replay and app Exit with zero native ownership errors. Separate primary/room post-restoration rebuild coverage also passed. See [milestone5 local evidence](qa/milestone-5-local.md). These are local candidate results, not yet a new published version or commercial-quality verdict.

## Original isolated report

This workspace is separate from the published application. No main `GameScene`, UI, simulation, hardware model, texture, or dependency was changed. `public` and `node_modules` are borrowed junctions and were not written. The original 8C PMREM lifetime fix remains in the transfer renderer. The prototype server and all browser processes were closed at handoff.

## Files for review

- `src/render/craft-camera.ts` — camera/control snapshots, off-axis projection into a CSS-safe rectangle, reversible fitting, position following, planet-clearance limits and conservative component-envelope camera protection. Owns no mesh, texture, renderer, render target or physics state.
- `src/render/transfer-scene.ts` — same existing actual craft/material pool and current-epoch ICRF frame; API integration, read-only part picking, one owned outline, explicit scale label. Other renderers are unchanged.
- `tests/craft-camera.test.ts` — ten focused tests.
- `tools/camera-visual.mjs` — isolated actual-UI/worker/pointer evidence driver, not a product screen or performance benchmark.
- `docs/qa/craft-camera/` — exact actual screenshots, JSON runtime/checks, initial harness failure and complete later evidence.

## Stable renderer API

```ts
scene.setCraftInspection(enabled: boolean): boolean
scene.getCraftInspectionState()
scene.focusInspectionPart(partId: string | null): boolean
scene.setInspectionViewport({left, right, top, bottom})
```

The first method returns the resulting enabled state, **not a generic success flag**. Entry returns false without a solved state or while context is lost/calculation is pending. Exit is idempotent. Viewport values are nonnegative **CSS-pixel insets from the canvas edges**; minimum usable width/height is 32 px. The UI should supply actual occupied panel/header/timeline bounds after layout and after normal/large UI changes. It should not call camera fit continuously merely because telemetry text changed.

State includes `enabled`, `phase`, `view`, `epochSeconds`, `selectedPartId`, `focusedPartId`, read-only selected model/kind metadata, `attitudeIsActual`, `previewingPhase`, `displayScale`, `exaggeration`, conservative clearance, camera/control distances and viewport insets. `getInspectionPartScreen(id)` returns a genuinely ray-visible projected component point for QA; hidden parts return `visible:false`.

Optional constructor callback `inspectionPartSelected?(id|null)` only reports read-only selection. Single click highlights; double click focuses the clicked actual mesh. `focusInspectionPart(null)` returns to the full assembly. Right drag and wheel remain actual OrbitControls inputs. A root-owned visible inspection/overview control, F/Escape routing, selected-part text and language/large-UI integration remain to be added in the main app after review. **The screenshots use renderer API entry, so they do not prove that product UI integration is finished.**

`setView()` deliberately exits inspection before changing overview view. Thus the current root terminal-mission solar-view action also exits inspection; the root can retain that policy or make it explicit in its UI. While inspection is active, ordinary live epoch updates keep the mode through Earth→solar→Mars transitions, following real position and inertial attitude. A prior other-epoch phase preview is replaced by the actual current phase on entry; exit restores the prior view/camera/control settings.

## Scale and camera safety

Full geometry bounds are measured after real part transforms, in craft-local metres. The off-axis camera puts the actual selected/whole-craft target in the centre of the usable UI rectangle, rather than physically translating the spacecraft. Its bounding sphere fits the whole assembly at arbitrary attitude/orbit angles.

For local views the known periapsis altitude limits exaggerated craft scale and the entire orbit radius. Displayed solid-body radius is 3 plus a 0.005-unit numerical margin. The camera's allowed orbit uses less than 78% of the remaining surface clearance; full-craft display radius uses a much smaller fraction. Component bounds also prevent a small lens-focus camera from entering the bus. These protections change only camera/display quantities, not the physical trajectory, components, constraints, signal endpoints or simulation.

During solar-cruise inspection, Earth/Mars/Sun radii use the same physical distance scale as the path. The enlarged overview Earth sphere would otherwise engulf the spacecraft just outside its SOI. The real planets are therefore distant/small in cruise; no giant substitute planet or background photo is inserted. Exit restores overview sizes. The existing physically mounted meshes, original art atlas, actual attitude and original lighting remain unchanged.

All camera changes are immediate. There is no automatic rotation, flythrough or shake; the existing reduced-motion control preference remains in use. Camera movement never rotates the spacecraft.

## Completed evidence and limits

- Final TypeScript check passed.
- Focused CPU run: **24/24**, comprising **10 camera tests plus 14 existing command-signal/frame cases**. Tests cover low-Mars clearance over 300 orbit directions, six-wing geometry projected in normal/large 1280 UI rectangles across 20 attitudes, exact camera/control restoration, stable repeated updates, real-coordinate following and a small lens view kept outside the bus.
- Final isolated Chrome 157 actual-UI run passed. It used a hardware M03 mission with the existing Worker and advanced to actual Earth escape, solar cruise, Mars SOI and periapsis. Camera mode survived both real phase transitions. Right drag, wheel, actual ray-hit click and actual double click were exercised. Paused runtime deep equality was retained under all camera-only operations.
- Thirty inspection/overview switches held **69 geometries / 10 textures / 26 programs** in three sampled snapshots. These are counts, not a timing or all-scene memory claim.
- One actual context loss/restoration while inspecting Mars succeeded; subsequent exit/re-entry also succeeded, with paused-state equality, visible artwork, zero page/console errors and zero invalid-deletion warnings. This does not replace the earlier 8C nine-cycle regression.
- Eleven evidence records, including ten screenshots, are listed in `docs/qa/craft-camera/report.json`. Inspected actual Earth, Mars normal/large, array focus, user orbit, Mars SOI and post-restoration images. The large-UI legend initially overlapped the timeline; it now follows the supplied bottom inset and has a visible gap.
- `attempt-1/failure.json` preserves the first harness failure: it looked for nonexistent kind `solar` instead of the actual `solar-1` part ID. Product errors were zero. Later runs used the real model ID and required actual ray-visible points.
- Existing driver shader precision and PMREM sample-limit warnings remain recorded. They were not filtered. The camera does not claim to fix them.
- No quantified FPS/load measurement, production build/deployment, KO UI matrix, legacy-camera GPU run, new runtime-3 command lesson or root visible-button integration has been claimed. Main integration should run its own frozen-source UI and context regressions.

Best review images: `mars-current-normal.png`, `mars-current-large.png`, `solar-array-focus.png`, `mars-user-orbit.png`, `mars-exit-reenter-after-restoration.png`.
