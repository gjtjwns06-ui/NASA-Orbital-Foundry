# Original spacecraft surface finish candidate

The accepted First Light craft has visibly uniform gold insulation and a pale service bay. This candidate adds original shading detail while preserving every mesh, UV, physical envelope, transform, camera and light.

Four deterministic 256×256 RGBA maps describe foil normal/roughness and aluminum normal/roughness. They are generated from periodic analytic fields in `deployment-surface-finish.ts`, with no downloaded or generated bitmap dependency. The normal fields are lighting detail only, with no vertex displacement. Foil uses broader folded ridges; aluminum uses much finer, weaker grain. Gold RF patches, photovoltaic cells, PCB colors, dark materials and their depth offsets remain unchanged.

Only the existing foil, ivory and frame material slots change. The original light rig and environment reflection remain intact. This is authored visual art, not a measured coating, thermal, electromagnetic or mechanical model. The metallic/roughness method and non-color texture annotation follow the [Three.js MeshStandardMaterial documentation](https://threejs.org/docs/pages/MeshStandardMaterial.html).

## Ownership and budget

The default style remains flat until visual acceptance. Enabling textured style lazily creates four texture objects owned by one DeploymentView. They use 1,048,576 CPU image bytes and an estimated 1,398,096 GPU bytes including the complete uncompressed mip chains, excluding driver overhead. Style toggles retain these objects; source replacement and final disposal release them. The owning scene includes inactive cached maps in native context retirement, so re-enabling a texture after restoration cannot delete registration handles from an older context. No additional meshes, batches, lights or triangles are created.

## Validation scope

Seven focused CPU cases check every normal pixel, deterministic fields, bounded memory, exact material restoration, independent ownership, identical geometry bytes and FK state, and inactive-cache retirement. The first repeated run rejected an excessively slow assertion loop under concurrent CPU work; `surface-finish-unit-r1-failed.json` preserves it. The replacement aggregates the same full-pixel error/opacity/range constraints before asserting, with unchanged thresholds; `surface-finish-unit-r2.json` passes all seven. Initial TypeScript nullable-data diagnostics were corrected before browser validation.

Native validation passed in 116.710 seconds. It covers four actual recorded flight states at 720p/1080p, same-instance flat/textured pairs, real orbit/zoom, three active/inactive native context restores, source replacement, and genuine terminal replay in the full UI with one further restore. Every pair preserved physical state and camera; draw calls and triangles were unchanged. Actual UI recorded 111 calls, 93,284 triangles and 83 geometries for both appearances. Its textures increased from 8 to 12 and shader programs from 12 to 13. Browser application/resource errors and native ownership errors were zero.

The raw report retains one D3D shader compiler warning entry (X4122 precision and X4008 division-by-zero warnings), without compile/link failure. This task has not established whether that warning is newly introduced. The warning is not hidden or relabeled as a pass of a zero-warning criterion. Concurrent CPU work means this is not an isolated FPS measurement. The candidate default remains flat; root visual acceptance and explicit integration enablement remain separate.
