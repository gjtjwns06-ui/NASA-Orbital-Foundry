# Readable and explicitly scaled velocity inset

This isolated pass replaces the small perspective view of the velocity cone with an orthographic view of a common direction plane. The physical exit direction and tolerance remain unchanged. The existing40× angular transform remains explicit. Each displayed direction ray intersects the same plane at z=1.8; its radial relation to the tolerance ring is therefore exactly the displayed angular relation, rather than a sphere endpoint compared against a conical rim.

The camera targets a70CSSpx goal-ring diameter. When an outlying predicted or recorded marker would leave the inset, a uniform camera zoom fits both markers with12CSSpx margin. The goal ring shrinks with everything else. It never clamps a failing marker into the goal or changes a recorded pass/fail flag. The earlier85° display-angle cap remains separately exposed; it is not a scientific or success threshold.

`SwingbyScene.getVelocityDisplayState()` returns `goalDiameterCssPx`, `targetGoalDiameterCssPx`, `viewZoom`, `adapted`, `projection`, `angularMagnification`, `physicalToleranceDeg` and `displayAngleClamped`. UI copy should distinguish **Angles40×** from **View0.XX×**. When `displayAngleClamped` is true, disclose the85° display cap. The copied record remains the source of actual success, not a rendered pixel test.

The artwork adds twelve restrained radial ticks, a half-radius guide and a central cross. Predicted markers remain hollow cyan and recorded markers filled gold; their screen-space radius stays4CSSpx. Two additional geometry/material batches, no new textures, are introduced. The final actual frame records88 geometries,9 textures,20 programs; this is a renderer counter, not a performance claim.

Validation:31 focused tests in six suites and TypeScript pass. New tests check angles across the physical tolerance boundary, the70px normal target, uniform adaptive zoom and marker containment, explicit85° display cap, and invalid input. The full standalone actual-domain wrapper reran actual pointer commits/cancellation, part pick/focus, three native WebGL restore cycles and final disposal. It passed with zero page/HTTP/native-deletion errors; nine known shader/PMREM warnings remain recorded.

Actual screenshots `docs/qa/swingby-wrapper/inset-initial-70px.png` and `aim-large-1280x720.png` were visually inspected. Starter and both actual pointer-edited solutions show a70CSSpx goal circle at View1.00×. `report.json` includes measured display-state values. The older15px evidence is preserved in `docs/qa/swingby-wrapper-before-inset`. This is isolated renderer evidence at the real declared initial epoch, not a full mission or final deployed acceptance.

Integration requires only the new `src/render/swingby-velocity-camera.ts` and updated `swingby-objective.ts`/`swingby-scene.ts`, plus root-owned UI labeling. No bus, hardware catalogue, dynamics, mission scores or main production file was changed.
