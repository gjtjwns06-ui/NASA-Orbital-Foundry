import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {installNativeDeletionAudit} from './native-gl-audit';
// Bundle the exact local domain only to compute pointer target coordinates.
// This avoids Node's JSON-import-attribute restriction; no app state is injected.
const fixtureModule={exports:{} as any};
new Function('module','exports','require',buildSync({entryPoints:['src/swingby/index.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text)(fixtureModule,fixtureModule.exports,createRequire(import.meta.url));
const {createSwingbyPlan,getSwingbyScenario,createSwingbyDesign,makeSwingbySave,solveSwingbyPlan}=fixtureModule.exports;

// Actual visible controls and read-only state/projection. No runtime injection,
// direct Worker posts, fake mission outcomes or finishFast calls.
const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'development';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate');
const artifacts=join(process.cwd(),'tests/browser/artifacts/swingby',candidate);mkdirSync(artifacts,{recursive:true});
const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);
 const errors:string[]=[],warnings:string[]=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use(errors);const report={test:info.title,status:info.status,browser:page.context().browser()?.version(),viewport:page.viewportSize(),url:page.url(),errors,warnings,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url()),scope:'Actual pointer aim/timeline and visible flight/save/restore controls. No injected flight outcome. Development source unless frozen candidate is explicitly stated.'};
 writeFileSync(join(artifacts,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify(report,null,2));
 await info.attach('actual-swingby-ui',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
 const nativeAudit=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);writeFileSync(join(artifacts,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'-native-gl.json'),JSON.stringify(nativeAudit,null,2));
 expect(errors,'No browser errors or missing assets').toEqual([]);expect(warnings.filter(w=>/INVALID_OPERATION|does not belong to this context/.test(w))).toEqual([]);expect(nativeAudit?.errors??[],'Native GPU resource ownership').toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});test.setTimeout(360000);
const state=(p:Page)=>p.evaluate(()=>(window as any).__game.swingby()?.getState());
const action=(p:Page,name:string)=>p.locator(`[data-swingby-action="${name}"]`).first().click();
async function ready(p:Page){await p.waitForFunction(()=>{const e=(window as any).__game.swingby(),s=e?.getState();return s&&!s.pending&&!s.busy&&!e.dirty;},null,{timeout:120000});}
async function start(p:Page){
 await p.goto('/?qa');await p.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));await p.locator('[data-action="missions"]').click();await p.locator('[data-action="mission-swingby"]').click();
 await expect(p.locator('.swingby-experience')).toBeVisible();await ready(p);return state(p);
}
async function dragAim(p:Page,target:{xKm:number;yKm:number},cancel=false){
 await action(p,'view-aim');
 const coordinates=await p.evaluate(({target,plane})=>{
  const e=(window as any).__game.swingby(),scene=e.scene,current=e.getState().plan.aim,start=scene.getAimScreen();
  const world=scene.objective.getAimWorldPosition().clone(),dx=target.xKm-current.xKm,dy=target.yKm-current.yKm;
  const delta=plane.xAxis.map((n:number,i:number)=>n*dx+plane.yAxis[i]*dy);world.add(world.clone().set(delta[0],delta[2],-delta[1]).multiplyScalar(3/3389.5));world.project(scene.camera);
  const rect=scene.canvas.getBoundingClientRect();return {start,end:{x:rect.x+(world.x+1)*rect.width/2,y:rect.y+(1-world.y)*rect.height/2}};
 },{target,plane:getSwingbyScenario().aimPlane});
 expect(coordinates.start?.visible).toBe(true);expect(coordinates.end.x).toBeGreaterThan(0);expect(coordinates.end.x).toBeLessThan(1280);expect(coordinates.end.y).toBeGreaterThan(0);expect(coordinates.end.y).toBeLessThan(720);
 await p.mouse.move(coordinates.start.x,coordinates.start.y);await p.mouse.down();await p.mouse.move(coordinates.end.x,coordinates.end.y,{steps:24});if(cancel)await p.keyboard.press('Escape');await p.mouse.up();await ready(p);
}
async function pause(p:Page){if((await state(p)).playing)await action(p,'play');await ready(p);expect((await state(p)).playing).toBe(false);}
async function download(p:Page){const event=p.waitForEvent('download');await action(p,'export');const file=await event;expect(await file.failure()).toBeNull();return JSON.parse(readFileSync((await file.path())!,'utf8'));}
async function upload(p:Page,save:unknown){const before=(await state(p)).requestId,event=p.waitForEvent('filechooser');await action(p,'import');await(await event).setFiles({name:'swingby.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await p.waitForFunction(id=>{const s=(window as any).__game.swingby()?.getState();return s&&s.requestId>id&&!s.pending&&!s.busy;},before,{timeout:120000});}

test('pointer aim and actual correction deliver science and replay the terminal encounter',async({page})=>{
 const initial=await start(page);expect(initial.runtime).toBeNull();expect(initial.solution.exit.directionPassed).toBe(false);
 const goal=createSwingbyPlan('baseline').aim;await dragAim(page,goal,true);expect((await state(page)).plan).toEqual(initial.plan);
 await dragAim(page,goal);const planned=await state(page);expect(planned.solution.exit.directionPassed).toBe(true);expect(planned.solution.exit.energyPassed).toBe(true);expect(planned.evaluation.launchable).toBe(true);expect(planned.solution.predictedFuelUsedKg).toBeGreaterThan(0);expect(planned.runtime).toBeNull();
 await page.screenshot({path:join(artifacts,'actual-pointer-goal-preview.png')});
 await action(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.swingby()?.getState().runtime));await pause(page);
 const before=(await state(page)).runtime;expect(before.burn).toBeNull();expect(before.fuelKg).toBe(getSwingbyScenario().initialFuelKg);
 for(let n=0;n<8&&!(await state(page)).runtime.burn;n++){await action(page,'next');await ready(page);}
 const burned=(await state(page)).runtime;expect(burned.burn.status).toBe('fired');expect(burned.burn.time).toBe(3600);expect(burned.fuelKg).toBeLessThan(before.fuelKg);expect(burned.achievedExit).toBeNull();
 const postBurn=await download(page);await upload(page,postBurn);expect((await state(page)).runtime).toEqual(burned);
 await action(page,'speed');await action(page,'play');await page.waitForFunction(()=>{const s=(window as any).__game.swingby()?.getState();return s?.runtime?.status!=='running'&&!!s?.result;},null,{timeout:240000});await ready(page);
 const end=await state(page);expect(end.result.status).toBe('success');expect(end.result.received).toBeGreaterThanOrEqual(3);expect(end.runtime.achievedExit.directionPassed).toBe(true);expect(end.runtime.achievedExit.energyPassed).toBe(true);expect(end.runtime.tick).toBeGreaterThan(0);
 await expect(page.locator('[data-swingby-action="retry"]')).toBeVisible();await page.screenshot({path:join(artifacts,'actual-encounter-result.png')});
 const terminal=await download(page);writeFileSync(join(artifacts,'actual-terminal-save.json'),JSON.stringify(terminal,null,2));await upload(page,terminal);expect((await state(page)).runtime).toEqual(end.runtime);expect((await state(page)).result).toEqual(end.result);
 writeFileSync(join(artifacts,'actual-pointer-flight.json'),JSON.stringify({initialPlan:initial.plan,editedPlan:planned.plan,plannedCorrection:planned.solution.correction,burn:burned.burn,result:end.result,checkpointReplayed:true},null,2));
 await action(page,'exit');await expect(page.locator('.swingby-experience')).toHaveCount(0);
});

test('timeline pointer and keyboard edits remain reversible and invalid import preserves the flight',async({page})=>{
 await start(page);await dragAim(page,createSwingbyPlan('economy').aim);const original=await state(page);
 const block=page.locator('[data-swingby-operation="encounter-science"]'),edge=block.locator('[data-resize]');const b=await edge.boundingBox(),track=await page.locator('.swingby-track').boundingBox();expect(b).toBeTruthy();expect(track).toBeTruthy();
 await page.mouse.move(b!.x+b!.width/2,b!.y+b!.height/2);await page.mouse.down();await page.mouse.move(b!.x+b!.width/2+track!.width/48,b!.y+b!.height/2,{steps:12});await page.keyboard.press('Escape');await page.mouse.up();expect((await state(page)).plan).toEqual(original.plan);
 await block.focus();await page.keyboard.press('ArrowLeft');await ready(page);expect((await state(page)).plan.operations.find((o:any)=>o.id==='encounter-science').start).toBe(original.plan.operations.find((o:any)=>o.id==='encounter-science').start-60);
 await expect(page.locator('[data-swingby-operation="encounter-science"]')).toBeFocused();await action(page,'undo');await ready(page);expect((await state(page)).plan).toEqual(original.plan);
 await action(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.swingby()?.getState().runtime));await pause(page);const before=(await state(page)).runtime,backup=await download(page);const forged=structuredClone(backup);forged.checkpoint.energyWh+=1;
 await upload(page,forged);expect((await state(page)).runtime).toEqual(before);expect((await state(page)).error).toBeTruthy();await upload(page,backup);expect((await state(page)).runtime).toEqual(before);
 await action(page,'next');await ready(page);expect((await state(page)).runtime.time).toBeGreaterThan(before.time);
 await action(page,'exit');await expect(page.locator('.swingby-experience')).toHaveCount(0);
});

test('explicit backup survives a real graphics pause and older autosave cannot unlock exit',async({page})=>{
 // Delay delivery, never the contents, of real Worker snapshots and real IDB
 // completion events. This makes the save/control ordering race deterministic.
 await page.addInitScript(()=>{
  const worker=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage')!,handlers=new WeakMap<Worker,((e:MessageEvent)=>void)|null>();
  Object.defineProperty(Worker.prototype,'onmessage',{configurable:true,get(){return handlers.get(this)??null;},set(fn){handlers.set(this,fn);worker.set!.call(this,(event:MessageEvent)=>{if(event.data?.type==='save-snapshot')setTimeout(()=>fn?.call(this,event),250);else fn?.call(this,event);});}});
  const transaction=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete')!;
  const callbacks=new WeakMap<IDBTransaction,((e:Event)=>void)|null>();
  (window as any).__saveTiming={completionQueued:0,completionDelivered:0};
  Object.defineProperty(IDBTransaction.prototype,'oncomplete',{configurable:true,get(){return callbacks.get(this)??null;},set(fn){callbacks.set(this,fn);transaction.set!.call(this,(event:Event)=>{if(this.db.name==='orbital-foundry-swingby'){(window as any).__saveTiming.completionQueued++;setTimeout(()=>{(window as any).__saveTiming.completionDelivered++;fn?.call(this,event);},800);}else fn?.call(this,event);});}});
 });
 await start(page);await action(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.swingby()?.getState().runtime));await pause(page);
 const before=await state(page),event=page.waitForEvent('download');await action(page,'export');
 await page.evaluate(()=>{const e=(window as any).__game.swingby(),ext=e.scene.renderer.getContext().getExtension('WEBGL_lose_context');if(!ext)throw Error('Native context loss unavailable');ext.loseContext();setTimeout(()=>ext.restoreContext(),350);});
 const file=await event;expect(await file.failure()).toBeNull();const data=JSON.parse(readFileSync((await file.path())!,'utf8'));expect(data.plan).toEqual(before.plan);expect(data.format).toBe('orbital-foundry-swingby');
 await page.waitForFunction(()=>!(window as any).__game.swingby().scene.getRenderSettings().lost);await ready(page);
 expect((await state(page)).runtime).toEqual(before.runtime);expect((await state(page)).plan).toEqual(before.plan);
 await action(page,'exit');await expect(page.locator('.swingby-experience')).toHaveCount(0,{timeout:15000});
 await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-swingby"]').click();await ready(page);
 // A new accepted draft triggers a real automatic write. Start Exit while its
 // completion callback is still delayed, then inspect the closure barrier.
 await dragAim(page,createSwingbyPlan('economy').aim);
 const delivered=await page.evaluate(()=>(window as any).__saveTiming.completionDelivered);
 await page.waitForFunction(n=>(window as any).__saveTiming.completionQueued>n,delivered);
 await action(page,'exit');
 await page.waitForFunction(n=>(window as any).__saveTiming.completionDelivered>n,delivered);
 const during=await page.evaluate(()=>{const e=(window as any).__game.swingby();return e?{closing:e.closing,pendingSaves:e.saveIntents.size}:null;});
 if(during)expect(during.closing).toBe(true);
 await expect(page.locator('.swingby-experience')).toHaveCount(0,{timeout:15000});
});

test('unreachable draft survives exit and blocked storage offers an explicit escape with JSON backup',async({page})=>{
 await start(page);const plan={...createSwingbyPlan(),aim:{xKm:4000,yKm:0}},craft=createSwingbyDesign();expect(solveSwingbyPlan(plan,craft).status).toBe('infeasible');
 await upload(page,makeSwingbySave(plan,craft));expect((await state(page)).solution).toBeNull();expect((await state(page)).evaluation).toBeNull();await expect(page.locator('.swingby-issues p')).not.toHaveCount(0);
 await expect(page.locator('[data-swingby-action="launch"]')).toBeDisabled();
 await action(page,'exit');await expect(page.locator('.swingby-experience')).toHaveCount(0);
 await page.locator('[data-action="load-swingby"]').click();await ready(page);
 expect((await state(page)).plan).toEqual(plan);expect((await state(page)).solution).toBeNull();await expect(page.locator('[data-swingby-action="launch"]')).toBeDisabled();
 // Exercise a real IndexedDB transaction failure. The existing slot remains
 // untouched, and a coherent engine JSON snapshot remains downloadable.
 await page.evaluate(()=>{const transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args:any[]){if(this.name==='orbital-foundry-swingby'&&args[1]==='readwrite')throw new DOMException('QA quota boundary','QuotaExceededError');return (transaction as any).apply(this,args);};});
 await action(page,'exit');await expect(page.locator('[data-swingby-action="leave-unsaved"]')).toBeVisible();await expect(page.locator('.swingby-experience')).toBeVisible();
 const backup=await download(page);expect(backup.plan).toEqual(plan);expect(backup.checkpoint).toBeUndefined();
 await action(page,'leave-unsaved');await expect(page.locator('.swingby-experience')).toHaveCount(0);
});

for(const language of ['ko','en'] as const)for(const scale of ['normal','large'] as const){
 test(`${language} ${scale} controls and actual 3D stay accessible at 1280x720`,async({page})=>{
  await page.addInitScript(lang=>localStorage.setItem('orbital-language',lang),language);
  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
  await page.locator('[data-action="settings"]').click();await page.locator('#quality').selectOption('medium');await page.locator('#ui-scale').selectOption(scale);await page.locator('#motion').selectOption('reduced');await page.locator('[data-action="close-modal"]').click();
  await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-swingby"]').click();await ready(page);await page.evaluate(()=>document.fonts.ready);
  const checkText=async()=>{const text=await page.locator('.swingby-experience').innerText();expect(text).not.toMatch(/\uFFFD|\bNaN\b|\bundefined\b/);if(language==='en')expect(text).not.toMatch(/[가-힣]/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);};
  const checkVisible=async(name:string)=>{const control=page.locator(`[data-swingby-action="${name}"]`).first();const hit=await control.evaluate(el=>{const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);let clipped=false;for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p===document.body||p===document.documentElement?{top:0,bottom:innerHeight}:p.getBoundingClientRect();if(/auto|hidden|scroll/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))clipped=true;}return {hit:h===el||el.contains(h),clipped,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});expect(hit.hit,name).toBe(true);expect(hit.clipped,name).toBe(false);expect(hit.left).toBeGreaterThanOrEqual(0);expect(hit.right).toBeLessThanOrEqual(1280);expect(hit.top).toBeGreaterThanOrEqual(0);expect(hit.bottom).toBeLessThanOrEqual(720);};
  await checkText();await checkVisible('launch');await checkVisible('view-aim');await checkVisible('inspect');await page.screenshot({path:join(artifacts,`${language}-${scale}-entry.png`)});
  await action(page,'view-aim');const initial=await state(page);await dragAim(page,createSwingbyPlan('economy').aim);expect((await state(page)).plan).not.toEqual(initial.plan);
  await action(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.swingby()?.getState().runtime));await pause(page);await checkText();await checkVisible('play');await checkVisible('next');
  const before=(await state(page)).runtime;expect((await state(page)).inspection.enabled).toBe(true);await expect(page.locator('.swingby-experience')).toHaveClass(/timeline-collapsed/);await action(page,'timeline-toggle');await expect(page.locator('.swingby-experience')).not.toHaveClass(/timeline-collapsed/);await action(page,'timeline-toggle');await expect(page.locator('.swingby-experience')).toHaveClass(/timeline-collapsed/);
  await page.mouse.move(730,320);await page.mouse.down({button:'right'});await page.mouse.move(780,340,{steps:15});await page.mouse.up({button:'right'});await page.mouse.wheel(0,-100);await page.waitForTimeout(150);
  expect((await state(page)).runtime).toEqual(before);await page.screenshot({path:join(artifacts,`${language}-${scale}-actual-craft.png`)});
  await action(page,'exit');await expect(page.locator('.swingby-experience')).toHaveCount(0);
 });
}
