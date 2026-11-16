import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {installNativeDeletionAudit} from '../native-gl-audit';

export const product=resolve(process.env.PLAYWRIGHT_PRODUCT_ROOT||process.cwd());
export const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'review-development';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Unsafe candidate identifier');
export const output=join(process.env.REVIEW_QA_OUTPUT_ROOT||join(product,'tests/browser/artifacts/review'),candidate);mkdirSync(output,{recursive:true});
export const fixtureCode=buildSync({stdin:{contents:"export * from './src/swingby'; export {partTransformFor} from './src/hardware'; export {pinSwingbyRun} from './src/redesign/adapters/swingby'; export {makeReviewPair} from './src/redesign/archive';",resolveDir:product,loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const bundled=fixtureCode;
const fixture={exports:{} as any};new Function('module','exports','require',bundled)(fixture,fixture.exports,createRequire(join(product,'package.json')));
export const domain=fixture.exports;
export const slug=(s:string)=>s.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase();
export function record(name:string,data:unknown){writeFileSync(join(output,name+'.json'),JSON.stringify(data,null,2));}
export const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);
 const errors:string[]=[],warnings:string[]=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use(errors);
 const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);
 const report={title:info.title,status:info.status,durationMs:info.duration,browser:page.context().browser()?.version(),viewport:page.viewportSize(),url:page.url(),errors,warnings,native,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url()),projectionBundleSha256:createHash('sha256').update(bundled).digest('hex'),sourceHashes:Object.fromEntries(['src/review-client.ts','src/review-ui.ts','src/swingby-ui.ts','src/main.ts','src/render/swingby-review-scene.ts'].map(p=>[p,createHash('sha256').update(readFileSync(join(product,p))).digest('hex')]))};
 record(slug(info.title)+'-report',report);await info.attach('actual-review-ui',{body:JSON.stringify(report,null,2),contentType:'application/json'});
 if(info.status!==info.expectedStatus)await page.screenshot({path:join(output,slug(info.title)+'-failure.png'),fullPage:true}).catch(()=>{});
 expect(errors,'No application or asset errors').toEqual([]);expect(warnings.filter(w=>/INVALID_OPERATION|does not belong to this context/.test(w)),'No native graphics ownership warning').toEqual([]);expect(native?.errors??[],'Native WebGL resource ownership').toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000,trace:"retain-on-failure"});
export const rootState=(p:Page)=>p.evaluate(()=>(window as any).__game.getState());
export const flightState=(p:Page)=>p.evaluate(()=>(window as any).__game.swingby()?.getState());
export const reviewState=(p:Page)=>p.evaluate(()=>{const g=(window as any).__game;return (g.review?.()??g.swingby()?.getReview())?.getState();});
export const mainAction=(p:Page,a:string)=>p.locator(`[data-action="${a}"]`).first().click();
export const flightAction=(p:Page,a:string)=>p.locator(`[data-swingby-action="${a}"]`).first().click();
export const reviewAction=(p:Page,a:string)=>p.locator(`[data-review-action="${a}"]`).first().click();
export async function boot(p:Page,language:'ko'|'en'='ko',scale:'normal'|'large'='normal'){
 await p.addInitScript(language=>localStorage.setItem('orbital-language',language),language);await p.goto('/?qa');await p.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
 await mainAction(p,'settings');await p.locator('#ui-scale').selectOption(scale);await p.locator('#motion').selectOption('reduced');await mainAction(p,'close-modal');
}
export async function flightReady(p:Page){await p.waitForFunction(()=>{const e=(window as any).__game.swingby(),s=e?.getState();return s&&!s.pending&&!s.busy&&!e.dirty;},null,{timeout:150000});}
export async function reviewReady(p:Page){await p.waitForFunction(()=>{const g=(window as any).__game,e=g.review?.()??g.swingby()?.getReview(),s=e?.getState();return s&&!s.busy&&!e.dirty;},null,{timeout:180000});}
export async function builderReady(p:Page){await p.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return s.mode==='build'&&s.swingbyAssembly&&!s.pending&&s.acceptedRevision===s.revision&&!g.scene.tween;},null,{timeout:45000});}
export async function cameraReady(p:Page){await p.waitForFunction(()=>!(window as any).__game.scene.tween);}
export async function drag(p:Page,a:{x:number;y:number},b:{x:number;y:number}){await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:24});await p.mouse.up();}
export async function startSwingby(p:Page){await mainAction(p,'missions');await mainAction(p,'mission-swingby');await flightReady(p);}
export async function aim(p:Page,target=domain.createSwingbyPlan('baseline').aim){
 await flightAction(p,'view-aim');const coords=await p.evaluate(({target,plane})=>{const e=(window as any).__game.swingby(),s=e.scene,current=e.getState().plan.aim,start=s.getAimScreen(),world=s.objective.getAimWorldPosition().clone(),dx=target.xKm-current.xKm,dy=target.yKm-current.yKm,delta=plane.xAxis.map((n:number,i:number)=>n*dx+plane.yAxis[i]*dy);world.add(world.clone().set(delta[0],delta[2],-delta[1]).multiplyScalar(3/3389.5));world.project(s.camera);const r=s.canvas.getBoundingClientRect();return {start,end:{x:r.x+(world.x+1)*r.width/2,y:r.y+(1-world.y)*r.height/2}};},{target,plane:domain.getSwingbyScenario().aimPlane});
 expect(coords.start?.visible).toBe(true);await drag(p,coords.start,coords.end);await flightReady(p);
}
export async function visiblePartPoint(p:Page,id:string){return p.evaluate(id=>{
 const scene=(window as any).__game.scene,part=scene.parts.get(id);if(!part)throw Error('Missing part '+id);const visible=(o:any)=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
 const rect=scene.canvas.getBoundingClientRect(),ray=new scene.ray.constructor(),points:any[]=[];
 part.traverse((o:any)=>{if(!o.isMesh||!visible(o))return;const a=o.geometry.getAttribute('position');if(!a)return;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.count;i++){const v=[a.getX(i),a.getY(i),a.getZ(i)];for(let j=0;j<3;j++){min[j]=Math.min(min[j],v[j]);max[j]=Math.max(max[j],v[j]);}}
  for(const f of [[.5,.5,.5],[.5,.9,.5],[.2,.5,.5],[.8,.5,.5],[.5,.5,.9]]){const v=part.position.clone().set(...min.map((m,j)=>m+(max[j]-m)*f[j]));o.localToWorld(v);points.push(scene.project(v));}
 });
 for(const p of points){if(!p.visible||p.x<rect.left||p.x>=rect.right||p.y<rect.top||p.y>=rect.bottom||document.elementFromPoint(p.x,p.y)!==scene.canvas)continue;const m=scene.mouse.clone().set((p.x-rect.left)/rect.width*2-1,-(p.y-rect.top)/rect.height*2+1);ray.setFromCamera(m,scene.camera);const hit=ray.intersectObjects([scene.bus,...scene.parts.values()],true).find((h:any)=>visible(h.object));if(hit?.object.userData.partId===id)return {x:p.x,y:p.y};}throw Error('No visible mesh point '+id);
 },id);}
/** Actual visible remove + palette drag, with read-only coordinate projection. */
export async function replaceAdcs(p:Page,modelId:string){
 await mainAction(p,'camera-reset');await mainAction(p,'view-top');await cameraReady(p);if(!await p.evaluate(()=>(window as any).__game.scene.bayOpen))await mainAction(p,'bay');
 const before=await rootState(p),old=before.design.parts.find((x:any)=>x.kind==='adcs');expect(old).toBeTruthy();const point=await visiblePartPoint(p,old.id);await p.mouse.click(point.x,point.y);expect(await p.evaluate(()=>(window as any).__game.scene.selection)).toBe(old.id);await p.keyboard.press('Delete');await builderReady(p);expect((await rootState(p)).design.parts.some((x:any)=>x.kind==='adcs')).toBe(false);
 await p.locator('[data-category="systems"]').click();const card=p.locator(`[data-model="${modelId}"]`);await card.scrollIntoViewIfNeeded();const box=await card.boundingBox();expect(box).toBeTruthy();
 const local=domain.partTransformFor(before.design,{...old,modelId}).position;const end=await p.evaluate(local=>{const s=(window as any).__game.scene;return s.project(s.craft.localToWorld(s.craft.position.clone().set(...local)));},local);
 expect(await p.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,end)).toBe('universe');await drag(p,{x:box!.x+box!.width/2,y:box!.y+box!.height/2},end);await builderReady(p);
 const after=await rootState(p),part=after.design.parts.find((x:any)=>x.kind==='adcs');expect(part?.modelId).toBe(modelId);expect(part.face).toBe(old.face);expect(Math.abs(part.u-old.u)).toBeLessThan(.0005);expect(Math.abs(part.v-old.v)).toBeLessThan(.0005);expect(after.swingbyDraft).toEqual(before.swingbyDraft);expect(after.swingbyNumerics).toEqual(before.swingbyNumerics);return {before,after,old,part};
}
export async function flyToCompletion(p:Page){
 await expect(p.locator('[data-swingby-action="launch"]')).toBeEnabled();await flightAction(p,'launch');await p.waitForFunction(()=>!!(window as any).__game.swingby()?.getState().runtime);await flightAction(p,'speed');
 if(!(await flightState(p)).playing)await flightAction(p,'play');await p.waitForFunction(()=>{const s=(window as any).__game.swingby()?.getState();return s?.runtime?.status!=='running'&&!!s?.result;},null,{timeout:300000});await flightReady(p);return flightState(p);
}
export async function downloadReview(p:Page){const pending=p.waitForEvent('download');await reviewAction(p,'export');const d=await pending;expect(await d.failure()).toBeNull();expect(d.suggestedFilename()).toBe('orbital-foundry-review-ab.json');return readFileSync((await d.path())!,'utf8');}
export async function importReview(p:Page,text:string){const pending=p.waitForEvent('filechooser');await reviewAction(p,'import');await(await pending).setFiles({name:'review.json',mimeType:'application/json',buffer:Buffer.from(text)});await reviewReady(p);}
export async function screenshot(p:Page,name:string){await p.screenshot({path:join(output,name+'.png')});}
export async function controlInside(p:Page,selector:string){const item=p.locator(selector).first();await expect(item).toBeVisible();const bounds=await item.evaluate(el=>{const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);let clipped=false;for(let a=el.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a===document.body||a===document.documentElement?{top:0,bottom:innerHeight,left:0,right:innerWidth}:a.getBoundingClientRect();if(/auto|hidden|scroll/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))clipped=true;if(/auto|hidden|scroll/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))clipped=true;}return {hit:h===el||el.contains(h),clipped,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});expect(bounds.hit,selector+' hit target').toBe(true);expect(bounds.clipped,selector+' clipping').toBe(false);expect(bounds.left).toBeGreaterThanOrEqual(0);expect(bounds.right).toBeLessThanOrEqual(1280);expect(bounds.top).toBeGreaterThanOrEqual(0);expect(bounds.bottom).toBeLessThanOrEqual(720);return bounds;}
