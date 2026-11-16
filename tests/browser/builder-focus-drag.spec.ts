import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';

// Exact current domain is used only for legal pointer-target geometry and an
// independent expected CG. No browser design/runtime/Worker state is injected.
const fixture={exports:{} as any};
const compiled=buildSync({stdin:{contents:"export * from './src/swingby'; export {evaluatePlacement} from './src/sim/assembly'; export {partTransformFor} from './src/hardware';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
new Function('module','exports','require',compiled)(fixture,fixture.exports,createRequire(import.meta.url));
const {createSwingbyPlan,getSwingbyScenario,SWINGBY_PROPULSION,swingbyThrustGeometry,evaluatePlacement,partTransformFor}=fixture.exports;
const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'development';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate name');
const output=join(process.cwd(),'tests/browser/artifacts/builder-focus-drag',candidate);mkdirSync(output,{recursive:true});
const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
 const errors:string[]=[],warnings:string[]=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use(errors);
 const report={test:info.title,status:info.status,browser:page.context().browser()?.version(),viewport:page.viewportSize(),url:page.url(),scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url()),errors,warnings,fixtureCodeSha256:createHash('sha256').update(compiled).digest('hex'),scope:'Four actual language/scale UI entries. Visible engine click/F, projected visible-mesh fit against measured panels, bay pointer target at the real mount plane, exact undo. Read-only projections/domain legality only; no QA state injection, Worker posts, fake completion or simulation advancement.'};
 writeFileSync(join(output,info.title.split(' ')[0]+'-report.json'),JSON.stringify(report,null,2));await info.attach('swingby-builder-evidence',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 if(info.status!==info.expectedStatus)await page.screenshot({path:join(output,info.title.split(' ')[0]+'-failure.png'),fullPage:true}).catch(()=>{});
 expect(errors,'No browser/app failures').toEqual([]);expect(warnings.filter(w=>/INVALID_OPERATION|does not belong to this context/.test(w)),'No native context ownership warning').toEqual([]);
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


async function enterBuilder(page:Page,language:'ko'|'en',scale:'normal'|'large'){
 await page.addInitScript(language=>localStorage.setItem('orbital-language',language),language);
 await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
 await mainAction(page,'settings');await page.locator('#ui-scale').selectOption(scale);await page.locator('#motion').selectOption('reduced');await mainAction(page,'close-modal');
 await mainAction(page,'missions');await mainAction(page,'mission-swingby');await flightReady(page);await flightAction(page,'edit');await builderReady(page);
}
async function projectedVisibleBounds(page:Page,id:string){return page.evaluate(id=>{
 const s=(window as any).__game.scene,o=s.parts.get(id),points:{x:number;y:number}[]=[];
 const visible=(o:any)=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
 o.traverse((mesh:any)=>{if(!mesh.isMesh||!visible(mesh))return;const a=mesh.geometry.getAttribute('position');if(!a)return;
 for(let i=0;i<a.count;i++){const point=s.project(mesh.localToWorld(mesh.position.clone().set(a.getX(i),a.getY(i),a.getZ(i))));points.push(point);}});
 const box=(selector:string)=>Array.from(document.querySelectorAll(selector)).map(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return c.display!=='none'&&c.visibility!=='hidden'&&r.width&&r.height?{left:r.left,right:r.right,top:r.top,bottom:r.bottom}:null;}).filter(Boolean) as any[];
 const r=s.canvas.getBoundingClientRect();const safe={left:Math.max(r.left,...box('.left-panel').map(b=>b.right))+12,right:Math.min(r.right,...box('.right-panel,.viewport-tools').map(b=>b.left))-12,top:Math.max(r.top,...box('.topbar,.scene-title,.inspection-tools,.assembly-guide,.inspection-readout').map(b=>b.bottom))+12,bottom:Math.min(r.bottom,...box('.stats-deck,.control-hint').map(b=>b.top))-12};
 return {bounds:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))},safe,vertices:points.length,camera:s.camera.position.toArray(),target:s.controls.target.toArray(),view:s.camera.view};
 },id);}
for(const language of ['ko','en'] as const)for(const scale of ['normal','large'] as const){
 test(`${language}-${scale} carrier F focus fits the live UI and bay pointer uses its actual mount plane`,async({page})=>{
  await enterBuilder(page,language,scale);const before=await rootState(page),engine=before.design.parts.find((p:any)=>p.kind==='engine');
  await mainAction(page,'view-side');await cameraReady(page);const point=await visiblePartPoint(page,engine.id);await page.mouse.click(point.x,point.y);await page.keyboard.press('f');await cameraReady(page);
  const fit=await projectedVisibleBounds(page,engine.id);writeFileSync(join(output,`${language}-${scale}-focus.json`),JSON.stringify(fit,null,2));await page.screenshot({path:join(output,`${language}-${scale}-carrier-focus.png`)});
  expect(fit.vertices).toBeGreaterThan(100);expect(fit.bounds.left).toBeGreaterThanOrEqual(fit.safe.left);expect(fit.bounds.right).toBeLessThanOrEqual(fit.safe.right);expect(fit.bounds.top).toBeGreaterThanOrEqual(fit.safe.top);expect(fit.bounds.bottom).toBeLessThanOrEqual(fit.safe.bottom);expect(fit.bounds.right-fit.bounds.left).toBeGreaterThan(50);
  expect((await rootState(page)).design).toEqual(before.design);expect((await rootState(page)).swingbyDraft).toEqual(before.swingbyDraft);
  await mainAction(page,'camera-reset');await mainAction(page,'view-top');await cameraReady(page);expect(await page.evaluate(()=>(window as any).__game.scene.camera.view?.enabled??false)).toBe(false);
  if(!await page.evaluate(()=>(window as any).__game.scene.bayOpen))await mainAction(page,'bay');
  const battery=before.design.parts.find((p:any)=>p.kind==='battery'),desired={...battery,v:battery.v-.08};expect(evaluatePlacement(before.design,desired).valid).toBe(true);
  const destination=await page.evaluate(local=>{const s=(window as any).__game.scene;return s.project(s.craft.localToWorld(s.craft.position.clone().set(...local)));},partTransformFor(before.design,desired).position);
  const source=await visiblePartPoint(page,battery.id);expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,destination)).toBe('universe');await drag(page,source,destination);await builderReady(page);
  const after=await rootState(page),actual=after.design.parts.find((p:any)=>p.id===battery.id);writeFileSync(join(output,`${language}-${scale}-drag.json`),JSON.stringify({battery,desired,actual,before:before.swingbyEvaluation,after:after.swingbyEvaluation,source,destination},null,2));
  // Browser pointer coordinates are subpixel quantized; 0.5 mm permits <0.1 screen pixel here, not the prior 24 mm drift.
  expect(Math.abs(actual.u-desired.u)).toBeLessThan(.0005);expect(Math.abs(actual.v-desired.v)).toBeLessThan(.0005);expect(actual.face).toBe('py');expect(after.swingbyDraft).toEqual(before.swingbyDraft);expect(after.swingbyEvaluation.gimbalAngleDeg).not.toBe(before.swingbyEvaluation.gimbalAngleDeg);
  await page.screenshot({path:join(output,`${language}-${scale}-actual-bay-move.png`)});await page.keyboard.press('Control+z');await builderReady(page);const undo=await rootState(page);expect(undo.design).toEqual(before.design);expect(undo.swingbyDraft).toEqual(before.swingbyDraft);expect(undo.swingbyEvaluation).toEqual(before.swingbyEvaluation);
 });
}
