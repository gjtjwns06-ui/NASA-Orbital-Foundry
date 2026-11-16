import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const out=join(process.cwd(),'tests/browser/artifacts/experience-reset-assembly');
mkdirSync(out,{recursive:true});
test.use({viewport:{width:1280,height:720}});
test.setTimeout(90000);
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());
async function settled(page:Page){
  await page.waitForFunction(()=>{const g=(window as any).__game;return g&&!g.scene.tween&&!g.getState().pending;},null,{timeout:30000});
}

test('fresh entry exposes exploration and contextual assembly without false camera selection',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?qa');
  await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
  await expect(page.locator('.home-actions > .primary')).toHaveCount(1);
  await expect(page.locator('[data-action="solar-campaign"]')).toBeVisible();
  await expect(page.locator('[data-action="missions"]')).toBeHidden();
  await page.locator('.home-laboratory > summary').click();
  await page.locator('[data-action="missions"]').click();
  await page.locator('[data-mission="earth"]').click();
  await settled(page);
  expect((await state(page)).design.parts).toHaveLength(0);
  await expect(page.locator('.part-card[data-selected="true"]')).toHaveCount(0);
  await expect(page.locator('.inspection-tools')).toHaveCount(0);
  await expect(page.locator('[data-action="view-front"]')).toBeHidden();
  await expect(page.locator('[data-action="camera-reset"]')).toBeVisible();
  await expect(page.locator('.assembly-mission-details')).not.toHaveAttribute('open','');

  // Use the explicit precision-view drawer, then physically drag a shelf part.
  // Projection is read-only instrumentation; it is not a novice-discovery claim.
  await page.locator('.assembly-utilities > summary').click();
  await page.locator('[data-action="view-front"]').click();
  await settled(page);
  const card=await page.locator('[data-part="camera"]').boundingBox();
  const target=await page.evaluate(()=>{const scene=(window as any).__game.scene;return scene.project(scene.craft.position.clone().add({x:0,y:0,z:.65}));});
  expect(card).not.toBeNull();
  await page.mouse.move(card!.x+card!.width/2,card!.y+card!.height/2);
  await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:15});await page.mouse.up();
  await expect.poll(async()=>(await state(page)).design.parts.length).toBe(1);
  await expect(page.locator('[data-part="camera"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.context-inspection[data-action="inspect-camera"]')).toBeVisible();
  await page.locator('.context-inspection[data-action="inspect-camera"]').click();
  await expect(page.locator('.context-inspection-result')).toBeVisible();
  await page.locator('[data-action="inspect-off"]').click();

  // Keyboard placement remains a real UI path after reducing permanent controls.
  await page.locator('[data-part="engine"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.keyboard-placement')).toBeVisible();
  await page.locator('[data-kb-field="face"]').selectOption('ny');
  await page.locator('[data-kb-command="confirm"]').click();
  await expect.poll(async()=>(await state(page)).design.parts.length).toBe(2);
  await expect(page.locator('[data-part="engine"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-part="camera"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.part-card[data-selected="true"]')).toHaveCount(1);
  await expect(page.locator('[data-recommended]')).toHaveCount(0);
  await expect(page.locator('#inspector')).toContainText('궤도 보정 엔진');
  await expect(page.locator('.context-inspection[data-action="inspect-camera"]')).toHaveCount(0);

  await page.screenshot({path:join(out,'selected-engine-1280.png')});
  writeFileSync(join(out,'assembly-result.json'),JSON.stringify({browser:page.context().browser()?.version(),url:page.url(),parts:(await state(page)).design.parts,errors,scope:'Functional UI check; no first-time-human understanding or fun claim.'},null,2));
  expect(errors).toEqual([]);
});
