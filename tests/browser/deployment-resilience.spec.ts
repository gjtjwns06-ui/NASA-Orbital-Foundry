import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {installNativeDeletionAudit} from './native-gl-audit';

// Run against the corrected deployment candidate, not this keyboard worktree's
// product. All sources/checkpoints below originate from actual browser controls.
// Faults delay genuine messages or deny storage writes; they never forge a
// successful replay, geometry, resource value, or physical flight outcome.
const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'deployment-unfrozen';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid QA candidate');
const artifacts=join(process.cwd(),'tests/browser/artifacts/deployment-resilience',candidate);
mkdirSync(artifacts,{recursive:true});
const test=base.extend<{audit:void}>({audit:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);
 const errors:string[]=[],warnings:string[]=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use();
 const name=info.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
 const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);
 const report={title:info.title,status:info.status,candidate,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors,warnings,native,
  scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url()),
  scope:'Actual UI and computed flight prefixes. Genuine response delay / IDB-only denial. No injected runtime, Worker request, or successful replay.'};
 writeFileSync(join(artifacts,`${name}.json`),JSON.stringify(report,null,2));
 await info.attach('deployment-resilience',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 if(info.status!==info.expectedStatus)await page.screenshot({path:join(artifacts,`${name}-failure.png`),fullPage:true}).catch(()=>{});
 expect(errors,'No application/asset errors').toEqual([]);
 expect(warnings.filter(w=>/INVALID_OPERATION|does not belong to this context/.test(w)),'No native ownership warnings').toEqual([]);
 expect(native,'Native GL audit is installed').not.toBeNull();
 expect(native?.contexts?.length??0,'Actual WebGL contexts were observed').toBeGreaterThan(0);
 expect(native?.errors??[],'Native GL owner audit').toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});
test.setTimeout(180000);

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.deployment()?.getState());
const button=(page:Page,action:string)=>page.locator(`[data-deployment-action="${action}"]`).first();
const click=(page:Page,action:string)=>button(page,action).click();
async function ready(page:Page){
 await page.waitForFunction(()=>{const s=(window as any).__game.deployment()?.getState();return s&&!s.pending&&!s.busy&&!s.restoring&&!s.saving&&!s.closing;},null,{timeout:120000});
}
async function start(page:Page){
 await page.goto('/?qa');
 await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
 await page.locator('[data-action="missions"]').click();
 await page.locator('[data-action="mission-deployment"]').click();
 await expect(page.locator('.deployment-experience')).toBeVisible();await ready(page);
 await click(page,'variants');
 await click(page,'preset:compact');await ready(page);
 const s=await state(page);expect(s.draft.launchable).toBe(true);expect(s.runtime).toBeNull();return s;
}
async function pause(page:Page){
 if((await state(page)).playing)await click(page,'play');
 await ready(page);expect((await state(page)).playing).toBe(false);
}
async function prefix(page:Page){
 await click(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.deployment()?.getState().runtime));
 await pause(page);const before=(await state(page)).runtime.time;
 await click(page,'step');await ready(page);
 const s=await state(page);expect(s.runtime.time).toBeGreaterThan(before);expect(s.runtime.tick).toBeGreaterThan(0);
 const wing=s.runtime.mechanisms.wing;expect(wing.phase).toBe('moving');expect(wing.mechanicalLatch).toBe(false);expect(Object.values(wing.jointStates).some((j:any)=>Math.abs(j.rateRadS)>0)).toBe(true);return s;
}
async function exportText(page:Page){
 const event=page.waitForEvent('download');await click(page,'export');const file=await event;
 expect(await file.failure()).toBeNull();await ready(page);
 return readFileSync((await file.path())!,'utf8');
}
async function importText(page:Page,text:string){
 const previous=(await state(page)).requestId,event=page.waitForEvent('filechooser');
 await click(page,'import');await(await event).setFiles({name:'first-light.json',mimeType:'application/json',buffer:Buffer.from(text)});
 await page.waitForFunction(id=>{const s=(window as any).__game.deployment()?.getState();return s&&s.requestId>id&&!s.restoring&&!s.pending&&!s.busy;},previous,{timeout:120000});
}
async function slot(page:Page){
 return page.evaluate(()=>new Promise<{revision:number;text:string}|null>((resolve,reject)=>{
  const open=indexedDB.open('orbital-foundry-deployment',1);
  open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{const db=open.result;if(!db.objectStoreNames.contains('saves')){db.close();resolve(null);return;}
   const tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get('current');let value:any=null;
   get.onsuccess=()=>{value=get.result??null;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error);};};
 }));
}
async function save(page:Page){await click(page,'save');await ready(page);const s=await state(page);expect(s.error).toBe('');return slot(page);}

test('genuine save response survives a real context-loss pause and commits once',async({page})=>{
 await page.addInitScript(()=>{
  const descriptor=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage')!,handlers=new WeakMap<Worker,any>();
  const audit={armed:false,held:false,delivered:0,saveId:null as number|null,release:null as null|(()=>void)};
  (window as any).__deploymentSaveDelay=audit;
  Object.defineProperty(Worker.prototype,'onmessage',{configurable:true,get(){return handlers.get(this)??null;},set(fn){
   handlers.set(this,fn);descriptor.set!.call(this,(event:MessageEvent)=>{
    if(audit.armed&&event.data?.type==='save-snapshot'){
     audit.armed=false;audit.held=true;audit.saveId=event.data.saveId;
     audit.release=()=>{if(!audit.held)return;audit.held=false;audit.delivered++;fn?.call(this,event);};
    }else fn?.call(this,event);
   });
  }});
 });
 await start(page);await prefix(page);await save(page);
 const before=await state(page),storedBefore=await slot(page);expect(storedBefore).toBeTruthy();
 await page.evaluate(()=>{(window as any).__deploymentSaveDelay.armed=true;});await click(page,'save');
 await page.waitForFunction(()=>(window as any).__deploymentSaveDelay.held);
 const captured=await state(page);expect(captured.saving).toBe(true);
 await page.evaluate(()=>{const scene=(window as any).__game.deployment().scene,ext=scene.renderer.getContext().getExtension('WEBGL_lose_context');if(!ext)throw Error('Native context-loss extension missing');(window as any).__deploymentLossExtension=ext;ext.loseContext();});
 await page.waitForFunction(()=>{const s=(window as any).__game.deployment().getState();return s.scene.contextLost&&!s.busy;});
 expect((await state(page)).controlEpoch).toBeGreaterThan(captured.controlEpoch);
 await page.evaluate(()=>{(window as any).__deploymentLossExtension.restoreContext();});
 await page.waitForFunction(()=>!(window as any).__game.deployment().getState().scene.contextLost);
 await page.evaluate(()=>{(window as any).__deploymentSaveDelay.release();});await ready(page);
 const after=await state(page),storedAfter=await slot(page);
 expect(after.runtime).toEqual(before.runtime);expect(after.plan).toEqual(before.plan);expect(after.error).toBe('');
 expect(storedAfter!.revision).toBe(storedBefore!.revision+1);
 expect(JSON.parse(storedAfter!.text).checkpoint).toEqual(JSON.parse(storedBefore!.text).checkpoint);
 expect(await page.evaluate(()=>(window as any).__deploymentSaveDelay.delivered)).toBe(1);
 await expect(button(page,'save')).toBeEnabled();await expect(button(page,'exit')).toBeEnabled();
 await page.screenshot({path:join(artifacts,'save-context-restored.png')});
 await click(page,'exit');await expect(page.locator('.deployment-experience')).toHaveCount(0);
});

test('strict draft import clears an earlier actual flight and input-specific evidence',async({page})=>{
 await start(page);const draftText=await exportText(page),draft=JSON.parse(draftText);expect(draft.checkpoint).toBeUndefined();
 await click(page,'forecast');
 await page.waitForFunction(()=>{const s=(window as any).__game.deployment()?.getState();return s?.forecast&&!s.forecasting;},null,{timeout:120000});
 await click(page,'sweep');await page.waitForFunction(()=>Boolean((window as any).__game.deployment()?.getState().preview));
 const flight=await prefix(page);expect(flight.runtime.time).toBeGreaterThan(0);expect(flight.history.length).toBeGreaterThan(0);
 await importText(page,draftText);const restored=await state(page);
 expect(restored.runtime).toBeNull();expect(restored.telemetry).toBeNull();expect(restored.result).toBeNull();
 expect(restored.craft).toEqual(draft.craft);expect(restored.plan).toEqual(draft.plan);expect(restored.numerics).toEqual(draft.numerics);
 expect(restored.history).toEqual([]);expect(restored.forecast).toBeNull();expect(restored.forecasting).toBe(false);
 expect(restored.preview).toBeNull();expect(restored.previewAngles).toEqual({});expect(restored.previewLabel).toBe('');
 expect(restored.scene.timeSeconds).toBeNull();expect(restored.scene.mode).toBe('workshop');
 await expect(button(page,'launch')).toBeEnabled();await expect(button(page,'forecast')).toBeEnabled();
 await page.screenshot({path:join(artifacts,'draft-import-clean-workshop.png')});
 await click(page,'exit');await expect(page.locator('.deployment-experience')).toHaveCount(0);
});

test('forged checkpoint replay preserves the exact previous committed flight',async({page})=>{
 await start(page);await prefix(page);const source=await exportText(page),before=await state(page);
 const forged=JSON.parse(source);expect(forged.checkpoint.time).toBeGreaterThan(0);forged.checkpoint.energyWh+=1;
 await importText(page,JSON.stringify(forged));const rejected=await state(page);
 expect(rejected.error).not.toBe('');expect(rejected.runtime).toEqual(before.runtime);
 expect(rejected.craft).toEqual(before.craft);expect(rejected.plan).toEqual(before.plan);expect(rejected.numerics).toEqual(before.numerics);
 expect(rejected.scene.sourceId).toBe(before.scene.sourceId);expect(rejected.scene.timeSeconds).toBe(before.runtime.time);
 await expect(button(page,'play')).toBeEnabled();
 const checkpoint=JSON.parse(await exportText(page)).checkpoint;expect(checkpoint).toEqual(JSON.parse(source).checkpoint);
 await importText(page,source);expect((await state(page)).runtime).toEqual(before.runtime);
 await click(page,'step');await ready(page);expect((await state(page)).runtime.time).toBeGreaterThan(before.runtime.time);
 await page.screenshot({path:join(artifacts,'forged-import-retained-flight.png')});
 await click(page,'exit');await expect(page.locator('.deployment-experience')).toHaveCount(0);
});

test('denied IDB write retains previous slot and allows JSON and explicit unsaved exit',async({page})=>{
 await page.addInitScript(()=>{
  const put=IDBObjectStore.prototype.put;(window as any).__denyDeploymentWrite=false;
  IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){
   if((window as any).__denyDeploymentWrite&&this.transaction.db.name==='orbital-foundry-deployment')throw new DOMException('QA denied write','QuotaExceededError');
   return put.apply(this,args);
  };
 });
 await start(page);const old=await save(page);expect(old).toBeTruthy();
 const before=await state(page),block=page.locator('[data-deployment-block="deploy-wing"]');
 await block.focus();await page.keyboard.press('ArrowRight');await ready(page);
 const changed=await state(page);expect(changed.plan).not.toEqual(before.plan);expect(changed.runtime).toBeNull();
 await page.evaluate(()=>{(window as any).__denyDeploymentWrite=true;});
 await click(page,'save');await ready(page);expect((await state(page)).error).not.toBe('');expect(await slot(page)).toEqual(old);
 const exported=JSON.parse(await exportText(page));expect(exported.plan).toEqual(changed.plan);expect(exported.craft).toEqual(changed.craft);expect(exported.checkpoint).toBeUndefined();
 await click(page,'exit');await ready(page);await expect(button(page,'leave-unsaved')).toBeVisible();
 expect(await slot(page)).toEqual(old);await page.screenshot({path:join(artifacts,'storage-denied-explicit-exit.png')});
 await click(page,'leave-unsaved');await expect(page.locator('.deployment-experience')).toHaveCount(0);expect(await slot(page)).toEqual(old);
 await page.evaluate(()=>{(window as any).__denyDeploymentWrite=false;});
 await page.locator('[data-action="load-deployment"]').click();await ready(page);
 expect((await state(page)).plan).toEqual(JSON.parse(old!.text).plan);
 await click(page,'exit');await expect(page.locator('.deployment-experience')).toHaveCount(0);
});

test('unsupported Continue preserves stored bytes through raw backup autosave and Exit',async({page})=>{
 await start(page);await prefix(page);await click(page,'exit');await expect(page.locator('.deployment-experience')).toHaveCount(0);
 const genuine=await slot(page);expect(genuine).toBeTruthy();
 const unsupported=JSON.parse(genuine!.text);expect(unsupported.checkpoint.time).toBeGreaterThan(0);
 unsupported.identity.modelVersion='unsupported-future-commissioning-version';
 // Explicit corruption fixture: only model identity differs from a genuinely
 // computed browser save. This never supplies a fake accepted runtime.
 const raw=JSON.stringify(unsupported,null,2),expected={revision:genuine!.revision+1,text:raw};
 await page.evaluate(record=>new Promise<void>((resolve,reject)=>{
  const open=indexedDB.open('orbital-foundry-deployment',1);open.onerror=()=>reject(open.error);
  open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(record,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error);};};
 }),expected);
 await page.locator('[data-action="load-deployment"]').click();await ready(page);
 const recovered=await state(page);expect(recovered.error).not.toBe('');expect(recovered.runtime).toBeNull();expect(recovered.draft).toBeTruthy();
 expect(await slot(page)).toEqual(expected);
 const download=page.waitForEvent('download');await click(page,'backup-original');const backup=await download;
 expect(await backup.failure()).toBeNull();expect(readFileSync((await backup.path())!,'utf8')).toBe(raw);
 // Real wall time exceeds the product's30-second autosave interval. Advancing
 // timers artificially could skip the exact ordering this regression protects.
 await page.waitForTimeout(32000);expect(await slot(page)).toEqual(expected);
 await page.screenshot({path:join(artifacts,'unsupported-continue-protected-original.png')});
 await click(page,'exit');await expect(page.locator('.deployment-experience')).toHaveCount(0);
 expect(await slot(page)).toEqual(expected);
});


test('genuine failed flight replays its pending signal and retains failure after Earth receipt',async({page})=>{
 test.setTimeout(300000);
 await start(page);const draft=JSON.parse(await exportText(page));expect(draft.checkpoint).toBeUndefined();
 // Authored INPUTS only. The cutoff was independently derived from the domain's
 // preserved two-radio baseline; the browser must freshly emit every bit and
 // compute the fatal event. No checkpoint, runtime or Worker state is supplied.
 const finalEmission=1385,finalArrival=1385.0067053601188,cutoff=(finalEmission+finalArrival)/2;
 const radio=draft.craft.parts.find((p:any)=>p.id==='radio');expect(radio).toBeTruthy();
 draft.craft.parts.push({...structuredClone(radio),id:'standby-radio',u:.3,v:.45});
 draft.craft.parts.find((p:any)=>p.id==='recovery').face='nz';
 draft.plan.actions.push({id:'power-removing-stow',partId:'wing',desired:'stowed',earliestSeconds:cutoff,deadlineSeconds:1800,rateProfileId:'normal'});
 await importText(page,JSON.stringify(draft));const authored=await state(page);expect(authored.draft.launchable).toBe(true);expect(authored.runtime).toBeNull();
 await click(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.deployment()?.getState().runtime));await pause(page);
 expect((await state(page)).runtime.time).toBeLessThan(300);
 while((await state(page)).speed!==512)await click(page,'speed');
 await click(page,'play');
 await page.waitForFunction(()=>{const s=(window as any).__game.deployment()?.getState();return s?.runtime?.status==='failed'&&!s.playing&&!s.busy;},null,{timeout:150000});
 const fatal=await state(page);expect(fatal.result.pendingReceiverDrain).toBe(true);expect(fatal.result.success).toBe(false);
 expect(fatal.runtime.failureReason).toBe('POWER_LOSS');expect(fatal.runtime.time).toBe(cutoff);expect(fatal.runtime.fatalAtSeconds).toBe(cutoff);
 expect(fatal.runtime.diagnosticReceivedBits).toBe(15936000);expect(fatal.runtime.energyWh).toBeGreaterThan(0);
 const signal=fatal.runtime.frames.find((f:any)=>f.status==='inflight');expect(signal).toBeTruthy();expect(signal.lastEmittedAt).toBe(finalEmission);expect(signal.arrivesAt).toBe(finalArrival);expect(signal.emittedSeconds).toBe(1);
 await expect(button(page,'play')).toBeEnabled();await expect(button(page,'step')).toBeEnabled();await expect(button(page,'retry')).toBeDisabled();
 await page.screenshot({path:join(artifacts,'failed-pending-earth-signal.png')});
 const pendingSource=await exportText(page),pending=await state(page);writeFileSync(join(artifacts,'actual-failed-pending-source.json'),pendingSource);
 await importText(page,pendingSource);const replayed=await state(page);expect(replayed.runtime).toEqual(pending.runtime);expect(replayed.result).toEqual(pending.result);expect(replayed.playing).toBe(false);
 await click(page,'step');await ready(page);const received=await state(page);
 expect(received.runtime.time).toBe(finalArrival);expect(received.runtime.status).toBe('failed');expect(received.result.success).toBe(false);expect(received.result.pendingReceiverDrain).toBe(false);expect(received.runtime.failureReason).toBe('POWER_LOSS');
 expect(received.runtime.diagnosticReceivedBits).toBe(16000000);expect(received.runtime.fatalAtSeconds).toBe(cutoff);
 expect(received.runtime.energyWh).toBe(pending.runtime.energyWh);expect(received.runtime.energyMinimumWh).toBe(pending.runtime.energyMinimumWh);expect(received.runtime.motorEnergyJ).toBe(pending.runtime.motorEnergyJ);
 expect(received.runtime.nextFrameId).toBe(pending.runtime.nextFrameId);expect(received.runtime.transmittedBits).toBe(pending.runtime.transmittedBits);
 expect(received.runtime.angular.wheelMomentumBodyNms).toEqual(pending.runtime.angular.wheelMomentumBodyNms);expect(received.runtime.angular.totalInertialMomentumNms).toEqual(pending.runtime.angular.totalInertialMomentumNms);
 expect(received.runtime.events.filter((e:any)=>e.code==='RECEIVER_DRAIN_COMPLETE')).toHaveLength(1);
 await expect(button(page,'play')).toBeDisabled();await expect(button(page,'step')).toBeDisabled();await expect(button(page,'retry')).toBeEnabled();
 const finalSource=await exportText(page),final=await state(page);writeFileSync(join(artifacts,'actual-failed-drained-source.json'),finalSource);
 await importText(page,finalSource);const restored=await state(page);expect(restored.runtime).toEqual(final.runtime);expect(restored.result).toEqual(final.result);
 await page.screenshot({path:join(artifacts,'failed-after-earth-receipt.png')});
 writeFileSync(join(artifacts,'terminal-signal-observations.json'),JSON.stringify({scope:'Authored draft-only import followed by genuine browser flight, fatal pause, strict pending replay, explicit receiver continuation and strict terminal replay.',authored:{craft:draft.craft,plan:draft.plan,numerics:draft.numerics},fatalResult:fatal.result,pendingReplayExact:true,receivedResult:received.result,finalReplayExact:true,signal},null,2));
 await click(page,'exit');await expect(page.locator('.deployment-experience')).toHaveCount(0);
});
