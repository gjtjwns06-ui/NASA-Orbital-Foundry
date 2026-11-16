import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifacts=join(process.cwd(),'tests/browser/artifacts/hardware-resilience');mkdirSync(artifacts,{recursive:true});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());
const action=(page:Page,name:string)=>page.locator(`[data-action="${name}"]`).first().click();
async function ready(page:Page){await page.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return !s.pending&&s.revision===s.acceptedRevision&&!g.scene.tween;},null,{timeout:30000});}

test('hardware spacecraft survives actual WebGL loss with restored materials unchanged paused state and resumed motion',async({page},info)=>{
  test.setTimeout(60000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  try{
    await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});
    await action(page,'missions');await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await ready(page);
    await action(page,'preset-balanced');await ready(page);const design=(await state(page)).design;expect(design.hardwareVersion).toBe('hardware-2.0.0');expect(design.parts.every((p:any)=>Boolean(p.modelId))).toBe(true);
    await action(page,'plan');await ready(page);await action(page,'launch');await expect(page.locator('#flight-time')).toBeVisible();await page.locator('[data-speed="600"]').click();
    await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(300);
    const previous=await page.evaluate(()=>{const s=(window as any).__game.scene;return {environment:s.scene.environment.uuid,parts:Array.from(s.parts.entries()).map(([id,p]:any)=>({id,modelKey:p.userData.modelKey,uuid:p.uuid}))};});
    expect(previous.parts).toHaveLength(design.parts.length);
    for(const part of design.parts)expect(previous.parts.find((p:any)=>p.id===part.id)?.modelKey).toBe(`hardware-2.0.0:${part.kind}:${part.modelId}`);
    await page.evaluate(()=>{const s=(window as any).__game.scene,e=s.renderer.getContext().getExtension('WEBGL_lose_context');if(!e)throw Error('WEBGL_lose_context unavailable');(window as any).__hardwareContextExtension=e;e.loseContext();});
    await expect.poll(async()=>(await state(page)).playing).toBe(false);await expect(page.getByRole('status')).toContainText('그래픽 컨텍스트');const checkpoint=(await state(page)).sim;
    expect(checkpoint.modelVersion).toBe('2.0.0');await page.waitForTimeout(350);expect((await state(page)).sim).toEqual(checkpoint);
    await page.evaluate(()=>(window as any).__hardwareContextExtension.restoreContext());
    await page.waitForFunction(previousEnvironment=>{const s=(window as any).__game.scene;return !s.renderer.getContext().isContextLost()&&s.scene.environment.uuid!==previousEnvironment&&s.renderer.info.render.calls>0;},previous.environment);
    const restored=await page.evaluate(()=>{const s=(window as any).__game.scene;s.render(0);const gl=s.renderer.getContext(),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const colors=new Set<number>();for(let i=0;i<pixels.length;i+=64)colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);return {environment:s.scene.environment.uuid,calls:s.renderer.info.render.calls,colors:colors.size,parts:Array.from(s.parts.entries()).map(([id,p]:any)=>({id,modelKey:p.userData.modelKey,uuid:p.uuid}))};});
    expect(restored.environment).not.toBe(previous.environment);expect(restored.calls).toBeGreaterThan(0);expect(restored.colors).toBeGreaterThan(100);expect(restored.parts).toEqual(previous.parts);expect((await state(page)).sim).toEqual(checkpoint);
    const startPosition=await page.evaluate(()=>{const p=(window as any).__game.scene.craft.position;return [p.x,p.y,p.z];});await page.keyboard.press('Space');await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(checkpoint.time+100);await page.keyboard.press('Space');
    expect(await page.evaluate(()=>{const p=(window as any).__game.scene.craft.position;return [p.x,p.y,p.z];})).not.toEqual(startPosition);
    expect((await state(page)).sim.design).toEqual(design);await page.screenshot({path:join(artifacts,'hardware-context-restored-1280x720.png'),fullPage:true});
    await info.attach('actual-hardware-context',{body:JSON.stringify({previous,restored,pausedTime:checkpoint.time,resumedTime:(await state(page)).sim.time},null,2),contentType:'application/json'});
  }finally{
    const report={title:info.title,browser:page.context().browser()?.version(),scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),errors};writeFileSync(join(artifacts,'hardware-context-result.json'),JSON.stringify(report,null,2));
    await info.attach('hardware-context-browser-evidence',{body:JSON.stringify(report,null,2),contentType:'application/json'});expect(errors).toEqual([]);
  }
});
