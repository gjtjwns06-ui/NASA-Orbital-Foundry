# M03 in-flight operations proposal

Status: **proposal only; next implementation is being scoped after the successful private v3 release. No command runtime has been merged.** This document follows the hardware-2.0.0 release candidate. Existing model 1.3.0, transfer-1.0.0 and transfer-2.0.0 executions must remain reproducible.

## Intended play experience

During the Earth–Mars journey, the player drags future observation, charging and downlink blocks on the existing timeline. A changed block first appears as a pending ground instruction. A visible signal travels toward the spacecraft; the onboard timeline changes only after complete reception and validation. Confirmation travels back separately. A lost link does not stop the existing onboard schedule. The player must allow time for communication and physical attitude changes, rather than remotely switching the spacecraft instantly.

The first playable challenge is to recover a resource-poor encounter schedule: move a charging interval forward, shorten an observation or delay transmission, send the revision before the reception window closes, and compare actual received science. A pending plan preview must never be mistaken for the executing plan. Three visually distinct timeline layers are enough: onboard confirmed schedule, submitted/awaiting-confirmation changes, and the player's unsubmitted edit. Dragging and resizing remain the primary controls; an explicit send action commits a complete instruction. The 3D scene continues to show actual attitude, panel illumination and antenna direction.

A later phase adds a draggable maneuver node on the Sun-centred route. Its handles specify a physical velocity change; the preview shows the resulting encounter and fuel cost. After a delivered, time-tagged instruction and successful preburn pointing, the actual spacecraft fires. Only the future trajectory changes. Missing the maneuver can produce a genuine Mars miss rather than a replacement curve that still reaches the target.

## Scientific basis and boundaries

NASA describes stored cruise sequences, supplemental ground commands, reception opportunities affected by spacecraft pointing and occultation, and event schedules adjusted for light time. These support the proposed delayed-command mechanics, but do not prescribe this game's UI or packet protocol. [NASA, Basics of Space Flight, Chapter 15](https://science.nasa.gov/learn/basics-of-space-flight/chapter15-1/).

Uplink carries commands, while downlink carries engineering/science telemetry. Ground knowledge of spacecraft reception follows a return signal; it is not available at the instant the spacecraft receives the uplink. [NASA, Chapter 10: Telecom](https://science.nasa.gov/learn/basics-of-space-flight/chapter10-1/).

Mars 2020 used in-flight propulsive maneuvers to remove injection bias and target arrival conditions within propellant constraints. Its cruise thrusters executed commands at specified times. Those are precedents for a correction scenario, not performance specifications for our spacecraft. [JPL maneuver-design record](https://ntrs.nasa.gov/citations/20230005656), [JPL Mars 2020 cruise-stage description](https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/getting_to_mars/).

Keep radiation damage, stochastic navigation uncertainty, orbit determination from noisy tracking, DSN scheduling conflicts and finite-duration thrust outside this iteration. A training injection bias may be a disclosed deterministic scenario input; do not randomly damage an otherwise perfect route. No invented reliability probability should substitute for geometry, resources or executed maneuvers.

## Phase A: received commands and onboard operations

Retain the immutable original `FullTransferSolution` and its original plan. Add separate operational state:

```ts
type OperationsIntent =
  | { kind: 'override'; mode: 'charge'|'observe'|'downlink';
      durationSeconds: number; executeAtScet?: number }
  | { kind: 'replace-schedule'; baseRevision: number;
      replaceFromScet: number; operations: TransferOperation[] }
  | { kind: 'resume-schedule'; executeAtScet?: number };

type GroundAction =
  | { sequence: number; issuedAt: number; kind: 'queue';
      commandId: string; expiresAt: number; payload: OperationsIntent }
  | { sequence: number; issuedAt: number; kind: 'cancel-unsent'; commandId: string };

interface OperationsState {
  onboardSchedule: { revision: number; operations: TransferOperation[] };
  override: null | { commandId: string; mode: TransferOperationKind; endsAt: number };
  groundActions: GroundAction[];
  commands: CommandExecution[];  // Computed by replay, never trusted from import.
  uplinkFrames: UplinkFrame[];
  acknowledgements: AckFrame[];
  processedCommandIds: string[];
  lastGroundConfirmation: GroundKnowledge | null;
}
```

The proposed `CommandExecution` separates transport, execution and acknowledgement: ground queue/expiry, transmission start/end, spacecraft receive completion, onboard acceptance/rejection, execution start/end, ACK transmission and Earth receipt. A single enum must not conflate “executed but not yet acknowledged” with “still travelling.” The player-facing ground status is based on received ACKs. Any omniscient 3D view or debug truth log must be labelled separately from delayed ground telemetry.

Suggested engine entry points are `queueTransferCommand(state, intent, options)`, `cancelUnsentTransferCommand(state, id)` and `previewTransferCommand(snapshot, intent)`. The worker assigns `issuedAt` from its authoritative committed simulation time; it does not trust a stale UI timestamp. An accepted input stops/drains any outstanding warp request before assigning the action time. Session revision and unique action ID prevent a stale worker reply or double-click from issuing the same command twice.

A schedule replacement is atomic. Validate finite times, unique IDs, allowed modes, operation count and overlaps; require the expected onboard schedule revision. A revision received after its replacement interval began is rejected, not applied retroactively. A finite override suspends the schedule only after reception/execution and then resumes it. Safety mode has documented priority over either. An instruction may explicitly request a future spacecraft event time; an instruction received after that time expires. Cancelling an unsent queue entry is immediate on Earth; cancellation of an already-emitted instruction requires another delivered instruction. Retransmitting an identical command ID must not execute it twice.

Pin deterministic bounds before implementation: at most 256 ground actions and 128 unique commands per mission, at most 40 operations in one accepted schedule, finite command expiry, and an authored maximum encoded command size. Encode command bytes canonically; transmission takes real time and bandwidth. An interrupted/incomplete command cannot partly alter the onboard plan. ACK frames have a documented priority within the actual downlink budget, reduce available science throughput and consume the selected transmitter's power.

### Link and event semantics

Primary-source recheck on 2026-11-15: the [GomSpace AX100 datasheet, revision 3.7, pp. 4–5](https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanocom-ax100.pdf) explicitly describes a half-duplex radio with a shared RX/TX RF path. AX100 reception and transmission must therefore be mutually exclusive. The [JPL Iris V2.2 brochure](https://scienceandtechnology.jpl.nasa.gov/sites/default/files/documents/Brochure_Iris_Transponder_V2.2_SEP_2022.pdf) lists 12 V DC input of 9.1 W for receive, 25 W for transmit and 29 W for simultaneous operation. Its deep-space X-band uplink is 7.145–7.190 GHz, distinct from its 8.400–8.450 GHz downlink. The published 2.5 dB X-band noise figure and −70 to −147 dBm carrier-tracking range do not establish an error-free command data rate. Receiver noise temperature, coded command threshold, ground EIRP and protocol overhead still need separately identified source values or explicit educational assumptions. Do not silently add these to catalogue version 2 or treat a carrier-tracking limit as a command-decoding guarantee.

Implement a separate uplink budget with a verified or explicitly authored ground EIRP, uplink frequency, spacecraft receiver sensitivity/noise assumptions and compatible receive antenna. Do not reverse the current downlink formula while retaining the spacecraft's TX power. Pin source/configuration for full-duplex versus half-duplex operation: Iris simultaneous RX/TX DC consumption is distinct from TX-only consumption, and AX100 must not be assumed to support simultaneous receive/transmit without source verification. These new command-network constants belong to their own versioned model; do not rewrite the released hardware catalog.

For an uplink emitted from a station at `tEmit`, solve its reception time using the spacecraft's future position: `tReceive - tEmit = distance(station(tEmit), spacecraft(tReceive)) / c`. Check the transmitting station's emission geometry and the spacecraft's actual reception attitude, receive power and occultation. Once emitted, the signal cannot wait in space for a later pointing opportunity. Use the existing future-Earth receiver calculation for downlink ACKs. Show an estimated arrival before transmission and distinguish it from actual delivery.

Canonical integration must stop at transmission completion, signal arrival, command activation, override expiry and schedule boundaries. Define equal-time event ordering explicitly: integrate the preceding interval, apply physical/safety boundaries, process reception and validation, execute accepted time-tagged commands, then form the next interval. Onboard execution continues through loss of contact. A high-gain-only craft needs preplanned Earth-pointed listening opportunities; a command cannot magically turn an antenna that cannot yet receive it.

## Phase B: trajectory correction maneuvers

Add maneuvers only after Phase A is independently verified. Initially permit at most eight bounded ideal impulses during Sun-centred cruise; reject execution outside the allowed cruise interval. A node contains `executeAtScet`, `radialMps`, `transverseMps`, `normalMps` and an explicit `frame: 'RTN'`. RTN transverse is perpendicular to the radial direction and must not be mislabeled as the exact velocity vector on an eccentric orbit. Convert from the **actual execution state** to ICRF, with m/s converted to km/s exactly once.

Store immutable propagated arcs and executed maneuver records. At a successful impulse the position is unchanged, velocity changes by the applied vector, and propellant decreases according to actual wet mass and Isp. Do not re-solve the original departure/arrival Lambert problem and snap to a new curve. Find the new Mars SOI crossing from the perturbed heliocentric path, transform its actual position/velocity into Mars-relative coordinates, and propagate the resulting encounter. Derive new closest approach, exit, illumination and observation times from that path. If no crossing occurs before the defined mission deadline, report a miss. Preserve all past positions, captures and transmissions.

A maneuver has a preburn attitude target aligned with the installed engine's body thrust direction. Preburn slewing consumes time and power, and may interrupt solar collection or communication. Insufficient fuel, an absent engine, late instruction or failure to meet the declared pointing tolerance inhibits execution; the trajectory must then remain the unburned one. The initial implementation may use ideal impulsive burns after this alignment check, with that approximation stated. Finite thrust duration, torque from an offset engine and full coupled rigid-body dynamics require a subsequent force-model version.

A disclosed scenario can start with a small deterministic injection offset, letting the player compare an early small correction with a later correction. The actual integrated paths, rather than a fixed “early bonus,” determine fuel needed and encounter quality. Navigation observations with uncertainty are deferred; no confidence ellipse should be displayed as measured evidence until there is a real observation/estimation model.

## Version, save and replay contract

Use a new runtime identity such as `transfer-3.0.0` and a new journey-save envelope version 2. Keep existing envelope-version-1 parsers and engines for transfer-1.0.0 and transfer-2.0.0. Opening an existing flight never enables new command behavior. A player may explicitly create a new draft/flight from an older design; that is not resuming the old flight.

The new save records immutable initial plan/craft/scenario, ephemeris dataset and hashes, hardware catalog hash, command-network model identity, navigation-force identity, ordered ground action journal and a compact checkpoint. The checkpoint includes resources, attitude/controller state, packets, RF frames, schedule revision, command execution/ACK state and executed burn identities. Imported solved paths, received counts, fuel or command outcomes are never authoritative: re-solve the original trajectory and replay actions at their recorded canonical times, then compare the checkpoint. Unknown fields, nonfinite quantities, forged outcomes, altered model hashes, duplicate IDs and impossible event times fail validation.

Maintain separate autosave keys for runtime model 3. Export/import identifies the model explicitly. Incremental replay runs in a worker with bounded chunks; stale session IDs cannot replace a newer flight. A command preview operates on a detached snapshot and never mutates the executing craft, schedule, trajectory or journal.

## Acceptance criteria

Phase A is ready only when all these are demonstrated:

1. A mouse timeline edit remains pending until actual reception. Onboard activity is unchanged beforehand; a successful ACK is received later than execution.
2. An early uploaded correction rescues an authored poor schedule; the otherwise identical late or lost command does not. Both use actual science receipt and resource accounting.
3. Lost pointing/receive power or occultation at reception loses the instruction. The autonomous schedule continues. There is no stored signal waiting for a later link.
4. ACK airtime competes with science, simultaneous RX/TX mode draws the documented power, and retries never double-execute a command.
5. Atomic schedule revision rejects stale revisions, overlap and retroactive changes. Unsent cancellation and transmitted cancellation have different physical behavior.
6. One large warp, many small requests and 300/600-second cruise grids agree on command execution, unique science and receipt events within declared numerical resource tolerances.
7. Saves before transmit, in flight, after receive/before execute, after execute/before ACK and after ACK reproduce exactly. Forged command and schedule states are rejected.
8. Legacy fixture suites remain unchanged and passing. Browser tests cover dragging, queued ghost blocks, confirmation, cancellation, session replacement and resumed flight.

Phase B additionally requires:

1. Zero maneuver reproduces the reference trajectory; an executed burn changes velocity by exactly the specified RTN vector while position remains continuous and prior history unchanged.
2. Independent rocket-equation, energy-jump (`v·Δv + |Δv|²/2`) and between-burn central-gravity conservation tests pass.
3. Late/blocked/unpointed maneuvers do not deduct fuel or alter the path. Successful and unsuccessful real encounters produce corresponding science opportunities.
4. New SOI entry/exit and closest-approach events come from the changed trajectory; a miss is not converted into a nominal flyby.
5. Add a separate GMAT evidence family for zero burn, one burn, two burns and a miss, using matched frames, units, initial states and force models. Preserve the existing eight local-orbit and six transfer validation cases unchanged. GMAT trajectory agreement does not certify radios, hardware performance or attitude control.

Suggested ownership after release: domain agent owns new versioned operations/navigation and replay modules; root owns worker session/action contracts and timeline interaction; rendering agent owns pending-versus-executed 3D route/signal presentation; independent reviewer owns causality, replay and GMAT evidence tests. Implement Phase A as a complete playable loop before starting Phase B.
