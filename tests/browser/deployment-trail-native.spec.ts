import {test as base,expect,type Page,type JSHandle} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {installNativeDeletionAudit} from './native-gl-audit';

const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'trail-unfrozen';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid QA candidate');
const out=join(process.cwd(),'tests/browser/artifacts/deployment-trail-native',candidate);mkdirSync(out,{recursive:true});
const test=base.extend<{audit:void}>({audit:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);const errors:string[]=[],warnings:string[]=[],workers=new Set<string>();
 page.on('worker',w=>workers.add(w.url()));page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use();const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);
 const graphicsFailures=warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w));
 const status=info.status==='passed'&&(errors.length||graphicsFailures.length||!native?.contexts?.length||native?.errors?.length)?'failed':info.status;
 const report={title:info.title,status,candidate,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors,warnings,native,workers:[...workers],scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),scope:'One actual Edge Compact flight prefix with3 real native context restores, readonly retained Three-object/buffer references, native pointer orbit/wheel, genuine1x resume and save/Exit. No runtime injection, private advance call, synthetic Worker response or performance claim.'};
 writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));if(status!==info.expectedStatus)await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});
 expect(errors).toEqual([]);expect(graphicsFailures).toEqual([]);expect(native).not.toBeNull();expect(native?.contexts?.length??0).toBeGreaterThan(0);expect(native?.errors??[]).toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});test.setTimeout(180000);
const state=(p:Page)=>p.evaluate(()=>(window as any).__game.deployment()?.getState());
const control=(p:Page,a:string)=>p.locator(`[data-deployment-action="${a}"]`).first();
const ready=(p:Page)=>p.waitForFunction(()=>{const s=(window as any).__game.deployment()?.getState();return s&&!s.pending&&!s.busy&&!s.restoring&&!s.saving&&!s.closing;},null,{timeout:60000});
const physical=(s:any)=>({craft:s.craft,plan:s.plan,numerics:s.numerics,runtime:s.runtime,telemetry:s.telemetry,result:s.result,history:s.history,sourceId:s.scene.sourceId,geometryRevision:s.scene.geometryRevision});
const camera=(p:Page)=>p.evaluate(()=>(window as any).__game.deployment().scene.qa.getCamera());
const distance=(c:any)=>Math.hypot(...c.position.map((v:number,i:number)=>v-c.target[i]));
// Upload-dirty version may advance while the same CPU payload is reuploaded
// after context recovery. Ownership, active data and bounds stay exact.
const retainedTrail=(t:any)=>{const {version,...retained}=t;return retained;};
async function reference(p:Page){return p.evaluateHandle(()=>{
 const scene=(window as any).__game.deployment().scene,line=scene.scene.getObjectByName('committed-actual-history');if(!line)throw Error('Actual history line missing');
 return {line,geometry:line.geometry,material:line.material,attribute:line.geometry.getAttribute('position'),array:line.geometry.getAttribute('position').array};
});}
async function trail(ref:JSHandle){return ref.evaluate(r=>{
 const scene=(window as any).__game.deployment().scene,line=scene.scene.getObjectByName('committed-actual-history'),geometry=line.geometry,attribute=geometry.getAttribute('position'),array=attribute.array,count=geometry.drawRange.count;
 if(!Number.isInteger(count)||count<0||count>attribute.count)throw Error('Invalid active history draw range');
 return {identities:{line:line===r.line,geometry:geometry===r.geometry,material:line.material===r.material,attribute:attribute===r.attribute,array:array===r.array},lineUuid:line.uuid,geometryUuid:geometry.uuid,materialUuid:line.material.uuid,capacity:attribute.count,usage:attribute.usage,version:attribute.version,start:geometry.drawRange.start,count,visible:line.visible,activeBits:Array.from(new Uint32Array(array.buffer,array.byteOffset,count*3)),activePoints:Array.from(array.slice(0,count*3)),box:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()},sphere:{center:geometry.boundingSphere.center.toArray(),radius:geometry.boundingSphere.radius}};
});}
async function pose(p:Page){return p.evaluate(()=>{const s=(window as any).__game.deployment().scene;return {links:s.qa.getDisplayedLinks(),body:{position:s.body.position.toArray(),quaternion:s.body.quaternion.toArray(),scale:s.body.scale.toArray()},anchor:{position:s.anchor.position.toArray(),quaternion:s.anchor.quaternion.toArray(),scale:s.anchor.scale.toArray()}};});}
function assertTrail(t:any,s:any){
 expect(t.identities).toEqual({line:true,geometry:true,material:true,attribute:true,array:true});expect(t.capacity).toBe(1024);expect(t.start).toBe(0);expect(t.count).toBe(s.history.length);expect(t.count).toBeGreaterThanOrEqual(2);expect(t.count).toBeLessThanOrEqual(720);expect(t.visible).toBe(true);
 const scale=s.scene.display.kilometresToWorld;
 // Preserve the legacy Three.setFromPoints z||0 convention. Uint32 bit
 // comparison also checks signed-zero behavior exactly; no numeric tolerance.
 const expected=new Float32Array(s.history.flatMap((p:any)=>[p.positionKm[0]*scale,p.positionKm[2]*scale,(-p.positionKm[1]*scale)||0]));
 expect(t.activeBits).toEqual(Array.from(new Uint32Array(expected.buffer)));
}
async function slot(p:Page){return p.evaluate(()=>new Promise<any>((resolve,reject)=>{const open=indexedDB.open('orbital-foundry-deployment',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get('current');let record:any=null;get.onsuccess=()=>{record=get.result??null;};tx.oncomplete=()=>{db.close();resolve(record);};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error);};};}));}

test('Edge retained actual trail survives three native restores advancement and resource cleanup',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('orbital-language','ko'));await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));expect(await page.evaluate(()=>navigator.userAgent.includes('Edg/'))).toBe(true);
 await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-deployment"]').click();await ready(page);await control(page,'variants').click();await control(page,'preset:compact').click();await ready(page);expect((await state(page)).draft.launchable).toBe(true);
 await control(page,'launch').click();await page.waitForFunction(()=>(window as any).__game.deployment().getState().runtime?.time>2);await control(page,'play').click();await ready(page);expect((await state(page)).playing).toBe(false);
 const beforeStep=(await state(page)).runtime.time;await control(page,'step').click();await ready(page);let s=await state(page);expect(s.runtime.time).toBeGreaterThanOrEqual(beforeStep+60);expect(s.runtime.status).toBe('running');
 const ref=await reference(page),initial=physical(s),initialPose=await pose(page),initialTrail=await trail(ref);assertTrail(initialTrail,s);const restores=[];
 for(let i=0;i<3;i++){
  const ext=await page.evaluateHandle(()=>{const gl=(window as any).__game.deployment().scene.renderer.getContext(),extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('Real context-loss extension unavailable');return extension;});
  await ext.evaluate(e=>e.loseContext());await page.waitForFunction(()=>(window as any).__game.deployment().getState().scene.contextLost);await ready(page);expect((await state(page)).playing).toBe(false);
  await ext.evaluate(e=>e.restoreContext());await page.waitForFunction(()=>!(window as any).__game.deployment().getState().scene.contextLost);await ready(page);await page.waitForTimeout(250);await ext.dispose();
  s=await state(page);const currentTrail=await trail(ref),currentPose=await pose(page),native=await page.evaluate(()=>(window as any).__allContextDeletionAudit);
  expect(physical(s)).toEqual(initial);expect(currentPose).toEqual(initialPose);expect(retainedTrail(currentTrail)).toEqual(retainedTrail(initialTrail));assertTrail(currentTrail,s);
  expect(native.errors).toEqual([]);expect(native.contexts.reduce((n:number,c:any)=>n+c.restores,0)).toBe(i+1);restores.push({cycle:i+1,time:s.runtime.time,physicalExact:true,poseExact:true,trail:currentTrail,native});
 }
 await page.screenshot({path:join(out,'three-restores-retained-trail.png')});
 const beforeCamera=await camera(page),point={x:640,y:360};expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)===(window as any).__game.deployment().scene.qa.canvas,point)).toBe(true);
 await page.mouse.move(point.x,point.y);await page.mouse.down({button:'right'});await page.mouse.move(point.x+70,point.y-25,{steps:16});await page.mouse.up({button:'right'});await page.waitForTimeout(400);const orbited=await camera(page);expect(orbited.quaternion).not.toEqual(beforeCamera.quaternion);
 await page.mouse.wheel(0,180);await page.waitForTimeout(600);const zoomed=await camera(page);expect(distance(zoomed)).toBeGreaterThan(distance(orbited));expect(physical(await state(page))).toEqual(initial);expect(retainedTrail(await trail(ref))).toEqual(retainedTrail(initialTrail));
 while((await state(page)).speed!==1)await control(page,'speed').click();await control(page,'play').click();
 await page.waitForFunction(t=>{const s=(window as any).__game.deployment().getState();return s.runtime.time>=t+3;},initial.runtime.time,{timeout:30000});await control(page,'play').click();await ready(page);
 const advanced=await state(page),advancedTrail=await trail(ref);expect(advanced.playing).toBe(false);expect(advanced.runtime.time).toBeGreaterThan(initial.runtime.time);expect(advanced.history.length).toBeGreaterThan(initial.history.length);expect(advanced.history.slice(0,initial.history.length)).toEqual(initial.history);assertTrail(advancedTrail,advanced);expect(advancedTrail.version).toBeGreaterThan(initialTrail.version);expect(advancedTrail.activeBits.slice(0,initialTrail.activeBits.length)).toEqual(initialTrail.activeBits);
 const revision=advanced.slotRevision;await control(page,'save').click();await ready(page);await expect.poll(async()=>(await state(page)).slotRevision).toBeGreaterThan(revision);expect((await state(page)).error).toBe('');const saved=await slot(page),source=JSON.parse(saved.text);expect(source.checkpoint.time).toBe(advanced.runtime.time);expect(source.checkpoint.energyWh).toBe(advanced.runtime.energyWh);writeFileSync(join(out,'actual-advanced-source.json'),saved.text);
 await page.screenshot({path:join(out,'actual-one-times-advanced-retained-trail.png')});const nativeBeforeExit=await page.evaluate(()=>(window as any).__allContextDeletionAudit),active=nativeBeforeExit.contexts.at(-1);
 await control(page,'exit').click();await expect(page.locator('.deployment-experience')).toHaveCount(0);const cleanup=await ref.evaluate(r=>({detached:r.line.parent===null,hidden:r.line.visible===false,sameGeometry:r.line.geometry===r.geometry,sameMaterial:r.line.material===r.material}));expect(cleanup).toEqual({detached:true,hidden:true,sameGeometry:true,sameMaterial:true});
 const nativeAfterExit=await page.evaluate(()=>(window as any).__allContextDeletionAudit),retired=nativeAfterExit.contexts.find((c:any)=>c.id===active.id);expect(retired.restores).toBe(3);expect(retired.deletes).toBeGreaterThan(active.deletes);expect(nativeAfterExit.errors).toEqual([]);await ref.dispose();
 writeFileSync(join(out,'actual-trail-lifecycle-evidence.json'),JSON.stringify({initial,initialPose,initialTrail,restores,beforeCamera,orbited,zoomed,advanced:physical(advanced),advancedTrail,savedRevision:saved.revision,cleanup,nativeBeforeExit,nativeAfterExit},null,2));
});
