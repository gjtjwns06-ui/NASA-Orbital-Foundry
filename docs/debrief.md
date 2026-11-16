# Evidence-led mission debrief

`src/debrief.ts` is a deterministic, display-independent analysis of **M01/M02 `MissionResult`** records. It does not replay a mission, compute a new score, modify a design, read the clock, select a language, or invoke an API. Returned objects are deeply frozen, detached copies. Input records must already have passed the application's normal simulation/save validation.

## Integration

```ts
import {buildDebrief, resolveDebriefTarget} from './debrief';

const debrief = buildDebrief(
  {result: currentResult, designWarnings: capturedDesignWarnings},
  previousResult ? {result: previousResult} : undefined,
);
```

Only attach `designWarnings` produced for that exact evaluated design and model. A warning is evidence supplied by the caller; the module does not independently rerun its validator. Text is `{ko, en}` plain text, so the view chooses the language and HTML-escapes values when rendering. Do not put escaped HTML back into simulation records.

`DebriefRun.meta` can fill facts captured alongside an older result: `modelVersion`, `scoreDefinitionId`, `simulationStatus`, `requirements` (`targetPackets`, `minimumQuality`, `deadlineSeconds`), and `eventLogCoverage`. Existing metadata on the result takes precedence; a conflicting concrete override prevents comparison. Supplemental `null`/`unknown` values are absence of a claim, not contradictory provenance. **Do not fill missing provenance with the current version just to enable a score delta.** Replaying an old save with a verified engine can legitimately produce a new result with that engine's metadata.

The output exposes:

- `diagnostics`: bilingual observed facts or inspection suggestions, typed event/packet/command/design evidence and actions.
- `transport`: capture, confirmed reception, qualifying reception, partial emission, full emission without confirmation and retained unconfirmed bits. Qualifying reception is unknown (`null`) if the recorded quality threshold is unavailable.
- `comparison`: condition mismatches, neutral design changes and, only when comparable, actual subscore/resource deltas. A delta never assigns a contribution to one component.
- `isFinal`: true only for a recorded complete/failed simulation status; a result's success/partial/failed **score status** does not establish that execution has ended.
- `limitations`: incomplete-log and inspection/re-simulation qualifications for display.

## Clickable targets

An action identifies an inspection destination, not an automatic change. Before acting on a potentially edited design, call `resolveDebriefTarget(action.target, currentDesign)`.

| Target kind | View integration |
|---|---|
| `part` | Open assembly and select `partId` only when its saved physical signature still matches. |
| `part-kind` | Open the matching equipment/inspection category; do not pick an arbitrary component as the proven cause. |
| `operation` | Open planning and focus the recorded operation interval. |
| `maneuver` | Focus a uniquely matching physical node; preserve meaningful simultaneous execution ordering. |
| `time` | Open `trajectory`, `timeline` or `resources` at `time`. |
| `command` | Open the historical command record; this is not a request to retransmit it. |

`TargetResolution.status` is `exact`, `semantic`, `stale` or `ambiguous`. ID reuse cannot select a different component silently. A unique physical signature can follow a renamed ID. Missing/ambiguous parts fall back to the category; changed operations/nodes fall back to their historical time. Tell the player when this fallback occurs. Navigation to historical times should be clamped to the selected mission's valid range by the UI. Restore/use the result's mission context before navigating; this helper does not change missions.

## Evidence limits

`SAFE_MODE` establishes the recorded energy-safety interruption, while `DISCHARGE_LIMIT` establishes an EPS **power** limit. Neither proves a particular panel was obstructed or that extra battery **energy** capacity would resolve the interruption. `STORAGE_FULL`, `LINK_RETRY`, `FUEL`, `IMPACT`, debris separation and failed/pending commands retain their recorded locations and times.

Zero captured packets with an installed sensor produces an inspection checklist, not a camera-obstruction diagnosis. Fully emitted bits without a receipt timestamp are **reception unconfirmed**, not necessarily currently in flight: a `MissionResult` does not contain the remaining transmission queue. Later data are not counted as received at an earlier evaluation time. Event histories may be capped or deduplicated, so the module does not infer complete outage durations or absence of failures from missing events.

## Comparison and design changes

Score comparisons require matching mission, scenario seed, normalized geographic target, hazard, evaluation time, required count, recorded quality/deadline requirements, model version and score-definition ID. Missing metadata is a blocker. Command choices, hardware, bus, active radio, launch package, geometry, trajectory and operations are design/strategy differences, not reasons to prevent a same-condition comparison.

Canonicalization ignores craft name and physical-object IDs, property insertion order, array reordering where cosmetic, equivalent 0°/360° rotations, default no-hazard, and mission-inactive trajectory fields. Legacy versus explicit maneuver representation is normalized. Simultaneous maneuver execution order is preserved because the engine's tie-break can affect physics. Command order is likewise preserved where multiple requests share a time.

Hardware signatures include optional `modelId`; design changes include `busId`, `hardwareVersion` and the physical active-radio choice. Absent models/bus keep explicit `legacy:*` identities. `HardwareCanonicalization` may supply default aliases **only when those defaults are physically equivalent**; it must not equate a new hardware profile with the legacy integrated model without evidence. Duplicate ambiguous changes are represented as a component-group change rather than an invented one-to-one move.

The simulator owns score definitions and arithmetic. The M01/M02 descriptor is `science60-navigation25-resources15-v1`; this module displays the actual result's subscore differences and never duplicates that calculation. **M03's 70/20/10 system and `TransferResult` need a separate future adapter. They are not forced into this 60/25/15 structure.**

## Verification

`npx.cmd vitest run tests/debrief.test.ts`: **32 tests passed** after result metadata integration. This checks frozen deterministic behavior, packet/command evidence distinctions, partial evaluations and log limits, score comparison guards, hardware/operation/orbit deltas, duplicate matching and stale navigation targets. It includes the property-order regression and active-radio versus passive-antenna navigation distinction.

The real-engine integration case runs the legacy Earth mission to its 10,800 s deadline with the antenna removed, then runs the balanced repair. It confirms actual zero reception despite captured data, at least four valid receipts after repair, genuine producing-engine metadata, one antenna addition in the neutral difference, and immutable score descriptor objects. A real 900 s interim execution remains nonfinal and cannot be compared to the deadline result as if evaluated at the same time.

`tests/browser/debrief.spec.ts` defines two browser journeys: actual 600× failed delivery → diagnostic navigation → pointer-installed antenna → real repeated mission; and English interim-result/navigation/CTA bounds at 1280×720. These tests have been **listed successfully but not run against a frozen candidate yet**. They intentionally do not call the QA `finishFast` shortcut. Unit success does not establish browser integration or visual quality; record executed browser outcomes separately in the QA report.
