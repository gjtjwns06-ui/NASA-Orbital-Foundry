import {test,expect,type Page} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
const artifactDir=join(process.cwd(),'tests','browser','artifacts');
test.use({launchOptions:{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-background-timer-throttling']}});
let errors:string[]=[];
test.beforeEach(async({page})=>{errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});});
test.afterEach(async({page},info)=>{writeFileSync(join(artifactDir,'edge-resilience.json'),JSON.stringify({title:info.title,status:info.status,browser:page.context().browser()?.version(),errors},null,2));if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png')});expect(errors).toEqual([]);});
async function boot(page:Page){await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});}
async function state(page:Page){return page.evaluate(()=>(window as any).__game.getState());}
async function previewReady(page:Page){await page.waitForFunction(()=>{const s=(window as any).__game.getState();return !s.pending&&s.acceptedRevision===s.revision;},null,{timeout:25000});}
async function start(page:Page,mission:'earth'|'mars'){await page.evaluate(m=>(window as any).__game.startMission(m,'balanced'),mission);await page.waitForFunction(()=>!(window as any).__game.scene.tween);await previewReady(page);}
async function clickAction(page:Page,action:string){await page.locator(`[data-action="${action}"]`).first().click();}
async function shot(page:Page,name:string){await page.locator('.toast').waitFor({state:'hidden',timeout:5500});await page.screenshot({path:join(artifactDir,name+'.png'),fullPage:true});}
 test('loaded mission operates offline and WebGL context restoration keeps the saved state',async({page,context})=>{
  await boot(page);await start(page,'mars');await clickAction(page,'plan');await previewReady(page);await clickAction(page,'launch');
  await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(0);
  await context.setOffline(true);await expect(page.locator('#save-status')).toHaveText('OFFLINE READY');
  const offlineTime=(await state(page)).sim.time;await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(offlineTime+10);
  await clickAction(page,'save');await expect(page.getByRole('status')).toContainText('저장했습니다');
  await context.setOffline(false);await expect(page.locator('#save-status')).toHaveText('LOCAL SIMULATION');
  await page.evaluate(()=>{const s=(window as any).__game.scene;const gl=s.renderer.getContext();const extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('WEBGL_lose_context unavailable');(window as any).__qaContextExtension=extension;extension.loseContext();});
  await expect.poll(async()=>(await state(page)).playing).toBe(false);await expect(page.getByRole('status')).toContainText('그래픽 컨텍스트');
  const paused=(await state(page)).sim.time;await page.waitForTimeout(350);expect((await state(page)).sim.time).toBe(paused);
  await page.evaluate(()=>(window as any).__qaContextExtension.restoreContext());
  await page.waitForFunction(()=>!(window as any).__game.scene.renderer.getContext().isContextLost());
  await page.waitForFunction(()=>(window as any).__game.scene.renderer.info.render.calls>0);
  await page.keyboard.press('Space');await expect.poll(async()=>(await state(page)).sim.time).toBeGreaterThan(paused+10);await page.keyboard.press('Space');
  await shot(page,'edge-context-restored');const saved=(await state(page)).sim.time;
  await clickAction(page,'save');await expect(page.getByRole('status')).toContainText('저장했습니다');
  await page.reload();await page.waitForFunction(()=>Boolean((window as any).__game));await clickAction(page,'load');
  await expect.poll(async()=>(await state(page)).sim?.time).toBe(saved);expect((await state(page)).playing).toBe(false);
 });
