# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transfer-date-recovery.spec.ts >> en: the reported 80-day arrival has an explicit date repair, not a retry loop
- Location: tests\browser\transfer-date-recovery.spec.ts:11:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.transfer-error')
Expected substring: "2027-03-15"
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" locator('.transfer-error') with timeout 15000ms
  - waiting for locator('.transfer-error')

```

```yaml
- text: SUN Current route unavailable · dashed line is the previous plan · return to that plan to recover.
- banner:
  - button "ORBITAL MISSION FOUNDRY"
  - text: M03 · EARTH TO MARS
  - button "Solar system"
  - button "Earth escape"
  - button "Mars encounter"
  - button "Spacecraft" [disabled]
- complementary:
  - text: FLIGHT WINDOW
  - heading "Connect two moving worlds" [level=2]
  - paragraph: Drag the Earth and Mars date handles along their orbits. Recalculate the fuel and power needed for a different encounter.
  - text: Earth departure · TDB
  - textbox "Earth departure · TDB": 2026-11-15
  - text: Mars periapsis · TDB
  - textbox "Mars periapsis · TDB": 2027-02-03
  - text: Time of flight
  - strong: 260 d
  - text: Mars periapsis altitude 1,000 km
  - slider "Mars periapsis altitude 1,000 km": "1000"
  - text: Encounter plane angle 0°
  - slider "Encounter plane angle 0°": "0"
  - button "Edit spacecraft layout"
  - group: Load example plan
  - group: Save & backup
  - group: Scientific model & sources
- complementary:
  - text: DEPARTURE REVIEW
  - heading "Ready to depart" [level=2]
  - text: Escape stage
  - combobox "Escape stage":
    - option "PATHFINDER · 95 C" [selected]
    - option "EXPLORER · 140 C"
    - option "HEAVY · 210 C"
  - text: Escape burn
  - strong: 3,687 m/s
  - text: C3
  - strong: 10.88 km²/s²
  - text: Stage fuel margin
  - strong: 18.6 kg
  - text: Mission cost
  - strong: 499 / 680 C
  - text: SCIENCE RETURN FORECAST —/ 3
  - paragraph: Reviewing full mission 99%
  - button "Execute Earth departure" [disabled]
  - paragraph: Stages and prices are authored game settings. Trajectories use JPL ephemerides and patched central-body gravity.
- text: Drag date handles · right-drag to orbit · wheel to zoom Planet and spacecraft display sizes exaggerated · computed distances and times
- strong: MARS ENCOUNTER SEQUENCE
- button "Approach · 6h"
- button "Delivery · 48h"
- text: Drag blocks to move · right edge to resize Spectra Downlink -3h -1.5h 0h 1.5h 3h 0h = Mars periapsis · empty periods charge toward the Sun · date changes preserve encounter-relative timing
```

# Test source

```ts
  1  | import {test, expect} from '@playwright/test';
  2  | import {mkdirSync, writeFileSync} from 'node:fs';
  3  | import {join} from 'node:path';
  4  | 
  5  | const artifacts = join(process.cwd(), 'tests/browser/artifacts/transfer-date-recovery');
  6  | mkdirSync(artifacts, {recursive: true});
  7  | test.setTimeout(90000);
  8  | test.use({viewport: {width: 1440, height: 900}});
  9  | 
  10 | for (const language of ['ko', 'en'] as const) {
  11 |   test(`${language}: the reported 80-day arrival has an explicit date repair, not a retry loop`, async ({page}) => {
  12 |     const errors: string[] = [];
  13 |     page.on('pageerror', error => errors.push(error.message));
  14 |     await page.addInitScript(language => localStorage.setItem('orbital-language', language), language);
  15 |     await page.goto('/?qa');
  16 |     await page.waitForFunction(() => Boolean((window as any).__game?.getState().assetsReady));
  17 |     await page.locator('[data-action="missions"]').first().click();
  18 |     await page.locator('[data-action="mission-transfer"]').click();
  19 |     await page.locator('[data-action="plan"]').last().click();
  20 |     await page.waitForFunction(() => {const state = (window as any).__game.transfer()?.getState(); return state && !state.pending;}, null, {timeout: 45000});
  21 |     const original = await page.evaluate(() => (window as any).__game.transfer().getState());
  22 |     expect(original.error).toBe('');
  23 |     const arrival = page.locator('[data-transfer-date="arrival"]');
  24 |     await expect(arrival).toHaveAttribute('min', '2027-03-15');
  25 |     await expect(arrival).toHaveAttribute('max', '2028-02-08');
  26 |     await arrival.fill('2027-02-03');
  27 |     await arrival.press('Tab');
> 28 |     await expect(page.locator('.transfer-error')).toContainText('2027-03-15');
     |                                                   ^ Error: expect(locator).toContainText(expected) failed
  29 |     await expect(page.locator('.transfer-error')).not.toContainText('2461479.5');
  30 |     await expect(page.locator('[data-transfer-action="recalculate"]')).toHaveCount(0);
  31 |     await expect(page.locator('[data-transfer-date="arrival"]')).toHaveAttribute('aria-invalid', 'true');
  32 |     await expect(page.locator('[data-transfer-action="repair-dates"]')).toContainText('2027-03-15');
  33 |     const invalid = await page.evaluate(() => (window as any).__game.transfer().getState());
  34 |     expect(invalid.pending).toBe(false);
  35 |     expect(invalid.solution).toBeNull();
  36 |     expect(invalid.craft).toEqual(original.craft);
  37 |     await page.screenshot({path: join(artifacts, `${language}-invalid-date.png`)});
  38 |     await page.locator('[data-transfer-action="repair-dates"]').click();
  39 |     await expect(page.locator('[data-transfer-date="arrival"]')).toHaveValue('2027-03-15');
  40 |     await page.waitForFunction(() => !(window as any).__game.transfer().getState().pending, null, {timeout: 45000});
  41 |     const repaired = await page.evaluate(() => (window as any).__game.transfer().getState());
  42 |     expect(repaired.error).toBe('');
  43 |     expect(repaired.solution).toBeTruthy();
  44 |     expect(repaired.craft).toEqual(original.craft);
  45 |     expect(repaired.plan.arrivalPeriapsisJdTdb - repaired.plan.departurePeriapsisJdTdb).toBe(120);
  46 |     const originalPeri = (original.plan.arrivalPeriapsisJdTdb - original.plan.departurePeriapsisJdTdb) * 86400;
  47 |     const repairedPeri = 120 * 86400;
  48 |     expect(repaired.plan.operations.map((op: any) => ({...op, start: op.start - repairedPeri, end: op.end - repairedPeri})))
  49 |       .toEqual(original.plan.operations.map((op: any) => ({...op, start: op.start - originalPeri, end: op.end - originalPeri})));
  50 |     // Shortest supported time is not automatically launchable: don't relabel fuel feasibility.
  51 |     expect(repaired.evaluation.launchable).toBe(false);
  52 |     expect(repaired.evaluation.warnings.some((warning: any) => warning.code === 'STAGE_FUEL')).toBe(true);
  53 |     await expect(page.locator('[data-transfer-action="launch"]')).toBeDisabled();
  54 |     await page.screenshot({path: join(artifacts, `${language}-date-repaired.png`)});
  55 |     await page.locator('[data-transfer-action="restore-previous-plan"]').first().click();
  56 |     await page.waitForFunction(() => !(window as any).__game.transfer().getState().pending, null, {timeout: 45000});
  57 |     const restored = await page.evaluate(() => (window as any).__game.transfer().getState());
  58 |     expect(restored.plan).toEqual(original.plan);
  59 |     expect(restored.craft).toEqual(original.craft);
  60 |     expect(restored.evaluation.launchable).toBe(true);
  61 |     expect(errors).toEqual([]);
  62 |     writeFileSync(join(artifacts, `${language}-result.json`), JSON.stringify({language, errors, browser: page.context().browser()?.version(), repairedFlightDays: 120, originalPlanRestored: true, actualFuelRestrictionPreserved: true}, null, 2));
  63 |   });
  64 | }
  65 | 
```