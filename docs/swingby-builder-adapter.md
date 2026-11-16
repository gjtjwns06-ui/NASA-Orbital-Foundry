# Optional scenario carrier in the assembly view

This isolated change adds the same authored CG ring and narrow moving bell as SwingbyScene. It leaves all released catalogue meshes, collision envelopes, masses, saves and non-swingby rendering unchanged.

Integration API:

```ts
scene.setSwingbyCarrier(SWINGBY_PROPULSION, evaluation.enginePartId,
  swingbyThrustGeometry(design, scenario.initialFuelKg).thrustDirectionBody);
scene.setSwingbyCarrier(null, null); // restore stock model on leaving this scenario
scene.getSwingbyCarrierState(); // requested/attached ID, profile hash, pose acceptance
```

Call after `setDesign` and after authoritative evaluation changes. The scene also reapplies the stored adapter after each `setDesign`, so normal remounts, rotations and undo do not lose the art. No renderer CG or fuel calculation is introduced. The optional third parameter is a body-frame unit thrust direction; the helper transforms it through the actual mounted engine quaternion. An invalid/out-of-gimbal pose retains the last valid visual pose and exposes `poseAccepted:false`.

Copy `swingby-builder-carrier.ts` and `swingby-carrier.ts`, then apply `docs/qa/builder-adapter/game-scene-carrier.patch` to the current GameScene. **Do not replace the whole isolated `scene.ts`: its baseline predates the production9B context-recovery changes.** The patch only adds the import/instance/API, detach-before-disposal and post-design reconciliation, scoped hidden-stock hit filtering, and moving-ghost reconciliation/cleanup.

The adapter hides original engine children, owns its replacement resources, and restores exact prior visibility on removal. A deleted/replaced part first removes the carrier, preventing duplicate final disposal by generic scene cleanup. Moving ghosts own a separate translucent carrier. Existing9B context-generation retirement traverses attached carrier and ghost resources normally; no borrowed factory materials are released by the adapter.

Validation:26 focused tests across five files pass, including300 physical-envelope gimbal samples from the earlier carrier suite, mounted body/local conversion, unchanged-resource reconciliation, model replacement/undo, moving ghosts, hidden stock ray filtering, and generation retirement followed by final cleanup. TypeScript passes. This is CPU ownership/geometry proof; actual builder/browser rendering is still pending.

Aim-camera addition: `swingby-aim-camera.ts` frames the physical grid along its real plane normal with its +Y axis up, using actual UI insets. The existing grid covers±2,000km (4,000km width); that display span does not alter the authored targeting domain. The three new tests verify projected grid bounds in six viewport/layout combinations, physical pointer-ray inversion and invalid-input handling. No independent physics or success calculation is added.
