import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifactDir=join(process.cwd(),'tests/browser/artifacts/control-room');mkdirSync(artifactDir,{recursive:true});
const test=base.extend<{logs:string[]}>({logs:[async({page},use,info)=>{
  const logs:string[]=[];page.on('pageerror',e=>logs.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('favicon.ico'))logs.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))logs.push(`${r.status()} ${r.url()}`);});
  await use(logs);
  const record={test:info.title,status:info.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors:logs,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[])};
  writeFileSync(join(artifactDir,info.title.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase()+'.json'),JSON.stringify(record,null,2));
  await info.attach('control-room-browser-evidence',{body:JSON.stringify(record,null,2),contentType:'application/json'});
  if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
  expect(logs,'No browser exceptions, WebGL errors or application resource failures').toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720}});
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());
async function action(page:Page,name:string){await page.locator(`[data-action="${name}"]`).first().click();}
async function ready(page:Page){await page.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return !s.pending&&s.revision===s.acceptedRevision&&!g.scene.tween;});}
async function launchMars(page:Page){
  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});
  // Every mission/preset/launch choice uses the real UI; the hook only observes.
  await action(page,'missions');await page.locator('[data-mission="mars"]').click();await ready(page);
  await action(page,'preset-balanced');await ready(page);await action(page,'plan');await ready(page);await action(page,'launch');
  await expect(page.locator('#flight-time')).toBeVisible();await expect.poll(async()=>(await state(page)).playing).toBe(true);
  await action(page,'play-pause');await ready(page);expect((await state(page)).playing).toBe(false);
}
async function enter(page:Page){await action(page,'control-room');await page.waitForFunction(()=>{const s=(window as any).__game.scene;return s.controlRoomActive&&s.controlRoom?.ready;});}
async function screenPixels(page:Page){return page.evaluate(()=>{
  const s=(window as any).__game.scene,target=s.controlRoom.screen,pixels=new Uint8Array(target.width*target.height*4);
  s.renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);
  let nonblack=0,hash=2166136261;const colors=new Set<number>();
  for(let i=0;i<pixels.length;i+=64){const rgb=(pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2];if(rgb>0)nonblack++;colors.add(rgb);hash=Math.imul(hash^rgb,16777619);}
  return {width:target.width,height:target.height,nonblack,colors:colors.size,hash:hash>>>0};
});}

test('control room lazily loads a real 3D set and live orbital monitor while view changes preserve the paused mission',async({page},info)=>{
  const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/assets/mission-control.glb'))requests.push(r.url());});
  await launchMars(page);expect(requests).toHaveLength(0);expect(await page.evaluate(()=>(window as any).__game.scene.controlRoom)).toBeNull();
  const checkpoint=(await state(page)).sim;await enter(page);expect(requests).toHaveLength(1);
  const details=await page.evaluate(()=>{
    const s=(window as any).__game.scene,room=s.controlRoom,screen=room.scene.getObjectByName('MainScreen');let meshes=0,vertices=0;
    room.scene.traverse((o:any)=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});
    return {meshes,vertices,screenMesh:screen?.isMesh,mapIsLiveTarget:screen?.material.map===room.screen.texture,isRenderTargetTexture:room.screen.texture.isRenderTargetTexture,screenMaterial:screen?.material.type,roomCameraType:room.camera.type,distinctCamera:room.camera!==s.camera,orbitDisabled:!s.controls.enabled,roomControlsEnabled:room.controls.enabled,camera:room.camera.position.toArray()};
  });
  expect(details.meshes).toBeGreaterThan(10);expect(details.vertices).toBeGreaterThan(1000);expect(details.screenMesh).toBe(true);expect(details.mapIsLiveTarget).toBe(true);expect(details.isRenderTargetTexture).toBe(true);expect(details.screenMaterial).toBe('MeshBasicMaterial');expect(details.roomCameraType).toBe('PerspectiveCamera');expect(details.distinctCamera).toBe(true);expect(details.orbitDisabled).toBe(true);expect(details.roomControlsEnabled).toBe(true);
  // Observe actual render calls, not only texture metadata. Both cameras must be
  // used every frame, and the orbital pass must target the monitor framebuffer.
  const passes=await page.evaluate(async()=>{
    const s=(window as any).__game.scene,r=s.renderer,room=s.controlRoom,original=r.render;let orbital=0,interior=0;
    r.render=function(scene:any,camera:any){if(scene===s.scene&&camera===s.camera&&this.getRenderTarget()===room.screen)orbital++;if(scene===room.scene&&camera===room.camera&&this.getRenderTarget()===null)interior++;return original.call(this,scene,camera);};
    try{await new Promise(resolve=>setTimeout(resolve,180));return {orbital,interior};}finally{r.render=original;}
  });
  expect(passes.orbital).toBeGreaterThan(1);expect(passes.interior).toBe(passes.orbital);
  const pixels=await screenPixels(page);expect(pixels.width).toBe(1280);expect(pixels.height).toBe(720);expect(pixels.nonblack).toBeGreaterThan(1000);expect(pixels.colors).toBeGreaterThan(100);
  const point=await page.evaluate(()=>{for(const y of [270,350,220])for(const x of [640,720,530])if(document.elementFromPoint(x,y)?.id==='universe')return {x,y};throw Error('Room canvas is covered by UI');});
  await page.mouse.move(point.x,point.y);await page.mouse.down({button:'right'});await page.mouse.move(point.x+90,point.y+10,{steps:14});await page.mouse.up({button:'right'});await page.waitForTimeout(250);
  expect(await page.evaluate(()=>(window as any).__game.scene.controlRoom.camera.position.toArray())).not.toEqual(details.camera);expect((await state(page)).sim).toEqual(checkpoint);
  await page.locator('.toast').waitFor({state:'hidden',timeout:5500});await page.screenshot({path:join(artifactDir,'control-room-live-1280x720.png'),fullPage:true});
  await action(page,'control-room');expect(await page.evaluate(()=>(window as any).__game.scene.controlRoomActive)).toBe(false);expect((await state(page)).sim).toEqual(checkpoint);
  await enter(page);expect(requests).toHaveLength(1);expect((await state(page)).sim).toEqual(checkpoint);
  await info.attach('room-scene-evidence',{body:JSON.stringify({details,passes,pixels,requests},null,2),contentType:'application/json'});
  writeFileSync(join(artifactDir,'scene-evidence.json'),JSON.stringify({details,passes,pixels,requests},null,2));
});

test('WebGL restoration rebuilds the live control-room target and resumes the same real Mars mission',async({page})=>{
  await launchMars(page);await enter(page);await page.locator('[data-speed="60"]').click();await action(page,'play-pause');
  const initial=(await state(page)).sim.time;await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(initial+5);
  await page.evaluate(()=>{const s=(window as any).__game.scene,extension=s.renderer.getContext().getExtension('WEBGL_lose_context');if(!extension)throw Error('WEBGL_lose_context unavailable');(window as any).__roomContextExtension=extension;extension.loseContext();});
  await expect.poll(async()=>(await state(page)).playing).toBe(false);const checkpoint=(await state(page)).sim;
  await page.waitForTimeout(300);expect((await state(page)).sim).toEqual(checkpoint);
  await page.evaluate(()=>(window as any).__roomContextExtension.restoreContext());
  await page.waitForFunction(()=>{const s=(window as any).__game.scene;return !s.renderer.getContext().isContextLost()&&s.renderer.info.render.calls>0;});
  await expect.poll(async()=>(await screenPixels(page)).colors).toBeGreaterThan(100);expect((await state(page)).sim).toEqual(checkpoint);
  expect(await page.evaluate(()=>{const s=(window as any).__game.scene;return s.controlRoomActive&&s.controlRoom.scene.getObjectByName('MainScreen').material.map===s.controlRoom.screen.texture;})).toBe(true);
  await action(page,'play-pause');await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(checkpoint.time+10);await action(page,'play-pause');
  const resumed=(await state(page)).sim;expect(resumed.design).toEqual(checkpoint.design);expect(resumed.status).toBe('running');
  await page.locator('.toast').waitFor({state:'hidden',timeout:5500});await page.screenshot({path:join(artifactDir,'control-room-context-restored-1280x720.png'),fullPage:true});
});
