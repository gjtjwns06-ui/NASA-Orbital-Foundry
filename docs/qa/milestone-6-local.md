# Version 6 candidate: actual Mars exit mission

Status: version 6 privately deployed and actual HTTPS gates passed; [deployment and archive receipt](milestone-6/deployment.json). This is not a commercial-game parity or complete original-specification claim.

The frozen candidate is `index-Dsi5FLrM.js`, `swingby-ui-8T9GdnQD.js`, `swingby.worker-C4kKUDc8.js`, and `transfer.worker-2o9Pvo6w.js`. [All source and output hashes](milestone-6/production-v6a.json) belong to the isolated candidate. The integrated main checkout reproduces all 60 output files byte for byte. Public text line-ending differences were aligned explicitly; JavaScript, CSS, fonts and binary assets already matched.

## Resulting play

M02B starts from a declared actual-epoch Mars approach. Dragging the fixed aim-plane target solves the earlier correction and the subsequent outbound path. A real attitude, fuel, power and CG/gimbal check determines whether the correction actually fires. The mission measures the outward crossing at the declared radius, heliocentric direction and energy, safe altitude, and unique spectra received on Earth. A skipped burn follows the uncorrected trajectory.

The same hardware builder supports actual placement changes, separate strict saves, undo and bus compatibility. The scenario-specific CG carrier is visibly attached to the selected engine. Its physical assumptions and credit cost are authored and identified as such. The UI never calls NASA flight validation or a heuristic score a real success probability.

New original bus surfaces preserve physical envelopes, bays and legacy geometry. Flight inspection shows the actual mounted craft and attitude. A collapsible 48px onboard-schedule summary gives the craft more vertical space; planning retains the editable timeline. Primary flight controls stay at the top of the review panel. The aim grid explicitly states 400km per cell. Stars, camera cropping and surface rotation are display choices, not forces or changed body positions.

## Completed evidence

| Gate | Observed result and scope |
|---|---|
| Frozen domain | [56 tests](swingby/focused-tests.json), TypeScript and 52 immutable historical whole checkpoints passed before integration; all 15 handed-off production file hashes remain exact. |
| Physical alternatives | [Eight genuine flights](swingby/flight-acceptance.json): baseline, lower/higher/economy and science craft; independent direction, energy and science failures. [Four numerical profiles](swingby/convergence.json) preserve packet/event identities and success. |
| GMAT | [24 control cases × 8 states](../m02-gmat-authoring-oracle.md), maximum local position difference about 0.4664m. Shared frozen ephemeris reconstruction is not an independent ephemeris or full-mission certification. |
| Focused integration | 44 rendering/camera/actual-Worker tests passed on the integrated UI source before the final presentation-only changes. The bus candidate separately passed 43 focused tests, with overlap in reused rendering tests; these counts are not summed as unique coverage. |
| Actual Chrome M02B | 13 distinct production cases passed across the initial batch and corrected-harness follow-ups: four builder focus/true-plane cases; one builder/slot/JSON case; eight flight, save and KO/EN × normal/large cases. Full mission used real pointer input and visible playback controls, fired the correction, received 12/3 spectra, scored 95, and strictly replayed the terminal save. No state injection or fake completion. |
| Earlier harness failures | Initial batch was 8 pass / 5 fail. Continue was incorrectly clicked behind a test-opened mission modal; four clipping checks treated the fixed-layout body’s zero-height box as its viewport. The corrected five-case run was 4 pass / 1 fail because it checked an old disabled Next element before the UI committed the paused Worker state. Waiting for the actual UI render commit passed the final English/large case three consecutive times. Product source and bundle did not change during these corrections. Failed traces/screenshots are retained. This is not a clean single 13-case run. |
| Save failures | Unreachable but valid drafts clear the prior accepted launch solution and survive Exit/Continue. A deliberately rejected real IndexedDB write retains the existing slot, offers an explicit unsaved exit, and still permits a coherent JSON backup. A real graphics pause during delayed save acknowledgement does not lose the backup; an older autosave completion cannot unlock Exit. |
| Existing missions | Four production regression cases passed in 2.5 minutes: all sixteen actual hardware drags; full remote-schedule repair→onboard install→Earth ACK→science receipt and replay; three M03 native context restores; three hardware-flight and three live-control-room restores. No app errors or invalid native resource deletion. |
| Edge | Two production cases passed in 1.1 minutes: actual pointer correction→full success→strict replay, plus invalid-draft/blocked-storage recovery. [491 saved values](milestone-6/chrome-edge-terminal.json), including plan, craft, numerical policy and terminal checkpoint, match the independently flown Chrome save exactly. Only serialization wall time is excluded. |

Production UI artifacts are under `tests/browser/artifacts/swingby/production-v6a*`, builder evidence under `swingby-builder/production-v6a` and `builder-focus-drag/production-v6a`. Existing-mission evidence is under `remote-operations/production-v6a-legacy`, `hardware-interaction/production-v6a-legacy` and `transfer-context-ownership/production-v6a`.

## Pending gates and retained limitations

The integrated full suite passed:58 files/409 tests,398.50seconds with two workers, including the original remote-operations convergence and all immutable historical checkpoints. The raw report is [unit-results.json](milestone-6/unit-results.json). Private deployment, deployed cold load and isolated performance measurements passed after that local run; see the distinct hosted evidence below. Actual failed Worker startup has an escape path in the UI, but this release's browser cases do not inject that failure and do not claim to verify it.

The initial epoch and correction time are fixed in this bounded encounter; it is not an arbitrary departure-window designer or a subsequent asteroid voyage. The original five-novice study, complete keyboard mounting, extended A/B redesign and articulated deployment remain separate work. A/B and physical hinges are being developed in isolated candidates and are not included in this bundle.


## Actual hosted version 6

Source `cac35ea369cc2a3bc3963cba20d92b3ff237c4a3` was privately deployed at2026-11-14T22:29:46.991676Z; owner-only access remains one user, zero external visitors/groups/editors. The first source push was rejected by the64MiB backend limit because five renamed raw traceZIPs bypassed a narrow ignore rule. Only their Git index entries were removed, local ZIPs and SHA manifests retained, and the unpublished commit amended. No application or dist change and no force push. [Packaging record](milestone-6/source-packaging.json).

- Actual private HTTPS assembly: expected frozen entry,16 catalogue cards, real3D draw calls, zero page/resource errors.
- Actual private HTTPS M02B: real mouse aim edit from the default direction miss to an accepted correction, actual launch/visible Next controls to3600s, recorded fired burn and0.0481846533kg propellant consumed. Expected frozen M02B Worker loaded and zero errors. This is a hosted correction smoke; local Chrome/Edge evidence above covers the full mission and strict replay.
- Cold20Mbps/100ms RTT/fresh cache: first assembly/font readiness6713.3067ms,11.8672142MiB essential encoded bytes, all seven declared gates passed. It is one measured run on the stated machine.
- Isolated1920×1080,medium,20 real components, two actual planet meshes,1160 path/orbit samples:120.0172seconds,7200frames,mean60.0008000FPS,p9917ms,max17.2ms,no >33.3ms frames,long tasks or errors.125geometries/10textures/18programs/126draws/122304triangles stayed constant. Recorded12orbit drags and12wheel events. This is a warm planning stress scene, with retained budget/power/instrument warnings, not a launched20-part spacecraft or active-flight benchmark.

Raw reports and screenshots: `tests/browser/artifacts/deployed-v6`, `deployed-v6-swingby`, `cold-load-deployed-v6`, `performance-standard-deployed-v6`. No credentials are in evidence files. Temporary in-memory access tokens were cleared after all browser processes exited. There is no commercial-game parity or full original-specification completion claim.
