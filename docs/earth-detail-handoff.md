# NASA Earth close-view detail handoff

The optional 16K July 2004 Blue Marble map makes actual terrain features visibly clearer in the real FirstLight completion screen. The same physical flight state, camera, globe radius, rotation, sunlight and spacecraft are preserved. The 8K fallback offers an intermediate improvement. This is a texture fidelity change, not a new terrain simulation or commercial-game parity claim.

Integrate only the **11 exact files** in `earth-detail-transfer-manifest.json`: three renderer sources, one CPU test, two KTX2 assets, four Basis runtime/license files, and one source-provenance JSON. `earth-detail-production.diff` is against accepted commit `b0c0c5cc07c8e0f7f77e06fb1eef86c99a274586`. Do not merge the whole staging tree. Accepted trail, internal-art, link-mesh, orbital-follow, working-face and existing lazy-texture helper contents are preserved and checked in the manifest.

## Data and rights

Source: [NASA Blue Marble Next Generation July base map](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/), 21600×10800, 21,125,326 bytes, SHA-256 `dea8b4dc8a4f93f5f8bce0c8c85a508a178e7901e9ed8e6bf86e6ce7ef6d61e2`. Credit **NASA Earth Observatory / Reto Stöckli**. This historical monthly composite is not live weather. NASA notes residual cloud/snow ambiguity and simplified deep-ocean colour in the [dataset limitations](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/). Use follows [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) with attribution and no implied endorsement; it is not relabelled CC0.

`tools/prepare-earth-detail.py` reproduces the derivative: Pillow LANCZOS downsample, opaque RGB, Khronos toktx 4.4.2 ETC1S at qlevel255/clevel1, sRGB, full mip chain, lower-left storage. No sharpening, recolouring, generated noise, inpainting, elevation, or invented geography was added. `public/data/earth-surface-detail.json` records original/derivative hashes, encoder hash, exact commands, versions and bytes. The original JPEG and PNG intermediates remain in isolated `research/source`; the downloaded encoder was extracted locally, not installed. Neither the encoder nor intermediate PNGs are runtime files.

CPU geographic correlation against the existing 4K map is **0.999022** without a geographic flip/longitude shift; mirrored/half-turn alternatives are worse. Both KTX containers carry `KTXorientation=ru`, matching baked lower-left rows with compressed `flipY=false`. Native matched imagery independently verifies alignment. Two optional `ktx extract` CPU decode attempts failed for rgb8/rgba8; this tooling limitation is retained in `earth-validation-receipts.json`. It does not replace the successful official container validation or the actual Three/Basis native BC7 decode. No CPU-extracted decoded-image claim is made.

Basis JS/WASM are copied byte-for-byte from the installed Three 0.182.0 package; their upstream Apache-2.0 license and README are included.

## Runtime contract and costs

Only current actual **craft view + high quality + visible/live renderer + native compressed-format support** qualifies. Maximum texture size must be at least8192; supported16384 selects16K. `earthDetailMaximumSize:8192` caps detail at8K, and `0` disables it. Workshop, medium/low and planet overview keep the original4K map without KTX2/Basis requests. The KTX2 loader module is dynamically imported after the detail asset request; a single temporary transcoder worker is disposed after completion. One selected map is cached per renderer, with no simultaneous8K+16K cache.

The baseline remains active while loading, for unsupported capabilities, and after any failure. A failed request is not retried each frame. Switching quality/view restores the baseline while retaining the one cached detail map. Existing context retirement includes cached inactive detail textures; restoration reuses the compressed CPU data, and final/late disposal releases owned resources.

| Item | 8K | 16K |
| --- | ---: | ---: |
| Downloaded KTX2 bytes | 2,682,779 | 10,062,327 |
| Native Chrome format | BC7 / `RGBA_BPTC_Format`36492 | BC7 / `RGBA_BPTC_Format`36492 |
| Mip levels | 14 | 15 |
| Actual transcode mip payload bytes | 44,739,280 | 178,957,008 |
| Payload MiB | 42.67 | 170.67 |

The4K fallback adds approximately42.67MiB of RGBA8 GPU mip storage. Thus16K+baseline is approximately213.33MiB for these day maps alone. The reported compressed mip payload is real CPU-array data; GPU storage is an estimate, not driver-measured VRAM. Other textures, retained CPU mip arrays, loader buffers, WASM/worker and upload transients are additional costs. Basis JS/WASM add57,529/527,333 optional request bytes. Other hardware may select ETC/BC1 with smaller mip payloads, but that was not measured here. Medium's existing day-map bytes remain unchanged; no whole-app cold-byte or frame-rate improvement is claimed.

## Verification

- Nine CPU policy/ownership/fallback tests passed; TypeScript passed; official KTX validation passed for both assets.
- `docs/qa/earth-detail-v1/report.json`: native Chrome157.0.8103.52, **PASS60,617ms**, zero application/native errors, one retained shader compiler warning. Expected missing-file404 is explicitly scoped. Nonfatal Vite public-JSON server warnings occurred; the same run completed actual UI proof. There was no failed browser run or hidden fix.
- Four matched actual states T0/T240/T600/T1385 were rendered at4K/8K/16K, with exact physical snapshots and camera. Component16K passed three context restores across active and inactive cache states, with the same texture UUID and one request. Medium cold and high overview triggered no detail/transcoder requests. Intentional404 retained the4K map without retry loops.
- Real game strict replay reached the genuine terminal result. A harness network gate delayed only the optional detail response to capture exact same-instance high-quality before/after views. The gate did not modify runtime. Full runtime/craft/plan/telemetry/result and camera matched exactly. Runtime SHA-256 is `c4579802ec6c545bdd40190899b99fcefcf7110b0b6af6ad316b33a5f7ddf208`. Actual UI native restore and visible exit also passed.
- `actual-ui-before-detail.png` and `actual-ui-after-detail.png` are the primary visual pair. The three `*-working-faces-terminal.png` files compare4K/8K/16K. Those images were individually inspected; source terrain detail improves while the spacecraft and limb composition stay fixed. The report contains16 component screenshots; actual UI pair and safe-fallback image make19 total images.

This functional/visual run was coordinated with other CPU work. It is **not** an isolated ≥60FPS result. Root's integrated high16K sustained performance, production cold-load and cross-browser regression remain separate acceptance. All owned browsers and Vite5186 were closed after this run; no further browser is active.
