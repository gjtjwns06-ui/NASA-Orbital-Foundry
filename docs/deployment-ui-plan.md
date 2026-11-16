# First Light / First Contact product integration

Status at2026-11-15 05:02 UTC: candidate integrated into current main and undergoing frozen production browser acceptance. The original integration checkout's Git base was version6; all28 accepted version7 product files were copied and verified before adding the new mission. The independent keyboard patch used one documented context-only adaptation. Main received only the reviewed product-file list plus accepted internal art and opt-in orbital camera follow, never a wholesale older-worktree replacement. The19-file terminal-drain domain now has69 distinct passing cases across65 resumed +1 recovery convergence +3 critical receiver-drain checks, not one clean69-case batch. [Domain receipt](qa/milestone-8/domain/deployment-domain-final-acceptance.json), [current release status](qa/milestone-8-local.md). The private live site remains version7.

## Player challenge

The craft has to unfold a solar wing, establish stable pointing, unfold its RF aperture and deliver a16Mbit commissioning report. The compact design and a larger fixed-wing/heavy-fairing alternative must both remain physically viable. A visible mission briefing explains the actual power/pointing/report conditions and deadline. No random success percentage or score bonus substitutes for a received report.

The initial teaching problem is diagnosed from genuine geometry or schedule conditions, not a fabricated alert. The player previews a hinge sweep, moves an obstructing module or changes its orientation, and drags deployment/downlink blocks. A report already established by the domain as impossible blocks launch with the actual reason. Operating outcomes still depend on the motor, angular momentum, power, station and receipt computations.

## Screens and interactions

1. **3D commissioning workshop.** One large mounted craft with orbit/wheel inspection and real part picking. Face-local drag changes u/v on the actual mounting plane. Existing static hardware and new mechanism records retain their own catalogue identity. Palette choices and the fixed-wing alternative show cost, folded size, energy and practical consequences.
2. **Hinge inspection.** The accepted3D arc manipulator uses the domain parent frame/pivot/axis, real endpoint limits and explicit1° pointer snapping. White indicates the actual folded angle; amber/translucent geometry is an editor preview. Release commits a preview angle only. It never moves a launched mechanism or rewrites motor state. A clearance witness is shown at its actual sampled angle, not mislabeled at the final preview pose. Blocked/uncertain/certified states remain distinct.
3. **Onboard programme.** Mouse-drag blocks for wing, antenna, charge and downlink; rate choices are declared gentle/normal actuator profiles. Start times/deadlines and interlocks are explicit. A selected real station is shown for downlink. No instantaneous ground action is invented.
4. **Earth-orbit execution.** The same rigid-link poses animate directly from committed runtime geometry. Actual motor/brake/latch state, spacecraft attitude, generation, battery, link and received report progress share the same time. Body scale exaggeration is a camera convention; orbit, eclipse and ground visibility remain physical. Time acceleration processes every domain boundary. Pause/visibility/context loss are recoverable and never advance a hidden live flight.
5. **Diagnosis and retry.** Show recorded obstruction/power/latch/pointing/transmission events and their actual times. Return to a copied initial draft; spent energy, executed latches and received bits are never undone in the original flight. Separate save slot and strict replay import keep released hardware2/M02/M03 models untouched.

## Integration boundaries

- A dedicated Worker owns validation, preview FK/sweep, the authoritative runtime, forecasts and strict replay. Requests are session/revision-tagged; newer edits cancel/obsolete older work. Preview and live state have separate storage and identities.
- Snapshot DTOs contain detached topology/geometry, metrics, actual state and reasons. Renderers do not call orbital, collision, motor or success functions. The host supplies one body→inertial transform and the declared frame/time convention; no ICRF/TDB label is applied to the older Earth frame by convenience.
- Scene art consumes the exact topology boxes/apertures. Accepted functional component renderer and the later art revision keep separate manifests. No decorative geometry changes mass, folded envelope or ray visibility.
- Placement/plan edits use bounded undo/redo. Partial valid geometry is inspectable even if launch is blocked. Unknown model/version or corrupt input never replaces the last accepted draft or live flight.
- A coherent save is captured by the live Worker after its pause barrier. Explicit exit/edit/save actions remain locked through the relevant capture/storage handoff. Quota/blocked storage keeps the old slot, permits JSON backup, and offers an explicitly unsaved exit.

## Required product evidence

- Actual pointer hinge preview/cancel/keyboard and module placement; real sweep witness at its declared angle; undo restores draft and preview.
- Genuine compact full flight and fixed-wing alternative, including finite motor energy and full received report. A real obstruction or late-contact failure leads to a real player repair and a new flight.
- Mid-motion pause/save/reload gives the same next latch and result. Forged checkpoint values and unsupported profiles are rejected without losing the old flight.
- Rate, illumination, deployed contact and pointing telemetry agree with the committed domain snapshot and renderer geometry; no before/after mixing at a latch.
- Latest domain convergence/independent dynamics/energy evidence, actual Chrome/Edge UI journey, four language/size layouts, native graphics restore/disposal, meaningful relevant legacy regressions, frozen bundle and scoped hosted performance gates.

This lesson does not assert full spacecraft dynamics/flight qualification, arbitrary actuator commands, or commercial-game parity. Those limits do not remove any original specification requirement from the tracking matrix.
