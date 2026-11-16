import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {voyageState,voyageButton,aimRegion,expose} from './voyage-helpers';
const out=join(process.cwd(),'submission/recording');mkdirSync(out,{recursive:true});
test.setTimeout(240000);
test('record actual gameplay for the submission demo',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:out,size:{width:1600,height:900}}});
 const page=await context.newPage(),started=Date.now(),cues:any[]=[],errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 const cue=async(name:string)=>{cues.push({name,seconds:(Date.now()-started)/1000});await page.screenshot({path:join(out,name+'.png')});};
 const solar=(action:string)=>page.locator(`[data-solar-action="${action}"]`).first();
 try{
 await page.goto('http://127.0.0.1:5188/?qa');
 await expect(page.locator('[data-action="solar-campaign"]')).toBeEnabled({timeout:45000});
 await page.locator('.header-menu > summary').click();await page.locator('[data-action="language"]').click();
 await page.waitForTimeout(1500);await cue('home');await page.waitForTimeout(5000);
 await page.locator('[data-action="solar-campaign"]').click();
 await expect(page.locator('.solar-experience')).toBeVisible({timeout:45000});
 await cue('story');await page.waitForTimeout(2000);
 for(let i=0;i<3;i++){await solar('story').click();await page.waitForTimeout(1000);}
 await page.waitForTimeout(1200);await solar('build').click();
 await expect(page.locator('.solar-assembly-heading')).toBeVisible();await page.waitForTimeout(1800);
 await cue('assembly-orbit');
 await page.mouse.move(860,460);await page.mouse.down({button:'right'});await page.mouse.move(1080,485,{steps:70});await page.mouse.up({button:'right'});await page.waitForTimeout(4000);
 await page.locator('.assembly-flightbar [data-action="solar-campaign"]').click();await page.waitForTimeout(1800);
 await cue('route-drag');const box=await page.locator('[data-route-drag="arrival"]').boundingBox();
 await page.mouse.move(box!.x+box!.width/2,box!.y+20);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2-85,box!.y+20,{steps:65});await page.waitForTimeout(2000);await page.mouse.up();await page.waitForTimeout(2000);await solar('undo').click();
 const launch=solar('launch');if(await launch.isDisabled())await solar('window').click();await launch.click();
 await expect(page.locator('.solar-voyage-ui')).toBeVisible();await cue('cruise');await page.waitForTimeout(6000);
 await voyageButton(page,'warp').click();await expect(page.locator('.voyage-event')).toBeVisible();await cue('decision');await page.waitForTimeout(4500);
 await voyageButton(page,'safe-choice').click();await voyageButton(page,'warp').click();
 await expect.poll(async()=>(await voyageState(page)).phase).toBe('encounter');await cue('instrument-wide');await page.waitForTimeout(3500);
 await cue('take-photo');await voyageButton(page,'shutter').click();await expect.poll(async()=>(await voyageState(page)).summary.context).not.toBeNull();await page.waitForTimeout(2500);
 await voyageButton(page,'photos').click();await expect(page.locator('dialog.expedition-photo-album')).toBeVisible();await cue('photo-album');await page.waitForTimeout(4500);await page.locator('[data-photo-close]').click();await voyageButton(page,'pause').click();
 await aimRegion(page);await page.mouse.move(800,450);await cue('aim-and-zoom');await page.mouse.wheel(0,-3000);await aimRegion(page);
 await expect.poll(async()=>{const s=await voyageState(page),r=s.operations.encounter.features.find((f:any)=>f.id===s.exposure.featureId);return !!r&&s.exposure.footprintKm<=r.radiusKm*2.6&&s.exposure.gsdM<=r.radiusKm*100;},{timeout:80000}).toBe(true);
 await cue('detail-capture');await expose(page);await expect.poll(async()=>(await voyageState(page)).summary.ready).toBe(true);await page.waitForTimeout(3500);
 await voyageButton(page,'view:chase').click();await cue('own-spacecraft');await page.waitForTimeout(4000);
 await voyageButton(page,'send').click();await cue('downlink');await expect(page.locator('.solar-discovery-card')).toBeVisible({timeout:30000});await cue('discovery');await page.waitForTimeout(6000);
 await solar('map').click();await page.locator('.solar-destinations [data-solar-body="saturn"]').click();await page.waitForTimeout(1600);await cue('saturn-map');await page.waitForTimeout(5000);
 }finally{
 writeFileSync(join(out,'cues.json'),JSON.stringify({started:new Date(started).toISOString(),cues,errors,source:'Actual production browser gameplay using mouse and keyboard; QA used only for state/geometry reads.'},null,2));
 await context.close();const video=await page.video()!.path();writeFileSync(join(out,'video-path.txt'),video);
 }
 expect(errors).toEqual([]);
});
