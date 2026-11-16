# Original mission-control environment

Created locally for Orbital Foundry with Blender 5.2.0 LTS, using the reproducible script `tools/create-control-room.py`. No commercial game models, reference screenshots, paid services, or generated 3D services were used. The supplied Mars Horizon room reference informed the general readable, stylized mission-control theme; this room's geometry, layout, materials, typography, and operator silhouettes are original.

## Included files

- `public/assets/mission-control.glb`: a complete cutaway room with 12 staffed console stations, 24 desk monitors, four wall diagnostic boards, a replaceable central screen, stepped access platforms, equipment racks, acoustic panels, ceiling beams and lamps.
- `public/assets/mission-control-stats.json`: triangle counts, bounds, coordinate contract, byte count and SHA-256.
- `docs/qa/mission-control.png` and `mission-control-operators.png`: Blender render inspections, not runtime backgrounds.
- `docs/qa/mission-control-screen.png`: embedded static standby screen source.

The scene has **51,571 triangles, 27 mesh/material batches, and one embedded texture**, under the 120,000-triangle budget. There are no external GLB texture dependencies. Tiny keys and instrumentation use flat geometry; material batching keeps draw calls bounded. Repeated authoring geometry is cached. Small environmental lettering is printed flat, avoiding expensive beveled text geometry. No Draco decoder or additional runtime dependency is required. Scene lights and cameras used for the Blender inspection renders are not exported.

## Screen texture credit

The standby globe is a rendered derivative of the existing credited NASA Earth texture, **NASA Earth Observatory / Reto Stöckli, Blue Marble Next Generation, July 2004 historical composite**. It is not live imagery. The original orbital line and channel bars are explicitly illustrative training-display graphics, not physical predictions or measured telemetry.

- Source page: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
- NASA media usage: https://www.nasa.gov/nasa-brand-center/images-and-media/
- Existing local source: `public/assets/earth-day.jpg`, 4096 × 2048, SHA-256 `7a1ed50d144364f6c23a2a277bb990014f07d79488b74daf8ae0c897185c9b5b`.
- Full download URL, credit and transformation history remain in `public/assets/texture-provenance.json`.

No NASA insignia, identities, or endorsement claims are included. The people are generic original low-poly figures with no real-person likenesses. Decorative side displays are not game telemetry. The runtime integration replaces the central standby screen with the actual orbital camera render.

## Runtime contract

glTF uses Y up and metres. The open front is +Z; operators face −Z. The room footprint is approximately 20.3 × 18.4 m. Suggested camera `(7,5,14)` targets `(0,2.8,-2.5)`. Keep the camera below the overhead beams: runtime polar angle bounds of 1.43–1.52 radians and distance 12–23 m were inspected in Chrome. High overview positions look through the deliberate cutaway ceiling beams and can obscure the central display.

`MainScreen` remains an individual UV-mapped mesh, centered at `(0,4.6,-7.535)`, facing +Z, sized 8.8 × 4.95 m (16:9). The exported standby material uses `emissiveMap`, not `map`. Replace the whole material with a `THREE.MeshBasicMaterial({map:renderTarget.texture,toneMapped:false})` for a live scene feed. Invert each UV V coordinate once (`v = 1 - v`) because glTF image UVs and a WebGL render target have opposite vertical conventions; without this conversion the live feed appears upside down. Dispose its old emissive texture and material when replacing them. The rest of the room is batched by material; it contains no functional interaction hit targets or separate animated character rigs.

The app loads this asset only when the optional room is entered. The campus, hangar and planet texture files were not changed by this task. The scene is genuine runtime geometry; the inspection PNGs are documentation only.

## Verification

The GLB header/version/declared length, buffer-view bounds, single `MainScreen` node, screen UV attribute, embedded image and total indexed triangle budget were checked. Blender inspection found and corrected a raised-aisle marker placement issue. The first heavy text/bevel pass exceeded the budget and was rejected before export; the final model uses substantially fewer triangles.

Chrome on the development server successfully entered the room through the actual flight-view button, rendered the live orbital camera on the screen, and reported no page or console errors. See `docs/qa/mission-control-browser.json` and the associated screenshots. This is a development integration smoke check, not a new production performance claim or an assertion that every GPU is supported. The surrounding advisor overlay may cover part of the screen; application layout remains the UI owner's responsibility.

A subsequent screen-orientation check identified and corrected the render-target V-coordinate inversion. The initial `mission-control-browser-final.png` predates that correction; `docs/qa/control-room-after-loss.png` shows the corrected upright live feed (Mars north cap at the top). The runtime room also regenerates its reflection render target after context restoration. The isolated loss/restore check had zero browser errors, restored the room and live screen, and disposed its canvases successfully; evidence is in `docs/qa/control-room-context.json`. Both room renders were visually inspected. The small before/after lighting difference in that harness is below one RGB level on average (maximum six); the harness initially supplied a reflection map generated at a different roughness than the room's restored map.

Rebuild locally with:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python tools/create-control-room.py
```
