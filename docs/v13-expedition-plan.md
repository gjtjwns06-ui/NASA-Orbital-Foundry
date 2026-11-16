# Expedition journey and science — implementation contract

2026-11-15. The user's next priority is the voyage and the act of exploring: a beautiful spacecraft viewpoint, purposeful commands, recoverable difficult situations, an honest fuel-saving gravity assist and observations with scientific choices. Preserve the simplified assembly and existing saved discoveries.

## Player loop

Choose a destination and shape its route → compare a gravity-assist candidate when useful → prepare the same actual craft → travel in a spacecraft or map view → respond to forecast equipment/environment conditions → approach a moving world → survey, stabilise and expose an instrument → compare useful records → send the results home and retain their images and measurements.

The first expedition must not turn into another permanent dashboard of buttons. Show the current operational objective, one primary action and the relevant instrument controls. Advanced model/source explanations remain in the existing information drawer. Camera controls change the view, not physics. Pointer input changes the instrument's physical line of sight immediately; this is onboard execution/rehearsal rather than impossible instantaneous Earth teleoperation.

## Acceptance criteria

1. Flight has an actual visible craft moving along the calculated coast; a player can switch map, chase and mounted-instrument views. A starfield/sky and well-lit 3D worlds remain visible without bitmap replacement of the scene.
2. At least two recoverable scenario classes create different operational decisions. Forecasts precede effects; commands change state, not just dismiss text. Time acceleration stops at unresolved decisions. The scenario frequency is authored and not a real NASA hazard forecast.
3. Observations use actual body-relative line-of-sight geometry, range, illumination and footprint. Held exposure produces measurable signal/noise and smear. A missed or poor observation is retryable and explains its immediate physical cause through feedback.
4. Imaging requires context and detail; spectroscopy compares bands at the same feature. At least two destination/instrument journeys demonstrate different measurements. A repeated three-target drag sequence is removed.
5. Captured images come from the game camera; saved records include bounded quality/measurement metadata. Illustrative signal spectra and authored terrain regions are distinguished from measured NASA data. Old journal entries remain readable.
6. Local encounter motion follows an explicit finite-body hyperbolic approximation. The join from interplanetary centre-to-centre planning is documented; no full-trajectory accuracy claim is inferred.
7. A gravity-assist candidate connects two Sun-centred coast segments, evaluates planet-relative incoming/outgoing velocity and safe periapsis/turn feasibility, and accounts for any powered correction. The interface shows actual time/propellant differences. At least one feasible candidate demonstrates lower propellant than a direct route under the same departure/arrival conditions and can be flown.
8. Route controls, instrument aim, exposure, command effects, pause/cancel and camera transitions work through native browser input. A failed search leaves a usable map and never applies a fake fuel discount.
9. A paused operational checkpoint can be restored without replaying a completed incident or awarding unreceived science. Save validation rejects non-finite/out-of-range state and preserves legacy saves.
10. Test the built desktop browser at 1440×900 and 1280×720, inspect actual flight/instrument/report images, check application/resource errors, and exercise graphics recovery or state-preserving scene return. Verify changed mathematical rules with meaningful domain tests.

## Scientific and visual boundaries

- JPL approximate elements and existing solar Lambert/Kepler propagation remain the interplanetary model. A patched-conic assist is a declared approximation and does not inherit the old GMAT validation.
- Propellant uses actual computed impulse and Tsiolkovsky. Do not impose an arbitrary percentage discount for selecting a planet.
- Physical electrical energy is W×s/3600. The campaign's authored 300 W carrier is retained; brief exposures must not silently consume dozens of Wh to manufacture danger.
- Local encounter time may be compressed or stretched for playable observations. Show this once in the mode/model context. Sensor response/thermal rules are authored teaching approximations with numerical invariants, not flight-certified hardware behaviour.
- Original spacecraft assets remain. NASA texture acquisition must preserve source and credit; procedural or generated imagery is labelled as illustrative. Beautiful scenery should still retain dark space, directional sunlight and scale cues.

## Work split and validation

The assist module, instrument/operation domain and renderer are developed separately with explicit APIs; the main agent owns their campaign/UI/persistence integration. Independent review is advisory, and executable browser tests verify actual effects. The available tool inventory has no Ouroboros execution server; no automatic Ralph daemon or numerical fun score is claimed. Build/test failures and observed UI defects are corrected and retested before private publication.
