# Working-face camera proof package

Read `working-faces-handoff.md` for the bounded feature, deterministic rule, exact source identities, and limitations. The `qa/working-faces-v3` report and 15 images are accepted native Chrome component/API evidence. `v1` and `v2` retain the rejected integration and harness runs. The actual UI images contain an explicitly labeled QA host button; the final product button is covered separately by root production QA.

Raw reports, screenshots, fixtures, test/typecheck receipts and tool copies are transferred byte-for-byte. `adaptation-receipt.json` records hashes and every portable-path adaptation. No product source, asset, distribution, or browser-test file is changed by this package. The accepted report's original source keys and native identities are retained.

From the main repository root, CPU-only reproduction is:

```powershell
npx.cmd vitest run --config tools/qa/working-faces/vitest.config.ts
```

The portable browser harness requires the GPU slot and native Chrome at the recorded Windows path. It starts and closes its own strict Vite 5186 server and browser; do not run concurrently with other graphics QA:

```powershell
node tools/qa/working-faces/check-working-faces.mjs
```

New browser results go to timestamped `reruns`, never the accepted raw v3 folder. The portable harness preserves the explicit QA API host button and all assertions. It has path-only adaptation and has not been rerun as part of transfer; root's integrated production QA is distinct. The CPU fixture is the native-Chrome-generated actual replay; no Node interoperability claim follows from reading that fixture.

The Earth remains the existing 4K texture. Camera visibility improves; close terrain softness, known compiler warnings, and the need for final product UI/production acceptance remain explicit.
