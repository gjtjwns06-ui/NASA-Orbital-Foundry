# Next bounded visual pass: lazy, geographically grounded Mars surface

Research only, 2026-11-15. No texture, renderer or published app was changed; no full imagery archive was downloaded. The camera candidate is frozen separately.

## Finding and recommendation

The current Mars asset is **1440 × 720, 972,896 bytes**, verified from `public/assets/mars.jpg` and `texture-provenance.json`. The existing **Earth** day map is 4096 × 2048. Therefore the visible Mars blur is not evidence that a 4K Mars map has already failed. Its source is the small [NASA Mars 3D texture](https://science.nasa.gov/3d-resources/mars/), made from Viking imagery processed by USGS.

**First implement only a lazy 4096 × 2048 colour replacement derived from a genuinely larger official mosaic.** Keep the existing map as immediate fallback and leave the initial campus/assembly asset requests unchanged. Activate the detail load only on actual Mars close inspection, not at app start or while inspecting an Earth/Solar phase. Compare the same camera/epoch/material before adding further effects. A separate optional 2048 × 1024 MOLA-derived normal map is the second small step if its real relief improves the actual image.

This is an original implementation recommendation, not a NASA game specification or a measured performance result.

## Source choices and verified access

| Source | Scientific content and terms | Practical state |
| --- | --- | --- |
| [USGS/NASA Ames Viking MDIM 2.1 colourized mosaic, 232 m](https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m) | Lower-resolution Viking colour combined with the controlled monochrome mosaic. Its own metadata says public domain, no use constraints. Do not call the entire composite a direct true-colour photograph. | Official [12 GB GeoTIFF](https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif) identified. Both metadata-page open and direct-file HEAD returned **403** here. No archive download or bypass attempted. This remains the preferred registered source when ordinary access works. |
| [ASU Mars Space Flight Facility Viking merged colour mosaic](https://www.mars.asu.edu/data/mdim_color/) | NASA Viking colour sharpened with MDIM 1.0, 64 pixels/degree, about 920 m/pixel, global 23040 × 11520, simple cylindrical planetocentric coordinates. It is a different historical product from MDIM 2.1. | The [official directory](https://www.mars.asu.edu/data/mdim_color/large/) provides eight tiles, despite its overview page saying single file. The first [tile](https://www.mars.asu.edu/data/mdim_color/large/mars45n045.png) returned **HTTP206**, 32-byte range, PNG dimensions **5760 × 5760**, total **33,736,115 bytes**. The directory lists the eight sources at about29–36MB each. This is a practical offline derivation route; runtime must use local derivatives, not these large remote tiles. |
| [NASA PDS MGS MOLA MEGDR](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html) | Actual gridded topography, separate from colour. The maintained PDS4 archive offers16pixels/degree global topography; the source label gives **5760 × 2880, SignedMSB2, metres, positive-east longitude**. | [Label](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.xml) fetched and inspected using normal platform TLS. [Data](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/megt90n000eb.img) identified, not downloaded; its raw sample size is33,177,600bytes by calculation. |

The USGS [MOLA 463m product](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m) explicitly identifies CC0/public-domain status and names Goddard/MOLA as originators. Its 2GB GeoTIFF also returned403 here; the PDS16ppd product avoids needing that large derivative for a 2K normal map. Dataset versions are distinct and must be credited as actually used.

The ASU Viking page attributes NASA data but has no asset-specific CC0 statement. Do not transfer the THEMIS-only copyright FAQ to Viking, or claim an ASU derivative is newly verified CC0. Before packaging that fallback, retain its exact NASA/USGS lineage and the actual derivative metadata; cite the [public-domain Viking colour product](https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m) only for the product it describes. [USGS credit guidance](https://www.usgs.gov/information-policies-and-instructions/acknowledging-or-crediting-usgs) and [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) support factual source credits without an endorsement claim.

NASA's older WMTS capabilities URL was also checked and returned403. It should not become a new runtime dependency. No API key or paid service is required for the proposed local-file delivery.

## Honest image processing

Preserve the mosaic geography through deterministic resampling. Record all source URLs, full-file SHA-256 hashes once downloaded, native dimensions, tile longitudes, projection, colour processing, output settings and output hashes. Verify Olympus Mons, Valles Marineris, poles and the antimeridian rather than relying only on a seamless-looking panorama. The ASU page uses−180…180E while tile names use0…360-style centres; confirm ordering from features/metadata before assembly.

The normal map must be calculated from MOLA elevation gradients in metres, with spherical east-west pixel spacing, longitude wrapping and stable polar handling. It must not come from colour brightness or a generative image model. Colour mosaics already contain residual illumination; keep any extra relief subtle to avoid doubled shadows. A normal map modifies lighting only: the physical Mars radius, collisions, horizon/occultation and scientific target calculations remain unchanged. Any vertical exaggeration must be declared; start with metric gradients at1×.

Do not use rainbow MOLA elevation/hillshade as natural colour, insert procedural craters as observed geography, upscale the current1440map and call it new detail, or claim a live/weather-current Mars surface. These are historical composites.

## Memory and loading budget

The following are calculated conventional RGBA8 texture allocations including a full mip chain, not measured browser memory. File compression does not determine the decoded GPU size; see the [Three.js texture documentation](https://threejs.org/manual/pages/textures.html).

| Map | Approximate texture memory | Equatorial colour sample spacing, using3389.5km Mars radius |
| --- | --- | --- |
| Current1440 × 720 | 5.27MiB | 14.79km |
| Proposed4096 × 2048 | 42.67MiB | 5.20km |
| Optional2048 × 1024 normal | 10.67MiB | Relief only, not colour resolution |
| Uncompressed8192 × 4096 | 170.67MiB per map | 2.60km |

A4Kcolour+2Knormal pair adds about53.34MiB of texture allocation before decoder/CPU buffers, the retained fallback, render targets and other scenes. A JPEG/WebP size reduction does not remove this GPU cost. Keep the first slice to4Kcolour, with a proposed output network budget ≤3MiB that must be measured after real conversion. Low quality can remain on the existing fallback; medium/high should inspect `MAX_TEXTURE_SIZE` and use an explicit conservative cap.

If8K still materially improves a controlled screenshot, test [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html) in a later slice. It supports Basis transcoding into available GPU-compressed formats, but requires encoder/decoder assets, format-specific memory verification and image-quality inspection. No installed `gdal_translate`, `toktx`, `basisu` or `magick` CLI was found in the current PATH. Do not assume compressed GPU storage will be available on every device or silently fall back to an unbounded8KRGBA allocation.

Proposed runtime ownership: one detail loader per active transfer renderer, local asset URL, keep base map while loading, ignore stale completion after exit/dispose, no primary/transfer cross-context sharing of GPU targets, and explicitly dispose only owned detail textures. No global preload, base64 embedding, speculative prefetch, or extra full-resolution canvas copy. Handle context restoration from retained source data and offline/missing-detail failure by keeping the proven base map.

## Acceptance evidence for that later slice

1. Exact same actual periapsis state/camera/lighting before and after; inspect normal/large1280 and1080 screenshots, fixed landmarks, seam/poles and low-Sun relief.
2. Network trace proves **zero new detail requests/bytes before Mars close inspection**. First-load Earth/campus NFR remains unchanged; report detail latency separately.
3. Failed/offline detail fetch leaves a working base-map view. Repeated enter/exit, quality changes and actual context loss restore the correct texture with no invalid deletes, duplicate uploads or retained abandoned allocations.
4. Measure the new close-Mars scene in its own isolated120second run after upload, plus capture the first-upload long task/frame stall. Do not relabel existing standard20-part performance as this new scene's evidence.
5. Record the actual downloaded and decoded/GPU resource budget; accept the larger source only if visible detail is improved without harming spacecraft readability.

No implementation or image-quality claim beyond the existing camera screenshots has been made by this research.
