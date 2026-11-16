import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifacts=join(process.cwd(),'tests/browser/artifacts/transfer-resilience');mkdirSync(artifacts,{recursive:true});
const test=base.extend<{logs:string[]}>({logs:[async({page},use,info)=>{
  const logs:string[]=[];page.on('pageerror',e=>logs.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('favicon.ico'))logs.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))logs.push(`${r.status()} ${r.url()}`);});
  await use(logs);
  const evidence={test:info.title,status:info.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors:logs,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url())};
  writeFileSync(join(artifacts,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify(evidence,null,2));
  await info.attach('transfer-resilience-evidence',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
  if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
  expect(logs,'No unhandled errors or failed application resources').toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720}});
test.setTimeout(60000);
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.transfer()?.getState());
async function rootAction(page:Page,name:string){await page.locator(`[data-action="${name}"]`).first().click();}
async function action(page:Page,name:string){await page.locator(`[data-transfer-action="${name}"]`).first().click();}
async function boot(page:Page){await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});}
async function start(page:Page){await boot(page);await rootAction(page,'missions');await rootAction(page,'mission-transfer');await page.locator('[data-action="plan"]').last().click();await ready(page);}
async function ready(page:Page){await page.waitForFunction(()=>{const t=(window as any).__game.transfer()?.getState();return t&&!t.pending;},null,{timeout:30000});}
async function launch(page:Page){await action(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.transfer()?.runtime));}
async function pause(page:Page){if((await state(page)).playing)await action(page,'play');await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return !t.playing&&!t.busy;});await page.waitForTimeout(100);}
async function play(page:Page){if(!(await state(page)).playing)await action(page,'play');}
async function saveTools(page:Page){const tools=page.locator('.transfer-save-tools');if(await tools.getAttribute('open')===null)await tools.locator('summary').click();}
async function downloadJSON(page:Page,root=false){const pending=page.waitForEvent('download');if(root)await rootAction(page,'export');else {await saveTools(page);await action(page,'export');}const download=await pending;expect(await download.failure()).toBeNull();const path=await download.path();expect(path).toBeTruthy();return JSON.parse(readFileSync(path!,'utf8'));}
async function savedJSON(page:Page){return page.evaluate(async()=>{
  return await new Promise<any>((resolve,reject)=>{const request=indexedDB.open('orbital-foundry-journey',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('saves')){db.close();resolve(null);return;}const tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get('autosave');get.onerror=()=>{db.close();reject(get.error);};get.onsuccess=()=>{db.close();resolve(get.result?JSON.parse(get.result):null);};};});
});}

test('M03 autosave survives reload and the direct campus continue restores its real checkpoint',async({page})=>{
  await start(page);await launch(page);await action(page,'speed-600');await play(page);
  await expect.poll(async()=>(await state(page)).runtime.time).toBeGreaterThan(1200);await pause(page);const checkpoint=(await state(page)).runtime;
  // No manual save: wait for the real five-second autosave, then reload campus.
  await expect.poll(async()=>(await savedJSON(page))?.runtime?.time,{timeout:10000}).toBe(checkpoint.time);
  const saved=await savedJSON(page);expect(saved.format).toBe('orbital-foundry-journey');for(const [key,value] of Object.entries(saved.runtime))expect(value,`saved runtime.${key}`).toEqual(checkpoint[key]);
  await page.reload();await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
  await expect(page.locator('[data-action="load-transfer"]')).toBeVisible();await rootAction(page,'load-transfer');
  await page.waitForFunction(()=>Boolean((window as any).__game.transfer()?.runtime),null,{timeout:30000});const restored=await state(page);
  expect(restored.runtime).toEqual(checkpoint);expect(restored.playing).toBe(false);expect(restored.plan).toEqual(saved.plan);expect(restored.craft).toEqual(saved.craft);
  // Opening the continuation must not let a pending assembly autosave replace it.
  await page.waitForTimeout(750);expect((await savedJSON(page)).runtime.time).toBe(checkpoint.time);
  await page.screenshot({path:join(artifacts,'campus-continued-checkpoint-1280x720.png'),fullPage:true});
});

test('M03 assembly JSON preserves the edited transfer plan and round-trips back into interplanetary planning',async({page})=>{
  await start(page);await page.locator('[data-transfer-field="stage"]').selectOption('explorer');await ready(page);
  await page.locator('[data-transfer-date="departure"]').fill('2026-11-16');await page.locator('[data-transfer-date="departure"]').press('Tab');await ready(page);
  const expected=await state(page);await action(page,'edit');await expect(page.locator('#transfer-experience')).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__game.getState().transferAssembly)).toBe(true);
  await rootAction(page,'settings');const backup=await downloadJSON(page,true);
  expect(backup.format).toBe('orbital-foundry-journey');expect(backup.plan).toEqual(expected.plan);expect(backup.plan.launchStageId).toBe('explorer');expect(backup.plan.departurePeriapsisJdTdb).toBe(expected.plan.departurePeriapsisJdTdb);expect(backup.craft).toMatchObject({name:expected.craft.name,parts:expected.craft.parts,missionId:'mars',seed:expected.craft.seed});expect(backup.craft.plan.operations).toEqual([]);expect(backup.runtime).toBeUndefined();expect(backup.design).toBeUndefined();
  await page.locator('#import-file').setInputFiles({name:'m03-draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await ready(page);
  expect((await state(page)).plan).toEqual(expected.plan);expect((await state(page)).craft).toEqual(backup.craft);expect((await state(page)).runtime).toBeNull();
});

test('an invalid imported checkpoint cannot replace or strand the current M03 run',async({page})=>{
  await start(page);await launch(page);await action(page,'speed-600');await play(page);await expect.poll(async()=>(await state(page)).runtime.time).toBeGreaterThan(600);await pause(page);
  const checkpoint=(await state(page)).runtime,backup=await downloadJSON(page);backup.runtime.energyWh+=11;
  await page.locator('.transfer-import').setInputFiles({name:'tampered-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('.transfer-error')).toContainText('재현 결과');await ready(page);expect((await state(page)).runtime).toEqual(checkpoint);expect((await state(page)).playing).toBe(false);
  await play(page);await expect.poll(async()=>(await state(page)).runtime.time).toBeGreaterThan(checkpoint.time+60);await pause(page);expect((await state(page)).runtime.status).toBe('running');
  await page.screenshot({path:join(artifacts,'invalid-import-preserved-run.png'),fullPage:true});
});

test('blocked IndexedDB in both UI and Worker permits JSON download while real M03 time continues',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw new DOMException('QA storage blocked','SecurityError');}}}));
  await start(page);const worker=page.workers().find(w=>/transfer\.worker/.test(w.url()));expect(worker).toBeTruthy();
  await worker!.evaluate(()=>Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){throw new DOMException('QA Worker storage blocked','SecurityError');}}}));
  await launch(page);await action(page,'speed-600');await play(page);await saveTools(page);await action(page,'save');
  await expect(page.locator('.transfer-save-tools')).toContainText('JSON 백업');const before=(await state(page)).runtime.time;
  await expect.poll(async()=>(await state(page)).runtime.time).toBeGreaterThan(before+60);expect((await state(page)).playing).toBe(true);
  const beforeExport=(await state(page)).runtime.time,backup=await downloadJSON(page),afterExport=await state(page);
  expect(backup.format).toBe('orbital-foundry-journey');expect(backup.craft).toEqual(afterExport.runtime.craft);expect(backup.plan).toEqual(afterExport.runtime.solution.plan);expect(backup.runtime.time).toBeGreaterThanOrEqual(beforeExport);expect(backup.runtime.time).toBeLessThanOrEqual(afterExport.runtime.time);expect(afterExport.playing).toBe(true);
  await expect.poll(async()=>(await state(page)).runtime.time).toBeGreaterThan(afterExport.runtime.time+60);await pause(page);
});

test('M03 WebGL loss pauses the actual run and restoration rebuilds the environment before time resumes',async({page})=>{
  await start(page);await launch(page);await action(page,'view-earth');await action(page,'speed-600');await play(page);await expect.poll(async()=>(await state(page)).runtime.time).toBeGreaterThan(300);
  const oldEnvironment=await page.evaluate(()=>(window as any).__game.transfer().scene.scene.environment.uuid);
  await page.evaluate(()=>{const s=(window as any).__game.transfer().scene,extension=s.renderer.getContext().getExtension('WEBGL_lose_context');if(!extension)throw Error('WEBGL_lose_context unavailable');(window as any).__transferContextExtension=extension;extension.loseContext();});
  await expect.poll(async()=>(await state(page)).playing).toBe(false);await pause(page);const checkpoint=(await state(page)).runtime;
  await page.waitForTimeout(350);expect((await state(page)).runtime).toEqual(checkpoint);
  await page.evaluate(()=>(window as any).__transferContextExtension.restoreContext());await page.waitForFunction(()=>{const s=(window as any).__game.transfer().scene;return !s.lost&&!s.renderer.getContext().isContextLost();});
  const render=await page.evaluate(()=>{const s=(window as any).__game.transfer().scene;s.render(0);const gl=s.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const colors=new Set<number>();for(let i=0;i<pixels.length;i+=64)colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);return {environment:s.scene.environment.uuid,calls:s.renderer.info.render.calls,colors:colors.size};});
  expect(render.environment).not.toBe(oldEnvironment);expect(render.calls).toBeGreaterThan(0);expect(render.colors).toBeGreaterThan(100);expect((await state(page)).runtime).toEqual(checkpoint);
  await play(page);await expect.poll(async()=>(await state(page)).runtime.time).toBeGreaterThan(checkpoint.time+60);await pause(page);
  await page.screenshot({path:join(artifacts,'m03-webgl-restored-1280x720.png'),fullPage:true});
});

test('English M03 planning and real milestone diagnostics contain no untranslated Korean',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('orbital-language','en'));await start(page);
  await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('.transfer-right')).toContainText('Ready to depart');
  expect(await page.locator('#transfer-experience').innerText()).not.toMatch(/[가-힣]/);
  expect(await page.locator('#transfer-universe').getAttribute('aria-label')).not.toMatch(/[가-힣]/);
  await page.screenshot({path:join(artifacts,'english-m03-planning-1280x720.png'),fullPage:true});
  await launch(page);await action(page,'next');await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return !t.playing&&!t.busy&&t.runtime.processedEventIds.includes('earth-exit');},null,{timeout:45000});
  await page.getByText('Mission log',{exact:true}).click();
  await expect(page.locator('.transfer-event')).toHaveCount(2);await expect(page.locator('.transfer-right')).toContainText('escape burn and separated');await expect(page.locator('.transfer-right')).toContainText('heliocentric cruise');
  await expect(page.locator('.transfer-reason')).toContainText('onboard schedule');
  const current=await state(page);expect(current.runtime.events.map((event:any)=>event.code)).toEqual(['ESCAPE_BURN','EARTH_EXIT']);
  // Original domain messages remain Korean: English is a presentation transform,
  // not a mutation of saved scientific state or its deterministic event log.
  expect(current.runtime.events[0].message).toMatch(/[가-힣]/);
  expect(await page.locator('#transfer-experience').innerText()).not.toMatch(/[가-힣]/);
  await page.screenshot({path:join(artifacts,'english-m03-milestone-1280x720.png'),fullPage:true});
});
