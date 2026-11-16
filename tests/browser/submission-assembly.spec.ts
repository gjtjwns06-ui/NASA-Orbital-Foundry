import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const out=join(process.cwd(),'submission/recording/assembly-clean');mkdirSync(out,{recursive:true});
test.setTimeout(90000);
test('clean native assembly supplement',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:out,size:{width:1600,height:900}}});
 const page=await context.newPage(),started=Date.now(),cues:any[]=[];
 const cue=async(name:string)=>{cues.push({name,seconds:(Date.now()-started)/1000});await page.screenshot({path:join(out,name+'.png')});};
 try{
 await page.goto('http://127.0.0.1:5188/?qa');await expect(page.locator('[data-action="solar-campaign"]')).toBeEnabled({timeout:40000});
 await page.locator('.header-menu > summary').click();await page.locator('[data-action="language"]').click();await page.locator('.header-menu > summary').click();
 await page.locator('[data-action="solar-campaign"]').click();await expect(page.locator('.solar-experience')).toBeVisible();
 for(let i=0;i<3;i++)await page.locator('[data-solar-action="story"]').click();
 await page.locator('[data-solar-action="build"]').click();await expect(page.locator('.solar-assembly-heading')).toBeVisible();await page.waitForTimeout(1800);
 await cue('clean-orbit');await page.mouse.move(850,450);await page.mouse.down({button:'right'});await page.mouse.move(1040,475,{steps:60});await page.mouse.up({button:'right'});await page.waitForTimeout(4000);
 await page.locator('.assembly-utilities > summary').click();await page.locator('[data-action="view-top"]').click();
 await page.waitForFunction(()=>!(window as any).__game.scene.tween);await page.locator('.assembly-utilities > summary').click();
 const initial=await page.evaluate(()=>(window as any).__game.getState().design.parts.length);
 const card=await page.locator('[data-part="battery"]').boundingBox();const target=await page.evaluate(()=>{const scene=(window as any).__game.scene;return scene.project(scene.craft.position.clone().add({x:-.28,y:.8,z:.43}));});
 await cue('native-battery-drag');await page.mouse.move(card!.x+card!.width/2,card!.y+card!.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:60});await page.waitForTimeout(1500);await page.mouse.up();
 await expect.poll(async()=>page.evaluate(()=>(window as any).__game.getState().design.parts.length)).toBe(initial+1);await cue('battery-mounted');await page.waitForTimeout(3500);
 await page.keyboard.press('Control+z');await page.locator('[data-action="camera-reset"]').click();await page.waitForTimeout(1500);await cue('clean-craft');await page.waitForTimeout(3500);
 }finally{writeFileSync(join(out,'cues.json'),JSON.stringify({cues},null,2));await context.close();writeFileSync(join(out,'video-path.txt'),await page.video()!.path());}
});
