import {test, expect} from '@playwright/test';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifacts = join(process.cwd(), 'tests/browser/artifacts/transfer-date-recovery');
mkdirSync(artifacts, {recursive: true});
test.setTimeout(90000);
test.use({viewport: {width: 1440, height: 900}});

for (const language of ['ko', 'en'] as const) {
  test(`${language}: the reported 80-day arrival has an explicit date repair, not a retry loop`, async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(language => localStorage.setItem('orbital-language', language), language);
    await page.goto('/?qa');
    await page.waitForFunction(() => Boolean((window as any).__game?.getState().assetsReady));
    if (!await page.locator('[data-action="missions"]').first().isVisible())
      await page.locator('.home-laboratory > summary').click();
    await page.locator('[data-action="missions"]').first().click();
    await page.locator('[data-action="mission-transfer"]').click();
    await page.locator('[data-action="plan"]').last().click();
    await page.waitForFunction(() => {const state = (window as any).__game.transfer()?.getState(); return state && !state.pending;}, null, {timeout: 45000});
    const original = await page.evaluate(() => (window as any).__game.transfer().getState());
    expect(original.error).toBe('');
    const arrival = page.locator('[data-transfer-date="arrival"]');
    await expect(arrival).toHaveAttribute('min', '2027-03-15');
    await expect(arrival).toHaveAttribute('max', '2028-02-08');
    await arrival.fill('2027-02-03');
    await arrival.press('Tab');
    await expect(page.locator('.transfer-error')).toContainText('2027-03-15');
    await expect(page.locator('.transfer-error')).not.toContainText('2461479.5');
    await expect(page.locator('[data-transfer-action="recalculate"]')).toHaveCount(0);
    await expect(page.locator('[data-transfer-date="arrival"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-transfer-action="repair-dates"]')).toContainText('2027-03-15');
    await expect(page.locator('.transfer-left .transfer-metric').filter({hasText: language === 'ko' ? '행성 간 비행' : 'Time of flight'})).toContainText('80 d');
    await expect(page.locator('.transfer-right .transfer-metric strong').first()).toHaveText('—');
    await expect(page.locator('[data-transfer-action="launch"]')).toBeDisabled();
    const invalid = await page.evaluate(() => (window as any).__game.transfer().getState());
    expect(invalid.pending).toBe(false);
    expect(invalid.solution).toBeNull();
    expect(invalid.craft).toEqual(original.craft);
    await page.screenshot({path: join(artifacts, `${language}-invalid-date.png`)});
    await page.locator('[data-transfer-action="repair-dates"]').click();
    await expect(page.locator('[data-transfer-date="arrival"]')).toHaveValue('2027-03-15');
    await page.waitForFunction(() => !(window as any).__game.transfer().getState().pending, null, {timeout: 45000});
    const repaired = await page.evaluate(() => (window as any).__game.transfer().getState());
    expect(repaired.error).toBe('');
    expect(repaired.solution).toBeTruthy();
    expect(repaired.craft).toEqual(original.craft);
    expect(repaired.plan.arrivalPeriapsisJdTdb - repaired.plan.departurePeriapsisJdTdb).toBe(120);
    const originalPeri = (original.plan.arrivalPeriapsisJdTdb - original.plan.departurePeriapsisJdTdb) * 86400;
    const repairedPeri = 120 * 86400;
    expect(repaired.plan.operations.map((op: any) => ({...op, start: op.start - repairedPeri, end: op.end - repairedPeri})))
      .toEqual(original.plan.operations.map((op: any) => ({...op, start: op.start - originalPeri, end: op.end - originalPeri})));
    // Shortest supported time is not automatically launchable: don't relabel fuel feasibility.
    expect(repaired.evaluation.launchable).toBe(false);
    expect(repaired.evaluation.warnings.some((warning: any) => warning.code === 'STAGE_FUEL')).toBe(true);
    await expect(page.locator('[data-transfer-action="launch"]')).toBeDisabled();
    await page.screenshot({path: join(artifacts, `${language}-date-repaired.png`)});
    await page.locator('[data-transfer-action="restore-previous-plan"]').first().click();
    await page.waitForFunction(() => !(window as any).__game.transfer().getState().pending, null, {timeout: 45000});
    const restored = await page.evaluate(() => (window as any).__game.transfer().getState());
    expect(restored.plan).toEqual(original.plan);
    expect(restored.craft).toEqual(original.craft);
    expect(restored.evaluation.launchable).toBe(true);
    expect(errors).toEqual([]);
    writeFileSync(join(artifacts, `${language}-result.json`), JSON.stringify({language, errors, browser: page.context().browser()?.version(), repairedFlightDays: 120, originalPlanRestored: true, actualFuelRestrictionPreserved: true}, null, 2));
  });
}

test('a rejected old saved date can open a valid draft without rewriting that saved file', async ({page}) => {
  await page.goto('/?qa');
  await page.waitForFunction(() => Boolean((window as any).__game?.getState().assetsReady));
  if (!await page.locator('[data-action="missions"]').first().isVisible())
    await page.locator('.home-laboratory > summary').click();
  await page.locator('[data-action="missions"]').first().click();
  await page.locator('[data-action="mission-transfer"]').click();
  await page.locator('[data-action="plan"]').last().click();
  await page.waitForFunction(() => {const state = (window as any).__game.transfer()?.getState(); return state && !state.pending;}, null, {timeout: 45000});
  await page.locator('.transfer-save-tools > summary').click();
  const downloading = page.waitForEvent('download');
  await page.locator('[data-transfer-action="export"]').click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  const raw = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  raw.plan.arrivalPeriapsisJdTdb = raw.plan.departurePeriapsisJdTdb + 80;
  const savedText = JSON.stringify(raw);
  await page.evaluate(async text => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('orbital-foundry-journey', 1);
    request.onupgradeneeded = () => {if (!request.result.objectStoreNames.contains('saves')) request.result.createObjectStore('saves');};
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(text, 'autosave');
      tx.oncomplete = () => {db.close(); resolve();};
      tx.onerror = () => {db.close(); reject(tx.error);};
    };
  }), savedText);
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).__game?.getState().assetsReady));
  if (!await page.locator('[data-action="load-transfer"]').first().isVisible())
    await page.locator('.home-laboratory > summary').click();
  await page.locator('[data-action="load-transfer"]').first().click();
  await expect(page.locator('.transfer-error')).toContainText('2027-03-15');
  await expect(page.locator('.transfer-error')).not.toContainText('2461479.5');
  await page.locator('[data-transfer-action="open-valid-plan"]').click();
  await page.waitForFunction(() => {const state = (window as any).__game.transfer()?.getState(); return state && !state.pending;}, null, {timeout: 45000});
  const current = await page.evaluate(() => (window as any).__game.transfer().getState());
  expect(current.solution).toBeTruthy();
  expect(current.error).toBe('');
  expect(current.plan.arrivalPeriapsisJdTdb - current.plan.departurePeriapsisJdTdb).toBe(260);
  const retainedText = await page.evaluate(async () => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('orbital-foundry-journey', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, get = db.transaction('saves', 'readonly').objectStore('saves').get('autosave');
      get.onsuccess = () => {db.close(); resolve(get.result);};
      get.onerror = () => {db.close(); reject(get.error);};
    };
  }));
  expect(retainedText).toBe(savedText);
});
