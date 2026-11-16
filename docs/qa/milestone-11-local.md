# Version 11 — spatial clearance cues

Published version10 (`4c1a7829fb6c382755923ca5b30bf64925025f25`) is the baseline. Version11 is privately published at https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site from source `69014f57f00cb313e7c2450cec36bafa6e7f2ef8`; native deployment succeeded2026-11-15 10:58:08UTC. [Publication receipt](milestone-11/deployment.json). Local native checks remain separate from hosted measurements. The original specification remains unchanged; this is a bounded repair-interaction improvement, not a commercial-game completion claim.

Two numbered labels connect the actual highlighted clearance boxes to their part names. The positions come from those rendered guide boxes and the current Worker source/request. Labels describe inspection-box centers and sample angles, not exact contact points. Blocked and uncertain states are distinguished. Selecting a label selects the real part without changing camera or design; closing the preview returns to the existing native hardware drag. Pending/stale/hidden/context/flight states cannot retain interactive preview labels.

The five frozen product files passed independent review and candidate CPU/native checks. The first review rejected keyboard focus restoration to the wrong persistent button; R2 corrected it. The original English resize assertion incorrectly required preview cancellation and remains failed. A separate closure instead proved unchanged valid input with correct reprojection and completed context/preset/flight cleanup. [Original candidate acceptance](../clearance-cues-acceptance.md), [34-file delivery list](../clearance-cues-delivery-files.json).

## Integrated acceptance on version10

- TypeScript/Vite passed:179modules, entry `index-DQW3VLxK.js`, deployment UI `deployment-ui-0AosKNSo.js`. The existing large-chunk warning remains.
- Six focused CPU files passed43tests: cue projection/freshness/layout, scene, view, flight facts, original shading and prior-route comparison. This is not a fresh full-game suite.
- Actual Edge157 combined native suite passed2/2 in59.114s: Korean1280×720 real witness selection, exact camera/design retention, second-label keyboard focus, close/direct drag repair/Undo; English large1920×1080→1600×900 projection, actual graphics loss/restoration, new inspection, preset and live-flight exclusion.
- Both cases retained all311 source/public/dist/harness identities before and after. Application/native ownership errors were0. Korean retained one driver warning; English retained none. Original candidate warnings and failed records remain separate.
- All six physical Worker bundles are byte-identical to published version10. No physical model, save format, mesh/texture/shader or GPU ownership was changed.

The only integration-harness change adds an explicit freeze-path environment variable; the imported original script is archived before that change. Both original case bodies ran together on the integrated build. [Raw report](milestone-11/native-r1-report.json), [decision and Worker hashes](milestone-11/native-r1-decision.json), [source freeze](milestone-11/native-r1-source.json), [CPU](milestone-11/cpu-r1.json), [screenshots and native records](../../tests/browser/artifacts/deployment-clearance-cues/v11-integrated-edge-r1/).

Root visually reviewed the integrated Korean witness and actual live-flight screenshots: labels point to the outlined boxes, remain clear of the panels/timeline and disappear in flight. They are deliberately a small aid to manual repair; no part moves automatically. Behind-camera, insufficient-space and uncertain-status cases have focused CPU evidence rather than fabricated native scenarios.

No new FPS, hosted-browser, all-device or external novice-study claim is made. Saved-flight replay remains expensive; both tested optimization variants were rejected. Commercial-game quality, broader content and remaining original requirements remain open. The test container is the existing `orbital-foundry-next-v10` checkout evolved in place; the separately copied `orbital-foundry-next-v11` baseline was not the tested build.


Main rebuild passed and matched73compiled/runtime/assets files exactly. Six unchanged public text files differ from the candidate only by Git checkout CRLF/LF and retain exact published-version10 canonical bytes. The original specification SHA256 remains63890bee1904681d2459f64439fe312f687fad75cfce44e8600798aff4844098. [Rebuild proof](milestone-11/rebuilt-dist.json). The helper archive verified79distfiles plus hosting metadata before publication; no source/credential files were packaged.
