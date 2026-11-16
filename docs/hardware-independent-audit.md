# Independent hardware integration audit

This bounded audit checks numerical units, connection constraints and save/model dispatch. It does **not** establish mission preset success, visual quality, all hardware combinations or manufacturer qualification. After the authored camera-exposure and physical detector-window revision, the catalogue is pinned as SHA-256 `25a47f24340365b5b52d62708ce987f7a90df4ee6559879b91464a2d24ae9a98` in the model and `public/data/hardware-catalog-v2.json`; this replaces the earlier candidate-A hash. UI/domain integration remains subject to candidate verification.

Executed checks:

- `npx.cmd vitest run tests/hardware-audit.test.ts tests/debrief.test.ts`: **44/44 passed** (12 hardware audit and 32 debrief cases), 2.95 s total, 2026-11-15 03:27:10 KST source run. The initial hardware audit had 11 cases; the added empty-design case verifies finite blocked-result resources/scores.
- Recomputed SHA-256 of `JSON.stringify(snapshot.content)` independently matches the pinned public catalogue identity, with 16 model records.
- `npx.cmd tsc --noEmit`: **passed** after correcting the intentionally invalid imported-version test fixture to an untrusted plain object.

No browser or GPU measurement was run for this audit. Browser debrief, hardware flow and language/scale coverage are prepared separately and await frozen production candidate B. The source science-disclosure and i18n checks passed 15/15 at 03:25:59 KST; both legacy HTML language hashes remain unchanged.

## Independent checks and observed results

| Area | Evidence and result |
|---|---|
| Source units | AX100 values independently calculated from the existing verified source record: 3.3 V × 0.8 A = 2.64 W DC; 3.3 V × 0.055 A = 0.1815 W RX; 30 dBm = 1 W RF. A 75 g authored carrier is added to the 24.5 g board. The passive antenna has no continuous DC draw. |
| Stored energy and array power | BPX keeps 86 Wh usable separate from 100 Wh nominal. Two packs have 172 Wh plus an explicitly assumed 0.1 kg controller. Six 45 W wings total 270 W and 6 × 0.885 + 0.4 = 5.71 kg. |
| Input compatibility | The Iris 35 W port reservation fails on the L18 12 V rail limited to 15 W, despite matching nominal voltage; the D35 port accepts it. Every assigned regulated output's full declared voltage interval lies within the component's accepted interval. |
| RF compatibility and rate | UHF radio plus X-band reflector produces zero link and an RF-band diagnostic. A compatible nearby UHF chain remains bounded by 38,400 signal bit/s × authored 0.75 payload fraction. |
| Selected radio | Adding an unselected connected AX100 increases downlink load only by RX/idle DC consumption, including bus conversion efficiency. It does not create a second active transmitter or sum rates. |
| Cosmetic equivalence | Renaming/reordering parts and adding 360° preserves selected physical radio, rates, mode power and inertia to 1e−10 numerical tolerance. Exact floating summation equality is not required; the initial exact assertion differed by about 4e−15 W and was corrected. |
| Bus mass and propellant | L18 starts with its actual 4 kg fuel. Wet mass independently sums the bus, hardware and 4 kg fuel; the legacy 6 kg inventory is not silently supplied. |
| M01 hardware replay | A real 900 s hardware execution round-trips via strict replay with its 2.0.0 model identity and controller state. Altering the saved controller rate is rejected. |
| M03 hardware replay | A real 1,200 s hardware transfer checkpoint replays its own transfer-2.0.0 model/controller and resources. Earth escape-stage propellant does not reduce the probe's 6 kg onboard inventory. Forged controller state is rejected. This is a short departure checkpoint, not proof of full transfer mission success. |
| Profile separation | M01/M02 versus M03 model markers, new-versus-legacy design fields, mismatched model/kind IDs and changed catalogue identities are rejected. Legacy drafts remain legacy. |
| Empty hardware design | A genuinely empty new-profile draft is blocked while its numeric result and resource fields remain finite. This unit assertion does not replace the pending browser SVG check. |

## Remaining release work

The original source evidence is in `public/data/component-sources.json` and `docs/hardware-expansion-proposal.md`. The subsequent source-card update now distinguishes legacy and hardware profiles and includes Iris V2.2 and XACT 2026 records with specific revisions/conditions. Camera optics, connection drivers, power-rail tolerances, battery/EPS limits, RF ground systems, carrier geometry and all credit prices remain authored game parameters where no specific published field is cited. These additions close the earlier missing-source-card/draft-hash release items; they do not constitute independent manufacturer qualification.

The engine owner separately handles the one-active-instrument rule, preset acquisition/pointing schedules and regional detector-window science. Their tests are not counted as independent evidence here. No production defect was found in the twelve hardware audit cases above; that statement is scoped to those checks.
