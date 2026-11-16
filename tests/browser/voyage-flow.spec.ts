import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {voyageState,voyageButton,reachEncounter,cameraScience,aimRegion,expose} from './voyage-helpers';
const out=join(process.cwd(),'tests/browser/artifacts/v13-voyage');mkdirSync(out,{recursive:true});
test.setTimeout(150000);test.use({viewport:{width:1440,height:900}});
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){await page.screenshot({path:join(out,`failure-${info.retry}.png`)}).catch(()=>{});const state=await voyageState(page).catch(()=>null);writeFileSync(join(out,'failure-state.json'),JSON.stringify(state,null,2));}});
test('native expedition: incident, mounted view, measured photos, paused resume and received journal',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?qa');await page.locator('[data-action="solar-campaign"]').click();
 await expect(page.locator('.solar-experience')).toBeVisible({timeout:45000});
 for(let i=0;i<3;i++)await page.locator('[data-solar-action="story"]').click();
 const launch=page.locator('[data-solar-action="launch"]');if(await launch.isDisabled())await page.locator('[data-solar-action="window"]').click();
 await launch.click();await page.screenshot({path:join(out,'01-cruise.png')});
 await reachEncounter(page,'continue-choice');await page.screenshot({path:join(out,'02-instrument.png')});
 await expose(page);expect((await voyageState(page)).operations.lastCapture?.reason).toBe('blurred');
 await voyageButton(page,'command:stabilize').click();
 await expect.poll(async()=>(await voyageState(page)).operations.stabilized,{timeout:10000}).toBe(true);
 await cameraScience(page);const acquired=await voyageState(page);
 await expect.poll(async()=>(await voyageState(page)).images.length).toBe(2);
 await page.screenshot({path:join(out,'03-science-acquired.png')});
 await voyageButton(page,'view:map').click();await expect.poll(async()=>(await voyageState(page)).view).toBe('map');
 await voyageButton(page,'view:instrument').click();await expect.poll(async()=>(await voyageState(page)).view).toBe('instrument');
 await voyageButton(page,'view:chase').click();await page.screenshot({path:join(out,'04-own-spacecraft.png')});
 await page.reload();await page.locator('[data-action="solar-campaign"]').click();
 await expect(page.locator('.solar-voyage-ui')).toBeVisible();
 expect((await voyageState(page)).paused).toBe(true);expect((await voyageState(page)).operations.records).toHaveLength(2);
 await page.setViewportSize({width:1280,height:720});await page.screenshot({path:join(out,'05-paused-resume-1280.png')});
 await voyageButton(page,'pause').click();await voyageButton(page,'view:instrument').click();
 await voyageButton(page,'send').click();
 await expect(page.locator('.solar-discovery-card')).toHaveCount(0);
 await expect(page.locator('.solar-discovery-card')).toBeVisible({timeout:30000});
 await page.locator('[data-solar-action="journal"]').click();
 await expect(page.locator('.solar-drawer > article')).toHaveCount(1);await page.screenshot({path:join(out,'06-received-journal.png')});
 const campaign=await page.evaluate(()=>(window as any).__game.solar().getState().campaign);
 expect(campaign.discoveries[0].science.samples).toHaveLength(2);expect(campaign.discoveries[0].science.samples[0].image).toMatch(/^data:image\/jpeg/);
 // Existing received images remain downloadable, independently of the new album.
 const downloadEvent=page.waitForEvent('download');
 await page.locator('.solar-drawer [data-solar-action="photo-download:0:-1"]').click();
 const download=await downloadEvent;expect(await download.failure()).toBeNull();
 const photoPath=join(out,'received-photo.jpg');await download.saveAs(photoPath);
 expect(readFileSync(photoPath).equals(Buffer.from(campaign.discoveries[0].image.split(',')[1],'base64'))).toBe(true);
 expect(errors).toEqual([]);
 writeFileSync(join(out,'native-expedition.json'),JSON.stringify({errors,browser:page.context().browser()?.version(),acquired,discovery:campaign.discoveries[0],claim:'Actual input functional verification and visual inspection, not a human enjoyment study.'},(key,value)=>key==='image'?`JPEG ${value.length} characters`:value,2));
});


