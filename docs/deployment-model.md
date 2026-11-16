# First Light: physical deployment and commissioning

This separate mission starts a spacecraft in a declared 600 km, 51.6° circular Earth orbit. The player moves hardware on its mounting surface, inspects actual hinge sweeps, and edits the onboard deployment and communication programme. The acceptance target is at least 90 W with stable pointing for 60 seconds, followed by 16 Mbit of commissioning diagnostics received on Earth within three hours. These are authored educational requirements. The report is spacecraft commissioning data, not a newly acquired scientific image.

The default repair lesson has a passive cable guide that clears both endpoint poses but obstructs an intermediate wing angle. Moving the guide changes its real collision and shadow proxy while retaining its mass and cost. The compact articulated wing and a larger fixed-wing/fairing alternative can both complete the mission through their actual power, attitude and radio calculations. A separate recovery lesson uses ordinary batteries, body panels and scheduled operations; it injects no emergency energy.

## What is computed

- One rigid-link topology supplies joint axes, parent transforms, collision boxes, apertures, mass properties and renderer poses. Forward kinematics and the full inertia tensor are evaluated for the current configuration. Whole-craft COM position is distinct from the structural origin used to place the rendered bus.
- Conservative swept-clearance checks subdivide angle intervals and use box separation plus motion bounds. Clear, blocked and unresolved results stay distinct. Unresolved intervals cannot authorize motion. Only explicitly declared bearing-contact pairs receive contact exemptions.
- Powered release, acceleration, cruise, braking and latch verification consume physical elapsed time and motor input energy. Normal and gentle profiles are authored ideal regulated actuators, with a conservative work/available-DC feasibility bound. They are not a manufacturer's motor torque-speed curve, flexible-panel model or flight qualification.
- Shape motion, body angular momentum and reaction-wheel momentum are coupled. Initial and moving configurations share the same physical mass and COM model. Independent rigid-body references and step-convergence tests supplement conservation checks.
- Articulated panel orientations, electrical contacts, sampled shadow rays, battery energy, bus output limits, attitude error and RF contacts affect operation. Optical visibility uses a declared nine-ray approximation. Decorative mesh screws and circuit details do not create additional physical mass or ray blockers.
- The supported Iris radio mode is 131072 bit/s. Useful report data is framed separately from padded RF occupancy. Admission and receipt respect time, pointing, visibility and the moving receiver. Data is counted after arrival, not when queued or emitted.

## Failure and signals already in flight

An EPS output limit can fail the spacecraft while energy remains in its battery. The live controller pauses at the committed fatal instant. Already emitted signals can subsequently reach Earth when the player continues reception. No new powered work, solar credit or RF emission is granted during this drain. Receipt can increase after failure; the mission remains failed. The UI distinguishes the spacecraft failure time from the current receiver/simulation time.

The regression derives an actual failure between the final frame's emission and arrival using a normal second radio and a scheduled wing stow. It does not install a successful packet or a resource checkpoint. The pending and fully received failed states must each replay from original inputs.

## Coordinates, display and persistence

The orbit uses EarthMJ2000Eq and elapsed SI seconds from the explicit `2026-11-15 00:00:00 TAI` epoch. It is not relabeled as ICRF/TDB. The orbit view enlarges the spacecraft for inspection; the Earth radius, orbit, actual COM and body attitude remain physical inputs. Camera motion and reduced-motion preferences do not change the simulation.

Editor ghosts are detached candidates. Dragging a hinge preview never rotates a launched mechanism or refunds its work. A separate Worker owns accepted inputs, runtime, forecasts and strict replay. Explicit save and exit use a pause barrier; source session and save identifiers remain valid across a later graphics pause. The commissioning slot is separate from released Earth/Mars/swingby saves.

JSON imports are replayed, not trusted as physical state. Unsupported or damaged local bytes are retained with an original-file download; autosave remains disabled until an explicit replacement. Node and browser transcendental arithmetic are not assumed byte-identical: a preserved Node/Chrome fixture mismatch is not evidence of cross-runtime save compatibility. Actual same-browser replay and declared Chrome/Edge checks have their own evidence scopes.

## Sources and evidence limits

Existing component identities and publicly sourced values remain in [component data](component-data.md) and [hardware model](hardware-model-v2.md). The tri-leaf integration, support structures, mechanism controller, array pattern, motor profiles, ground network, credits and mission requirements are explicitly authored game assumptions. New internal art is original illustrative geometry inside the supplied physical envelopes, not manufacturer CAD.

The existing [GMAT comparison](gmat-validation.md) and [M02 encounter study](m02-gmat-authoring-oracle.md) concern their stated orbital cases. They do not certify this mechanical/electrical model. Domain tests, actual browser operation, graphics ownership and performance are separate gates; final release evidence belongs in `qa/milestone-8-local.md`. A broader negative ordering fixture between separate devices remains outside the demonstrated set: the verified ordering negative concerns sibling wing hinges, while the assembled wing-then-RF sequence is positively certified.
