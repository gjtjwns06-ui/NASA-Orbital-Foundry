import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {installNativeDeletionAudit} from './native-gl-audit.ts';
const candidate=process.env.SURFACE_CANDIDATE||'surface-v1';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate name');
const out=resolve('docs/qa/'+candidate);mkdirSync(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const sourcePaths=['src/render/deployment-surface-finish.ts','src/render/deployment-view.ts','src/render/deployment-scene.ts','src/render/deployment-scene-types.ts','src/render/deployment-link-meshes.ts','src/render/deployment-chassis-art.ts','src/render/deployment-internal-art.ts','src/render/earth-surface-detail.ts'];
const freeze=()=>Object.fromEntries(sourcePaths.map(p=>[p,sha(readFileSync(p))]));
const sourcesBefore=freeze(),server=await createServer({root:process.cwd(),cacheDir:'.vite-surfaces',server:{host:'127.0.0.1',port:5194,strictPort:true}});
await server.listen();let browser,page,scope='';const errors=[],warnings=[],shots=[],checks=[],started=Date.now();
async function open(url,viewport={width:1280,height:720}){
 page=await browser.newPage({viewport});await installNativeDeletionAudit(page);
 page.on('pageerror',e=>errors.push({scope,message:String(e)}));page.on('console',m=>{if(m.type()==='error')errors.push({scope,message:m.text()});if(m.type()==='warning')warnings.push({scope,message:m.text()});});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push({scope,message:r.status()+' '+r.url()});});await page.goto('http://127.0.0.1:5194'+url);
}
const inspect=()=>page.evaluate(()=>window.__surface.inspect());
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
async function capture(name){await settle();const s=await inspect();await page.screenshot({path:resolve(out,name+'.png')});shots.push({name:name+'.png',camera:s.camera,finish:s.finish,textures:s.textures,render:s.render,physicalSha256:sha(JSON.stringify(s.physical))});return s;}
async function restore(expression){
 await page.evaluate(e=>{const s=Function('return '+e)();window.__surfaceLoss=s.qa.canvas.getContext('webgl2').getExtension('WEBGL_lose_context');window.__surfaceLoss.loseContext();},expression);
 await page.waitForFunction(e=>Function('return '+e)().getState().contextLost,expression);await page.evaluate(()=>window.__surfaceLoss.restoreContext());
 await page.waitForFunction(e=>!Function('return '+e)().getState().contextLost,expression);await settle();
}
async function close(component){
 if(component)await page.evaluate(()=>window.__surface.dispose());const native=await page.evaluate(()=>window.__allContextDeletionAudit);assert.deepEqual(native.errors,[]);checks.push({scope,native});await page.close();page=null;
}
const textureIdentity=s=>s.textures.map(t=>({uuid:t.uuid,name:t.name,bytes:t.bytes}));
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const viewport of [{width:1280,height:720},{width:1920,height:1080}]){
  scope='component-'+viewport.width;await open('/tools/surface-finish.html',viewport);
  await page.waitForFunction(()=>window.__surface?.frames()>5&&window.__surface.inspect().detail.activeMapWidth===16384,null,{timeout:120000});
  for(let i=0;i<4;i++){
   await page.evaluate(i=>window.__surface.commit(i),i);await page.locator('#flat').click();const before=await capture(`${viewport.width}-t${[0,240,600,1385][i]}-flat`);
   await page.locator('#textured').click();const after=await capture(`${viewport.width}-t${[0,240,600,1385][i]}-textured`);
   assert.deepEqual(after.physical,before.physical);assert.deepEqual(after.camera,before.camera);assert.equal(after.render.calls,before.render.calls);assert.equal(after.render.triangles,before.render.triangles);assert.equal(after.finish.cachedTextures,4);
   checks.push({scope,time:[0,240,600,1385][i],physicalAndCameraExact:true,calls:after.render.calls,triangles:after.render.triangles,textureDelta:after.render.memory.textures-before.render.memory.textures});
  }
  await page.locator('#working').click();await page.locator('#flat').click();const flat=await capture(viewport.width+'-working-faces-flat');await page.locator('#textured').click();const finished=await capture(viewport.width+'-working-faces-textured');assert.deepEqual(finished.physical,flat.physical);assert.deepEqual(finished.camera,flat.camera);
  if(viewport.width===1280){
   const ids=textureIdentity(finished);await restore('window.__surface.scene');let restored=await inspect();assert.deepEqual(restored.physical,finished.physical);assert.deepEqual(textureIdentity(restored),ids);
   await page.locator('#flat').click();await restore('window.__surface.scene');await page.locator('#textured').click();await settle();restored=await inspect();assert.deepEqual(restored.physical,finished.physical);assert.deepEqual(textureIdentity(restored),ids);
   await restore('window.__surface.scene');await capture('three-restores-textured');
   const canvas=await page.locator('canvas').boundingBox(),center={x:canvas.width*.55,y:canvas.height*.53};await page.mouse.move(center.x,center.y);await page.mouse.down({button:'right'});await page.mouse.move(center.x+86,center.y+31,{steps:10});await page.mouse.up({button:'right'});await page.mouse.wheel(0,-90);await settle();
   const moved=await inspect();assert.notDeepEqual(moved.camera.position,finished.camera.position);assert.deepEqual(moved.physical,finished.physical);await capture('real-orbit-zoom-textured');
   await page.evaluate(()=>window.__surface.replaceCraft());await settle();const replaced=await inspect();assert.deepEqual(replaced.physical,finished.physical);assert.equal(replaced.finish.cachedTextures,4);assert(textureIdentity(replaced).every(t=>!ids.some(old=>old.uuid===t.uuid)));checks.push({scope,threeNativeRestores:true,inactiveMapsReactivated:true,actualOrbitWheel:true,sourceReplacementOwnsFreshMaps:true});
  }
  await close(true);
 }
 scope='actual-ui';await open('/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady);await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-deployment"]').click();
 const ready=()=>page.waitForFunction(()=>{const s=window.__game.deployment()?.getState();return s&&!s.pending&&!s.busy&&!s.restoring&&!s.saving;},null,{timeout:120000});await ready();
 const chooser=page.waitForEvent('filechooser');await page.locator('[data-deployment-action="import"]').click();await(await chooser).setFiles({name:'actual-repaired-terminal.json',mimeType:'application/json',buffer:readFileSync('docs/actual-camera-input.json')});
 await page.waitForFunction(()=>window.__game.deployment()?.getState().runtime?.status==='complete',null,{timeout:120000});await ready();await page.locator('[data-deployment-action="working-faces"]').click();
 await page.waitForFunction(()=>window.__game.deployment().scene.getEarthSurfaceDetailState().activeMapWidth===16384,null,{timeout:120000});
 const actual=()=>page.evaluate(()=>{const d=window.__game.deployment(),s=d.getState();return {physical:{runtime:s.runtime,craft:s.craft,plan:s.plan,telemetry:s.telemetry,result:s.result},camera:d.scene.qa.getCamera(),finish:d.scene.getSurfaceFinishState(),render:d.scene.qa.getRenderInfo()};});
 const before=await actual();await page.screenshot({path:resolve(out,'actual-ui-flat.png')});await page.evaluate(()=>window.__game.deployment().scene.setSurfaceFinish('textured'));await settle();const after=await actual();await page.screenshot({path:resolve(out,'actual-ui-textured.png')});assert.deepEqual(after.physical,before.physical);assert.deepEqual(after.camera,before.camera);assert.equal(after.render.calls,before.render.calls);assert.equal(after.render.triangles,before.render.triangles);
 await restore('window.__game.deployment().scene');await ready();const restored=await actual();assert.deepEqual(restored.physical,before.physical);assert.equal(restored.finish.style,'textured');checks.push({scope,strictActualReplay:true,physicalAndCameraExact:true,appearanceApiOnly:true,runtimeSha256:sha(JSON.stringify(before.physical.runtime)),before:{finish:before.finish,render:before.render},after:{finish:after.finish,render:after.render}});
 await page.locator('[data-deployment-action="exit"]').click();await page.waitForFunction(()=>!document.querySelector('.deployment-experience'));await close(false);
 assert.deepEqual(errors,[]);assert.deepEqual(freeze(),sourcesBefore);const report={status:'pass',candidate,durationMs:Date.now()-started,browser:browser.version(),scope:'Matched visual, actual replay and resource-lifetime proof. CPU work may occur; no isolated FPS claim. Product default remains flat pending review.',sourcesBefore,sourcesAfter:freeze(),shots,checks,errors,warnings};writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log('PASS '+report.durationMs+'ms');
}catch(e){if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});writeFileSync(resolve(out,'failure.json'),JSON.stringify({candidate,scope,error:String(e),sourcesBefore,sourcesAfter:freeze(),shots,checks,errors,warnings},null,2));throw e;}finally{await browser?.close();await server.close();}
