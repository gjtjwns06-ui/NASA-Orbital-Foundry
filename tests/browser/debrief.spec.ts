import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifactDir=join(process.cwd(),'tests/browser/artifacts/debrief');
mkdirSync(artifactDir,{recursive:true});
const test=base.extend<{logs:string[]}>({logs:[async({page},use,info)=>{
  const logs:string[]=[];
  page.on('pageerror',e=>logs.push(e.stack||e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('favicon.ico'))logs.push(m.text());});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))logs.push(`${r.status()} ${r.url()}`);});
  await use(logs);
  const record={test:info.title,status:info.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors:logs,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[])};
  writeFileSync(join(artifactDir,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify(record,null,2));
  await info.attach('debrief-browser-evidence',{body:JSON.stringify(record,null,2),contentType:'application/json'});
  if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
  expect(logs,'No browser exceptions or application resource failures').toEqual([]);
},{auto:true}]});

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());
async function action(page:Page,name:string){await page.locator(`[data-action="${name}"]`).first().click();}
async function ready(page:Page){await page.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return !s.pending&&s.revision===s.acceptedRevision&&!g.scene.tween;},null,{timeout:30000});}
async function startWithoutAntenna(page:Page,english=false){
  await page.setViewportSize({width:1280,height:720});
  if(english)await page.addInitScript(()=>localStorage.setItem('orbital-language','en'));
  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});
  // This is a reproducible initial scenario only. No QA hook advances time,
  // edits the result, repairs hardware, or grants science during either run.
  await page.evaluate(()=>{
    const g=(window as any).__game;g.startMission('earth','balanced',false);
    const d=g.getState().design;d.parts=d.parts.filter((p:any)=>p.kind!=='antenna');g.setDesign(d);
  });
  await ready(page);expect((await state(page)).design.hardwareVersion).toBeUndefined();
}
async function launch(page:Page){
  await action(page,'plan');await ready(page);await expect(page.locator('[data-action="launch"]')).toBeEnabled();
  await action(page,'launch');await expect(page.locator('#flight-time')).toBeVisible();
  await page.locator('[data-speed="600"]').click();
  if(!(await state(page)).playing)await page.keyboard.press('Space');
}
async function complete(page:Page){
  await page.waitForFunction(()=>(window as any).__game.getState().sim?.status==='complete',null,{timeout:45000});
  await expect(page.locator('.mission-debrief')).toBeVisible();
  expect((await state(page)).sim.time).toBe(10800);
  expect((await state(page)).playing).toBe(false);
}
async function shot(page:Page,name:string){await page.screenshot({path:join(artifactDir,name+'.png'),fullPage:true});}
async function ctasFit(page:Page){
  const modal=await page.locator('.modal').boundingBox();expect(modal).toBeTruthy();
  for(const name of ['retry','missions']){
    const b=await page.locator(`.result-actions [data-action="${name}"]`).boundingBox();expect(b).toBeTruthy();
    expect(b!.x).toBeGreaterThanOrEqual(modal!.x);expect(b!.y).toBeGreaterThanOrEqual(modal!.y);
    expect(b!.x+b!.width).toBeLessThanOrEqual(modal!.x+modal!.width);
    expect(b!.y+b!.height,'The complete result action remains inside the visible modal').toBeLessThanOrEqual(modal!.y+modal!.height-1);
    expect(b!.y+b!.height).toBeLessThanOrEqual(720);
    expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-action]')?.getAttribute('data-action'),{x:b!.x+b!.width/2,y:b!.y+b!.height/2})).toBe(name);
  }
}

test('real failed delivery opens the unchanged design and a pointer-installed antenna improves a same-condition repeat',async({page})=>{
  test.setTimeout(120000);await startWithoutAntenna(page);await launch(page);await complete(page);
  const failed=await state(page);
  expect(failed.sim.scienceReceived).toBe(0);expect(failed.sim.dataPackets.length).toBeGreaterThan(0);
  await expect(page.locator('[data-diagnostic="MISSING_ANTENNA"]')).toBeVisible();
  await expect(page.locator('[data-diagnostic="DELIVERY_UNCONFIRMED"]')).toBeAttached();
  expect(failed.debrief.isFinal).toBe(true);
  expect(failed.debrief.transport.neverEmitted).toBe(failed.sim.dataPackets.length);
  expect(failed.debrief.transport.fullyReceived).toBe(0);
  await ctasFit(page);await shot(page,'failed-delivery-final-1280x720');
  await page.locator('[data-diagnostic="MISSING_ANTENNA"] [data-debrief-action]').first().click();
  await expect.poll(async()=>(await state(page)).mode).toBe('build');await ready(page);
  const review=await state(page);
  expect(review.sim).toBeNull();expect(review.design).toEqual(failed.sim.design);
  expect(review.previousResult.design).toEqual(failed.sim.design);expect(review.previousResult.evaluatedAt).toBe(10800);
  expect(review.previousResult.received).toBe(0);expect(review.design.parts.some((p:any)=>p.kind==='antenna')).toBe(false);
  await expect(page.locator('.review-context')).toContainText('현재 화면은 수정할 설계의 예측');
  await expect(page.locator('[data-part="antenna"]')).toBeVisible();
  // Repair the observed missing component through the same shelf/raycast
  // interaction a player uses, without writing a new part into game state.
  await action(page,'view-front');await ready(page);
  const shelf=await page.locator('[data-part="antenna"]').boundingBox();expect(shelf).toBeTruthy();
  const target=await page.evaluate(()=>{const s=(window as any).__game.scene;return s.project(s.craft.position.clone().add({x:0,y:0,z:.65}));});
  expect(target.visible).toBe(true);
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,target)).toBe('universe');
  await page.mouse.move(shelf!.x+shelf!.width/2,shelf!.y+shelf!.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:18});await page.mouse.up();
  await expect.poll(async()=>(await state(page)).design.parts.filter((p:any)=>p.kind==='antenna').length).toBe(1);await ready(page);
  const repaired=await state(page),antenna=repaired.design.parts.find((p:any)=>p.kind==='antenna');
  expect(antenna.face).toBe('pz');expect(Math.abs(antenna.u)+Math.abs(antenna.v)).toBeLessThan(.08);
  expect(repaired.design.parts.filter((p:any)=>p.kind!=='antenna')).toEqual(review.design.parts);
  expect(repaired.design.plan).toEqual(review.design.plan);expect(repaired.previousResult).toEqual(review.previousResult);
  await shot(page,'pointer-repaired-antenna-1280x720');await launch(page);await complete(page);
  const success=await state(page),comparison=success.debrief.comparison;
  expect(success.sim.scienceReceived).toBeGreaterThan(0);expect(comparison.comparable).toBe(true);expect(comparison.blockers).toEqual([]);
  expect(comparison.metricDeltas.received).toBe(success.sim.scienceReceived);
  expect(comparison.designChanges).toHaveLength(1);
  expect(comparison.designChanges[0]).toMatchObject({kind:'hardware',key:'group:antenna',before:[],after:[{kind:'antenna'}]});
  expect(success.previousResult).toEqual(review.previousResult);
  await expect(page.locator('.debrief-comparison')).toContainText('같은 모델');
  await expect(page.locator('.debrief-delta-metrics')).toContainText(`+${success.sim.scienceReceived}`);
  await expect(page.locator('[data-diagnostic="MISSING_ANTENNA"]')).toHaveCount(0);
  await ctasFit(page);await shot(page,'same-condition-received-improvement-1280x720');
  writeFileSync(join(artifactDir,'actual-repeated-mission-evidence.json'),JSON.stringify({baseline:review.previousResult,after:success.debrief,afterDesign:success.sim.design},null,2));
});

test('English actual interim debrief is labeled partial and its long-card actions remain reachable at 1280x720',async({page})=>{
  await startWithoutAntenna(page,true);await launch(page);
  await page.waitForFunction(()=>{const s=(window as any).__game.getState().sim;return s.time>=900&&s.dataPackets.length>0;},null,{timeout:15000});
  if((await state(page)).playing)await page.keyboard.press('Space');
  const paused=await state(page);expect(paused.sim.status).toBe('running');expect(paused.sim.time).toBeLessThan(10800);
  await action(page,'finish');await expect(page.locator('.mission-debrief')).toBeVisible();
  const partial=await state(page);expect(partial.sim).toEqual(paused.sim);expect(partial.debrief.isFinal).toBe(false);
  expect(partial.debrief.evaluatedAt).toBe(paused.sim.time);
  await expect(page.locator('.debrief-heading')).toContainText('INTERIM RECORD');
  await expect(page.locator('.modal')).not.toContainText(/[가-힣]/);
  await expect(page.locator('[data-diagnostic="MISSING_ANTENNA"]')).toBeVisible();
  await expect(page.locator('[data-diagnostic="DELIVERY_UNCONFIRMED"]')).toBeAttached();
  await ctasFit(page);await shot(page,'english-interim-debrief-1280x720');
  // A time/operation action points into the editable prediction. It must not
  // silently run time, install equipment, or pretend to replay historical data.
  await page.locator('[data-diagnostic="DELIVERY_UNCONFIRMED"] [data-debrief-action]').first().click();
  await expect.poll(async()=>(await state(page)).mode).toBe('plan');await ready(page);
  const reviewing=await state(page);expect(reviewing.sim).toBeNull();expect(reviewing.design).toEqual(paused.sim.design);
  expect(reviewing.previousResult.evaluatedAt).toBe(paused.sim.time);
  expect(reviewing.previousResult.simulationStatus).toBe('running');
  await expect(page.locator('.review-context')).toContainText('This is the editable design preview');
  await expect(page.locator('.review-context')).not.toContainText(/[가-힣]/);
  expect(reviewing.previewTime).toBe(paused.sim.design.plan.operations.find((o:any)=>o.kind==='downlink').start);
  await shot(page,'english-diagnostic-timeline-review-1280x720');
});
