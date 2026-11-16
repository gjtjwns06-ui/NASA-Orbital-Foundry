# Version 10 — route consequences

Base: private version9, source `0a7932fb212ce0ddfb08e2dbca82b4a184578882`. Version10 is now privately published at https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site from source `4c1a7829fb6c382755923ca5b30bf64925025f25`; native deployment succeeded2026-11-15 10:38:23 UTC. [Receipt](milestone-10/deployment.json). Local native evidence remains separate from hosted measurement. The original specification and remaining partial requirements are unchanged.

## M03 previous route and exact return

The player can drag a departure date and compare the prior feasible path against the changed route in the same heliocentric frame. The previous path is dashed gold. Actual forecasts supply arrival, time to Mars, C3, escape-stage propellant and fully received science. Each route retains its own receipt deadline. A physically solved but fuel-infeasible route and an unsolved route both retain a recoverable previous plan. Returning restores the exact submitted input, including operation definitions, then recomputes through the Worker.

The isolated candidate passed9 focused CPU tests and2 real Chrome cases in44.173s. Its first native batch failed two harness assertions; those files and shader/PMREM warnings are retained. Korean720p and English large1080p screenshots were reviewed: the comparison and return action are readable, with original/changed values distinguished by both labels and line style. The source review found no blocking state-machine or restore issue. [Full candidate evidence](nav05-acceptance.md), [explicit allowlist](nav05-transfer-manifest.json).

The actual +2-day pointer change shortened flight from260 to258days while raising C3 from10.88 to11.3182036km²/s² and using additional stage propellant. A subsequent +43-day drag solved a route but left a negative22.9466195kg stage margin. Return restored the prior258-day plan, full solution/evaluation/forecast,17.9781225kg margin and3 received spectra. These are deterministic game-model outcomes, not certified flight plans.

## Integration on version9

Only four production files and their explicit proof files were imported from the older candidate. The three pre-existing files were unchanged between its v8base and v9 before import. No old dependency, Worker, runtime, README or unrelated asset was copied.

TypeScript/Vite build passed (178modules), with the existing large-chunk warning retained. Production entry is `index-CPekGVYp.js`, transfer UI `transfer-ui-BdEWkTo2.js`; all six physical Worker bundles retain their version9 names/hashes. Five focused CPU files passed48tests: comparison, transfer planning, encounter guide, translations and new Earth ellipse. This does not claim a fresh full-suite result.

Integrated native Edge157 acceptance passed2/2cases in40.508s, covering Korean1280×720 and English large1920×1080 actual route drag, fuel-infeasible/unsolved retention, exact restore, pointer cancellation, native graphics recovery, real JSON import and launch/exit. All305 source/public/dist/harness identities were exact before and after. Both cases had zero application/native ownership errors;3and5 shader/PMREM warnings are retained. [Raw report](milestone-10/edge-r1-report.json), [decision](milestone-10/edge-r1-decision.json), [native evidence](../../tests/browser/artifacts/nav05/v10-integrated-edge-r1/). No v10FPS or hosted measurement is claimed.

## Remaining scope

NAV05 remains partial: explicit observation opportunity, contact and eclipse differences are still absent. One planning anchor is not a general undo history or an in-flight correction. Two replay optimizations were rejected for failing to demonstrate useful speedup; their unchanged-result evidence and failed timing gates remain in the separate replay worktree. The accepted replay implementation is unchanged. Spatial obstruction labels remain a separate future candidate. Commercial-game parity and external novice testing are not established.


Main rebuild passed and all compiled JS/CSS/image/Wasm outputs match the integrated candidate. Six public text files differ only in Git checkout CRLF versus canonical LF: three swingby JSON references and the Basis loader/LICENSE/README. Main retains the exact published-v9 bytes for all six, verified against the v9 rebuild manifest. The initial three-JSON-only verifier stopped at LICENSE; that assumption was corrected after inspecting every difference. No product file was altered to make this comparison pass. [Per-file proof](milestone-10/rebuilt-dist.json).
