# v13 expedition — independent qualitative review

Review time: 2026-11-15 22:05 KST. Scope: the implementation contract in `docs/v13-expedition-plan.md`, current controller/UI/operation source, and the supplied saved screenshots. This is an advisory review, not a fun score, novice playtest, or certification that every acceptance criterion passes. No GPU/browser run was started by this reviewer. Runtime files were not changed.

## Directly observed evidence

- `tests/browser/artifacts/v13-voyage/02-instrument.png` (22:03:01, 1440×900): the asteroid occupies a clear central instrument view, with substantial unobstructed space. The whole-world/detail objective is compact, the hold-exposure action is prominent, and view changes are grouped separately. This is materially more legible than the prior three-column engineering dashboard. No clipped panel or overlapping primary action is apparent in this particular frame. It does not prove input responsiveness or successful observation.
- `tests/browser/artifacts/solar-renderer/r2/01-chase.png` and `03-pointed-detail.png` (21:53): the actual assembled probe and a directionally lit, textured Mars are visible; the latter image shows a materially different close instrument view. These are **isolated renderer component** images. Their developer controls are not the production HUD and must not be presented as integrated gameplay evidence.
- `solar-renderer/r2/evidence.json` identifies its component-test scope, records changed instrument aperture/boresight/FOV and an image capture, and contains an empty recorded error array. This is existing test evidence, not a fresh independent browser test.
- `v13-voyage/failure-state.json` (22:03:28) is a failed integrated journey: one accepted context record exists, but a later detail record was rejected. It cannot support an end-to-end pass claim.

## Concrete finding and correction in progress

**Important first-use feedback gap: the named region can appear ready even when its footprint is too broad for an accepted detail.** `evaluateExposure()` in `src/solar/operations.ts` reports a valid illuminated hit as `ready`; `releaseExposure()` separately tests footprint and ground sample distance. The saved failed journey contains a detail attempt with SNR about 54 and smear about 0.029 px, yet `bad-geometry`. Its later current pose has the minimum 6° FOV, a region hit and roughly 0.362 km footprint, while the selected authored region's camera-detail threshold is 0.1521 km. An early, oblique view can therefore require waiting for the approach even after maximum zoom. The former HUD's generic “frame the disc or a region” response did not reveal that cause.

The root agent has corrected the live controller feedback for an oversized named-region footprint to tell the player to wait for the approaching world. The related native helper now waits for the physical approach instead of assuming zoom can force success. This change addresses the observed cause without awarding invalid science. **The integrated native rerun is pending at this review cutoff.** Acceptance criterion 3 should be closed only after the same mouse-driven attempt visibly indicates the constraint, becomes viable as range changes, and produces an accepted detail plus a corresponding game-camera image.

The root agent also reported fixes for missing automatic tracking and manual aim snapping back. Current `VoyageController.syncScene()` / `SolarScene.trackInstrumentTarget()` source tracks a body-relative point only after stabilization and yields while an actual instrument drag is in progress. That is a plausible implementation correction, but the pre-fix image alone does not verify drag-release behavior. Keep the fresh native aim/hold/release evidence as the gate for criterion 8.

## Additional bounded usability/science notes

1. **Compact viewport time budget:** at the review cutoff, `src/solar/voyage.css` hides the telemetry's last child below 1300 px width. During encounter that child is the finite observation-window countdown. Preserve that countdown at 1280×720, especially because the player may need to wait for better geometry; otherwise the window can expire without its remaining time being visible. This is source-inferred, not an independently observed 1280 screenshot defect.
2. **Local time disclosure:** the model drawer correctly calls the encounter a separate local hyperbola and avoids a continuous-trajectory/GMAT claim. It should additionally state that close-approach time may be stretched or compressed for play. The supplied asteroid state spans about 1.9 physical seconds over a 150-second playable window, so an unqualified “time accelerated” description is insufficient for this phase. A single sentence in the existing model drawer is enough; no new permanent dashboard is needed.
3. The exposure progress bar currently represents held duration, not guaranteed scientific acceptance. Numeric SNR/smear and the live cause message must remain the deciding feedback; do not describe a full bar as a successful capture. This is an advisory wording/control distinction, not a newly demonstrated dead end.

## Source-based acceptance assessment

| Contract area | Evidence available to this review | Limit |
|---|---|---|
| Craft/chase/instrument presentation (1) | Supplied 3D component images and production instrument screenshot | No independent verification of the entire moving cruise |
| Recoverable decisions (2) | Controller has cruise safe/continue choices, stabilization, thermal hold and cooling; threshold-sensitive resume layout is present | No newly observed second emergency journey |
| Geometric observations and different instruments (3–4) | Domain uses actual aperture rays, illumination, footprint, native IFOV, exposure/noise and smear; camera context/detail and same-region two-band logic are distinct | Current integrated failed artifact cannot prove both instrument journeys complete |
| Real images and truthful measurements (5) | Actual renderer capture; source captures instrument camera and labels spectral comparison as synthetic, not chemical identification | Need the fresh successful receipt/journal artifact |
| Model honesty (6–7) | Model drawer explicitly separates local hyperbola, Lambert coasts, bounded assist search and no GMAT validation; correction impulse is included in assist calculations | This review did not independently fly a fuel-saving assist |
| Native controls/checkpoints/compact layout (8–10) | Current source contains pause/cancel, held-exposure reset, queued command restore, state validation and scene recovery hooks | Fresh native rerun, compact view, received-save reload and recovery evidence remain the integration gate |

The reviewed presentation now supports an exploration scene with an actionable instrument, rather than a repeated screen-marker task. I found one concrete feedback defect evidenced by the failed journey; its source correction is underway. I did not find another demonstrated release-blocking defect in the inspected subset. This bounded assessment does **not** establish commercial-game completeness or that the game is enjoyable to first-time players. Preserve the current visual direction and close the observed input/feedback loop with the pending native evidence before claiming completion.

## Verification addendum — received Saturn expedition

The original review above remains a record of its evidence and cutoff. This addendum examines subsequently supplied artifacts; this reviewer still did not start a GPU/browser run.

Inspected `tests/browser/artifacts/solar-assist-navigation/actual-assist-voyage.json`, `saturn-two-band-observations.png` (22:19:11) and `saturn-received-spectrum.png` (22:19:26). The JSON records browser 157.0.4341.46, an Earth → Jupiter → Saturn unpowered-assist request, `flybySeen: true`, a resolved incident, encounter resume and return to route planning. Its recorded error array is empty. The receipt contains two spectrum records for the **same** `saturn-region-3`, one visible and one near-infrared, with actual saved JPEGs and bounded measurement metadata. The measured NIR/VIS ratio is approximately 0.808 ± 0.017. These are synthetic-response game measurements, not real Saturn chemical measurements.

Direct visual observations:

- The instrument screenshot displays both distinct band records, their SNR values and reflectance estimates with uncertainty. The same-region/two-band objective is complete and the send action is available. The observation is still marked as awaiting Earth reception; the countdown remains visible in this 1440×900 frame.
- The later receipt/journal screenshot displays the captured cloud-band image, two received records and the matching ratio with uncertainty. Its explanatory text explicitly says this is a synthetic surface-response comparison and not a determination of ring composition. The assembled spacecraft remains visible in the 3D scene. No clipped primary control is evident in these two frames.

This provides integrated recorded evidence for the previously unverified spectrometer journey, actual images/measurement receipt, and recorded assist/resume/replan path. It does not by itself prove the separate failed-asteroid feedback regression or every compact-viewport interaction. The root's compact-counter and local-time disclosure fixes are now present in source; their original review notes should therefore be read as addressed source findings, with the normal browser coverage still required.

At this addendum's cutoff, the separate main **10-case suite is still running** (the root reported its first three cases passed). No all-ten-pass claim is made here. This remains a bounded advisory review, with no numerical fun rating or claim that a human novice playtest has occurred.
