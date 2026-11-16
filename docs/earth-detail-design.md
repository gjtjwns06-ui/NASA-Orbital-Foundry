# Bounded Earth close-view fidelity candidate

The accepted Earth is a 4096×2048 NASA July 2004 Blue Marble base map on the physical sphere. At 600 km its texels cover roughly 4–11 screen pixels in previously measured actual views. Filtering cannot recover the missing geographic detail. This candidate changes only the optional daytime texture, preserving physical radius, UV geography, Earth rotation, material lighting, camera, craft, and all accepted trail/internal/camera behavior.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Plain 8K JPEG/WebP with mips | 2× linear source detail; simple UV-preserving swap | ~170.7 MiB RGBA8 GPU storage plus 4K fallback; still visibly magnified. Keep as comparison, not preferred delivery. |
| Regional overlapping tiles | Can provide 4× or greater local detail with bounded residency | Requires tile selection, shader sampling, seams/poles, and asynchronous tile replacement. Defer to avoid a new planet engine. |
| 8K/16K KTX2 ETC1S with full mip chains | Same globe/material UVs; 2×/4× linear detail; native compressed GPU storage | Chosen bounded prototype. Requires one lazy Basis transcoder worker, capability gating, exact orientation, and real compression-quality/memory tests. |

Use the same [NASA Blue Marble July 2004 base map](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/), published at 21600×10800. Downsample without sharpening, noise, recolouring, or invented topography. Encode opaque sRGB ETC1S KTX2 with mipmaps. Preserve downloaded source, SHA-256, encoder/version/hash and exact conversion command. Credit NASA Earth Observatory / Reto Stöckli, with the [original dataset limitations](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/) and [NASA media terms](https://www.nasa.gov/nasa-brand-center/images-and-media/). This remains historical imagery, not current weather or an endorsed NASA game.

Request detail only for a current actual flight, craft-inspection mode, high quality, visible/live renderer, supported GPU block compression, and maximum texture size at least 8192. Select 16K when capability and the measured compressed allocation budget permit; otherwise 8K. Medium/low, workshop, and orbit overview continue the original 4K map with no detail asset/transcoder request. No 16K uncompressed fallback is permitted. Baseline stays visible while loading and on any missing file, unsupported format, or decode failure.

One selected detail texture is owned per renderer; no simultaneous 8K+16K cache. Keep decoded compressed mip data for native context restoration, retire every pre-loss registration, and dispose late completions/final resources safely. Downgrading quality returns the original map. Whether to retain or release the cached detail on downgrade will follow measured memory/cost; avoid repeated requests during quick view changes.

Theoretical full-chain storage: 8K RGB at 4 bits/texel ≈21.3 MiB, 16K ≈85.3 MiB; at 8 bits/texel ≈42.7/170.7 MiB. These are estimates until the actual Three transcode format and mip byte lengths are recorded. The 4K fallback remains ≈42.7 MiB. Worker/WASM/download/CPU and upload transients must be reported separately.

Acceptance: exact matched before/8K/16K screenshots at real FirstLight T0/T240/T600/T1385 states; source alignment and geographic comparisons; unchanged physical/camera state; no medium cold detail requests; safe unsupported/missing asset path; native context restores×3, re-entry and final disposal; actual encoded bytes and mip memory; no shader/native errors. Root will separately run an isolated ≥60 FPS gate. No graphics parity or performance claim before those results.
