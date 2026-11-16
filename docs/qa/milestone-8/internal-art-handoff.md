# Deployment internal art handoff

Accepted as a bounded component improvement, 2026-11-15. Production integration consists only of these two files:

| File | SHA256 |
| --- | --- |
| `src/render/deployment-internal-art.ts` | `871e1fd9f910db321a84d5327e867fa5550f66de649472f8eb8454f54c564622` |
| `src/render/deployment-link-meshes.ts` | `51db499646e104023466013a4fbdae736b0995d46dff516385309c4613ccb6e1` |

Battery enclosures, shielded RF boards, orthogonal ADCS wheel housings, recorder banks and mechanism drivers now have distinct original geometry. These educational shapes stay inside each supplied physical box. They are not manufacturer CAD or a new mass/collision/electrical model. External bus, solar, RF and support geometry/material signatures are unchanged. Topology, mass, FK, picking identity, native geometry/material ownership and disposal are preserved. There are no added textures or downloads.

`tests/deployment-internal-art.test.ts`: five tests pass, recorded in `docs/internal-art-unit-results.json`. TypeScript checking passes. The CPU gate checks rotated authoritative envelopes, unchanged external signatures, at most four batches per default internal link, at most 6,000 extra triangles, immutable physics and instance-owned idempotent disposal.

`docs/qa/internal-art-v4/report.json`: corrected browser component comparison passes in 14,520 ms using native Chrome 157.0.8103.52. Eighteen screenshots compare exact matching camera and physical inputs: whole/open bay at 1280x720 and 1920x1080, plus five focused before/after pairs at 1280x720. All eighteen were visually inspected. Three real context loss/restore cycles and final disposal pass the native ownership audit. Application, HTTP and native audit errors: zero. Five retained Three shader compiler warning logs remain in the report; no claim that the run is warning-free.

At the whole-craft view, measured renderer totals change from 149 to 139 calls, 203,764 to 204,468 triangles, 82 to 77 geometries, with four textures and four programs unchanged. These totals include the scene, shadows and two render passes; they are not standalone craft counts or an FPS benchmark.

The focused internal components are more legible. Open-bay detail remains small at 720p, and the closed hull intentionally looks unchanged. Broad triangular shadows visible around the RF module are also present in the exact baseline `1280-before-radio.png`; this existing hull/support shadow limitation is retained, not retouched or hidden. This pass does not establish whole-product graphical parity or replace end-to-end UI/performance testing.

Preserved failures: `docs/rejected-material-budget-v1.json` records the initial RF five-batch overrun, corrected by reusing the existing ivory material. `docs/qa/internal-art-v2` retains the favicon 404 and insufficient part-mount fixture; `v3` retains the missing allowed mount-plane rejection. Correcting those QA fixtures did not alter production art. The accepted v4 fixture supplies complete actual mount metadata and a data favicon.

QA-only `deployment-link-meshes-baseline.ts`, `tools/baseline-scene.ts`, `tools/baseline-view.ts` and harness files must not be integrated as product code. Camera work is a separate candidate. All owned browsers and Vite5186 closed before GPU handoff to resilience QA.
