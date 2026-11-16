# Physical deployment acceptance plan

Status: pre-implementation gates. These are requirements, not completed test results. Record the tested source hash, exact input fixture, numerical profile and artifact for every accepted result. Preserve failed candidates and explain the correction. Do not lower thresholds after seeing a failure without a reviewed model/requirement change.

## Stage0 — preserve and freeze contracts

- Pin the accepted base-hardware catalog hash and all reused source dependencies. Capture representative legacy M01, hardware M01, transfer1/2/3 and swingby whole checkpoints before any shared extraction. Include active slew, weak-energy state, sending/arrival, old saves and the52-record transfer3 binary oracle already accepted for M02.
- New catalog wrapper/parser/format/slot must be explicit. A legacy save remains an old-profile run; an upgrade creates a new draft. Unknown deployment fields in a legacy envelope are rejected rather than ignored.
- Freeze the link-tree coordinate convention, mass decomposition, hinge frames, contact exemptions and renderer DTO before art production. Geometry/render/collision dimensions are one authority.
- Candidate rates, dimensions, credit cost and mission schedule are labelled authored. Freeze final values only after successful mechanical and flight gates, without falsely labelling them manufacturer-certified.

## Stage1 — mechanical kernel

| Gate | Required experiment | Acceptance |
| --- | --- | --- |
| D01 FK identity |0/intermediate/final angles, reversed joint axes, transformed mount, nested hinges | Independent analytic transforms agree within1e−9m/1e−9rad; no size scaling |
| D02 Rigid dimensions | Every render vertex through angle grid plus extreme configurations | Inside shared proxy within1e−5m; link-to-link and feed/support attachments remain connected |
| D03 Stowed fit | Actual FK folded poses with the two launch packages | Same corners and envelope in validator/renderer; fixed full-span wing cannot borrow folded dimensions |
| D04 Swept obstruction | A panel sweeps through a blocker while both endpoints are clear | Continuous checker reports obstruction; endpoint-only checker would miss it; first contact bracket≤0.01° and≤1mm equivalent displacement |
| D05 Conservative clearance | Tangency, nearly parallel OBBs, edge-edge, nested hinges, bus/sibling collision | Never report `clear` when independently dense samples/intersections show overlap; uncertain cases remain uncertain |
| D06 Legitimate joint contact | Allowed hinge attachment versus adjacent unallowed surface | Only exact declared contact pairs exempt; same-part and whole-bus blanket exemptions fail tests |
| D07 Mass properties | Independent point/box reference, rotated asymmetric placements, folded vs deployed | Total mass constant≤1e−12 relative; full tensor symmetric positive definite; CG/inertia agree≤1e−8 relative |
| D08 Angular momentum | Free bus and one hinged plate, mirrored leaves, no-controller and saturated-controller cases | Total inertial angular momentum residual≤1e−8 relative using floor1e−6Nms; actual counterrotation has correct sign; no orbital impulse/fuel effect |
| D09 Actuator feasibility | Full allowed configurations at both candidate rates | Finite DC integral covers conservative mechanical energy demand; unsupported conditions rejected or profile revised. No actual motor torque-speed claim |

An explicit swept-path unit fixture is available before implementation: hinge at origin aroundY; plate x∈[0,0.60]m, y∈[−0.15,0.15]m, thickness0.02m, rotating0→−90°. Blocker center[0.2121320344,0,0.2121320344]m, half[0.025,0.08,0.025]m. Endpoints are clear but the45° pose intersects. This is an analytic kernel fixture, not a claimed completed spacecraft placement. The actual ship's obstructing/fixed placements must subsequently be generated using the same FK/collision code, reviewed visually and pinned exactly.

Rigid-body reference validation must be independent of the runtime update: an analytic single-axis case plus a separate high-precision integration/reference implementation for an asymmetric3D case. GMAT orbit matching does not validate articulated-body dynamics. Do not present conservation by construction as the only accuracy test; also compare actual angle/rate trajectories and controller response.

## Stage2 — electrical and event coupling

| Gate | Required experiment | Acceptance |
| --- | --- | --- |
| D10 Real completion | Start a motor, pause midway, stop at angle endpoint, then finish latch verification | No operational gate before full powered latch-verification interval; explicit timestamps and energy integral |
| D11 Power loss | EPS interruption during release, acceleration, cruise, braking and verification | No unpowered timer completion; normally-closed brake follows the declared stop law; residual angle/state retained |
| D12 Recovery | Fixed recovery panel correctly/wrongly pointed; resumed actuator | Measured solar/energy difference; resumed action takes remaining physical time/work; no reset/refill/free latch |
| D13 Dynamic optical geometry | Folded leaf shadows another leaf/instrument; rotate same leaf at same Sun vector | Actual ray intersections/normals explain power/visibility change; whole-owner skip cannot hide sibling occlusion |
| D14 RF interlock | Clear Earth line while folded, at full angle before latch, and after verified latch | New device RF gate0 before verification; after latch, rate still depends on true pattern/range/occlusion; old device behavior unchanged |
| D15 Resource accounting | Same action at gentle/normal rate with identical starting conditions | Watts×seconds→joules→Wh accounting matches independent integral≤1e−6Wh; bus rail/conversion limits apply; no added free motor channel |
| D16 Endpoint causality | Operation start/end, latch deadline, charge→downlink transition, EPS threshold | Prior interval uses left-limit mode; future mode cannot steer/use energy retroactively; completed prior work retained |
| D17 Render/request independence |0/substep demand, varied maxSteps and request partitions | Identical committed checkpoint at equal cumulative demand, aside from explicitly separate requested time |

The runtime must separate commanded endpoint, actual joint angle, brake state, mechanical latch and electrical/RF contact. A mere `progress:1` is insufficient evidence. Do not count a diagnostic as received at transmit completion. Any emitted bytes already in flight continue according to the actual model after a later link interruption; unsent bytes stay aboard.

## Stage3 — genuine mission fixtures

Freeze one mission objective and the same environment/initial resource state for comparison. No hidden energy/data/state injection, auto-installation, randomized failures, outcome table or special-case score exemption.

1. **Compact folding success:** rideshare fairing, verified clear mounting, sensible early program, real deployment/ADCS response, sustained measured power and complete Earth-received diagnostic before deadline.
2. **Fixed-wing alternative:** actual full geometry requires a larger fairing and different cost/mass, but meets the same mission outcome. It must be a materially distinct feasible design, not a renamed preset.
3. **Blocked ground test:** clear folded/deployed endpoints but an intermediate collision. Guard stops before contact, identifies part IDs/angle interval and preserves actual partial pose/energy. Formal launch stays blocked until the known unsafe geometry is repaired.
4. **Geometric repair:** real mouse relocation/rotation makes the same sweep certified, then an independently executed flight succeeds. Undo returns exactly to the blocked draft and redo returns to clear. Waiting or changing a number cannot clear a static blocker.
5. **Ordering case:** two individual devices fit their endpoints, but an actual sequence causes interference. A physically valid alternative sequence clears it; concurrent forbidden actuator reservations are rejected.
6. **Late/weak-energy case:** identical geometry but late deployment/insufficient usable energy misses a requirement through actual power, pointing or deadline. A recoverable pause is labelled recoverable and retains completed work; terminal failure is not shown as pending.
7. **Interrupted/reversed case:** finite brake, powered unlatch and reverse move; spent energy remains spent. A later redeploy uses actual time/energy and real remaining conditions.

At least two distinct successful hardware configurations and the negative cases must complete actual numerical runs before the UI entry is enabled. Candidate preset labels are not proof. Use a fixed commissioning target (engineering telemetry, not fabricated astronomical science) and disclose which values are authored.

## Stage4 — numerical, identity and replay gates

- Compare active steps0.5/0.25/0.125s, idle grids1/5s and UI warp requests at1×/100×/1000×. All outcome/status/packet identities must agree. Joint-angle error≤0.01°, body-attitude error≤0.05°, energy-minimum/final difference≤0.05Wh, latch/brake/receipt event difference≤0.01s. Sample common times around acceleration, clearance, EPS and latch events, not only steady states. Keep the same gates for the weak-energy/recovery case.
- Replay saves before/during/after release, motion, braking, latch verification, paused energy recovery, reverse motion, transmission and terminal result. Full checkpoint equality is exact at the same model/profile, including requested-time remainder and irreversible motor energy.
- Forged joint angle/rate, latched flag, gate, wheel momentum, energy, event count, receipt and plan/model/catalog identity must fail. Unknown keys/versions, nonfinite/range/depth/2MiB UTF-8 violations and excessive device/action count must fail before expensive replay.
- Replay is detached/cancellable; malformed/cancelled restore keeps the previous session intact. Repeated worker messages are idempotent, stale epochs/revisions cannot replace the latest scene, and old previews cannot launch a now-invalid draft.
- Preserve every captured historical checkpoint exactly after shared changes. No regeneration of original golden fixtures. New deployment state is absent from old runtime/save formats.

## Stage5 — actual UI/art/accessibility

- Actual pointer hinge scrub, module relocation, rotation and timeline drag; no helper that silently installs the correct pose or plan. Browser asserts the same domain clearance reason/ID and successful actual runtime result.
- Screenshots for folded, obstructed midpoint, clear midpoint, verified deployed, reverse and power-paused states. Check seams, pivots, feed supports, object proportions, lighting and readable warnings at desktop/small-window layouts.
- Reduced motion and normal presentation produce identical physical checkpoint/result. Paused camera orbit/selection/overlay changes cause no simulation mutations. Actual and predicted poses are visually distinct.
- Context loss/restoration and repeated enter/leave cycles retain physical pose and consume/dispose only owned mesh/material/texture resources. No native WebGL errors, floating invalid matrices or duplicate deployment meshes.
- Reuse the existing exclusive20-part/1080p/medium120s performance protocol only after functional browsers close. Also measure active articulated motion with its real swept overlay. Record hardware/browser/resolution, frame distribution, long tasks and resource counts; do not compare timings while other tests run.

## Ownership and stop conditions

Domain owns `src/deployment/**`, pure mechanism DTO and domain tests. Renderer owns its separate articulated view and consumes the frozen DTO. Root owns worker/UI/entry/deployment. Independent review owns adversarial tests and numerical/physical counterexamples. Changes to shared legacy code require parent review and exact gates.

Stop integration if a geometry certificate can report a false clear, if the scene differs from collision geometry, if a latch activates on an uncommitted interval, if energy/torque is invented to force success, or if a legacy checkpoint changes. Preserve evidence, fix the cause, and rerun only affected and required gates. None of these conditions is an invitation to weaken a gate or silently substitute a simpler visual-only model.
