import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {installNativeDeletionAudit} from './native-gl-audit';

const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'deployment-development';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate');
const out=join(process.cwd(),'tests/browser/artifacts/deployment-flow',candidate);
mkdirSync(out,{recursive:true});
const test=base.extend<{audit:void}>({audit:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);
 const errors:string[]=[],warnings:string[]=[],workers=new Set<string>();
 page.on('worker',w=>workers.add(w.url()));
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use();
 const name=info.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
 const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);
 const graphicsFailures=warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w));
 const auditPresent=Boolean(native),contextsObserved=(native?.contexts?.length??0)>0;
 const validationFailed=errors.length>0||graphicsFailures.length>0||!auditPresent||!contextsObserved||(native?.errors?.length??0)>0;
 const status=info.status==='passed'&&validationFailed?'failed':info.status;
 const report={status,title:info.title,candidate,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors,warnings,native,auditPresent,contextsObserved,
  scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),
  workers:[...workers],
  scope:'Visible mouse/keyboard controls and authoritative browser Worker. No injected spacecraft, runtime, resource, or completion. Functional evidence; not a performance benchmark.'};
 writeFileSync(join(out,name+'.json'),JSON.stringify(report,null,2));
 if(status!==info.expectedStatus)await page.screenshot({path:join(out,name+'-failure.png')}).catch(()=>{});
 expect(errors).toEqual([]);expect(native,'Native GL audit is installed').not.toBeNull();
 expect(native?.contexts?.length??0,'Actual WebGL contexts were observed').toBeGreaterThan(0);
 expect(native?.errors??[]).toEqual([]);expect(graphicsFailures).toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});
test.setTimeout(240000);
const state=(p:Page)=>p.evaluate(()=>(window as any).__game.deployment()?.getState());
const control=(p:Page,a:string)=>p.locator(`[data-deployment-action="${a}"]`).first();
const ready=(p:Page)=>p.waitForFunction(()=>{const s=(window as any).__game.deployment()?.getState();return s&&!s.pending&&!s.busy&&!s.restoring&&!s.saving&&!s.closing;},null,{timeout:180000});
async function open(p:Page){await p.goto('/?qa');await p.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));await p.locator('[data-action="missions"]').click();await p.locator('[data-action="mission-deployment"]').click();await ready(p);}
async function exportText(p:Page){const event=p.waitForEvent('download');await control(p,'export').click();const download=await event;expect(await download.failure()).toBeNull();await ready(p);return readFileSync((await download.path())!,'utf8');}
async function restoreText(p:Page,text:string){const id=(await state(p)).requestId,event=p.waitForEvent('filechooser');await control(p,'import').click();await(await event).setFiles({name:'actual-flight.json',mimeType:'application/json',buffer:Buffer.from(text)});await p.waitForFunction(previous=>(window as any).__game.deployment()?.getState().requestId>previous,id);await ready(p);}
async function fullFlight(p:Page){
 await control(p,'launch').click();await p.waitForFunction(()=>(window as any).__game.deployment().getState().runtime?.time>2);
 // Pause must be available while the Worker is serving time-acceleration batches.
 await control(p,'play').click();await ready(p);expect((await state(p)).playing).toBe(false);
 while((await state(p)).speed!==512)await control(p,'speed').click();
 await control(p,'play').click();
 await p.waitForFunction(()=>{const s=(window as any).__game.deployment().getState();return s.runtime?.status==='complete'||(!s.playing&&!s.busy);},null,{timeout:180000});
 await ready(p);const s=await state(p);expect(s.result?.success,JSON.stringify(s.runtime?.events.slice(-5))).toBe(true);expect(s.result.receivedBits).toBe(16000000);return s;
}

test('real cable repair unfolding receipt and exact terminal replay',async({page})=>{
 await open(page);const original=await state(page);expect(original.draft.launchable).toBe(false);
 await expect(page.locator('.deployment-first-action')).toBeVisible();
 await control(page,'sweep').click();await page.waitForFunction(()=>(window as any).__game.deployment().getState().preview?.kind==='clearance-witness');
 await page.waitForTimeout(400);let s=await state(page);expect(s.scene.preview.visible).toBe(true);expect(s.runtime).toBeNull();
 await page.screenshot({path:join(out,'real-obstruction-witness.png')});
 await control(page,'clear-preview').click();await ready(page);
 // Worker completion precedes the throttled UI paint. Begin only once the
 // actual visible timeline unlocks, then require a real accepted pointer drag.
 await expect(page.locator('.deployment-time-track')).not.toHaveClass(/locked/);
 expect((await state(page)).timeline.locked).toBe(false);
 const block=page.locator('[data-deployment-block="deploy-wing"]'),blockBox=(await block.boundingBox())!;
 const centre={x:blockBox.x+blockBox.width/2,y:blockBox.y+blockBox.height/2};
 expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest<HTMLElement>('[data-deployment-block]')?.dataset.deploymentBlock,centre)).toBe('deploy-wing');
 await page.mouse.move(centre.x,centre.y);await page.mouse.down();expect((await state(page)).timeline.dragging).toBe(true);
 await page.mouse.move(centre.x+32,centre.y,{steps:8});
 expect((await block.boundingBox())!.x).toBeGreaterThan(blockBox.x);expect((await state(page)).plan).toEqual(original.plan);
 await page.keyboard.press('Escape');await page.mouse.up();expect((await state(page)).plan).toEqual(original.plan);
 // The visible repair CTA shares its action with the left part list. Repaint
 // must return focus to this right-panel control, not the hidden duplicate.
 const repairCTA=page.locator('.deployment-first-action [data-deployment-action="part:cable-guide"]');
 const beforeFocusPaint=await repairCTA.elementHandle();expect(beforeFocusPaint).not.toBeNull();
 await repairCTA.click();await expect.poll(()=>beforeFocusPaint!.evaluate(el=>el.isConnected)).toBe(false);
 await expect(repairCTA).toBeFocused();await page.waitForTimeout(400);await expect(repairCTA).toBeFocused();
 const point=await page.evaluate(()=>(window as any).__game.deployment().scene.qa.getPartScreen('cable-guide'));expect(point.visible).toBe(true);
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x,point.y-75,{steps:20});await page.waitForTimeout(400);
 s=await state(page);expect(s.scene.placementActive).toBe(true);expect(s.scene.preview.visible).toBe(true);expect(s.craft).toEqual(original.craft);
 await page.keyboard.press('Escape');await page.mouse.up();await ready(page);expect((await state(page)).craft).toEqual(original.craft);
 const again=await page.evaluate(()=>(window as any).__game.deployment().scene.qa.getPartScreen('cable-guide'));
 await page.mouse.move(again.x,again.y);await page.mouse.down();await page.mouse.move(again.x,again.y-75,{steps:20});await page.mouse.up();await ready(page);
 const repaired=await state(page);expect(repaired.draft.launchable).toBe(true);expect(repaired.craft.parts.find((p:any)=>p.id==='cable-guide').u).toBeCloseTo(.484,9);
 expect(repaired.craft.parts.find((p:any)=>p.id==='cable-guide').v).toBeGreaterThan(.65);
 await control(page,'undo').click();await ready(page);expect((await state(page)).craft).toEqual(original.craft);
 await control(page,'redo').click();await ready(page);expect((await state(page)).craft).toEqual(repaired.craft);
 await fullFlight(page);const text=await exportText(page),before=await state(page);expect(before.result.motorEnergyJ).toBeGreaterThan(0);
 const result=page.locator('.deployment-result');await expect(result).toBeVisible();
 const box=await result.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(720);
 await page.screenshot({path:join(out,'real-repaired-terminal.png')});
 await restoreText(page,text);const restored=await state(page);expect(restored.error).toBe('');expect(restored.runtime).toEqual(before.runtime);expect(restored.result).toEqual(before.result);
 writeFileSync(join(out,'repaired-terminal-save.json'),text);
});

test('fixed wing is a real distinct complete alternative',async({page})=>{
 await open(page);const folded=await state(page);await control(page,'variants').click();await control(page,'preset:fixed').click();await ready(page);
 const fixed=await state(page);expect(fixed.draft.launchable).toBe(true);expect(fixed.craft.launchPackageId).not.toBe(folded.craft.launchPackageId);expect(fixed.craft).not.toEqual(folded.craft);
 expect(fixed.craft.launchPackageId).toBe('heavy');expect(fixed.craft.parts.find((p:any)=>p.id==='wing').definition.modelId).toBe('fixed-pv135-v1');
 expect(fixed.draft.metrics.stowedDiameterM).toBeGreaterThan(folded.draft.metrics.stowedDiameterM);
 expect(fixed.draft.topology.joints.filter((j:any)=>j.partId==='wing')).toEqual([]);
 const result=await fullFlight(page);expect(result.runtime.mechanisms.wing).toMatchObject({phase:'deployed-latched',jointStates:{},driveProfileId:null,activeJointId:null,motion:null,motorEnergyJ:0,mechanicalLatch:true,powerContactClosed:true});
 expect(Object.keys(result.runtime.mechanisms.wing.jointStates)).toHaveLength(0);expect(result.result.mechanisms.every((m:any)=>m.mechanicalLatch)).toBe(true);
 await page.screenshot({path:join(out,'fixed-wing-terminal.png')});writeFileSync(join(out,'fixed-wing-result.json'),JSON.stringify(result.result,null,2));
});

for(const language of ['ko','en'] as const)for(const scale of ['normal','large'] as const)for(const width of [1280,1920]){
 test(`${language} ${scale} ${width} repair layout and visible controls`,async({page})=>{
  await page.setViewportSize({width,height:width===1280?720:1080});await page.addInitScript(lang=>localStorage.setItem('orbital-language',lang),language);
  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));await page.locator('[data-action="settings"]').click();await page.locator('#ui-scale').selectOption(scale);if(scale==='large')await page.locator('#motion').selectOption('reduced');await page.locator('[data-action="close-modal"]').click();
  await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-deployment"]').click();await ready(page);
  const checks=await page.locator('.deployment-first-action,.deployment-first-action button,.deployment-header button,[data-deployment-action="sweep"]').evaluateAll(es=>es.map(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,hit:hit===el||el.contains(hit)};}));
  for(const c of checks){expect(c.left).toBeGreaterThanOrEqual(0);expect(c.right).toBeLessThanOrEqual(width);expect(c.top).toBeGreaterThanOrEqual(0);expect(c.bottom).toBeLessThanOrEqual(width===1280?720:1080);expect(c.hit).toBe(true);}
  const before=(await state(page)).plan,block=page.locator('[data-deployment-block="deploy-wing"]');await block.focus();await page.keyboard.press('ArrowRight');await ready(page);
  expect((await state(page)).plan.actions.find((a:any)=>a.id==='deploy-wing').earliestSeconds).toBe(before.actions.find((a:any)=>a.id==='deploy-wing').earliestSeconds+5);
  await control(page,'undo').click();await ready(page);expect((await state(page)).plan).toEqual(before);
  await page.screenshot({path:join(out,`${language}-${scale}-${width}-workshop.png`)});
 });
}
