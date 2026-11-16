# Surface finish candidate handoff

This isolated candidate makes the accepted First Light spacecraft's insulation read as folded foil and its service bay/frame read as cooler aluminum. Four original 256 x 256 procedural maps add shading detail to the existing foil, ivory and frame material slots. Gold RF patches, PCB, photovoltaic cells and dark materials retain their accepted appearance. No mesh, UV, light, shadow setting, physical envelope, camera or flight calculation changes.

## Integration

Transfer only the four production files enumerated in `surface-finish-transfer-manifest.json`, or apply `surface-finish-production.diff` to the accepted Earth-detail base. The diff is against `orbital-foundry-next-earth-detail`, not arbitrary current main. If root has subsequent changes in scene/options/view, merge only the surface ownership and style hooks. Main v8 and the accepted Earth-detail candidate were not edited. A complete src/public byte comparison found exactly these four differences and no missing files.

The candidate defaults to `flat`. After visual acceptance, root can pass `surfaceFinish: 'textured'` when the actual First Light UI creates `DeploymentScene`. Keeping the optional global default flat avoids silently changing unrelated consumers. The public `setSurfaceFinish` method exists for matched appearance comparisons; it is not a user-facing control or a physics mutator. Reuse the style on source replacement; each new view owns fresh maps.

## Evidence

- `docs/qa/surface-v1/report.json`: native PASS, 116.710 seconds. Source hashes frozen before and after the browser run.
- `docs/qa/surface-v1/actual-ui-flat.png` and `actual-ui-textured.png`: same real terminal replay, working-face camera and runtime state. The style setter alone changes the appearance.
- `1280-working-faces-*` and `1920-working-faces-*`: matched craft closeups. Four states T0/T240/T600/T1385 are captured at both resolutions.
- Final `surface-finish-unit-r2.json`: 7/7 CPU tests. `surface-finish-unit-r1-failed.json` deliberately preserves the earlier repeated-run timeout from an excessively expensive per-pixel assertion loop. The corrected test computes the same every-pixel maxima/ranges before asserting with unchanged thresholds. `surface-finish-unit-results.json` is an older failed report and is not the final proof.
- `npm.cmd exec -- tsc --noEmit` and `node --check tools/check-surface-finish.mjs`: exit 0 after the nullable-data/test typing corrections.

The native batch passed exact physical and camera equality for every pair, real right-drag/wheel controls, three component native context restores including cached maps while flat, fresh-map ownership on source replacement, actual terminal replay, an additional actual-UI restore and final exit. Native ownership/application/resource error arrays are empty. A single browser warning entry contains D3D X4122 precision and X4008 division-by-zero compiler warnings; it is preserved without claiming a zero-warning result or proven baseline attribution. The dev server also printed existing public-JSON import diagnostics. All owned browser/server processes closed and the GPU lease was released.

## Budget and limits

Four maps occupy 1,048,576 CPU image bytes and an estimated 1,398,096 GPU bytes with full uncompressed mip chains, excluding driver overhead. Actual-UI calls/triangles/geometries stayed 111 / 93,284 / 83. Textures changed 8 to 12; programs 12 to 13. The same maps are cached through style toggles; inactive maps participate in context retirement; source replacement and final disposal release the view-owned textures.

No isolated performance or full game regression claim is made. CPU work was allowed during the browser batch. The surface recipe is original authored art, not measured physical coating data. It improves the existing craft, but does not change its limited box/component silhouette or establish parity with a commercial game. Integrated review, performance, existing game checks and publication remain root work. The Earth-detail handoff remains frozen.
