# First-entry Mars camera composition — isolated candidate 9C

Only the initial Mars inspection direction changes. The craft and planet retain their actual positions, dimensions and attitude. The new `planetInspectionDirection` helper starts from radial-out and adds a tangent angle bounded by the body's actual angular radius and **30% of the smaller usable horizontal/vertical half-FOV**. Maximum tilt is eight degrees. `CraftInspectionCamera` consumes this vector only on first entry; later pointer orbit, zoom, component focus and exact overview restoration remain under the unchanged controller.

Production 9B remains unchanged. The candidate delta is `src/render/planet-inspection-direction.ts` and the small initial-direction call in `src/render/transfer-scene.ts`. [Source hashes](composition-source-manifest.json) pin this exact prototype. No new geometry, map, renderer, resource pool, physics calculation or spacecraft attitude is introduced.

## Verification

**14 focused CPU tests passed** (four new composition tests and ten existing camera tests); TypeScript passed. The new tests cover normal/large 1280×720, 1920×1080 and narrow 900×1400 usable viewports, 25,000 km and 1,000 km altitudes, twelve attitudes, actual planet-center projection, unchanged caller data, preserved later user orbit and exact overview restoration.

The actual browser comparison then completed four separate visible-UI flights: production baseline 9B and isolated candidate, each at normal and large UI scale, Chrome 157.0.8103.52 at 1280×720. Each launched the real remote-operations lesson, advanced with the listening-window control to **T+22,455,800 s**, and advanced with Next milestone to actual periapsis **T+22,464,000 s**. No checkpoint injection, direct worker commands, camera-position assignment or artificial success result was used.

All four baseline/candidate epoch pairs had **identical runtime hashes**. Candidate pointer orbit survived Fit spacecraft, paused runtime remained unchanged, and Escape exactly restored the prior overview camera/target. Zero page/console errors and zero native ownership warnings were observed; ordinary shader/PMREM diagnostics remain in the report. This was functional/visual verification, not a performance measurement or a new context-loss test.

| First entry | Baseline planet center | Candidate planet center |
|---|---|---|
| Normal, decision epoch | (950, −76), above canvas | (668, 286), visible behind spacecraft |
| Large, decision epoch | (950, −83), above canvas | (666, 283), visible behind spacecraft |
| Normal, periapsis | (231, 559), under panel/timeline | (601, 343), behind spacecraft |
| Large, periapsis | (231, 552), under panel/timeline | (605, 335), behind spacecraft |

The [normal decision screenshot](qa/composition/candidate9c-normal-decision.png) was visually inspected: the actual Mars globe remains visible behind the readable spacecraft, with unobstructed controls. At [actual periapsis](qa/composition/candidate9c-normal-periapsis.png), the physically large angular globe fills the background. The 4K global map's softness at that proximity is still visible; this camera change does not manufacture additional surface resolution or establish commercial-game art parity. [Large decision](qa/composition/candidate9c-large-decision.png), [large periapsis](qa/composition/candidate9c-large-periapsis.png), baseline counterparts and full values are retained in [the report](qa/composition/report.json).

All browser contexts and the isolated Vite server were closed before handing the machine back for production deployment checks. Root review/integration remains a separate decision; do not copy a whole prototype workspace over current production.
