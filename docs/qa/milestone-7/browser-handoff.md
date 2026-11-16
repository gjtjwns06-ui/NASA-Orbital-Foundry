# Independent detached-review acceptance

This is a separate QA workspace. Product ownership remains with the root agent. The production engine and review adapter are not edited by these tests.

## Harness

- `tests/review-journey.spec.ts`: real weak-XACT15 A flight → recorded rejection/ADCS cutaway focus → exact-source fork → real mouse replacement with XACT50 → real B flight → controlled comparison → save/reload/JSON. No imported checkpoint substitutes for either flight.
- `tests/review-layout.spec.ts`: four language/scale combinations at1280×720, genuine browser-generated short replay fixtures, play-from-end, common cursor, corrupt import rejection, partial-time comparison guard and one actual graphics restoration. A separate case delays one genuine completed archive response and checks cancellation/registration recovery without inventing messages.
- `tests/review-storage.spec.ts`: actual short UI flights with only the review Worker's IndexedDB open denied. Exact authoritative A source bytes survive the explicit in-memory fork and B capture. No engine mutation.
- `tests/unit/review-client.test.ts`: five transport-only cases; synthetic transport is explicitly not physics evidence.
- `tests/helpers.ts`, `tests/native-gl-audit.ts`: read-only observations/projections and strict native GPU ownership checks.

Run from this directory. `PLAYWRIGHT_BASE_URL` chooses the frozen site; `PLAYWRIGHT_BROWSER=edge` chooses Edge; `PLAYWRIGHT_QA_CANDIDATE` creates a separate evidence directory. `PLAYWRIGHT_PRODUCT_ROOT` optionally points to the exact corresponding source checkout; default is sibling `orbital-foundry-next-swingby-ui`. Its source bundle is used for fixture generation and pointer coordinates, not to advance the actual journey.

## Accepted development evidence

Seven distinct UI cases passed across the recorded snapshots, plus five transport units and the independent harness TypeScript check:

| Evidence | Result and precise scope |
|---|---|
| `artifacts/review-fast-v2` | KO normal partial-fixture layout/replay/context case passed. |
| `artifacts/review-fast-v3` | Other three language/scale cases passed. |
| `artifacts/review-label-v4` | EN large repeated for explicit interim labels and negative-delta styling. |
| `artifacts/review-actual-v1` | Complete genuine A/B browser journey passed in233.94s. A: partial75,5received, BURN_ATTITUDE rejection. B: success95,12received, actual correction fired and exit objective passed. |
| `artifacts/review-faults-v1` | Genuine delayed-response/committed-import race passed. The first storage fault harness failed initialization; see rejected evidence below. |
| `artifacts/review-storage-v3` | Corrected storage-denied case passed in9.2s with A source bytes exactly preserved. |

Observed functional timings, **not isolated benchmarks**: A flight48.23s, initial A strict pin38.76s, B flight29.20s, B review32.78s, cold archive strict replay67.56s. The long first verification remains a real UX cost. Warm cache correctness is independently established by the domain handoff; this UI run does not claim instant first load.

The complete journey has zero application errors and zero native graphics ownership errors. Captured nonfatal Three shader precision/division compile warnings and PMREM sigma0.08 clipping warnings are retained; it is not a zero-all-warnings claim. Key screenshots, exact browser sources, physical A/B results, exported pair bytes, comparison and per-file source hashes are in the artifact directory.

## Rejected attempts and limitations

- `review-fast-v1`: exact Node24.14.0→Chrome157.0.8103.52 replay rejected a genuine5,000s source with14 tiny numeric differences. No checkpoint tolerance was relaxed. Maximum observed difference was3.49e-10km in altitude,2.22e-11degrees pointing,~1.1e-12m/s requested impulse. This is a scientific save portability limitation: arbitrary JavaScript-runtime compatibility is not established. Source/diff/report/failure screenshot remain; the transient first trace was overwritten before per-candidate trace directories were configured.
- `review-faults-v1` storage attempt: async fault-wrapper import lost the first queued request. A synchronous storage-only prelude replaces that harness; rejected report/screenshot/trace remain.
- `review-storage-v2`: the harness compared the fork to the raw UI factory draft rather than the normalized authoritative engine save. Corrected checks require exact saved craft/plan/numerics and also match runtime.craft. Rejected report/screenshot/trace remain.

## Frozen production verification

Production candidate7 at `http://127.0.0.1:5181` has entry `index-BbLlOPi5.js`, review UI `review-ui-Cdx6R-nJ.js`, review Worker `review.worker-bic3fHDF.js` and swingby UI `swingby-ui-DL44FxM4.js`. M02 Worker remains `C4kKUDc8`; M03 Worker remains `2o9Pvo6w`.

Chrome157.0.8103.52 targeted EN-large final-label/import-confirmation and genuine delayed-response race passed2/2 in31.8s (`artifacts/review-production7-chrome`). Edge157.0.4341.46 genuine full A→B journey passed in276.03s (`artifacts/review-production7-edge`), including both actual flights, strict reviews, diagnostic focus, real mouse redesign, archive save/reload and JSON reimport. The final1280×720 screenshot was visually reviewed. Application/native errors are zero;14 nonfatal warnings are retained. Edge observed first pin47.70s and cold replay84.97s are functional timings under concurrent CPU work, not performance benchmarks.

`artifacts/chrome-edge-actual-flight-comparison.json` compares the two independent actual pointer-built journeys. All268 semantic input leaves,535 physical checkpoint leaves and517 result leaves match exactly; no tolerance is used. Cosmetic names/generated IDs and UI pending requestedTime are explicitly excluded, while active radio identity is retained by physical signature. This compares Chrome development versus Edge production on the same pinned engine, not identical whole-app bundles. It does not erase the rejected Node→browser portability case.

Existing M03 remote-operations preservation passed on the same frozen candidate in1.5min: genuine pointer repair, finite command/ACK transport, actual received science, strict version2 replay, three loaded Mars4K restores and application Exit, with zero application/native errors. Evidence is in sibling `orbital-foundry-next-swingby-ui/tests/browser/artifacts/remote-operations/review-production7-preservation`.

Builder preservation passed13.6s after correcting a demonstrated test completion race, without product changes. The initial assertion accepted `pending=false` before asynchronous IndexedDB Load had reached `restore()`; its retained failure screenshot already shows the correctly loaded six-part spacecraft. The corrected test requires exact balanced design persistence before departure and a new accepted revision after final Load. Raw legacy-slot bytes remain identical through M02B editing/import/reload; revision0→1 is accepted and all six parts restore. Actual CG/gimbal change, undo, hardware gate, separate Swingby JSON and campus Continue also pass. Accepted evidence is in sibling `tests/browser/artifacts/swingby-builder/review-production7-builder-closure`; the first rejected assertion remains under `review-production7-preservation`.

All browser processes were closed after these checks. No commercial-game parity or entire original specification completion is claimed.

## Portable repository integration

Copy only `integration/tests/browser/review/{helpers.ts,review-journey.spec.ts,review-layout.spec.ts,review-storage.spec.ts}` into the repository's corresponding path. `integration/manifest.json` pins these four files. The patched helper resolves PRODUCT_ROOT from repository cwd (or explicit `PLAYWRIGHT_PRODUCT_ROOT`), imports the existing `../native-gl-audit`, and writes to `tests/browser/artifacts/review/<candidate>`. The existing Playwright configuration recursively discovers them; no new package or duplicated legacy/engine source is needed. Supply a candidate-specific CLI `--output` directory to preserve failure traces. Root already has the five ReviewClient unit cases; do not duplicate them.
