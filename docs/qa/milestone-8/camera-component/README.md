# Camera component evidence

The raw accepted camera source identities, replay proof, 20 screenshots and retained failures were copied byte-for-byte from the isolated candidate. `adaptation-receipt.json` records every copied file hash and the limited import/path changes made to portable harnesses. It also verifies that this transfer did not change production source bytes. The original `orbital-camera-proof.md` and `orbital-camera-manifest.json` are preserved raw and therefore retain their original candidate-relative paths.

Run from the complete main project with its locked dependencies:

```text
npx vitest run --config tools/qa/orbital-camera/vitest.config.ts
node tools/qa/orbital-camera/build-camera-fixture.mjs
node tools/qa/orbital-camera/check-orbital-camera.mjs
```

The browser scripts require a free port5186 and the native Windows Chrome executable named in the script. The measured engine is Chrome157.0.8103.52; record the new engine identity when changing it. The generator recomputes actual authored repair inputs and rejects terminal checkpoint mismatches. It writes only under `runtime`, preserving the original input/fixture/report. The checker writes a new timestamped directory under `reruns`. Its local native audit is byte-identical to the audit used for the accepted pass.

The accepted raw pass is `orbital-camera-v3/report.json`, not a measurement of the later integrated main bundle. Main integration also adds the separate internal-art candidate. Current reruns compare the same current art with follow disabled/enabled, while retaining exact physical inputs. Full product/bundle acceptance is recorded separately by root QA.

The camera preserves the default limb and user orbit/zoom; it does not resolve the visibly soft4K Earth surface. Node-to-Chrome exact angular checkpoint interoperability remains uncertified. See the preserved handoff and rejected-node report; no physics/tolerance changes were made to conceal it.

The sibling `../internal-art-component` contains the accepted18 image art comparison, five-test result, exact handoff and rejected material-budget/harness evidence. Its baseline/test source is retained as text for audit, not installed as active production code.
