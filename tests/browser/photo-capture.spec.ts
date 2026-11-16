import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {reachEncounter,voyageButton,voyageState} from './voyage-helpers';

const out=join(process.cwd(),'tests/browser/artifacts/photo-capture');
mkdirSync(out,{recursive:true});
test.use({viewport:{width:1440,height:900}});
test.setTimeout(150000);
const album=(page:Page)=>page.locator('dialog.expedition-photo-album');

async function inspectAndDownload(page:Page,name:string){
 const viewer=album(page);
 await expect(viewer).toBeVisible();
 const image=viewer.locator('[data-photo-image]');
 await expect(image).toHaveAttribute('src',/^data:image\/jpeg;base64,/);
 const pixels=await image.evaluate(async node=>{
  const img=node as HTMLImageElement;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let min=255,max=0,sum=0,sumSquared=0;
  for(let i=0;i<rgba.length;i+=4){const luma=(rgba[i]+rgba[i+1]+rgba[i+2])/3;min=Math.min(min,luma);max=Math.max(max,luma);sum+=luma;sumSquared+=luma*luma;}
  const n=canvas.width*canvas.height;
  return {width:canvas.width,height:canvas.height,min,max,variance:sumSquared/n-(sum/n)**2};
 });
 expect(pixels.width).toBeGreaterThanOrEqual(640);expect(pixels.height).toBeGreaterThan(300);
 expect(pixels.max-pixels.min,'saved image must contain rendered pixels rather than an empty buffer').toBeGreaterThan(30);
 expect(pixels.variance).toBeGreaterThan(1);
 const src=(await image.getAttribute('src'))!;
 const downloadPromise=page.waitForEvent('download');
 await viewer.locator('[data-photo-download]').click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toMatch(/^orbital-.*\.jpg$/);
 expect(await download.failure()).toBeNull();
 const file=join(out,name);await download.saveAs(file);
 const bytes=readFileSync(file),expected=Buffer.from(src.split(',')[1],'base64');
 expect(bytes.length).toBeGreaterThan(5000);expect(bytes.equals(expected),'download must match the photo shown in the viewer').toBe(true);
 expect(bytes.subarray(0,2).toString('hex')).toBe('ffd8');
 return {src,pixels,filename:download.suggestedFilename(),bytes:bytes.length};
}

test.afterEach(async({page},info)=>{
 if(info.status!==info.expectedStatus){
  await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});
  writeFileSync(join(out,'failure-state.json'),JSON.stringify(await voyageState(page).catch(()=>null),null,2));
 }
});

test('ordinary shutter clicks create downloadable photos, preserve them on reload, and keep scientific validity separate',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?qa');await page.locator('[data-action="solar-campaign"]').click();
 await expect(page.locator('.solar-experience')).toBeVisible({timeout:45000});
 for(let i=0;i<3;i++)await page.locator('[data-solar-action="story"]').click();
 const launch=page.locator('[data-solar-action="launch"]');
 if(await launch.isDisabled())await page.locator('[data-solar-action="window"]').click();
 await launch.click();await reachEncounter(page,'continue-choice');
 await expect.poll(async()=>(await voyageState(page)).exposure.context).toBe(true);

 // A regular short mouse click, not the old 1.1-second scripted Space hold.
 // The unresolved star-reference fault must prevent science, not photography.
 await voyageButton(page,'shutter').click();
 await expect.poll(async()=>(await voyageState(page)).operations.lastCapture?.reason).toBe('blurred');
 expect((await voyageState(page)).operations.records).toHaveLength(0);
 await expect.poll(async()=>page.evaluate(()=>{
  const raw=localStorage.getItem('orbital-expedition-photo-album-v1');return raw?JSON.parse(raw).photos.length:0;
 })).toBe(1);
 await voyageButton(page,'photos').click();
 await expect(album(page).locator('[data-photo-select]')).toHaveCount(1);
 const first=await inspectAndDownload(page,'01-fault-photo.jpg');
 await page.screenshot({path:join(out,'01-photo-viewer.png')});
 await album(page).locator('[data-photo-close]').click();

 // Reload is a real browser reload. No test state setter restores the photo.
 await page.reload();await page.locator('[data-action="solar-campaign"]').click();
 await expect(page.locator('.solar-voyage-ui')).toBeVisible();
 expect((await voyageState(page)).paused).toBe(true);
 await voyageButton(page,'photos').click();
 await expect(album(page).locator('[data-photo-select]')).toHaveCount(1);
 const restored=await inspectAndDownload(page,'02-restored-photo.jpg');
 expect(restored.src).toBe(first.src);
 await album(page).locator('[data-photo-close]').click();

 // A short click can also collect valid science once the actual fault is fixed.
 if((await voyageState(page)).paused)await voyageButton(page,'pause').click();
 await voyageButton(page,'command:stabilize').click();
 await expect.poll(async()=>(await voyageState(page)).operations.stabilized,{timeout:10000}).toBe(true);
 await expect.poll(async()=>(await voyageState(page)).exposure.context).toBe(true);
 await voyageButton(page,'shutter').click();
 await expect.poll(async()=>(await voyageState(page)).summary.context).not.toBeNull();
 await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orbital-expedition-photo-album-v1')!).photos.length)).toBe(2);
 expect((await voyageState(page)).operations.records).toHaveLength(1);
 // Keyboard activation must follow the same one-shot control, without requiring
 // a pointer event or emitting a duplicate photo from a synthetic click.
 await voyageButton(page,'shutter').focus();await page.keyboard.press('Enter');
 await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('orbital-expedition-photo-album-v1')!).photos.length)).toBe(3);
 expect((await voyageState(page)).operations.records).toHaveLength(2);
 await voyageButton(page,'photos').click();
 await expect(album(page).locator('[data-photo-select]')).toHaveCount(3);
 const measured=await inspectAndDownload(page,'03-valid-observation.jpg');
 await page.setViewportSize({width:1280,height:720});
 await expect(album(page).locator('[data-photo-download]')).toBeInViewport();
 await expect(album(page).locator('[data-photo-close]')).toBeInViewport();
 await page.screenshot({path:join(out,'03-photo-viewer-1280.png')});
 expect(errors).toEqual([]);
 writeFileSync(join(out,'native-photo-result.json'),JSON.stringify({errors,browser:page.context().browser()?.version(),first,restored,measured,checks:['native short shutter click','failed science still yields an actual image','decoded nonblank GPU JPEG','native download bytes match preview','photo survives page reload','stable short click also awards valid science','keyboard Enter produces one photo','1280x720 viewer save and close remain visible']},(key,value)=>key==='src'?`JPEG ${value.length} characters`:value,2));
});
