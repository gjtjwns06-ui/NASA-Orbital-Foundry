# Detached M02B review and redesign

Version 6 is the accepted base. This candidate advances RES02–04 / QA15 through a real player loop; it does not declare the 57-row original specification finished.

## Player loop

1. Pause a real M02B flight or reach its result. `Review this flight` captures the authoritative Worker save. A dedicated review Worker strictly replays that exact save, with visible progress and cancellation. The original flight stays paused and intact.
2. Store that run as A in an independent review archive. The player scrubs a read-only 3D reconstruction, clicks recorded cause cards, and focuses the associated part, maneuver, packet or timeline instant. Both pose and telemetry refer to the same committed replay time. Future trajectory is never shown as achieved history.
3. `Make design B` copies initial craft/plan/numerics to the existing direct-manipulation builder. It does not copy used fuel, delivered data or a completed result. A remains immutable. The player changes hardware placement, aim or schedule with existing mouse controls and actually flies B.
4. Pin the new actual run as B. An A/B panel shows changed inputs and observed deltas only when compatible. Separate per-run terminal times remain visible. A synchronized cursor stays in the common elapsed-time range; each view identifies the run and committed time. Unsupported model/score/epoch combinations show a reason instead of a score delta.
5. Review archive survives reload separately from the current mission slot. JSON retains the exact original saves. Failed storage still offers the verified in-memory review and JSON download; it never reports persistence success.

## Presentation and controls

- Large, unobstructed 3D center with a compact left A/B/diagnostic rail and right comparison rail. Reuse the inspected mounted craft and actual attitude; part focus and orbit/wheel controls remain available.
- Bottom mouse-draggable time ruler with event markers, keyboard arrow steps, requested/committed labels while a seek runs, and a cancel control. Display the prior committed frame until a new one is ready; no fake interpolated resources.
- Top persistent Return to flight, Archive, JSON import/export, and Make B actions. KO/EN and normal/large UI must remain readable at 1280×720.
- Default compare uses one large 3D viewport with A/B switching at the same cursor, and optional path overlay only when the adapter certifies common-frame compatibility. No overlay mixes different epochs or reference frames.
- Explicit review label: this is reconstructed flight history. The live runtime does not advance while inspecting. On return, original camera/state is retained; resuming is deliberate.

## Ownership

- Root owns product UI, live-save capture and builder handoff in this isolated checkout.
- Redesign agent owns adapter/schema/controller/atomic archive. Its 41 engine files are a frozen test snapshot and must not overwrite production domain files.
- Product imports only verified new `src/redesign/**`; engine identity preflight must pass before build. Strict replay, archive verification and seek stay in the dedicated Worker.
- Every request/session and capture/return action has a stale-response barrier. Dispose cancels jobs, closes renderer resources, removes listeners and preserves committed archive records.
- Renderer only consumes same-time replay DTOs and the current frozen scenario. No force, success or performance is calculated by camera code.

## Acceptance evidence

- Actual weak-ADCS A flight → recorded skipped-burn diagnosis → 3D part focus → mouse replacement with strong ADCS → real B flight → compatible 75/95 observed comparison. Values must come from that run, not hard-coded expectations in product code.
- A exact save bytes/hash unchanged after fork, B edits, seek, cancellation, failed import and reload.
- Physical changes listed; cosmetic IDs/order/name do not invent differences. Incompatible and intermediate/final pairs visibly refuse delta comparison.
- Real time-ruler pointer, keyboard seek and diagnosis jump agree with authoritative replay sample time/position/attitude/resources; no live state change.
- Request supersession/cancel, archive quota/transaction abort, JSON roundtrip, native context loss and teardown/reopen remain recoverable.
- KO/EN × normal/large layout, Chrome/Edge actual journey, focused domain tests and appropriate legacy regressions. Browser evidence must distinguish genuine new flights from imported fixtures.

No implementation or acceptance result is asserted by this plan alone.
