import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='docs/qa/hardware-art';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const report={browser:browser.version(),prototypeOnly:true,errors:[],checks:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const check=(condition,label,data)=>{report.checks.push({label,passed:!!condition,data});if(!condition)throw new Error(label);};
const settle=async()=>{await page.waitForFunction(()=>!window.__game.scene.tween&&!window.__game.getState().pending);await page.waitForTimeout(100);};
const shot=async name=>page.screenshot({path:`${output}/${name}.png`});
try{
 await page.goto('http://127.0.0.1:4174/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady);
 report.scripts=await page.locator('script[src]').evaluateAll(s=>s.map(e=>e.src));
 await page.locator('[data-action="missions"]').first().click();await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await page.locator('[data-action="preset-balanced"]').click();await settle();
 const baseline=await page.evaluate(()=>structuredClone(window.__game.getState().design));
 await shot('closed-bus-original-angle');
 await page.evaluate(()=>{const s=window.__game.scene;s.flyCamera(s.camera.position.clone().set(5.8,4.1,-6.7),s.controls.target.clone().set(0,1.75,0),false);});await page.waitForTimeout(150);await shot('closed-bus-proposed-angle');
 const ids=baseline.parts.filter(p=>['radio','camera'].includes(p.kind));
 for(const p of ids){
  await page.evaluate(id=>{const s=window.__game.scene;s.setSelected(id);s.cb.select(id);},p.id);await page.keyboard.press('f');await settle();
  const focus=await page.evaluate(()=>{const s=window.__game.scene;return {shadowWidth:s.sun.shadow.camera.right-s.sun.shadow.camera.left,normalBias:s.sun.shadow.normalBias,bayOpen:s.bayOpen,camera:s.camera.position.toArray(),target:s.controls.target.toArray()};});
  check(focus.shadowWidth===6&&focus.normalBias===.0015,`${p.kind} focused contact shadow`,focus);
  await shot(`${p.kind}-focus`);
  await page.locator('[data-action="view-top"]').click();await settle();
  const restored=await page.evaluate(()=>{const s=window.__game.scene;return {width:s.sun.shadow.camera.right-s.sun.shadow.camera.left,bias:s.sun.shadow.normalBias};});check(restored.width===18&&restored.bias===.025,`${p.kind} shadow restored by axis view`,restored);
 }
 const radio=baseline.parts.find(p=>p.kind==='radio');
 await page.evaluate(id=>{const s=window.__game.scene;s.setSelected(id);s.cb.select(id);},radio.id);await page.keyboard.press('f');await settle();
 const resources=()=>page.evaluate(()=>{const s=window.__game.scene;return {...s.renderer.info.memory,programs:s.renderer.info.programs.length};});
 report.beforeChurn=await resources();
 for(let i=0;i<8;i++){
  await page.evaluate(({d,i})=>{const g=window.__game,n=structuredClone(d);n.busId=i%2?'surveyor-l18-v1':'pathfinder-d35-v1';n.parts.find(p=>p.kind==='radio').modelId=i%2?'ax100u-carrier-v1':'iris22-carrier-v1';g.setDesign(n);}, {d:baseline,i});await settle();
  await page.evaluate(()=>{const s=window.__game.scene;s.beginNewPart('radio',640,360,'ax100u-carrier-v1');});await page.waitForTimeout(40);await page.keyboard.press('Escape');
 }
 await page.evaluate(d=>window.__game.setDesign(d),baseline);await settle();
 await page.evaluate(id=>{const s=window.__game.scene;s.setSelected(id);s.cb.select(id);},radio.id);await page.keyboard.press('f');await settle();
 report.afterChurn=await resources();
 check(report.afterChurn.textures===report.beforeChurn.textures,'shared atlas and labels do not accumulate across8bus/model/ghost cycles',{before:report.beforeChurn,after:report.afterChurn});await shot('radio-after-churn');
 const supported=await page.evaluate(()=>{const s=window.__game.scene,ext=s.renderer.getContext().getExtension('WEBGL_lose_context');if(!ext)return false;window.__artRestore=ext;ext.loseContext();return true;});check(supported,'actual WebGL context loss supported');
 await page.waitForTimeout(250);await page.evaluate(()=>window.__artRestore.restoreContext());await page.waitForTimeout(800);await shot('radio-after-context-restore');
 report.afterRestore=await resources();
 check(report.errors.length===0,'no page/console errors');report.completed=true;
}catch(e){report.completed=false;report.failure=e.stack;await shot('failure').catch(()=>{});throw e;}finally{await writeFile(`${output}/functional-report.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
