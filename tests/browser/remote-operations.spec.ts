import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {installNativeDeletionAudit} from './native-gl-audit';

// Prepared before the runtime-3 production handoff. Execute only when root has
// announced a frozen candidate with the actual remote-operations entry enabled.
// All progression uses visible UI actions. QA access below is read-only except
// the genuine WebGL context-loss extension; no installed commands, checkpoint
// injection, direct Worker sends, or finishFast.
const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'development';
if(!/^[a-z0-9-]+$/.test(candidate))throw new Error('Invalid QA artifact candidate');
const artifacts=join(process.cwd(),'tests/browser/artifacts/remote-operations',candidate);
mkdirSync(artifacts,{recursive:true});
const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);
 const errors:string[]=[],warnings:string[]=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use(errors);
 const nativeDeletionAudit=await page.evaluate(()=>(window as any).__allContextDeletionAudit||null).catch(()=>null);
 const graphicsFailures=warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w));
 const status=info.status==='passed'&&(errors.length||graphicsFailures.length||!nativeDeletionAudit?.contexts?.length||nativeDeletionAudit?.errors?.length)?'failed':info.status;
 const report={test:info.title,status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors,warnings,nativeDeletionAudit,
  scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url()),
  scope:'Real UI, actual computed flight, pointer schedule editing, finite command/ACK history and version2 replay. No injected checkpoint/outcome or independent performance claim.'};
 writeFileSync(join(artifacts,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify(report,null,2));
 await info.attach('remote-operations-browser-evidence',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 if(status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
 expect(errors,'No unhandled errors or failed application resources').toEqual([]);
 expect(warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w)),'Native graphics ownership warnings are failures').toEqual([]);
 expect(nativeDeletionAudit).not.toBeNull();expect(nativeDeletionAudit?.contexts?.length??0).toBeGreaterThan(0);
 expect(nativeDeletionAudit?.errors??[],'Both native renderer contexts retain valid resource ownership').toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});
test.setTimeout(360000);
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.transfer()?.getState());
const action=(page:Page,name:string)=>page.locator(`[data-transfer-action="${name}"]`).first().click();
async function ready(page:Page,timeout=90000){await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return t&&!t.getState().pending&&!t.busy;},null,{timeout});}
async function pause(page:Page){if((await state(page)).playing)await action(page,'play');await ready(page);expect((await state(page)).playing).toBe(false);await expect(page.locator('[data-transfer-action="play"]')).toHaveText('계속 비행');}
async function play(page:Page){if(!(await state(page)).playing)await action(page,'play');}
async function openSaveTools(page:Page){const details=page.locator('.transfer-save-tools');if(await details.getAttribute('open')===null)await details.locator('summary').click();}
async function exportJSON(page:Page){await openSaveTools(page);const downloadPromise=page.waitForEvent('download');await action(page,'export');const download=await downloadPromise;expect(await download.failure()).toBeNull();const path=await download.path();expect(path).toBeTruthy();return JSON.parse(readFileSync(path!,'utf8'));}
async function importJSON(page:Page,backup:unknown,name:string){
 // Read-only session counter avoids accepting the already-visible old state
 // while the file reader has not started the restore transaction yet.
 const beforeId=await page.evaluate(()=>(window as any).__game.transfer().requestId);
 await page.locator('.transfer-import').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.waitForFunction(id=>{const t=(window as any).__game.transfer();return t.requestId>id&&!t.getState().pending&&!t.busy;},beforeId,{timeout:120000});
}
async function startAtDecision(page:Page){
 await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});
 await page.locator('[data-action="missions"]').click();await expect(page.locator('[data-action="mission-operations"]')).toBeVisible();await page.locator('[data-action="mission-operations"]').click();
 await expect(page.locator('#transfer-experience')).toBeVisible();await ready(page);
 const initial=await state(page);expect(initial.evaluation.launchable).toBe(true);expect(initial.preview.received).toBeLessThan(3);
 const peri=initial.solution.periapsisSeconds,observation=initial.plan.operations.find((o:any)=>o.id==='encounter-science');
 expect(observation.start).toBe(peri-3600);expect(observation.end).toBe(peri-3500);
 await action(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.transfer()?.getState().runtime));await ready(page);
 expect((await state(page)).runtime.modelVersion).toBe('transfer-3.0.0');
 await action(page,'listening-window');await page.waitForFunction(()=>{const t=(window as any).__game.transfer(),s=t.getState();return !t.busy&&!s.playing&&s.runtime.time>=s.solution.periapsisSeconds-8200;},null,{timeout:120000});
 const decision=await state(page);expect(decision.runtime.time).toBe(peri-8200);expect(decision.runtime.tick).toBeGreaterThan(0);
 expect(decision.runtime.processedEventIds).toEqual(expect.arrayContaining(['earth-exit','mars-entry']));expect(decision.runtime.operations.journal).toHaveLength(0);expect(decision.operations.ground.confirmedRevision).toBe(0);
 return {initial,decision};
}
async function openDraft(page:Page){await action(page,'operations-edit');await expect.poll(async()=>Boolean((await state(page)).operationsDraft)).toBe(true);await page.waitForFunction(()=>Boolean((window as any).__game.transfer().getState().commandPreview));await ready(page);}
async function resizeObservation(page:Page,end:number,cancel=false){
 const s=await state(page),op=s.operationsDraft.operations.find((o:any)=>o.id==='encounter-science');
 const edge=page.locator('[data-operations-op="encounter-science"] [data-operations-edge]');await edge.scrollIntoViewIfNeeded();
 const box=await edge.boundingBox(),track=await page.locator('[data-live-layer="draft"]').boundingBox();expect(box).toBeTruthy();expect(track).toBeTruthy();
 const x=box!.x+box!.width/2,y=box!.y+box!.height/2,dx=(end-op.end)*track!.width/21600;
 expect(await edge.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y,{steps:20});
 expect((await state(page)).operationsDraft.operations.find((o:any)=>o.id==='encounter-science').end).not.toBe(op.end);
 if(cancel)await page.keyboard.press('Escape');await page.mouse.up();
 await page.waitForFunction(()=>Boolean((window as any).__game.transfer().getState().commandPreview));
 const edited=(await state(page)).operationsDraft.operations.find((o:any)=>o.id==='encounter-science');
 expect(edited.start).toBe(op.start);expect(edited.end).toBe(cancel?op.end:end);
}
async function submitRepair(page:Page){
 await openDraft(page);const before=await state(page),end=before.solution.periapsisSeconds+1800;
 await resizeObservation(page,end);const edited=await state(page);expect(edited.runtime).toEqual(before.runtime);expect(edited.plan).toEqual(before.plan);
 expect(edited.commandPreview.valid).toBe(true);expect(edited.commandPreview.baseTime).toBe(edited.runtime.time);
 const submitted=structuredClone(edited.operationsDraft);await action(page,'operations-send');await page.waitForFunction(()=>{const s=(window as any).__game.transfer().getState();return !s.commandAction&&!s.operationsDraft&&s.operations.ground.commands.length>0;});
 const queued=await state(page);expect(queued.playing).toBe(false);expect(queued.runtime.time).toBe(before.runtime.time);expect(queued.operations.onboardTruth.revision).toBe(0);expect(queued.operations.ground.confirmedRevision).toBe(0);
 const command=queued.runtime.operations.commands[0];expect(command.envelope.payload).toEqual(submitted);expect(command.attempts[0].firstBit).toBeNull();expect(command.acknowledgements).toHaveLength(0);
 await expect(page.locator('.command-card.queued')).toBeVisible();await expect(page.locator('[data-transfer-action="operations-send"]')).toHaveCount(0);
 return {queued,submitted,commandId:command.id};
}
function assertLightTime(endpoint:any){const r=endpoint.receiverPositionKm.map((v:number,i:number)=>v-endpoint.emitterPositionKm[i]),range=Math.sqrt(r.reduce((sum:number,v:number)=>sum+v*v,0));expect(Math.abs(endpoint.arrivesAtSeconds-endpoint.emittedAtSeconds-range/299792.458)).toBeLessThanOrEqual(1e-6);}

test('actual pointer repair reaches the spacecraft before Earth confirmation and returns science with version2 replay',async({page})=>{
 const detailRequests:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname==='/assets/textures/mars-mdim21-4k.webp')detailRequests.push(request.url());});
 const {initial}=await startAtDecision(page);const cameraBaseline=JSON.parse(JSON.stringify((await state(page)).runtime));
 const detail=()=>page.evaluate(()=>(window as any).__game.transfer().scene.getMarsSurfaceDetailState());
 expect(await page.evaluate(()=>(window as any).__game.transfer().scene.quality)).toBe('high');expect((await detail()).requestCount).toBe(0);expect(detailRequests).toEqual([]);
 await action(page,'view-mars');expect((await detail()).active).toBe(false);expect((await detail()).activeWidth).toBe(1440);expect(detailRequests).toEqual([]);
 await action(page,'view-craft');await page.waitForFunction(()=>{const d=(window as any).__game.transfer().scene.getMarsSurfaceDetailState();return d.active&&d.activeWidth===4096;});
 const loadedDetail=await detail();expect(loadedDetail).toMatchObject({status:'ready',eligible:true,active:true,cached:true,requestCount:1,width:4096,height:2048,activeWidth:4096,activeHeight:2048,supported:true});expect(detailRequests).toHaveLength(1);expect(JSON.parse(JSON.stringify((await state(page)).runtime))).toEqual(cameraBaseline);
 await page.screenshot({path:join(artifacts,'mars-4k-actual-epoch-inspection-1280x720.png')});
 const detailCycles:any[]=[];
 for(let cycle=0;cycle<3;cycle++){
  const oldEnvironment=await page.evaluate(()=>{const s=(window as any).__game.transfer().scene,extension=s.renderer.getContext().getExtension('WEBGL_lose_context');if(!extension)throw Error('WEBGL_lose_context unavailable');(window as any).__marsDetailContextExtension=extension;const target=s.environment,record={uuid:target.texture.uuid,disposals:0};target.addEventListener('dispose',()=>record.disposals++);((window as any).__marsDetailTargets??=[]).push(record);extension.loseContext();return record.uuid;});
  await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return t.scene.lost&&!t.busy;});const lostDetail=await detail();expect(lostDetail.active).toBe(false);expect(lostDetail.activeWidth).toBe(1440);expect(lostDetail.cached).toBe(true);expect(JSON.parse(JSON.stringify((await state(page)).runtime))).toEqual(cameraBaseline);
  await page.evaluate(()=>(window as any).__marsDetailContextExtension.restoreContext());await page.waitForFunction(id=>{const s=(window as any).__game.transfer().scene,d=s.getMarsSurfaceDetailState();return !s.lost&&s.environment.texture.uuid!==id&&d.active&&d.activeWidth===4096;},oldEnvironment);await ready(page);expect((await detail()).requestCount).toBe(1);expect(detailRequests).toHaveLength(1);
  await action(page,'view-craft');const exitedDetail=await detail();expect(exitedDetail.active).toBe(false);expect(exitedDetail.activeWidth).toBe(1440);expect(exitedDetail.cached).toBe(true);await action(page,'view-craft');expect((await detail()).activeWidth).toBe(4096);expect((await detail()).requestCount).toBe(1);expect(detailRequests).toHaveLength(1);
  const disposal=await page.evaluate(()=>(window as any).__marsDetailTargets.at(-1));expect(disposal.disposals).toBe(1);expect(JSON.parse(JSON.stringify((await state(page)).runtime))).toEqual(cameraBaseline);
  detailCycles.push({cycle,oldEnvironment,lostDetail,exitedDetail,reenteredDetail:await detail(),disposal});
  writeFileSync(join(artifacts,'mars-detail-lazy-context-cache.json'),JSON.stringify({loadedDetail,cycles:detailCycles,requests:detailRequests},null,2));
  expect(await page.evaluate(()=>(window as any).__allContextDeletionAudit.errors),'Loaded Mars4K restore and path rebuild must not delete stale native handles').toEqual([]);
 }
 await openDraft(page);
 const before=await state(page);await resizeObservation(page,before.solution.periapsisSeconds+1800,true);
 expect(await page.evaluate(()=>(window as any).__game.transfer().scene.getCraftInspectionState().enabled)).toBe(true);await page.keyboard.press('Escape');expect(await page.evaluate(()=>(window as any).__game.transfer().scene.getCraftInspectionState().enabled)).toBe(false);
 expect((await state(page)).runtime).toEqual(before.runtime);expect((await state(page)).operationsDraft).toEqual(before.operationsDraft);expect((await state(page)).runtime.operations.journal).toHaveLength(0);
 await action(page,'operations-discard');expect((await state(page)).operationsDraft).toBeNull();
 const {submitted,commandId}=await submitRepair(page);await page.screenshot({path:join(artifacts,'queued-not-acknowledged-1280x720.png')});
 await action(page,'speed-600');await play(page);
 await page.waitForFunction(()=>{const s=(window as any).__game.transfer().getState();return s.operations.onboardTruth.revision===1&&s.operations.ground.confirmedRevision===0;},null,{timeout:45000});await pause(page);
 const installed=await state(page);expect(installed.operations.onboardTruth.revision).toBe(1);expect(installed.operations.ground.confirmedRevision).toBe(0);expect(installed.runtime.scienceReceived).toBe(0);
 const record=installed.runtime.operations.commands.find((c:any)=>c.id===commandId),attempt=record.attempts[0];
 expect(attempt.emittedBits).toBe(attempt.totalBits);expect(attempt.arrivedBits).toBe(attempt.totalBits);expect(record.payloadBytes).toBeGreaterThan(0);expect(attempt.totalBits).toBe(8*(record.payloadBytes+64));
 expect(Math.abs(attempt.lastBit.emittedAtSeconds-attempt.firstBit.emittedAtSeconds-attempt.totalBits/256)).toBeLessThan(1e-6);
 assertLightTime(attempt.firstBit);assertLightTime(attempt.lastBit);expect(attempt.lastBit.arrivesAtSeconds).toBeGreaterThan(attempt.lastBit.emittedAtSeconds);
 expect(installed.operations.onboardTruth.installations).toHaveLength(1);expect(installed.operations.onboardTruth.installations[0].installedAtSeconds).toBeGreaterThanOrEqual(attempt.lastBit.arrivesAtSeconds-1e-6);
 await expect(page.locator('.simulation-truth-note').first()).toBeVisible();await expect(page.locator('.command-boundary-note').first()).toContainText('미래 작업');
 await page.screenshot({path:join(artifacts,'installed-but-earth-unconfirmed-1280x720.png')});
 await play(page);await page.waitForFunction(()=>(window as any).__game.transfer().getState().operations.ground.confirmedRevision===1,null,{timeout:45000});await pause(page);
 const confirmed=await state(page),command=confirmed.runtime.operations.commands[0],receivedAck=command.acknowledgements.find((a:any)=>a.status==='delivered');expect(receivedAck).toBeTruthy();
 expect(receivedAck.totalBits).toBe(4096);expect(receivedAck.emittedBits).toBe(4096);expect(receivedAck.firstBit.emittedAtSeconds).toBeGreaterThanOrEqual(attempt.lastBit.arrivesAtSeconds-1e-6);assertLightTime(receivedAck.firstBit);assertLightTime(receivedAck.lastBit);
 expect(confirmed.operations.ground.commands[0].acknowledgedAtSeconds).toBeGreaterThanOrEqual(receivedAck.lastBit.arrivesAtSeconds-1e-6);expect(confirmed.runtime.scienceReceived).toBe(0);
 expect(confirmed.operations.ground.confirmedOperations.find((o:any)=>o.id==='encounter-science')).toEqual(submitted.operations.find((o:any)=>o.id==='encounter-science'));
 expect(confirmed.plan).toEqual(initial.plan);await page.screenshot({path:join(artifacts,'earth-confirmed-future-work-1280x720.png')});
 for(let i=0;i<5&&(await state(page)).runtime.status==='running';i++){await action(page,'next');await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return !t.busy&&!t.getState().playing;},null,{timeout:120000});}
 const finished=await state(page);expect(finished.runtime.status).toBe('complete');expect(finished.result.status).toBe('success');expect(finished.runtime.scienceReceived).toBeGreaterThanOrEqual(3);expect(finished.runtime.scienceReceived).toBeGreaterThan(initial.preview.received);
 await expect(page.locator('.transfer-result .transfer-science-count')).toContainText(String(finished.result.received));await expect(page.locator('[data-transfer-action="retry"]')).toBeVisible();
 const retryBounds=await page.locator('[data-transfer-action="retry"]').evaluate(el=>{const r=el.getBoundingClientRect(),panel=el.closest('.transfer-right')!.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {top:r.top,bottom:r.bottom,panelTop:panel.top,panelBottom:panel.bottom,hit:hit===el||el.contains(hit)};});expect(retryBounds.top).toBeGreaterThanOrEqual(retryBounds.panelTop);expect(retryBounds.bottom).toBeLessThanOrEqual(retryBounds.panelBottom);expect(retryBounds.bottom).toBeLessThanOrEqual(720);expect(retryBounds.hit).toBe(true);
 expect(finished.runtime.packets.filter((p:any)=>p.receivedAt!==null).every((p:any)=>p.receivedAt>(p.readyAt??p.capturedAt))).toBe(true);expect(finished.runtime.operations.installations).toHaveLength(1);expect(finished.view).toBe('solar');
 const checkpoint=JSON.parse(JSON.stringify(finished.runtime)),backup=await exportJSON(page);expect(backup.version).toBe(2);expect(backup.modelVersion).toBe('transfer-3.0.0');expect(backup.commandNetworkId).toBe('omf-command-network-1.0.0');expect(backup.journal).toHaveLength(1);expect(backup.checkpoint.operations.onboardRevision).toBe(1);expect(backup.runtime).toBeUndefined();expect(backup.checkpoint.solution).toBeUndefined();
 await importJSON(page,backup,'completed-remote-flight.json');const restored=await state(page);expect(restored.error).toBe('');expect(JSON.parse(JSON.stringify(restored.runtime))).toEqual(checkpoint);expect(restored.playing).toBe(false);expect(restored.view).toBe('solar');await expect(page.locator('.transfer-result .transfer-science-count')).toContainText(String(restored.result.received));await expect(page.locator('[data-transfer-action="retry"]')).toBeVisible();
 writeFileSync(join(artifacts,'causal-flight-and-replay.json'),JSON.stringify({baselineForecast:initial.preview,submitted,firstBit:attempt.firstBit,lastBit:attempt.lastBit,receivedAck,result:finished.result,journal:backup.journal,checkpoint:backup.checkpoint,restoredResult:restored.result},null,2));
 await page.screenshot({path:join(artifacts,'actual-received-science-restored-1280x720.png')});
 // Exercise application disposal, not merely browser/page shutdown. The native
 // audit remains active through old resource listeners and the hidden main view.
 await action(page,'exit');await expect(page.locator('#transfer-experience')).toHaveCount(0,{timeout:30000});await expect(page.locator('[data-action="load-transfer-operations"]')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__allContextDeletionAudit.errors),'Actual app Exit must retire both renderer generations without invalid deletion').toEqual([]);
});

test('unsent cancel and retry preserve prior signals while invalid version2 import preserves the live flight',async({page})=>{
 await startAtDecision(page);const {commandId}=await submitRepair(page);
 await action(page,'operations-cancel');await page.waitForFunction(()=>!(window as any).__game.transfer().getState().commandAction);
 let s=await state(page);expect(s.runtime.operations.commands[0].attempts[0].status).toBe('cancelled');expect(s.runtime.operations.commands[0].attempts[0].firstBit).toBeNull();expect(s.operations.onboardTruth.revision).toBe(0);
 await action(page,'operations-retry');await page.waitForFunction(()=>!(window as any).__game.transfer().getState().commandAction);s=await state(page);expect(s.runtime.operations.commands).toHaveLength(1);expect(s.runtime.operations.commands[0].attempts).toHaveLength(2);expect(s.runtime.operations.commands[0].id).toBe(commandId);
 await action(page,'speed-600');await play(page);await page.waitForFunction(()=>Boolean((window as any).__game.transfer().getState().runtime.operations.commands[0].attempts[1].firstBit),null,{timeout:30000});await pause(page);
 const emitted=await state(page);expect(emitted.operations.ground.confirmedRevision).toBe(0);const prior=structuredClone(emitted.runtime.operations.commands[0].attempts[1]);
 await action(page,'operations-retry');await page.waitForFunction(()=>!(window as any).__game.transfer().getState().commandAction);await action(page,'operations-cancel');await page.waitForFunction(()=>!(window as any).__game.transfer().getState().commandAction);
 s=await state(page);const command=s.runtime.operations.commands[0];expect(command.attempts).toHaveLength(3);expect(command.attempts[2].status).toBe('cancelled');expect(command.attempts[1]).toEqual(prior);expect(['transmitting','awaiting-confirmation','unconfirmed']).toContain(s.operations.ground.commands[0].status);
 expect(s.runtime.operations.journal.map((a:any)=>a.kind)).toEqual(['queue','cancel-unsent','retry','retry','cancel-unsent']);
 const checkpoint=JSON.parse(JSON.stringify(s.runtime)),backup=await exportJSON(page);expect(backup.version).toBe(2);expect(backup.journal).toHaveLength(5);
 const forged=structuredClone(backup);forged.checkpoint.energyWh+=11;await importJSON(page,forged,'forged-remote-checkpoint.json');await expect(page.locator('.transfer-error')).toBeVisible();
 expect(JSON.parse(JSON.stringify((await state(page)).runtime))).toEqual(checkpoint);expect((await state(page)).playing).toBe(false);
 await action(page,'dismiss-error');await importJSON(page,backup,'valid-partial-remote-checkpoint.json');expect((await state(page)).error).toBe('');expect(JSON.parse(JSON.stringify((await state(page)).runtime))).toEqual(checkpoint);
 await play(page);await page.waitForFunction(time=>(window as any).__game.transfer().getState().runtime.time>time+60,checkpoint.time,{timeout:30000});await pause(page);expect((await state(page)).runtime.status).toBe('running');
 writeFileSync(join(artifacts,'cancel-retry-and-import.json'),JSON.stringify({checkpoint,journal:backup.journal,afterResume:(await state(page)).runtime},null,2));await page.screenshot({path:join(artifacts,'cancelled-retry-original-signal-retained-1280x720.png')});
});

test('bounded replay locks edits through WebGL loss and an immediate queued exit saves no phantom draft',async({page})=>{
 await startAtDecision(page);await openDraft(page);const initial=await state(page);await resizeObservation(page,initial.solution.periapsisSeconds+1800);
 const edited=await state(page),draft=structuredClone(edited.operationsDraft),checkpoint=JSON.parse(JSON.stringify(edited.runtime)),backup=await exportJSON(page);
 expect(backup.version).toBe(2);expect(backup.editorDraft).toEqual(draft);expect(backup.journal).toHaveLength(0);
 await action(page,'operations-discard');expect((await state(page)).operationsDraft).toBeNull();
 const before=await page.evaluate(()=>{const t=(window as any).__game.transfer();return {requestId:t.requestId,environment:t.scene.scene.environment.uuid};});
 await page.locator('.transfer-import').setInputFiles({name:'draft-and-committed-flight.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.waitForFunction(id=>{const t=(window as any).__game.transfer();return t.requestId>id&&t.getState().pending;},before.requestId);
 const locked=await state(page);expect(locked.controlEpoch).toBe(0);expect(locked.playing).toBe(false);
 const edit=page.locator('[data-transfer-action="operations-edit"]');await expect(edit).toBeDisabled();await edit.scrollIntoViewIfNeeded();const box=await edit.boundingBox();expect(box).toBeTruthy();
 // Send a genuine pointer click to the disabled control, without forcibly
 // invoking its handler. Replay and the old committed checkpoint stay intact.
 await page.mouse.click(box!.x+box!.width/2,box!.y+box!.height/2);expect((await state(page)).pending).toBe(true);expect((await state(page)).controlEpoch).toBe(0);expect((await state(page)).operationsDraft).toBeNull();
 await page.evaluate(()=>{const s=(window as any).__game.transfer().scene,e=s.renderer.getContext().getExtension('WEBGL_lose_context');if(!e)throw Error('WEBGL_lose_context unavailable');(window as any).__remoteReplayContextExtension=e;e.loseContext();});
 await page.waitForFunction(()=>(window as any).__game.transfer().scene.renderer.getContext().isContextLost());
 expect((await state(page)).pending).toBe(true);expect((await state(page)).controlEpoch).toBe(0);expect((await state(page)).playing).toBe(false);
 await page.evaluate(()=>(window as any).__remoteReplayContextExtension.restoreContext());
 await page.waitForFunction(previous=>{const s=(window as any).__game.transfer().scene;return !s.renderer.getContext().isContextLost()&&s.scene.environment?.uuid!==previous;},before.environment);
 await ready(page,120000);await page.waitForFunction(()=>Boolean((window as any).__game.transfer().getState().commandPreview));
 const restored=await state(page);expect(restored.controlEpoch).toBe(0);expect(restored.playing).toBe(false);expect(restored.error).toBe('');expect(JSON.parse(JSON.stringify(restored.runtime))).toEqual(checkpoint);expect(restored.operationsDraft).toEqual(draft);expect(restored.plan).toEqual(edited.plan);
 expect(await page.evaluate(()=>{const t=(window as any).__game.transfer();return {model:t.engineOptions.modelVersion,scenario:t.engineOptions.scenarioId,lesson:t.lesson?.id,editAfterPause:t.editAfterPause};})).toEqual({model:'transfer-3.0.0',scenario:'iris-schedule-rescue-v1',lesson:'iris-schedule-rescue-v1',editAfterPause:false});
 await expect(page.locator('[data-transfer-action="play"]')).toBeDisabled();
 const render=await page.evaluate(()=>{const s=(window as any).__game.transfer().scene;s.render(0);return {lost:s.renderer.getContext().isContextLost(),calls:s.renderer.info.render.calls,environment:s.scene.environment.uuid};});expect(render.lost).toBe(false);expect(render.calls).toBeGreaterThan(0);expect(render.environment).not.toBe(before.environment);
 await action(page,'operations-discard');await action(page,'speed-600');await play(page);await page.waitForFunction(time=>(window as any).__game.transfer().getState().runtime.time>time+120,checkpoint.time,{timeout:30000});await pause(page);
 const resumed=await state(page);expect(resumed.runtime.status).toBe('running');expect(resumed.runtime.operations.journal).toHaveLength(0);expect(resumed.operationsDraft).toBeNull();expect(resumed.controlEpoch).toBeGreaterThan(0);
 writeFileSync(join(artifacts,'replay-control-epoch-context-recovery.json'),JSON.stringify({initialTime:checkpoint.time,lockedEpoch:locked.controlEpoch,restoredEpoch:restored.controlEpoch,draft,render,resumedTime:resumed.runtime.time},null,2));await page.screenshot({path:join(artifacts,'replay-context-restored-resumed-1280x720.png')});
 await openDraft(page);await resizeObservation(page,resumed.solution.periapsisSeconds+1800);await expect(page.locator('[data-transfer-action="operations-send"]')).toBeEnabled();const beforeSend=await state(page);
 // Two real DOM controls in one browser task exercise the interval before any
 // Worker response can be delivered. No private action method or Worker frame
 // is invoked; the synchronous pending-action observation proves the race ran.
 const rapid=await page.evaluate(()=>{const send=document.querySelector<HTMLButtonElement>('[data-transfer-action="operations-send"]')!,exit=document.querySelector<HTMLButtonElement>('[data-transfer-action="exit"]')!;if(send.disabled)throw Error('Send disabled');send.click();const t=(window as any).__game.transfer(),pending=t.getState().commandAction,epoch=t.getState().controlEpoch;exit.click();return {pending,epoch,epochAfterExit:t.getState().controlEpoch,closed:t.closed};});
 expect(rapid.pending).toBeTruthy();expect(rapid.epochAfterExit).toBe(rapid.epoch);expect(rapid.closed).toBe(false);
 await expect(page.locator('#transfer-experience')).toHaveCount(0,{timeout:30000});await page.locator('[data-action="load-transfer-operations"]').click();await expect(page.locator('#transfer-experience')).toBeVisible();await ready(page,120000);
 const continued=await state(page);expect(continued.runtime.modelVersion).toBe('transfer-3.0.0');expect(continued.runtime.time).toBe(beforeSend.runtime.time);expect(continued.operationsDraft).toBeNull();expect(continued.commandAction).toBeNull();expect(continued.playing).toBe(false);
 expect(continued.runtime.operations.journal).toHaveLength(1);expect(continued.runtime.operations.journal[0].actionId).toBe(rapid.pending);expect(continued.runtime.operations.commands).toHaveLength(1);expect(continued.runtime.operations.commands[0].envelope.payload).toEqual(beforeSend.operationsDraft);expect(continued.runtime.operations.commands[0].attempts[0].firstBit).toBeNull();expect(continued.operations.ground.confirmedRevision).toBe(0);
 writeFileSync(join(artifacts,'immediate-command-exit-continue.json'),JSON.stringify({rapid,journal:continued.runtime.operations.journal,restoredTime:continued.runtime.time,restoredDraft:continued.operationsDraft,command:continued.runtime.operations.commands[0]},null,2));await page.screenshot({path:join(artifacts,'queued-exit-continue-no-phantom-draft-1280x720.png')});
});
