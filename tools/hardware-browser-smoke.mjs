import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='docs/qa/hardware';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const record={browser:await browser.version(),snapshot:'candidate A frozen production diagnostic',errors};
try {
  await page.goto('http://127.0.0.1:4173/?qa');
  await page.waitForFunction(()=>window.__game?.getState().assetsReady,null,{timeout:30000});
  await page.locator('[data-action="missions"]').first().click();
  await page.locator('[data-design-profile="hardware"]').click();
  await page.locator('[data-mission="earth"]').click();
  await page.waitForFunction(()=>!window.__game.scene.tween);
  await page.locator('[data-action="view-top"]').click();
  await page.waitForFunction(()=>!window.__game.scene.tween);
  await page.locator('[data-category="systems"]').click();
  await page.locator('[data-model="ax100u-carrier-v1"]').scrollIntoViewIfNeeded();
  const card=await page.locator('[data-model="ax100u-carrier-v1"]').boundingBox();
  const target=await page.evaluate(()=>{const s=window.__game.scene;return s.project(s.craft.position.clone().add({x:-.22,y:.8,z:-.20}));});
  record.card=card;record.target=target;console.log(JSON.stringify({card,target,cardHit:await page.evaluate(p=>document.elementFromPoint(p.x+p.width/2,p.y+p.height/2)?.outerHTML,card)}));await page.mouse.move(card.x+card.width*.5,card.y+card.height*.5);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:18});console.log(JSON.stringify(await page.evaluate(()=>({ghost:window.__game.scene.ghostPart,text:document.querySelector(".toast")?.textContent}))));await page.mouse.up();
  await page.waitForFunction(()=>window.__game.getState().design.parts.length===1);
  record.placed=await page.evaluate(()=>window.__game.getState().design.parts[0]);
  await page.keyboard.press('f');await page.waitForFunction(()=>!window.__game.scene.tween);
  await page.screenshot({path:`${output}/actual-radio-focus-1280.png`});
  record.focus=await page.evaluate(()=>{const s=window.__game.scene;return {camera:s.camera.position.toArray(),target:s.controls.target.toArray(),distance:s.controls.getDistance(),minDistance:s.controls.minDistance,bayOpen:s.bayOpen,modelKey:s.parts.get(s.selection)?.userData.modelKey};});
  await page.locator('[data-action="hardware-buses"]').click();
  await page.locator('[data-hardware-bus="pathfinder-d35-v1"]').click();
  record.bus=await page.evaluate(()=>window.__game.getState().design.busId);
  await page.evaluate(()=>window.__game.scene.focusCraft());await page.waitForFunction(()=>!window.__game.scene.tween);
  await page.screenshot({path:`${output}/actual-hardware-bay-1280.png`});
  record.partAfterBus=await page.evaluate(()=>window.__game.getState().design.parts[0]);
  record.status='passed';
}catch(e){record.status='failed';record.failure=e.stack;await page.screenshot({path:`${output}/actual-hardware-failure.png`}).catch(()=>{});}
await writeFile(`${output}/actual-hardware-smoke.json`,JSON.stringify(record,null,2));
await browser.close();console.log(JSON.stringify(record));


