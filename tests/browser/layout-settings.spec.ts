import {test as base,expect,type Page,type Locator} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const artifacts=join(process.cwd(),'tests/browser/artifacts/layout-settings');mkdirSync(artifacts,{recursive:true});
const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('favicon.ico'))errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  await use(errors);const report={test:info.title,status:info.status,browser:page.context().browser()?.version(),viewport:page.viewportSize(),url:page.url(),errors,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),scope:'Four explicit language/scale combinations; selected pointer targets, no claim of complete keyboard or font-glyph accessibility.'};
  writeFileSync(join(artifacts,info.title.replace(/[^a-zA-Z0-9]+/g,'-')+'.json'),JSON.stringify(report,null,2));await info.attach('layout-settings-evidence',{body:JSON.stringify(report,null,2),contentType:'application/json'});
  if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
  expect(errors).toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});
const state=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());
async function act(page:Page,name:string){await page.locator(`[data-action="${name}"]`).first().click();}
async function ta(page:Page,name:string){await page.locator(`[data-transfer-action="${name}"]`).first().click();}
async function ready(page:Page){await page.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return !s.pending&&s.acceptedRevision===s.revision&&!g.scene.tween;},null,{timeout:45000});}
async function trReady(page:Page){await page.waitForFunction(()=>{const t=(window as any).__game.transfer();return t&&!t.getState().pending&&!t.dirty;},null,{timeout:60000});}
async function reachable(control:Locator,scroll=true){
  // A completed worker may deliver its autosave acknowledgment immediately
  // after the preview. Re-query a replaced node, then keep all geometry/hit tests.
  if(scroll)await expect(async()=>{await control.scrollIntoViewIfNeeded({timeout:2000});}).toPass({timeout:8000,intervals:[100,250,500]});await expect(control).toBeVisible();
  const facts=await control.evaluate(el=>{
    const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2),clipping:string[]=[];
    for(let a=el.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a===document.body||a===document.documentElement?{top:0,left:0,right:innerWidth,bottom:innerHeight}:a.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.top<b.top-1||r.bottom>b.bottom+1))clipping.push(`${a.className}:y`);if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(r.left<b.left-1||r.right>b.right+1))clipping.push(`${a.className}:x`);}
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,hit:hit===el||el.contains(hit),clipping};
  });
  expect(facts.left).toBeGreaterThanOrEqual(-1);expect(facts.top).toBeGreaterThanOrEqual(-1);expect(facts.right).toBeLessThanOrEqual(1281);expect(facts.bottom).toBeLessThanOrEqual(721);
  expect(facts.width).toBeGreaterThan(0);expect(facts.height).toBeGreaterThan(0);expect(facts.hit,'center is not hidden behind another UI layer').toBe(true);expect(facts.clipping,'whole control is visible within scroll/clip ancestors').toEqual([]);
}
async function textAndOverflow(page:Page,language:'ko'|'en',scope:string){
  const text=await page.locator(scope).innerText();expect(text).not.toMatch(/\uFFFD|\bNaN\b|\bundefined\b/);
  if(language==='en')expect(text).not.toMatch(/[가-힣]/);
  expect(await page.evaluate(()=>({document:document.documentElement.scrollWidth<=innerWidth+1,body:document.body.scrollWidth<=innerWidth+1}))).toEqual({document:true,body:true});
}
async function shot(page:Page,prefix:string,stage:string){await page.screenshot({path:join(artifacts,`${prefix}-${stage}.png`),fullPage:true});}

for(const language of ['ko','en'] as const)for(const scale of ['normal','large'] as const){
test(`${language}-${scale} 1280x720 controls remain reachable through actual hardware flight and transfer planning`,async({page})=>{
  test.setTimeout(180000);const prefix=`${language}-${scale}`;
  await page.addInitScript(language=>localStorage.setItem('orbital-language',language),language);await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady),null,{timeout:30000});
  await act(page,'settings');await page.locator('#quality').selectOption('medium');await page.locator('#ui-scale').selectOption(scale);await page.locator('#motion').selectOption('reduced');await act(page,'close-modal');
  expect(await page.evaluate(()=>(window as any).__game.scene.quality)).toBe('medium');await expect(page.locator('body')).toHaveClass(scale==='large'?/large-ui/:/reduced-motion/);
  await act(page,'missions');await reachable(page.locator('[data-design-profile="legacy"]'));await reachable(page.locator('[data-design-profile="hardware"]'));
  await page.locator('[data-design-profile="hardware"]').click();
  for(const selector of ['[data-mission="earth"]','[data-mission="mars"]','[data-action="mission-transfer"]'])await reachable(page.locator(selector));
  await textAndOverflow(page,language,'.modal');await shot(page,prefix,'mission-picker');await page.locator('[data-mission="earth"]').click();await ready(page);
  await act(page,'preset-balanced');await ready(page);await reachable(page.locator('[data-action="hardware-buses"]'));await reachable(page.locator('.deck-action [data-action="plan"]'),false);await textAndOverflow(page,language,'#ui');await shot(page,prefix,'hardware-build');
  await act(page,'hardware-buses');await reachable(page.locator('[data-hardware-bus="pathfinder-d35-v1"]'));await textAndOverflow(page,language,'.modal');await shot(page,prefix,'buses');await act(page,'close-modal');
  await act(page,'hardware-connections');await reachable(page.locator('[data-hardware-focus="radio-1"]'));await textAndOverflow(page,language,'.modal');await shot(page,prefix,'connections');await act(page,'close-modal');
  await act(page,'plan');await ready(page);await reachable(page.locator('[data-action="launch"]'));await expect(page.locator('[data-action="launch"]')).toBeEnabled();await textAndOverflow(page,language,'#ui');await shot(page,prefix,'earth-plan');
  await act(page,'launch');await expect(page.locator('#flight-time')).toBeVisible();await reachable(page.locator('[data-speed="600"]'),false);await page.locator('[data-speed="600"]').click();
  await page.waitForFunction(()=>(window as any).__game.getState().sim.time>=900,null,{timeout:15000});if((await state(page)).playing)await page.keyboard.press('Space');
  await reachable(page.locator('[data-action="play-pause"]'),false);await textAndOverflow(page,language,'#ui');await shot(page,prefix,'actual-earth-flight');await page.keyboard.press('Space');
  await page.waitForFunction(()=>(window as any).__game.getState().sim.status==='complete',null,{timeout:40000});await expect(page.locator('.mission-debrief')).toBeVisible();
  expect((await state(page)).sim.time).toBe(10800);expect((await state(page)).debrief.isFinal).toBe(true);
  await reachable(page.locator('.result-actions [data-action="retry"]'),false);await reachable(page.locator('.result-actions [data-action="missions"]'),false);await textAndOverflow(page,language,'.modal');await shot(page,prefix,'actual-earth-result');
  await page.locator('.result-actions [data-action="missions"]').click();await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-action="mission-transfer"]').click();await ready(page);await act(page,'plan');await trReady(page);
  const inherited=await page.evaluate(()=>{const t=(window as any).__game.transfer();return {quality:t.scene.quality,damping:t.scene.controls.enableDamping};});expect(inherited).toEqual({quality:'medium',damping:false});
  await reachable(page.locator('[data-transfer-action="launch"]'));await reachable(page.locator('[data-transfer-action="view-mars"]'),false);
  const departure=await page.evaluate(()=>(window as any).__game.transfer().scene.getHandleScreen('departure'));expect(departure?.visible).toBe(true);
  expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,departure)).toBe('transfer-universe');
  await textAndOverflow(page,language,'#transfer-experience');await shot(page,prefix,'transfer-solar');await ta(page,'view-mars');
  for(const axis of ['altitude','angle']){
    await expect.poll(()=>page.evaluate(axis=>(window as any).__game.transfer().scene.getEncounterHandleScreen(axis)?.visible,axis)).toBe(true);
    const handle=await page.evaluate(axis=>(window as any).__game.transfer().scene.getEncounterHandleScreen(axis),axis);
    expect(handle.x).toBeGreaterThan(0);expect(handle.x).toBeLessThan(1280);expect(handle.y).toBeGreaterThan(0);expect(handle.y).toBeLessThan(720);
    expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,handle)).toBe('transfer-universe');
  }
  await textAndOverflow(page,language,'#transfer-experience');await shot(page,prefix,'transfer-mars');
});
}
