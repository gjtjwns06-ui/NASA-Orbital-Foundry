# Official Mars close-view surface map

The optional close-view map is a geographically aligned derivative of the **NASA / USGS / NASA Ames Viking MDIM2.1 colourized global mosaic**. It is a historical processed composite, not live Mars imagery or an unmodified true-colour photograph. The existing 1440 × 720 `mars.jpg` remains the initial and overview asset.

## Source and rights

- [USGS product metadata and public-domain use constraints](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m).
- [NASA Solar System Treks tile API documentation](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars).
- [Exact service capabilities](https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml): layer `Mars_Viking_MDIM21_ClrMosaic_global_232m`, style `default`, matrix set `default028mm`, matrix `3`.
- [USGS credit guidance](https://www.usgs.gov/information-policies-and-instructions/acknowledging-or-crediting-usgs) and [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/). No endorsement is implied.

Credit: **Mars: NASA / USGS / NASA Ames Research Center, Viking MDIM2.1 colourized global mosaic. Served by NASA Solar System Treks; assembled and WebP-encoded for this game.**

The service publishes a 16 × 8 grid of 256-pixel JPEG tiles at this matrix level. All 128 coordinates were downloaded with at most four concurrent requests and checked for HTTP success, JPEG content, dimensions, unique coordinates and SHA-256. The 6,802,707 source bytes were decoded and pasted in their documented row/column positions. The resulting image was WebP-encoded at quality 92, method 6. **No resampling, recolouring, sharpening, noise, inpainting, AI generation or normal-map synthesis was applied.** Re-encoding the source mosaic reproduced the same output hash.

The runtime [asset](../public/assets/textures/mars-mdim21-4k.webp) is **4096 × 2048, 2,553,544 bytes**, SHA-256 `5d06074054c7405a444ca1824acfc8f64589a2a65efcb986a2a9a31d3dbbe5df`. The [machine-readable provenance](../public/data/mars-surface-detail.json) contains every source tile URL, row/column, byte count and hash, the capabilities hash, processing facts, rights links, UV checks and limitations. Source acquisition and mosaic tools are retained in the separate `orbital-foundry-next-mars` staging workspace; they are not runtime dependencies.

## Geographic and visual checks

The equirectangular image runs from west −180° to east +180°, north +90° to south −90°. No UV flip or longitude shift is needed relative to the existing Viking map. A row-normalized luminance comparison over 60°N–60°S found its strongest alignment without flipping or shifting (correlation 0.6771; best mirrored alternatives at most 0.3067). Olympus Mons, the Tharsis volcanoes, Valles Marineris, polar regions and the wrap boundary were also inspected in a source contact sheet. The parent reviewer confirmed the increased real surface detail and accepted the unchanged source colours.

The wrap-edge mean RGB difference is 7.015/255 versus 6.805 for the median adjacent column. This is a diagnostic, not a guarantee of perfectly seamless source imagery. Historical photometric seams, residual illumination, cloud/haze and geographic colour differences remain. This colour map does not change physical radius, surface targeting, occultation or scientific measurements.

## Runtime loading and ownership

`TransferScene` requests the additional map only when all of these conditions hold: a valid solution, active **current-phase Mars spacecraft inspection**, high quality, a live WebGL context, and maximum texture size of at least 4096. Merely opening M03, selecting Mars phase preview, viewing a planetary overview or using medium/low quality does not qualify. The original map remains available while loading or on failure.

One `LazySurfaceTexture` cache belongs to each transfer renderer. Rapid view/quality changes share one pending request and one loaded texture. Exiting inspection or lowering quality restores the original map while retaining the cache. A late completion after renderer destruction disposes the newly returned texture without touching the destroyed scene. Invalid dimensions and network failure retain the baseline, with no automatic repeated download. Context restoration reuses the decoded image; final renderer disposal detaches and releases the detail texture exactly once. Renderer-pool base textures are also excluded from generic traversal disposal and retired once by their pool.

The map uses sRGB, the baseline texture's UV orientation/wrapping, and bounded anisotropy. There is no runtime hue correction or artificial sharpening. `getMarsSurfaceDetailState()` and `getRenderSettings().marsSurfaceDetail` expose status, eligibility, active/cached flags, request count, loaded dimensions, active map dimensions, capability, source and provenance URL for read-only QA.

Estimated storage for a decoded RGBA8 texture is **32 MiB CPU image and 42.67 MiB GPU texture including a full mip chain**, in addition to baseline assets and transient decoding/upload memory. These are allocation estimates, not measured browser GPU bytes. The 2.44 MiB compressed file is an optional request, not an initial-load addition.

## Verification at integration

- **32 focused CPU tests passed**: 11 new asynchronous texture ownership / request-policy tests, 10 existing craft-camera tests and 11 existing command-signal tests.
- TypeScript `tsc --noEmit` passed after integration.
- The new tests cover no eager load, rapid toggles, exit during load, late completion after disposal, invalid dimensions, network failure, late rejection, repeated context-image reuse, idempotent disposal and exclusion of every non-qualifying view/quality/phase state.
- Initial source integration performed no GPU run. The coordinated 9A browser check confirmed lazy loading and actual dimensions, but later trace review exposed expired-generation buffer/VAO deletion on post-recovery path rebuilding. Functional success alone did not close graphics validation.
- Candidate **9B** then passed the independent actual-Mars three-cycle restore → path rebuild → re-entry → replay → application-exit native probe with one detail fetch, a 4096-pixel active map, cached exit/return, and zero native deletion errors. [Recovery cause, fix and exact evidence](context-generation-recovery.md) records the earlier failure and separates these checks from unrelated performance claims.
