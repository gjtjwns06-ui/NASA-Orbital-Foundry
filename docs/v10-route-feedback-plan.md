# Version 10: visible consequences of changing a route

Base: privately published version 9, source `0a7932fb212ce0ddfb08e2dbca82b4a184578882`. This is a bounded improvement to the original specification, not a replacement definition of completion.

## Player-facing outcome

In M03, drag a departure-date handle and see the previous feasible route as a gold dashed line beside the newly calculated route. Compare the real time to Mars, arrival, C3, escape-stage propellant and complete Earth-received science forecast. When the new route cannot be solved or launched, retain a usable prior plan and let the player restore its exact submitted input. Restore recomputes through the ordinary Worker.

Only the last accepted, launchable, full-duration forecast becomes an anchor. Zero science at the actual end is a valid comparison result; early power failure is not a complete forecast. Each route uses its own Mars-exit receipt deadline. Do not invent contact/eclipse totals absent from the solver. Do not apply a former route as live spacecraft state.

## Integration boundary

- Import four reviewed production files from the isolated NAV05 candidate: `transfer-ui.ts`, `transfer-ui.css`, `render/transfer-scene.ts`, `transfer-plan-comparison.ts`.
- Preserve all version 9 orbit, deployment, optional Earth, shading and Worker behavior. Do not import the candidate's older full tree or package dependencies.
- Preserve the rejected replay optimization separately. A replay change needs an independently accepted exactness and timing result before inclusion.

## Acceptance

1. Focused state-machine tests cover pending and stale responses, invalid/unlaunchable routes, original unclipped operation inputs, reset boundaries and detached snapshots.
2. Actual browser pointer manipulation changes the ordinary solved route and computed comparison; invalid routes retain the previous plan; visible restore returns the exact plan and forecast.
3. Korean 720p and English large-interface layouts keep the recovery action reachable. Pointer cancellation and actual graphics-context recovery preserve state. Import and actual launch clear planning comparison.
4. Review saved screenshots for clear dashed/solid route distinction and readable consequences. Native graphics ownership errors and application errors block acceptance.
5. After integration on version 9, build and run the relevant transfer/domain tests and actual browser comparison journey. Record exact source/build identities and preserved failures. Do not reuse the older candidate's Worker hash as version 9 integration proof.
6. Publish through the existing owner-private Site after acceptance. Native deployment is separate from hosted performance measurement. The original NAV05 remains partial if observation/contact/eclipse diffs are still absent.

## Independent review and current status

The independent consuming-UI review found no actionable blocker in request matching, detached prior-route ownership, exact restoration or preset/import/launch reset boundaries. This is source review only. Candidate native acceptance passed2/2 and integrated version9-based Edge acceptance passed2/2; exact scopes are in `docs/qa/milestone-10-local.md`. Private publication is the next step.
