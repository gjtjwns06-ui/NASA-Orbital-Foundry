# Browser interaction QA

Test implementation: `tests/browser/mission-flow.spec.ts`. Run date: 2026-11-15.

Tests use the installed system Chrome in headless mode through Playwright. The base viewport is 1440 × 900; the small-desktop case uses 1280 × 720. Production preview is used for final passes so Vite hot reload cannot replace a page midway through interaction. The URL environment override is `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173`.

## What is exercised

| Case | Actual interaction and assertion |
|---|---|
| First-time assembly | Open mission picker, choose Earth, drag a catalogue camera onto the 3D bus, drag the installed camera to a different position, rotate with R, undo with Ctrl+Z, select and delete, undo deletion, reject a drop outside a mounting surface. |
| Earth trajectory | Drag the visible 3D prograde handle with the mouse; require changed Δv, updated revision and a matching completed preview. Verify the handle is on the canvas rather than behind a UI panel. |
| Operations timeline | Drag an observation block, drag its resize edge, drag a new charge operation onto the track, remove it with the context gesture. Assert the corresponding schedule changes and latest preview. |
| Persistence and import rejection | Save through the UI, reload the browser, use Continue, compare the restored design; upload malformed JSON and an unsupported-version JSON file and require rejection without design replacement. |
| Earth full mission | UI launch, observe actual live time advancement, pause, ensure time remains frozen, select 600× and resume, then use the QA accelerator to finish the remaining simulated time. Require successful result, science return, retry and saved retry restoration. |
| Mars full mission | Same live UI sequence and result/persistence assertions for the Mars mission. |
| 1280 × 720 | Drag the Mars approach handle and require changed encounter geometry; check no page overflow, a usable launch button and a result modal entirely within the viewport. |
| Rotation-ring guard | Drag a real 3D rotation ring on a camera near a mount edge; require the same attachment-boundary enforcement as keyboard rotation. |
| Interim-result retry | End a run through the intermediate-results UI, retry and save it, reload, and require a working Continue action. |
| Retained-ID model replacement | Switch the production preset from ordinary to extended solar array, retaining the part ID; inspect actual plane dimensions and object identity to ensure the larger model is instantiated. |
| Failed-preview launch gate | Let a real initial preview complete, inject one calculation-error response at the Worker boundary after a real navigation drag, and ensure both the launch button and production launch action reject the stale accepted result. |

Mouse actions use actual screen-space pointer input. The `?qa` API supplies read-only world-to-screen coordinates and state assertions. Balanced designs can be selected through the QA setup helper to isolate trajectory and mission tests. `finishFast()` is used only after actual live simulation and pause/resume have been exercised; the tests do not pretend to have waited for three or five real hours.

Every case collects uncaught page exceptions, console errors and application HTTP errors. A failure screenshot and JSON error attachment are written into the Playwright results directory. Subsequent runs also save per-case JSON evidence under `tests/browser/artifacts/`, including browser version, viewport, page URL and errors. The initial known favicon error was excluded explicitly; application-resource failures are not excluded.

## Evidence and defect history

The initial clean production run passed the first seven cases in 23.9 seconds with no browser exceptions, WebGL console errors or failed application resources. A previous development-server run was invalidated by hot reload and is not counted as product evidence.

Two targeted follow-up cases then exposed reproducible product defects:

1. **Rotation-ring validation:** a camera placed near the front mount's right edge could be rotated to 45° with the ring, leaving an invalid attachment; keyboard rotation already rejected the same condition. Reported to the main implementation owner with a pointer reproduction.
2. **Interim-result persistence:** intermediate result → retry → save → reload removed Continue because the saved partial `previousResult` was compared to a full-duration mission during validation. Reported to the simulation owner for time-specific result reproduction.

Both implementation defects were fixed and their real browser regression cases passed on the subsequent production run. Ring rotation now retains the last valid placement; previous results record and reproduce their exact evaluation time. A passing base suite did not erase the additional findings.

## Screenshot review

Actual browser screenshots live in `tests/browser/artifacts/`:

- `assembly-pointer-edit.png`
- `assembly-1280x720.png`
- `earth-trajectory-edited.png`
- `earth-live-telemetry.png`, `mars-live-telemetry.png`
- `earth-complete-result.png`, `mars-complete-result.png`
- `mars-planning-1280x720.png`, `mars-result-1280x720.png`

Inspected assembly, Earth planning/live, Mars planning and result screens. The inspected build had coherent 3D geometry, visible planet textures, readable primary actions and no page or modal overflow. Reported polish items were stale context toasts obscuring other modes, the Earth limb/handle sitting close to the timeline at 1440 × 900, and the inspector requiring internal scrolling at 1280 × 720. The screenshot helper waits for transient toasts to disappear; this improves evidence capture and does not excuse actual layout defects.

## Limits

This evidence covers system Chrome on the current Windows machine and the stated desktop sizes. It is not evidence of Edge, mobile, Safari, all GPU drivers, long-duration memory stability or commercial-game equivalence. Unit tests, GMAT comparisons, asset checks and broader release criteria have separate records. No test result is a guarantee that all possible defects are absent.

## Earlier production rerun

Production snapshot `dist/assets/index-CyIgLhYB.js` (746,143 bytes), built 2026-11-15 at 01:27:39 KST, served at `http://127.0.0.1:4173/`:

- **9 / 9 passed in 44.5 seconds**, including both originally failing regression cases.
- **3 / 3 targeted checks passed in 9.5 seconds**: strengthened rotation-ring assertions, retained-ID geometry replacement, and stale-preview failure gating. These comprise **11 unique passing cases** across the two runs, with the ring case repeated.
- Chrome **157.0.8103.52**, executable `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- No captured page exceptions, console errors, or failed application resources in these clean passes. The worker-failure case deliberately supplies a handled calculation-error message; it is not an uncaught browser error.
- The refreshed 1280 × 720 result screenshot was visually inspected after the pass: all result actions and four returned-data cards fit in the modal without clipping. Assembly screenshot has visible 3D hardware and a usable main planning action; side contents may scroll.

These results apply to that built snapshot. Source or data changes made afterwards require a fresh production build and relevant rerun; they are not silently covered by the recorded result.

## Expanded frozen-build review: index-Di_VSFLN.js

On 2026-11-15, the expanded production snapshot passed the **11 existing Chrome cases in 57.9 seconds**. This includes the corrected screen-distance selection of overlapping orbital handles. Two additional real-pointer cases passed: adding a second maneuver by clicking the visible orbit, editing only its normal component, selecting and deleting it; and dragging the workshop Sun handle to change calculated generation without altering the saved design, then inspecting the actual camera visibility overlay.

The English journey at 1280 × 720 passed assembly-name preservation, English catalogue accessibility labels, mission launch, live telemetry, successful result, save, and layout checks before exposing a genuine boot accessibility defect: English persisted after reload, but the document retained `lang="ko"`. The owner fixed boot language metadata in source; a new production rerun is required. The language case also now asserts English inspection explanations. `english-untranslated-current.json` records the original snapshot's remaining untranslated inspection/hazard strings; these have been added to `src/i18n.ts` but are not retroactively counted as passing in this snapshot.

A separate repeated-label check exposed a GPU resource leak: 12 real language-button clicks rebuilt the same Earth orbital labels but grew texture count from **26 to 86**, while geometry count stayed **192**. The source owner has added disposal of the label materials' owned canvas textures. The failing regression remains strict and must pass on the rebuilt product. The labels are textured plane meshes; they are not sprites. Evidence: `trajectory-resource-regression.json` and the longer exploratory `trajectory-resource-rebuild.json`.

Additional passing resilience checks:

- **Blocked IndexedDB, Chrome:** deliberately deny storage, observe the UI error, export a JSON backup through Settings, and compare its entire design to the in-memory design. Download completed successfully.
- **Edge 157.0.4341.46:** a loaded Mars mission continued to advance offline, saved locally offline, paused on injected WebGL context loss, resumed rendering and simulation after restoration, and reloaded its exact saved elapsed state. No captured application, WebGL, or resource errors. This does not claim an offline cold start or an installed PWA.

At this checkpoint there are **15 distinct passing scenarios and 2 discovered regression failures awaiting a rebuilt product**. The scenario count is not a full passing run of the newest source. Files: `tests/browser/mission-flow.spec.ts` and `tests/browser/edge-resilience.spec.ts`. The latter launches installed Microsoft Edge explicitly; the remaining cases use Chrome.

## Cold load and 120-second flight measurement

`node tests/browser/performance.mjs` captured `tests/browser/artifacts/performance.json` against `index-Di_VSFLN.js`, with Chrome 157.0.8103.52, high graphics, DPR 1, 1280 × 720, Intel Core Ultra 5 226V, 15.54 GiB RAM, and ANGLE Direct3D11 on the **Intel Arc 130V** GPU. Chrome cache was disabled and CDP imposed 10 Mbps download, 5 Mbps upload, and 40 ms latency for the initial load.

- Cold navigation to loaded 3D assets: **9.35 seconds**.
- After removing network throttling and warming up, a running Mars mission was sampled for **120 seconds**.
- Last 7,200 frame intervals: **median 16.7 ms, p95 17.9 ms, p99 18.6 ms; none above 33.34 ms**.
- Textures remained **21**, shader programs **35**, and geometries **177–178** across the interval. The one geometry change corresponded to mission rendering state, not monotonically growing allocation. JavaScript heap fluctuated around 22–28 MB.
- Recorded frame draw calls were **99–101**, with **22,338–40,450** reported triangles as the mission view changed. No captured runtime errors.

This is a local headless hardware-rendered measurement, not a benchmark across devices. An Edge resilience browser ran concurrently during the beginning of the first 20-second interval; later intervals had no QA browser alongside the measurement. Continuous-flight stability did **not** reveal the separate trajectory-edit texture leak above. The texture upgrade and subsequent source changes require new measurements if their performance is claimed. The cold test does not model every mobile network, GPU, or browser cache policy; Resource Timing entries are retained as raw evidence rather than treated as a network packet trace.

New screenshots include `earth-multiple-maneuvers.png`, `assembly-power-inspection.png`, `assembly-visibility-inspection.png`, `english-assembly-1280x720.png`, `english-mars-plan-1280x720.png`, `english-live-1280x720.png`, `english-result-1280x720.png`, `edge-context-restored.png`, and `performance-mars-120s.png`. Assembly, English planning, English result, and power inspection were visually reviewed. Primary controls and result actions fit at 1280 × 720; side panels intentionally scroll. The inspection-close icon's missing accessible name was separately reported to the owner.

## Integrated production rerun: index-DfsyK2So.js

The next frozen production build passed **19 / 19 browser scenarios in 1.8 minutes**, including the Edge case. No captured browser, resource, or WebGL errors occurred. The earlier boot-language metadata and texture-leak regressions now pass: 12 label rebuilds retain **26 textures and 207 geometries** throughout, and English document language survives reload.

Two additional acceptance scenarios now pass using real pointer input:

- The first-design guide rotates the camera toward the requested −Z mounting face; a catalogue camera attaches there. Opening the internal bay hides its cover panels, a battery dragged through the top view attaches internally, and entering the flight plan closes the cover geometry.
- Clicking Earth's surface selects precision or survey targets, changes the required dataset count to 1 or 4, and preserves geographic coordinates. Dragging the resource graph changes the preview-time cursor without changing the design. Clearing the target returns to the baseline mission.

Latest screenshots `earth-target-and-resources.png`, `assembly-internal-bay.png`, `earth-trajectory-edited.png`, and `english-result-1280x720.png` were visually inspected. The upgraded Earth map, geographic region overlay, resource graph, and hollow service bay render coherently. **A new presentation limitation was reported:** the added results requirements table pushes Improve design / Other missions below the initial modal fold at 1280 × 720. Modal scrolling works, and the automated interaction reaches the buttons, but that does not establish that the next action is visible immediately. This supersedes the earlier snapshot's note that all result actions fit initially.

The live English text audit (`english-audit-latest.json`) found no untranslated visible text in home, assembly, all three inspections, hazard controls, or the resource graph. It found two remaining omissions: the canvas accessibility label stayed Korean after toggling English, and a briefing footer remained Korean. Their source fixes were requested/applied after this frozen build. The English regression has now been strengthened to cover both and therefore requires a new built-product run. This 19-case pass does not claim those later assertions have passed yet.

## Launch and continuous-motion rerun: index-BJKhhqBm.js

This frozen build passed **21 / 21 scenarios in 1.9 minutes**, with no captured errors. The English journey now verifies the canvas accessibility label and briefing modal, and those earlier translation omissions pass. Two further regressions passed:

- Selecting Heavy spacecraft changes the launch cost by 74 credits relative to Rideshare and the rendered fairing radius from 1.4 to 1.9 m. Stowage hides the deployed solar/antenna meshes and presents the compact envelope; switching back restores the deployed geometry. An initial altitude of 1,500 km is permitted by Heavy, then rejected by Rideshare through the actual launch gate.
- A live Mars flight sampled over 65 animation callbacks changed its spacecraft render position on all **64 consecutive frame intervals**. This distinguishes smooth pose updates from the former slower UI-telemetry refresh. Evidence: `continuous-flight-motion.json`.

Visual review still found a small clipping defect despite the earlier weaker CTA test: sticky result actions used `bottom: -26px`, leaving the lower portion of the next-action button outside the modal at 1280 × 720. The existing assertion confirmed its center was clickable, which was insufficient to claim the whole control was visible. The English case now checks the entire button against the modal viewport. A CSS correction and the newly added launch-warning translations require targeted verification in the next build; the 21-case pass above is not evidence for those later assertions.

The initial performance evidence is preserved as `performance-Di_VSFLN.json` and `performance-Di_VSFLN.png`. `performance.json` is reserved for the latest completed measurement, whose bundle identity is recorded inside the artifact. Do not use the earlier 2K-texture load time as a measurement of the later 4K build.

## Repeated performance capture with 4K imagery and continuous flight

`index-BJKhhqBm.js` was measured on the same Chrome, Intel Arc 130V, high-quality 1280 × 720 configuration. The cold network profile remained 10 Mbps download / 5 Mbps upload / 40 ms latency with cache disabled. Assets were ready in **9.60 seconds**. This time no other QA browser ran during the subsequent 120-second flight capture.

Across the final 7,200 sampled frame intervals, median was **16.7 ms**, p95 **18.0 ms**, and p99 **18.7 ms**, with **zero above 33.34 ms**. All six 20-second samples retained **190 geometries, 21 textures, and 35 shader programs**. Recorded draw calls were **111–113**, triangles **25,938–44,050**, and JavaScript heap approximately **23–27 MB**. There were no captured runtime errors. The spacecraft was visibly rendered in the flight view, and its continuous motion had a separate 65-frame functional check; this is not a performance result inferred from an empty page. The final frame is `performance-mars-120s.png` and raw evidence is `performance.json`.

These observations establish behavior on this hardware and browser, not a guarantee for low-end devices or other GPU drivers. Later translation, clipping, or stowage-state fixes do not silently change the measured bundle identity.

## Final targeted closure: index-l4xtqTRr.js

Production bundle `index-l4xtqTRr.js` (961,031 bytes, built 2026-11-15 02:00:45 KST) passed **4 / 4 strengthened targeted cases in 28.7 seconds**, with no captured browser/resource/WebGL errors:

1. English journey: canvas accessibility label, briefing translation, protected custom spacecraft name, live mission, result, save/reload language, and **the entire next-action button inside the modal without scrolling** at 1280 × 720.
2. First-design guide: real rear-face camera attachment and internal-bay battery placement; closed shell in the plan view.
3. Real Earth surface target selection, changed science requirements, resource-graph pointer scrubbing, and target clearing.
4. Launch packages: cost/fairing/injection changes, real deployed-mesh hiding/restoration, **Escape preserving the stowed display and hiding the selected outline/rotation ring**, and the out-of-range launch warning translated into English.

The refreshed `english-result-1280x720.png` was visually inspected: Improve design and Other missions now display fully above the modal border. The prior clipping finding is closed. The earlier document-language, canvas-label, briefing-footer, texture-leak, and stowage Escape findings have passing regression evidence. The existing 21-case full pass applies to `index-BJKhhqBm.js`; these four targeted checks cover the subsequent narrow UI/state/translation corrections. The 120-second hardware performance report continues to identify its measured bundle explicitly. No browser or performance process from this QA run remains active; the local preview service may remain running for development.

PowerShell reproduction:

```powershell
npm.cmd run build
npm.cmd run preview -- --port 4173
# In a second terminal:
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4173'
npm.cmd run test:browser
```


## Iteration 5: science delivery, 3D control room and full Earth–Mars transfer

New production candidate `index-8t_exRlg.js` / `transfer-ui-DIApRb57.js` / `transfer.worker-D_EomxMY.js` received a **27-case Chrome functional batch**: **25 passed**, with two actionable failures. The advisor test still expected the assumption text in the newly collapsed card; the harness was corrected to open its detail button. A real legacy-import regression exposed a raw JSON SyntaxError instead of the localized validation message after M03 format routing was added; format sniffing was corrected to let the existing parser report the error. No failed result is counted as a pass.

The final candidate **`index-B-z3t1tK.js` / `transfer-ui-BaLElXcm.js`**, with the same transfer worker, passed **three targeted regressions in 24.7 seconds**: paused forecast immutability plus exact event warp, legacy IndexedDB/reload/malformed JSON, and the existing English UI journey. The two original failures are closed. This establishes 27 distinct scenarios across the two snapshots, rather than claiming a single 27-case run on the final bundle.

The full unit run at this iteration passed **137 tests in 20 files** (29.94 seconds wall time). It includes independent transfer propagation/resource audits, both physical mission presets, exact worker caps/revision cancellation, strict checkpoint reconstruction, a sub-second clipped-operation save regression, and translations. The worker contract tests bundle and run the actual worker source with a Node message-transport adapter; they do not mock the simulator.

New browser evidence:

- `flight-advisor.spec.ts`: previewing a paused state does not mutate it; the real time-warp control pauses exactly before the predicted event; real Earth and Mars runs distinguish capture, transmission, propagation and receipt. Geographic receipt markers match actual packet coordinates. The flow tests use live time advancement, not the fast-finish hook.
- `control-room.spec.ts`: **2/2 passed** on the candidate batch. The GLB loads only on entry and is reused. The real scene contains 27 meshes/51,231 vertices; the central screen receives a live1280×720 render target from a separate orbital camera. Camera manipulation preserves a paused simulation. Actual WebGL loss pauses flight; restoration repopulates the screen and flight can resume. Files: `tests/browser/artifacts/control-room/`.
- `transfer-flow.spec.ts`: both real-UI cases passed on `8t_exRlg`: date handles and encounter blocks change the solved plan, and the full Earth escape→solar cruise→Mars encounter→Earth receipt mission completes and restores its checkpoint. A preliminary JSON-string comparison had failed only because object property order differed; semantic deep comparison confirmed **no differing resource, trajectory, packet or event values**, and the before/after checkpoints are retained. Files: `tests/browser/artifacts/transfer/`.
- `transfer-resilience.spec.ts`: **five cases passed on `8t_exRlg` in46.8 seconds**: campus continuation after reload; M03 assembly backup retaining the separate transfer plan; rejected tampered checkpoint without stranding the current run; UI and Worker storage denial with a current downloadable JSON backup while time continues; and actual M03 WebGL restoration/resumption. A sixth English M03 case passed on final `B-z3t1tK`: UI/aria, actual departure milestone, runtime reason and event log contain no untranslated Hangul, while underlying saved event data is unchanged. Files: `tests/browser/artifacts/transfer-resilience/`.

These are **33 distinct Chrome scenarios across the stated snapshots**, not a single final-suite pass, a usability study, or a claim of commercial-game parity. Captured application exceptions, failed app resources and WebGL console errors were absent in passing runs. The separate six-case GMAT transfer research, its frame/time restrictions, and the original eight-case M01/M02 validation remain distinct; see `transfer-model.md`.

Extended scene performance is being measured separately with all other browser QA closed. No new performance result is inferred from these concurrent functional runs.

## Final isolated room and M03 performance: index-B-z3t1tK.js

The extended measurement above is now complete. `tests/browser/performance-extended.mjs` started at **2026-11-15 02:41:22 KST** (`2026-11-14T17:41:22.744Z`) after all other browser/GPU QA was closed. No build or full CPU test ran alongside it. The frozen assets were **`index-B-z3t1tK.js`, `transfer-ui-BaLElXcm.js`, and `transfer.worker-D_EomxMY.js`**.

Configuration: **Chrome 157.0.8103.52**, headless hardware rendering through ANGLE Direct3D11 on **Intel Arc 130V**, Intel Core Ultra 5 226V, 15.54 GiB RAM. Both fixtures used a **1280 × 720 CSS viewport and 1280 × 720 drawing buffer at DPR 1**. The room used the main renderer's **high** quality setting; M03 used its fixed antialiased ACES renderer (DPR cap 1.5, actual DPR 1). Each fixture used the actual **six-part balanced craft**: large solar array, spectrometer, antenna, battery, recorder and engine.

| Measured live fixture | Wall time / sampled intervals | Median / p95 / p99 | Maximum | Intervals >33.34 ms | GPU geometry / texture / program counts |
|---|---:|---:|---:|---:|---:|
| M02 Mars flight, 3D control-room interior and live orbital monitor, 60× | 120.085 s / 7,203 | 16.7 / 16.9 / 17.0 ms | 33.3 ms | 0 | 213 / 24 / 34 |
| M03 actual Mars periapsis, active local phase, 1× | 120.075 s / 7,203 | 16.7 / 16.9 / 17.0 ms | 17.3 ms | 0 | 115 / 9 / 24 |

All listed GPU resource counts stayed constant across the six 20-second snapshots. M03's inactive primary scene also retained a constant 175 geometries and 18 textures. The room reported 161–162 draw calls and 147,186 triangles; M03 reported 107 calls and 40,664 triangles. JavaScript heap varied approximately 26–31 MB for the room and 29–40 MB for M03, with no observed monotonic GPU allocation growth. Neither run reported a long task, application exception, console error, or failed application resource.

These were running simulations, not paused tableaux: the room's mission advanced from T+185 s to T+7,390 s and captured its first spectrum; M03 was reached through actual departure/encounter milestone actions and advanced from T+22,464,000 s to T+22,464,120 s with 12 onboard spectra. Its renderer reported the actual Mars phase, not a preview of a future phase. The measurement captures unclamped `requestAnimationFrame` intervals. Twenty-second diagnostic reads add small instrumentation overhead; screenshots were taken only after timing ended.

Raw evidence: `tests/browser/artifacts/performance-extended/report.json`. Visually inspected final images: `room-1280x720-120s.png` and `m03-1280x720-120s.png` in that directory. The room monitor shows the actual approaching spacecraft/Mars, and M03 shows the active spacecraft, Mars surface and scientific records with intact primary controls. No black-environment restoration artifact or clipped primary control was seen.

This establishes local warm-scene behavior for these **six-part fixtures**. It is **not the original 20-part benchmark**, a current cold-network load measurement, a low-end/mobile-device result, or a commercial-quality claim. Hardware, browser, exact assets and sampling limits are preserved in the report. Both performance browser contexts were closed before subsequent Edge tests began.

Reproduce only with other browser/GPU work stopped and the same production build served:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4173'
$env:PERF_ISOLATED='1'
node tests/browser/performance-extended.mjs room,m03
```

## Final Edge v2 critical-path verification

The same final **`index-B-z3t1tK.js` / `transfer-ui-BaLElXcm.js` / `transfer.worker-D_EomxMY.js`** passed **3 / 3 serial cases in 34.4 seconds** in **Microsoft Edge 157.0.4341.46**. The configuration selected the real executable `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`; this is not Chrome relabeled as Edge.

1. `edge-resilience.spec.ts`: an actual M02 flight continued offline, saved, paused after forced WebGL loss, restored its graphics, resumed physical time and restored the saved checkpoint after reload (**8.8 s**).
2. `transfer-flow.spec.ts`: the full M03 Earth escape → solar cruise → Mars encounter → Earth reception sequence completed through real UI controls and restored its semantically identical checkpoint (**13.3 s**). Final outcome: **3/3 fully received spectra, score 93, 6 kg spacecraft propellant remaining**, T+22,648,321.688840948 s. Separate escape-stage fuel use is retained in the event log.
3. `transfer-flow.spec.ts`: real 3D departure-handle dragging and encounter-block dragging changed the solved plan without numeric-input shortcuts (**10.0 s**).

The instrumented offline/resilience and full-M03 runs recorded no page/console errors; the resilience run also recorded no failed app resources. The pointer case establishes its interaction assertions and does not independently collect a browser-error log. These are three Edge repetitions of named critical scenarios, **not three additional unique Chrome features or an exhaustive Edge suite**. No Edge performance claim is inferred from this functional run.

Current Edge artifacts: `tests/browser/artifacts/edge-resilience.json`, `edge-context-restored.png`, and `tests/browser/artifacts/transfer/` (including `mission-replay.json`, before/after checkpoints and trajectory/result screenshots). The preceding Chrome transfer artifacts were preserved at `tests/browser/artifacts/transfer-chrome-pre-edge-final/` before those conventional filenames were refreshed by Edge. Playwright run output used `test-results-edge-v2/`. All test browser processes exited after the run.

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4173'
$env:PLAYWRIGHT_BROWSER='edge'
npx.cmd playwright test tests/browser/edge-resilience.spec.ts tests/browser/transfer-flow.spec.ts --workers=1 --output=test-results-edge-v2
```

## Iteration 6 hardware release candidate C

The single serial Chrome batch on **`index-CNPUcqf4.js` / `transfer-ui-Bh6EDW1H.js`** collected **45 cases: 33 legacy scenarios, 8 hardware/debrief scenarios, and 4 language/UI-scale journeys**. Chrome 157.0.8103.52 completed the batch in **12.5 minutes: 42 passed, 3 failed**. This is a recorded intermediate result, not a final all-pass claim.

The failures were investigated separately:

- A real UI defect: after a genuine science receipt, pausing rebuilt the flight panel and cleared the transient receipt announcement. Physical packets and received credit were intact. Candidate D caches the actual packet IDs and original announcement time, resumes only the remaining three-second display period after a refresh, and plays the sound only for a new receipt. A loaded mission does not replay old announcements. Reduced-motion users receive the same timed text without the slide/fade animation.
- A test readiness error: native date input still had focus after Tab, while the editor intentionally deferred replacement of the focused control. The test now explicitly blurs by clicking the visible heading before waiting for the dirty render to finish. It still checks atomic design/plan undo using the actual controls.
- A stale test string: the fully English camera aria instruction is now “Drag to mount Optical camera”. The exact expectation was updated; English-only and reachability checks remain.

All four **1280×720 Korean/English × normal/large UI** journeys passed on C. Each enters the new hardware profile, checks assembly and connection controls, executes a real Earth mission to its result, and reaches both solar and Mars transfer planning. Strict viewport bounds and hit tests were retained. New M03 completion produced **12/3 received records, score 93, minimum 81.26247315914229 Wh and 6 kg spacecraft propellant**; the finished and restored view uses the solar overview while preserving the actual terminal time. Precision and survey examples completed actual reception of one required regional image and four distinct survey cells respectively.

The previously completed full unit run remains **236 tests / 28 files**, with no domain changes between it and candidate D. No test here substitutes for the original five-person novice study or establishes commercial-game parity.

### D targeted result and the E save fix

D **`index-Bauqs6KO.js` / `transfer-ui-Ol57z1SB.js`** passed four of five targeted Chrome cases in 3.7 minutes. The receipt defect is closed: the test waits for an actual announcement before pausing, checks unchanged packet IDs and original announcement timestamp after rerender, verifies reduced-motion visibility without animation, waits for the original three-second expiry, and checks that the paused simulation has no added receipt events. Both debrief cases and the English legacy flow also passed.

The fifth case exposed a real persistence defect after its date-input harness was corrected. Custom dates, dragged operations, bus choice, and atomic undo/redo all remained correct in memory, but entering the transfer view cancelled a pending assembly autosave. The newly constructed transfer view considered the supplied draft unchanged and skipped saving it on exit. A later campus continuation therefore loaded an older preset. **The assertion was preserved.** E marks a newly supplied draft as needing persistence; verified restores do not save their temporary constructor defaults. Main-thread transfer autosave captures the craft/plan before its asynchronous import, and the normal-save profile flag before its asynchronous write.

Visual review also found coplanar hardware-bus lid faces and side details buried under foil. E makes a 3 mm internal separation while keeping the bus's external physical envelope and legacy models unchanged. Two new raycast regressions and the existing hardware render suite passed **24/24**. This focused run does not claim a new complete 238-test suite.

Candidate E **`index-C6OHa66y.js` / `transfer-ui-Da1kv3FN.js`** passed **8/8 save/replay-related Chrome cases in 3.7 minutes** and **4/4 Edge critical paths in 1.7 minutes**, with no captured browser errors. The custom-plan case reads the actual IndexedDB record immediately after exit and again after the separate Earth mission, in addition to checking the final restored UI. It passed with the exact custom plan and bus. The remaining Chrome cases cover separate save slots, hardware and legacy M03 completion/replay, campus continuation, assembly JSON, rejected tampering, and denied storage with a usable JSON backup.

Edge **157.0.4341.46** additionally verified actual new-hardware WebGL loss/restoration: unchanged paused simulation, a rebuilt environment render target, all eight model identities retained, nonblank graphics and resumed physical movement. A separate legacy flight continued offline and recovered its graphics. The full hardware M03 fixture produced **exactly equal results, packet records and event records** in Chrome and Edge: **435 primitive comparisons, including 234 numeric values; 12 packets; 29 events; zero differences**. The input was controlled by the same UI factory/test, frozen bundle and catalogue; it was not separately serialized in that artifact. [E manifest](../tests/browser/artifacts/candidate-e-benchmark/batch-summary.json), [exact browser comparison](../tests/browser/artifacts/candidate-e-benchmark/chrome-edge-hardware-m03-comparison.json).

Three renderer follow-ups passed on E in **20.9 seconds**: hardware focus/selection through bus undo, the two physical Mars handles with cancellation/pending behavior, and actual 4°/12° spherical camera footprints with the 10 km region and no-camera suppression. The closed-hatch screenshot was visually reviewed: the lid is clean, and the label, vents and accent are visible. No browser errors were recorded. These do not replace the earlier all-16-model pointer-drag evidence or claim that every possible assembly is tested.

### Isolated local 20-part diagnostic on E

With other browser/GPU jobs and prototype compilation stopped, Chrome **157.0.8103.52** measured the frozen E solar planning scene on the reference Core Ultra 5 226V / Intel Arc 130V PC. Actual drawing buffer and viewport were **1920×1080, medium quality, native DPR 1**. The fixture has **20 real catalogue parts**, Earth and Mars, and **560 spacecraft plus 600 planetary path samples**. All placements are physically valid; instrument-count, power and budget warnings are deliberately retained. It is a planning stress fixture, not a launchable or active-flight craft.

After **10 seconds of warmup**, the **120.013-second** recorded right-drag/wheel replay yielded **7,200 frame intervals**, raw mean **60.000650 FPS**, p95 **16.9 ms**, p99 **17.0 ms**, maximum **17.3 ms**, no intervals above 33.3 ms, no long tasks and no errors. All **12 right-drags and 12 wheel actions** reached the canvas. Across six resource samples, counts remained **125 geometries / 9 textures / 17 programs**, with **126 draw calls / 118,464 triangles**. The inactive primary renderer remained at **180 geometries / 14 textures**.

[Local raw measurement](../tests/browser/artifacts/candidate-e-benchmark/performance-standard/report.json). The screenshot was inspected after timing ended. Every measured threshold passed **for this local fixture**. The original requirement's actual deployed URL and HTTPS cold-load measurements are still pending; the local run is not substituted for them. It also does not establish close-up flight performance, lower-end/mobile behavior, or universal 60 FPS.

### Version 3 private HTTPS verification

Version **3** was published successfully from pushed commit **`2eaa0fa530107daef991ef12e4bb967c29c14de0`**, deployment **`appgdep_6af8b299738c8191a6abb22193062a7d`**. Its unchanged E main bundle is **`index-C6OHa66y.js`**. The original owner-only audience was checked before and after publication; no viewers or editors were added. [Play site](https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site).

The authenticated HTTPS smoke test received status 200 and the exact release bundle, opened the actual hardware assembly with 16 model cards and a real rendered bus, and recorded no errors. [Smoke evidence](../tests/browser/artifacts/deployed-v3/report.json).

The **fresh browser/cache, 20 Mbps download, 100 ms emulated RTT, 1920×1080** HTTPS cold run reached the first hardware assembly, including ready fonts, in **6,561.706 ms**. Measured encoded response bytes including headers totalled approximately **11.760192 MiB**. All response sizes were measured; there were no failed responses, disk-cache responses or application errors, and the expected release bundle was verified. Same-origin authentication was injected through browser CDP request headers, retaining browser network shaping and not forwarding the header to other origins. Interactive sign-in and user think time are excluded. [Cold-load evidence](../tests/browser/artifacts/cold-load-deployed/report.json).

Finally, the same **actual HTTPS URL** ran the standard 20-part input replay after a separate 10-second warmup. Over **120.0104 seconds**, it sampled **7,199 intervals** with raw mean **60.00076678296223 FPS**, p99 **17.0 ms**, maximum **17.2 ms**, no intervals above 33.3 ms, no long tasks and no errors. All 12 right-drags and 12 wheel actions were observed. Six snapshots retained the same **125 geometry / 9 texture / 17 program** counts. Actual scientific samples were **100+360+100 spacecraft points and 300+300 planetary points**, with a separate 2-point date guide. Every defined threshold passed. [Deployed warm measurement](../tests/browser/artifacts/performance-standard-deployed/report.json).

The warm test's authenticated resource transport used routed fetch/fulfill without following redirects; it is not the cold-network measurement. Both probes used independent fresh browser contexts and ran without concurrent build, simulation test, prototype or other browser QA load. All browsers closed at completion. These results establish the named reference fixture and initial-load targets, not every scene, device, hardware combination or prolonged play session. The original external novice study remains unperformed.
## Iteration 7 art candidate: local verification before version 4

Main `index-pj8dkhVB.js` (7A) passed five actual hardware interaction cases in 42.3 s: all sixteen model-card drags, focus/bus undo, model replacement, actual optical footprint, and Mars encounter handles. Its four KO/EN × normal/large 1280×720 assembly cases passed in 21.8 s. Their first harness incorrectly borrowed a radio-specific focus distance under 1 m for a wider optical camera; the assertion was corrected to actual relative zoom, projected mesh bounds and hit testing. That failed harness is preserved separately; it did not establish a product defect. [7A manifest](../tests/browser/artifacts/candidate-7a-benchmark/batch-summary.json).

Visual review did find an initial toast overlapping the assembly guide heading. The CSS-only 7B fix, `index-BHzw1aRT.js` / `transfer-ui-Dcapz3WI.js`, passed the four cases again in 22.5 s. At 170–262 ms after mission selection, both real elements were visible with a 21 px normal / 19 px large-UI gap, exceeding the declared 8 px minimum. No expiry wait or hidden toast was used. A separate actual Edge 157.0.4341.46 hardware context-loss/restoration case passed in 15.2 s, retaining paused physics, model identities and rebuilt environment, then resuming real motion. Recorded browser errors were zero. [7B manifest](../tests/browser/artifacts/candidate-7b-benchmark/batch-summary.json).

The merged renderer passed TypeScript, production build and 35 focused unit cases. This is not a repeat of the previous full 236-case suite. The three simulation Worker bundle names remained identical to E. The isolated art prototype also passed 29 ownership checks across three real hardware assembly↔transfer cycles and one legacy control; originals received zero dispose events, owned transfer clones exactly one, and actual context recovery retained atlas artwork. [Ownership evidence](qa/hardware-art/ownership-report.json).

Local 7B standard performance: 1920×1080, medium, native DPR1, twenty real catalogue parts, two planets, 1,160 trajectory/orbit points plus a two-point guide, ten-second warmup then 120.0073 seconds with twelve actual orbit drags and twelve wheels. The 7,199 intervals averaged 60.00091680800768 FPS; p99 was 17 ms, maximum 17.2 ms, errors/long tasks zero. All six samples held 125 geometries / 10 textures / 18 programs, 126 draws / 119,232 triangles. The fixture remains physically mounted but mission-infeasible with its original instrument/power/budget warnings. [Frozen local report](../tests/browser/artifacts/candidate-7b-benchmark/performance-standard/report.json). This is not the forthcoming private version 4 cold-load or HTTPS evidence, and does not certify every scene or device.

## Version 4 private HTTPS verification

Published commit `dc96ef18cd4cb169a0ff9ed101e107da500df926`, deployment `appgdep_6af8bcf76b20819198d9420d7817837a`, version4, exact main `index-BHzw1aRT.js`; owner-only access unchanged. The actual HTTPS smoke verified16 hardware cards and the rendered assembly with zero errors. Its screenshot was visually inspected. [Smoke](../tests/browser/artifacts/deployed-v4/report.json).

The fresh-cache20Mbps/100msRTT/1920×1080 run reached the first hardware assembly with fonts ready in **6633.9307ms**, approximately **11.809353828430176MiB** measured encoded bytes. All responses measured, no failed/cache responses or errors, correct release bundle. [Cold-load evidence](../tests/browser/artifacts/cold-load-deployed-v4/report.json).

The actual private HTTPS standard20-part scene then completed a separate10-second warmup and **120.01719999998808seconds**, **7200frame intervals**, raw mean **60.00085001204206FPS**,p99 **17ms**,maximum **17.2ms**,zero long tasks/errors,all12orbit drags/12wheel inputs. Six samples stayed at125geometries/10textures/18programs/126draws/119232triangles. All declared thresholds passed. [Warm-render evidence](../tests/browser/artifacts/performance-standard-deployed-v4/report.json).

These runs were isolated from builds, simulation tests and other browsers. Same-origin-only credentials remained in memory and were cleared afterward. As in version3, CDP preserved cold network shaping; warm routing makes no network-throughput claim. Harnesses added a validated output-folder option after source publication solely to preserve previous evidence; the deployed application bundle was unchanged. No all-device/all-scene or commercial-parity conclusion follows from this fixture. Runtime3 command work started only in the subsequent local working tree.
## Iteration 8: context resource lifetime regression and closure

The unpublished **8A** build (`index-CAmXh2e9.js`, `transfer-ui-DY92q0dV.js`, `transfer.worker-wy0VbKhl.js`) passed **5/5 existing M03 browser cases in 151.9 s**: legacy and hardware actual three-phase completion/replay, pointer date/timeline editing, forged-checkpoint preservation, and real graphics recovery. Five full traces contained zero page/console errors and zero HTTP failures. Warning inspection nevertheless found three `INVALID_OPERATION: delete: object does not belong to this context` messages in the single restoration case. Thus functional recovery was not treated as proof of clean resource ownership. [Five-case evidence](../tests/browser/artifacts/candidate-8a-regression/manifest.json).

A new strict test instruments native WebGL deletion calls, records the actual handle owner and call stack, and checks console warnings as well as rendered pixels and paused simulation state. It does not suppress `INVALID_OPERATION`. The specified `CONTEXT_LOST_WEBGL` notification is counted separately from invalid deletion. The three candidate results are distinct:

| Candidate | Actual checks | Result and causal finding |
| --- | --- | --- |
| 8A, `index-CAmXh2e9.js` | Three M03 loss/restore cycles | Strict reproduction **failed**: **9 invalid deletions**, the old PMREM framebuffer, depth renderbuffer and texture on each restore. Their stacks ended in `TransferScene.contextRestored` disposing the pre-loss environment. |
| 8B, `index-w_0zFQ-h.js` / `transfer-ui-VepjJt_B.js` | M03 ×3, hardware Earth flight ×3, live control room ×3 | M03 case passed after PMREM retirement moved to loss. The combined primary/room case **failed** with **9 residual invalid deletions** from the directional shadow target. `WebGLShadowMap.render` reset its type tracking after context recreation and replaced retained pre-loss shadow handles on the first primary frame. All six primary/room state and pixel checks passed, but that did not override the strict failure. |
| 8C, `index-DvcSvFfY.js` / `transfer-ui-BIw0rpyT.js` / `transfer.worker-EieOABJZ.js` | Same two cases, **nine actual restore cycles** | **2/2 tests passed in 23.1 s**: zero native invalid deletions, zero cross-context warnings, and zero page/console errors. Paused state remained exactly equal, each new environment rendered, the room monitor contained a real orbital image, and actual mission time resumed. |

The fix retires owned PMREM and shadow render targets during loss, while their original renderer caches still own the handles. Recreated targets are not disposed a second time. The control room retires only its own environment and live-monitor target; it never disposes the primary environment it initially borrows, and it skips rendering while the context is lost. Shader, material, lighting and simulation settings are unchanged.

In 8C the three samples per view held **108 geometries / 7 textures / 13 programs** for M03, **54 / 15 / 21** for hardware flight and **80 / 13 / 20** for the room. These are resource observations, not a performance benchmark. Screenshots from all three views were inspected. Primary/room console warnings were empty; M03 retained the separately recorded pre-existing PMREM sample-limit and driver shader-precision warnings. “Cross-context warning-free” must not be expanded into “all warnings removed.”

Evidence remains separate: [8A strict failure](../tests/browser/artifacts/transfer-context-ownership/before-8a/report.json), [8B diagnosis](../tests/browser/artifacts/transfer-context-ownership/after-8b/diagnosis.json), and [8C closure manifest](../tests/browser/artifacts/transfer-context-ownership/after-8c/manifest.json). The browser was Chrome **157.0.8103.52**, viewport **1280×720**, on the existing reference PC. All owned browsers closed afterward. This work does not validate a new runtime-3 command lesson, establish performance numbers, or constitute a new publication.


## Iteration 8D: actual remote operations integration

Local production candidate8D: entry `index-8sGqNdQq.js`, shared `index-BHZ2O11J.js`, transfer UI `transfer-ui-A1hoqGtM.js`, worker `transfer.worker-D8HCV3Ql.js`. This is not yet the published version4. Explicit operations3 source integration preserved all15 approved production hashes;41 domain tests passed, including real no-command0/3, late-command0/3 and early-command12/3 outcomes, five checkpoint phases and declared numerical convergence gates. See [domain acceptance](qa/operations/acceptance-summary.md).

The actual bundled Worker passed10/10 tests in29.30s, with47 captured dependency/source files unchanged. [Worker audit](qa/operations/worker-contract-audit/result.json). Actual Chrome157 at1280x720 then passed3/3 new UI cases in3.2minutes: real pointer repair through distinct command installation/Earth acknowledgement/science delivery/exact replay; cancel/retry preserving emitted signals and invalid-import recovery; bounded restore/context recovery plus immediate Send/Exit/Continue with no phantom draft. All six captured candidate entries stayed byte-identical and application errors were0. [Browser batch](../tests/browser/artifacts/remote-operations/8d/batch-summary.json).

The real UI repaired flight received12 packets; its longer UUID-bearing command arrived at22456736.79475602s and its Earth acknowledgement at22457635.5238937s. Domain fixture IDs encode different byte lengths, so their exact frame times are not interchangeable. In the late domain case the real receiver/link loses the frame after the listening window; Earth remains unconfirmed, rather than inventing an acknowledged expiry rejection.

UI review caught three races before the final run: pending restore could advance the UI epoch while the worker ignored input; immediate exit could save an already submitted draft as unsent; an epoch change could strand an in-flight draft preview. Central pending/transaction guards, deferred exit/save/import intent, authoritative restore epochs and preview invalidation were exercised by the final browser tests. Preserved screenshots have two timing caveats: the first queued capture preceded the180ms UI redraw and the recovery capture preceded the new Play label; later visible-queue evidence is the immediate-exit/continue capture. Terminal result/Retry remains below the initial right-panel fold, and the Korean command heading wraps its final syllable. These are presentation fixes queued for the next camera integration, not a claim of flawless/commercial-level completion.


## Iteration9B: current-flight inspection, NASA4K Mars and GPU generation retirement

The frozen candidate `index-TfmOhXw5.js` integrates8D remote operations, direct part inspection and the optional NASA Trek4096×2048 Mars mosaic. The initial9A functional pass revealed stale geometry/VAO disposal after restoration; its failed native proof is retained.9B retires owned old-generation registrations at loss while retaining CPU state, covering primary/room/transfer rendering and inactive resources.37 focused CPU cases passed. The real command/ACK/science/replay/Exit journey passed with three loaded4K restores; two additional strict browser cases passed nine restores and actual geometry rebuilding with zero invalid native deletions. Other driver/PMREM warnings are disclosed.

The isolated high-quality720p actual8-part craft+visible4K Mars measurement passed120.0094s, mean60.000750FPS,p9917ms and stable64/11/23 geometry/texture/program counts. Paused runtime and frozen files were unchanged. Twelve orbit drags and twelve wheels were observed. A suspected blank tool preview was checked against saved PNG pixels and independently viewed; the craft and204px Mars were present. This fixture does not replace the original1080p20-part HTTPS requirement. Private publication and its separate deployed checks remain pending at this entry. [Detailed scope and evidence](qa/milestone-5-local.md).


### Version5 private deployment

The exact9B source `8dcf0519bf8401b8f66126b48b0f1704e31e1011` was pushed and privately published as version5/deployment `appgdep_6af8d19544d88191928b1ae406497ed6`, entry `index-TfmOhXw5.js`. Actual HTTPS smoke/cold/standard checks passed:16hardwarecards,firstassembly6675.5183ms/11.8437443MiB at20Mbps/100ms,and20parts/medium1080p120.0167s at60.0009000135FPS/p9917ms. Twelve drags/twelve wheels,zero errors/longtasks,and stable125/10/18 geometry/texture/program counts. The standard stress craft retains its model warnings; no mission-success or all-device claim is made. The optional4K Mars map was not fetched onfirstassembly. Three saved screenshots were independently reviewed. [Full publication provenance, rejected9A evidence and acceptance scope](qa/milestone-5-local.md). Separate M02 work remains candidate.

## M02B / local production v6a

Frozen `index-Dsi5FLrM.js`:13 distinct new UI cases passed across preserved harness corrections,4 existing-mission regression cases passed,2 Edge cases passed. Chrome/Edge491 actual terminal save leaves match exactly.58 files/409 unit tests passed. Exact source/output hashes, failed-harness explanations and deployment/performance state are in [milestone-6-local.md](qa/milestone-6-local.md).


Version6 hosted verification completed: [release receipt](qa/milestone-6/deployment.json), [exact scope/results](qa/milestone-6-local.md#actual-hosted-version-6). ActualM02B pointer correction/fired burn, cold6.7133s/11.8672MiB, isolated120.0172s/60.0008FPS passed. A/B review and articulated deployment remain next candidates.
