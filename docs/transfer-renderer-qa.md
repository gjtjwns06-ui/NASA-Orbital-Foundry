# M03 renderer implementation and checks

`src/render/transfer-scene.ts` owns a separate WebGL renderer and canvas for the Earth–Mars experience. It has no dependency on the mission-control model and no external API or asset service calls. It uses the existing credited local NASA Earth, cloud and Mars textures, existing original modular spacecraft geometry, and bundled JPL ephemeris data supplied by the transfer domain module.

## Coordinate and interaction contract

- Heliocentric positions and paths are derived from `transferPlanetState`, `transferStateAt` and `transferTrajectory`. The single ICRF-to-Three mapping is `[x,z,-y]`. Solar distance scale is 10 scene units per AU.
- Solar planet and spacecraft radii are enlarged for legibility; the explicit legend says so. Earth/Mars local views use a physical planet-to-path scale with a 3-unit planet radius, and state the spacecraft enlargement factor. The spacecraft is assembled with the actual saved `partTransform` positions and rotations.
- `setAttitude(quaternion)` applies the runtime body-to-ICRF quaternion and the same frame conversion. Without a runtime pose, the view says the velocity-oriented craft pose is illustrative.
- If the requested Earth or Mars detail is outside the active phase, the scene shows a labelled phase preview at Earth departure or Mars periapsis. Requested-phase trajectory samples retain their requested body-relative frame, including boundary points. The renderer does not substitute a heliocentric boundary point into a local path.
- Departure/arrival handles have a 34-pixel pointer target, projected-date nearest-point search over ±45 days, a separate ghost, a live date preview, pointer capture, and a commit callback only on release. The search uses 361 ephemeris samples. It sends absolute TDB Julian dates; the UI owns day rounding, validation and solving.
- Right-drag orbits the camera, middle-drag pans, and the wheel zooms. Local default framing shows the spacecraft on the visible side of the planet. Date editing can be disabled during runtime with `setDateEditing(false)`.
- The optional `contextLost` callback lets the UI pause mission execution. The renderer stops drawing while the context is lost and can draw again after restoration. `dispose()` removes event listeners, observer, canvas, overlays, materials/textures/geometries and its owned WebGL context.

Surface rotation is a visual convention, not an IAU body-fixed map or a surface-targeting calculation. Stars, atmosphere glow, sunlight appearance, and decorative solar halo are presentation. They do not alter trajectory or resource calculations. The solar Mars ephemeris arc is limited by the bundled dataset; it is deliberately not closed into an invented full orbit.

## Browser evidence

Chrome 157, Windows, local development renderer harness:

- Real pointer drags on both date handles committed exactly +18 TDB days in the smoke case. Both handles were visible. No page or console errors. `docs/qa/transfer-scene-smoke.json` records the initial interaction run.
- Repeated 12 spacecraft rebuilds, trajectory rebuilds and alternating solar/Mars views retained **9 GPU textures** throughout. Geometry counts alternated between **115 in local view and 120 in solar view**, consistent with view contents. `docs/qa/transfer-scene-resilience.json` records the final check.
- The first resource audit exposed a +1 texture per spacecraft replacement. The missing foil `bumpMap` ownership/disposal was fixed; the stable rerun above is the acceptance evidence.
- Injected WebGL context loss fired the callback once; restoring the same extension resumed rendering without errors. A visual check found that PMREM render-target pixels also needed regeneration. After that fix, the static Mars image before and after restoration was **pixel-identical** (all RGB mean and maximum differences zero). This harness verifies the renderer callback/recovery, not the UI worker pause implementation.
- Disabling date editing made handle projection unavailable. Disposing the renderer left zero canvases in the harness.
- `clearSolution()` removes the old path and orbit buffers and hides the craft, planet positions and editing handles after an infeasible plan. A separate check verified zero remaining path/orbit children, no accessible handle, and correct restoration after a valid `setSolution()`; see `docs/qa/transfer-clear-solution.json`.
- Final renderer images: `docs/qa/transfer-solar-final.png`, `transfer-mars-final.png`.

The integrated production UI was separately inspected on frozen `index-b9Cs6prz.js` at 1440×900 and 1280×720. Both date handles resolved through `document.elementFromPoint` to `transfer-universe`, and no page or console errors occurred. Evidence: `docs/qa/transfer-ui-smoke.json`, `transfer-ui-solar-1280.png`, `transfer-ui-mars-1440.png`. That build's bottom legend was covered by the timeline and its upper Mars label overlapped the hint.

The next frozen build, `index-as3YeZTu.js`, was checked at 1280×720 through the actual three-card mission picker and M03 assembly flow. Both handles remained directly accessible, the legend ended at y=566 above the timeline's y=581 start, and the local craft was visible near (737,409); zero browser errors. Evidence: `docs/qa/iteration-5/visual-review.json` and its solar/Mars screenshots. A remaining 10px solar Mars-label/hint overlap and a redundant hidden local planet label were corrected in source (hint moved, local label hidden); final rebuilt confirmation of those narrow changes is pending.

The UI worker's full-mission correctness and save/replay checks are separate from these rendering checks. This document makes no cross-device frame-rate claim, no mobile/Safari claim, and no assertion that an isolated smoke check replaces the production end-to-end suite.
