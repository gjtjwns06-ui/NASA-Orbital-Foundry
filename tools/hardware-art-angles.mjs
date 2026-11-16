import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='docs/qa/hardware-art';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1280,height:720}});
try{
 await page.goto('http://127.0.0.1:4174/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady);await page.locator('[data-action="missions"]').first().click();await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await page.locator('[data-action="preset-balanced"]').click();await page.waitForFunction(()=>!window.__game.getState().pending&&!window.__game.scene.tween);
 for(const [name,position] of [['camera-positive-x-negative-z',[6.8,4.2,-5.1]],['camera-nearer-hardware',[5.9,3.9,-4.6]]]){
  await page.evaluate(position=>{const s=window.__game.scene;s.flyCamera(s.camera.position.clone().set(...position),s.controls.target.clone().set(0,1.75,0),false);},position);await page.waitForTimeout(150);await page.screenshot({path:`${output}/${name}.png`});
 }
 const settled=()=>page.waitForFunction(()=>!window.__game.getState().pending&&!window.__game.scene.tween);
 const pose=()=>page.evaluate(()=>window.__game.scene.camera.position.toArray());
 const beforeBus=await pose();await page.locator('[data-action="hardware-buses"]').click();await page.locator('[data-hardware-bus="pathfinder-d35-v1"]').click();await settled();const afterBus=await pose();
 if(beforeBus.some((v,i)=>Math.abs(v-afterBus[i])>.001))throw new Error('Bus replacement reset the player camera: '+JSON.stringify({beforeBus,afterBus}));
 await page.locator('[data-action="settings"]').click();await page.locator('#ui-scale').selectOption('large');await page.keyboard.press('Escape');await page.waitForTimeout(150);

 await page.evaluate(()=>window.__game.scene.resetCamera());await settled();await page.screenshot({path:`${output}/closed-bus-final-large.png`});
 const profilePoses={};
 for(const profile of ['legacy','hardware']){await page.locator('[data-action="home"]').first().click();await page.locator('[data-action="missions"]').first().click();await page.locator(`[data-design-profile="${profile}"]`).click();await page.locator('[data-mission="earth"]').click();await settled();profilePoses[profile]=await pose();}
 const expected={legacy:[5.1,3.9,6.8],hardware:[5.9,3.9,-4.6]};for(const profile of ['legacy','hardware'])if(expected[profile].some((v,i)=>Math.abs(v-profilePoses[profile][i])>.001))throw new Error('Wrong profile framing: '+profile);
 await writeFile(`${output}/angle-proof.json`,JSON.stringify({prototype:true,scripts:await page.locator('script[src]').evaluateAll(s=>s.map(e=>e.src)),note:'Camera-only comparison on unchanged real balanced hardware; no part transforms/scales changed.',busChangePreservesUserView:{before:beforeBus,after:afterBus},actualProfileReplacement:profilePoses,largeUi:true},null,2));
}finally{await browser.close();}



