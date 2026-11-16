import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installNativeDeletionAudit} from './native-gl-audit.ts';
const out=resolve('docs/qa/milestone-8/camera-component/reruns','run-'+Date.now());mkdirSync(out,{recursive:true});
const server=await createServer({root:process.cwd(),cacheDir:'.vite-orbital-camera',server:{host:'127.0.0.1',port:5186,strictPort:true}});await server.listen();
let browser,page;const errors=[],warnings=[],shots=[],checks=[];const started=Date.now();
const vec=a=>new THREE.Vector3(...a),offset=s=>vec(s.camera.position).sub(vec(s.camera.target)),ratio=s=>s.camera.inspection.distance/s.camera.inspection.fitDistance;
const near=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<tolerance,`${a} vs ${b}`);
const nearVector=(a,b,tolerance=1e-9)=>assert(a.distanceTo(b)<tolerance,`${a.toArray()} vs ${b.toArray()}`);
const read=()=>page.evaluate(()=>window.__camera.inspect());
const settle=()=>page.waitForFunction(()=>{const c=window.__camera.scene.controls;return Math.abs(c._sphericalDelta.theta)<1e-14&&Math.abs(c._sphericalDelta.phi)<1e-14&&c._panOffset.lengthSq()<1e-28;},null,{timeout:30000});
const capture=async(name)=>{await page.waitForTimeout(180);const state=await read();await page.screenshot({path:resolve(out,name+'.png')});shots.push({filename:name+'.png',...state});return state;};
async function open(query,size={width:1280,height:720}){page=await browser.newPage({viewport:size});await installNativeDeletionAudit(page);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto('http://127.0.0.1:5186/tools/qa/orbital-camera/orbital-camera.html'+query);await page.waitForFunction(()=>window.__camera?.frames()>5&&window.__camera.scene.qa.getRenderInfo().planet.mapWidth===4096);}
async function close(){await page.evaluate(()=>window.__camera.dispose());const audit=await page.evaluate(()=>window.__allContextDeletionAudit);assert.deepEqual(audit.errors,[]);checks.push({nativeAudit:audit});await page.close();page=null;}
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const size of[{width:1280,height:720},{width:1920,height:1080}]){
  const physical={};let initial;
  for(const variant of['before','after']){
   await open(variant==='before'?'?baseline':'',size);
   for(const [i,t]of[0,240,600,1385].entries()){
    await page.locator('#t'+t).click();const s=await capture(`${size.width}-${variant}-t${t}`);
    if(variant==='before')physical[t]=s.physical;else{assert.deepEqual(s.physical,physical[t]);if(i===0)initial=s;else{near(offset(s).normalize().dot(vec(s.radial)),offset(initial).normalize().dot(vec(initial.radial)));near(ratio(s),ratio(initial));near(vec(s.up).length(),1);}}
   }
   await close();
  }
 }
 await open('?motion');await page.locator('#t240').click();await page.waitForTimeout(200);
 // Real pointer and wheel events, including an actual committed update during
 // an active right-drag. No camera or controls fields are assigned by tests.
 for(let i=0;i<25;i++){const x=570+i%5*8,y=340+i%3*7;await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+(i%2?11:-11),y+5,{steps:3});await page.mouse.up({button:'right'});}
 await page.mouse.move(630,350);await page.mouse.wheel(0,-90);await settle();
 const chosen=await capture('user-chosen-t240');await page.locator('#t600').click();await page.waitForTimeout(250);const moved=await read();
 near(offset(moved).normalize().dot(vec(moved.radial)),offset(chosen).normalize().dot(vec(chosen.radial)),1e-6);near(ratio(moved),ratio(chosen),1e-6);
 // Enter orbit map, change its view, advance actual time while outside craft,
 // then return. Saved craft zoom and radial-relative bearing must survive.
 await page.locator('#orbit').click();await page.mouse.move(630,340);await page.mouse.down({button:'right'});await page.mouse.move(670,355,{steps:4});await page.mouse.up({button:'right'});await page.mouse.wheel(0,60);await settle();const map=await read();
 await page.locator('#t1385').click();await page.waitForTimeout(200);const mapLater=await read();nearVector(vec(map.camera.position),vec(mapLater.camera.position),1e-6);nearVector(vec(map.up),vec(mapLater.up));
 await page.locator('#craft').click();await page.waitForTimeout(200);const returned=await capture('saved-craft-return-t1385');near(ratio(returned),ratio(moved),1e-6);near(offset(returned).normalize().dot(vec(returned.radial)),offset(moved).normalize().dot(vec(moved.radial)),1e-6);
 await page.locator('#orbit').click();await page.waitForTimeout(200);const mapReturned=await read();nearVector(vec(mapReturned.camera.position),vec(mapLater.camera.position),1e-6);nearVector(vec(mapReturned.up),vec(mapLater.up));await page.locator('#craft').click();
 const paused=await read();await page.waitForTimeout(500);const pausedLater=await read();nearVector(vec(paused.camera.position),vec(pausedLater.camera.position),1e-9);nearVector(vec(paused.up),vec(pausedLater.up),1e-12);
 for(let i=0;i<3;i++){await page.evaluate(()=>{window.__loss=window.__camera.scene.qa.canvas.getContext('webgl2').getExtension('WEBGL_lose_context');window.__loss.loseContext();});await page.waitForFunction(()=>window.__camera.scene.getState().contextLost);await page.evaluate(()=>window.__loss.restoreContext());await page.waitForFunction(()=>!window.__camera.scene.getState().contextLost);await page.waitForTimeout(120);}
 const restored=await capture('native-restored');assert.deepEqual(restored.physical,paused.physical);nearVector(vec(restored.camera.position),vec(paused.camera.position),1e-9);
 await page.locator('#t240').click();await page.mouse.move(630,340);await page.mouse.down({button:'right'});await page.mouse.move(650,346,{steps:4});await page.evaluate(()=>window.__camera.commit(2));const during=await read();await page.mouse.move(674,355,{steps:4});await page.mouse.up({button:'right'});await settle();const afterDrag=await capture('committed-during-pointer-drag');assert(offset(afterDrag).normalize().distanceTo(offset(during).normalize())>1e-4);
 await page.locator('#battery').click();await page.locator('#t1385').click();await page.waitForTimeout(200);const focused=await read(),focusTarget=await page.evaluate(()=>{const s=window.__camera.scene;return s.partBounds.get('battery').getCenter(s.controls.target.clone()).applyMatrix4(s.body.matrixWorld).toArray();});nearVector(vec(focused.camera.target),vec(focusTarget));assert.equal(focused.state.selectedPartId,'battery');
 checks.push({pointerDrags:26,defaultSnapshots:[0,240,600,1385],userViewTransport:true,modeRestore:true,pausedStable:true,contextRestores:3,activeGestureAcrossCommit:true,selectedPartTargetPreserved:true,dampingGate:'Actual pending angular deltas below1e-14, never reset by harness'});await close();
 assert.deepEqual(errors,[]);assert.deepEqual(warnings.filter(w=>/INVALID_OPERATION|does not belong to this context/.test(w)),[]);
 writeFileSync(resolve(out,'report.json'),JSON.stringify({status:'pass',durationMs:Date.now()-started,browser:browser.version(),scope:'Actual authored repair replay snapshots in DeploymentScene component; matched baseline physics at two resolutions, user pointer/zoom, mode restore, pause and native lifecycle. Not full product UI or FPS acceptance.',sourceHashes:Object.fromEntries(['src/render/deployment-scene.ts','src/render/deployment-scene-types.ts','src/render/orbital-inspection-follow.ts','docs/qa/milestone-8/camera-component/runtime/camera-replay-fixture.json'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),shots,checks,errors,warnings},null,2));console.log('PASS '+(Date.now()-started)+'ms');
}catch(e){if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(e),errors,warnings,shots,checks},null,2));throw e;}finally{await browser?.close();await server.close();}
