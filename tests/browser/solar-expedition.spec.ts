import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {reachEncounter,cameraScience,voyageButton,voyageState} from './voyage-helpers';

const out=join(process.cwd(),'tests/browser/artifacts/solar-expedition');mkdirSync(out,{recursive:true});
test.setTimeout(150000);
test.use({viewport:{width:1440,height:900}});
const button=(page:Page,action:string)=>page.locator(`[data-solar-action="${action}"]`).first();
async function start(page:Page){
 await page.goto('/?qa');await page.locator('[data-action="solar-campaign"]').click();
 await expect(page.locator('.solar-experience')).toBeVisible({timeout:45000});
 await page.screenshot({path:join(out,'story-opening.png')});
 for(let i=0;i<3;i++)await button(page,'story').click();
 await expect(page.locator('.solar-objective h1')).toHaveText('아스터-7');
 await page.waitForTimeout(1200); // Let the story-to-map camera transition settle.
}
test('a real first expedition: story, responsive route drag, own craft, observation, return and discovery',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await start(page);
 const initial=await page.locator('[data-arrival-date]').textContent();
 const handle=page.locator('[data-route-drag="arrival"]');await expect(handle).toBeVisible();
 const box=await handle.boundingBox();expect(box).not.toBeNull();
 await page.mouse.move(box!.x+box!.width/2,box!.y+20);await page.mouse.down();
 await page.mouse.move(box!.x+box!.width/2-70,box!.y+20,{steps:14});
 await expect(page.locator('[data-arrival-date]')).not.toHaveText(initial!);
 await page.screenshot({path:join(out,'route-drag-before-release.png')});
 await page.mouse.up();await button(page,'undo').click();
 await expect(page.locator('[data-arrival-date]')).toHaveText(initial!);
 // Keyboard edits expose the same route feedback and can be undone.
 await handle.focus();await page.keyboard.press('ArrowLeft');
 const keyed=await page.locator('[data-arrival-date]').textContent();expect(keyed).not.toBe(initial);
 await button(page,'undo').click();
 // User-built assets remain part of this same exploration journey.
 await button(page,'build').click();await expect(page.locator('.solar-experience')).toHaveCount(0);
 await expect(page.locator('.solar-assembly-heading')).toContainText('태양계');
 await expect(page.locator('.part-card[data-selected="true"]')).toHaveCount(0);
 await expect(page.locator('.inspection-tools')).toHaveCount(0);
 await page.waitForTimeout(1200); // Inspect the workshop after its camera transition.
 await page.screenshot({path:join(out,'assembly-context.png')});
 await page.locator('.assembly-flightbar [data-action="solar-campaign"]').click();
 await expect(page.locator('.solar-objective h1')).toHaveText('아스터-7');
 const launch=button(page,'launch');
 if(await launch.isDisabled())await button(page,'window').click();
 await expect(launch).toBeEnabled();await launch.click();
 // Native voyage controls resolve the forecast and reach the local flyby.
 // Camera helpers read geometry, then use real mouse aiming/zoom and Space
 // exposure; no hidden game-state setters award science.
 await reachEncounter(page);
 await cameraScience(page);
 await expect(page.locator('.voyage-latest-photo img')).toHaveAttribute('src',/^data:image\/jpeg;base64,/);
 expect((await voyageState(page)).operations.records).toHaveLength(2);
 expect((await voyageState(page)).summary.ready).toBe(true);
 await page.screenshot({path:join(out,'aster-observations.png')});
 await voyageButton(page,'send').click();await expect(page.locator('.solar-discovery-card')).toBeVisible({timeout:30000});
 await expect(page.locator('.solar-discovery-card img').first()).toHaveAttribute('src',/^data:image\/jpeg;base64,/);
 await button(page,'journal').click();await expect(page.locator('.solar-drawer > article')).toHaveCount(1);await button(page,'panel-close').click();
 await page.screenshot({path:join(out,'first-discovery.png')});
 await button(page,'map').click();
 await page.locator('.solar-destinations [data-solar-body="saturn"]').click();
 await expect(page.locator('.solar-objective h1')).toHaveText('토성');
 await page.screenshot({path:join(out,'saturn-route.png')});
 await page.reload();await page.locator('[data-action="solar-campaign"]').click();
 await expect(page.locator('.solar-dialogue')).toHaveCount(0);await expect(page.locator('.solar-objective h1')).toHaveText('토성');
 await button(page,'journal').click();await expect(page.locator('.solar-drawer > article')).toHaveCount(1);
 writeFileSync(join(out,'journey-result.json'),JSON.stringify({errors,viewport:page.viewportSize(),browser:page.context().browser()?.version(),checks:['story shown once','drag changes date before release','undo','keyboard route edit','same craft editor and return','native cruise decision and safe recovery','native camera framing and held context/detail exposures','received discovery with JPEG','Saturn destination','reload journal'],claim:'Functional and visual inspection using native inputs and read-only geometry, not a human fun/novice study.'},null,2));
 expect(errors).toEqual([]);
});

test('multiple destination routes and compact viewport remain operable',async({page})=>{
 await page.setViewportSize({width:1280,height:720});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 for(const id of ['mercury','venus','mars','jupiter','saturn','uranus','neptune']){
  await page.locator(`.solar-destinations [data-solar-body="${id}"]`).click();
  await expect(page.locator(`[data-route-drag="arrival"]`)).toBeVisible();
  const bb=await button(page,'launch').boundingBox();expect(bb).not.toBeNull();expect(bb!.x+bb!.width).toBeLessThanOrEqual(1280);expect(bb!.y+bb!.height).toBeLessThanOrEqual(720);
 }
 await page.screenshot({path:join(out,'neptune-1280.png')});expect(errors).toEqual([]);
});
