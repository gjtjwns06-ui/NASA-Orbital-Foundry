# First Light compact flight interface — bounded acceptance

Date: 2026-11-15. Branch: `codex/first-light-flight-ui`, based on `b0c0c5cc07c8e0f7f77e06fb1eef86c99a274586`.

## Product change

Only `src/deployment-ui.ts` and `src/deployment-ui.css` change production behavior. During a committed flight, the assembly inventory becomes a closed-by-default Equipment drawer. The compact panel shows current solar generation, the actual stable-window counter, received report bits, and selected hardware. A direct mesh selection preserves the camera; the explicit Focus action moves it. Existing equipment selection, Fit, playback, schedule, save/import, retry, and model explanation actions remain available.

The panel width and its right edge remain constant while the drawer opens, so the renderer receives the same camera viewport. Drawer operations do not change craft, plan, numerical settings, runtime, telemetry, or result. Hidden equipment uses the native `hidden` attribute. Equipment disclosure, Close, Details, Space, Escape, and live repaint preserve their intended keyboard focus. Flight placement stays locked.

Readings use `COMMISSIONING_REQUIREMENTS` and actual worker state. The recorded 60-second window is labeled as historical evidence once the report exists. It does not assert that present generation/rotation still meets the requirement. A failed craft remains failed even after 16 Mbit arrives. This is presentation code, not a second simulation or invented mission-stage system.

Restore/forecast progress now precedes the design/playback controls and stays pinned within the right panel. This fixes a discovered 720p case in which progress was visible but Cancel was clipped behind the expanded programme timeline. The progress element has a localized accessible label.

No renderer, assets, physical model, worker, saved input, numerical gate, tolerances, or accepted baseline server was changed by this work.

## Exact evidence scopes

| Run | Source / scope | Observed result |
| --- | --- | --- |
| R1 | `docs/qa/flight-ui-r1/frozen-before.json` and `frozen-after.json`, 285 identical byte identities; entry `index-B-uggCdt.js` | 9 passed, 1 timed out; 359.409 s. Retained as a failed aggregate run. |
| R1 layouts | KO/EN × normal/large × 1280×720/1920×1080, actual launched and paused flight | All 8 passed. Default disclosure state, hidden rows, accessible hit areas, Space/Escape/focus, stable panel edge, exact camera and physical-state equality. |
| R1 interaction | Real native mesh hit and mouse selection, Details/Close, explicit Focus, real left drag while flying, continued live telemetry, actual WebGL context loss/restoration | Passed. No craft edits in flight; live disclosure focus retained; paused physical state unchanged through context recovery. |
| R1 terminal attempt | Baseline and candidate full input replay inside one 180 s case | Baseline completed; candidate reached 91% before test budget expired. No assertion mismatch or native/application error observed. The failure screenshot and raw timeout remain preserved. |
| R2 | `docs/qa/flight-ui-r2/frozen-before.json` and `frozen-after.json`, 285 identical byte identities; entry `index-DJOEXq5h.js` | 3 passed, 0 failed; 188.367 s. Separate bounded replay cases, not an altered simulation. |
| R2 regression | EN large, 1280×720, same real-flight drawer checks | Passed on final production bytes. R2 changes from R1 are restore/forecast progress placement and accessible label, plus the focused harness and source receipt tool. The full eight-layout matrix belongs to R1, not R2. |
| R2 restore/cancel | Original cramped 1280×720 workshop/timeline layout, real file chooser input, actual camera drag while worker replays, visible native Cancel hit target | Passed. At 3.664% progress, camera had moved while the accepted design stayed exact; Cancel was reachable. The cancellation exercise took 10.871 s including interaction. Prior craft/plan/numerics/runtime/telemetry/result were retained and workshop editing became available again. This is not a measurement of cancellation latency alone. |
| R2 full replay | Actual earlier Chrome terminal save, imported into unchanged accepted baseline 5188 and candidate 5192 | Both produced exactly equal craft, plan, numerics, runtime, telemetry, and result at T+1385.0067053601188 s. Baseline replay took 75.723 wall seconds; candidate took 73.841 wall seconds. |
| CPU facts | `tests/deployment-flight-presentation.test.ts`, real runtime construction plus intentionally varied state/telemetry fixtures | An initial concurrent run hit the unchanged 5 s test timeout in all 3 cases. Unchanged rerun with browsers closed passed all 3, approximately 1.890/3.142/3.186 s. Both reports are retained. These fixtures test presentation semantics, not an additional observed end-to-end failed mission. |

R2 terminal screenshots demonstrate the distinction directly: the report is complete and its stable interval recorded, while current rotation is about 0.271°/s, above the 0.1°/s threshold. The UI reports these facts separately.

All recorded browser cases had zero application errors and zero native deletion-audit errors. Driver shader compiler precision/division warnings were captured in some cases, including one R2 layout case; this is not a claim of zero console warnings. Native browser was Chrome 157.0.8103.52. The browser session exited before the GPU lease was released.

## Source and delivery

Final build passed `npm.cmd run build` (TypeScript and Vite). `git diff --check` passed. Final deployment UI chunks are `deployment-ui-c-MUMrXQ.js` and `deployment-ui-D3KCMYMI.css`. The physical worker remains `deployment.worker-BIezmTdy.js`, SHA-256 `b5a40959c76a844422922796d0b88268c439e9484e317c2cdd509a265a1b862f`.

`flight-ui-transfer-manifest.json` is the explicit file-by-file transfer allowlist with byte counts and SHA-256 identities. Copy the two production source files and the named supporting test/tool/document/evidence files; do not copy this worktree's `dist`, renderer, model, package files, or unrelated files into another candidate. The manifest itself is additional delivery metadata and is not self-hashed. Integrated candidates require their own build and integration evidence.

Useful screenshot paths, relative to this worktree:

- `tests/browser/artifacts/deployment-flight-ui/flight-ui-r1/ko-normal-1280-closed.png`
- `tests/browser/artifacts/deployment-flight-ui/flight-ui-r1/en-large-1280-open.png`
- `tests/browser/artifacts/deployment-flight-ui/flight-ui-r1/actual-selected-part-focused.png`
- `tests/browser/artifacts/deployment-flight-ui/flight-ui-r1/actual-terminal-replay-displays-compact-truthful-objective-beside-baseline-failure.png`
- `tests/browser/artifacts/deployment-flight-ui/flight-ui-r2/terminal-restoring-visible-cancel.png`
- `tests/browser/artifacts/deployment-flight-ui/flight-ui-r2/terminal-compact-ui.png`
- `tests/browser/artifacts/deployment-flight-ui/flight-ui-r2/terminal-selected-wing.png`

## Limits and remaining work

The roughly 74–108-second observed save replay is still a substantial player wait. This change makes progress and cancellation reachable and verifies camera responsiveness and state protection; it does not optimize replay computation. Timings are functional observations under these runs, not performance benchmarks. GPU/driver warnings remain visible in raw evidence. The screen still uses the accepted pre-PBR asset snapshot from this branch. This is acceptance of a narrow flight-interface improvement, not commercial-game parity or completion of the overall game.
