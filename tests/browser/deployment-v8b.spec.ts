import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {installNativeDeletionAudit} from './native-gl-audit';

const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'v8b-unfrozen';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate');
const out=join(process.cwd(),'tests/browser/artifacts/deployment-v8b',candidate);
mkdirSync(out,{recursive:true});
const chromeSourcePath=resolve('tests/browser/artifacts/deployment-flow/m8-production-r1-closure/repaired-terminal-save.json');
const chromeSourceText=readFileSync(chromeSourcePath,'utf8'),chromeSource=JSON.parse(chromeSourceText);
const chromeSourceSha256=createHash('sha256').update(chromeSourceText).digest('hex');
const baselinePath=process.env.PLAYWRIGHT_CHROME_BASELINE;
const test=base.extend<{audit:void}>({audit:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);
 const errors:string[]=[],warnings:string[]=[],workers=new Set<string>();
 page.on('worker',w=>workers.add(w.url()));page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use();
 const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);
 const graphicsFailures=warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w));
 const status=info.status==='passed'&&(errors.length||graphicsFailures.length||!native?.contexts?.length||native?.errors?.length)?'failed':info.status;
 const report={title:info.title,status,candidate,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors,warnings,native,
  scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),workers:[...workers],chromeSourcePath,chromeSourceSha256,
  scope:'Bounded UI/camera and actual cross-browser strict replay. Visible actions; readonly camera/state projections. No injected runtime, completion, Worker request, or relaxed replay tolerance.'};
 const name=info.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase();writeFileSync(join(out,name+'.json'),JSON.stringify(report,null,2));
 if(status!==info.expectedStatus)await page.screenshot({path:join(out,name+'-failure.png')}).catch(()=>{});
 expect(errors).toEqual([]);expect(graphicsFailures).toEqual([]);expect(native).not.toBeNull();expect(native?.contexts?.length??0).toBeGreaterThan(0);expect(native?.errors??[]).toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:15000});test.setTimeout(240000);
const state=(p:Page)=>p.evaluate(()=>(window as any).__game.deployment()?.getState());
const camera=(p:Page)=>p.evaluate(()=>(window as any).__game.deployment().scene.qa.getCamera());
const control=(p:Page,a:string)=>p.locator(`[data-deployment-action="${a}"]`).first();
const ready=(p:Page)=>p.waitForFunction(()=>{const s=(window as any).__game.deployment()?.getState();return s&&!s.pending&&!s.busy&&!s.restoring&&!s.saving&&!s.closing;},null,{timeout:180000});
const physical=(s:any)=>({craft:s.craft,plan:s.plan,numerics:s.numerics,runtime:s.runtime,result:s.result,sourceId:s.scene.sourceId});
const sourceFields=(s:any)=>({format:s.format,version:s.version,identity:s.identity,craft:s.craft,plan:s.plan,numerics:s.numerics,checkpoint:s.checkpoint});
const distance=(c:any)=>Math.hypot(...c.position.map((v:number,i:number)=>v-c.target[i]));
const viewAngle=(a:any,b:any)=>{const x=a.position.map((v:number,i:number)=>(v-a.target[i])/distance(a)),y=b.position.map((v:number,i:number)=>(v-b.target[i])/distance(b));return Math.acos(Math.max(-1,Math.min(1,x.reduce((n:number,v:number,i:number)=>n+v*y[i],0))));};
async function boot(p:Page,edge=false){await p.addInitScript(()=>localStorage.setItem('orbital-language','ko'));await p.goto('/?qa');await p.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));expect(await p.evaluate(()=>navigator.userAgent.includes('Edg/'))).toBe(edge);}
async function open(p:Page){await p.locator('[data-action="missions"]').click();await p.locator('[data-action="mission-deployment"]').click();await ready(p);}
async function exportText(p:Page){const event=p.waitForEvent('download');await control(p,'export').click();const download=await event;expect(await download.failure()).toBeNull();await ready(p);return readFileSync((await download.path())!,'utf8');}
async function restoreText(p:Page,text:string,name:string){const id=(await state(p)).requestId,event=p.waitForEvent('filechooser');await control(p,'import').click();await(await event).setFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});await p.waitForFunction(previous=>(window as any).__game.deployment()?.getState().requestId>previous,id);await ready(p);}
async function finish(p:Page){
 await control(p,'launch').click();await p.waitForFunction(()=>(window as any).__game.deployment().getState().runtime?.time>2);
 await control(p,'play').click();await ready(p);expect((await state(p)).playing).toBe(false);
 while((await state(p)).speed!==512)await control(p,'speed').click();await control(p,'play').click();
 await p.waitForFunction(()=>{const s=(window as any).__game.deployment().getState();return s.runtime?.status==='complete'||(!s.playing&&!s.busy);},null,{timeout:180000});
 await ready(p);const s=await state(p);expect(s.result?.success).toBe(true);expect(s.result.receivedBits).toBe(16000000);return s;
}
async function hitVisible(p:Page,selector:string){const b=await p.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,hit:hit===el||el.contains(hit)};});expect(b.left).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(1280);expect(b.top).toBeGreaterThanOrEqual(0);expect(b.bottom).toBeLessThanOrEqual(720);expect(b.hit).toBe(true);return b;}

for(const scale of ['normal','large'] as const)test(`Chrome ${scale} fixed wing labels and working faces control`,async({page})=>{
 await boot(page);await page.locator('[data-action="settings"]').click();await page.locator('#ui-scale').selectOption(scale);if(scale==='large')await page.locator('#motion').selectOption('reduced');await page.locator('[data-action="close-modal"]').click();
 const observations=[];
 for(const language of ['ko','en'] as const){
  if(language==='en')await page.locator('[data-action="language"]').click();
  await open(page);await control(page,'variants').click();await control(page,'preset:fixed').click();await ready(page);
  const label=language==='ko'?'고정형 태양판':'Fixed solar wing';await expect(page.locator('[data-deployment-action="part:wing"] strong')).toHaveText(label);
  // Working-face geometry requires an actual flight snapshot. Produce a short
  // genuine prefix, then pause before checking this camera-only control.
  await control(page,'launch').click();await page.waitForFunction(()=>(window as any).__game.deployment().getState().runtime?.time>2);
  await control(page,'play').click();await ready(page);expect((await state(page)).playing).toBe(false);
  const bounds=await hitVisible(page,'[data-deployment-action="working-faces"]');const before=physical(await state(page));
  await control(page,'working-faces').click();await page.waitForTimeout(400);expect(physical(await state(page))).toEqual(before);
  observations.push({language,scale,label,bounds,camera:await camera(page)});await page.screenshot({path:join(out,`${language}-${scale}-fixed-working-faces.png`)});
  if(language==='ko'){await control(page,'exit').click();await expect(page.locator('.deployment-experience')).toHaveCount(0);}
 }
 writeFileSync(join(out,`${scale}-labels-and-bounds.json`),JSON.stringify(observations,null,2));
 if(scale==='normal'){
  // Preserve an actual Chrome result for the following Edge comparison. The
  // input is the real r1 Chrome flight export, never a reconstructed runtime.
  await restoreText(page,chromeSourceText,'actual-r1-chrome-flight.json');const restored=await state(page);expect(restored.error).toBe('');expect(restored.result.success).toBe(true);
  const terminalBefore=physical(restored);await control(page,'working-faces').click();await page.waitForTimeout(400);expect(physical(await state(page))).toEqual(terminalBefore);
  await page.screenshot({path:join(out,'chrome-r1-terminal-working-faces.png')});
  const exported=JSON.parse(await exportText(page));expect(sourceFields(exported)).toEqual(sourceFields(chromeSource));
  const baseline={chromeSourceSha256,browser:page.context().browser()?.version(),source:sourceFields(exported),physical:physical(await state(page))};
  writeFileSync(join(out,'chrome-strict-replay-baseline.json'),JSON.stringify(baseline,null,2));
 }
});

test('Edge actual repair full flight exact replay and working faces navigation',async({page})=>{
 test.setTimeout(300000);await boot(page,true);await open(page);
 const original=await state(page);expect(original.draft.launchable).toBe(false);
 const cta=page.locator('.deployment-first-action [data-deployment-action="part:cable-guide"]');await cta.click();await expect(cta).toBeFocused();await page.waitForTimeout(400);await expect(cta).toBeFocused();
 const point=await page.evaluate(()=>(window as any).__game.deployment().scene.qa.getPartScreen('cable-guide'));expect(point.visible).toBe(true);
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x,point.y-75,{steps:20});await page.mouse.up();await ready(page);
 const repaired=await state(page);expect(repaired.draft.launchable).toBe(true);expect(repaired.craft).not.toEqual(original.craft);expect(repaired.craft.parts.find((p:any)=>p.id==='cable-guide').v).toBeGreaterThan(.65);
 await finish(page);const selfText=await exportText(page),selfBefore=physical(await state(page));
 await restoreText(page,selfText,'actual-edge-terminal-flight.json');expect((await state(page)).error).toBe('');expect(physical(await state(page))).toEqual(selfBefore);
 const before=physical(await state(page)),beforeCamera=await camera(page);await page.screenshot({path:join(out,'edge-terminal-before-working-faces.png')});
 await hitVisible(page,'[data-deployment-action="working-faces"]');await control(page,'working-faces').click();await page.waitForTimeout(500);const workingCamera=await camera(page);
 expect(viewAngle(beforeCamera,workingCamera),'The preset visibly changes the viewing direction').toBeGreaterThan(.05);expect(physical(await state(page))).toEqual(before);await page.screenshot({path:join(out,'edge-terminal-working-faces.png')});
 const point2={x:640,y:360};expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)===(window as any).__game.deployment().scene.qa.canvas,point2)).toBe(true);
 await page.mouse.move(point2.x,point2.y);await page.mouse.down({button:'right'});await page.mouse.move(point2.x+70,point2.y-25,{steps:16});await page.mouse.up({button:'right'});await page.waitForTimeout(500);const orbited=await camera(page);expect(viewAngle(workingCamera,orbited)).toBeGreaterThan(.02);
 await page.mouse.wheel(0,180);await page.waitForTimeout(700);const zoomed=await camera(page);expect(distance(zoomed)).toBeGreaterThan(distance(orbited));expect(physical(await state(page))).toEqual(before);
 await page.screenshot({path:join(out,'edge-terminal-after-native-orbit-and-wheel.png')});
 writeFileSync(join(out,'edge-self-terminal-save.json'),selfText);writeFileSync(join(out,'edge-working-faces-state-evidence.json'),JSON.stringify({physicalBefore:before,physicalAfter:physical(await state(page)),beforeCamera,workingCamera,orbited,zoomed},null,2));
});

test('Edge strictly imports actual Chrome terminal source with exact cross browser state',async({page})=>{
 expect(baselinePath,'Run the Chrome normal case first and provide its readonly baseline path').toBeTruthy();const baseline=JSON.parse(readFileSync(resolve(baselinePath!),'utf8'));expect(baseline.chromeSourceSha256).toBe(chromeSourceSha256);
 await boot(page,true);await open(page);await control(page,'variants').click();await control(page,'preset:compact').click();await ready(page);
 await control(page,'launch').click();await page.waitForFunction(()=>(window as any).__game.deployment().getState().runtime?.time>2);await control(page,'play').click();await ready(page);await control(page,'step').click();await ready(page);
 const prior=physical(await state(page));expect(prior.runtime.time).toBeGreaterThan(2);
 await restoreText(page,chromeSourceText,'actual-chrome-terminal-cross-browser.json');const restored=await state(page);
 const evidence={chromeSourceSha256,baselinePath,prior,restored:physical(restored),error:restored.error,baseline};writeFileSync(join(out,'edge-chrome-exact-replay.json'),JSON.stringify(evidence,null,2));
 if(restored.error){expect(physical(restored),'Rejected cross-browser restore must retain the actual prior flight').toEqual(prior);expect(restored.error,'Strict cross-browser replay failed; no tolerance adjustment is allowed').toBe('');}
 expect(physical(restored)).toEqual(baseline.physical);const exported=JSON.parse(await exportText(page));expect(sourceFields(exported)).toEqual(baseline.source);expect(sourceFields(exported)).toEqual(sourceFields(chromeSource));
 await page.screenshot({path:join(out,'edge-chrome-terminal-exact-replay.png')});
});
