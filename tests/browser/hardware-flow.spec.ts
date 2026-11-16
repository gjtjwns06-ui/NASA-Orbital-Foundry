import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifacts=join(process.cwd(),'tests/browser/artifacts/hardware-flow');mkdirSync(artifacts,{recursive:true});
const test=base.extend<{logs:string[]}>({logs:[async({page},use,info)=>{
  const logs:string[]=[];page.on('pageerror',e=>logs.push(e.stack||e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('favicon.ico'))logs.push(m.text());});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))logs.push(`${r.status()} ${r.url()}`);});
  await use(logs);
  const record={test:info.title,status:info.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors:logs,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url())};
  writeFileSync(join(artifacts,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify(record,null,2));
  await info.attach('hardware-browser-evidence',{body:JSON.stringify(record,null,2),contentType:'application/json'});
  if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
  expect(logs,'No unhandled browser errors or failed application resources').toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());
const transfer=(page:Page)=>page.evaluate(()=>(window as any).__game.transfer()?.getState());
async function action(page:Page,name:string){await page.locator(`[data-action="${name}"]`).first().click();}
async function ta(page:Page,name:string){await page.locator(`[data-transfer-action="${name}"]`).first().click();}
async function boot(page:Page,english=false){if(english)await page.addInitScript(()=>localStorage.setItem('orbital-language','en'));await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});}
async function ready(page:Page){await page.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return !s.pending&&s.revision===s.acceptedRevision&&!g.scene.tween;},null,{timeout:30000});}
async function transferReady(page:Page){await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return Boolean(t)&&!t.getState().pending&&!t.dirty;},null,{timeout:45000});}
async function startUI(page:Page,mission:'earth'|'mars'|'transfer',hardware=true){
  await action(page,'missions');await page.locator(`[data-design-profile="${hardware?'hardware':'legacy'}"]`).click();
  if(mission==='transfer')await action(page,'mission-transfer');else await page.locator(`[data-mission="${mission}"]`).click();
  await ready(page);
}
async function pickBus(page:Page,id:string){await action(page,'hardware-buses');await page.locator(`[data-hardware-bus="${id}"]`).click();await ready(page);}
async function shot(page:Page,name:string){await page.screenshot({path:join(artifacts,name+'.png'),fullPage:true});}
async function savedSlot(page:Page,hardware:boolean){return page.evaluate(async hardware=>await new Promise<any>((resolve,reject)=>{
  const request=indexedDB.open('orbital-foundry',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('saves')){db.close();resolve(null);return;}const get=db.transaction('saves','readonly').objectStore('saves').get(hardware?'autosave:hardware-2.0.0':'autosave');get.onerror=()=>{db.close();reject(get.error);};get.onsuccess=()=>{db.close();resolve(get.result?JSON.parse(get.result):null);};};
}),hardware);}
async function savedTransferHardware(page:Page){return page.evaluate(async()=>await new Promise<any>((resolve,reject)=>{
  const request=indexedDB.open('orbital-foundry-journey',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('saves')){db.close();resolve(null);return;}const get=db.transaction('saves','readonly').objectStore('saves').get('autosave:hardware-2.0.0');get.onerror=()=>{db.close();reject(get.error);};get.onsuccess=()=>{db.close();resolve(get.result?JSON.parse(get.result):null);};};
}));}
async function transferTools(page:Page){const details=page.locator('.transfer-save-tools');if(await details.getAttribute('open')===null)await details.locator('summary').click();}
async function assemblyJSON(page:Page){
  await action(page,'settings');const pending=page.waitForEvent('download');await action(page,'export');const download=await pending;
  expect(await download.failure()).toBeNull();const path=await download.path();expect(path).toBeTruthy();const data=JSON.parse(readFileSync(path!,'utf8'));
  await action(page,'close-modal');return data;
}

test('systems-design mission entry exposes sixteen models and bus changes preserve installed hardware through undo',async({page})=>{
  await boot(page);await startUI(page,'earth');
  const empty=await state(page);expect(empty.design.hardwareVersion).toBe('hardware-2.0.0');expect(empty.design.parts).toEqual([]);
  await expect(page.locator('.part-card[data-model]')).toHaveCount(16);
  const cards=await page.locator('.part-card[data-model]').evaluateAll(es=>es.map(e=>(e as HTMLElement).dataset.model));expect(new Set(cards).size).toBe(16);
  expect(await page.locator('.stats-deck').innerText()).not.toMatch(/NaN|Infinity/);
  for(const key of ['score','resourceScore','energyMinimumWh','budgetRemaining'])expect(Number.isFinite(empty.preview[key]),key).toBe(true);
  await action(page,'plan');await ready(page);await action(page,'resources');await expect(page.locator('#resource-graph')).toBeVisible();
  const graph=await page.locator('#resource-graph').evaluate(el=>el.outerHTML);expect(graph).not.toMatch(/NaN|Infinity/);
  expect(await page.locator('#resource-graph path').count()).toBeGreaterThanOrEqual(3);await action(page,'resources');await action(page,'build');await ready(page);
  await action(page,'preset-balanced');await ready(page);const baseline=await state(page);expect(baseline.design.parts.length).toBeGreaterThan(6);expect(baseline.design.parts.every((p:any)=>p.modelId)).toBe(true);
  await pickBus(page,'pathfinder-d35-v1');const changed=await state(page);expect(changed.design.busId).toBe('pathfinder-d35-v1');expect(changed.design.parts).toEqual(baseline.design.parts);
  await page.keyboard.press('Control+z');await ready(page);expect((await state(page)).design).toEqual(baseline.design);
  await action(page,'hardware-connections');await expect(page.locator('.hardware-connections')).toBeVisible();
  const unchanged=(await state(page)).design;await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('.modal')))).toBe(true);
  await page.keyboard.press('Delete');await page.keyboard.press('r');expect((await state(page)).design).toEqual(unchanged);
  await page.keyboard.press('Escape');await expect(page.locator('.modal')).toHaveCount(0);
  await shot(page,'sixteen-models-balanced-bus-1280x720');
});

test('hardware and legacy drafts save to separate slots and each real campus continue restores its own models',async({page})=>{
  await boot(page);await startUI(page,'earth',false);await action(page,'preset-balanced');await ready(page);
  const legacy=(await state(page)).design;await action(page,'save');
  await expect.poll(async()=>(await savedSlot(page,false))?.design).toEqual(legacy);
  await action(page,'home');await startUI(page,'earth',true);await action(page,'preset-balanced');await ready(page);
  const hardware=(await state(page)).design;await action(page,'save');
  await expect.poll(async()=>(await savedSlot(page,true))?.design).toEqual(hardware);
  expect((await savedSlot(page,false)).design).toEqual(legacy);
  expect((await savedSlot(page,true)).modelVersion).toBe('2.0.0');
  expect((await savedSlot(page,true)).hardwareCatalogHash).not.toContain('draft');
  await page.reload();await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
  await expect(page.locator('[data-action="load-hardware"]')).toBeVisible();await action(page,'load-hardware');await ready(page);
  expect((await state(page)).design).toEqual(hardware);await action(page,'home');await action(page,'load');await ready(page);
  expect((await state(page)).design).toEqual(legacy);expect((await state(page)).design.hardwareVersion).toBeUndefined();
  expect((await savedSlot(page,true)).design).toEqual(hardware);await shot(page,'legacy-restored-hardware-slot-preserved');
});

test('a real bus change and pointer-replaced antenna repair incompatible radio ports and restore the launch gate',async({page})=>{
  await boot(page,true);await startUI(page,'earth');await action(page,'preset-balanced');await ready(page);
  // Set up a known broken component choice only. Every subsequent repair is UI
  // driven, and the real compatibility/preview workers decide launch readiness.
  await page.evaluate(()=>{const g=(window as any).__game,d=g.getState().design;d.parts.find((p:any)=>p.kind==='radio').modelId='iris22-carrier-v1';g.setDesign(d);});await ready(page);
  await action(page,'hardware-connections');await expect(page.locator('.modal')).toContainText('peak demand');await expect(page.locator('.modal')).toContainText('Required 35 / available 15');
  await expect(page.locator('.modal')).toContainText('data interface or driver');await expect(page.locator('.modal')).not.toContainText(/[가-힣]/);await action(page,'close-modal');
  await action(page,'plan');await ready(page);await expect(page.locator('[data-action="launch"]')).toBeDisabled();await action(page,'build');await ready(page);
  const beforeBus=(await state(page)).design;await pickBus(page,'pathfinder-d35-v1');expect((await state(page)).design.parts).toEqual(beforeBus.parts);
  await action(page,'hardware-connections');await expect(page.locator('.modal')).not.toContainText('peak demand');await expect(page.locator('.modal')).toContainText('same frequency band');await action(page,'close-modal');
  await action(page,'view-front');await ready(page);
  const antenna=(await state(page)).design.parts.find((p:any)=>p.kind==='antenna');
  const oldPoint=await page.evaluate(id=>(window as any).__game.scene.getPartScreen(id),antenna.id);await page.mouse.click(oldPoint.x,oldPoint.y);await action(page,'delete');await ready(page);
  expect((await state(page)).design.parts.some((p:any)=>p.kind==='antenna')).toBe(false);
  const card=page.locator('[data-model="xband-reflector-1m-v1"]');await card.scrollIntoViewIfNeeded();const shelf=await card.boundingBox();expect(shelf).toBeTruthy();
  const target=await page.evaluate(()=>{const s=(window as any).__game.scene;return s.project(s.craft.position.clone().add({x:0,y:0,z:.65}));});
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,target)).toBe('universe');
  await page.mouse.move(shelf!.x+shelf!.width/2,shelf!.y+shelf!.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:18});await page.mouse.up();
  await expect.poll(async()=>(await state(page)).design.parts.find((p:any)=>p.kind==='antenna')?.modelId).toBe('xband-reflector-1m-v1');await ready(page);
  await action(page,'hardware-connections');await expect(page.locator('.modal')).not.toContainText('same frequency band');
  const radio=page.locator('[data-hardware-focus="radio-1"]').locator('..').locator('..');await expect(radio).toHaveClass('hardware-connection connected');await expect(radio).toContainText('RF');await action(page,'close-modal');
  await action(page,'plan');await ready(page);await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  expect((await state(page)).design.parts.find((p:any)=>p.kind==='radio').modelId).toBe('iris22-carrier-v1');await shot(page,'real-radio-antenna-repair-ready');
});

test('English hardware M03 completes real escape cruise encounter reception and replays its versioned JSON checkpoint',async({page})=>{
  test.setTimeout(210000);await boot(page,true);await startUI(page,'transfer');
  expect((await state(page)).design.hardwareVersion).toBe('hardware-2.0.0');await action(page,'plan');await transferReady(page);
  let s=await transfer(page);expect(s.craft.hardwareVersion).toBe('hardware-2.0.0');expect(s.evaluation.launchable).toBe(true);expect(s.preview.status).toBe('success');
  await expect(page.locator('[data-transfer-action="launch"]')).toBeEnabled();expect(await page.locator('#transfer-experience').innerText()).not.toMatch(/[가-힣]/);
  await ta(page,'launch');await page.waitForFunction(()=>Boolean((window as any).__game.transfer()?.getState().runtime));
  expect((await transfer(page)).runtime.modelVersion).toBe('transfer-2.0.0');
  const next=async()=>{const time=(await transfer(page)).runtime.time;await ta(page,'next');await expect.poll(async()=>{const t=await transfer(page);return t.runtime.time>time&&!t.playing;},{timeout:60000}).toBe(true);};
  await next();s=await transfer(page);expect(s.telemetry.environment.state.phase).toBe('solar-coast');expect(s.runtime.fuelKg).toBe(6);
  await next();s=await transfer(page);expect(s.telemetry.environment.state.phase).toBe('mars-flyby');await ta(page,'view-mars');
  await next();await shot(page,'hardware-mars-encounter-1280x720');await next();s=await transfer(page);
  expect(s.runtime.status).toBe('complete');expect(s.result.status).toBe('success');expect(s.runtime.scienceReceived).toBeGreaterThanOrEqual(3);
  expect(s.view,'Terminal state shows the real solar-system overview').toBe('solar');expect(s.runtime.time).toBe(s.solution.durationSeconds);
  for(const code of ['EARTH_EXIT','MARS_ENTRY','PERIAPSIS','MARS_EXIT','SCIENCE_CAPTURED','DATA_RECEIVED'])expect(s.runtime.events.some((e:any)=>e.code===code),code).toBe(true);
  expect(s.runtime.packets.every((p:any)=>p.receivedAt===null||p.receivedAt>p.capturedAt)).toBe(true);
  await page.getByText('Mission log',{exact:true}).click();expect(await page.locator('#transfer-experience').innerText()).not.toMatch(/[가-힣]/);
  expect(s.runtime.events.some((e:any)=>/[가-힣]/.test(e.message))).toBe(true);
  await transferTools(page);const pending=page.waitForEvent('download');await ta(page,'export');const download=await pending;
  expect(await download.failure()).toBeNull();const path=await download.path();expect(path).toBeTruthy();const backup=JSON.parse(readFileSync(path!,'utf8'));
  expect(backup.modelVersion).toBe('transfer-2.0.0');expect(backup.hardwareCatalogHash).not.toContain('draft');expect(backup.craft).toEqual(s.runtime.craft);expect(backup.runtime.hardwareData).toEqual(s.runtime.hardwareData);
  const checkpoint=structuredClone(s.runtime),priorRequest=await page.evaluate(()=>(window as any).__game.transfer().requestId);
  await page.locator('.transfer-import').setInputFiles({name:'hardware-m03-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.waitForFunction(id=>{const t=(window as any).__game.transfer();return t.requestId>id&&!t.pending&&!t.busy&&t.runtime?.status==='complete';},priorRequest,{timeout:45000});
  const restored=await transfer(page);expect(restored.runtime).toEqual(checkpoint);expect(restored.view).toBe('solar');expect(restored.runtime.time).toBe(restored.solution.durationSeconds);await shot(page,'hardware-m03-received-replayed-1280x720');
  writeFileSync(join(artifacts,'real-hardware-transfer-result.json'),JSON.stringify({result:s.result,model:s.runtime.modelVersion,hash:backup.hardwareCatalogHash,packets:s.runtime.packets,events:s.runtime.events},null,2));
});

test('M03 custom dates and dragged schedule undo atomically with presets and an old Earth diagnostic cannot leak into its restored editor',async({page})=>{
  test.setTimeout(240000);await boot(page);await startUI(page,'transfer');await action(page,'plan');await transferReady(page);
  await page.locator('[data-transfer-date="departure"]').fill('2026-11-16');
  // Native date controls have multiple keyboard segments; a single Tab does
  // not necessarily leave the input. Blur by clicking the actual heading so
  // the UI's intentional active-input protection can flush the new preview.
  await page.getByRole('heading',{name:'두 행성을 잇는 궤적',exact:true}).click();await transferReady(page);
  const dated=await transfer(page),block=page.locator('[data-transfer-op="encounter-science"]'),bounds=await block.boundingBox();expect(bounds).toBeTruthy();
  await page.mouse.move(bounds!.x+bounds!.width*.45,bounds!.y+bounds!.height/2);await page.mouse.down();await page.mouse.move(bounds!.x+bounds!.width*.45-14,bounds!.y+bounds!.height/2,{steps:12});await page.mouse.up();
  await transferReady(page);const custom=await transfer(page);
  expect(custom.plan.operations.find((o:any)=>o.id==='encounter-science').start).toBeLessThan(dated.plan.operations.find((o:any)=>o.id==='encounter-science').start);
  await ta(page,'edit');await expect(page.locator('#transfer-experience')).toHaveCount(0);await ready(page);
  // Deliberately choose a different bus through the real picker. Its connection
  // limits may block this draft; this is an undo/save test, not a successful run.
  await pickBus(page,'surveyor-l18-v1');
  const original=(await state(page)).design;expect((await assemblyJSON(page)).plan).toEqual(custom.plan);
  await action(page,'preset-balanced');await ready(page);const alternate=(await state(page)).design,alternateJSON=await assemblyJSON(page);
  expect(alternate).not.toEqual(original);expect(alternateJSON.plan).not.toEqual(custom.plan);
  await page.keyboard.press('Control+z');await ready(page);expect((await state(page)).design).toEqual(original);expect((await assemblyJSON(page)).plan).toEqual(custom.plan);
  await page.keyboard.press('Control+Shift+z');await ready(page);expect((await state(page)).design).toEqual(alternate);expect((await assemblyJSON(page)).plan).toEqual(alternateJSON.plan);
  await page.keyboard.press('Control+z');await ready(page);await action(page,'plan');await transferReady(page);
  expect((await transfer(page)).plan).toEqual(custom.plan);await ta(page,'exit');await expect(page.locator('#transfer-experience')).toHaveCount(0);
  // A newly opened planning view must flush the assembly's latest undo even
  // when no additional edit happened inside that view before exiting.
  await expect.poll(async()=>(await savedTransferHardware(page))?.plan).toEqual(custom.plan);
  expect((await savedTransferHardware(page)).craft.busId).toBe(original.busId);
  // Create a real partial Earth result and open one of its diagnostic targets.
  // Only the initial missing-antenna choice uses QA state setup.
  await startUI(page,'earth',false);await action(page,'preset-balanced');await ready(page);
  await page.evaluate(()=>{const g=(window as any).__game,d=g.getState().design;d.parts=d.parts.filter((p:any)=>p.kind!=='antenna');g.setDesign(d);});await ready(page);
  await action(page,'plan');await ready(page);await action(page,'launch');await expect(page.locator('#flight-time')).toBeVisible();await page.locator('[data-speed="600"]').click();
  await page.waitForFunction(()=>(window as any).__game.getState().sim.time>=900,null,{timeout:15000});if((await state(page)).playing)await page.keyboard.press('Space');
  await action(page,'finish');await page.locator('[data-diagnostic="MISSING_ANTENNA"] [data-debrief-action]').first().click();await ready(page);
  await expect(page.locator('.review-context')).toBeVisible();expect((await state(page)).previousResult.design.missionId).toBe('earth');
  expect((await savedTransferHardware(page)).plan).toEqual(custom.plan);
  await action(page,'home');await action(page,'load-transfer-hardware');await transferReady(page);expect((await transfer(page)).plan).toEqual(custom.plan);
  await ta(page,'edit');await expect(page.locator('#transfer-experience')).toHaveCount(0);await ready(page);
  const current=await state(page);expect(current.design.hardwareVersion).toBe('hardware-2.0.0');expect(current.reviewContext).toBeNull();expect(current.debrief).toBeNull();expect(current.previousResult).toBeNull();
  await expect(page.locator('.review-context')).toHaveCount(0);expect((await assemblyJSON(page)).plan).toEqual(custom.plan);
  await shot(page,'transfer-undo-and-clean-diagnostic-context');
});

test('both hardware region examples render their physical extent and complete real precision and four-cell survey reception',async({page})=>{
  test.setTimeout(150000);await boot(page,true);await startUI(page,'earth');
  const records:any[]=[];
  for(const profile of ['precision','survey'] as const){
    const expected=profile==='precision'?{radius:10,packets:1,pixels:1024}:{radius:1400,packets:4,pixels:512};
    const examples=page.locator('.region-design-examples');await expect(examples).toBeVisible();if(await examples.getAttribute('open')===null)await examples.locator('summary').click();
    await action(page,`preset-region-${profile}`);await ready(page);const design=(await state(page)).design;
    expect(design.scienceTarget.profile).toBe(profile);expect(design.parts.find((p:any)=>p.kind==='camera').modelId).toBe('narrow-mono-v2');
    await action(page,'plan');await ready(page);await expect(page.locator('.target-tools')).toContainText(`${expected.radius} km`);
    const region=await page.evaluate(()=>{const scene=(window as any).__game.scene,group=scene.groundFeatures.getObjectByName('science-target-region'),boundary=group?.getObjectByName('target-boundary-solid'),p=boundary?.geometry.getAttribute('position');return group&&p?{metadata:group.userData,actualRadiusKm:Math.acos(p.getY(0)/Math.hypot(p.getX(0),p.getY(0),p.getZ(0)))*6378.137,points:p.count}:null;});
    expect(region).toBeTruthy();expect(region!.metadata.regionRadiusKm).toBe(expected.radius);expect(region!.actualRadiusKm).toBeCloseTo(expected.radius,2);expect(region!.points).toBeGreaterThan(32);
    expect((await state(page)).preview.required).toBe(expected.packets);await expect(page.locator('[data-action="launch"]')).toBeEnabled();await shot(page,`${profile}-physical-region-plan`);
    await action(page,'launch');await expect(page.locator('#flight-time')).toBeVisible();await page.locator('[data-speed="600"]').click();
    await page.waitForFunction(()=>(window as any).__game.getState().sim?.status==='complete',null,{timeout:45000});await expect(page.locator('.mission-debrief')).toBeVisible();
    const completed=await state(page);expect(completed.sim.time).toBe(10800);expect(completed.sim.scienceReceived).toBeGreaterThanOrEqual(expected.packets);expect(completed.debrief.isFinal).toBe(true);
    const arrived=completed.sim.dataPackets.filter((p:any)=>p.receivedAt!==null&&p.receivedAt<=completed.sim.time&&p.receivedBits>=p.bits-.01);
    expect(new Set(arrived.map((p:any)=>p.target)).size).toBeGreaterThanOrEqual(expected.packets);expect(arrived.every((p:any)=>p.bits===expected.pixels**2*12)).toBe(true);
    await expect(page.locator('.requirement-row').filter({hasText:'Valid data received'})).toContainText(`/ ${expected.packets}`);expect(await page.locator('.modal').innerText()).not.toMatch(/[가-힣]/);
    await shot(page,`${profile}-actual-reception-result`);records.push({profile,design,region,packets:arrived,scienceReceived:completed.sim.scienceReceived,time:completed.sim.time});
    if(profile==='precision'){await page.locator('.result-actions [data-action="retry"]').click();await ready(page);}
  }
  writeFileSync(join(artifacts,'actual-hardware-region-results.json'),JSON.stringify(records,null,2));
});
