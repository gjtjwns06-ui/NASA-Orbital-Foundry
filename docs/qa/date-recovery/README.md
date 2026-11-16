# M03 date recovery — scoped regression

Date: 2026-11-15. This verifies the reported date trap, not the overall game's fun or new Solar System campaign.

## Defect and correction

The reported 2026-11-15 → 2027-02-03 route is 80 days. The existing solver supports 120–450 days within the bundled ephemeris interval. The UI offered unrestricted date inputs and an error button that submitted identical invalid input indefinitely.

The date controls now expose supported calendar bounds. Invalid edits are rejected before starting a new solve, and the error offers an explicit nearest supported-date proposal or a previously valid route. Applying the proposal preserves spacecraft, geometry, operation IDs, durations, and encounter-relative operation timing. A repair that would truncate a custom schedule is not applied. A supported date is not advertised as a fuel-feasible trajectory.

The native regression also found that focused inputs prevented the whole panel from repainting: an 80-day edit still displayed the previous 260-day, funded launch state. The focused input now keeps its focus while the date error, duration, invalid state, and disabled launch update; obsolete fuel/science figures clear immediately.

Strict saves remain strict. A rejected old saved date shows calendar bounds, retains the stored bytes, and offers a new route using the current valid draft dates when no mission was retained. It does not silently rewrite an invalid save.

## Verification

- TypeScript: `npx.cmd tsc --noEmit`, passed on isolated released-source snapshot plus this fix.
- CPU: `npx.cmd vitest run tests/transfer-date-window.test.ts tests/transfer-planning.test.ts tests/transfer-plan-comparison.test.ts`, 3 files / 22 tests passed.
- Native Edge: `tests/browser/transfer-date-recovery.spec.ts`, 3 cases passed in 1.0 minute. KO and EN each edited the real date input, repaired to 120 days, retained the real insufficient-fuel restriction, then restored the original 260-day plan. The third case exported a real draft, introduced an unsupported saved date, loaded it through the campus UI, and verified that recovery left the rejected saved bytes unchanged.
- KO/EN evidence: `tests/browser/artifacts/transfer-date-recovery/` (invalid-input screenshots, repaired-route screenshots, browser/result metadata).

Browser tests used `date-recovery-qa`, an isolated snapshot of main HEAD `69014f57f00cb313e7c2450cec36bafa6e7f2ef8` plus the date correction, at local port 5198. This avoided ongoing main-UI edits; this is not an integrated-new-campaign or deployed-site test. Both temporary date QA Vite servers were stopped after testing.

Integration follow-up: on the same date, all three cases passed again as part of the 6-case production-preview suite on main at port 5188 (approximately 21:06–21:08 KST), alongside the new Solar campaign and simplified assembly. The artifact directory now contains those integrated captures/results. This establishes integration, not a hosted-site or novice-use claim. See [release evidence](../experience-reset-release.md).

## Retained failed attempts

- `integration-in-progress-failure/`: initial live-main run could not boot because a concurrent main edit imported `experience-reset.css` before the file existed. This was a changing-development-source failure.
- `focused-input-failure/`: initial isolated KO/EN run found the real focus/render gate defect described above; corrected before the final 3-case pass.
- A test-only attempt to import the Vite JSON ephemeris modules directly into Node's Playwright runner failed on Node's JSON import attribute requirement before collecting tests. The final test obtains its save through the actual UI export instead.

No orbital model, source ephemerides, launch-stage assumptions, save schema, replay checkpoint validation, or physical feasibility thresholds were changed. The broader legacy planning UI still merits redesign; these checks establish recovery correctness rather than novice usability.
