import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {installNativeDeletionAudit} from './native-gl-audit';

const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'nav01-unfrozen';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate name');
const out=join(process.cwd(),'tests/browser/artifacts/orbit-apsis',candidate);mkdirSync(out,{recursive:true});
const test=base.extend<{audit:void}>({audit:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);const errors:string[]=[],warnings:string[]=[],workers=new Set<string>();
 page.on('worker',w=>workers.add(w.url()));page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use();
 const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);
 const graphics=warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w));
 const report={title:info.title,status:info.status,candidate,browser:page.context().browser()?.version(),viewport:page.viewportSize(),errors,warnings,graphics,native,workers:[...workers],scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)),scope:'Actual visible mouse/keyboard and JSON file controls; readonly projections/state only. No injected plan/runtime, accelerated QA completion or tolerance change.'};
 const name=info.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase();writeFileSync(join(out,name+'.json'),JSON.stringify(report,null,2));
 if(info.status!=='passed')await page.screenshot({path:join(out,name+'-failure.png')}).catch(()=>{});
 expect(errors).toEqual([]);expect(graphics).toEqual([]);expect(native?.contexts?.length??0).toBeGreaterThan(0);expect(native?.errors??[]).toEqual([]);
},{auto:true}]});
test.setTimeout(150000);test.use({viewport:{width:1280,height:720},actionTimeout:15000});
const state=(p:Page)=>p.evaluate(()=>(window as any).__game.getState());
const ready=(p:Page)=>p.waitForFunction(()=>{const s=(window as any).__game?.getState();return s?.assetsReady&&!s.pending&&s.revision===s.acceptedRevision;},null,{timeout:90000});
const act=(p:Page,a:string)=>p.locator(`[data-action="${a}"]`).first().click();
const camera=(p:Page)=>p.evaluate(()=>{const s=(window as any).__game.scene;return {position:s.camera.position.toArray(),quaternion:s.camera.quaternion.toArray(),target:s.controls.target.toArray()};});
async function settled(p:Page){await p.waitForFunction(()=>!(window as any).__game.scene.tween);let old=await camera(p);for(let i=0;i<100;i++){await p.waitForTimeout(30);const next=await camera(p);const error=Math.max(...next.position.map((v:number,j:number)=>Math.abs(v-old.position[j])),...next.target.map((v:number,j:number)=>Math.abs(v-old.target[j])));if(error<1e-10)return;old=next;}throw Error('Actual camera damping did not converge');}
async function open(p:Page,en=false){await p.goto('/?qa');await ready(p);if(en)await act(p,'language');await act(p,'missions');await p.locator('[data-mission="earth"]').click();await act(p,'preset-balanced');await ready(p);await act(p,'plan');await ready(p);await settled(p);}
async function positions(p:Page,which:'periapsis'|'apoapsis'|'plane',value:number){
 const r=await p.evaluate(({which,value})=>{const s=(window as any).__game.scene,handle='earth-'+which,from=s.getHandleScreen(handle),rect=s.canvas.getBoundingClientRect();let target;
  if(which==='plane'){const ring=s.handleGroup.getObjectByName('initial-orbit-plane-ring'),a=ring.geometry.attributes.position.array;let radius=0;for(let n=0;n<a.length;n+=3)radius=Math.max(radius,Math.hypot(a[n+1],a[n+2]));const angle=value*Math.PI/180;target=s.camera.position.clone().set(a[0],radius*Math.sin(angle),-radius*Math.cos(angle));}
  else target=s.camera.position.clone().set((which==='periapsis'?1:-1)*(6378.137+value)*s.scale,0,0);
  const to=s.project(target);return {from:{x:from.x+rect.left,y:from.y+rect.top,visible:from.visible},to:{x:to.x+rect.left,y:to.y+rect.top,visible:to.visible}};},{which,value});
 expect(r.from.visible).toBe(true);expect(r.to.visible).toBe(true);expect(await p.evaluate(v=>document.elementFromPoint(v.x,v.y)?.tagName,r.from)).toBe('CANVAS');return r;
}
async function hold(p:Page,which:'periapsis'|'apoapsis'|'plane',value:number){const r=await positions(p,which,value);await p.mouse.move(r.from.x,r.from.y);await p.mouse.down();await p.mouse.move(r.to.x,r.to.y,{steps:18});return r;}
async function edit(p:Page,which:'periapsis'|'apoapsis'|'plane',value:number){await hold(p,which,value);await p.mouse.up();await ready(p);return state(p);}
const trajectory=(p:Page)=>p.evaluate(()=>(window as any).__game.scene.trajectoryPoints.map((s:any)=>({t:s.t,positionKm:s.positionKm,altitudeKm:s.altitudeKm})));
async function exportSave(p:Page){await act(p,'settings');const event=p.waitForEvent('download');await act(p,'export');const download=await event;expect(await download.failure()).toBeNull();const text=readFileSync((await download.path())!,'utf8');await act(p,'close-modal');return text;}
async function importSave(p:Page,text:string){await act(p,'settings');const event=p.waitForEvent('filechooser');await act(p,'import');await(await event).setFiles({name:'actual-ellipse.json',mimeType:'application/json',buffer:Buffer.from(text)});await p.waitForFunction(()=>(window as any).__game.getState().design.plan.earthOrbit?.version==='earth-ellipse-rtn-1');await ready(p);}

for(const en of [false,true])test(`${en?'English large1080':'Korean normal720'} actual independent apsis and plane gestures change the physical path and injection gate`,async({page})=>{
 if(en){await page.setViewportSize({width:1920,height:1080});}await open(page,en);
 if(en){await act(page,'settings');await page.locator('#ui-scale').selectOption('large');await act(page,'close-modal');await settled(page);}
 const original=await state(page),originalPath=await trajectory(page);expect(original.design.plan.earthOrbit).toBeUndefined();
 let s=await edit(page,'apoapsis',950);expect(s.design.plan.altitudeKm).toBe(600);expect(Math.abs(s.design.plan.earthOrbit.apoapsisAltitudeKm-950)).toBeLessThan(2);
 s=await edit(page,'periapsis',400);expect(Math.abs(s.design.plan.altitudeKm-400)).toBeLessThan(2);expect(Math.abs(s.design.plan.earthOrbit.apoapsisAltitudeKm-950)).toBeLessThan(2);
 const beforePlane=s.design.plan.inclinationDeg;s=await edit(page,'plane',72);expect(Math.abs(s.design.plan.inclinationDeg-72)).toBeLessThan(.2);expect(s.design.plan.inclinationDeg).not.toBe(beforePlane);
 const actual=await trajectory(page);expect(actual).not.toEqual(originalPath);expect(Math.abs(actual[0].altitudeKm-s.design.plan.altitudeKm)).toBeLessThan(1e-6);
 const radii=actual.map((v:any)=>Math.hypot(...v.positionKm)-6378.137);expect(Math.min(...radii)).toBeCloseTo(s.design.plan.altitudeKm,5);expect(Math.max(...radii)).toBeGreaterThan(940);
 await expect(page.locator('[data-action="launch"]')).toBeDisabled();await expect(page.locator('.right-panel')).toContainText(en?'circular injection only':'원궤도만 지원');
 await act(page,'launch-packages');await page.locator('[data-package="precision"]').click();await ready(page);await expect(page.locator('[data-action="launch"]')).toBeEnabled();
 if(en)expect(await page.locator('.right-panel').innerText()).not.toMatch(/[가-힣]/);
 const exported=await exportSave(page);const save=JSON.parse(exported);expect(save.modelVersion).toContain('+earth-ellipse-rtn-1');expect(save.design).toEqual((await state(page)).design);writeFileSync(join(out,`${en?'en':'ko'}-ellipse-draft.json`),exported);
 await page.screenshot({path:join(out,`${en?'en-large1080':'ko-normal720'}-ellipse.png`)});
});

test('held orbit edits preserve the real camera and Escape plus F restore the complete accepted draft',async({page})=>{
 await open(page);await edit(page,'apoapsis',900);const accepted=(await state(page)).design;
 await hold(page,'periapsis',350);expect((await state(page)).design).not.toEqual(accepted);const held=camera(page);await page.waitForTimeout(250);expect(await camera(page)).toEqual(await held);
 await page.keyboard.press('Escape');await page.mouse.up();await ready(page);expect((await state(page)).design).toEqual(accepted);
 await act(page,'undo');await ready(page);expect((await state(page)).design.plan.earthOrbit).toBeUndefined();await act(page,'redo');await ready(page);expect((await state(page)).design).toEqual(accepted);
 await hold(page,'periapsis',420);await page.keyboard.press('f');await page.mouse.move(700,340,{steps:5});await page.mouse.up();await ready(page);expect((await state(page)).design).toEqual(accepted);expect(await page.evaluate(()=>(window as any).__game.scene.drag)).toBeNull();
 await act(page,'camera-reset');await settled(page);
 // Real OrbitControls inertia is present immediately before grabbing a handle.
 await page.mouse.move(720,380);await page.mouse.down({button:'right'});await page.mouse.move(738,385,{steps:8});await page.mouse.up({button:'right'});
 const point=await positions(page,'apoapsis',980);await page.mouse.move(point.from.x,point.from.y);await page.mouse.down();const during=await camera(page);await page.waitForTimeout(250);expect(await camera(page)).toEqual(during);
 await page.keyboard.press('Escape');await page.mouse.up();await ready(page);expect((await state(page)).design).toEqual(accepted);
 await page.screenshot({path:join(out,'cancelled-draft.png')});
});

test('actual elliptical mission reaches its natural result and exactly reconstructs its versioned terminal save',async({page})=>{
 await open(page);await edit(page,'apoapsis',900);await edit(page,'periapsis',450);await act(page,'launch-packages');await page.locator('[data-package="precision"]').click();await ready(page);await expect(page.locator('[data-action="launch"]')).toBeEnabled();
 const design=(await state(page)).design;await act(page,'launch');await expect(page.locator('#flight-time')).toBeVisible({timeout:30000});await page.locator('[data-speed="600"]').click();if(!(await state(page)).playing)await page.keyboard.press('Space');
 await page.waitForFunction(()=>(window as any).__game.getState().sim?.time>=1500);const running=(await state(page)).sim;expect(running.modelVersion).toContain('+earth-ellipse-rtn-1');expect(running.design).toEqual(design);expect(running.tick).toBeGreaterThan(250);
 await page.waitForFunction(()=>(window as any).__game.getState().sim?.status==='complete',null,{timeout:60000});await expect(page.locator('.mission-debrief')).toBeVisible();const terminal=await state(page);expect(terminal.sim.time).toBe(10800);expect(terminal.playing).toBe(false);await page.screenshot({path:join(out,'actual-ellipse-result.png')});
 await act(page,'close-modal');const text=await exportSave(page),saved=JSON.parse(text);expect(saved.simulation).toEqual(terminal.sim);writeFileSync(join(out,'actual-terminal-save.json'),text);
 await act(page,'home');await act(page,'missions');await page.locator('[data-mission="earth"]').click();await ready(page);expect((await state(page)).design.plan.earthOrbit).toBeUndefined();await importSave(page,text);await page.waitForFunction(()=>(window as any).__game.getState().sim?.time===10800);const restored=await state(page);expect(restored.sim).toEqual(terminal.sim);expect(restored.design).toEqual(design);expect(restored.playing).toBe(false);
 await page.screenshot({path:join(out,'actual-ellipse-replayed.png')});
});
