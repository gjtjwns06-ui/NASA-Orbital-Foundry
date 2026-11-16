import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

test.use({viewport:{width:1280,height:720}});
test('M03 repeated real context recovery retires old PMREM handles without cross-context deletion',async({page},info)=>{
 test.setTimeout(90000);
 const tag=(process.env.CONTEXT_QA_TAG||'current').replace(/[^a-zA-Z0-9_-]/g,'-');
 const folder=join(process.cwd(),'tests/browser/artifacts/transfer-context-ownership',tag);mkdirSync(folder,{recursive:true});
 const warnings:string[]=[],errors:string[]=[];const cycles:any[]=[];
 page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());if(message.type()==='error')errors.push(message.text());});
 page.on('pageerror',error=>errors.push(error.stack||error.message));
 try{
  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
  await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-transfer"]').click();await page.locator('.tab[data-action="plan"]').click();
  await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return t&&!t.pending;},null,{timeout:30000});
  await page.locator('[data-transfer-action="launch"]').click();await page.waitForFunction(()=>Boolean((window as any).__game.transfer()?.runtime));
  await page.locator('[data-transfer-action="view-earth"]').click();
  await page.locator('[data-transfer-action="speed-600"]').click();
  if(!await page.evaluate(()=>(window as any).__game.transfer().playing))await page.locator('[data-transfer-action="play"]').click();
  await page.waitForFunction(()=>(window as any).__game.transfer().runtime.time>300);
  await page.evaluate(()=>{
   const scene=(window as any).__game.transfer().scene,gl=scene.renderer.getContext();
   const audit:any=(window as any).__contextDeletionAudit={errors:[],contextLostNotifications:0,labels:new WeakMap(),phase:'running',targets:[],extension:gl.getExtension('WEBGL_lose_context')};
   if(!audit.extension)throw new Error('WEBGL_lose_context unavailable');
   for(const name of ['deleteTexture','deleteFramebuffer','deleteRenderbuffer','deleteProgram','deleteBuffer','deleteVertexArray','deleteShader']){
    const original=gl[name].bind(gl);
    gl[name]=(object:object)=>{
     const previous=gl.getError();const result=original(object);const error=gl.getError();
     // The spec reports CONTEXT_LOST_WEBGL once after a real loss. It is not an
     // invalid deletion; retain its count while requiring all other errors zero.
     if(previous===gl.CONTEXT_LOST_WEBGL||error===gl.CONTEXT_LOST_WEBGL)audit.contextLostNotifications++;
     if((previous&&previous!==gl.CONTEXT_LOST_WEBGL)||(error&&error!==gl.CONTEXT_LOST_WEBGL))audit.errors.push({name,previous,error,phase:audit.phase,resource:audit.labels.get(object)||'unlabelled transient',stack:new Error().stack});
     return result;
    };
   }
  });
  for(let cycle=0;cycle<3;cycle++){
   const before=await page.evaluate(()=>{
    const scene=(window as any).__game.transfer().scene,audit=(window as any).__contextDeletionAudit,target=scene.environment;
    const record={uuid:target.texture.uuid,disposals:0};target.addEventListener('dispose',()=>record.disposals++);audit.targets.push(record);
    const label=(value:any,path:string,depth=0)=>{if(!value||depth>3)return;if(Array.isArray(value)){value.forEach((entry,index)=>label(entry,`${path}[${index}]`,depth+1));return;}if(typeof value==='object'&&/^WebGL/.test(value.constructor?.name||''))audit.labels.set(value,path);};
    for(const [key,value] of Object.entries(scene.renderer.properties.get(target)))label(value,'old PMREM target.'+key);
    for(const [key,value] of Object.entries(scene.renderer.properties.get(target.texture)))label(value,'old PMREM texture.'+key);
    audit.phase='lost';audit.extension.loseContext();return record.uuid;
   });
   await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return t.scene.lost&&!t.playing&&!t.busy;});
   const checkpoint=await page.evaluate(()=>structuredClone((window as any).__game.transfer().runtime));await page.waitForTimeout(100);
   expect(await page.evaluate(()=>(window as any).__game.transfer().runtime)).toEqual(checkpoint);
   await page.evaluate(()=>{const audit=(window as any).__contextDeletionAudit;audit.phase='restoring';audit.extension.restoreContext();});
   await page.waitForFunction(()=>{const s=(window as any).__game.transfer().scene;return !s.lost&&!s.renderer.getContext().isContextLost();});await page.waitForTimeout(150);
   const after=await page.evaluate(()=>{
    const s=(window as any).__game.transfer().scene,audit=(window as any).__contextDeletionAudit;audit.phase='running';s.render(0);
    const gl=s.renderer.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const colors=new Set<number>();for(let n=0;n<pixels.length;n+=64)colors.add((pixels[n]<<16)|(pixels[n+1]<<8)|pixels[n+2]);
    return {environment:s.environment.texture.uuid,disposeCount:audit.targets.at(-1).disposals,calls:s.renderer.info.render.calls,colors:colors.size,resources:{...s.renderer.info.memory,programs:s.renderer.info.programs.length}};
   });
   cycles.push({before,after});expect(after.environment).not.toBe(before);expect(after.disposeCount).toBe(1);expect(after.calls).toBeGreaterThan(0);expect(after.colors).toBeGreaterThan(100);
   expect(await page.evaluate(()=>(window as any).__game.transfer().runtime)).toEqual(checkpoint);
  }
  await page.locator('[data-transfer-action="play"]').click();const time=await page.evaluate(()=>(window as any).__game.transfer().runtime.time);await page.waitForFunction(time=>(window as any).__game.transfer().runtime.time>time+60,time);
  await page.locator('[data-transfer-action="play"]').click();
  await page.screenshot({path:join(folder,'earth-restored-three-times.png')});
  const deletions=await page.evaluate(()=>(window as any).__contextDeletionAudit.errors);
  expect(deletions,'No invalid WebGL deletion, including stale PMREM handles').toEqual([]);
  expect(warnings.filter(text=>/INVALID_OPERATION|does not belong to this context/.test(text)),'No cross-context warnings are filtered out').toEqual([]);
  expect(errors).toEqual([]);
 }finally{
  const evidence={test:info.title,browser:page.context().browser()?.version(),scripts:await page.locator('script[src]').evaluateAll(s=>s.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:page.workers().map(w=>w.url()),cycles,errors,warnings,deletionErrors:await page.evaluate(()=>(window as any).__contextDeletionAudit?.errors||[]).catch(()=>[])};
  writeFileSync(join(folder,'report.json'),JSON.stringify(evidence,null,2));
 }
});

test('hardware flight and live control room survive three restores each without stale target deletion',async({page},info)=>{
 test.setTimeout(90000);
 const tag=(process.env.CONTEXT_QA_TAG||'current').replace(/[^a-zA-Z0-9_-]/g,'-');
 const folder=join(process.cwd(),'tests/browser/artifacts/transfer-context-ownership',tag);mkdirSync(folder,{recursive:true});
 const warnings:string[]=[],errors:string[]=[];const cycles:any[]=[];
 page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());if(message.type()==='error')errors.push(message.text());});page.on('pageerror',error=>errors.push(error.stack||error.message));
 try{
  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
  await page.locator('[data-action="missions"]').click();await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await page.locator('[data-action="preset-balanced"]').click();
  await page.locator('.tab[data-action="plan"]').click();await page.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return !s.pending&&s.acceptedRevision===s.revision;});
  await expect(page.locator('[data-action="launch"]')).toBeEnabled();await page.locator('[data-action="launch"]').click();await expect(page.locator('#flight-time')).toBeVisible();
  await page.locator('[data-speed="60"]').click();await page.waitForFunction(()=>(window as any).__game.getState().sim.time>5);
  await page.evaluate(()=>{
   const s=(window as any).__game.scene,gl=s.renderer.getContext();
   const audit:any=(window as any).__primaryDeletionAudit={errors:[],contextLostNotifications:0,labels:new WeakMap(),phase:'running',targets:[],extension:gl.getExtension('WEBGL_lose_context')};
   if(!audit.extension)throw new Error('WEBGL_lose_context unavailable');
   for(const name of ['deleteTexture','deleteFramebuffer','deleteRenderbuffer','deleteProgram','deleteBuffer','deleteVertexArray','deleteShader']){
    const original=gl[name].bind(gl);gl[name]=(object:object)=>{const previous=gl.getError(),result=original(object),error=gl.getError();
     if(previous===gl.CONTEXT_LOST_WEBGL||error===gl.CONTEXT_LOST_WEBGL)audit.contextLostNotifications++;
     if((previous&&previous!==gl.CONTEXT_LOST_WEBGL)||(error&&error!==gl.CONTEXT_LOST_WEBGL))audit.errors.push({name,previous,error,phase:audit.phase,resource:audit.labels.get(object)||'unlabelled transient',stack:new Error().stack});return result;};
   }
  });
  for(const view of ['flight','control-room']){
   if(view==='control-room'){await page.locator('[data-action="control-room"]').click();await page.waitForFunction(()=>{const s=(window as any).__game.scene;return s.controlRoomActive&&s.controlRoom?.ready;});}
   for(let cycle=0;cycle<3;cycle++){
    const before=await page.evaluate(()=>{
     const scene=(window as any).__game.scene,audit=(window as any).__primaryDeletionAudit;
     const record:any={primary:scene.environmentTarget.texture.uuid,primaryDisposals:0,room:scene.controlRoom?.scene.environment?.uuid??null,roomDisposals:0,screenDisposals:0};
     scene.environmentTarget.addEventListener('dispose',()=>record.primaryDisposals++);
     if(scene.controlRoom?.restoredEnvironment)scene.controlRoom.restoredEnvironment.addEventListener('dispose',()=>record.roomDisposals++);
     if(scene.controlRoom)scene.controlRoom.screen.addEventListener('dispose',()=>record.screenDisposals++);
     const label=(target:any,prefix:string)=>{if(!target)return;for(const [key,value] of Object.entries(scene.renderer.properties.get(target)))if(value&&typeof value==='object')audit.labels.set(value,prefix+'.'+key);for(const [key,value] of Object.entries(scene.renderer.properties.get(target.texture)))if(value&&typeof value==='object')audit.labels.set(value,prefix+'.texture.'+key);};
     label(scene.environmentTarget,'primary PMREM');label(scene.controlRoom?.restoredEnvironment,'room PMREM');label(scene.controlRoom?.screen,'room screen');
     for(const [name,root] of [['primary',scene.scene],['room',scene.controlRoom?.scene]] as const)root?.traverse((object:any)=>{if(object.isLight&&object.shadow){label(object.shadow.map,`${name} shadow map`);label(object.shadow.mapPass,`${name} shadow map pass`);if(object.shadow.map?.depthTexture)for(const [key,value] of Object.entries(scene.renderer.properties.get(object.shadow.map.depthTexture)))if(value&&typeof value==='object')audit.labels.set(value,`${name} shadow depth.${key}`);}});
     audit.targets.push(record);audit.phase='lost';audit.extension.loseContext();return {primary:record.primary,room:record.room,roomWasOwned:!!scene.controlRoom?.restoredEnvironment};
    });
    await page.waitForFunction(()=>{const g=(window as any).__game;return !g.getState().playing&&g.scene.renderer.getContext().isContextLost();});
    const checkpoint=await page.evaluate(()=>structuredClone((window as any).__game.getState().sim));await page.waitForTimeout(100);expect(await page.evaluate(()=>(window as any).__game.getState().sim)).toEqual(checkpoint);
    await page.evaluate(()=>{const a=(window as any).__primaryDeletionAudit;a.phase='restoring';a.extension.restoreContext();});
    await page.waitForFunction(old=>{const s=(window as any).__game.scene;return !s.renderer.getContext().isContextLost()&&s.environmentTarget.texture.uuid!==old&&(!s.controlRoomActive||!s.controlRoom.restoreEnvironment);},before.primary);await page.waitForTimeout(200);
    const after=await page.evaluate(()=>{
     const s=(window as any).__game.scene,a=(window as any).__primaryDeletionAudit;a.phase='running';s.render(0);
     const gl=s.renderer.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const colors=new Set<number>();for(let n=0;n<pixels.length;n+=64)colors.add((pixels[n]<<16)|(pixels[n+1]<<8)|pixels[n+2]);
     let monitorColors=0;if(s.controlRoomActive){const target=s.controlRoom.screen,monitor=new Uint8Array(target.width*target.height*4);s.renderer.readRenderTargetPixels(target,0,0,target.width,target.height,monitor);const values=new Set<number>();for(let n=0;n<monitor.length;n+=64)values.add((monitor[n]<<16)|(monitor[n+1]<<8)|monitor[n+2]);monitorColors=values.size;}
     return {primary:s.environmentTarget.texture.uuid,room:s.controlRoom?.scene.environment?.uuid??null,record:{...a.targets.at(-1)},calls:s.renderer.info.render.calls,colors:colors.size,monitorColors,resources:{...s.renderer.info.memory,programs:s.renderer.info.programs.length}};
    });
    cycles.push({view,cycle,before,after});expect(after.primary).not.toBe(before.primary);expect(after.record.primaryDisposals).toBe(1);expect(after.colors).toBeGreaterThan(100);expect(after.calls).toBeGreaterThan(0);
    if(view==='control-room'){expect(after.room).not.toBe(before.room);expect(after.monitorColors).toBeGreaterThan(100);expect(after.record.screenDisposals).toBe(1);expect(after.record.roomDisposals).toBe(before.roomWasOwned?1:0);}
    expect(await page.evaluate(()=>(window as any).__game.getState().sim)).toEqual(checkpoint);
   }
   await page.screenshot({path:join(folder,`${view}-restored-three-times.png`)});
  }
  await page.locator('[data-action="control-room"]').click();
  await page.waitForFunction(()=>!(window as any).__game.scene.controlRoomActive);
  await page.locator('[data-action="play-pause"]').click();const time=await page.evaluate(()=>(window as any).__game.getState().sim.time);await page.waitForFunction(time=>(window as any).__game.getState().sim.time>time+10,time);await page.locator('[data-action="play-pause"]').click();
  // Actual visible return-to-design and bus replacement dispose old meshes,
  // materials and textures after all six restores; undo rebuilds them again.
  await page.locator('[data-action="finish"]').click();await page.locator('[data-action="retry"]').click();
  const originalBus=await page.evaluate(()=>(window as any).__game.getState().design.busId);
  await page.locator('[data-action="hardware-buses"]').click();
  await page.locator('[data-hardware-bus]:not([disabled])').click();
  await page.waitForFunction(id=>(window as any).__game.getState().design.busId!==id,originalBus);
  await page.keyboard.press('Control+z');await page.waitForFunction(id=>(window as any).__game.getState().design.busId===id,originalBus);
  await page.locator('.tab[data-action="plan"]').click();await page.waitForFunction(()=>!(window as any).__game.getState().pending);
  await page.screenshot({path:join(folder,'post-restore-room-exit-design-rebuild.png')});
  expect(await page.evaluate(()=>(window as any).__primaryDeletionAudit.errors),'No stale target deletion in primary or room').toEqual([]);
  expect(warnings.filter(text=>/INVALID_OPERATION|does not belong to this context/.test(text)),'Cross-context warnings remain hard failures').toEqual([]);expect(errors).toEqual([]);
 }finally{
  writeFileSync(join(folder,'primary-room-report.json'),JSON.stringify({test:info.title,browser:page.context().browser()?.version(),scripts:await page.locator('script[src]').evaluateAll(s=>s.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),cycles,errors,warnings,deletionErrors:await page.evaluate(()=>(window as any).__primaryDeletionAudit?.errors||[]).catch(()=>[])},null,2));
 }
});
