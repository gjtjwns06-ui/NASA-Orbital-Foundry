# M02 Exit Corridor v1: proposed next slice

Status: **proposal only; not implemented or verified**. Prepared on 2026-11-15 after read-only comparison of the original functional specification, requirements matrix and current source. No tests, new mission results or GMAT runs substantiate this proposal yet.

This is a candidate iteration **after** the ongoing M03 remote-operations Phase A. It neither expands that implementation nor replaces the original M02 requirements with a smaller definition of completion.

## Problem and player payoff

The original [M02 definition](reference-functional-spec-v1.1.md) requires scientific data reception and a specified heliocentric exit direction/energy range. The exit is an outward crossing of a frozen Mars-centered evaluation radius. The [requirements matrix](requirements-matrix.md) still records the relevant NAV04, RES01 and QA08 gaps.

Current `src/sim/physics.ts` deliberately adds a prescribed `[0,-24,0]` km/s planet velocity to asymptotic encounter velocities; it explicitly does not use actual planetary ephemerides. Current `getResult` in `src/sim/simulation.ts` tests safe periapsis and speed gain of at least 1 km/s without requiring a recorded exit crossing. The plan view displays these values but has no direction/energy target geometry. These are existing educational-model limits, not evidence that the complete original M02 objective is implemented.

The proposed loop is: **drag the approach → see the needed correction and outgoing path → aim for a fixed exit corridor → fly and observe → verify actual exit and Earth receipt → inspect a miss and redesign**. This connects the direct spatial control to a visible goal and a physically measured result. Maximum speed gain or minimum altitude must not always be the best answer.

## Bounded scenario

Author one immutable actual-epoch Mars encounter from an existing validated transfer baseline. Start at a fixed inbound state before one permitted correction node. This is a declared scenario initial condition, not an invented record of already-flown history.

The approach-plane handle controls a desired encounter. Solve the required velocity impulse at the same future node, preserve the unmodified pre-node segment, propagate the complete remaining encounter and charge the actual propellant. Use the existing scientific acquisition, resource, attitude and data-return systems.

After producing a baseline and at least three viable alternative solutions, freeze:

- Initial position/velocity, reference epoch, time scale and inertial frame.
- Correction-node time and permitted editing domain.
- Mars-centered exit evaluation radius and the outward-crossing rule.
- Heliocentric target velocity direction, its angular tolerance and specific-energy interval.
- Safe periapsis, mission deadline, science receipt requirements and score/model identity.
- Ephemeris, model and scenario hashes.

Do not adapt the goal to the player's selected solution. Select numeric bounds from authored and validated examples; this document does not invent an untested exit radius or promise particular solutions are feasible.

At the outward crossing, use the same actual time for both local state and JPL planet state:

```text
rHelio = rMars(t) + rLocal(t)
vHelio = vMars(t) + vLocal(t)
specificEnergy = dot(vHelio, vHelio) / 2 - muSun / magnitude(rHelio)
directionError = angle(vHelio, fixedTargetVelocityDirection)
```

Use km, km/s, km²/s² and degrees explicitly. The evaluation radius is **not** a new force-model boundary. Continue the planned moving-Mars local propagation until its actual patch boundary; do not switch to Sun-only propagation merely because the goal was evaluated.

Keep finite-radius velocities separate from asymptotic velocities. Mars-relative unpowered asymptotic speeds agree; finite incoming/outgoing speeds may be compared as equal only at equal planet-centered radii.

## Visible interaction

- Retain the actual Mars scene and player-built spacecraft.
- Show the previous path, proposed path, correction-node arrow and exit-event marker.
- Show a clearly labelled velocity-direction target cone and an energy interval. A velocity-space cone is not a positional portal; scaled vector arrows need units and a legend.
- Allow Mars-relative and Sun-relative vector views. Position/velocity transforms must match the displayed frame.
- A drag ghost is provisional until the latest solve is accepted. Preview success is distinct from a recorded achieved exit.
- Give useful misses: safe but wrong direction, correct direction but wrong energy, excessive correction cost, unsafe approach, and insufficient science reception.
- At the actual outward crossing, update the achieved indicator from recorded state. A visually attractive predicted path must not itself award navigation credit.
- Explain the measured miss in the result and return the player to the relevant approach handle or correction node.

The desired visual reward is seeing a deliberate route meet a fixed objective, then observing the same event during actual flight. This proposal does not claim that a polished overlay alone reaches the user's commercial-game graphics target.

## Suggested implementation ownership

| Owner | Proposed boundary |
| --- | --- |
| Domain owner | New pure `src/swingby/scenario.ts`, `planning.ts`, `exit-objective.ts`; immutable `public/data/swingby-scenario-v1.json`; reuse existing ephemeris, Kepler and fuel primitives |
| Runtime owner | Versioned correction/exit-event dispatch, actual fuel/attitude/data behavior, new save/replay identity as required |
| Root UI owner | Mission entry, direct controls, preview status, score/debrief adapter and comparison guards |
| Rendering owner | New `src/render/swingby-objective.ts` fed by physical event states; no independently invented success geometry |
| Independent reviewer | Domain oracles, GMAT comparisons, replay/race cases and real pointer/browser acceptance |

These are proposed file boundaries, not files already created. Select the runtime integration after remote-operations Phase A stabilizes; do not duplicate spacecraft, ADCS or communications engines to make this lesson work. Existing local M02 and released saves retain their original semantics and exact replay.

## Falsifiable acceptance

1. **One immutable definition.** UI, preview, runtime, results and saves consume the same scenario manifest. Epoch/frame/units, model constants, correction node, edit domain, exit goal and hashes are explicit. No design-dependent target relaxation.
2. **Playable examples.** Execute a successful baseline and at least three alternatives with distinct paths or resource tradeoffs, full science receipt, actual propellant use and recorded exit states. Examples alone do not establish the entire edit domain.
3. **Independent numerical validation.** Compare at least 20 samples across the permitted domain with GMAT: closest-approach difference ≤1%, exit speed difference ≤0.5%, exit-direction difference ≤0.5°, at the same outward evaluation radius. Document time/frame conversion and ephemeris identity. Existing synthetic-axis G0/G1 records alone cannot certify the new heliocentric claim.
4. **Physical continuity.** Position is continuous across the correction; velocity changes by the charged impulse. Unpowered Mars-relative asymptotic speeds agree. Equal-radius finite-state comparisons are separate. Crossing the evaluation radius causes no artificial force-model change.
5. **Independent objective failures.** Deliberate cases fail direction, energy, safety, fuel and science receipt separately. High speed gain with a wrong direction fails. Before the exit event, navigation is unevaluated rather than successful because of precomputed metrics.
6. **Direct and honest control.** Actual pointer editing changes correction, full path, predicted exit and subsequent actual result. Escape/undo restores the complete state. Stale or failed solves cannot enable launch or leave an accepted-looking goal. KO/EN × normal/large UI at 1280×720 keeps primary controls and the objective geometry visible and usable.
7. **Replay and timing.** Long warp versus partitioned requests and saves before/after the impulse and before/after the exit reproduce the same physical events and outcomes. No double impulse, duplicated exit credit or changes to old-save behavior.
8. **Cause-to-redesign loop.** Results name the actual measured error and event time, link back to the responsible control, and allow one approach change to alter the actual navigation outcome under the same goal, epoch, craft and score definition. Multiple changes are not attributed to a single cause.

## Remaining original scope

The original M02 departure-window editing, correction from the current live execution state and complete representative mission validation remain requirements until individually implemented and verified. This proposal is a meaningful next slice, not a claim that those items can be omitted. It also does not implement the original P1 asteroid continuation.

After this slice, a separate strong graphics/gameplay candidate is synchronized deployment/stowage motion with swept-volume interference (ASM05/OPS07). Real novice testing remains necessary: automated completion cannot replace the original five-person usability requirement.

## GMAT handoff notes from primary-source review

Reviewed the installed R2026a documentation and NASA's current source documentation on 2026-11-15; this is preparation, not a new GMAT execution or a passed comparison.

- Use the scenario's actual TDB epoch. GMAT supports `TDBModJulian`, but its numerical offset is **JD−2430000.0**, not the common astronomical MJD offset. Report the resulting TDB epoch as well as elapsed integration time so the harness can detect a time-scale/offset mistake. [NASA SpacecraftEpoch documentation](https://raw.githubusercontent.com/nasa/GMAT/main/doc/help/src/Resource_SpacecraftEpoch.xml)
- Configure and report **ICRF** axes explicitly for the new comparison. GMAT distinguishes ICRF from MJ2000Eq and models their transformation; treating numerical ICRF vectors as an arbitrary MJ2000Eq frame, as the older autonomous central-force checks disclosed, does not validate the new frame claim. [NASA CoordinateSystem documentation](https://raw.githubusercontent.com/nasa/GMAT/main/doc/help/src/Resource_CoordinateSystem.xml)
- Keep the independent GMAT local propagation comparison separate from the heliocentric reconstruction. If the reconstruction adds the same frozen Horizons Mars state to both local outputs, say exactly that; it validates the local propagation and transformation arithmetic, not an independent ephemeris model. Do not substitute GMAT's default DE405 planet state for the frozen dataset without quantifying that difference. The new harness must preserve its script, raw output, executable and dataset hashes and evaluate the same outward crossing before claiming acceptance.

The prerequisite adapter was then actually exercised with `node tools/swingby/check-gmat-frame.mjs`: one600-second central-Mars interval at the existing transfer's real Mars-entry epoch, explicit ICRF input/output and TDBModJulian reporting. Its11samples had maximum2.081mm position difference,1.078e-8m/s velocity difference and1.055microsecond elapsed/TDB time discrepancy, passing the declared10m/0.01m/s/1ms adapter limits. [Raw report and hashes](../tools/swingby/frame-probe/report.json). This supports the new harness's epoch/frame path only; no exit-corridor gameplay, independent planetary ephemeris validation or twenty-case acceptance has been completed by this probe.


## Exploratory impulse envelope, before scenario selection

`tools/swingby/explore-envelope.mjs` is a design study, not production gameplay or an acceptance oracle. Its first direct universal-variable adapter failed a six-point check against the accepted analytic Mars hyperbola: at the 38.4-hour inbound-to-periapsis interval, its Newton iteration did not converge. The rejected report and initial unchecked samples remain in `tools/swingby/exploration-v1/`; none may be used to choose a target. Released transfer local phases already use the analytic hyperbola, and no released propagation source was changed.

The explicit `--analytic-local` study reconstructs the osculating periapsis basis and elapsed anomaly from Cartesian input, then calls the existing analytic local propagator. It passes the six baseline consistency samples before producing 21 local-impulse examples at a provisional 100,000 km outward evaluation radius. The zero-impulse baseline returns the planned 1,000 km periapsis. A transverse 5 m/s correction changes it to roughly392 km or1,623 km; normal corrections change heliocentric exit direction. Cases crossing the body are marked, and mathematical continuation after impact is not an executable flight. Evidence: `tools/swingby/exploration-analytic-v1/report.json`.

These results demonstrate a potentially playable control sensitivity only. They do not freeze the mission goal, establish propulsion/attitude feasibility, prove science receipt, or replace the required independent GMAT comparisons. The next domain implementation must use a checked bounded propagation path; the unchecked universal-variable iteration is unsuitable for this new long-hyperbola adapter.
