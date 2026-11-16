# Orbital Foundry — visual production and asset provenance

Research and authored assets: 2026-11-15. The game borrows the readable scale, welcoming colours and cinematic framing of the user's references. No commercial game's meshes, textures, logos, screenshots or interface assets are included.

## Chosen production method

Use original, parametrically authored Blender geometry for the launch campus, clean-room hangar and mechanically meaningful modules. This keeps proportions, mounting faces, collision volumes and moving parts under our control. Use published NASA planetary maps for actual planetary geography. Use one coherent material palette across manufactured assets: ivory ceramic, navy and teal paint, amber safety equipment, brushed steel and dark rubber.

The original environments have real bevelled edges, recessed windows, structural bracing, panel divisions, light fixtures, workbench drawers and readable silhouettes. They are not flat image backdrops. The hangar has an open front, open roof girders and an empty central working volume. The campus has an independent launch-vehicle group for animation. Geometry is merged by material to reduce draw calls without merging the rocket into the campus.

`tools/create_assets.py` is the reproducible source. Run it with Blender 5.2's background Python. Blender authors Z up; GLB export converts to glTF Y up. One exported unit is one metre. Runtime camera, lighting, contact shadows and postprocessing remain the game's responsibility; lights from offline previews are intentionally not exported.

## Original files

| File | Origin | Runtime notes |
|---|---|---|
| `public/assets/launch-campus.glb` | Original Blender geometry and materials in this repository | Approximately 32 × 31 m campus. Rocket at origin, up to approximately 12 m; `LaunchVehicle` node can translate independently. Original gantry, two buildings, parabolic ground antenna, landscaping, lamps, signs and access road. |
| `public/assets/hangar.glb` | Original Blender geometry and materials in this repository | Approximately 18 × 17 m. Front is positive glTF Z; back wall is negative Z. Central ±2.5 m is clear for assembled spacecraft. Suggested camera `(7,5,9)`. |
| `public/assets/environment-stats.json` | Generated from exported authored meshes | Actual triangle, mesh-object and file-byte counts. |
| `docs/qa/launch-campus.png`, `docs/qa/hangar.png` | Cycles renders of these exact source scenes | Asset inspection evidence, not screenshots of the browser build. |

These original assets were authored for this project without purchasing or calling a model-generation API. The source code is retained to permit revisions and re-export. No NASA identity marks are placed on fictional vehicles or buildings.

## NASA texture files

Detailed source URLs, credits, source and output SHA-256 hashes, dimensions, byte counts and conversion descriptions are saved in `public/assets/texture-provenance.json` by the asset script.

| File | Source and attribution | Interpretation |
|---|---|---|
| `earth-day.jpg` | [NASA Blue Marble Next Generation base maps](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/), July 2004, NASA Earth Observatory / Reto Stöckli | Historical global natural-colour composite, served by NASA at **4096 × 2048** from its published5400 × 2700 map. Original downloaded derivative bytes retained; no AI upscaling/recolouring. Not live Earth data. |
| `earth-night.jpg` | [NASA Earth at Night flat maps](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/), Black Marble 2016, NASA Earth Observatory / Black Marble team | Historical night-light composite, 2048 × 1024. Apply on the night hemisphere; do not treat it as current energy or population data. |
| `earth-clouds.png` | [NASA SVS 3837](https://svs.gsfc.nasa.gov/3837/), GEOS-5 model frame `clouds.0350.tif`; NASA/Goddard Space Flight Center Scientific Visualization Studio | 2048 × 1024 atmospheric-model frame, originally published 2011. Source alpha retained exactly, RGB set to neutral white and stored as PNG; dimensions unchanged. Use as a transparent colour map, not an alphaMap (RGB is white). Illustrative moving cloud layer, not observed current weather or a gameplay forecast. |
| `mars.jpg` | [NASA Mars image texture](https://science.nasa.gov/3d-resources/mars/), [NASA source repository](https://github.com/nasa/NASA-3D-Resources), NASA/Jet Propulsion Laboratory & Caltech; Viking imagery processed at USGS | Original 1440 × 720 map, original bytes retained. |

NASA media use follows the [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). NASA should be acknowledged; NASA hosting does not grant rights to third-party material marked with another copyright holder. Use does not imply NASA endorsement. These sources are individually attributed rather than collectively labelled CC0.

### Earth texture resolution upgrade

The official base-map page was rechecked and its July global5400 × 2700 JPEG link opened before downloading the4096 × 2048 derivative. The producer attribution is supported by [NASA's Blue Marble: Next Generation article](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/). The NASA media policy permits factual educational simulations with attribution and without implied endorsement; this map has no person, NASA identity mark or identified third-party copyright notice. The source media remain separate from the project's code licence.

The upgraded `earth-day.jpg` is **436,962 bytes**, only265,434 bytes more than the former2K map. SHA-256:`7a1ed50d144364f6c23a2a277bb990014f07d79488b74daf8ae0c897185c9b5b`. JPEG decode and4096 × 2048 dimensions were checked, and the actual image was visually inspected. Coordinates and colour content were not altered. The asset generator now preserves4K output on regeneration.

At this upgrade snapshot, all files under `public/assets` total **10,461,537 raw bytes (9.98MiB)**. Independently gzip-compressing these files gives an estimated **6,070,257 bytes (5.79MiB)**; actual HTTP compression/headers/cache behaviour must still be measured and this is not an NFR08 cold-load PASS. A conventional RGBA8 GPU upload with a full mip chain for this map alone is about **42.67MiB**, four times the former2K map's texel memory. This is a memory estimate, not a measured GPU allocation. The4K map must be checked on the declared baseline browser/GPU with the new visual scene.

## Methods compared before production

| Method | Evidence | Decision |
|---|---|---|
| NASA complete spacecraft GLBs | [Official collection](https://science.nasa.gov/3d-resources/) and [repository](https://github.com/nasa/NASA-3D-Resources). In-memory inspection found generic 1U CubeSat 23,570 triangles / 18 materials, ICECube 58,118 / 21, and Cassini Assembly 453,987 / 8. Cassini's download is only 2.39 MB. | Valuable reference and optional later museum objects. Not used as the editable assembly bus: small downloads may still have excessive geometry, and an assembled spacecraft mesh does not establish meaningful part separation. |
| Kenney Space Kit | [Official Space Kit](https://kenney.nl/assets/space-kit): 150 3D assets, CC0. | Useful free source for secondary props, but a mixed kit would dilute the requested coherent art direction. No included Kenney assets in this version. |
| Quaternius Ultimate Space Kit | [Official kit](https://quaternius.com/packs/ultimatespacekit.html): 92 models, glTF/FBX/OBJ/Blend, CC0. | Viable for characters or later environmental populations. Not included in current deliverables. |
| Poly Haven | [Asset licence](https://polyhaven.com/license): HDRIs, textures and models are CC0. | Appropriate optional neutral studio lighting or ground materials. Avoid importing a photorealistic rusty surface pack into an otherwise clean stylised scene. Not included. |
| Generative 3D | [Meshy text-to-3D](https://docs.meshy.ai/en/api/text-to-3d) exposes topology/polycount controls; [Tripo](https://developers.tripo3d.ai/en/docs/introduction) supports mesh generation, retopology and texturing. | Considered, but not needed for these reproducible mechanical shapes. No account key, paid call or generated 3D output used. Generated results would still require mount, topology, silhouette and licensing checks. |
| Blender procedural authoring | [Official Blender](https://www.blender.org/download/), locally verified Blender 5.2.0 LTS. | Selected. Exact dimensions, named moving groups, reusable original materials, predictable face counts and repeatable renders. |

## Runtime integration and performance targets

- Import with [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html). Plain GLBs currently require no Draco or Meshopt decoder. Adding compression later requires shipping/configuring the matching decoder, not merely changing the file extension.
- Enable mesh shadow casting/receiving in the application. Use restrained environment illumination plus a directional key light. Emissive strips in GLB make the fixtures visible, but do not cast light in ordinary raster rendering.
- Render Earth with a physical sphere, the day map, day/night-aware emissive contribution, a slightly larger cloud shell and a subtle atmosphere. Keep solar light direction shared with simulation. Avoid a strongly glowing day-side city layer or opaque clouds.
- Planet colour maps are sRGB. Scalar roughness/normal/alpha data is not sRGB. Avoid applying gamma correction twice. Texture geographic orientation must match the application's longitude convention before placing scientific targets.
- Proposed desktop target: 60 fps at 1080p, low setting at least 30 fps on the declared test machine; measure actual browser frames. Cap device-pixel ratio, use one main shadow map, reuse materials, avoid per-frame mesh creation and dispose old scene resources.
- Proposed visible-scene budget: approximately150k environment triangles plus spacecraft, fewer than100 material draw calls before overlays. Earth daytime map is4K; the other initial planetary maps remain2K or smaller. These are production budgets, not unmeasured performance claims.
- [glTF Transform](https://gltf-transform.dev/cli) supports pruning, deduplication, simplification, Draco/Meshopt geometry and WebP/KTX2 texture workflows. [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html) requires `detectSupport(renderer)` and its bundled transcoder. Compression is a measured follow-up if the shipped load/VRAM budget fails.
- Keep rendered meshes separate from physical state. Floating-origin rendering must not alter Float64 orbital state. A close-up spacecraft and an astronomical-distance planet cannot share naive metre-scaled Float32 positions.

## Visual release checks

Inspect actual runtime screenshots of campus, assembly, orbit planning, launch, Mars encounter and results. Check geometry seams, missing textures, wrong normals, transparent sorting, clipping, shadow acne, text readability, pointer hit targets and camera bounds. Check a full scene switch/retry cycle for GPU memory growth. Offline renders verify source art only; the browser game still requires its own visual and interaction QA.

## Iteration 5 — original control room and transfer renderer

The optional control-room diorama is an additional original Blender asset, authored with `tools/create-control-room.py`. It contains twelve staffed console stations, 24 desk monitors, four wall boards, chairs and generic operator figures, stepped aisles, equipment racks, acoustic panels, and ceiling lighting. No commercial-game asset or paid generation service was used. [Full provenance and integration contract](mission-control-provenance.md) distinguishes its decorative displays from live game data.

| Added file | Measured contents and use |
|---|---|
| `public/assets/mission-control.glb` | **51,571 triangles**, 27 mesh/material batches, one embedded standby-screen texture, **3,019,548 bytes**. SHA-256 `fc166790eadcb735d7f9517fc53c9ed00692d0a68c6d254133cb44910efc918e`. Under the task's 120,000-triangle cap. |
| `public/assets/mission-control-stats.json` | Export counts, hash, bounds, camera and screen coordinate/UV conventions. Approximately 20.3 × 18.4 m, glTF Y up, +Z open. |
| `src/render/control-room.ts` | Lazy GLB loading, live orbital camera rendered onto the separate `MainScreen` mesh, bounded room camera and restored reflection map after WebGL context recovery. The runtime converts UV V once so the render-target feed is upright. |
| `src/render/transfer-scene.ts` | Separate 3D Earth–Mars renderer using existing NASA textures and original modular spacecraft geometry. Bundled ephemeris positions and physical trajectory states determine plotted positions. Enlarged display sizes, local phase previews and illustrative orientation are explicitly labelled. |

The room's embedded standby Earth image is a rendered derivative of the already credited NASA Blue Marble map. It is not live imagery. The actual app replaces the central screen with the current orbital camera; surrounding decorative charts remain illustrative. Blender source-art renders are [room overview](qa/mission-control.png) and [operator view](qa/mission-control-operators.png); these are not runtime backgrounds.

Production `index-as3YeZTu.js` was visually inspected in Chrome 157 at **1280 × 720**. [Machine-readable evidence](qa/iteration-5/visual-review.json) records zero page/console/resource errors in that run. The three mission cards were all visible on the first mission-picker screen, both transfer date handles resolved directly to the canvas, the transfer legend ended at y=566 above the timeline beginning at y=581, and the local Mars craft was visible at approximately (737,409). The room's lower advisor card left its upright live monitor visible. Runtime screenshots: [mission picker](qa/iteration-5/mission-picker-1280.png), [transfer assembly](qa/iteration-5/transfer-assembly-1280.png), [solar plan](qa/iteration-5/transfer-solar-1280.png), [Mars detail](qa/iteration-5/transfer-mars-1280.png), [control room after transient toast closed](qa/iteration-5/control-room-1280.png).

The same production check observed **zero requests for `mission-control.glb` before entry and one after entry**. This proves deferred asset loading in that flow; it is not a new cold-load performance measurement. A small overlap remained between the solar Mars label and the top hint, and the local body label was redundant under the hint. Source fixes hide local body labels and move the hint; their final rebuilt layout check is pending at this documentation snapshot.

Separate renderer checks found and corrected a foil bump-map disposal leak. Twelve spacecraft/path/view rebuilds then retained nine GPU textures, with geometry counts alternating between 115 local and 120 solar; see [resource evidence](qa/transfer-scene-resilience.json). Injected transfer context loss/restoration produced a pixel-identical static Mars image after reflection-map regeneration. Room context recovery and upright-screen inspection are recorded in [room recovery evidence](qa/control-room-context.json). [Renderer QA notes](transfer-renderer-qa.md) state the exact scopes and limitations.

These checks establish this bounded asset and renderer iteration. The earlier 120-second performance sample belongs to the earlier build; no new performance measurement, mobile/Safari support, external-player evaluation, or commercial-game parity is inferred from the new screenshots or functional checks.

## Optional Mars close-view detail

`public/assets/textures/mars-mdim21-4k.webp` is a **4096 × 2048, 2,553,544-byte** derivative assembled from all 128 official NASA Trek level-3 tiles of the NASA / USGS / NASA Ames Viking MDIM2.1 colourized mosaic. SHA-256: `5d06074054c7405a444ca1824acfc8f64589a2a65efcb986a2a9a31d3dbbe5df`. The exact [USGS product](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m) is public domain; credits remain in [complete runtime provenance](../public/data/mars-surface-detail.json), including tile URLs and hashes. No generated detail, recolouring, sharpening or normal map was introduced.

The existing Mars map is **1440 × 720**. It stays in initial/overview rendering; the new map loads only for actual Mars-phase spacecraft inspection at high quality. The cache retains at most one detail map per renderer and falls back on load failure. [Source, geography, rights, ownership, memory estimates and exact test scope](mars-surface-detail.md) records the source/CPU checks and actual 9B lazy-request/recovery closure, including the preceding 9A post-recovery deletion defect. No initial-load or frame-rate improvement is claimed from this asset addition.

## First Light articulated spacecraft

The commissioning scene adds original procedural chassis, hinge, panel, dish and internal equipment art in `src/render/deployment-*-art.ts` and `deployment-link-meshes.ts`. These are illustrative mechanical designs, not manufacturer CAD or assets extracted from Mars Horizon, Juno or Solar Smash. The shared physical topology supplies rigid-link boxes, hinge transforms and apertures. Decorative housings, fasteners and board details add no simulated mass or collision volume.

The internal-art revision distinguishes battery enclosures, shielded RF modules, three orthogonal ADCS wheel housings, recorder banks and mechanism drivers without new textures. Its matched component comparison and source identities are preserved in [the handoff](qa/milestone-8/internal-art-handoff.md). Existing NASA Earth imagery is reused with its prior provenance. The optional orbital inspection follow changes only camera framing around the actual moving COM; it does not change Earth geometry, orbit or spacecraft attitude. [Release scope](qa/milestone-8-local.md) separates visual checks, actual flight evidence and remaining close-map/shadow limitations.


## Optional Earth detail and original surface finishes

The First Light high-quality close Earth view may load one supported 8K/16K compressed July 2004 NASA Blue Marble monthly map. Credit: NASA Earth Observatory / Reto Stoeckli. This is historical imagery, not live weather or invented terrain. [Complete acquisition, exact derivatives, licensing and cost](earth-detail-handoff.md) and [runtime provenance](../public/data/earth-surface-detail.json) preserve official URLs, source/derivative hashes and encoder commands. The Basis runtime is copied from Three with its Apache-2.0 license included. Medium and unsupported devices keep the existing 4K map.

First Light's foil and aluminum finish uses four original deterministic 256px normal/roughness maps generated in `src/render/deployment-surface-finish.ts`. No image-generation API, paid asset, commercial-game texture, new geometry or fabricated geography is used. The maps affect reflected light only; physical coating performance, collision envelopes and science values are unchanged. [Exact scoped renderer and visual evidence](surface-finish-handoff.md). Integration/performance/publication status is recorded separately in [version 9](qa/milestone-9-local.md).

## Solar expedition map

The separate `src/solar/scene.ts` renderer reuses the credited local NASA Earth and Mars overview maps and the existing original spacecraft/part geometry. Mercury, Venus, the giant planets, Saturn's rings and the fictional ASTER-7 use deterministic procedural meshes and colour patterns authored in this repository. These patterns are illustrative game art, not NASA surface maps or remotely measured clouds. Planetary coordinates come from the separately credited JPL approximate-element model; enlarged bodies and logarithmically compressed distances are display choices.

Discovery-card images are JPEG captures of the player's actual rendered encounter. They are not telescope photographs or independent scientific observations. No paid generation service or commercial-game asset extraction was used for this map. [Runtime screenshots and bounded validation](qa/experience-reset-release.md).
