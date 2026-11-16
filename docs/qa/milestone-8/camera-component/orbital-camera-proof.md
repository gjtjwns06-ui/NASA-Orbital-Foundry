# Reproduce the bounded camera proof

Use the complete Orbital Foundry project and its locked dependencies. Overlay the three production files identified by `orbital-camera-manifest.json`, the test below, and the listed tools/docs at their existing relative paths. Production asset files under `public/assets` are required; the proof is not a standalone game package.

The measured environment was Windows, Node 24.14.0, native Chrome 157.0.8103.52, Three r182. The CLI scripts use the installed Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; update that executable path explicitly for another machine and record the new engine identity. Exact floating-point checkpoint interoperability with Node is not certified.

1. Run `npx vitest run tests/orbital-inspection-follow.test.ts` and `npx tsc --noEmit`.
2. Keep port5186 free and run `node tools/build-camera-fixture.mjs`. This recomputes original authored inputs in native Chrome and rejects any terminal checkpoint mismatch. It writes `docs/qa/camera-replay-fixture.json`.
3. Run `node tools/check-orbital-camera.mjs`. It uses one browser sequentially, starts/stops its own Vite5186, and retains screenshots/errors/warnings in `docs/qa/orbital-camera-v3`. Copy the existing evidence first or change the output folder before rerunning.

Portable proof files: `tests/orbital-inspection-follow.test.ts`; `tools/build-camera-fixture.mjs`, `tools/build-camera-fixture.ts`, `tools/fixture.html`, `tools/check-orbital-camera.mjs`, `tools/orbital-camera.html`, `tools/orbital-camera.ts`, `tools/native-gl-audit.ts`; `docs/actual-camera-input.json`; `docs/qa/camera-replay-fixture.json`. The local native audit is a byte-identical copy of the audit used during accepted v3. Only the import path changed after that run to remove a sibling-worktree dependency; the measured product source and raw v3 evidence are unchanged.

Retain `docs/camera-unit-results.json`, `docs/qa/camera-fixture-browser-result.json`, the complete `docs/qa/orbital-camera-v3` directory, `docs/orbital-camera-handoff.md`, and rejected evidence named in that handoff for the audit trail. The Node fixture generator was moved to `docs/rejected-node-fixture-generator.ts.txt` so a known cross-engine rejection is not silently included as an active test.
