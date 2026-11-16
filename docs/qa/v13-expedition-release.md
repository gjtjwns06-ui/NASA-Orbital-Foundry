# v13 · Voyage, instrument exploration and gravity assists

This release changes the primary solar expedition from three screen-marker drags to a moving encounter observed through the instrument actually mounted on the player's craft. The frozen local candidate passed 58 CPU tests and all 10 native integration cases. The publication receipt is recorded separately after private deployment.

## Player-visible changes

- The calculated cruise can be viewed from the map or beside the spacecraft. A locally cached NASA/Goddard celestial map supplies the sky; planets, the craft and the local encounter remain rendered 3D geometry.
- A forecast star-reference fault stops time skipping and asks the player to recover in safe hold or preserve the incoming observation window. Stabilization settles the instrument and tracks the body-fixed point the player actually aimed at. Manual pointing takes precedence, including the last motion before pointer release.
- The local encounter moves along an analytic hyperbola. Wide context plus resolved detail are required for camera missions. Spectrometer missions compare visible and near-infrared observations of the same surface region.
- Hold the shutter or Space to integrate light; ray geometry, illumination, native IFOV, footprint, integration time, SNR and residual smear determine acceptance. An empty view, a brief click or an unresolved region cannot award science. A missed window can be rehearsed again without representing time reversal as a real manoeuvre.
- Safe attitude, stabilization, science resume and downlink change actual operational state. The thermal training model can warn, protect the instrument and cool while preserving acquired records. Compact view retains the observation-window countdown.
- The actual GPU instrument view is saved with each observation. Data is transmitted at the modelled link rate and then waits the one-way light time before a journal receipt. Paused checkpoints preserve records and queued commands; interrupted held exposures do not resume.
- A single planetary assist is searched by matching incoming and outgoing planet-relative asymptotes, an allowed turning angle and a bounded periapsis. Comparison shows fuel **and time**, and charges any explicit correction. The found Jupiter→Saturn example saves about 114 m/s (about 62 kg for the tested payload) against the bounded direct-window scan, while increasing travel from 2,503 to 3,600 days.

## Scientific and graphical boundaries

JPL approximate elements and Sun-only Lambert coasts are retained. The assist uses a zero-SOI planning patch and a separate local hyperbola view; it is not a continuous finite-boundary, multi-body or GMAT-validated trajectory. Each expedition still starts from Earth; the new route supports one intermediate assist, not arbitrary unlimited sequences or interstellar travel.

The sample regions, reflectances, detector calibration, 300 W carrier and lumped thermal response are authored teaching models. Two bands do not establish water, minerals or ring composition. Saturn's rings are visible scenery; its current spectral task observes a region on the planetary globe. Local encounter time can be stretched or compressed for play. The electrical and data units remain W×physical seconds/3,600 and bits. Direct control represents onboard operations/rehearsal, not instantaneous Earth teleoperation.

The sky and existing Mars/Earth image assets retain their provenance. Discovery pictures are captures of this game scene, not claimed NASA scientific photographs. No external AI API is required.

## Verification evidence

- CPU: 58 tests across solar model, reachability, campaign persistence, assist geometry, operations, mounted instrument geometry and journey restore passed.
- Renderer component: real Edge WebGL rendering, native pointing/zoom, GPU JPEG readback, changing encounter position and view transitions passed. `solar-renderer-r2.json` records that earlier component check.
- Final native integration: **10/10 passed in 7.1 minutes**, recorded in `v13-native-r2.json`, on actual Edge at `http://127.0.0.1:5188/`. The suite includes actual ASTER camera, Venus spectral and Jupiter-assisted Saturn spectral missions, native equipment installation, route edits, workshop return, paused save restore, actual transmission/received science and legacy date recovery in both languages. Native actions use mouse/keyboard; state access is read-only. This is local built-output verification, not a separate hosted performance measurement.
- `v13-runtime-manifest.json` freezes 328 source/output identities and checks that the local preview serves the exact built index. Verify it again before source push and compare packaged dist bytes to it.
- `v13-independent-review.md` is a bounded advisory review, not a numerical fun score. It distinguishes observed images, failed intermediate evidence and source-inferred repairs.

## Defects found and repaired during validation

The first source-mode assist test was contaminated by HMR and is not counted as a product pass. An early native attempt navigated before a build completed and is likewise excluded. Later real-input checks found missing physical target tracking after stabilization, final-drag anchor loss, ambiguous too-wide framing feedback, and use of the destination altitude during an intermediate flyby. Those were repaired. Native science waits for actual visibility and spatial resolution; tests do not inject mission completion or manufacture a valid ray.

Other repaired conditions include a disabled Resume button surviving thermal cooldown, stale exposure credit after pointing into space, malformed measurement/save fields, and lost assist selection after returning from the workshop. The old marker-based tests were updated to exercise the new observations while retaining their equipment and route regressions.

## Publication

Published successfully on 2026-11-15 at 13:26:58 UTC to https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site with the existing owner-private audience. Source commit: `26b743220593d914e4df79f97bb0dfb0413dbe29`. Native Sites returned terminal `succeeded`, so no redundant status poll or hosted performance claim was made.

All 328 frozen source/output identities remained unchanged after source push. The packaged archive matched all 85 tested dist files byte-for-byte, plus the helper's hosting manifest. `v13-deployment.json` and `v13-archive-verification.json` retain the deployment IDs and archive hash. These receipt notes are post-deployment documentation; the tested runtime is unchanged.
