import {test as base, expect, type Page} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

type Point={x:number;y:number;visible?:boolean};
type BrowserLog={kind:string;text:string};
const artifactDir=join(process.cwd(),'tests','browser','artifacts');
mkdirSync(artifactDir,{recursive:true});

const test=base.extend<{browserLogs:BrowserLog[]}>({
 browserLogs:[async({page},use,testInfo)=>{
  const logs:BrowserLog[]=[];
  page.on('pageerror',error=>logs.push({kind:'pageerror',text:error.stack??error.message}));
  page.on('console',message=>{if(message.type()==='error'&&!message.location().url.includes('favicon.ico'))logs.push({kind:'console-error',text:message.text()+' '+message.location().url});});
  page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))logs.push({kind:'http-error',text:`${response.status()} ${response.url()}`});});
  await use(logs);
  await testInfo.attach('browser-errors',{body:JSON.stringify(logs,null,2),contentType:'application/json'});
  const record={title:testInfo.title,status:testInfo.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors:logs};
  writeFileSync(join(artifactDir,testInfo.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify(record,null,2));
  if(testInfo.status!==testInfo.expectedStatus)await page.screenshot({path:testInfo.outputPath('failure.png'),fullPage:true}).catch(()=>{});
  expect(logs,'No browser exceptions, WebGL console errors or failed application resources').toEqual([]);
 },{auto:true}]
});

async function boot(page:Page){
 await page.goto('/?qa');
 await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});
 await expect(page.locator('#loading')).toHaveCount(0);
}
async function state(page:Page){return page.evaluate(()=>(window as any).__game.getState());}
async function previewReady(page:Page){await page.waitForFunction(()=>{const s=(window as any).__game.getState();return !s.pending&&s.acceptedRevision===s.revision;},null,{timeout:25000});}
async function cameraReady(page:Page){await page.waitForFunction(()=>Boolean((window as any).__game)&&!(window as any).__game.scene.tween);}
async function start(page:Page,mission:'earth'|'mars',preset:'starter'|'balanced'='balanced'){
 await page.evaluate(({mission,preset})=>(window as any).__game.startMission(mission,preset),{mission,preset});
 await cameraReady(page);await previewReady(page);
}
async function clickAction(page:Page,action:string){await page.locator(`[data-action="${action}"]`).first().click();}
async function drag(page:Page,from:Point,to:Point){
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:14});await page.mouse.up();
}
async function center(page:Page,selector:string):Promise<Point>{const b=await page.locator(selector).boundingBox();expect(b,selector+' is visible').not.toBeNull();return {x:b!.x+b!.width/2,y:b!.y+b!.height/2};}
async function busPoint(page:Page,u:number,v:number):Promise<Point>{
 return page.evaluate(({u,v})=>{const s=(window as any).__game.scene;return s.project(s.craft.position.clone().add({x:u,y:v,z:.65}));},{u,v});
}
async function handle(page:Page,name:string):Promise<Point>{
 const p=await page.evaluate(name=>(window as any).__game.scene.getHandleScreen(name),name);
 expect(p,`${name} handle is available`).toBeTruthy();expect(p.visible).toBe(true);
 const canvas=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,p);
 expect(canvas,`${name} handle must be mouse-accessible, not covered by UI`).toBe('universe');
 return p;
}
async function shot(page:Page,name:string){await page.locator('.toast').waitFor({state:'hidden',timeout:5500});await page.screenshot({path:join(artifactDir,name+'.png'),fullPage:true});}

test('first-time mission uses real catalogue drag, reposition, rotate, undo and delete',async({page})=>{
 await boot(page);
 await expect(page.getByRole('heading',{name:/SMALL CRAFT/})).toBeVisible();
 await clickAction(page,'missions');await page.locator('[data-mission="earth"]').click();
 await cameraReady(page);await previewReady(page);
 await clickAction(page,'view-front');await cameraReady(page);
 const initial=await state(page);expect(initial.design.parts).toHaveLength(0);
 const target=await busPoint(page,-.14,.10);
 await drag(page,await center(page,'[data-part="camera"]'),target);
 await expect.poll(async()=>(await state(page)).design.parts.length).toBe(1);
 let part=(await state(page)).design.parts[0];expect(part.kind).toBe('camera');expect(part.face).toBe('pz');
 const oldU=part.u,oldV=part.v;
 const onPart=await page.evaluate(id=>(window as any).__game.scene.getPartScreen(id),part.id);
 await drag(page,onPart,await busPoint(page,.14,.24));
 part=(await state(page)).design.parts[0];
 expect(Math.abs(part.u-oldU)+Math.abs(part.v-oldV),'moving existing hardware must alter the mounting location').toBeGreaterThan(.12);
 await page.keyboard.press('r');expect((await state(page)).design.parts[0].rotation).toBe(15);
 await page.keyboard.press('Control+z');expect((await state(page)).design.parts[0].rotation).toBe(0);
 const selectPoint=await page.evaluate(id=>(window as any).__game.scene.getPartScreen(id),part.id);
 await page.mouse.click(selectPoint.x,selectPoint.y);await page.keyboard.press('Delete');
 expect((await state(page)).design.parts).toHaveLength(0);
 await page.keyboard.press('Control+z');expect((await state(page)).design.parts).toHaveLength(1);
 // Releasing outside a mounting surface must not silently install a new part.
 await drag(page,await center(page,'[data-part="antenna"]'),{x:410,y:150});
 expect((await state(page)).design.parts).toHaveLength(1);
 await previewReady(page);await shot(page,'assembly-pointer-edit');
});

test('Earth orbital handle dragging changes trajectory and accepts only the latest preview',async({page})=>{
 await boot(page);await start(page,'earth');await clickAction(page,'plan');await cameraReady(page);
 const before=await state(page),p=await handle(page,'prograde');
 await drag(page,p,{x:p.x+46,y:p.y-18});
 await previewReady(page);const after=await state(page);
 expect(after.design.plan.progradeMps).toBeGreaterThan(before.design.plan.progradeMps+10);
 expect(after.revision).toBeGreaterThan(before.revision);expect(after.acceptedRevision).toBe(after.revision);
 expect(after.preview).toBeTruthy();await shot(page,'earth-trajectory-edited');
});

test('timeline supports pointer move, edge resize, new action and context deletion',async({page})=>{
 await boot(page);await start(page,'earth');await clickAction(page,'plan');await cameraReady(page);
 const before=(await state(page)).design.plan.operations.find((o:any)=>o.id==='obs-1');
 const p=await center(page,'[data-op="obs-1"]');await drag(page,p,{x:p.x-12,y:p.y});
 let moved=(await state(page)).design.plan.operations.find((o:any)=>o.id==='obs-1');
 expect(moved.start).toBeLessThan(before.start);expect(moved.end-moved.start).toBe(before.end-before.start);
 const edge=await center(page,'[data-op="obs-1"] .resize-handle');await drag(page,edge,{x:edge.x-28,y:edge.y});
 const resized=(await state(page)).design.plan.operations.find((o:any)=>o.id==='obs-1');
 expect(resized.start).toBe(moved.start);expect(resized.end).toBeLessThan(moved.end);
 const count=(await state(page)).design.plan.operations.length;
 const track=await page.locator('#timeline').boundingBox();
 await drag(page,await center(page,'[data-op-new="charge"]'),{x:track!.x+track!.width*.51,y:track!.y+25});
 expect((await state(page)).design.plan.operations.length).toBe(count+1);
 const added=(await state(page)).design.plan.operations.find((o:any)=>!['obs-1','down-1','obs-2','down-2'].includes(o.id));
 expect(added.kind).toBe('charge');
 await page.locator(`[data-op="${added.id}"]`).click({button:'right'});
 expect((await state(page)).design.plan.operations.length).toBe(count);
 await previewReady(page);
});

test('IndexedDB save survives reload; invalid JSON cannot replace the current design',async({page})=>{
 await boot(page);await start(page,'mars');
 const expected=(await state(page)).design;
 await clickAction(page,'save');await expect(page.getByRole('status')).toContainText('저장했습니다');
 await page.reload();await page.waitForFunction(()=>Boolean((window as any).__game));
 await clickAction(page,'load');await expect.poll(async()=>(await state(page)).design).toEqual(expected);
 await clickAction(page,'settings');
 await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"format":oops')});
 await expect(page.getByRole('status')).toContainText('올바른 JSON이 아닙니다');expect((await state(page)).design).toEqual(expected);
 await page.locator('#import-file').setInputFiles({name:'wrong-version.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'orbital-foundry',version:999}))});
 await expect(page.getByRole('status')).toContainText('호환되지 않는');expect((await state(page)).design).toEqual(expected);
});

for(const mission of ['earth','mars'] as const){
 test(`${mission} completes via UI launch, live simulation, pause, result and replay save`,async({page})=>{
  await boot(page);await start(page,mission);await clickAction(page,'plan');await cameraReady(page);await previewReady(page);
  expect((await state(page)).preview.status).toBe('success');
  await clickAction(page,'launch');await expect(page.locator('#flight-time')).toBeVisible();
  await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(0);
  await page.keyboard.press('Space');expect((await state(page)).playing).toBe(false);
  const paused=(await state(page)).sim.time;await page.waitForTimeout(350);expect((await state(page)).sim.time).toBe(paused);
  await page.locator('[data-speed="600"]').click();await page.keyboard.press('Space');
  await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(paused+50);
  await page.keyboard.press('Space');await shot(page,`${mission}-live-telemetry`);
  await page.evaluate(()=>(window as any).__game.finishFast());
  await expect(page.getByRole('heading',{name:'임무를 완수했습니다'})).toBeVisible();
  const completed=await state(page);expect(completed.sim.status).toBe('complete');expect(completed.sim.scienceReceived).toBeGreaterThanOrEqual(mission==='earth'?4:3);
  await shot(page,`${mission}-complete-result`);
  await clickAction(page,'retry');expect((await state(page)).sim).toBeNull();expect((await state(page)).mode).toBe('build');
  await previewReady(page);await clickAction(page,'save');await expect(page.getByRole('status')).toContainText('저장했습니다');
  await page.reload();await page.waitForFunction(()=>Boolean((window as any).__game));await clickAction(page,'load');
  await expect.poll(async()=>(await state(page)).design).toEqual(completed.design);
 });
}

test('Mars B-plane is draggable at 1280x720 and result UI remains within viewport',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await boot(page);await start(page,'mars');
 await shot(page,'assembly-1280x720');await clickAction(page,'plan');await cameraReady(page);
 const before=await state(page),p=await handle(page,'bplane');
 await drag(page,p,{x:p.x+8,y:p.y-9});await previewReady(page);
 const after=await state(page);expect(after.design.plan.periapsisAltitudeKm).toBeGreaterThan(before.design.plan.periapsisAltitudeKm);
 expect(after.design.plan.bPlaneAngleDeg).toBeGreaterThan(before.design.plan.bPlaneAngleDeg);
 await shot(page,'mars-planning-1280x720');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight);
 expect(overflow).toBe(false);
 await clickAction(page,'launch');await page.evaluate(()=>(window as any).__game.finishFast());
 await expect(page.locator('.result-layout')).toBeVisible();
 const result=await page.locator('.modal').boundingBox();expect(result!.x).toBeGreaterThanOrEqual(0);expect(result!.y).toBeGreaterThanOrEqual(0);expect(result!.x+result!.width).toBeLessThanOrEqual(1280);expect(result!.y+result!.height).toBeLessThanOrEqual(720);
 await shot(page,'mars-result-1280x720');
});

test('rotation ring applies the same mounting-boundary guard as keyboard rotation',async({page})=>{
 await boot(page);await start(page,'earth','starter');await clickAction(page,'view-front');await cameraReady(page);
 await drag(page,await center(page,'[data-part="camera"]'),await busPoint(page,.45,0));
 expect((await state(page)).design.parts).toHaveLength(1);
 const p=await page.evaluate(()=>{const s=(window as any).__game.scene;return s.project(s.rotationRing.position.clone().add({x:.8,y:0,z:0}));});
 await drag(page,p,{x:p.x+75,y:p.y});await previewReady(page);
 const angle=(await state(page)).design.parts[0].rotation;expect(angle).toBeGreaterThan(0);expect(angle).toBeLessThan(15);
 await expect(page.locator('.warning.error').filter({hasText:'장착판의 경계를 벗어났습니다.'})).toHaveCount(0);
});

test('saving a retry from an interim result remains loadable',async({page})=>{
 await boot(page);await start(page,'earth');await clickAction(page,'plan');await previewReady(page);await clickAction(page,'launch');
 await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(0);
 await page.keyboard.press('Space');await clickAction(page,'finish');await expect(page.locator('.result-layout')).toBeVisible();
 await clickAction(page,'retry');const expected=(await state(page)).design;await clickAction(page,'save');await expect(page.getByRole('status')).toContainText('저장했습니다');
 await page.reload();await page.waitForFunction(()=>Boolean((window as any).__game));
 await expect(page.locator('[data-action="load"]'),'a saved retry should offer Continue after a fresh load').toBeVisible();
 await clickAction(page,'load');await expect.poll(async()=>(await state(page)).design).toEqual(expected);
});

test('changing a retained part ID to a larger array replaces its actual geometry',async({page})=>{
 await boot(page);await start(page,'earth');
 const measure=()=>page.evaluate(()=>{const g=(window as any).__game.scene.parts.get('solar-1');let width=0,height=0;g.traverse((o:any)=>{if(o.geometry?.type==='PlaneGeometry'){width=Math.max(width,o.geometry.parameters.width);height=Math.max(height,o.geometry.parameters.height);}});return {uuid:g.uuid,kind:g.userData.partKind,width,height};});
 const before=await measure();
 // Setup switch exercises the same production preset action; assertions inspect mesh geometry.
 await page.evaluate(()=>(window as any).__game.action('preset-science'));await previewReady(page);
 const after=await measure();expect(after.kind).toBe('solarLarge');expect(after.uuid).not.toBe(before.uuid);
 expect(after.width).toBeGreaterThan(before.width*1.2);expect(after.height).toBeGreaterThan(before.height*1.2);
 expect((await state(page)).design.parts.find((p:any)=>p.id==='solar-1').kind).toBe('solarLarge');
});

test('a failed new preview cannot launch using the previously accepted result',async({page})=>{
 // One fault is injected at the Worker message boundary. The initial preview runs normally.
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{
   postMessage(message:any,options?:any){
    if((window as any).__failNextPreview){
     (window as any).__failNextPreview=false;
     queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{revision:message.revision,error:'QA injected calculation failure'}})));
     return;
    }
    super.postMessage(message,options);
   }
  };
 });
 await boot(page);await start(page,'earth');await clickAction(page,'plan');await cameraReady(page);await previewReady(page);
 const oldRevision=(await state(page)).acceptedRevision;
 await page.evaluate(()=>(window as any).__failNextPreview=true);
 const p=await handle(page,'prograde');await drag(page,p,{x:p.x+20,y:p.y});
 await expect(page.getByRole('status')).toContainText('QA injected calculation failure');
 const failed=await state(page);expect(failed.pending).toBe(false);expect(failed.revision).toBeGreaterThan(oldRevision);expect(failed.acceptedRevision).toBe(oldRevision);
 await expect(page.locator('[data-action="launch"]')).toBeDisabled();
 // The production action has its own guard as well as the disabled UI.
 await page.evaluate(()=>(window as any).__game.action('launch'));
 expect((await state(page)).sim).toBeNull();expect((await state(page)).mode).toBe('plan');
});

test('multiple maneuvers can be added on the orbit, individually dragged, selected and deleted',async({page})=>{
 await boot(page);await start(page,'earth');await clickAction(page,'plan');await cameraReady(page);await previewReady(page);
 const original=(await state(page)).design.plan;
 await clickAction(page,'add-node');
 const orbitPoint=await page.evaluate(()=>{
  const s=(window as any).__game.scene;
  const handles=s.handleGroup.children.filter((o:any)=>o.userData.handle).map((o:any)=>s.project(o.getWorldPosition(s.camera.position.clone())));
  const candidates=s.trajectoryPoints.map((p:any)=>({...s.project(s.camera.position.clone().set(p.positionKm[0],p.positionKm[2],-p.positionKm[1]).multiplyScalar(s.scale)),time:p.t})).filter((p:any)=>p.visible&&p.time>4500&&p.time<9500&&p.x>400&&p.x<1040&&p.y>240&&p.y<650&&document.elementFromPoint(p.x,p.y)?.id==='universe'&&handles.every((h:any)=>Math.hypot(h.x-p.x,h.y-p.y)>45));
  return candidates[Math.floor(candidates.length/2)];
 });
 expect(orbitPoint,'an unobstructed later point on the rendered orbit exists').toBeTruthy();
 await page.mouse.click(orbitPoint.x,orbitPoint.y);await previewReady(page);
 const added=(await state(page)).design.plan.maneuvers;expect(added).toHaveLength(2);
 const newId=await page.evaluate(()=>(window as any).__game.scene.selectedManeuverId);
 const newNode=added.find((n:any)=>n.id===newId);expect(newNode).toBeTruthy();expect(newNode.time).toBeGreaterThan(0);
 const first=added.find((n:any)=>n.id!==newId);expect(first.progradeMps).toBe(original.progradeMps);
 const p=await handle(page,'normal');await drag(page,p,{x:p.x+26,y:p.y-14});await previewReady(page);
 const changed=(await state(page)).design.plan.maneuvers;
 expect(changed.find((n:any)=>n.id===newId).normalMps).toBeGreaterThan(3);
 expect(changed.find((n:any)=>n.id===first.id)).toEqual(first);
 await page.locator(`[data-node="${first.id}"]`).click();
 expect(await page.evaluate(()=>(window as any).__game.scene.selectedManeuverId)).toBe(first.id);
 await page.locator(`[data-node="${newId}"]`).click();await shot(page,'earth-multiple-maneuvers');
 await clickAction(page,'delete-node');await previewReady(page);
 expect((await state(page)).design.plan.maneuvers).toEqual([first]);
});

test('assembly inspection uses a real draggable Sun and shows instrument visibility',async({page})=>{
 await boot(page);await start(page,'earth');
 const designBefore=(await state(page)).design;
 await clickAction(page,'inspect-power');
 const before=await page.evaluate(()=>(window as any).__game.scene.inspectionSummary);
 const sun=await page.evaluate(()=>{const s=(window as any).__game.scene;const o=s.craft.getObjectByName('inspection-sun-handle');return s.project(o.getWorldPosition(s.camera.position.clone()));});
 expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,sun)).toBe('universe');
 await drag(page,sun,{x:sun.x-115,y:sun.y+30});
 const after=await page.evaluate(()=>(window as any).__game.scene.inspectionSummary);
 expect(Math.abs(after.value-before.value)).toBeGreaterThan(2);
 expect(after.unit).toBe('W');expect((await state(page)).design).toEqual(designBefore);
 await expect(page.locator('#inspection-readout')).toContainText('W');await shot(page,'assembly-power-inspection');
 await clickAction(page,'inspect-camera');
 expect(await page.evaluate(()=>(window as any).__game.scene.inspectionSummary.unit)).toBe('%');
 expect(await page.evaluate(()=>Boolean((window as any).__game.scene.craft.getObjectByName('inspection-fov-volume')))).toBe(true);
 await shot(page,'assembly-visibility-inspection');await clickAction(page,'inspect-off');
 expect(await page.evaluate(()=>(window as any).__game.scene.inspectionKind)).toBeNull();
});

test('English UI persists, preserves custom names, translates live messages and fits 1280x720',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await boot(page);await clickAction(page,'language');
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('[data-action="missions"]')).toHaveText(/New mission/);
 await expect(page.locator('#universe')).toHaveAttribute('aria-label','3D spacecraft and trajectory editor. Right-drag to orbit; scroll to zoom.');
 await start(page,'mars');
 await page.evaluate(()=>{const g=(window as any).__game;const d=g.getState().design;d.name='광학 카메라';g.setDesign(d);});await previewReady(page);
 await expect(page.locator('.scene-title strong')).toHaveText('광학 카메라');
  await expect(page.locator('[data-part="camera"]')).toHaveAttribute('aria-label','Drag to mount Optical camera');
 await clickAction(page,'inspect-power');await expect(page.locator('#inspection-readout')).not.toContainText(/[가-힣]/);await clickAction(page,'inspect-off');
 await clickAction(page,'briefing');await expect(page.locator('.modal')).not.toContainText(/[가-힣]/);await clickAction(page,'close-modal');
 await shot(page,'english-assembly-1280x720');await clickAction(page,'plan');await cameraReady(page);
 await expect(page.locator('[data-action="launch"]')).toHaveText(/Start mission/);await shot(page,'english-mars-plan-1280x720');
 await clickAction(page,'launch');await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(0);await page.keyboard.press('Space');
 await expect(page.locator('#operation-reason')).not.toContainText(/[가-힣]/);
 await expect(page.locator('#flight-state')).not.toContainText(/[가-힣]/);
 await shot(page,'english-live-1280x720');
 await page.evaluate(()=>(window as any).__game.finishFast());
 await expect(page.getByRole('heading',{name:'Mission accomplished'})).toBeVisible();
 const nextAction=await center(page,'[data-action="retry"]');expect(nextAction.y).toBeLessThan(720);expect(nextAction.y).toBeGreaterThan(0);
 expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-action]')?.getAttribute('data-action'),nextAction),'debrief next action must be exposed without scrolling').toBe('retry');
 const actionBounds=await page.locator('[data-action="retry"]').boundingBox(),modalBounds=await page.locator('.modal').boundingBox();
 expect(actionBounds!.y+actionBounds!.height,'the complete next-action button must stay inside the modal viewport').toBeLessThanOrEqual(modalBounds!.y+modalBounds!.height-1);
 await shot(page,'english-result-1280x720');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight)).toBe(false);
 await clickAction(page,'close-modal');await clickAction(page,'save');await expect(page.getByRole('status')).toHaveText('Design and mission state saved in this browser.');
 await page.reload();await page.waitForFunction(()=>Boolean((window as any).__game));await expect(page.locator('html')).toHaveAttribute('lang','en');
 await clickAction(page,'load');await expect(page.locator('.scene-title strong')).toHaveText('광학 카메라');
 await clickAction(page,'language');await expect(page.locator('html')).toHaveAttribute('lang','ko');await expect(page.locator('[data-action="plan"]').first()).toHaveText(/비행 설계/);
});

test('blocked browser storage still permits an exact downloadable JSON backup',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw new DOMException('QA storage blocked','SecurityError');}}}));
 await boot(page);await start(page,'mars');const expected=(await state(page)).design;
 await clickAction(page,'save');await expect(page.getByRole('status')).toContainText('JSON 백업');
 await clickAction(page,'settings');const downloadEvent=page.waitForEvent('download');await clickAction(page,'export');const download=await downloadEvent;
 const path=await download.path();expect(path).toBeTruthy();const backup=JSON.parse(readFileSync(path!,'utf8'));
 expect(backup.format).toBe('orbital-foundry');expect(backup.design).toEqual(expected);
 expect(await download.failure()).toBeNull();await expect(page.getByRole('status')).toHaveText('JSON 백업을 내려받았습니다.');
});

test('rebuilding trajectory labels repeatedly does not accumulate GPU textures',async({page})=>{
 await boot(page);await start(page,'earth');await clickAction(page,'plan');await cameraReady(page);await previewReady(page);
 const measure=()=>page.evaluate(()=>({textures:(window as any).__game.scene.renderer.info.memory.textures,geometries:(window as any).__game.scene.renderer.info.memory.geometries}));
 const baseline=await measure();const samples=[];
 for(let i=0;i<12;i++){
  await clickAction(page,'language');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  samples.push(await measure());
 }
 writeFileSync(join(artifactDir,'trajectory-resource-regression.json'),JSON.stringify({baseline,samples},null,2));
 expect(samples.at(-1)!.textures,'each language change rebuilds the same five orbital labels; old textures must be released').toBeLessThanOrEqual(baseline.textures+1);
 expect(samples.at(-1)!.geometries).toBeLessThanOrEqual(baseline.geometries+1);
});

test('first-design guide faces the requested mount and service bay accepts internal hardware',async({page})=>{
 await boot(page);await start(page,'earth','starter');
 await expect(page.locator('.assembly-guide')).toContainText('−Z');await clickAction(page,'guide-face');await cameraReady(page);
 expect(await page.evaluate(()=>(window as any).__game.scene.camera.position.z)).toBeLessThan(0);
 const rear=await page.evaluate(()=>{const s=(window as any).__game.scene;return s.project(s.craft.position.clone().add({x:0,y:0,z:-.65}));});
 await drag(page,await center(page,'[data-part="camera"]'),rear);await previewReady(page);
 expect((await state(page)).design.parts[0].face).toBe('nz');await expect(page.locator('.assembly-guide')).toContainText('+X');
 await clickAction(page,'bay');expect(await page.evaluate(()=>(window as any).__game.scene.bayOpen)).toBe(true);
 const covers=()=>page.evaluate(()=>{const a:boolean[]=[];(window as any).__game.scene.craft.traverse((o:any)=>{if(o.userData.bayCover)a.push(o.visible);});return a;});
 expect((await covers()).length).toBeGreaterThan(0);expect((await covers()).every(x=>!x)).toBe(true);
 await clickAction(page,'view-top');await cameraReady(page);
 const top=await page.evaluate(()=>{const s=(window as any).__game.scene;return s.project(s.craft.position.clone().add({x:0,y:.8,z:0}));});
 await drag(page,await center(page,'[data-part="battery"]'),top);await previewReady(page);
 expect((await state(page)).design.parts.find((p:any)=>p.kind==='battery')?.face).toBe('py');
 await shot(page,'assembly-internal-bay');await clickAction(page,'plan');await cameraReady(page);expect((await covers()).every(Boolean)).toBe(true);
});

test('planet surface selection changes science requirements and resource graph scrubs the prediction',async({page})=>{
 await boot(page);await start(page,'earth');await clickAction(page,'plan');await cameraReady(page);await previewReady(page);
 const planet=await page.evaluate(()=>{const s=(window as any).__game.scene;return s.project(s.camera.position.clone().set(0,0,0));});
 await clickAction(page,'target-precision');await page.mouse.click(planet.x+20,planet.y-15);await previewReady(page);
 const first=(await state(page)).design.scienceTarget;expect(first.profile).toBe('precision');expect(Math.abs(first.latDeg)).toBeLessThanOrEqual(90);expect(Math.abs(first.lonDeg)).toBeLessThanOrEqual(180);
 await expect(page.locator('.science-counter span')).toHaveText('/ 1');
 await clickAction(page,'target-survey');await page.mouse.click(planet.x+80,planet.y+35);await previewReady(page);
 const second=(await state(page)).design.scienceTarget;expect(second.profile).toBe('survey');expect(second).not.toEqual(first);await expect(page.locator('.science-counter span')).toHaveText('/ 4');
 await clickAction(page,'resources');await expect(page.locator('#resource-graph')).toBeVisible();
 const before=(await state(page)).design,box=await page.locator('#resource-graph').boundingBox();
 await drag(page,{x:box!.x+box!.width*.25,y:box!.y+box!.height/2},{x:box!.x+box!.width*.72,y:box!.y+box!.height/2});
 expect(parseFloat(await page.locator('#time-cursor').evaluate(el=>(el as HTMLElement).style.left))).toBeCloseTo(72,0);
 expect((await state(page)).design).toEqual(before);await shot(page,'earth-target-and-resources');
 await clickAction(page,'target-clear');await previewReady(page);expect((await state(page)).design.scienceTarget).toBeUndefined();
});

test('launch package changes price and injection limits while stowage changes actual visible geometry',async({page})=>{
 await boot(page);await start(page,'earth');
 const budget=async()=>parseFloat(await page.locator('.stat').filter({hasText:'사용 예산'}).locator('.stat-value').innerText());
 const initialCost=await budget();
 const foldingVisibility=()=>page.evaluate(()=>{const s=(window as any).__game.scene;return s.design.parts.filter((p:any)=>['solar','solarLarge','antenna'].includes(p.kind)).map((p:any)=>s.parts.get(p.id).visible);});
 expect((await foldingVisibility()).every(Boolean)).toBe(true);
 const antennaPoint=await page.evaluate(()=>{const g=(window as any).__game;const p=g.getState().design.parts.find((p:any)=>p.kind==='antenna');return g.scene.getPartScreen(p.id);});
 await page.mouse.click(antennaPoint.x,antennaPoint.y);expect(await page.evaluate(()=>(window as any).__game.scene.outline.visible)).toBe(true);
 await clickAction(page,'stow');expect((await foldingVisibility()).every((v:boolean)=>!v)).toBe(true);
 await page.keyboard.press('Escape');expect((await foldingVisibility()).every((v:boolean)=>!v)).toBe(true);
 expect(await page.evaluate(()=>{const s=(window as any).__game.scene;return s.outline.visible||s.rotationRing.visible;})).toBe(false);
 const fairingRadius=()=>page.evaluate(()=>{const s=(window as any).__game.scene;return s.craft.getObjectByName('launch-stow-inspection')?.children[0].geometry.parameters.radiusTop;});
 expect(await fairingRadius()).toBe(1.4);await clickAction(page,'launch-packages');await page.locator('[data-package="heavy"]').click();await previewReady(page);
 expect((await state(page)).design.launchPackageId).toBe('heavy');expect(await budget()).toBe(initialCost+74);expect(await fairingRadius()).toBe(1.9);
 await shot(page,'assembly-launch-stowage');await clickAction(page,'stow');expect((await foldingVisibility()).every(Boolean)).toBe(true);expect(await fairingRadius()).toBeUndefined();
 await clickAction(page,'plan');await clickAction(page,'advanced');await page.locator('#plan-altitudeKm').focus();await page.keyboard.press('End');await clickAction(page,'close-modal');await previewReady(page);
 expect((await state(page)).design.plan.altitudeKm).toBe(1500);await expect(page.locator('[data-action="launch"]')).toBeEnabled();
 await clickAction(page,'build');await cameraReady(page);await clickAction(page,'stow');await clickAction(page,'launch-packages');await page.locator('[data-package="rideshare"]').click();await previewReady(page);
 expect(await budget()).toBe(initialCost);await clickAction(page,'plan');await previewReady(page);
 await expect(page.locator('[data-action="launch"]')).toBeDisabled();await expect(page.locator('.warning.error').filter({hasText:'500~700 km'})).toHaveCount(1);
 await clickAction(page,'language');await expect(page.locator('.warning.error').filter({hasText:'Rideshare injection supports initial altitude 500–700 km.'})).toHaveCount(1);
});

test('spacecraft render position changes continuously between slow UI telemetry refreshes',async({page})=>{
 await boot(page);await start(page,'mars');await clickAction(page,'plan');await previewReady(page);await clickAction(page,'launch');
 await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(0);
 const motion=await page.evaluate(async()=>{const s=(window as any).__game.scene;const positions:number[][]=[];for(let i=0;i<65;i++){await new Promise(resolve=>requestAnimationFrame(resolve));positions.push(s.craft.position.toArray());}let changed=0;for(let i=1;i<positions.length;i++)if(Math.hypot(...positions[i].map((x,j)=>x-positions[i-1][j]))>1e-10)changed++;return {samples:positions.length,changed,first:positions[0],last:positions.at(-1)};});
 expect(motion.changed,'flight position should update each render, not only every180ms with the UI').toBeGreaterThan(50);
 writeFileSync(join(artifactDir,'continuous-flight-motion.json'),JSON.stringify(motion,null,2));
 await page.keyboard.press('Space');expect((await state(page)).playing).toBe(false);
});

