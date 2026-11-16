# Restrained original celestial background

`CelestialStars` supplies640 deterministic original directions in a single Points geometry/material and no textures. Subdued blue-white vertex colours and constant1.25CSSpx points supply scale cues without a fake nearby planet, nebula or astronomical-catalogue claim. There is no per-frame random generation, twinkle, travel streak or simulation-time animation; reduced-motion behaviour is unchanged.

The coordinate shell follows the camera position, so translation introduces no parallax. Rotation still changes the viewed celestial directions. Its vertex shader explicitly writes far-plane depth, keeping every actual opaque body in front even when an overview camera is beyond the finite coordinate shell. The shader does not affect physics or rendered planet size.

The object participates in existing9B context-generation retirement through the scene traversal. It retains CPU arrays during context loss and owns its final geometry/material disposal. The helper detaches on final disposal; repeated final disposal is idempotent. No borrowed maps or factory resources are touched.

Validation:35 focused tests passed before the last far-depth addition; its four focused tests and TypeScript passed again after that addition. The new tests verify deterministic finite directions, absence of translation parallax, rotation response, static repeated updates, far-depth shader contract and generation retirement followed by exact final disposal. The real standalone wrapper was rerun after the final shader: actual pointer commits/cancellation, pick/focus, three native context restores, overview/reentry and final disposal all pass with zero page/HTTP/native-deletion errors. Nine pre-existing shader/PMREM warnings remain recorded.

Same-camera screenshots `docs/qa/swingby-wrapper/craft-normal-1280x720.png` and `aim-large-1280x720.png` were visually inspected. The prior backgrounds are retained in `docs/qa/stars-before`. Final frame counters are89 geometries,9 textures and21 programs, an increase of one geometry and one program over the preceding inset candidate; this is not a new performance measurement.

Integrate the new `src/render/celestial-stars.ts` plus `docs/qa/stars-before/starfield-integration.patch` against the latest UI-owned SwingbyScene. The narrow patch adds the helper to the scene, centers it before rendering, exposes read-only state and disposes it explicitly. Do not overwrite unrelated worker/UI/domain changes. This work remains isolated; main production was not modified.
