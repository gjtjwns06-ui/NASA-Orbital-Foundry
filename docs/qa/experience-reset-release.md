# Experience reset — release evidence

2026-11-15. This is a response to the user's negative playtest, not a declaration that the project has reached commercial-game quality. The new direction supersedes the old mission-menu-first entry; see [acceptance criteria](../experience-reset-plan.md) and [official control research](../../research/experience-reset-control-benchmarks.md).

## What changed

- A short fictional observation incident leads to a persistent exploration programme. A 3D map contains all eight planets and an authored asteroid. Earth is the origin; seven other planets plus ASTER-7 are exploration targets.
- A destination, departure handle and future meeting handle replace the first-use date form. Pointer movement changes the actual Lambert/Kepler path, dates and computed propellant before release. Unsolved or over-budget routes remain visible and editable. A bounded departure search provides an alternative without a repeating identical retry.
- The existing spacecraft models and surface assembly remain. Palette selection now follows the selected component instead of permanently highlighting the recommended camera. Inspection actions are contextual; precision views, settings and legacy laboratories are collapsed.
- Payload mass, cost, operating power, sensor type, battery/storage reserves and sensor/antenna visibility constrain readiness. Different destinations ask for camera or spectrometer observations and have distinct sampling labels, results and next questions. Returned records store a picture of the rendered encounter and survive reload.
- The legacy M03 80-day-date trap now offers an explicit supported-calendar repair and prior-plan restoration. Invalid focused inputs clear stale results and disable launch immediately; unsupported saves are preserved rather than silently rewritten.

## Verified locally

Production build: `npm.cmd run build` passed. [Build output](experience-reset-build.txt). Vite retains its existing large-chunk warning; no new load-time or sustained-FPS claim is inferred from a successful build.

CPU checks: 6 files / 43 tests passed in one run. Files: `solar-model`, `solar-campaign`, `solar-exploration-reachability`, `transfer-date-window`, `transfer-planning`, `transfer-plan-comparison`. They cover all eight destination solutions, energy/angular-momentum conservation, bounded dates, resource reachability with the unchanged carrier, sensor/occlusion consequences, saved discovery validation and legacy date/plan recovery. The UI's bounded search found a launchable plan for every target with the appropriate sensor; this is not global optimisation.

Native Edge 157.0.4341.46 on the production preview at `http://127.0.0.1:5188`: the integrated 6-case suite passed on 2026-11-15 around 21:06–21:08 KST. The suite consists of `solar-expedition.spec.ts` (2), `experience-reset-assembly.spec.ts` (1), and `transfer-date-recovery.spec.ts` (3).

- A fresh ordinary `/` entry completed story → pre-release route drag → undo → keyboard edit → same-craft workshop → flight → three real pointer observations → transmission → received discovery → Saturn selection → reload with the journal preserved. No campaign state was injected to skip the journey. [Journey result](../../tests/browser/artifacts/solar-expedition/journey-result.json).
- At 1280×720, all non-Earth planets were selectable and the route controls/launch action remained in the viewport. Screenshots were visually inspected; the first smaller-viewport build-button overlap was corrected before this pass.
- The assembly case used real shelf dragging and keyboard placement to select a camera, inspect it, then install an engine. The camera ceased to be selected; the engine was the sole selected shelf item. This case uses read-only QA projection to locate the 3D mount, so it is not evidence of unaided novice discovery.
- M03 Korean and English real-input recovery and unsupported-save recovery passed again in the integrated production build. The actual fuel restriction on the short repaired route remained enforced. [Date recovery detail](date-recovery/README.md).

Screenshots and per-case results: [Solar expedition](../../tests/browser/artifacts/solar-expedition/), [assembly](../../tests/browser/artifacts/experience-reset-assembly/), [M03 recovery](../../tests/browser/artifacts/transfer-date-recovery/). Local preview tests do not establish private hosted-browser behaviour.

### Final integrated closure

After the additional pointer-Escape repair, the unchanged production build passed **8/8 native Edge cases in one run**, 116.808 seconds, no skips, unexpected failures or flaky retries. [Original JSON report](experience-reset-final-browser.json). The 6 cases above were rerun together with `solar-controls.spec.ts` and `solar-second-destination.spec.ts`. The frozen [runtime manifest](experience-reset-runtime-manifest.json) contains 231 source/input files and 83 built files.

The English control case starts with a keyboard edit before any mouse edit, verifies Undo, then drags with `BODY` focus, cancels with Escape while holding the mouse, drags again and undoes again. Its initial real failure and first corrected pass remain in [R1](experience-reset-controls-run-r1.json) and [R2](experience-reset-controls-run-r2.json); final evidence is under `solar-controls/final`.

The separate fresh Venus journey verifies that a missing spectrometer blocks launch, installs a seventh component on the free -X face through the ordinary keyboard placement UI, returns to the map, launches, performs three real pointer observations, transmits, and reads the saved Venus discovery/image and actual installed component. [Venus result](../../tests/browser/artifacts/solar-second-destination/venus-journey-result.json). This is a second destination completed in a separate fresh campaign, not a claim that a consecutive two-record campaign or every destination was played end to end.

[Independent advisory review](experience-reset-independent-final.md) inspected screenshots, source, model reachability and the additional failure/closure evidence. It did not assign a numerical fun score or certify commercial parity.

## Iteration failures and corrections

- The initial campaign start could lose a click when asynchronous boot/save rendering replaced the home controls. Entry is now disabled until assets and save metadata are ready; the final reload/resume journey passed.
- One route test dragged right while the default arrival was already at its maximum supported duration. The tested gesture now moves inward, and the handle's arrow indicates the permitted direction at a bound. Bounds were not loosened to make the test pass.
- A moving close-encounter camera shifted the observation target during the third drag. Encounter entry now establishes a stable camera immediately. The final three pointer observations passed without a focus/forced-click workaround.
- The initial encounter craft was clipped by its screen size. Its close-up scale is now proportional to the target body; the final screenshot shows the complete craft.
- A development-server run was interrupted during concurrent HMR edits. It is not acceptance evidence. Final acceptance used the built preview without changing production source during the suite.
- An additional English pointer test found that Escape was lost when focus was on `BODY` instead of a HUD control. Keyboard handling now belongs to the active campaign lifetime, and cancellation releases pointer capture and restores the pre-drag route. The original failed run is preserved in [controls R1](experience-reset-controls-run-r1.json); its closure is recorded separately below.
- The M03 focused-input defect and earlier changing-source/import failure are retained separately in the date-recovery evidence. They are not relabelled as passes.

## Model and product limits

The new map uses JPL's 1800–2050 approximate planetary elements (Earth–Moon barycentre), Sun-only Lambert transfer and Kepler coast. It does not use the old bundled Earth/Mars Horizons ephemerides for its new planets. It does not inherit past GMAT validation. Planet sizes and distances are compressed for display; route coordinates and resource calculations are separate.

Each campaign expedition launches independently from Earth. Multi-leg planetary tours, a connected swingby planner, moons, landing/capture and other star systems are not included in this change. The older local Mars swingby laboratory remains available separately. The authored carrier is dry mass 400 kg, propellant 6,500 kg, Isp 450 s and continuous 300 W bus power. These are game assumptions, not a NASA vehicle specification.

Close-up samples, scientific descriptions and reception animation are authored game procedures. They are not measured terrain spectra or a full changing-attitude, eclipse, thermal and RF-link simulation. One-way light time is computed; its animation is time compressed. Carrier power makes outer-system missions possible without claiming the selected solar panels produce their 1 AU output at Neptune. Visibility checks are conservative straight-ray checks, not manufacturer CAD certification.

The opening currently uses three short exchanges and 3D camera staging. Observation interactions are still a compact repeated sampling structure. The story and destination consequences are a first playable replacement, not a completed narrative adventure.

No available MCP evaluation server can certify fun. The evaluation skill fallback and independent review are advisory. Automated checks establish mechanics and regression only; an unaided first-time human session is still needed to assess motivation, clarity and enjoyment. No synthetic rating, human-study result, commercial parity, global performance claim or completed autonomous Ralph daemon is asserted.

## Publication

Native owner-private **version 12** publication succeeded at 2026-11-15T12:19:31.130098Z from source `30e8407c603d6ae815288b97d2b7bd1dbd7e7efa`. All 83 archived dist files matched the reviewed local output; the helper's additional `dist/.openai/hosting.json` matches the selected project and static root. Archive size 25,688,874 bytes, SHA-256 `26ff36e9a1a94663ab2db60ea62a4f2549d431b4e841cdd1180989c75f5010c3`. Initial archive inspection expected root-level hosting metadata; inspection of the supported helper confirmed its documented `dist/.openai` layout, and the corrected comparison passed without changing the archive.

Post-publication access read confirmed version 12 and the same single-owner allowlist, no groups or external visitors. [Exact publication and access receipt](experience-reset-deployment.json). [Private play URL](https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site). This confirms native publication, not an additional hosted browser/performance run. These receipt notes were recorded after the source commit; runtime files remain the tested archive.
