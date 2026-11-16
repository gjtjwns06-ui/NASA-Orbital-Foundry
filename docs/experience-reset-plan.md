# Experience reset — solar exploration

The user's 2026-11-15 playtest supersedes the previous mission-menu-first design. Passing numerical tests did not establish discoverability, motivation or game feel.

## Product direction

A fictional planetary-defence alert starts an exploration programme. The player sees an unresolved asteroid track, prepares their own probe, chooses destinations on a navigable 3D Solar System, and drags encounter markers to create a route. Returned observations become a persistent discovery journal and reveal the next question. All eight planets and the authored asteroid are represented; the Earth is the launch origin. This chapter is a reconnaissance programme, not a claim that a near-term real asteroid threatens Earth.

Preserve the existing spacecraft models and physical assembly editor. Separate the new approximate Solar System campaign from the existing higher-fidelity Earth/Mars laboratories and saves. Do not imply the new planetary routes have inherited GMAT or Horizons validation. Use published JPL approximate orbital elements, the existing bounded Lambert solver, and actual sampled Kepler coasts. Finite-body capture, landing, continuous multi-leg swingbys, exoplanet systems and certified mission success are not implemented by drawing an orbit line.

## Acceptance criteria

- A new player encounters a short visual situation before mission selection. One primary action per story beat; no mission-description wall.
- The main route is story → map → craft editing → route → encounter observation → returned discovery → map. Campaign progress and craft survive reload independently of old saves.
- A destination is selected on the map. The world remains visible when a route is unsolved. Dragging an encounter marker changes the candidate trajectory and travel/fuel consequence before release; Escape cancels and undo restores a completed edit.
- Inner and outer destinations are selectable and have distinct appearances and observation results. Mission completion requires observations and return of their data, not just clicking a planet.
- Craft sensor, radio, power, mass and cost affect campaign readiness. Any authored carrier or operational approximation is disclosed in the model panel and documentation.
- The assembly palette does not mark an unselected camera as selected. The five permanent camera presets and central inspection toolbar are replaced with one reset and contextual/collapsible actions. Right-drag orbiting stays intact.
- An invalid M03 calendar range has an explicit repair which changes the plan; it cannot loop by retrying identical invalid values. Calendar bounds appear as dates, not raw Julian days.
- Check the actual first-use route by mouse and keyboard, viewport layouts, persistent-state reload, cancel/undo, browser errors, and the numerical domain. Report failures and limits, not a synthetic fun score.

## Validation meaning

Automated tests validate mechanics and regression. An independent heuristic review can reject poor hierarchy or unclear effects. Neither substitutes for a novice human playtest. The available MCP inventory has no running Ouroboros evaluation server; the evaluation skill's fallback is advisory.
