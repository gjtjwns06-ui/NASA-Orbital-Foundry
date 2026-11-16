# 9B: recovery followed by rebuilding and exit

The earlier 8C recovery checks verified restored pixels and continued simulation, but did not exhaustively rebuild or destroy every retained resource after restoration. The 9A remote-Mars trace exposed that missing lifecycle step: functional gameplay passed while the browser reported 256 `INVALID_OPERATION` ownership warnings among 262 warnings before console saturation.

The independent native probe localized the first fault to **leaving spacecraft inspection after a real context restore**. Four buffer deletes and one vertex-array delete used handles created by generation 0 of the transfer renderer against generation 1. This was an expired generation of the same canvas context, not an accidental transfer-to-primary object transfer. The trace stack was `deleteBuffer → WebGLAttributes.remove → geometry.dispose → TransferScene.clearGroup → rebuildPaths → setCraftInspection`. Exact pre-fix sources are retained under `tests/browser/artifacts/mars-context-lifetime/before-9a/` as `.ts.txt` files; trace/native evidence remains under the independent remote-operations 9A artifact directories.

## Cause and bounded fix

Installed Three 0.182 `WebGLGeometries` and `WebGLTextures` register resource-dispose listeners which close over each context generation's GPU caches. `WebGLRenderer.onContextRestore` initializes fresh caches. Retaining the CPU geometry/texture without retiring its previous registration leaves an old listener able to delete expired handles during a later ordinary rebuild or disposal.

`src/render/context-resources.ts` now retires geometry, material and ordinary texture **GPU registrations during `webglcontextlost`**, before Three replaces those caches. CPU arrays/images, mesh/material/texture identities, scene children, application state and ownership remain intact. Resources are deduplicated per traversal. New renders register/upload the retained data in the new generation. A retained texture can therefore emit one dispose event per retired context generation plus its final ownership-release event; these are different lifecycle events, not duplicate deletion of one live handle.

The transfer renderer includes inactive baseline/detail maps and the reusable command-marker pool. The primary renderer includes both planet maps, postprocessing passes and their render targets; the installed SSAO pass's otherwise omitted material/noise texture are handled explicitly. The control room has a separate scene but uses the **same primary renderer and canvas**, so it retires its own scene resources. Ordinary maps and geometries are separated from framebuffer/depth attachments. Existing explicit owners still retire PMREM, monitor and shadow targets; the room never disposes its borrowed primary environment target.

## Evidence on production candidate 9B

Frozen entry `index-TfmOhXw5.js`, shared `index-hgc1M-PQ.js`, transfer UI `transfer-ui-jysXN1a1.js`; Chrome **157.0.8103.52**, 1280 × 720.

- **37 focused CPU tests passed**: five new registration-retirement tests plus the previous texture-cache, craft-camera and signal suites. TypeScript passed.
- `transfer-context-ownership.spec.ts`: **2/2 passed in 23.8 s**, covering three real M03 Earth restores, three primary hardware-flight restores and three live-room restores. The second case then uses the visible room-exit, resume/pause, Finish → Redesign, bus replacement, Ctrl+Z and planning flows. Native deletion errors: **0**. Ownership warnings: **0**. Page/console errors: **0**.
- The separate independent remote-operations case passed three **loaded 4K Mars** restore → inspection exit/path rebuild → inspection re-entry cycles, followed by causal operations, replay and actual application exit. It retained one detail request, with zero native deletion errors. This was a separate run, not part of the two-case suite above.

Own raw reports: [M03 recovery](../tests/browser/artifacts/transfer-context-ownership/after-9b-rebuild/report.json), [primary/room and post-restore rebuild](../tests/browser/artifacts/transfer-context-ownership/after-9b-rebuild/primary-room-report.json). Across the three samples per view, renderer counters remained M03 **108 geometries / 7 textures / 13 programs**, primary flight **54 / 15 / 21**, and room **80 / 13 / 20**. These are resource counts, not byte measurements or a performance benchmark.

[Recovered control room](../tests/browser/artifacts/transfer-context-ownership/after-9b-rebuild/control-room-restored-three-times.png) and [post-restore bus replacement/undo and planning](../tests/browser/artifacts/transfer-context-ownership/after-9b-rebuild/post-restore-room-exit-design-rebuild.png) were visually inspected: the room geometry, live monitor and lighting remained visible, and the later Earth view retained its maps and navigation geometry. The paused-recovery toast in the room screenshot is intentional. Nine pre-existing shader/PMREM diagnostic warnings remained in the M03 recovery case; the primary/room case had no warnings. Neither diagnostic warnings nor native ownership failures were silently filtered into an all-warning-free claim.

This closes the demonstrated recovery → rebuild → exit defect. It does not certify every browser/driver, prove commercial visual parity, or replace the separately coordinated high-quality 4K performance measurement.
