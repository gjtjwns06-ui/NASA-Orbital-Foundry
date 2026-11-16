import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='docs/qa/nav01-ui-initial';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>window.__game.getState());
const ready=()=>page.waitForFunction(()=>{const s=window.__game?.getState();return s?.assetsReady&&!s.pending&&s.revision===s.acceptedRevision;},null,{timeout:90000});
const act=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 await page.goto('http://127.0.0.1:5191/?qa');await ready();await act('missions');await page.locator('[data-mission="earth"]').click();await act('preset-balanced');await ready();await act('plan');await ready();
 await page.waitForFunction(()=>!window.__game.scene.tween);await page.screenshot({path:out+'/before.png'});
 const observations={before:await state(),handles:await page.evaluate(()=>{const g=window.__game.scene;return ['earth-periapsis','earth-apoapsis','earth-plane'].map(name=>({name,screen:g.getHandleScreen(name),hit:(()=>{const p=g.getHandleScreen(name);return p?document.elementFromPoint(p.x,p.y)?.tagName:null;})()}));})};
 for(const [handle,altitude]of [['earth-apoapsis',950],['earth-periapsis',400]]){
  const positions=await page.evaluate(({handle,altitude})=>{const g=window.__game.scene,sign=handle==='earth-periapsis'?1:-1;return {from:g.getHandleScreen(handle),to:g.project(g.camera.position.clone().set(sign*(6378.137+altitude)*g.scale,0,0))};},{handle,altitude});
  await page.mouse.move(positions.from.x,positions.from.y);await page.mouse.down();await page.mouse.move(positions.to.x,positions.to.y,{steps:16});await page.mouse.up();await ready();
  observations[handle]={positions,state:await state()};await page.screenshot({path:out+'/'+handle+'.png'});
 }
 writeFileSync(out+'/report.json',JSON.stringify({...observations,errors},null,2));console.log(JSON.stringify({handles:observations.handles,initial:observations.before.design.plan,ap:observations['earth-apoapsis'].state.design.plan,pe:observations['earth-periapsis'].state.design.plan,errors}));
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(e);process.exitCode=1;}finally{await browser.close();}
