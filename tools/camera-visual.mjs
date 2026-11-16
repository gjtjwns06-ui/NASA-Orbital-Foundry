import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out=new URL('../docs/qa/craft-camera/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-timer-throttling']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],warnings=[],evidence=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
await page.addInitScript(()=>localStorage.setItem('orbital-language','en'));
const capture=async name=>{await page.waitForTimeout(180);await page.screenshot({path:new URL(name+'.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});evidence.push({name,state:await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState())});};
const inspect=async(enabled=true)=>page.evaluate(enabled=>{const e=window.__game.transfer(),canvas=e.scene.canvas.getBoundingClientRect(),left=document.querySelector('.transfer-left').getBoundingClientRect(),right=document.querySelector('.transfer-right').getBoundingClientRect(),hint=document.querySelector('.transfer-hint').getBoundingClientRect(),timeline=document.querySelector('.transfer-timeline').getBoundingClientRect();e.scene.setInspectionViewport({left:left.right-canvas.left+16,right:canvas.right-right.left+16,top:Math.max(hint.bottom-canvas.top+18,130),bottom:canvas.bottom-timeline.top+40});return e.scene.setCraftInspection(enabled);},enabled);
const state=()=>page.evaluate(()=>window.__game.transfer().getState());
const action=async name=>page.locator(`[data-transfer-action="${name}"]`).first().click();
const next=async()=>{const t=(await state()).runtime.time;await action('next');await page.waitForFunction(t=>{const s=window.__game.transfer().getState();return s.runtime.time>t&&!s.playing;},t,{timeout:90000});};
try{
 await page.goto('http://127.0.0.1:5174/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady);
 await page.locator('[data-action="missions"]').click();await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-action="mission-transfer"]').click();await page.locator('[data-action="plan"]').last().click();
 await page.waitForFunction(()=>{const s=window.__game.transfer()?.getState();return s&&!s.pending;},null,{timeout:90000});
 console.log('Hardware M03 ready');await action('launch');await page.waitForFunction(()=>window.__game.transfer().getState().runtime);
 const initial=await state();await inspect();await page.waitForTimeout(450);await capture('earth-current-normal');
 assert.equal((await state()).runtime.time,initial.runtime.time);assert.equal((await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState())).view,'earth');
 const before=await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState());
 await page.mouse.move(640,340);await page.mouse.down({button:'right'});await page.mouse.move(720,305,{steps:16});await page.mouse.up({button:'right'});await page.mouse.wheel(0,-130);await page.waitForTimeout(300);
 const after=await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState());assert.notDeepEqual(after.cameraPosition,before.cameraPosition);assert.deepEqual((await state()).runtime,initial.runtime);assert(after.cameraSurfaceClearance>0);await capture('earth-user-orbit');
 await next();await capture('solar-cruise-current');assert.equal((await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState())).view,'solar');
 await next();assert.equal((await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState())).view,'mars');await capture('mars-soi-current');await next();const peri=await state();writeFileSync(new URL('checkpoint-mars-peri.json',out),JSON.stringify(peri.runtime));console.log('Actual Mars periapsis reached',peri.runtime.time);await inspect(false);await action('view-mars');await inspect();await page.waitForTimeout(400);await capture('mars-current-normal');
 const ui=await page.evaluate(()=>{document.body.classList.add('large-ui');return true;});await page.waitForTimeout(100);await inspect(false);await inspect();await capture('mars-current-large');assert(ui);
 await page.evaluate(()=>document.body.classList.remove('large-ui'));await inspect(false);await inspect();
 const craft=(await state()).craft,solar=craft.parts.find(p=>p.id==='solar-1');
 const screen=await page.evaluate(id=>window.__game.transfer().scene.getInspectionPartScreen(id),solar.id);
 assert(screen?.visible);await page.mouse.click(screen.x,screen.y);assert.equal((await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState())).selectedPartId,solar.id);evidence.push({name:'part-click',selected:await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState())});
 // Focus API is root's future visible-button path; actual double-click is also tested below.
 await page.mouse.dblclick(screen.x,screen.y);assert.equal((await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState())).focusedPartId,solar.id);await capture('solar-array-focus');
 await page.evaluate(()=>window.__game.transfer().scene.focusInspectionPart(null));
 await page.mouse.move(635,340);await page.mouse.down({button:'right'});await page.mouse.move(545,420,{steps:18});await page.mouse.up({button:'right'});await page.waitForTimeout(300);await capture('mars-user-orbit');
 assert.deepEqual((await state()).runtime,peri.runtime);
 const resources=[];for(let i=0;i<30;i++){await inspect(false);await inspect();if(i%10===9){await page.waitForTimeout(50);resources.push(await page.evaluate(()=>{const r=window.__game.transfer().scene.renderer;return {geometry:r.info.memory.geometries,textures:r.info.memory.textures,programs:r.info.programs.length};}));}}
 assert.deepEqual(resources[0],resources[1]);assert.deepEqual(resources[1],resources[2]);
 const ext=await page.evaluate(()=>{const s=window.__game.transfer().scene;window.__cameraLoss=s.renderer.getContext().getExtension('WEBGL_lose_context');window.__cameraLoss.loseContext();return !!window.__cameraLoss;});assert(ext);await page.waitForTimeout(150);await page.evaluate(()=>window.__cameraLoss.restoreContext());await page.waitForTimeout(750);await capture('mars-after-context-restoration');
 assert.deepEqual((await state()).runtime,peri.runtime);assert.equal((await page.evaluate(()=>window.__game.transfer().scene.getCraftInspectionState())).enabled,true);
 await inspect(false);await inspect();await page.waitForTimeout(100);await capture('mars-exit-reenter-after-restoration');
 assert(!warnings.some(w=>/INVALID_OPERATION|does not belong/.test(w)),JSON.stringify(warnings));assert.deepEqual(errors,[]);
 writeFileSync(new URL('report.json',out),JSON.stringify({status:'pass',browser:browser.version(),source:'isolated Vite source, not deployed',entry:'renderer API; main product button not wired',resources,errors,warnings,evidence},null,2));console.log('PASS',evidence.length,'captures, resources',resources);
}catch(error){writeFileSync(new URL('failure.json',out),JSON.stringify({message:String(error),errors,warnings,evidence},null,2));await page.screenshot({path:new URL('failure.png',out).pathname.replace(/^\/([A-Z]:)/,'$1')});throw error;}
finally{await browser.close();}
