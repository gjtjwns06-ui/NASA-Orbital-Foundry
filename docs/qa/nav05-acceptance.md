# NAV05 — previous route and computed consequences

Accepted bounded source: `codex/nav05-comparison` in `orbital-foundry-next-nav05`, based on accepted-v8 production commit `e0853fe`. Production ownership is exactly four files: `src/transfer-ui.ts`, `src/transfer-ui.css`, `src/render/transfer-scene.ts`, and `src/transfer-plan-comparison.ts`.

The M03 planning screen retains one previous complete, launchable forecast for the same spacecraft. Its gold dashed path uses the existing heliocentric trajectory calculation and appears only in solar planning view. The changed route remains the current solution. The comparison shows actual arrival, time to Mars, C3, escape-stage fuel used, and science fully received. Each route retains its own computed Mars-exit receipt deadline. Pending, unsolved, unlaunchable, and early-termination outcomes cannot replace the retained valid plan. A full-duration zero-science result remains a valid comparison even when the result label is `failed`.

Return to previous plan restores the exact submitted input, including operations later clipped out of `solution.plan`, and recalculates through the existing Worker. It does not install a cached forecast or runtime. Comparison state is session-local; successful import, craft/preset changes and live launch clear it. The M03B remote-operations lesson is excluded. Cumulative eclipse/contact durations are not invented; their absence is documented in the existing model-info details.

No physics, Worker, ephemeris, numeric acceptance gate, external API, package, asset, or unrelated production source changed. The final build retains `transfer.worker-2o9Pvo6w.js`. A v9-based integration must rebuild and obtain its own consuming-build evidence; these results do not claim its bundle identity or FPS.

## Verification and preserved attempts

- `nav05-source-r1`: nine focused pure-state fixture tests passed. The first build failed on two optional dataset-key TypeScript errors in the new browser harness; that log remains preserved.
- `nav05-source-r2`: corrected build passed. Review then added the already-computed time-of-flight row and nullable display handling.
- `nav05-source-r3`: final TypeScript/Vite build passed. Entry `index-B8tCL2J4.js`; UI chunks `transfer-ui-CLHkC6CJ.js` and `transfer-ui-ZXtxuJae.css`. `git diff --check` passed. A later harness-only TypeScript check passed.
- `nav05-native-r1`: 0/2 passed, 95.006 seconds; all 285 before/after identities unchanged. Real route changes and context recovery worked, but the harness tried to click a pointer-transparent heading and assumed an existing canonicalizing import would retain obsolete legacy craft fields. Full failed reports, screenshots, error contexts and exact rejected harness are retained.
- `nav05-native-r2`: **2/2 passed, 44.173 seconds**, actual Chrome 157.0.8103.52. All 285 before/after identities unchanged. Product bytes are identical to native-r1; only the two harness assumptions changed. The corrected import check still requires exact plan/solution/evaluation/forecast equality and exact exported canonical craft content.

Native scopes are KO/normal at 1280×720 and EN/large at 1920×1080. Both used real UI entry, actual date-handle mouse drags, the existing Worker, native context operations and real file export/import. No successful runtime or preview was injected. Both recorded zero application errors and zero native deletion-audit errors. Shader precision and PMREM sampling warnings remain in raw reports; this is not a zero-warning claim.

The native journey demonstrated:

| Plan | Time to Mars | C3 (km²/s²) | Stage fuel used / margin | Received spectra |
| --- | ---: | ---: | ---: | ---: |
| Initial | 260 d | 10.8828167704 | 221.410040 / 18.589960 kg | 3 |
| Real +2-day departure drag | 258 d | 11.3182035999 | 222.021878 / 17.978122 kg | 3 |
| Further real +43-day drag | 215 d | 51.1564692797 | 262.946620 / −22.946620 kg | Unlaunchable; no completed-flight comparison |
| One-click return after blocked and unsolved inputs | 258 d | 11.3182035999 | 222.021878 / 17.978122 kg | 3 |

The restored craft, submitted plan, solution, stage evaluation and full forecast equal the previous valid candidate exactly. The native lifecycle case also checks Escape cancellation leaves accepted input and comparison unchanged; local view hides the prior path; native context recovery retains the same objects, geometries, materials, attributes and arrays; validated import resets comparison; and real launch/exit removes its planning resources without native ownership errors.

The nine pure-state cases separately cover stale solved/preview pairs, exact original operations, detached ownership, pending/invalid retention including failed restoration, full-duration zero science versus early termination, escape-stage rather than spacecraft fuel, per-route deadlines, craft/reset boundaries, missing facts and duplicate terminal responses. These are labeled fixtures, not additional observed physical mission runs.

## Delivery

Use the file-by-file `nav05-transfer-manifest.json` allowlist. It includes only these four production files and this task's focused tests, source receipt tool, new acceptance note, and raw evidence. Do not transfer the old worktree README, unrelated docs, assets, dependencies or `dist`.

Key screenshots are under `tests/browser/artifacts/nav05/nav05-native-r2/`: `ko-normal-1280-changed.png`, `ko-normal-1280-fuel-blocked.png`, `ko-normal-1280-infeasible.png`, `ko-normal-1280-restored.png`, and `en-large-1920-context-restored.png`. Raw exact values are in `native-route-return.json`; resource/lifecycle observations are in `native-lifecycle.json`. This is a narrow gameplay-feedback acceptance, not full undo history, all cancellation/timeout handling, a new asteroid mission, commercial-game parity, or an FPS measurement.
