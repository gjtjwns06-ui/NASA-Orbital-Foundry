import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifactDir=join(process.cwd(),'tests/browser/artifacts/flight-advisor');mkdirSync(artifactDir,{recursive:true});
const test=base.extend<{logs:string[]}>({logs:[async({page},use,info)=>{
  const logs:string[]=[];page.on('pageerror',e=>logs.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('favicon.ico'))logs.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))logs.push(`${r.status()} ${r.url()}`);});
  await use(logs);
  const record={test:info.title,status:info.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors:logs,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[])};
  writeFileSync(join(artifactDir,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify(record,null,2));
  await info.attach('advisor-browser-evidence',{body:JSON.stringify(record,null,2),contentType:'application/json'});
  if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
  expect(logs,'No browser exceptions or application resource failures').toEqual([]);
},{auto:true}]});

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());
async function action(page:Page,name:string){await page.locator(`[data-action="${name}"]`).first().click();}
async function launch(page:Page,mission:'earth'|'mars'){
  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});
  await page.evaluate(m=>(window as any).__game.startMission(m,'balanced'),mission);
  await page.waitForFunction(()=>{const s=(window as any).__game.getState();return !s.pending&&s.revision===s.acceptedRevision&&!(window as any).__game.scene.tween;});
  await action(page,'plan');await page.waitForFunction(()=>!(window as any).__game.scene.tween);await action(page,'launch');
  await expect(page.locator('#flight-time')).toBeVisible();
}
async function pause(page:Page){if((await state(page)).playing)await page.keyboard.press('Space');await expect.poll(async()=>(await state(page)).playing).toBe(false);}
async function runFast(page:Page){await page.locator('[data-speed="600"]').click();if(!(await state(page)).playing)await page.keyboard.press('Space');}
async function flowMatches(page:Page){
  await page.waitForFunction(()=>{const s=(window as any).__game.getState().sim;return document.querySelector('#science-flow')?.getAttribute('data-total-packets')===String(s.dataPackets.length);});
  // Poll the real UI against independently read live queues. No production
  // classification helper or accelerated finish hook is called by this check.
  await expect.poll(()=>page.evaluate(()=>{
    const g=(window as any).__game,s=g.getState().sim,t=g.telemetry();
    const complete=(p:any)=>p.receivedAt!==null&&p.receivedBits>=p.bits-.01;
    const active=s.status==='running'&&t.linkReady?s.dataPackets.find((p:any)=>!complete(p)&&p.transmittedBits<p.bits-.01)?.id:null;
    const expected:Record<string,number>={stored:0,transmitting:0,inflight:0,received:0};
    const byId=new Map<string,string>();
    for(const p of s.dataPackets){const flying=s.inFlight.some((x:any)=>x.packetId===p.id&&x.bits>0);const status=complete(p)?'received':p.id===active?'transmitting':flying?'inflight':'stored';expected[status]++;byId.set(p.id,status);}
    const counters=Object.entries(expected).every(([k,v])=>document.querySelector(`#science-flow-count-${k}`)?.textContent===String(v));
    const cards=Array.from(document.querySelectorAll<HTMLElement>('.science-packet')).every(el=>byId.get(el.dataset.packetId!)===el.dataset.status);
    return counters&&cards;
  })).toBe(true);
}
async function shot(page:Page,name:string){await page.screenshot({path:join(artifactDir,name+'.png'),fullPage:true});}

test('advisor forecasts a paused checkpoint without mutation and real decision warp stops before the event',async({page})=>{
  await page.setViewportSize({width:1280,height:720});await launch(page,'earth');await pause(page);
  const frozen=(await state(page)).sim;
  await page.waitForFunction(()=>{const s=(window as any).__game.getState();return Boolean(s.forecast)&&!s.forecastPending;});
  await page.waitForTimeout(400);expect((await state(page)).sim).toEqual(frozen);
  const before=await state(page);expect(before.forecast.horizon).toBeLessThanOrEqual(1800);expect(before.forecast.baseTime).toBeLessThanOrEqual(before.sim.time);expect(before.forecast.nextEvent.time).toBeGreaterThan(before.sim.time);
  await action(page,'advisor-details');await expect(page.locator('#flight-advisor')).toContainText('현재 일정');await expect(page.locator('[data-action="warp-event"]')).toBeVisible();
  const predicted=before.forecast.nextEvent.time,target=predicted-before.sim.time>35?predicted-30:predicted;
  await action(page,'warp-event');
  await expect.poll(async()=>{const s=await state(page);return !s.playing&&s.stopAtTime===null&&s.sim.time>=target;},{timeout:15000}).toBe(true);
  const stopped=await state(page);expect(stopped.sim.time).toBe(target);expect(stopped.sim.remainder).toBeLessThan(1e-6);expect(stopped.sim.time).toBeGreaterThan(before.sim.time);
  await page.waitForTimeout(350);expect((await state(page)).sim).toEqual(stopped.sim);
  await shot(page,'advisor-decision-paused-1280x720');
});

test('science cards and geographic receipts follow actual live Earth completion without a finish shortcut',async({page})=>{
  test.setTimeout(65000);await page.setViewportSize({width:1280,height:720});await launch(page,'earth');await pause(page);await runFast(page);
  await page.waitForFunction(()=>{const s=(window as any).__game.getState().sim;return s.dataPackets.length>0&&s.dataPackets.some((p:any)=>p.receivedAt===null);},null,{timeout:15000});
  await pause(page);await flowMatches(page);
  expect((await state(page)).sim.scienceReceived).toBe(0);await expect(page.locator('.science-packet[data-status="stored"]').first()).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__game;return [...g.scene.scienceMarkers.values()].filter((m:any)=>!m.userData.received).length;})).toBeGreaterThan(0);
  await shot(page,'science-captured-onboard-1280x720');await runFast(page);
  await page.waitForFunction(()=>(window as any).__game.getState().sim.status==='complete',null,{timeout:35000});
  await expect(page.getByRole('heading',{name:'임무를 완수했습니다'})).toBeVisible();
  const final=await state(page);expect(final.sim.time).toBe(10800);expect(final.sim.scienceReceived).toBeGreaterThanOrEqual(4);expect(final.playing).toBe(false);
  await action(page,'close-modal');await flowMatches(page);
  const markers=await page.evaluate(()=>[...(window as any).__game.scene.scienceMarkers.values()].map((m:any)=>({...m.userData,colors:m.children.map((c:any)=>c.material.color.getHex())})));
  const expected=final.sim.dataPackets.filter((p:any)=>p.observedPoint);expect(markers).toHaveLength(expected.length);
  for(const p of expected){const marker=markers.find((m:any)=>m.packetId===p.id);expect(marker).toBeTruthy();const received=p.receivedAt!==null&&p.receivedBits>=p.bits-.01;expect(marker.received).toBe(received);expect(marker.receivedAt).toBe(p.receivedAt);expect(marker.colors.every((c:number)=>c===(received?0x8ff1c6:0xe7bd75))).toBe(true);}
  await expect(page.locator('#science-flow-next')).toContainText('임무 종료');await shot(page,'science-received-final-1280x720');
});

test('Mars science in propagation remains unreceived until real light travel completes',async({page})=>{
  test.setTimeout(60000);await page.emulateMedia({reducedMotion:'reduce'});await launch(page,'mars');await pause(page);await runFast(page);
  await page.waitForFunction(()=>{const s=(window as any).__game.getState().sim;return s.inFlight.length>0&&s.scienceReceived===0&&s.dataPackets.some((p:any)=>p.transmittedBits>=p.bits-.01&&p.receivedAt===null);},null,{timeout:35000});
  await pause(page);await flowMatches(page);const paused=await state(page);
  expect(paused.sim.inFlight.every((x:any)=>x.arrivesAt>paused.sim.time)).toBe(true);expect(paused.sim.scienceReceived).toBe(0);
  expect(paused.sim.dataPackets.some((p:any)=>p.transmittedBits>p.receivedBits&&p.receivedAt===null)).toBe(true);
  await expect(page.locator('.science-packet[data-status="inflight"]').first()).toBeVisible();await expect(page.locator('#science-flow-next')).toContainText('다음 신호 조각');
  await shot(page,'mars-light-time-packets');await runFast(page);
  // Wait for the actual receipt announcement before pausing. The earlier test
  // could pause before telemetry displayed it and miss the rerender regression.
  await page.waitForFunction(()=>{const s=(window as any).__game.getState().sim,f=document.querySelector<HTMLElement>('#science-flash');return s.scienceReceived>0&&Boolean(f?.dataset.packetIds)&&f?.textContent?.includes('지구 수신 완료');},null,{timeout:15000});
  const announced=await page.evaluate(()=>{const g=(window as any).__game,s=g.getState().sim,f=document.querySelector<HTMLElement>('#science-flash')!;return {ids:f.dataset.packetIds!,at:f.dataset.announcedAt!,text:f.textContent,receivedEventCount:s.events.filter((e:any)=>e.code==='RECEIVED').length};});
  await pause(page);await flowMatches(page);const checkpoint=(await state(page)).sim,flash=page.locator('#science-flash');
  await expect(page.locator('.science-packet[data-status="received"]').first()).toBeVisible();await expect(flash).toContainText('지구 수신 완료');
  await expect(flash).toHaveAttribute('data-packet-ids',announced.ids);await expect(flash).toHaveAttribute('data-announced-at',announced.at);
  expect(await flash.evaluate(el=>({animation:getComputedStyle(el).animationName,opacity:getComputedStyle(el).opacity}))).toEqual({animation:'none',opacity:'1'});
  expect(checkpoint.events.filter((e:any)=>e.code==='RECEIVED')).toHaveLength(announced.receivedEventCount);
  for(const id of JSON.parse(announced.ids)){const p=checkpoint.dataPackets.find((p:any)=>p.id===id);expect(p).toBeTruthy();expect(p.receivedAt).not.toBeNull();expect(p.receivedBits).toBeGreaterThanOrEqual(p.bits-.01);}
  await page.waitForFunction(at=>performance.now()-Number(at)>3200,announced.at);
  await expect(flash).toHaveText('');await expect(flash).not.toHaveClass(/arrived/);expect(await flash.getAttribute('data-packet-ids')).toBeNull();
  expect((await state(page)).sim).toEqual(checkpoint);
  writeFileSync(join(artifactDir,'actual-receipt-announcement-pause.json'),JSON.stringify({announcement:announced,receivedPackets:checkpoint.dataPackets.filter((p:any)=>p.receivedAt!==null),pausedTime:checkpoint.time,expiredWithoutNewPhysicalEvent:true},null,2));
});
