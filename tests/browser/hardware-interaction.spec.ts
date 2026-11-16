import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {installNativeDeletionAudit} from './native-gl-audit';
const output=join(process.cwd(),'tests/browser/artifacts/hardware-interaction',process.env.PLAYWRIGHT_QA_CANDIDATE||'');mkdirSync(output,{recursive:true});
const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
  await installNativeDeletionAudit(page);
  const errors:string[]=[],warnings:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  await use(errors);const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null),graphicsFailures=warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w));
  const status=info.status==='passed'&&(errors.length||graphicsFailures.length||!native?.contexts?.length||native?.errors?.length)?'failed':info.status;
  writeFileSync(join(output,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify({title:info.title,status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),workers:page.workers().map(w=>w.url()),scripts:await page.locator('script[src]').evaluateAll(s=>s.map(e=>(e as HTMLScriptElement).src)),errors,warnings,native},null,2));
  expect(errors).toEqual([]);expect(graphicsFailures).toEqual([]);expect(native).not.toBeNull();expect(native?.contexts?.length??0).toBeGreaterThan(0);expect(native?.errors??[]).toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720}});
async function boot(page:Page){await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));}
async function state(page:Page){return page.evaluate(()=>(window as any).__game.getState());}
async function camera(page:Page){await page.waitForFunction(()=>!(window as any).__game.scene.tween);}
async function drag(page:Page,a:{x:number;y:number},b:{x:number;y:number}){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:16});await page.mouse.up();}
async function action(page:Page,name:string){await page.locator(`[data-action="${name}"]`).first().click();}
async function transferState(page:Page){return page.evaluate(()=>(window as any).__game.transfer()?.getState());}
async function transferReady(page:Page){await page.waitForFunction(()=>{const s=(window as any).__game.transfer()?.getState();return s&&!s.pending;},null,{timeout:45000});}

test('all sixteen model cards place their own physical meshes through real pointer drags',async({page})=>{
  test.setTimeout(120000);await boot(page);await action(page,'missions');await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await camera(page);
  const models=[['tsp45-fixed-v2','pz'],['tsp45-sixwing-v2','pz'],['bpx100-4s2p-v2','py'],['bpx100-dual-v2','py'],['wide-mono-v2','pz'],['narrow-mono-v2','pz'],['mars-spectra-v2','pz'],['ax100u-carrier-v1','py'],['iris22-carrier-v1','py'],['uhf-dipole-pair-v1','pz'],['xband-reflector-1m-v1','pz'],['xact15-carrier-v1','py'],['xact50-carrier-v1','py'],['chemical230-v2','ny'],['recorder-1p6-v2','py'],['recorder-8-v2','py']];
  const placed=[];
  for(const [modelId,face] of models){
    // Empty fixture isolates each model's actual palette/ghost/commit path;
    // this is not a claim that all sixteen fit in one valid spacecraft.
    await page.evaluate(face=>{const g=(window as any).__game,d=structuredClone(g.getState().design);d.parts=[];d.busId='pathfinder-d35-v1';g.setDesign(d);g.scene.viewMount(face);},face);await camera(page);
    await page.locator('[data-category="all"]').click();
    const card=page.locator(`[data-model="${modelId}"]`);await card.scrollIntoViewIfNeeded();const b=await card.boundingBox();expect(b).toBeTruthy();
    const point=await page.evaluate(face=>{const s=(window as any).__game.scene;return s.project(s.craft.position.clone().add({x:0,y:face==='py'?.8:face==='ny'?-.8:-.25,z:face==='pz'?.65:0}));},face);
    expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,point),modelId+' drop surface visible').toBe('universe');
    await drag(page,{x:b!.x+b!.width/2,y:b!.y+b!.height/2},point);await expect.poll(async()=>(await state(page)).design.parts.length,{message:modelId+' commits'}).toBe(1);
    const p=(await state(page)).design.parts[0];expect(p.modelId).toBe(modelId);expect(p.face).toBe(face);
    const rendered=await page.evaluate(id=>(window as any).__game.scene.parts.get(id).userData.hardwareModelId,p.id);expect(rendered).toBe(modelId);placed.push({modelId,face,rendered});
  }
  writeFileSync(join(output,'sixteen-actual-drags.json'),JSON.stringify({placed},null,2));
});

test('hardware card drag keeps model identity and real-scale focus through bus change and undo',async({page})=>{
  await boot(page);await action(page,'missions');await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await camera(page);
  expect((await state(page)).design.hardwareVersion).toBe('hardware-2.0.0');
  await action(page,'view-top');await camera(page);await page.locator('[data-category="systems"]').click();
  const radioCard=page.locator('[data-model="ax100u-carrier-v1"]');await radioCard.scrollIntoViewIfNeeded();const box=await radioCard.boundingBox();expect(box).toBeTruthy();
  const target=await page.evaluate(()=>{const s=(window as any).__game.scene;return s.project(s.craft.position.clone().add({x:-.22,y:.8,z:-.20}));});
  expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,target)).toBe('universe');
  await drag(page,{x:box!.x+box!.width/2,y:box!.y+box!.height/2},target);
  await expect.poll(async()=>(await state(page)).design.parts.length).toBe(1);
  const original=(await state(page)).design.parts[0];expect(original.modelId).toBe('ax100u-carrier-v1');expect(original.face).toBe('py');
  await page.keyboard.press('f');await camera(page);
  const focused=await page.evaluate(()=>{const s=(window as any).__game.scene;return {distance:s.controls.getDistance(),bayOpen:s.bayOpen,modelKey:s.parts.get(s.selection).userData.modelKey};});
  expect(focused.distance).toBeLessThan(1);expect(focused.bayOpen).toBe(true);expect(focused.modelKey).toContain(original.modelId);
  await page.screenshot({path:join(output,'radio-focused-1280.png')});
  await action(page,'hardware-buses');await page.locator('[data-hardware-bus="pathfinder-d35-v1"]').click();
  expect((await state(page)).design.busId).toBe('pathfinder-d35-v1');expect((await state(page)).design.parts[0]).toEqual(original);
  expect(await page.evaluate(()=>(window as any).__game.scene.bus.userData.hardwareBusId)).toBe('pathfinder-d35-v1');
  await page.keyboard.press('Control+z');expect((await state(page)).design.busId).toBe('surveyor-l18-v1');expect((await state(page)).design.parts[0]).toEqual(original);
  expect(await page.evaluate(()=>(window as any).__game.scene.selection)).toBeNull();
  await page.keyboard.press('Control+y');expect((await state(page)).design.busId).toBe('pathfinder-d35-v1');
  expect(await page.evaluate(()=>(window as any).__game.scene.selection)).toBeNull();
  await page.evaluate(()=>(window as any).__game.scene.focusCraft());await camera(page);
  expect(await page.evaluate(()=>(window as any).__game.scene.controls.minDistance)).toBe(2.5);
  await action(page,'view-top');await camera(page);
  const before=await page.evaluate(id=>(window as any).__game.scene.getPartScreen(id),original.id);
  await page.mouse.dblclick(before.x,before.y);await camera(page);
  expect(await page.evaluate(()=>(window as any).__game.scene.controls.getDistance())).toBeLessThan(1);
});

test('hardware Earth planning renders the physical camera footprint and hardware precision region',async({page})=>{
  test.setTimeout(90000);await boot(page);await action(page,'missions');await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await camera(page);await action(page,'preset-balanced');await camera(page);
  await page.waitForFunction(()=>!(window as any).__game.getState().pending);
  await page.screenshot({path:join(output,'closed-hatch-balanced-1280.png')});
  await page.evaluate(()=>{const g=(window as any).__game,d=structuredClone(g.getState().design);d.scienceTarget={profile:'precision',latDeg:36,lonDeg:44};g.setDesign(d);});
  await action(page,'plan');
  const evidence=[];
  for(const [modelId,half] of [['wide-mono-v2',12],['narrow-mono-v2',4]] as const){
    await page.evaluate(modelId=>{const g=(window as any).__game,d=structuredClone(g.getState().design);d.parts.find((p:any)=>p.kind==='camera').modelId=modelId;g.setDesign(d);},modelId);
    await page.waitForFunction(half=>{const g=(window as any).__game;return !g.getState().pending&&g.scene.footprint?.userData.halfFovDeg===half;},half,{timeout:45000});
    const result=await page.evaluate(()=>{const s=(window as any).__game.scene,footprint=s.footprint,region=s.groundFeatures.children.find((o:any)=>o.name==='science-target-region');return {fov:footprint.userData.halfFovDeg,tooltip:footprint.userData.tooltip,footprintRadiusKm:footprint.userData.regionRadiusKm,regionRadiusKm:region.userData.regionRadiusKm,altitudeKm:footprint.userData.altitudeKm};});
    expect(result.fov).toBe(half);expect(result.tooltip).toContain(half+'°');expect(result.regionRadiusKm).toBe(10);
    const radius=6378.137,alpha=half*Math.PI/180,expected=(Math.asin((radius+result.altitudeKm)/radius*Math.sin(alpha))-alpha)*radius;
    expect(result.footprintRadiusKm).toBeCloseTo(expected,5);evidence.push({modelId,...result});
    await page.screenshot({path:join(output,`earth-reference-${half}deg-1280.png`)});
  }
  expect(evidence[0].footprintRadiusKm).toBeGreaterThan(evidence[1].footprintRadiusKm);
  await page.evaluate(()=>{const g=(window as any).__game,d=structuredClone(g.getState().design);d.parts=d.parts.filter((p:any)=>p.kind!=='camera');g.setDesign(d);});
  await page.waitForFunction(()=>{const g=(window as any).__game;return !g.getState().pending&&!g.scene.footprint;},null,{timeout:45000});
  writeFileSync(join(output,'physical-earth-reference.json'),JSON.stringify(evidence,null,2));
});

test('same instance model replacement rebuilds mesh and duplicate preserves the chosen hardware model',async({page})=>{
  await boot(page);await action(page,'missions');await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await camera(page);await action(page,'preset-balanced');await camera(page);
  const initial=await state(page),radio=initial.design.parts.find((p:any)=>p.kind==='radio');expect(radio).toBeTruthy();
  const oldModel=await page.evaluate(id=>(window as any).__game.scene.parts.get(id).uuid,radio.id);
  // A validated design replacement is the same path used by undo/import; this
  // regression specifically targets stale render caching on unchanged instance IDs.
  await page.evaluate(id=>{const game=(window as any).__game,d=structuredClone(game.getState().design);d.busId='pathfinder-d35-v1';d.parts.find((p:any)=>p.id===id).modelId='iris22-carrier-v1';game.setDesign(d);},radio.id);
  expect(await page.evaluate(id=>(window as any).__game.scene.parts.get(id).uuid,radio.id)).not.toBe(oldModel);
  expect(await page.evaluate(id=>(window as any).__game.scene.parts.get(id).userData.hardwareModelId,radio.id)).toBe('iris22-carrier-v1');
  await page.evaluate(id=>{const s=(window as any).__game.scene;s.setSelected(id);s.cb.select(id);},radio.id);
  await action(page,'duplicate');
  expect(await page.evaluate(()=>(window as any).__game.scene.ghostPart.modelId)).toBe('iris22-carrier-v1');
  await page.keyboard.press('Escape');expect(await page.evaluate(()=>(window as any).__game.scene.ghost)).toBeNull();
  expect((await state(page)).design.parts.length).toBe(initial.design.parts.length);
  await page.keyboard.press('f');await camera(page);await page.screenshot({path:join(output,'iris-model-swap-1280.png')});
});

test('Mars encounter handles commit physical altitude and plane edits while Escape and pending state preserve the accepted plan',async({page})=>{
  test.setTimeout(120000);await boot(page);await action(page,'missions');await action(page,'mission-transfer');await action(page,'plan');await transferReady(page);
  await page.locator('[data-transfer-action="view-mars"]').click();
  const initial=(await transferState(page)).plan;
  const handles=await page.evaluate(()=>{const s=(window as any).__game.transfer().scene;return {altitude:s.getEncounterHandleScreen('altitude'),angle:s.getEncounterHandleScreen('angle')};});
  for(const handle of Object.values(handles) as any[]){expect(handle?.visible).toBe(true);expect(await page.evaluate((p:any)=>document.elementFromPoint(p.x,p.y)?.id,handle)).toBe('transfer-universe');}
  await drag(page,handles.altitude,{x:handles.altitude.x+40,y:handles.altitude.y-16});
  await expect.poll(async()=>(await transferState(page)).plan.marsPeriapsisAltitudeKm).not.toBe(initial.marsPeriapsisAltitudeKm);await transferReady(page);
  const afterAltitude=(await transferState(page)).plan;
  expect(afterAltitude.marsPeriapsisAltitudeKm).toBeGreaterThanOrEqual(250);expect(afterAltitude.marsPeriapsisAltitudeKm).toBeLessThanOrEqual(10000);
  const angle=await page.evaluate(()=>(window as any).__game.transfer().scene.getEncounterHandleScreen('angle'));
  await drag(page,angle,{x:angle.x+35,y:angle.y+40});await expect.poll(async()=>(await transferState(page)).plan.marsBPlaneAngleRad).not.toBe(afterAltitude.marsBPlaneAngleRad);await transferReady(page);
  const accepted=structuredClone((await transferState(page)).plan),alt=await page.evaluate(()=>(window as any).__game.transfer().scene.getEncounterHandleScreen('altitude'));
  await page.mouse.move(alt.x,alt.y);await page.mouse.down();await page.mouse.move(alt.x-35,alt.y+20,{steps:12});await page.keyboard.press('Escape');await page.mouse.up();
  expect((await transferState(page)).plan).toEqual(accepted);
  expect(await page.evaluate(()=>(window as any).__game.transfer().scene.ghost.visible)).toBe(false);
  await page.evaluate(()=>(window as any).__game.transfer().scene.setPlanningPending(true));
  expect(await page.evaluate(()=>(window as any).__game.transfer().scene.getEncounterHandleScreen())).toBeNull();
  await expect(page.locator('.transfer-scene-legend')).toContainText('이전 승인 경로');
  const opacity=await page.evaluate(()=>{const s=(window as any).__game.transfer().scene;return s.pathGroup.children[0].material.opacity;});expect(opacity).toBeLessThan(.3);
  await page.evaluate(()=>(window as any).__game.transfer().scene.setView('earth'));
  expect(await page.evaluate(()=>(window as any).__game.transfer().scene.pathGroup.children[0].material.opacity)).toBeLessThan(.3);
  await page.evaluate(()=>{const s=(window as any).__game.transfer().scene;s.setPlanningPending(false);s.setView('mars');});
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
  const visibility=await page.evaluate(()=>{const s=(window as any).__game.transfer().scene,r=s.legend.getBoundingClientRect();return {legend:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},handles:['altitude','angle'].map(axis=>({axis,...s.getEncounterHandleScreen(axis)}))};});
  for(const h of visibility.handles)expect(h.x+30<visibility.legend.left||h.x-30>visibility.legend.right||h.y+30<visibility.legend.top||h.y-30>visibility.legend.bottom,h.axis+' grip remains outside explanatory legend').toBe(true);
  await page.screenshot({path:join(output,'mars-approach-handles-1280.png')});
  expect((await transferState(page)).plan).toEqual(accepted);
});

