import {test, expect, type Page} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifacts = join(process.cwd(), 'tests/browser/artifacts/solar-controls', process.env.SOLAR_CONTROLS_RUN_ID ?? 'r1');
mkdirSync(artifacts, {recursive: true});
test.use({viewport: {width: 1440, height: 900}});
test.setTimeout(90000);
const action = (page: Page, name: string) => page.locator(`[data-solar-action="${name}"]`).first();
const dates = async (page: Page) => ({
  departure: await page.locator('[data-departure-date]').textContent(),
  arrival: await page.locator('[data-arrival-date]').textContent(),
  fuel: await page.locator('.solar-route-fuel strong').textContent(),
});

test('English first keyboard edit exposes Undo; Escape cancels a pointer route edit and leaves dragging usable', async ({page}, info) => {
  const errors: string[] = [], checks: string[] = [];
  const targets: unknown[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico'))
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.addInitScript(() => localStorage.setItem('orbital-language', 'en'));
  try {
    await page.goto('/');
    await page.locator('[data-action="solar-campaign"]').click();
    await expect(page.locator('.solar-experience')).toBeVisible({timeout: 45000});
    for (let i = 0; i < 3; i++) await action(page, 'story').click();
    await expect(page.locator('.solar-objective h1')).toHaveText('ASTER-7');
    await page.waitForTimeout(1200); // Let the actual story-to-map camera transition settle.
    const initial = await dates(page);
    const handle = page.locator('[data-route-drag="arrival"]');
    await expect(action(page, 'undo')).toHaveCount(0);
    await handle.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-arrival-date]')).not.toHaveText(initial.arrival!);
    await expect(action(page, 'undo')).toBeVisible();
    await expect(handle).toBeFocused();
    checks.push('First keyboard edit changes date and exposes Undo while retaining handle focus');
    await page.screenshot({path: join(artifacts, 'en-first-keyboard-undo.png')});
    await action(page, 'undo').click();
    await expect.poll(() => dates(page)).toEqual(initial);
    checks.push('First keyboard Undo restores departure, arrival and computed fuel');

    async function beginMouseDrag(distance: number) {
      await expect(handle).toBeVisible();
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(1440);
      expect(box!.y + box!.height).toBeLessThanOrEqual(900);
      const point = {x: box!.x + box!.width / 2, y: box!.y + box!.height / 2};
      const hit = await page.evaluate(point => {
        const element = document.elementFromPoint(point.x, point.y);
        return {kind: element?.closest<HTMLElement>('[data-route-drag]')?.dataset.routeDrag, activeTag: document.activeElement?.tagName};
      }, point);
      targets.push({box, point, hit});
      expect(hit.kind, 'Visible handle centre is a real pointer target').toBe('arrival');
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.mouse.move(point.x + distance, point.y, {steps: 14});
    }

    // Use the actual mouse and global Escape. Do not pre-focus the handle: ordinary
    // pointer use must work even after Undo replaced the previous focused button.
    await beginMouseDrag(-60);
    await expect(page.locator('[data-arrival-date]')).not.toHaveText(initial.arrival!);
    await page.screenshot({path: join(artifacts, 'en-before-pointer-cancel.png')});
    await page.keyboard.press('Escape');
    await expect.poll(() => dates(page)).toEqual(initial);
    await page.mouse.up();
    await expect(page.locator('[data-route-drag].dragging')).toHaveCount(0);
    checks.push('Escape restores all route readouts before releasing the pointer');

    await beginMouseDrag(-45);
    await expect(page.locator('[data-arrival-date]')).not.toHaveText(initial.arrival!);
    await page.mouse.up();
    await expect(handle).toBeVisible();
    await expect(page.locator('[data-route-drag].dragging')).toHaveCount(0);
    const committed = await dates(page);
    expect(committed.arrival).not.toBe(initial.arrival);
    checks.push('A new pointer drag after cancellation commits a different route');
    await action(page, 'undo').click();
    await expect.poll(() => dates(page)).toEqual(initial);
    checks.push('Undo after the second pointer drag restores the original route');
    await page.screenshot({path: join(artifacts, 'en-route-controls-restored.png')});
    expect(errors).toEqual([]);
  } finally {
    await page.mouse.up().catch(() => {});
    const evidence = {
      url: page.url(), browser: page.context().browser()?.version(), viewport: page.viewportSize(),
      errors, checks, pointerTargets: targets,
      scripts: await page.locator('script[src]').evaluateAll(elements => elements.map(element => (element as HTMLScriptElement).src)).catch(() => []),
      claim: 'Native UI regression only; no hidden game-state setup or game-fun certification.',
    };
    writeFileSync(join(artifacts, 'english-controls-evidence.json'), JSON.stringify(evidence, null, 2));
    await info.attach('solar-controls-evidence', {body: JSON.stringify(evidence, null, 2), contentType: 'application/json'});
    await page.screenshot({path: join(artifacts, 'en-final-observed-state.png')}).catch(() => {});
  }
});
