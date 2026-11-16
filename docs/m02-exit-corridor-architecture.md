# M02 Exit Corridor: runtime and control contract

Status: **design proposal; no production implementation or new flight validation**. Prepared on 2026-11-15 during the 8D integration freeze. This document supplements [the scope proposal](m02-exit-corridor-proposal.md); it does not change that document's acceptance criteria or declare the original M02 complete. Reading existing reports and source is the evidence for this decision. No new GMAT, full-flight, browser or performance run was performed for this document.

## Decision

Build a separate `swingby-1.0.0` actual-epoch mission around a fixed inbound Mars state and one future correction. Reuse the actual-epoch **transfer** environment, spacecraft resource, ADCS, instrument readout and Earth-reception calculations through a small shared flight kernel. Do not extend the synthetic `sim/simulation.ts` Mars geometry, fabricate an Earth-to-Mars `FullTransferSolution` for a local mission, or copy an entire resource engine into `src/swingby`.

First extract the necessary pure calculations and interval integration from `transfer/runtime-v3.ts` under an exact historical-runtime differential gate. Keep transfer 1/2 and sim 1.3/hardware 2 source and numerical policy unchanged. Transfer 3 keeps its current stepping, operation transport, radio policy and results; sharing code is allowed only if its existing checkpoints remain exactly equal. This extraction is a prerequisite, not an opportunity to tune historical behavior. If equality fails, stop the extraction and identify the changed arithmetic before implementing the new mission.

The new mission has its own scenario, propulsion assumptions, numerical profile, result definition and save slot. It is not transfer 4 and does not acquire the M03 command-network protocol merely by sharing its resource calculations. The bounded slice has an immutable preflight correction and onboard science timeline; live TCM uplink, departure-window editing and later asteroid continuation remain separate original requirements.

## What the existing study establishes

The [analytic envelope report](../tools/swingby/exploration-analytic-v1/report.json) reconstructs an osculating hyperbola from Cartesian input and uses the accepted analytic local propagator. Its six baseline consistency samples differ by less than 0.000001 m; they are an internal consistency check, not an independent orbital oracle. The zero-impulse case returns a 1,000 km periapsis. A transverse -5/+5 m/s impulse changes it to approximately 392/1,623 km. A +2 m/s normal impulse changes heliocentric exit direction by 0.2461 degrees.

The [rejected universal-variable study](../tools/swingby/exploration-v1/report.json) failed Newton convergence across the long inbound hyperbola. Do not reuse that unchecked propagation path for this mission. The released transfer local phase already uses the analytic hyperbola and was not changed.

The [GMAT frame probe](../tools/swingby/frame-probe/report.json) validates only one 600-second local interval, explicit ICRF/TDB conversion and its eleven samples. It is not the twenty-case exit validation or a propulsion/science proof.

## Scenario candidate to freeze before gameplay implementation

These are concrete authoring candidates. Freeze the manifest and hash only after the four full-flight examples, negative examples and independent propagation checks pass. If a candidate changes during authoring, preserve the rejected study and explain the change. Once frozen, no target varies with the player's craft, correction or solver result.

| Field | Proposed value / provenance |
| --- | --- |
| Scenario identity | `mars-exit-corridor-2027-v1` |
| Time/frame | elapsed TDB seconds from scenario start; Cartesian axes ICRF; positions km, velocities km/s |
| Ephemeris dataset | `jpl-horizons-icrf-tdb-20260801-20280301-v1`; exact bundled Earth/Mars content hashes pinned in manifest |
| Reference node epoch | JD TDB `2461617.89998534`, from accepted transfer elapsed `22325758.73338245` s |
| Scenario start | 3,600 s before that node; initial state obtained once from the checked analytic inbound arc and serialized explicitly |
| Correction node | scenario elapsed 3,600 s, immutable; about 38.40035 h before the uncorrected periapsis |
| Exit evaluation sphere | Mars-centered radius 100,000 km; first outward crossing after periapsis, `dot(r,v)>0` |
| Local model endpoint | actual outward 577,000 km Mars patch crossing; the 100,000 km objective sphere does not change dynamics |
| Latest mission time | candidate 96 h from scenario start; stop earlier at actual patch exit or physical failure |
| Safety | minimum altitude 250 km; actual surface contact is a separate terminal failure |
| Editor domain | two frozen transverse impulse coordinates, each -7 to +7 m/s, norm at most 8 m/s; unsafe/fuel-infeasible previews remain visibly invalid |
| Initial propellant | candidate 0.25 kg in the bus tank, explicitly an authored scenario initial condition, not a fabricated prior-flight ledger; check against each bus capacity |
| Science | at least 3 unique fully received spectra, quality at least 0.4, actual instrument exposure/readout/storage/link constraints; initial 120 s minimum acquisition spacing and 300 s uniqueness bins |
| Initial resource state | fully charged installed packs, no stored science/signals, initial solar-pointing attitude and zero angular rate; all explicit in the manifest/model |

The initial propellant allocation is intentionally distinct from a bus's tank capacity. The mission evaluation must use **actual initial propellant** for wet mass, center of mass, inertia and delta-v. It must not reuse `evaluateDesign().wetMassKg` as though all six/four kilograms remain aboard. No inferred cruise history or prior launch is awarded; this is the start of the declared local scenario. If 0.25 kg fails to produce useful feasible and infeasible choices across the two buses, adjust it before the scenario is frozen, with full-flight evidence.

Node anchor from the existing report:

```text
rMarsICRF = [429318.8495655557, -36703.516311628395, -66504.17666674832] km
vMarsICRF = [-3.0099622565484885, 0.30694413558878475, 0.48876657085373904] km/s
muMars = 42828.375214 km^3/s^2; radiusMars = 3389.5 km

control X = [ 0.1562129374280655, 0.9062145631889668,  0.39290289340284285]
control Y = [-0.10517112631692882,0.4107856306096325, -0.9056457364079372]
incoming  = [-0.9821082182577061, 0.1001515409211235,  0.15947763630615536]
```

The frozen target direction is `normalize([16.0771950773341, -15.997929860769286, -7.476894084426893])`, the study's finite-radius heliocentric exit velocity for `(X,Y)=(0,+2)` m/s. Candidate cone half-angle: **0.12 degrees**. Candidate energy interval: **[-284.5, -279.5] km²/s²**. Reference energy is -281.8898540956981 km²/s² at JD TDB 2461619.8421501797. The zero-correction trajectory misses the direction cone by 0.2461055444 degrees despite satisfying the candidate energy band. Thus zero correction does not earn the objective.

| Full-flight authoring example | X/Y impulse (m/s) | Intended distinction | Evidence now |
| --- | --- | --- | --- |
| Baseline successful candidate | 0 / +2 | Aim at center of corridor | Orbital study only; full resources/attitude/receipt unverified |
| Alternative A | -1 / +2 | Lower approach, positive energy change | Not yet evaluated |
| Alternative B | +1 / +2 | Higher approach, negative energy change | Not yet evaluated |
| Alternative C | 0 / +1.5 | Less fuel, smaller direction margin | Not yet evaluated |

The three alternatives are explicit hypotheses to test, not reported successful designs. They must complete with the same immutable goal and actual fuel/attitude model. Do not automatically widen the goal when a player misses it. At least two materially different spacecraft/schedule choices should also remain playable; controller placement, power and science timing must have observable consequences.

## Direct control: approach target, then a real impulse

The primary handle is a desired intercept on a **fixed inbound aim plane**, not a teleportable periapsis. Define its normal as the frozen `incoming` axis, axes as control X/Y, and center as the uncorrected arc's position when it first crosses a frozen inbound radius (candidate 30,000 km). Freeze that plane in Mars-centered ICRF; it is an aiming surface, not the classical asymptotic B-plane unless the actual B-plane basis/equations are implemented and labelled.

Dragging the handle gives `(aimXKm,aimYKm)` on that plane. A bounded two-variable shooting solve finds X/Y velocity increments at the **same future node** whose corrected arc first crosses that plane near the desired point. Compute a finite-difference Jacobian, use a trust-region step, retain a fixed branch, and require a finite residual (candidate <=0.1 km). Singular Jacobian, missing inward crossing, nonhyperbolic state, control-domain excess or iteration limit returns an invalid ghost with a machine reason; never silently clamp to another accepted-looking solution. The primary plan stores the aim target and frozen solver version; saved accepted impulses are re-solved, not trusted.

An advanced correction-vector gizmo may directly edit X/Y impulses and compute the corresponding aim point through the same forward map. It must not be a second conflicting authoritative plan. Conversion updates the single aim-target representation, then the accepted result is recomputed. The along-track component and node time are fixed in this slice; show the locked degree of freedom instead of a nonfunctional third handle.

Show before/after paths, a nonmoving pre-node segment, the burn vector, propellant cost, actual slew/preparation interval, encounter and outward-exit marker. Drag is provisional until the latest request ID and design revision are accepted. Escape/undo restores aim, schedule, craft and accepted solution together. Failed/stale previews cannot enable launch. A velocity-space target cone and energy ruler accompany the 3D path: they are not a spatial portal. If their small angle is exaggerated, label the vector-angle magnification explicitly.

## Propulsion and actual attitude

Current `chemical230-v2` is an authored 2.8 kg, 230 s Isp, 4 W active assembly; it has no source-backed thrust, burn duration or gimbal specification. Current XACT reaction-wheel torque/momentum limits are not sufficient to absorb arbitrary off-center thrust. A craft with a large side-mounted array can have a substantial CG offset. Checking only fuel and desired body direction would conceal the resulting angular impulse. NASA's [rocket-control explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-control/) relates thrust direction, CG and torque; it does not substantiate any numerical parameter proposed below.

Recommended bounded teaching model: an explicitly authored **CG-trim gimbal carrier** used by this scenario. It is a separate hashed mission propulsion profile attached to the selected existing engine, not a silent change to the hardware-2 catalog or a vendor claim. Candidate carrier parameters are +0.4 kg, +12 game credits, maximum gimbal angle 10 degrees, 60 s preparation using the assembly's 4 W active load. Include carrier geometry/centroid in physical mass/inertia and expose it in assembly cost, model disclosures and the nozzle visual. The scenario may require this carrier rather than creating another global catalog model in this iteration. If a carrier cannot fit the shared geometry, reject placement instead of adding invisible mass or a floating nozzle.

At preparation start, derive the nominal thrust direction and application point from the selected engine's actual part transform. The candidate gimballed thrust line passes through the **current** CG. Compute its required angle relative to nominal thrust. Beyond 10 degrees is infeasible; no reaction-wheel bonus rescues it. Use that local thrust vector to request a body orientation aligned with the intended inertial delta-v. Choose roll deterministically to favor solar incidence without altering thrust alignment. Slew with the same finite torque, momentum, power and inertia model used for observations; burn preparation has explicit priority over onboard charge/observe/downlink operations and is shown as a locked timeline interval.

Candidate preparation start is node minus 1,800 s. It consumes real time and power. At the node require connected engine, operational EPS, safe mode off, enough propellant, gimbal within limit, settled angular rate <=0.01 deg/s and actual thrust-pointing error <=0.1 degree. These are authored model tolerances to validate, not XACT/vendor accuracy claims.

Then apply an **ideal instantaneous impulse along the actual body-transformed gimballed thrust vector**, not a snap to the planned inertial vector. Decrement propellant exactly once:

```text
fuelUsedKg = wetMassBeforeKg * (1 - exp(-deltaVMps / (9.80665 * ispSeconds)))
vAfter = vBefore + actualThrustDirectionICRF * deltaVMps / 1000
```

Mass, CG and inertia change with the resulting tank mass. The carrier aims through CG so this ideal impulse adds no modeled torque; finite burn acceleration, plume interaction, feed dynamics and gimbal transient torque remain outside scope. Do not invent a Newton rating or claim finite-burn validation. GMAT's [ImpulsiveBurn documentation](https://raw.githubusercontent.com/nasa/GMAT/main/doc/help/src/Resource_ImpulsiveBurn.xml) distinguishes an instantaneous delta-v from a finite burn and provides Isp/mass-depletion settings; matching that orbital model does not validate the authored preparation or gimbal hardware.

If any gate fails, record `BURN_SKIPPED` with actual reasons and keep flying the uncorrected physical branch. A zero impulse records a no-op without fuel consumption. A missed burn cannot adopt the preview's corrected future, and retrying a worker advance cannot execute it twice. Capture actual before/after states, quaternion, thrust vector, fuel, CG, gimbal and pointing error in the immutable event ledger. The event rebuilds the runtime's future analytic arc from actual post-burn Cartesian state. The preview remains explicitly predicted.

## Propagation, environment and event rules

For every accepted Cartesian state, construct a bounded hyperbolic descriptor: positive specific energy, eccentricity >1 by a declared tolerance, finite angular momentum, periapsis basis and signed elapsed hyperbolic anomaly. Validate reconstruction at the input state before accepting it. Use existing `hyperbolicLocalStateAt` with that descriptor. Reject degenerate/nonhyperbolic inputs; no unchecked fallback to the long universal-variable solve.

Retain the original inbound arc before the correction. Position is continuous at the impulse; velocity changes only by the recorded actual delta-v. Root-solve radial velocity zero for periapsis, and radius minus evaluation/patch radius for directed crossings. Bracket on the appropriate inward/outward branch; a root at the wrong direction is not the event. Event candidates are derived separately for the predicted and actual branch.

At the actual outward 100,000 km crossing, evaluate the frozen target using Mars ephemeris at that same TDB epoch:

```text
rSun = rMars(epoch) + rLocal
vSun = vMars(epoch) + vLocal
energy = dot(vSun,vSun)/2 - muSun/length(rSun)
directionError = angle(vSun, fixedTargetDirection)
```

Record the local and heliocentric states, radial sign, energy, angular error, margins and per-requirement booleans. Before this record exists, navigation is `pending`. Do not reconstruct achieved navigation from the current editor's solution or credit a preview. Continue Mars-local propagation after this evaluation until the actual 577,000 km outward patch boundary; this slice stops there and does not claim a later solar trajectory. Science packets still in flight at that endpoint are not counted. The scenario's fixed latest deadline prevents an unsupported indefinitely extended encounter.

Resource environment uses the actual TDB/ICRF Cartesian state, same bundled planet data, geometric solar incidence and shadows, selected instrument rays, selected RF chain and future ground-reception endpoint. Preserve the existing educational five-station network and its rotation approximation with its definitions/content identity pinned. Neither actual station service nor UT1/EOP-grade Earth orientation is claimed. JPL's [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) defines the frame/time/vector output conventions; the offline data provenance remains the existing requested ICRF, Sun-origin, TDB, no-aberration vectors.

Canonical stepping must split at preparation start, valve-power start/end, node, operation boundary, periapsis, capture/readout completion, signal receipt, eclipse/EPS event, objective crossing, contact and patch exit. Endpoint ordering is fixed: finish prior interval; commit power/attitude; receive already-arriving data; resolve scheduled burn gate; rebuild actual path if fired; settle physical state; record coincident directed events; begin the next interval. No zero/sub-step demand may create an unjournaled physical transition. A warp cannot step across a burn, impact or objective event and repair the result afterward.

## Shared kernel boundary and historical compatibility

| Current source | Extract/reuse | Preserve outside shared kernel |
| --- | --- | --- |
| `transfer/state.ts` | Environment from an already evaluated actual-epoch Cartesian state; retain exact station/ray/light-time arithmetic | Transfer phase construction and all current `transferStateAt` public frame semantics |
| `transfer/runtime-v3.ts` telemetry | Solar/EPS loads, instrument/RF visibility, power limits, hardware acquisition/readout | Command RX/TX/ACK mode policy, `OperationsSnapshot`, Korean/English presentation and transfer-specific result |
| `transfer/runtime-v3.ts` interval work | Wh integration, finite slew, data writes/transmission/receipt with explicit context | Command transport guards and ACK reservation; transfer event names/deadline/trajectory |
| `hardware/*` | Existing connections, optics, OBB rays, ADCS torque/momentum and RF math | Hardware-2 catalog/version/hash unchanged; dynamic tank/carrier mass supplied explicitly for new runtime only |
| `transfer/math.ts` | Checked analytic local hyperbola primitive | Lambert/escape-stage semantics not imported into local mission |

The kernel accepts explicit policies rather than inspecting model-name strings inside physics: requested operation/attitude, selected radio power mode, dynamic mass properties, trajectory state, deadline and reserved RF airtime. Historical transfer-3 passes its original values and preserves evaluation order. Swingby passes its own burn and schedule context. No dynamic UI callbacks or closures enter saved state; worker-local adapters are recreated from verified immutable inputs.

Proposed shared source: `src/flight/{types,environment,resources}.ts`. Proposed new domain: `src/swingby/{types,scenario,conic,planning,propulsion,runtime,persistence,engine}.ts`. Extract only code needed by these consumers. Avoid a broad framework refactor and do not generalize command protocol into the new slice.

Before adopting the extraction, compare frozen pre-extraction transfer-3 outputs **exactly**, not only final score: whole runtime/checkpoint, events, packets, transport records, every boundary time, energy, attitude, rates and pending demand. Include before TX, partial TX, propagation, onboard install, ACK emission/reception, constrained-EPS SAFE_MODE, cancelled retry and full early/no/late lesson results. Request partitions and 300/600 × 1/0.5/0.25 profiles retain their old results. The previously rejected broad-cache/compiled-cache experiments are not part of this work. Sim/hardware and transfer-1/2 source manifests and released fixtures remain unchanged.

## Proposed public API (to freeze before parallel UI work)

Names below are the proposed contract, not available exports. `Vec3`, `Quaternion`, `Design` and operation block primitives can be reused; `FullTransferSolution` is deliberately absent.

```ts
type SwingbyModelVersion = 'swingby-1.0.0';
interface SwingbyPlan {
  version: 1;
  scenarioId: 'mars-exit-corridor-2027-v1';
  scenarioHash: string;
  aim: { xKm: number; yKm: number }; // one authoritative control representation
  operations: Array<{ id: string; kind: 'charge'|'observe'|'downlink'; start: number; end: number }>;
}
interface SwingbyScenario {
  id: string; hash: string; modelVersion: SwingbyModelVersion;
  epochJdTdb: number; frame: 'ICRF'; timeScale: 'TDB';
  initial: { positionKm: Vec3; velocityKmS: Vec3 };
  correctionSeconds: number; initialFuelKg: number;
  aimPlane: { centerKm: Vec3; normal: Vec3; xAxis: Vec3; yAxis: Vec3 };
  control: { maxAxisMps: number; maxMagnitudeMps: number; solverVersion: string };
  exit: { radiusKm: number; targetDirection: Vec3; toleranceDeg: number; energyRangeKm2S2: [number,number] };
  safetyAltitudeKm: number; patchRadiusKm: number; deadlineSeconds: number;
  science: { targetPackets: number; minimumQuality: number; captureIntervalS: number; uniqueBinS: number };
  ephemeris: { datasetId: string; earthHash: string; marsHash: string };
  propulsionProfileId: string; propulsionHash: string;
}
interface SwingbySolution {
  modelVersion: SwingbyModelVersion; scenarioHash: string; inputHash: string;
  plan: SwingbyPlan;
  correction: { time: number; xMps: number; yMps: number; vectorMps: Vec3; residualKm: number };
  predicted: { periapsisSeconds: number; periapsisAltitudeKm: number;
    exit: ExitMeasurement; patchExitSeconds: number; fuelUsedKg: number };
  arcs: AnalyticLocalArc[]; // numeric periapsis basis/state, mu and anomaly time; no functions
}
interface ExitMeasurement {
  time: number; jdTdb: number; localPositionKm: Vec3; localVelocityKmS: Vec3;
  heliocentricPositionKm: Vec3; heliocentricVelocityKmS: Vec3;
  outwardRadialSpeedKmS: number; energyKm2S2: number; directionErrorDeg: number;
  directionPassed: boolean; energyPassed: boolean;
}
interface SwingbyRuntime {
  modelVersion: SwingbyModelVersion; scenarioHash: string; propulsionHash: string;
  craft: Design; plan: SwingbyPlan; time: number; requestedTime: number;
  numerics: { cruiseStepSeconds: 60|300; activeStepSeconds: 1|0.5|0.25 };
  flight: FlightResourceState; // energy, q/rate, fuel, readout, storage, signals, physical events
  burn: null|BurnExecutionRecord; // fired / skipped / no-op; immutable actual before/after
  actualArcs: AnalyticLocalArc[];
  achievedExit: null|ExitMeasurement;
  status: 'running'|'complete'|'failed'; failureCode: string|null;
}

getSwingbyScenario(): Readonly<SwingbyScenario>;
createSwingbyPlan(preset?: 'starter'|'baseline'|'lower'|'higher'|'economy'): SwingbyPlan;
solveSwingbyPlan(plan: SwingbyPlan, craft: Design):
  {status:'solved';solution:SwingbySolution;evaluation:SwingbyEvaluation} |
  {status:'infeasible';issues:SwingbyIssue[];ghost?:SwingbyGhost};
createSwingbyRuntime(solution: SwingbySolution, craft: Design, options?: SwingbyNumerics): SwingbyRuntime;
advanceSwingby(state: SwingbyRuntime, elapsedSeconds: number, maxSteps?: number): SwingbyRuntime;
getSwingbyTelemetry(state: SwingbyRuntime): SwingbyTelemetry;
getSwingbyResult(state: SwingbyRuntime): SwingbyResult;
getSwingbyTrajectory(source: SwingbySolution|SwingbyRuntime, count?: number): SwingbyPathSample[];
makeSwingbySave(plan: SwingbyPlan, craft: Design, runtime?: SwingbyRuntime): SwingbySave;
createSwingbyReplay(text: string): ReplayTask<LoadedSwingbySave>;
```

`SwingbyEvaluation` includes actual loaded mass, carrier mass/cost, required/available fuel, attitude-preparation feasibility, gimbal, science/electrical/connectivity warnings and launchable status. Geometric feasibility does not promise full science success; full forecast is a separate worker request. `SwingbyTelemetry` exposes actual axes, current thrust/gimbal geometry, burn phase and navigation `pending/passed/failed`, plus existing resource/instrument/link fields. `SwingbyPathSample` carries time and both Mars-relative/heliocentric vectors; renderer must not mix frames at path endpoints.

`SwingbyResult` contains independent requirement records for actual exit direction, actual exit energy, safety, completed science reception and mission termination. Score cannot turn a failed hard requirement into success. Proposed new score identity is `swingby-exit-1`: navigation 40, science 40, resource efficiency 20; freeze precise bounded formulas after balancing, and never compare its raw score against old M02 or M03. Each diagnostic links to a recorded event and relevant control; comparison requires same scenario/model/score/numerics/craft baseline conditions.

## Save, worker and renderer ownership

Use a distinct `format:'orbital-foundry-swingby', version:1` envelope and IndexedDB key `autosave:swingby-1.0.0`. Strictly validate finite numbers, unknown keys, accepted hardware/profile/ephemeris/scenario/propulsion identities, limits, sorted nonoverlapping operation blocks and source byte/depth caps. Suggested cap is 2 MiB because this slice has no command journal. Do not repurpose or overwrite old M02/transfer saves. Legacy assembly import creates a new explicit hardware draft; it never upgrades a running save implicitly.

Runtime restoration re-solves the plan, replays from the immutable scenario initial condition to the committed checkpoint time and exact pending demand, and compares full state. Imported arcs, achieved-exit records, fuel and success fields are untrusted. Store no function, environment cache or graphics object. Chunked replay supports cancel without replacing the currently running session. Pre/post-burn and pre/post-exit checkpoints must reproduce the event exactly once. A draft-only save may be infeasible but must preserve the actual input and explicit numerical profile.

Worker messages carry session/request ID and draft revision. Separate `solve` (geometry and design feasibility) from `forecast` (actual full resource flight), `launch`, `advance`, `warp`, `save` and `restore`. Apply stale-result guards before changing accepted geometry or launchability. Warp targets are capped to the next physical control/exit event; target choice never changes the canonical partition. Detached forecasts and replay cannot mutate the live runtime. UI cannot claim actual success from `solution.predicted.exit`.

Ownership after approval: domain owner handles the extraction, scenario/solver/runtime/save and numerical evidence; root handles worker lifecycle, mission entry, actual pointer controls and result integration; renderer owner handles `src/render/swingby-objective.ts`, thrust/aim-plane glyphs and frame-correct path DTOs; independent reviewer handles GMAT oracles, adversarial replay/attitude cases and real browser flows. Freeze the public types before those parallel edits. Existing flight/resource functions are the authority for visuals; renderer does not calculate independent success or assign energy/fuel.

## Independent validation plan

Author at least **24** GMAT cases: the required baseline plus three alternatives, controlled direction/energy misses and domain edges. Twenty-four exceeds the original twenty-case floor without presenting a sparse grid as proof of every input. Initial list in m/s:

```text
(0,0), (0,2), (-1,2), (1,2), (0,1.5), (0,-2),
(-2,0), (2,0), (-5,0), (5,0), (0,-5), (0,5),
(-2,-2), (-2,2), (2,-2), (2,2),
(-5,-5), (-5,5), (5,-5), (5,5),
(-7,0), (7,0), (0,-7), (0,7).
```

Each runs from the same actual start state/epoch through the fixed correction node. Configure the **actual inertial applied vector**, ChemicalTank, Isp and mass decrement; distinguish an ideal preview-aligned impulse from a full runtime's actual attitude-directed one. Independently sample before/at/after burn and periapsis; solve the same first outward 100,000 km crossing and report time as well as state. Also compare actual patch-exit continuity. Candidate low-periapsis cases may fail the game's 250 km safety requirement while remaining physical central-force trajectories; include that fact rather than discarding the inconvenient rows.

Use explicit Mars-centered ICRF and TDBModJulian (JD minus 2430000), frozen mu/radius, central gravity without atmosphere/J2/SRP. Preserve raw scripts/reports, executable/build hash, input/scenario hashes and numerical settings. Add the same frozen Horizons Mars state at each independently found exit time to both local solutions; label this as local propagation plus reconstruction validation, not an independent planetary-ephemeris validation. See [NASA epoch documentation](https://raw.githubusercontent.com/nasa/GMAT/main/doc/help/src/Resource_SpacecraftEpoch.xml) and [coordinate-system documentation](https://raw.githubusercontent.com/nasa/GMAT/main/doc/help/src/Resource_CoordinateSystem.xml).

Keep original upper bounds: closest approach <=1%, exit speed <=0.5%, exit direction <=0.5 degrees. The last bound alone is too loose for a 0.12-degree game corridor, so add stricter model-specific gates before freeze: direction discrepancy <=0.005 degree, exit-time discrepancy <=0.1 s, energy discrepancy <=0.01 km²/s² and identical per-requirement classifications for all fixtures with declared nonzero margins. If these cannot be met, the target is not validated by merely passing the looser original bound. Central-force GMAT cannot certify the gimbal/ADCS/EPS assumption; those have separate analytical and dynamic tests.

Additional acceptance groups:

1. Reconstruction/continuity: Cartesian-to-hyperbola residual, invariants, directed root brackets, no pre-node path mutation, no position jump, actual fuel delta and no evaluation-radius force switch. No mathematical continuation after contact is playable.
2. Control inversion: deterministic aim-plane solve, fixed branch, Jacobian singularity refusal, out-of-domain/NaN input rejection, same target after save/load, stale-result and undo consistency. Measure screen drag to actual accepted correction.
3. Propulsion: centered and off-center placements, carrier fit, gimbal bounds, missing engine/connection, enough/insufficient propellant, zero impulse, real EPS/slew failure, actual pointing residual and irreversible event replay. Test the whole CG/inertia update, not only the scalar rocket equation.
4. Science/resources: baseline plus three alternatives complete the whole local flight with >=3 genuinely received unique spectra; different actual hardware/schedules remain viable. Missing instrument, wrong attitude, insufficient energy, no downlink and packet arrival after model endpoint fail through the shared resource model.
5. Independent objective failures: zero correction fails direction while energy passes; choose an energy-only miss from the evaluated grid; unsafe periapsis, insufficient fuel and missing science each receive separate causes. Navigation stays pending before actual exit, including in a perfect preview.
6. Convergence: full runs at cruise 60/300 s and active 1/0.5/0.25 s; identical requirement classifications and packet identity/count; energy minimum/end <=0.1 Wh, common-time attitude <=0.05 degree, applied direction <=0.005 degree, event time <=0.1 s. Do not call a failed-launch fixture a resource convergence test. Save and request partition equality is exact within each numerical profile.
7. Browser: actual pointer resize/drag through design -> flight -> recorded exit -> Earth receipt -> debrief -> one-control redesign; no direct state injection. Wrong/late solve, repeated launch, cancellation, reload at burn/exit, context restoration and KO/EN normal/large 1280x720 all preserve truth and primary controls.

## Implementation sequence and remaining limits

1. Freeze the public adapter/types and proposed assumptions; copy actual transfer-3 checkpoints as differential fixtures before touching shared source.
2. Extract the minimal resource/environment kernel and prove exact historical behavior. Do not integrate new gameplay if this prerequisite fails.
3. Implement checked local conics, aim-plane inversion and scenario authoring tools; run the independent GMAT cases and freeze scenario/propulsion manifests only after numerical gates.
4. Add real preparation/burn/exit orchestration, shared resource flight and strict replay; execute four complete success examples and independent negative cases; freeze score and numerical identity.
5. Integrate direct controls/visuals and run the actual browser loop, then performance/accessibility acceptance. Report what this slice covers in the requirements matrix without renaming future original requirements as complete.

This remains a central-Mars, impulsive-propulsion teaching model. The scenario uses an actual ephemeris epoch and consistent state transformations, but omits perturbations, finite thrust, detailed fuel/structure/gimbal dynamics and real navigation uncertainty. It is not a flight-certified mission design. Those limits must be visible in the model disclosure, with no warning screen interrupting ordinary play. The full original goal still needs live-state correction commands, departure-window design, broader mission coverage and representative novice testing; commercial-game-level art/usability is not established by this numerical slice.
