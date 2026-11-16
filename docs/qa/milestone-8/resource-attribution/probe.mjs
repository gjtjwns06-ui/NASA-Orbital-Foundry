// Diagnostic attribution only, not a performance benchmark or acceptance rerun.
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),out=join(root,'docs/qa/milestone-8/resource-attribution');
const {installNativeDeletionAudit}=await import(pathToFileURL(join(root,'tests/browser/native-gl-audit.ts')));
const sha=v=>createHash('sha256').update(v).digest('hex');
const files=dir=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]);
const frozen=()=>[...files('src'),...files('public'),...files('dist'),'tests/browser/performance-deployment.mjs','tests/browser/native-gl-audit.ts'].sort().map(path=>({path,sha256:sha(readFileSync(join(root,path)))}));
const before=frozen(),report={purpose:'Read-only ownership/upload attribution, no acceptance threshold change',sourceBefore:before,errors:[],warnings:[],snapshots:[],gestures:[],completed:false};
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-background-timer-throttling']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1}),page=await context.newPage();
await installNativeDeletionAudit(page);
await page.addInitScript(()=>{
 const records=window.__nativeTypeCounters=[],seen=new WeakSet(),original=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(...args){const gl=original.apply(this,args);if(!gl||!/^webgl2?$|experimental-webgl$/.test(String(args[0]))||seen.has(gl))return gl;seen.add(gl);const record={id:records.length+1,kinds:{}};records.push(record);
  for(const kind of ['Buffer','VertexArray','Program','Shader','Texture','Framebuffer','Renderbuffer']){if(!gl['create'+kind])continue;const create=gl['create'+kind].bind(gl),remove=gl['delete'+kind].bind(gl),owned=new WeakSet(),deleted=new WeakSet(),count=record.kinds[kind]={created:0,deleted:0};gl['create'+kind]=(...a)=>{const o=create(...a);if(o){owned.add(o);count.created++;}return o;};gl['delete'+kind]=o=>{const result=remove(o);if(o&&owned.has(o)&&!deleted.has(o)){deleted.add(o);count.deleted++;}return result;};}return gl;
 };
});
page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());if(m.type()==='warning')report.warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
const click=a=>page.locator(`[data-deployment-action="${a}"]`).first().click();
const ready=()=>page.waitForFunction(()=>{const s=window.__game.deployment()?.getState();return s&&!s.busy&&!s.pending&&!s.saving&&!s.closing;},null,{timeout:120000});
try{
 await page.goto('http://127.0.0.1:5188/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady);
 await page.locator('[data-action="settings"]').click();await page.locator('#quality').selectOption('medium');await page.locator('#ui-scale').selectOption('normal');await page.locator('#motion').selectOption('full');await page.locator('[data-action="close-modal"]').click();
 await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-deployment"]').click();await ready();await click('variants');await click('preset:compact');await ready();await click('launch');await page.waitForFunction(()=>Boolean(window.__game.deployment()?.getState().runtime));await click('play');await ready();
 for(let i=0;i<4&&await page.evaluate(()=>window.__game.deployment().getState().speed!==1);i++)await click('speed');
 await page.evaluate(()=>{
  const d=window.__game.deployment();window.__resourceTrace=[];
  window.__resourceSnapshot=label=>{
   const s=d.scene,r=s.renderer,trail=s.trail,geometries=new Map(),materials=new Map(),objects=[];
   s.scene.traverse(o=>{if(o.geometry){const g=o.geometry;geometries.set(g.id,{id:g.id,uuid:g.uuid,type:g.type,disposeListeners:g._listeners?.dispose?.length??0,owners:[]});}for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[]){const p=r.properties.has(m)?r.properties.get(m):null;materials.set(m.id,{id:m.id,uuid:m.uuid,type:m.type,programIds:p?.programs?[...p.programs.values()].map(p=>p.id):[],owners:[]});}});
   s.scene.traverse(o=>{if(o.geometry){geometries.get(o.geometry.id).owners.push(o.name||o.type);objects.push({id:o.id,name:o.name,type:o.type,geometry:o.geometry.id,materials:(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean).map(m=>m.id),visible:o.visible,frustumCulled:o.frustumCulled});}for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[])materials.get(m.id).owners.push(o.name||o.type);});
   let trailState=null;
   if(trail){const a=trail.geometry.attributes.position.array,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.length;i++) {lo[i%3]=Math.min(lo[i%3],a[i]);hi[i%3]=Math.max(hi[i%3],a[i]);}const center=lo.map((v,i)=>(v+hi[i])/2);let radius=0;for(let i=0;i<a.length;i+=3)radius=Math.max(radius,Math.hypot(a[i]-center[0],a[i+1]-center[1],a[i+2]-center[2]));const world=s.camera.position.clone().set(...center).applyMatrix4(trail.matrixWorld),m=s.camera.projectionMatrix.clone().multiply(s.camera.matrixWorldInverse).elements;const rows=[0,1,2,3].map(j=>[m[j],m[j+4],m[j+8],m[j+12]]),planes=[];for(const axis of [0,1,2])for(const sign of [-1,1]){const p=rows[3].map((n,i)=>n+sign*rows[axis][i]),len=Math.hypot(...p.slice(0,3));planes.push(p.map(n=>n/len));}const distances=planes.map(p=>p[0]*world.x+p[1]*world.y+p[2]*world.z+p[3]);const prop=r.properties.has(trail.material)?r.properties.get(trail.material):null;
    trailState={objectId:trail.id,geometryId:trail.geometry.id,materialId:trail.material.id,historyPoints:a.length/3,geometryUploaded:(trail.geometry._listeners?.dispose?.length??0)>0,materialUploaded:Boolean(prop?.programs?.size),programIds:prop?.programs?[...prop.programs.values()].map(p=>p.id):[],frustumIntersects:distances.every(n=>n>=-radius),planeDistances:distances,boundingSphereRadius:radius,visible:trail.visible,parentVisible:trail.parent?.visible,layerMask:trail.layers.mask};
   }
   const state=d.getState(),ownedGeometries=[...geometries.values()].sort((a,b)=>a.id-b.id),ownedMaterials=[...materials.values()].sort((a,b)=>a.id-b.id);
   return {label,wall:performance.now(),physicalTime:state.runtime?.time,playing:state.playing,motorEnergyJ:state.runtime?.motorEnergyJ,geometryCount:r.info.memory.geometries,textureCount:r.info.memory.textures,programCount:r.info.programs.length,programs:r.info.programs.map(p=>({id:p.id,usedTimes:p.usedTimes,name:p.name})),trail:trailState,ownedGeometries,ownedMaterials,objects,nonTrailGeometryIds:ownedGeometries.filter(g=>g.id!==trail?.geometry.id).map(g=>g.id),nonTrailMaterialIds:ownedMaterials.filter(m=>m.id!==trail?.material.id).map(m=>m.id),native:structuredClone(window.__nativeTypeCounters),camera:s.qa.getCamera(),nativeAudit:structuredClone(window.__allContextDeletionAudit)};
  };
  let captured=0;d.worker.addEventListener('message',event=>{if(!window.__resourceCapture||!['runtime','runtime-progress','paused'].includes(event.data.type)||captured>=8)return;captured++;queueMicrotask(()=>{window.__resourceTrace.push(window.__resourceSnapshot('worker-message-'+captured));requestAnimationFrame(()=>window.__resourceTrace.push(window.__resourceSnapshot('next-rAF-'+captured)));});});
 });
 report.snapshots.push(await page.evaluate(()=>window.__resourceSnapshot('paused-initial')));
 await click('step');await ready();await page.waitForTimeout(300);report.pausedRuntimeBefore=await page.evaluate(()=>window.__game.deployment().getState().runtime);report.snapshots.push(await page.evaluate(()=>window.__resourceSnapshot('paused-actual-plus60')));
 const point=await page.evaluate(()=>{const d=window.__game.deployment(),v=d.scene.qa.getCamera().inspection.viewport,r=d.scene.qa.canvas.getBoundingClientRect();return {x:r.left+(v.left+r.width-v.right)/2,y:r.top+(v.top+r.height-v.bottom)/2};});
 for(const sign of [1,-1,1,-1]){const end={x:point.x+80*sign,y:point.y-45*sign};const hit=await page.evaluate(points=>points.every(p=>document.elementFromPoint(p.x,p.y)===window.__game.deployment().scene.qa.canvas),[point,end]);if(!hit)throw Error('Camera gesture is covered by UI');await page.mouse.move(point.x,point.y);await page.mouse.down({button:'right'});await page.mouse.move(end.x,end.y,{steps:10});await page.mouse.up({button:'right'});await page.waitForTimeout(300);report.gestures.push({from:point,to:end,nativeRightDrag:true});report.snapshots.push(await page.evaluate(()=>window.__resourceSnapshot('paused-after-native-drag')));}
 report.pausedRuntimeAfter=await page.evaluate(()=>window.__game.deployment().getState().runtime);report.pausedRuntimeUnchanged=JSON.stringify(report.pausedRuntimeBefore)===JSON.stringify(report.pausedRuntimeAfter);
 await page.evaluate(()=>window.__resourceCapture=true);await click('play');await page.waitForTimeout(3000);await click('play');await ready();await page.waitForTimeout(100);report.trace=await page.evaluate(()=>window.__resourceTrace);report.snapshots.push(await page.evaluate(()=>window.__resourceSnapshot('paused-after-actual3seconds')));await click('exit');await page.waitForFunction(()=>!window.__game.deployment());report.finalNative=await page.evaluate(()=>({audit:window.__allContextDeletionAudit,kinds:window.__nativeTypeCounters}));report.completed=true;
}catch(e){report.failure=e.stack||String(e);}finally{report.sourceAfter=frozen();report.frozenUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({completed:report.completed,pausedRuntimeUnchanged:report.pausedRuntimeUnchanged,frozenUnchanged:report.frozenUnchanged,errors:report.errors,failure:report.failure,snapshots:report.snapshots.map(s=>({label:s.label,time:s.physicalTime,geometries:s.geometryCount,programs:s.programCount,trail:s.trail})),trace:report.trace?.map(s=>({label:s.label,time:s.physicalTime,geometries:s.geometryCount,programs:s.programCount,trail:s.trail}))}));
if(!report.completed||report.errors.length||!report.frozenUnchanged)process.exitCode=1;
