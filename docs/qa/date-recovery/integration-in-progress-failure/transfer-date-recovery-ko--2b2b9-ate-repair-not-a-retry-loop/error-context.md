# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transfer-date-recovery.spec.ts >> ko: the reported 80-day arrival has an explicit date repair, not a retry loop
- Location: tests\browser\transfer-date-recovery.spec.ts:11:3

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f4e3]:
  - generic [ref=f4e4]: "[plugin:vite:import-analysis] Failed to resolve import \"./experience-reset.css\" from \"src/main.ts\". Does the file exist?"
  - generic [ref=f4e5]: C:/Users/gjtjw/Desktop/NASA_apps_challenge/orbital-foundry/src/main.ts:3:7
  - generic [ref=f4e6]: "1 | import \"./style.css\"; 2 | import \"./keyboard-assembly.css\"; 3 | import \"./experience-reset.css\"; | ^ 4 | import { KeyboardPlacement, keyboardPlacementHTML, installedPartsHTML } from \"./keyboard-assembly\"; 5 | import {"
  - generic [ref=f4e7]: at TransformPluginContext._formatLog (file:///C:/Users/gjtjw/Desktop/NASA_apps_challenge/orbital-foundry/node_modules/vite/dist/node/chunks/config.js:29250:43) at TransformPluginContext.error (file:///C:/Users/gjtjw/Desktop/NASA_apps_challenge/orbital-foundry/node_modules/vite/dist/node/chunks/config.js:29247:14) at normalizeUrl (file:///C:/Users/gjtjw/Desktop/NASA_apps_challenge/orbital-foundry/node_modules/vite/dist/node/chunks/config.js:27370:18) at process.processTicksAndRejections (node:internal/process/task_queues:104:5) at async file:///C:/Users/gjtjw/Desktop/NASA_apps_challenge/orbital-foundry/node_modules/vite/dist/node/chunks/config.js:27428:32 at async Promise.all (index 2) at async TransformPluginContext.transform (file:///C:/Users/gjtjw/Desktop/NASA_apps_challenge/orbital-foundry/node_modules/vite/dist/node/chunks/config.js:27396:4) at async EnvironmentPluginContainer.transform (file:///C:/Users/gjtjw/Desktop/NASA_apps_challenge/orbital-foundry/node_modules/vite/dist/node/chunks/config.js:29048:14) at async loadAndTransform (file:///C:/Users/gjtjw/Desktop/NASA_apps_challenge/orbital-foundry/node_modules/vite/dist/node/chunks/config.js:22914:26)
  - generic [ref=f4e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.You can also disable this overlay by setting
    - code [ref=f4e9]: server.hmr.overlay
    - text: to
    - code [ref=f4e10]: "false"
    - text: in
    - code [ref=f4e11]: vite.config.js
    - text: .
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
> 16 |     await page.waitForFunction(() => Boolean((window as any).__game?.getState().assetsReady));
     |                ^ Error: page.waitForFunction: Test timeout of 90000ms exceeded.
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
  28 |     await expect(page.locator('.transfer-error')).toContainText('2027-03-15');
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