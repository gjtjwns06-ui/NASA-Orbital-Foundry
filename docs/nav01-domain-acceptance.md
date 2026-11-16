# NAV01 initial Earth ellipse — domain acceptance

Base: `b0c0c5cc07c8e0f7f77e06fb1eef86c99a274586`; isolated branch `codex/nav01-domain`. This is the domain portion of the mouse Pe/Ap/plane editing milestone. It does not attest to browser interaction, visual quality, current deployment, or whole-game completion.

## Canonical plan and physical meaning

`plan.altitudeKm` is the initial/periapsis altitude, `plan.inclinationDeg` is the plane inclination, and the sole new field is `plan.earthOrbit = {version: 'earth-ellipse-rtn-1', apoapsisAltitudeKm}`. The absent field retains released circular arithmetic, velocity/radial/normal impulse semantics, model identity, serialization, and results. An explicit equal-apsis versioned orbit still identifies the new RTN model; it is not silently converted back to the legacy model.

The opt-in orbit begins at periapsis on inertial +X. RAAN, argument of periapsis, and initial true anomaly are zero. Initial speed follows vis-viva, and the unchanged universal-variable central-point-mass propagator advances the state. Altitudes are 180–2000 km, inclination is 0–180°, and reversed apsides, unknown versions/fields, null or nonfinite values are rejected. The edit helper returns a new plan and never swaps or clamps invalid apsides; UI code owns visible clamping.

For versioned impulses, R = unit(r), N = unit(r × v), and transverse/prograde T = unit(N × R). These axes are orthogonal even away from apsides, so the physical impulse norm equals the component norm used for propellant accounting. `earthManeuverBasisAt(plan, time, maneuverId?)` returns the selected node's preburn basis after any earlier coeval nodes, using the existing time-then-ID ordering. Missing IDs fall back safely to the pre-epoch state. At an exact event timestamp the public trajectory remains preburn, preserving the existing reference convention; subsequent states include all burns at that timestamp.

Model identity is `1.3.0+earth-ellipse-rtn-1` for legacy hardware or `2.0.0+earth-ellipse-rtn-1` for catalog hardware. Runtime, save, and result carry the same identity. The score formula is unchanged, but A/B comparisons must also compare model identity. Import rejects mismatched new-model plans, runtime models, and previous-result model/score identifiers. Old absent-field migration and replay behavior remains unchanged.

## Launch insertion assumption

`EARTH_INJECTION_POLICIES` is explicitly authored game data, not manufacturer launch capability. Rideshare supplies circular insertion only. Dedicated and heavy packages may supply an ellipse when **both** apsides and inclination fit their existing ranges. Existing cost, budget, wet mass, and stowed-envelope gates still apply. Initial insertion is supplied by the selected package, not charged as an onboard burn; this does not simulate launch ascent or allow free orbit changes during flight. New issue codes: `INJECTION_APOAPSIS`, `INJECTION_SHAPE`.

## Evidence

`docs/nav01-focused-regression-r1.json` reports **71/71 cases PASS across seven files**: NAV01 25; existing engine 16; hazards 6; launch 7; maneuvers 5; target integration 6; hardware/transfer legacy replay 6. TypeScript `--noEmit` also passes. This is a focused regression set, not the historic entire 449-case suite.

Five frozen pre-edit fixtures in `tests/fixtures/nav01/legacy-circular-b0c0c5c.json` compare little-endian Float64 trajectory SHA-256 (including signed zero), full actual simulation JSON hashes, and actual result JSON hashes. All remain exact. New cases cover ellipse invariants, actual opposite apsides, strict inputs, off-apse RTN/fuel consistency, coeval selected-node ordering, both launch bounds, cache invalidation, changed science windows, and physical replay/tampering for both hardware profiles.

The independent oracle in `tools/nav01/validate-initial-orbit.mjs` refuses to overwrite a prior run. `tools/nav01/evidence/r1/summary.json` records actual GMAT R2026a execution, frozen source hashes before/after, executable hash, and all scripts/CSV/console receipts. Initial Keplerian elements are independently authored; mixed burn vectors use a separate analytic elliptic Kepler-equation solution, not the game's initial state or basis helper. Four 24-hour cases each provide 1,441 actual states (5,764 total):

| Case | Maximum position difference | Maximum velocity difference |
|---|---:|---:|
| 400 × 900 km, no burn | 0.15434 m | 0.00017001 m/s |
| Perigee T/N burn | 0.12525 m | 0.00013462 m/s |
| T+1200 s mixed off-apse R/T/N burn | 0.07343 m | 0.00007867 m/s |
| 180 × 2000 km, 97.6°, no burn | 0.17093 m | 0.00018999 m/s |

All pass the predeclared unchanged 10 m position / 0.01 m/s velocity gates. The GMAT executable SHA-256 is `36c880ad6c3f5e69b2e7e90c9d9cec4086eced9c1073fc5b289966d54db15f5f`. This validates the scoped Earth point-mass trajectory, not J2, drag, radiation pressure, third-body gravity, ephemerides, launch ascent, or resource/communications physics. Existing released GMAT evidence and public fixtures were not rewritten.

## Handoff

Eight product files only: `src/sim/earth-orbit.ts`, `types.ts`, `index.ts`, `physics.ts`, `hazards.ts`, `launch.ts`, `persistence.ts`, `simulation.ts`. UI/scene/i18n and production output were not edited in this worktree. The accompanying `docs/nav01-domain-manifest.json` identifies exact transferable sources, tests, baseline, harness, and bounded raw evidence. Browser closure remains the root/UI/QA owners' responsibility.
