# M02 Exit Corridor numerical and provenance contract

This is a separate `swingby-1.0.0` scenario, not a replacement for released M01/M02 or transfer models1–3. The immutable scenario is `mars-exit-corridor-2027-v1`; its hashed `status: candidate` is a data-authoring label. Acceptance and publication status belong to the evidence manifest, not a mutable field that would invalidate historical saves. Runtime and browser acceptance are separate gates.

## Player control and independent outcomes

The player drags a point on a fixed, finite inbound aiming plane. The checked inverse solver determines a two-component correction at elapsed3600s; the axes are fixed ICRF vectors. This plane is not an asymptotic B-plane. Controls are bounded to±7m/s per axis and8m/s total. Infeasible targets are rejected; projected solver trials never change the requested target or the final10m residual requirement.

The original Cartesian state at JD2461617.8583186734 TDB is the declared beginning of this local encounter. No earlier launch or transfer, fuel spending, attitude history or command transmission is invented. At the future node, the runtime uses actual attitude and power, applies the actual impulse vector and charges actual propellant. A missed burn leaves the original physical arc in force. The design forecast never becomes an executed checkpoint.

Success requires four independently displayed conditions: actual outward100000km crossing within a0.12° heliocentric velocity-direction cone; heliocentric specific energy between−284.5 and−279.5km²/s² at that same event; actual periapsis altitude≥250km; and at least3 unique spectra of quality≥0.4 completely received at Earth. The fixed target and energy band are authored mission objectives, not dynamically moved to match the player's prediction. The local model ends at outward577000km, with a96h maximum supported deadline. Future asteroid interception is not simulated.

## Orbit, epoch and reference frames

Local motion is a checked positive-energy Mars two-body hyperbola, μ=42828.375214km³/s² and reference radius3389.5km. Cartesian input is transformed to an osculating periapsis basis and propagated with the analytic hyperbolic anomaly. Reconstruction, energy and angular-momentum checks reject unsupported conics. The rejected long-duration universal-variable adapter is not used.

All physical vectors use ICRF, kilometers and km/s; elapsed times are seconds from the stated TDB epoch. Planet position and velocity come from the existing pinned JPL Horizons Earth/Mars table (`jpl-horizons-icrf-tdb-20260801-20280301-v1`). At each local sample, Mars's actual tabulated heliocentric state is added to the local state. Exit energy is |vSun|²/2−μSun/|rSun| at the finite exit sphere; it is not a claim of an independently integrated full n-body escape or an asymptotic solar energy invariant. Mars-only acceleration is an explicit patched-conic approximation. Sun/other-planet perturbations, nonspherical Mars gravity, atmosphere and stochastic navigation error are omitted.

Independent GMAT evidence is the24-case,192-state oracle at `tests/fixtures/swingby-gmat/oracle-v2.json`. The original failed v1 impulse-frame experiment remains in the main tools archive. Accepted GMAT commands explicitly convert ICRF impulse components through an independent MJ2000 reference before the burn. The JavaScript model itself continues using ICRF. GMAT validates local states, event geometry, finite-exit measurements and rocket-equation fuel; it does not validate spacecraft EPS, science, controller dynamics or the independent accuracy of the shared Horizons data.

## Authored CG-trim propulsion carrier

Exactly one installed, powered and connected `chemical230-v2` engine is required. The existing catalog engine and hardware hash remain unchanged. Scenario-only carrier `cg-trim-impulse-v1` adds0.4kg and12 game credits. The230s specific impulse is an existing educational engine assumption; no real manufacturer's finite thrust, minimum impulse bit or flight-qualified gimbal performance is claimed.

The carrier uses a fixed annulus, local pivot[0,0,0.12]m, nominal local−Z thrust and a maximum10° gimbal. The thrust line passes through the actual craft center of mass. The annulus centroid and inertia, actual initial0.25kg propellant, fuel depletion and existing part masses are included. The narrower scenario bell fits the unchanged engine OBB (±0.19m inX/Y and0…0.60m inZ); stock legacy geometry is not silently rotated outside its collision proxy. Renderer geometry must use this same profile.

Preparation begins1800s before the node;60s of powered valve preparation is required. Actual pointing must be within0.1° and the modelled scalar angular rate≤0.01°/s. The finite attitude controller uses the connected ADCS torque/momentum limits with the largest diagonal inertia of the actual craft. This is a bounded scalar slew approximation, not a full rigid-body wheel saturation or flexible-body simulation. The thrust event itself is an ideal instantaneous, CG-aligned impulse, not a finite-thrust integration. Propellant is m0·(1−exp(−Δv/(g0Isp))) and is charged once only after execution gates pass.

The retained0.25kg load makes fuel expenditure and efficiency meaningful, including an approximately25% economy-route saving. It does not create an independently reachable fuel-shortage puzzle throughout the entire allowed hardware/control envelope. A tighter load or a fuel-loading mechanic requires a new scenario identity and validation; this mission is not tightened merely to manufacture another failure.

## Shared resource/science model and event policy

`src/flight/environment.ts`, `resources.ts` and `data.ts` are extracted from released transfer3. They preserve actual Sun incidence and physical aperture/OBB occlusion, inverse-square solar power, moving Earth reception geometry, occultation, real RF link rate, finite storage, battery charge/discharge limits, instrument exposure/readout and complete-packet Earth credit. New runtime policy supplies the actual local state, mode, dynamic carrier/fuel inertia and preparation electrical load. It does not fabricate a FullTransferSolution.

New M02 intervals use cruise60 or300s, a5s near-encounter grid, and active attitude1,0.5 or0.25s. Physical burn/periapsis/exit/surface events, operation changes, received signals, EPS thresholds, observing-condition crossings, exposure/readout completion, unique300s bins and120s capture cadence are explicit boundaries. The ending attitude uses the previous operation's left limit, evaluated at the true endpoint geometry: a new operation cannot steer retroactively. Zero/substep demands update only requested time until a canonical interval can commit.

Exposure and readout are actual elapsed-time work. Interval eligibility and spectrum-bin identity use the left limit, while completion is stamped at the exact endpoint. A fully powered exposure ending exactly at observe.end is retained and can read out afterward; a genuinely unfinished exposure loses eligibility when the mode changes. Only≤100ns floating-point completion residue may be closed at a committed endpoint; this prevents a tiny subtraction remainder from waiting for a whole later grid interval. It is not a tolerance for seconds of unfinished exposure. Optical/resource integration remains a declared sampled model; it is not a certified continuous rigid-body or radiation environment. Science transmissions retain the released conservative60s frame batching and moving-Earth light-time semantics, so received credit never precedes reception.

## Presentation path

`getSwingbyTrajectory(source,count)` retains its existing uniform-count contract. `getSwingbyVisualTrajectory(source)` is a separate display-only sampler. It anchors exact correction, periapsis, exit, endpoint and current time, and subdivides each smooth local arc until the bound μ/rmin²·Δt²/8≤2km. The analytic minimum radius supplies the acceleration maximum. The2000-point cap and `certified` flag are explicit; an unresolved cap cannot silently claim a certified curve. Baseline uses245 points, max bound1.994034km and minimum chord altitude1004.146km. Tests evaluate additional interior samples and all five candidate routes.

The error bound applies to Mars-relative ICRF coordinates. It does not certify linear interpolation of the Sun-frame table. Runtime paths include the future continuation of the currently executed physical branch. The renderer must split actual trail at committed time and label the remaining line as prediction. Only `achievedExit` represents a recorded outcome. Mars surface rotation is a renderer-declared visual convention, not a separately validated Mars body-orientation ephemeris.

## Save, identity and compatibility

Save format `orbital-foundry-swingby` version1 has a separate IndexedDB database/slot. It pins model, scenario, carrier, hardware catalog and Horizons identities, plus the numerical profile. Unknown fields, nonfinite/deep/oversized inputs and unsupported profiles are rejected. The UTF-8 envelope is bounded to2MiB. Imported coordinates, fuel, science, exit records and outcomes are never authoritative: a detached, cancellable, bounded replay re-solves the original plan, starts at the declared initial state and compares the full checkpoint exactly. Editor changes are not execution history.

Historical transfer1/2, sim/hardware source and catalog data are unchanged. Only transfer3 `state.ts` and `runtime-v3.ts` call the extracted kernel. The immutable old bundle and binary52-record oracle preserve signed zero/undefined and compare full state, telemetry and early/no/late outcomes exactly. Final post-extraction replay passed all52; future algorithm changes require a version/identity decision and renewed evidence rather than silently reinterpreting saved flights.

## Acceptance evidence and remaining scope

The first convergence run failed and is retained under `tools/swingby/rejected-convergence-v1`. It exposed real premature endpoint steering and coarse acquisition completion, not a tolerance problem. The corrected four-profile report `docs/qa/swingby/convergence.json` passes the predeclared0.1Wh,0.05°,0.1dB,0.1s gates with identical packet IDs and success outcomes. Maximum energy-minimum difference is0.005429Wh and attitude difference0.011585°; packet and physical-event times agree exactly in the tested flights.

`docs/qa/swingby/extraction-exact.json` records final historical52 equality. Full alternative-craft, independent failure and strict exit replay evidence is `docs/qa/swingby/flight-acceptance.json` once completed. Domain acceptance does not imply the separate worker, pointer interaction, renderer, context recovery or deployment checks have passed. Live M02 uplinked trajectory changes, finite-thrust burns, launch-window optimization, uncertainty/radiation and onward asteroid missions remain outside this bounded slice.
