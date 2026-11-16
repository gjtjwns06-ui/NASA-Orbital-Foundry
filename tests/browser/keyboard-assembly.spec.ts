import {test as base,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {installNativeDeletionAudit} from './native-gl-audit';
const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'keyboard-development';
if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate');
const output=join(process.cwd(),'tests/browser/artifacts/keyboard-assembly',candidate);mkdirSync(output,{recursive:true});
const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
 await installNativeDeletionAudit(page);
 const errors:string[]=[],warnings:string[]=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
 await use(errors);const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);
 const graphicsFailures=warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w));
 const status=info.status==='passed'&&(errors.length||graphicsFailures.length||!native?.contexts?.length||native?.errors?.length)?'failed':info.status;
 const report={title:info.title,status,browser:page.context().browser()?.version(),errors,warnings,native,viewport:page.viewportSize(),workers:page.workers().map(w=>w.url()),url:page.url(),scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)),scope:'Actual native Tab/Enter/Space/arrows/R/numeric entry; no state injection or private placement call. Assembly only, no full keyboard-game or100ms latency claim.'};
 writeFileSync(join(output,info.title.replace(/[^a-zA-Z0-9-]/g,'_')+'.json'),JSON.stringify(report,null,2));
 if(status!==info.expectedStatus)await page.screenshot({path:join(output,info.title.replace(/[^a-zA-Z0-9-]/g,'_')+'-failure.png'),fullPage:true}).catch(()=>{});
 expect(errors).toEqual([]);expect(graphicsFailures).toEqual([]);expect(native).not.toBeNull();expect(native?.contexts?.length??0).toBeGreaterThan(0);expect(native?.errors??[]).toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:12000,trace:'retain-on-failure'});test.setTimeout(120000);
const state=(p:Page)=>p.evaluate(()=>(window as any).__game.getState());
const action=(p:Page,a:string)=>p.locator(`[data-action="${a}"]`).first().click();
const ready=(p:Page)=>p.waitForFunction(()=>{const g=(window as any).__game,s=g?.getState();return s&&!s.pending&&s.acceptedRevision===s.revision&&!g.scene.tween;});
async function tabTo(p:Page,selector:string){
 for(let n=0;n<120;n++){if(await p.locator(selector).first().evaluate(el=>el===document.activeElement).catch(()=>false))return;await p.keyboard.press('Tab');}
 throw Error('Native Tab could not reach '+selector);
}
async function typeField(p:Page,field:string,value:string){await tabTo(p,`[data-kb-field="${field}"]`);await p.keyboard.press('Control+a');if(value)await p.keyboard.insertText(value);else await p.keyboard.press('Backspace');}
const view=(p:Page)=>p.evaluate(()=>{const s=(window as any).__game.scene;return {camera:s.camera.position.toArray(),target:s.controls.target.toArray(),bay:s.bayOpen,stow:s.stowOpen};});
const savedView=(p:Page)=>p.evaluate(()=>{const s=(window as any).__game.scene.keyboardPlacementView;return {camera:s.position.toArray(),target:s.target.toArray(),bay:s.bayOpen,stow:s.stowOpen};});
function sameView(a:Awaited<ReturnType<typeof view>>,b:Awaited<ReturnType<typeof view>>){expect(a.bay).toBe(b.bay);expect(a.stow).toBe(b.stow);for(const key of ['camera','target'] as const)for(let i=0;i<3;i++)expect(a[key][i]).toBeCloseTo(b[key][i],10);}
async function controlsVisible(p:Page){return p.locator('[data-kb-command="confirm"],[data-kb-command="cancel"]').evaluateAll(es=>es.map(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {top:b.top,bottom:b.bottom,left:b.left,right:b.right,hit:hit===el||el.contains(hit)};}));}

for(const language of ['ko','en'] as const)for(const scale of ['normal','large'] as const){
 test(`${language}-${scale} native keyboard placement move cancel and undo`,async({page})=>{
  await page.addInitScript(lang=>localStorage.setItem('orbital-language',lang),language);
  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
  await action(page,'settings');await page.locator('#ui-scale').selectOption(scale);if(scale==='large')await page.locator('#motion').selectOption('reduced');await action(page,'close-modal');
  await action(page,'missions');await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await ready(page);
  const initial=(await state(page)).design,initialView=await view(page);expect(initial.parts).toHaveLength(0);
  const palette='[data-model="bpx100-4s2p-v2"]';await tabTo(page,palette);await page.keyboard.press('Enter');await expect(page.locator('.keyboard-placement')).toBeVisible();
  const initialSavedView=await savedView(page);
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowUp');await page.keyboard.press('r');
  await expect(page.locator('[data-kb-field="u"]')).toHaveValue('0.02');await expect(page.locator('[data-kb-field="v"]')).toHaveValue('0.005');await expect(page.locator('[data-kb-field="rotation"]')).toHaveValue('15');
  expect((await state(page)).design).toEqual(initial);expect(await page.evaluate(()=>(window as any).__game.scene.bayOpen)).toBe(true);
  await typeField(page,'u','1');await tabTo(page,'[data-kb-command="pad"]');await page.keyboard.press('Enter');
  await expect(page.locator('[data-kb-command="confirm"]')).toBeDisabled();expect((await state(page)).design).toEqual(initial);await expect(page.locator('.kb-status')).toHaveAttribute('data-valid','false');
  await page.screenshot({path:join(output,`${language}-${scale}-rejected-ghost.png`)});
  await typeField(page,'u','0.02');await tabTo(page,'[data-kb-field="v"]');await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-kb-field="v"]')).toHaveValue('0.01');expect((await state(page)).design).toEqual(initial);
  // Empty numeric values cannot be rescued by editing a different field.
  await typeField(page,'u','');await typeField(page,'rotation','30');await expect(page.locator('[data-kb-command="confirm"]')).toBeDisabled();
  await typeField(page,'u','0.02');await tabTo(page,'[data-kb-command="pad"]');
  const boxes=await controlsVisible(page);for(const b of boxes){expect(b.left).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(1280);expect(b.top).toBeGreaterThanOrEqual(0);expect(b.bottom).toBeLessThanOrEqual(720);expect(b.hit).toBe(true);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:join(output,`${language}-${scale}-valid-ghost.png`)});
  await page.keyboard.press('Escape');await expect(page.locator('.keyboard-placement')).toHaveCount(0);expect((await state(page)).design).toEqual(initial);sameView(await view(page),initialSavedView);
  // Native Space on the same focused palette control starts another edit.
  await expect(page.locator(palette)).toBeFocused();await page.keyboard.press('Space');await expect(page.locator('.keyboard-placement')).toBeVisible();
  await page.keyboard.press('ArrowLeft');await page.keyboard.press('Enter');await ready(page);const placed=(await state(page)).design;expect(placed.parts).toHaveLength(1);expect(placed.parts[0]).toMatchObject({kind:'battery',face:'py',u:-.02});
  const id=placed.parts[0].id;await expect(page.locator(`[data-keyboard-part="${id}"]`)).toBeFocused();
  await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('r');expect((await state(page)).design).toEqual(placed);
  await page.keyboard.press('Enter');await ready(page);const moved=(await state(page)).design;expect(moved.parts[0]).toMatchObject({id,u:.02,rotation:15});
  await page.keyboard.press('Control+z');await ready(page);expect((await state(page)).design).toEqual(placed);
  await page.keyboard.press('Control+z');await ready(page);expect((await state(page)).design).toEqual(initial);
  await page.keyboard.press('Control+y');await ready(page);expect((await state(page)).design).toEqual(placed);
  await page.keyboard.press('Control+y');await ready(page);expect((await state(page)).design).toEqual(moved);
  // A new invalid face is not accepted; Escape restores actual previous view.
  await tabTo(page,'.keyboard-parts summary');if(!await page.locator('.keyboard-parts').evaluate(el=>(el as HTMLDetailsElement).open))await page.keyboard.press('Enter');await tabTo(page,`[data-keyboard-part="${id}"]`);await page.keyboard.press('Enter');const beforeMoveView=await savedView(page);
  await tabTo(page,'[data-kb-field="face"]');await page.keyboard.press('Home');await expect(page.locator('[data-kb-command="confirm"]')).toBeDisabled();await page.keyboard.press('Escape');
  expect((await state(page)).design).toEqual(moved);sameView(await view(page),beforeMoveView);
  writeFileSync(join(output,`${language}-${scale}-states.json`),JSON.stringify({initial,placed,moved,boxes,initialView,cancelledView:await view(page)},null,2));
  await page.screenshot({path:join(output,`${language}-${scale}-committed.png`)});
 });
}
