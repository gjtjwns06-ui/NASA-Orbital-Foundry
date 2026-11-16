# M03 operations: agreed Phase A implementation contract

Status: **agreed implementation plan; not implemented or verified.**

Prepared on 2026-11-15 from a read-only review of the released v3E runtime, UI and save contracts. This document freezes the smallest playable subset of [the broader proposal](m03-inflight-operations-proposal.md). It does not claim that any acceptance criterion below has passed. No code, tests, browser run, build or performance measurement accompanies this document.

## 1. Accepted scope

Implement one complete causal loop:

**Drag future operation blocks → submit a schedule replacement → transmit a finite command → receive and install it onboard → transmit a separate ACK → receive confirmation on Earth → observe the resulting science return.**

The first slice supports:

- Atomic replacement of a future onboard schedule.
- Cancellation of a command that has not begun transmission.
- Idempotent retry of an identical command and a separate acknowledgement.
- An authored, physically launchable Mars schedule-recovery lesson using the existing Iris/X-band hardware chain.
- A separate live edit draft, submitted changes, and the last schedule confirmed to Earth.
- New runtime/save identity and isolated autosave storage, while retaining existing flight replay.

Finite overrides, resume commands, delivered cancellation of an already-emitted instruction, trajectory correction maneuvers, force-model changes, stochastic failures and navigation uncertainty are **deferred**. This is the accepted Phase A core subset, not completion of every feature in the broader proposal.

**An ACK confirms that the schedule was installed. It does not confirm that its future observations or transmissions have already executed.** Science counts still require actual complete reception of scientific data.

## 2. Playable lesson

1. Start an explicitly selected remote-operations training flight with a connected Iris transponder and compatible X-band antenna. An unsupported chain produces a clear compatibility issue; it must not silently fall back to legacy link calculations.
2. The initial schedule contains an Earth-pointed listening opportunity and an intentionally inefficient, recoverable encounter sequence. The existing `downlink` operation can provide Earth pointing/listening when there is no science to send.
3. Advance through the actual simulation to the listening opportunity. Any fast-forward must compute the intervening resources, attitude and events; it must not inject an artificial checkpoint.
4. Drag or resize a future observation/downlink block to leave a charging interval. The change is an unsubmitted draft and cannot alter live operation, resource use or science yield.
5. Submit the replacement. Transmission duration, light time, receiving attitude, receiver power and occultation determine whether the entire instruction arrives.
6. Install only a complete valid instruction. Earth remains in an awaiting-confirmation state until the ACK returns.
7. Compare actual science receipt with the same initial flight under no command, a late command or a lost command.

The exact initial listening window and deficient schedule must be authored and fixed using the real engine. The craft must remain launchable and recoverable before the first intended command arrives. Do not award an abstract rescue bonus or automatically substitute an optimal schedule.

## 3. Existing integration constraints

- `src/transfer-ui.ts` currently rejects timeline drags once `runtime` exists. Its pointer-up handler calls `recalculate()`, whose solve request clears the worker runtime. Live editing therefore needs a distinct draft/preview path; removing the drag guard alone is unsafe.
- `src/transfer/runtime.ts` currently selects operation mode from `state.solution.plan.operations`. Version 3 needs a separate onboard schedule; the original solution and initial plan remain immutable.
- `src/transfer.worker.ts` uses `requestId` as a session revision and has a backlog represented by `runtime.requestedTime`. A session identifier alone cannot reject stale advance requests from an earlier control state inside the same flight.
- `src/transfer/persistence.ts` version 1 infers the runtime identity from the hardware profile, re-solves the trajectory and compares a replayed checkpoint. It cannot accept version 3 by merely appending fields.
- Existing Earth commands in `src/sim/simulation.ts` and `src/sim/persistence.ts` demonstrate queueing, autonomous schedule continuation, finite override and replay from input history. They have instantaneous command emission, use the current downlink-style readiness test, process reception on the fixed 5-second clock, and have no separate ACK. Reuse those **patterns**, not their transport implementation.

## 4. Domain API contract

All mission times below are **TDB elapsed seconds from the immutable departure epoch**, not UTC labels or a model of an onboard proper-time clock.

```ts
type ScheduleReplacement = {
  kind: 'replace-schedule';
  baseRevision: number;
  replaceFromSeconds: number;
  operations: TransferOperation[];
};

type GroundAction =
  | {
      sequence: number;
      actionId: string;
      commandId: string;
      issuedAtSeconds: number; // Assigned by the authoritative worker.
      kind: 'queue';
      expiresAtSeconds: number;
      payload: ScheduleReplacement;
    }
  | {
      sequence: number;
      actionId: string;
      commandId: string;
      issuedAtSeconds: number;
      kind: 'cancel-unsent' | 'retry';
    };

interface OperationsSnapshot {
  ground: {
    confirmedRevision: number;
    confirmedOperations: TransferOperation[];
    commands: GroundCommandView[];
  };
  onboardTruth: {
    revision: number;
    operations: TransferOperation[];
    installations: CommandInstallation[];
  };
  signals: CommandSignalView[];
}

queueTransferCommand(state, payload, options): GroundAction;
cancelUnsentTransferCommand(state, commandId, actionId): GroundAction;
retryTransferCommand(state, commandId, actionId): GroundAction;
getTransferOperationsSnapshot(state): OperationsSnapshot;
previewTransferCommand(snapshot, payload): CommandPreview;
```

The named view types above are implementation interfaces to be completed by the domain owner, subject to the following information boundaries:

- `ground` contains only Earth-known queue/transmission information and received ACK content. Its confirmed schedule/revision changes on ACK reception, not on spacecraft reception.
- A missing ACK means **unconfirmed**, not proof of onboard rejection or signal loss. Earth may know that an unsent queue entry expired or was cancelled locally.
- `onboardTruth` exposes the actual simulated schedule and installation records. When shown beside the existing omniscient 3D view, label it **actual simulation state / not yet confirmed on Earth**.
- `signals` separates uplink and ACK, their actual emitted/arrival times and transport progress. A display-time-scaled signal animation must not misrepresent its progress as physical distance traversed in real time.
- An installed schedule can contain future operations that have not run. Installation and operation execution must remain distinct in all labels and records.
- The live draft is separate from `this.plan`, onboard truth and the ground action journal. A detached preview never modifies those inputs or the live spacecraft state.

## 5. Worker and UI message contract

Retain `requestId` as the flight/session epoch. Add `controlEpoch` to live advance, warp, pause and command requests and to their responses. Use `draftRevision` only to order detached edit previews.

```ts
{
  type: 'queue-operations',
  requestId, controlEpoch, actionId, commandId,
  payload: ScheduleReplacement,
  expiresAtSeconds
}

{ type: 'cancel-operations', requestId, controlEpoch, actionId, commandId }
{ type: 'retry-operations',  requestId, controlEpoch, actionId, commandId }
{ type: 'preview-operations', requestId, draftRevision, payload }

// Acknowledgement of a worker-side input transaction, NOT a spacecraft ACK.
{
  type: 'operations-state',
  requestId, controlEpoch, actionId,
  committedTime,
  operations: OperationsSnapshot,
  state, telemetry
}

{
  type: 'operations-preview',
  requestId, draftRevision,
  baseTime,
  validation,
  estimatedTransmitEnd,
  estimatedReceiveAt,
  assumptions
}
```

On accepting a command input, the worker atomically cancels outstanding warp demand with `requestedTime = time`, then assigns `issuedAtSeconds` from that committed time. It must not drain the old warp all the way to its former target before assigning the command time. Completed work before the transaction is not rewound.

Reject stale sessions and older control epochs. Old queued advance requests must not restart cancelled warp. The UI drops old-epoch responses. Repeated `actionId` delivery returns the prior transaction outcome without appending another journal action. Reuse of a `commandId` with different payload bytes is rejected. An identical command retry cannot install the same replacement twice.

The UI must distinguish a fast worker transaction response from the delayed spacecraft ACK. Pending preview responses are accepted only for the current session and `draftRevision`. Pointer release invokes command preview, never the live solve/recalculate path. Escape or pointer cancellation restores only the local edit draft.

## 6. Transport, schedule and physical rules

### Bounded inputs and atomic schedules

- Maximum 128 unique commands and 256 ordered ground actions per flight.
- Maximum 40 operations in an accepted schedule; validate finite times, allowed kinds, unique IDs, overlaps and mission boundaries.
- Require finite command expiry and a canonical UTF-8 encoding with an authored maximum encoded size. Pin that size and any framing/header/CRC assumptions before acceptance tests; they are not vendor claims.
- Install the complete replacement atomically after valid complete reception. No partial frame or partial schedule may change onboard operations.
- Require the expected onboard `baseRevision`. Reject retroactive changes and stale revisions. Preserve all past trajectory, resources, captures, transmissions and event history.
- Keep the original solution/plan immutable; operations after the replacement boundary come from the accepted onboard revision.
- Cancellation is local and immediate only before any transmission begins. An already-emitted signal cannot be recalled or held in space. The first slice does not implement delivered cancellation.
- A duplicate command received after a previous successful installation returns the corresponding acknowledgement without reapplying the change. Check idempotency before treating that duplicate as a new stale-revision request.

### Separate uplink and downlink

For a ground station at emission time, solve reception using the future spacecraft position:

`tReceive - tEmit = |station(tEmit) - spacecraft(tReceive)| / c`.

Do not reverse the downlink formula while leaving the spacecraft transmitter power in place. Reuse the existing future-Earth-receiver calculation for ACK propagation where compatible. Preserve station identity and frame timing; avoid silently attaching a partially transmitted frame to a different station.

Check station emission geometry and actual spacecraft reception geometry, antenna obstruction/pointing and receiver power. Finite transmission means a command has a reception interval, not merely one endpoint. An interruption during that interval cannot be hidden by valid conditions at its end. Pin and disclose the active-frame temporal resolution/event detection before testing.

An Earth-pointed listening opportunity must exist in the preloaded schedule for a narrow high-gain antenna. An incoming command cannot first rotate an antenna that cannot receive that command.

ACK transmission uses the actual selected downlink chain. Allocate its transmitted bits before science bits within the same available bandwidth; account for transmitter power and finite complete reception. An ACK cannot bypass link readiness or appear instantly on Earth.

### Electrical and RF model boundary

Use a new immutable command-network identity/hash; do not edit the released hardware-2.0.0 catalogue or its hash.

- Iris at the cited 12 V table condition: RX-only **9.1 W**, TX-only **25.0 W**, simultaneous RX/TX **29.0 W**. Do not use `25 + 9.1` as simultaneous draw. Replace the selected chain's mode contribution correctly and retain bus conversion losses; do not add a second complete radio load.
- Iris deep-space uplink **7.145–7.190 GHz** differs from its deep-space downlink **8.400–8.450 GHz**. Existing 8.4 GHz downlink assumptions are not the uplink frequency.
- Iris X-band noise figure is **2.5 dB** in the source. Its carrier tracking range **−70 to −147 dBm** is not a command demodulation BER specification and must not be used as one.
- AX100 is explicitly **half-duplex**. Never permit concurrent receive/transmit on that chain. The initial authored Mars lesson may require Iris, but modeled incompatibility/half-duplex states must still be coherent and visible.
- Ground EIRP, effective receiver noise temperature, command rate/coding, payload efficiency, pointing model at uplink frequency and ground network availability need a separately pinned source or explicit educational assumption. A tracking threshold alone does not establish a usable command link.

### Canonical events

Add boundaries for transmission completion, signal reception, schedule installation/activation, ACK completion and future schedule changes. Keep safety mode priority explicit.

Equal-time ordering is: integrate the preceding interval → apply physical/safety boundaries → receive and validate instructions → install accepted schedules before determining the next operation interval → process subsequent transmission/ACK opportunities. Define and test the exact acceptance rule at expiry/replacement-boundary equality rather than relying on incidental loop order.

One large request and smaller UI requests must not alter integration partition at the same configured step size. Do not turn every render frame or telemetry query into a physical event boundary.

## 7. Version, save and compatibility contract

- New operational runtime identity: `transfer-3.0.0`.
- New journey save envelope: version **2**, with an explicit model identity and separate autosave key/entry point.
- Preserve envelope-version-1 parsing and execution for `transfer-1.0.0` and `transfer-2.0.0`. Opening an old flight does not enable commands or convert its running state.
- A player may explicitly create a new version-3 draft from an older craft. This is a new flight, not a resumed old run.
- Keep the existing trajectory solution's force-model identity. Phase A changes operations/telecommunications, not the immutable patched-conic trajectory or GMAT validation domain.
- Save immutable initial plan/craft/scenario, ephemeris identity/hashes, hardware catalogue hash, command-network identity/hash, ordered ground actions and a compact replay checkpoint.
- Re-solve the initial trajectory and replay the action journal at its authoritative times. Never trust imported command outcomes, solved coordinates, fuel, science counts, schedule revision or ACK state.
- Compare replayed resources, attitude/controller state, packets, pending RF frames, command/install/ACK state and revision against the checkpoint. Reject unknown fields/models, nonfinite values, duplicate/conflicting IDs, invalid ordering and forged outcomes.
- Replay must run in bounded worker chunks and be cancellable by a new session. A stale restore must not replace a newer flight.
- If unsent UI drafts are persisted, keep them as separately validated, non-authoritative editor data. Restoring a draft must not enqueue or install it.
- Preserve the v3E save-order fix: handoff drafts are dirty until saved, close awaits the intended latest save, and async save operations capture their flight/profile inputs before yielding.

## 8. Implementation ownership and file touch plan

Implementation begins only after the cache/art integration is ready. The current document is the only file created by this planning task.

| Owner | File | Responsibility |
| --- | --- | --- |
| Domain agent | New `src/transfer/operations.ts` | Types, input validation/journal, schedule revision, ground/truth views, idempotency |
| Domain agent | New `src/transfer/command-link.ts` | Uplink/ACK timing, finite frames, receive conditions, half-duplex behavior |
| Domain agent | New `src/transfer/command-network.ts` | Immutable network assumptions, provenance and model hash |
| Domain agent | New `src/transfer/runtime-v3.ts` | Version-3 operational state, canonical boundaries, resources and selected-chain power |
| Domain agent | New `src/transfer/persistence-v2.ts` | Version-2 schema, action replay/checkpoint validation, isolated storage |
| Domain agent | New `src/transfer/engine.ts`; existing `src/transfer/index.ts` | Explicit version dispatch and public API |
| Domain agent | Existing `src/transfer/state.ts`, only if required | Export pure ground-station calculation without changing released arithmetic |
| Root | Existing `src/transfer.worker.ts` | Session/control epochs, command transactions, detached preview, bounded replay |
| Root | Existing `src/transfer-ui.ts` and `.css` | Direct timeline editing, three information layers, send/cancel/retry/ACK UI |
| Root | Existing `src/main.ts` and translation modules | New training entry, explicit profile/model handling, separate continue slot |
| Rendering agent | Existing `src/render/transfer-scene.ts` | Uplink/ACK presentation from actual records, labelled truth view, no fake receipt |
| Independent reviewer | New domain, replay, worker and browser tests | Causality, save integrity, interaction and the acceptance evidence below |

Keep released runtime behavior intact. Shared pure orbit/hardware calculations may be reused, but the new transport model must not be activated by hardware presence alone in old flights. No new GMAT force-model evidence is implied by this operations-only iteration.

## 9. Ten acceptance criteria

All criteria are **pending**. Evidence must name the tested source/build, fixture and model versions. Predictions and authored examples are not execution evidence.

1. **Actual mouse editing.** Moving/resizing a block during flight changes only the draft. Before complete reception, the live onboard operation, energy and science state remain unchanged by that edit. Pointer release does not solve/reset the running mission.
2. **Recoverable authored lesson.** A launchable initial flight reaches the same encounter with an early accepted revision meeting the actual science receipt goal. Otherwise-identical no-command and late-command runs do not. No result injection, automatic optimal replacement or abstract rescue score is allowed.
3. **Causal timing and confirmation.** Finite emission, complete reception, installation, ACK emission and Earth receipt follow computed times. Independently check the moving-receiver light-time equation. The ground-confirmed revision advances only on received ACK; ACK text says installed, not future execution completed.
4. **Interrupted reception.** Loss of pointing, receive power or visibility during the reception interval prevents partial application. Existing autonomous operations continue. A missing ACK is shown as unconfirmed, not omniscient ground failure. A signal cannot wait for a later antenna orientation.
5. **Resource and radio accounting.** ACK bits consume downlink capacity and reduce available science transmission. Selected Iris RX/TX electrical modes affect EPS/battery accounting correctly. Unsupported chains produce explicit issues and AX100 cannot receive and transmit concurrently.
6. **Atomicity, revisions and duplication.** Reject stale revisions, overlapping operations and retroactive changes without partial mutation. Repeated action delivery and identical command retry install once. Conflicting reuse of an ID fails. Unsent cancellation succeeds; cancellation after emission does not recall the signal.
7. **Partition and convergence.** At one configured integration step, long warp and smaller request chunks—including public telemetry/preview calls—produce identical command, packet and resource state. Compare 300/600-second cruise settings separately under tolerances fixed before judging the result; do not claim those two numerical grids must be bit-identical or relax tolerances after observing failures.
8. **Replay and forgery resistance.** Restore before transmission, during transmission, during propagation, after installation/before ACK and after ACK. Replayed state and outcomes match the saved run under the declared checkpoint contract. Forged outcomes, action ordering, model/hash and invalid times are rejected without replacing the current flight.
9. **Worker/save lifecycle.** Old sessions, old control epochs, double-clicks, outstanding warp, close/reopen, storage denial and WebGL loss/restore cannot restart stale demand, duplicate commands or overwrite another flight/profile slot. JSON backup remains available when local storage is blocked.
10. **Real UI and released compatibility.** KO/EN at 1280×720 exposes usable timeline dragging, visible primary controls and understandable draft/submitted/confirmed status. Use real simulation, not injected completion. Existing legacy/hardware flight, save/replay and GMAT validation fixtures remain unchanged and passing; do not claim full keyboard accessibility or commercial-game parity from these cases.

## 10. Primary sources and interpretation limits

- [NASA, Basics of Space Flight, Chapter 15: Flight Operations](https://science.nasa.gov/learn/basics-of-space-flight/chapter15-1/) supports stored cruise sequences, additional ground instructions and light-time-aware operations. It does not prescribe this game's protocol or UI.
- [NASA, Basics of Space Flight, Chapter 10: Telecommunications](https://science.nasa.gov/learn/basics-of-space-flight/chapter10-1/) distinguishes uplink commands and downlink information. The game's specific ACK framing and status machine are authored assumptions.
- [GomSpace, NanoCom AX100 datasheet, revision 3.7](https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanocom-ax100.pdf): PDF p.4 explicitly states half-duplex; p.5 shows the shared RX/TX switch and single 50-ohm RF connector. These were freshly checked for this planning handoff; no full-duplex behavior is authorized by that source.
- [NASA/JPL, Iris V2.2 technical brochure, September 2022](https://scienceandtechnology.jpl.nasa.gov/sites/default/files/documents/Brochure_Iris_Transponder_V2.2_SEP_2022.pdf): operating-mode/electrical and RF tables provide the separately listed RX/TX/simultaneous power and uplink/downlink frequency values above. The parent agent freshly checked the official indexed PDF tables; this document does not imply a new local PDF download. Brochure headline/prose discrepancies remain disclosed. Carrier tracking is not command BER.
- [Existing component source ledger](../public/data/component-sources.json), record `jpl-iris22`, already records 9.1/25/29 W and the source inconsistency. Record `gomspace-ax100u` provides the existing AX100 reference values. These are provenance inputs, not permission to rewrite the released catalogue or imply that the new network is a real DSN service.

Before implementation acceptance, the domain owner and independent reviewer must freeze the remaining authored network constants, frame-size limits, reception temporal resolution, equality-boundary rules and 300/600-second convergence tolerances. This is a numerical/model-definition gate, not an additional user approval request.
