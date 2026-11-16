import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
test.use({viewport:{width:1280,height:720}});
const artifacts=join(process.cwd(),'tests/browser/artifacts/transfer');mkdirSync(artifacts,{recursive:true});
async function state(page:Page){return page.evaluate(()=>(window as any).__game.transfer()?.getState());}
async function boot(page:Page){await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-transfer"]').click();await expect(page.locator('.scene-title')).toContainText('PATHFINDER');await page.locator('[data-action="plan"]').last().click();await page.waitForFunction(()=>{const t=(window as any).__game.transfer()?.getState();return t&&!t.pending;},null,{timeout:30000});}
async function action(page:Page,name:string){await page.locator(`[data-transfer-action="${name}"]`).first().click();}
async function next(page:Page){const before=(await state(page)).runtime.time;await action(page,'next');await expect.poll(async()=>{const t=await state(page);return t.runtime.time>before&&!t.playing;},{timeout:45000}).toBe(true);}
test('full Earth to Mars mission integrates all three phases and restores its verified receipt checkpoint',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await boot(page);let s=await state(page);expect(s.preview.status).toBe('success');expect(s.evaluation.launchable).toBe(true);
 await expect(page.locator('[data-transfer-action="launch"]')).toBeEnabled();await page.screenshot({path:join(artifacts,'planning-1280x720.png')});
 await action(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.transfer()?.getState().runtime));
 await next(page);s=await state(page);expect(s.telemetry.environment.state.phase).toBe('solar-coast');expect(s.runtime.fuelKg).toBe(6);
 await next(page);s=await state(page);expect(s.telemetry.environment.state.phase).toBe('mars-flyby');expect(s.runtime.time).toBeGreaterThan(240*86400);
 await action(page,'view-mars');await next(page);await page.screenshot({path:join(artifacts,'mars-encounter.png')});
 await next(page);s=await state(page);expect(s.runtime.status).toBe('complete');expect(s.result.status).toBe('success');expect(s.runtime.scienceReceived).toBeGreaterThanOrEqual(3);
 expect(s.runtime.packets.every((p:any)=>p.receivedAt===null||p.receivedAt>p.capturedAt)).toBe(true);
 await page.locator('.transfer-save-tools summary').click();await action(page,'save');await expect(page.locator('.transfer-save-tools')).toContainText('저장됨');
 const checkpoint=JSON.parse(JSON.stringify(s.runtime));await action(page,'exit');await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-transfer"]').click();await page.locator('[data-action="plan"]').last().click();await page.locator('.transfer-save-tools summary').click();await action(page,'load');
 await expect.poll(async()=> (await state(page))?.runtime?.status,{timeout:30000}).toBe('complete');const restored=JSON.parse(JSON.stringify((await state(page)).runtime));writeFileSync(join(artifacts,"checkpoint-before.json"),JSON.stringify(checkpoint,null,2));writeFileSync(join(artifacts,"checkpoint-after.json"),JSON.stringify(restored,null,2));expect(restored).toEqual(checkpoint);
 await page.screenshot({path:join(artifacts,'received-restored.png')});expect(errors).toEqual([]);
 writeFileSync(join(artifacts,'mission-replay.json'),JSON.stringify({browser:page.context().browser()?.version(),url:page.url(),result:s.result,phases:s.runtime.events.filter((e:any)=>['EARTH_EXIT','MARS_ENTRY','PERIAPSIS','MARS_EXIT'].includes(e.code)),errors},null,2));
});

test('3D departure date handles and encounter blocks change the solved plan without numeric input',async({page})=>{
 test.setTimeout(90000);await boot(page);const before=await state(page);
 const handle=await page.evaluate(()=>(window as any).__game.transfer().scene.getHandleScreen('departure'));expect(handle).toBeTruthy();
 await page.mouse.move(handle.x,handle.y);await page.mouse.down();await page.mouse.move(handle.x+65,handle.y-30,{steps:18});await page.mouse.up();
 await expect.poll(async()=> (await state(page)).plan.departurePeriapsisJdTdb).not.toBe(before.plan.departurePeriapsisJdTdb);
 await page.waitForFunction(()=>!(window as any).__game.transfer().getState().pending,null,{timeout:30000});
 await page.getByText('예시 계획 불러오기',{exact:true}).click();await action(page,'balanced');await page.waitForFunction(()=>!(window as any).__game.transfer().getState().pending,null,{timeout:30000});
 const old=(await state(page)).plan.operations.find((o:any)=>o.id==='encounter-science');const block=page.locator('[data-transfer-op="encounter-science"]');const box=await block.boundingBox();expect(box).toBeTruthy();
 await page.mouse.move(box!.x+box!.width*.4,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width*.4-45,box!.y+box!.height/2,{steps:12});await page.mouse.up();
 await expect.poll(async()=>(await state(page)).plan.operations.find((o:any)=>o.id==='encounter-science').start).toBeLessThan(old.start);
 await page.waitForFunction(()=>!(window as any).__game.transfer().getState().pending,null,{timeout:30000});await page.screenshot({path:join(artifacts,'pointer-edited-path.png')});
});
