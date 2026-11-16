import {expect,type Page} from '@playwright/test';
export const voyageState=(page:Page)=>page.evaluate(()=>(window as any).__game.solar().getState().voyage);
export const voyageButton=(page:Page,id:string)=>page.locator(`[data-voyage="${id}"]`).first();
export async function reachEncounter(page:Page,response:'safe-choice'|'continue-choice'='safe-choice'){
 await expect(page.locator('.solar-voyage-ui')).toBeVisible();
 await voyageButton(page,'warp').click();
 if((await voyageState(page)).phase==='swingby'){
  await expect.poll(async()=>(await voyageState(page)).phase,{timeout:25000}).toBe('flight');
  await voyageButton(page,'warp').click();
 }
 await expect(page.locator('.voyage-event')).toBeVisible();
 await voyageButton(page,response).click();await voyageButton(page,'warp').click();
 await expect.poll(async()=>(await voyageState(page)).phase).toBe('encounter');
}
export async function aimRegion(page:Page,index=2){
 // The frozen body surface can be behind the limb at entry. Wait for the actual
 // approach to expose it; neither this helper nor a HUD marker changes geometry.
 await expect.poll(async()=>{
  const s=await voyageState(page),feature=s.operations.encounter.features[index],p=feature.positionBodyKm,o=s.pose?.positionKm??s.frame.positionKm;
  const toward=o.map((v:number,i:number)=>v-p[i]);
  const emission=p.reduce((sum:number,v:number,i:number)=>sum+v*toward[i],0)/(Math.hypot(...p)*Math.hypot(...toward));
  // A just-visible grazing point is not yet a robust aim target. The rendered
  // surface must actually turn toward the aperture before native targeting.
  return s.featureScreens[index]?.visible&&emission>.4;
 },{timeout:80000}).toBe(true);
 for(let i=0;i<5;i++){
  const s=await voyageState(page),point=s.featureScreens[index],size=page.viewportSize()!;
  expect(point?.visible,'body-fixed feature must be actually visible').toBeTruthy();
  const fov=s.pose.fovDeg*Math.PI/180,dx=Math.atan(2*(point.x-size.width/2)/size.height*Math.tan(fov/2))*size.height/fov,dy=Math.atan(2*(point.y-size.height/2)/size.height*Math.tan(fov/2))*size.height/fov;
  if(Math.hypot(dx,dy)<1.5)break;
  await page.mouse.move(size.width/2,size.height/2);await page.mouse.down();await page.mouse.move(size.width/2+dx,size.height/2+dy,{steps:10});await page.mouse.up();
 }
}
export async function expose(page:Page,seconds=1.1){
 await page.keyboard.down('Space');await page.waitForTimeout(seconds*1000);await page.keyboard.up('Space');
 await expect.poll(async()=>(await voyageState(page)).shutter).toBe(false);
 await page.waitForTimeout(200);
}
export async function cameraScience(page:Page){
 await expect.poll(async()=>(await voyageState(page)).exposure.context).toBe(true);
 await expose(page);
 await expect.poll(async()=>(await voyageState(page)).summary.context).not.toBeNull();
 await aimRegion(page);await page.mouse.move(page.viewportSize()!.width/2,page.viewportSize()!.height/2);
 await page.mouse.wheel(0,-3000);await aimRegion(page);
 // Actual approach must resolve the selected region; zoom cannot invent resolution.
 await expect.poll(async()=>{const s=await voyageState(page),r=s.operations.encounter.features.find((f:any)=>f.id===s.exposure.featureId);return !!r&&s.exposure.footprintKm<=r.radiusKm*2.6&&s.exposure.gsdM<=r.radiusKm*100;},{timeout:80000}).toBe(true);
 await expose(page);
 await expect.poll(async()=>(await voyageState(page)).summary.ready).toBe(true);
}
