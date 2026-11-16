# Retained-trail component evidence

Start with `retained-trail-handoff.md`. The isolated accepted product sources are retained as text under `accepted-source`; the production diff and SHA manifest identify them exactly. Raw reports and images are copied byte-for-byte. `adaptation-receipt.json` records the transfer and every portable harness path change.

CPU evidence is 8/8 passed plus a TypeScript exit-0 receipt. Browser v1 completed its component gates, including all four matched before/after views, exact physical/camera state, growth, null reset and three native context restores. Its overall failure is deliberately retained: the later actual-UI harness waited for idle after an intentionally auto-playing launch. Browser v2 is the corrected **actual-UI-only closure**, not a full rerun. The original failure must not be described as an overall pass. `trail-visual-comparison.json` confirms exact scene pixels below the deliberately different harness header for all four matched pairs.

The portable baseline renderer lives exclusively under `tools/qa/retained-trail`. Its renderer imports are redirected to main `src`; it is not a product module and is not imported by the application. The raw baseline remains unchanged in this proof folder. Native deletion-audit helper is byte-identical. New runs write only timestamped `reruns` folders; accepted evidence is never overwritten.

Run CPU checks from the main repository root:

```powershell
npx.cmd vitest run --config tools/qa/retained-trail/vitest.config.ts
```

Only after obtaining the GPU slot, run the portable native Chrome component and actual-UI harness (it owns strict Vite port 5186 and closes its own browser/server):

```powershell
node tools/qa/retained-trail/check-trail.mjs
```

For the corrected actual-UI scope alone, set `TRAIL_SCOPE=actual` before running. The portable paths have been adapted, but browser/CPU tests were not rerun during this proof-only transfer. Root's production integration, Edge regression, and declared successor 120-second performance test remain separate evidence. No performance thresholds were changed by this package.
