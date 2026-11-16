import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {installNativeDeletionAudit} from './native-gl-audit';

// Exact current domain is used only for legal pointer-target geometry and an
// independent expected CG. No browser design/runtime/Worker state is injected.
const fixture={exports:{} as any};
const compiled=buildSync({stdin:{contents:"export * from './src/swingby'; export {evaluatePlacement} from './src/sim/assembly'; export {partTransformFor} from './src/hardware';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
new Function('module','exports','require',compiled)(fixture,fixture.exports,createRequire(import.meta.url));
const {createSwingbyPlan,getSwingbyScenario,SWINGBY_PROPULSION,swingbyThrustGeometry,evaluatePlacement,partTransformFor}=fixture.exports;
const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'development';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate name');
const output=join(process.cwd(),'tests/browser/artifacts/swingby-builder',candidate);mkdirSync(output,{recursive:true});
const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);
 const errors:string[]=[],warnings:string[]=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use(errors);
 const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null),graphicsFailures=warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w));
 const status=info.status==='passed'&&(errors.length||graphicsFailures.length||!native?.contexts?.length||native?.errors?.length)?'failed':info.status;
 const report={test:info.title,status,browser:page.context().browser()?.version(),viewport:page.viewportSize(),url:page.url(),scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url()),errors,warnings,native,fixtureCodeSha256:createHash('sha256').update(compiled).digest('hex'),scope:'Actual UI entry, pointer aim, visible mesh click/move, bus picker, undo, JSON and campus continue. Read-only projections and source-domain calculations; no QA state injection, Worker posts, fake completion or simulation advancement.'};
 writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));await info.attach('swingby-builder-evidence',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 if(status!==info.expectedStatus)await page.screenshot({path:join(output,'failure.png'),fullPage:true}).catch(()=>{});
 expect(errors,'No browser/app failures').toEqual([]);expect(graphicsFailures,'No native context ownership warning').toEqual([]);expect(native).not.toBeNull();expect(native?.contexts?.length??0).toBeGreaterThan(0);expect(native?.errors??[]).toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});test.setTimeout(180000);
const rootState=(p:Page)=>p.evaluate(()=>(window as any).__game.getState());
const flightState=(p:Page)=>p.evaluate(()=>(window as any).__game.swingby()?.getState());
const mainAction=(p:Page,a:string)=>p.locator(`[data-action="${a}"]`).first().click();
const flightAction=(p:Page,a:string)=>p.locator(`[data-swingby-action="${a}"]`).first().click();
async function flightReady(p:Page){await p.waitForFunction(()=>{const e=(window as any).__game.swingby();const s=e?.getState();return s&&!s.pending&&!s.busy&&!e.dirty;},null,{timeout:45000});}
async function builderReady(p:Page){await p.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return s.mode==='build'&&s.swingbyAssembly&&!s.pending&&s.acceptedRevision===s.revision&&!g.scene.tween;},null,{timeout:30000});}
async function cameraReady(p:Page){await p.waitForFunction(()=>!(window as any).__game.scene.tween);}
async function drag(p:Page,a:{x:number;y:number},b:{x:number;y:number}){await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:24});await p.mouse.up();}
async function slot(p:Page,dbName:string,key:string){return p.evaluate(async({dbName,key})=>{
 const databases=await indexedDB.databases();if(!databases.some(d=>d.name===dbName))return null;
 return new Promise<string|null>((resolve,reject)=>{const open=indexedDB.open(dbName);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result;if(!db.objectStoreNames.contains('saves')){db.close();resolve(null);return;}const request=db.transaction('saves','readonly').objectStore('saves').get(key);request.onerror=()=>{db.close();reject(request.error);};request.onsuccess=()=>{db.close();resolve(request.result??null);};};});
 },{dbName,key});}

/** Choose a point on a ray-visible real mesh. Merely projecting the component
 * origin would permit an occluded or hidden stock-engine hit. No scene change. */
async function visiblePartPoint(p:Page,id:string){return p.evaluate(id=>{
 const scene=(window as any).__game.scene,part=scene.parts.get(id);if(!part)throw Error('Missing rendered part '+id);
 const visible=(o:any)=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
 const rect=scene.canvas.getBoundingClientRect(),ray=new scene.ray.constructor(),candidates:any[]=[];
 part.traverse((o:any)=>{if(!o.isMesh||!visible(o))return;let box=o.geometry.boundingBox;
  if(!box){const a=o.geometry.getAttribute('position');if(!a)return;const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};for(let i=0;i<a.count;i++){const v={x:a.getX(i),y:a.getY(i),z:a.getZ(i)};for(const k of ['x','y','z'] as const){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}box={min,max};}
  for(const f of [[.5,.5,.5],[.5,.9,.5],[.2,.5,.5],[.8,.5,.5],[.5,.5,.9]]){
   const v=part.position.clone().set(box.min.x+(box.max.x-box.min.x)*f[0],box.min.y+(box.max.y-box.min.y)*f[1],box.min.z+(box.max.z-box.min.z)*f[2]);o.localToWorld(v);const point=scene.project(v);candidates.push(point);
  }
 });
 for(const point of candidates){if(!point.visible||point.x<rect.left||point.x>=rect.right||point.y<rect.top||point.y>=rect.bottom||document.elementFromPoint(point.x,point.y)!==scene.canvas)continue;
  const mouse=scene.mouse.clone().set((point.x-rect.left)/rect.width*2-1,-(point.y-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,scene.camera);
  const hit=ray.intersectObjects([scene.bus,...scene.parts.values()],true).find((h:any)=>visible(h.object));if(hit?.object.userData.partId===id)return {x:point.x,y:point.y};
 }
 throw Error('No unobscured rendered mesh point for '+id);
 },id);}
async function pointerAim(p:Page,target:{xKm:number;yKm:number}){
 await flightAction(p,'view-aim');
 const coordinates=await p.evaluate(({target,plane})=>{const e=(window as any).__game.swingby(),s=e.scene,current=e.getState().plan.aim,start=s.getAimScreen();const world=s.objective.getAimWorldPosition().clone(),dx=target.xKm-current.xKm,dy=target.yKm-current.yKm,delta=plane.xAxis.map((n:number,i:number)=>n*dx+plane.yAxis[i]*dy);world.add(world.clone().set(delta[0],delta[2],-delta[1]).multiplyScalar(3/3389.5));world.project(s.camera);const r=s.canvas.getBoundingClientRect();return {start,end:{x:r.x+(world.x+1)*r.width/2,y:r.y+(1-world.y)*r.height/2}};},{target,plane:getSwingbyScenario().aimPlane});
 expect(coordinates.start?.visible).toBe(true);expect(coordinates.end.x).toBeGreaterThan(0);expect(coordinates.end.x).toBeLessThan(1280);expect(coordinates.end.y).toBeGreaterThan(0);expect(coordinates.end.y).toBeLessThan(720);await drag(p,coordinates.start,coordinates.end);await flightReady(p);
}

test('swingby builder changes real CG with a pointer move and preserves its plan and separate save slot',async({page})=>{
 await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
 // Establish a real legacy save through its own UI, to detect slot corruption.
 await mainAction(page,'missions');await page.locator('[data-mission="earth"]').click();await mainAction(page,'preset-balanced');await mainAction(page,'save');
 const legacyDesign=JSON.parse(JSON.stringify((await rootState(page)).design));expect(legacyDesign.parts).toHaveLength(6);
 await expect.poll(async()=>{const raw=await slot(page,'orbital-foundry','autosave');return raw?JSON.parse(raw).design:null;}).toEqual(legacyDesign);let legacyRaw=await slot(page,'orbital-foundry','autosave');
 await mainAction(page,'home');await mainAction(page,'missions');await mainAction(page,'mission-swingby');await flightReady(page);
 legacyRaw=await slot(page,'orbital-foundry','autosave');expect(JSON.parse(legacyRaw!).design).toEqual(legacyDesign);const initial=await flightState(page);await pointerAim(page,createSwingbyPlan('economy').aim);const edited=await flightState(page);expect(edited.plan.aim).not.toEqual(initial.plan.aim);expect(edited.evaluation.launchable).toBe(true);
 await flightAction(page,'edit');await expect(page.locator('.swingby-experience')).toHaveCount(0);await builderReady(page);
 const before=await rootState(page);expect(before.swingbyDraft).toEqual(edited.plan);expect(before.swingbyEvaluation.initialFuelKg).toBe(.25);expect(before.swingbyEvaluation.budget).toBe(760);expect(before.preview).toBeUndefined();
 await expect(page.locator('[data-swingby-loaded-propellant]')).toContainText('0.25');expect(await page.locator('.stats-deck').innerText()).not.toMatch(/NaN|Infinity/);
 const engine=before.design.parts.find((p:any)=>p.kind==='engine');expect(engine).toBeTruthy();
 // Side view exposes the real carrier below the bus. Focus is a visible UI key.
 await mainAction(page,'view-side');await cameraReady(page);const enginePoint=await visiblePartPoint(page,engine.id);await page.mouse.click(enginePoint.x,enginePoint.y);expect(await page.evaluate(()=>(window as any).__game.scene.selection)).toBe(engine.id);await page.keyboard.press('f');await cameraReady(page);
 const carrier=await page.evaluate(()=>{const s=(window as any).__game.scene,a=s.getSwingbyCarrierState(),part=s.parts.get(a.attachedPartId),group=part?.getObjectByName('scenario-cg-trim-carrier');let visibleMeshes=0;group?.traverse((o:any)=>{if(o.isMesh&&o.visible)visibleMeshes++;});return {...a,groupVisible:group?.visible,visibleMeshes};});
 expect(carrier.attachedPartId).toBe(engine.id);expect(carrier.profileHash).toBe(SWINGBY_PROPULSION.hash);expect(carrier.carrier.profileId).toBe(SWINGBY_PROPULSION.id);expect(carrier.groupVisible).toBe(true);expect(carrier.visibleMeshes).toBeGreaterThan(5);expect(carrier.poseAccepted).toBe(true);expect(carrier.carrier.gimbalAngleDeg).toBeCloseTo(before.swingbyEvaluation.gimbalAngleDeg,6);
 await page.screenshot({path:join(output,'actual-carrier-focused.png')});
 await mainAction(page,'camera-reset');await mainAction(page,'view-top');await cameraReady(page);if(!await page.evaluate(()=>(window as any).__game.scene.bayOpen))await mainAction(page,'bay');
 const battery=before.design.parts.find((p:any)=>p.kind==='battery'),proposed={...battery,v:battery.v-.08};expect(evaluatePlacement(before.design,proposed).valid,'The authored 8 cm interior move is physically legal').toBe(true);
 const destinationLocal=partTransformFor(before.design,proposed).position;
 const source=await visiblePartPoint(page,battery.id),destination=await page.evaluate(local=>{const s=(window as any).__game.scene;return s.project(s.craft.localToWorld(s.craft.position.clone().set(...local)));},destinationLocal);
 expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,destination)).toBe('universe');await drag(page,source,destination);await builderReady(page);
 const moved=await rootState(page),movedBattery=moved.design.parts.find((p:any)=>p.id===battery.id);expect(moved.revision).toBeGreaterThan(before.revision);expect(movedBattery.face).toBe('py');expect(Math.abs(movedBattery.v-battery.v)).toBeGreaterThan(.035);expect(moved.swingbyDraft).toEqual(edited.plan);
 const cgBefore=swingbyThrustGeometry(before.design,.25),cgAfter=swingbyThrustGeometry(moved.design,.25);expect(cgAfter.centerOfMassM).not.toEqual(cgBefore.centerOfMassM);expect(Math.abs(moved.swingbyEvaluation.gimbalAngleDeg-before.swingbyEvaluation.gimbalAngleDeg)).toBeGreaterThan(.0001);expect(moved.swingbyEvaluation.gimbalAngleDeg).toBeCloseTo(cgAfter.gimbalAngleDeg,8);
 await page.screenshot({path:join(output,'actual-battery-drag-cg-change.png')});await page.keyboard.press('Control+z');await builderReady(page);const undone=await rootState(page);expect(undone.design).toEqual(before.design);expect(undone.swingbyDraft).toEqual(edited.plan);expect(undone.swingbyEvaluation).toEqual(before.swingbyEvaluation);
 // A visible bus selection must reach the real planning launch gate.
 await mainAction(page,'hardware-buses');await page.locator('[data-hardware-bus="surveyor-l18-v1"]').click();await builderReady(page);const invalid=await rootState(page);expect(invalid.swingbyEvaluation.launchable).toBe(false);expect(invalid.swingbyEvaluation.issues.some((i:any)=>i.severity==='error')).toBe(true);expect(invalid.swingbyDraft).toEqual(edited.plan);
 await mainAction(page,'plan');await flightReady(page);expect((await flightState(page)).evaluation.launchable).toBe(false);await expect(page.locator('[data-swingby-action="launch"]')).toBeDisabled();await flightAction(page,'edit');await builderReady(page);
 await mainAction(page,'hardware-buses');await page.locator('[data-hardware-bus="pathfinder-d35-v1"]').click();await builderReady(page);expect((await rootState(page)).swingbyEvaluation.launchable).toBe(true);
 const restoredDesign=(await rootState(page)).design;expect(restoredDesign).toEqual(before.design);
 await mainAction(page,'settings');const downloadEvent=page.waitForEvent('download');await mainAction(page,'export');const download=await downloadEvent;expect(await download.failure()).toBeNull();expect(download.suggestedFilename()).toBe('orbital-foundry-swingby.json');const text=readFileSync((await download.path())!,'utf8'),save=JSON.parse(text);expect(save.format).toBe('orbital-foundry-swingby');expect(save.modelVersion).toBe('swingby-1.0.0');expect(save.plan).toEqual(edited.plan);expect(save.craft).toEqual(restoredDesign);
 const chooser=page.waitForEvent('filechooser');await mainAction(page,'import');await(await chooser).setFiles({name:'actual-swingby-draft.json',mimeType:'application/json',buffer:Buffer.from(text)});await flightReady(page);expect((await flightState(page)).plan).toEqual(save.plan);expect((await flightState(page)).craft).toEqual(save.craft);expect((await flightState(page)).runtime).toBeNull();
 const publicData:Record<string,any>={};for(const name of ['scenario-v1','propulsion-v1','model-v1']){const response=await page.request.get(`/data/swingby/${name}.json`);expect(response.status()).toBe(200);expect(response.headers()['content-type']).toMatch(/json/);publicData[name]=await response.json();}
 expect(publicData['scenario-v1'].hash).toBe(save.scenarioHash);expect(publicData['scenario-v1'].initialFuelKg).toBe(.25);expect(publicData['propulsion-v1'].hash).toBe(save.propulsionHash);expect(publicData['propulsion-v1'].carrierMassKg).toBe(.4);expect(publicData['propulsion-v1'].carrierCost).toBe(12);expect(publicData['model-v1'].modelVersion).toBe(save.modelVersion);expect(publicData['model-v1'].hardwareCatalogHash).toBe(save.hardwareCatalogHash);
 await flightAction(page,'exit');await expect(page.locator('.swingby-experience')).toHaveCount(0);await expect.poll(async()=>{const s=await slot(page,'orbital-foundry-swingby','autosave:swingby-1.0.0');return s?JSON.parse(s).plan:null;}).toEqual(save.plan);expect(await slot(page,'orbital-foundry','autosave')).toBe(legacyRaw);
 await page.reload();await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));await mainAction(page,'load-swingby');await flightReady(page);expect((await flightState(page)).plan).toEqual(save.plan);expect((await flightState(page)).craft).toEqual(save.craft);expect((await flightState(page)).runtime).toBeNull();
 await page.screenshot({path:join(output,'actual-campus-continue.png')});await flightAction(page,'exit');await expect(page.locator('.swingby-experience')).toHaveCount(0);expect(await slot(page,'orbital-foundry','autosave')).toBe(legacyRaw);
 const beforeLegacyLoad=await rootState(page);await mainAction(page,'load');
 // IndexedDB loading starts before restore() sets pending. A previous false
 // pending flag is not completion; require the newly accepted design revision.
 await page.waitForFunction(previous=>{const s=(window as any).__game.getState();return s.revision>previous&&!s.pending&&s.acceptedRevision===s.revision;},beforeLegacyLoad.revision);
 const afterLegacyLoad=await rootState(page);expect(afterLegacyLoad.design).toEqual(legacyDesign);expect(afterLegacyLoad.swingbyAssembly).toBe(false);expect(await page.evaluate(()=>(window as any).__game.scene.getSwingbyCarrierState().attachedPartId)).toBeNull();expect(await slot(page,'orbital-foundry','autosave')).toBe(legacyRaw);
 writeFileSync(join(output,'legacy-slot-transaction-evidence.json'),JSON.stringify({legacyRaw,expectedDesign:legacyDesign,beforeLoadRevision:beforeLegacyLoad.revision,afterLoadRevision:afterLegacyLoad.revision,acceptedRevision:afterLegacyLoad.acceptedRevision,restoredDesign:afterLegacyLoad.design,slotUnchanged:true},null,2));await page.screenshot({path:join(output,'actual-legacy-slot-restored.png')});
 writeFileSync(join(output,'physical-and-save-evidence.json'),JSON.stringify({initialAim:initial.plan.aim,editedPlan:edited.plan,carrier,batteryBefore:battery,batteryAfter:movedBattery,centerOfMassBefore:cgBefore.centerOfMassM,centerOfMassAfter:cgAfter.centerOfMassM,gimbalBefore:before.swingbyEvaluation.gimbalAngleDeg,gimbalAfter:moved.swingbyEvaluation.gimbalAngleDeg,invalidBusIssues:invalid.swingbyEvaluation.issues,exportSha256:createHash('sha256').update(text).digest('hex'),slot:'orbital-foundry-swingby/saves/autosave:swingby-1.0.0',legacySlotUnchanged:true,publicModel:publicData['model-v1']},null,2));
});
