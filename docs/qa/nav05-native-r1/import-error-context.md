# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transfer-plan-comparison.spec.ts >> English large comparison survives pointer cancellation context restore and resets on import and launch
- Location: tests\browser\transfer-plan-comparison.spec.ts:39:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 14
+ Received  +  4

@@ -1,7 +1,9 @@
  Object {
    "craft": Object {
+     "hazard": "none",
+     "launchPackageId": undefined,
      "missionId": "mars",
      "name": "PATHFINDER-01",
      "parts": Array [
        Object {
          "face": "px",
@@ -56,28 +58,16 @@
        "altitudeKm": 600,
        "bPlaneAngleDeg": 0,
        "burnTime": 1200,
        "inclinationDeg": 51.6,
        "normalMps": 0,
-       "operations": Array [
-         Object {
-           "end": 10400,
-           "id": "obs-1",
-           "kind": "observe",
-           "start": 7200,
-         },
-         Object {
-           "end": 17100,
-           "id": "down-1",
-           "kind": "downlink",
-           "start": 10600,
-         },
-       ],
+       "operations": Array [],
        "periapsisAltitudeKm": 1000,
        "progradeMps": 0,
        "radialMps": 0,
      },
+     "scienceTarget": undefined,
      "seed": 20261115,
      "version": 1,
    },
    "evaluation": Object {
      "availableDeltaVMps": 4323.226560902583,
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic "3D Earth–Mars transfer. Drag departure and arrival handles with the left button, orbit with the right button, scroll to zoom." [ref=e5]
    - generic:
      - generic: SUN
      - generic: EARTH
      - generic: MARS
      - generic: EARTH DEPARTURE · DRAG
      - generic: MARS ARRIVAL · DRAG
      - generic: "ICRF · Distance: 1 AU = 10 units · Planet/craft sizes enlarged · Drag handles ±45 TDB days · Illustrative craft orientation"
  - generic:
    - banner:
      - button "ORBITAL MISSION FOUNDRY" [ref=e6] [cursor=pointer]:
        - text: ORBITAL
        - generic [ref=e7]: MISSION FOUNDRY
      - generic: M03 · EARTH TO MARS
      - generic:
        - button "Solar system" [ref=e8] [cursor=pointer]
        - button "Earth escape" [ref=e9] [cursor=pointer]
        - button "Mars encounter" [ref=e10] [cursor=pointer]
        - button "Spacecraft" [disabled] [ref=e11]
    - complementary [ref=e12]:
      - generic [ref=e13]: FLIGHT WINDOW
      - heading "Connect two moving worlds" [level=2] [ref=e14]
      - paragraph [ref=e15]: Drag the Earth and Mars date handles along their orbits. Recalculate the fuel and power needed for a different encounter.
      - generic [ref=e16]:
        - text: Earth departure · TDB
        - textbox "Earth departure · TDB" [ref=e17]: 2026-11-17
      - generic [ref=e18]:
        - text: Mars periapsis · TDB
        - textbox "Mars periapsis · TDB" [ref=e19]: 2027-08-02
      - generic [ref=e20]:
        - generic [ref=e21]: Time of flight
        - strong [ref=e22]: 258 d
      - generic [ref=e23]:
        - text: Mars periapsis altitude
        - generic [ref=e24]: 1,000 km
        - slider "Mars periapsis altitude 1,000 km" [ref=e25]: "1000"
      - generic [ref=e26]:
        - text: Encounter plane angle
        - generic [ref=e27]: 0°
        - slider "Encounter plane angle 0°" [ref=e28]: "0"
      - button "Edit spacecraft layout" [ref=e29] [cursor=pointer]
      - group [ref=e30]:
        - generic "Load example plan" [ref=e31] [cursor=pointer]
      - group [ref=e32]:
        - generic "Save & backup" [ref=e33] [cursor=pointer]
        - generic [ref=e34]:
          - button "Save" [ref=e35] [cursor=pointer]
          - button "Load" [ref=e36] [cursor=pointer]
        - generic [ref=e37]:
          - button "JSON ↓" [ref=e38] [cursor=pointer]
          - button "JSON ↑" [ref=e39] [cursor=pointer]
        - generic [ref=e40]: Saved in this browser
      - group [ref=e41]:
        - generic "Scientific model & sources" [ref=e42] [cursor=pointer]
    - complementary [ref=e43]:
      - generic [ref=e44]: DEPARTURE REVIEW
      - heading "Ready to depart" [level=2] [ref=e45]
      - generic [ref=e46]:
        - text: Escape stage
        - combobox "Escape stage" [ref=e47]:
          - option "PATHFINDER · 95 C" [selected]
          - option "EXPLORER · 140 C"
          - option "HEAVY · 210 C"
      - generic [ref=e48]:
        - generic [ref=e49]: Escape burn
        - strong [ref=e50]: 3,706 m/s
      - generic [ref=e51]:
        - generic [ref=e52]: C3
        - strong [ref=e53]: 11.32 km²/s²
      - generic [ref=e54]:
        - generic [ref=e55]: Stage fuel margin
        - strong [ref=e56]: 18 kg
      - generic [ref=e57]:
        - generic [ref=e58]: Mission cost
        - strong [ref=e59]: 499 / 680 C
      - generic [ref=e61]: SCIENCE RETURN FORECAST
      - generic [ref=e62]: 3/ 3
      - paragraph [ref=e63]: This plan meets the science objective.
      - button "Execute Earth departure" [ref=e64] [cursor=pointer]
      - paragraph [ref=e65]: Stages and prices are authored game settings. Trajectories use JPL ephemerides and patched central-body gravity.
    - generic:
      - text: Drag date handles · right-drag to orbit · wheel to zoom
      - generic: Planet and spacecraft display sizes exaggerated · computed distances and times
    - generic [ref=e66]:
      - generic [ref=e67]:
        - strong [ref=e68]: MARS ENCOUNTER SEQUENCE
        - generic [ref=e69]:
          - button "Approach · 6h" [ref=e70] [cursor=pointer]
          - button "Delivery · 48h" [ref=e71] [cursor=pointer]
        - generic [ref=e72]: Drag blocks to move · right edge to resize
      - generic [ref=e73]:
        - generic [ref=e74]: Spectra
        - generic [ref=e77]: Downlink
      - generic [ref=e80]:
        - generic [ref=e81]: "-3h"
        - generic [ref=e82]: "-1.5h"
        - generic [ref=e83]: 0h
        - generic [ref=e84]: 1.5h
        - generic [ref=e85]: 3h
      - text: 0h = Mars periapsis · empty periods charge toward the Sun · date changes preserve encounter-relative timing
```

# Test source

```ts
  1  | import {test as base,expect,type Page} from '@playwright/test';
  2  | import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
  3  | import {join} from 'node:path';
  4  | import {installNativeDeletionAudit} from './native-gl-audit';
  5  | 
  6  | const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'nav05-unfrozen';
  7  | if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate');
  8  | const out=join(process.cwd(),'tests/browser/artifacts/nav05',candidate);mkdirSync(out,{recursive:true});
  9  | const test=base.extend<{audit:void}>({audit:[async({page},use,info)=>{
  10 |  await installNativeDeletionAudit(page);const errors:string[]=[],warnings:string[]=[];
  11 |  page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  12 |  await use();const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null),name=info.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  13 |  writeFileSync(join(out,name+'.json'),JSON.stringify({title:info.title,status:info.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors,warnings,native,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[])},null,2));
  14 |  if(info.status!==info.expectedStatus)await page.screenshot({path:join(out,name+'-failure.png')}).catch(()=>{});
  15 |  expect(errors).toEqual([]);expect(native?.errors??[]).toEqual([]);expect(native?.contexts?.length).toBeGreaterThan(0);expect(warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w))).toEqual([]);
  16 | },{auto:true}]});
  17 | test.setTimeout(180000);test.use({actionTimeout:15000});
  18 | const state=(p:Page)=>p.evaluate(()=>(window as any).__game.transfer().getState());
  19 | const accepted=(s:any)=>({plan:s.plan,craft:s.craft,solution:s.solution,evaluation:s.evaluation,preview:s.preview});
  20 | const action=(p:Page,a:string)=>p.locator(`[data-transfer-action="${a}"]`).first();
  21 | const ready=(p:Page)=>p.waitForFunction(()=>{const t=(window as any).__game.transfer();return t&&!t.pending&&!t.busy;},null,{timeout:60000,polling:250});
  22 | const overlay=(p:Page)=>p.evaluate(()=>(window as any).__game.transfer().scene.getPlanComparisonState());
  23 | async function settled(p:Page){let last='',same=0;for(let i=0;i<100;i++){const now=await p.evaluate(()=>{const s=(window as any).__game.transfer().scene;return [...s.camera.position.toArray(),...s.controls.target.toArray()].map((n:number)=>Math.round(n*1e6));}),text=JSON.stringify(now);same=text===last?same+1:0;if(same>=3)return now;last=text;await p.waitForTimeout(50);}throw Error('Camera did not settle');}
  24 | async function hit(p:Page,selector:string){const b=await p.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,hit:el===h||el.contains(h),vw:innerWidth,vh:innerHeight};});expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(b.vw);expect(b.bottom).toBeLessThanOrEqual(b.vh);expect(b.hit).toBe(true);return b;}
  25 | async function boot(p:Page,en=false,large=false){await p.goto('/?qa');await p.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));if(en)await p.locator('[data-action="language"]').click();await p.locator('[data-action="settings"]').click();await p.locator('#quality').selectOption('medium');await p.locator('#motion').selectOption('reduced');if(large)await p.locator('#ui-scale').selectOption('large');await p.locator('[data-action="close-modal"]').click();await p.locator('[data-action="missions"]').click();await p.locator('[data-action="mission-transfer"]').click();await p.locator('[data-action="plan"]').last().click();await ready(p);await settled(p);expect((await state(p)).comparison.status).toBe('ready');}
  26 | async function dragDate(p:Page,days:number,cancel=false){await settled(p);const points=await p.evaluate(days=>{const s=(window as any).__game.transfer().scene,a=s.getHandleScreen('departure');return{a,b:s.getHandleScreen('departure',a.jdTdb+days),isCanvas:document.elementFromPoint(a.x,a.y)===s.canvas};},days);expect(points.isCanvas).toBe(true);expect(points.b.visible).toBe(true);await p.mouse.move(points.a.x,points.a.y);await p.mouse.down();await p.mouse.move(points.b.x,points.b.y,{steps:18});if(cancel)await p.keyboard.press('Escape');await p.mouse.up();if(!cancel)await ready(p);return points;}
  27 | async function checkRows(p:Page,old:any,current:any){const facts=await p.locator('[data-comparison]').evaluateAll(es=>es.map(e=>({id:(e as HTMLElement).dataset.comparison,previous:Number((e as HTMLElement).dataset.previousValue),current:(e as HTMLElement).dataset.currentValue===undefined?null:Number((e as HTMLElement).dataset.currentValue)})));const expected:any={duration:[old.solution.periapsisSeconds,current.solution.periapsisSeconds],arrival:[old.solution.plan.arrivalPeriapsisJdTdb,current.solution.plan.arrivalPeriapsisJdTdb],c3:[old.solution.c3Km2S2,current.solution.c3Km2S2],fuel:[old.evaluation.fuelUsedKg,current.evaluation.fuelUsedKg],science:[old.preview.received,current.preview.received]};for(const row of facts){if(!row.id)throw Error('Comparison row lacks a metric id');expect(row.previous).toBe(expected[row.id][0]);expect(row.current).toBe(expected[row.id][1]);}expect(facts).toHaveLength(5);return facts;}
  28 | 
  29 | test('native date route change preserves computed consequences through infeasible input and exact return',async({page})=>{
  30 |  await page.setViewportSize({width:1280,height:720});await boot(page);const original=accepted(await state(page));expect((await overlay(page)).visible).toBe(false);
  31 |  const points=await dragDate(page,2);const changed=accepted(await state(page));expect(changed.plan.departurePeriapsisJdTdb).not.toBe(original.plan.departurePeriapsisJdTdb);expect(changed.solution.c3Km2S2).not.toBe(original.solution.c3Km2S2);expect((await state(page)).comparison.status).toBe('ready');expect((await state(page)).comparison.previousPlan).toEqual(original.plan);
  32 |  const prior=await overlay(page);expect(prior.visible).toBe(true);expect(prior.paths).toHaveLength(3);expect(prior.paths.every((p:any)=>p.dashed&&p.points.length>=300)).toBe(true);const rows=await checkRows(page,original,changed);await hit(page,'[data-transfer-action="restore-previous-plan"]');await page.screenshot({path:join(out,'ko-normal-1280-changed.png')});
  33 |  const blockedPoints=await dragDate(page,43);const blocked=await state(page);expect(blocked.evaluation.launchable).toBe(false);expect(blocked.comparison.status).toBe('unlaunchable');expect(blocked.comparison.previousPlan).toEqual(changed.plan);expect(blocked.evaluation.stageFuelRemainingKg).toBeLessThan(0);await page.screenshot({path:join(out,'ko-normal-1280-fuel-blocked.png')});
  34 |  await page.locator('[data-transfer-date="arrival"]').fill('2026-11-20');await page.locator('[data-transfer-date="arrival"]').press('Tab');await page.locator('.transfer-topbar>span').click();await ready(page);const invalid=await state(page);expect(invalid.comparison.status).toBe('infeasible');expect(invalid.solution).toBeNull();expect(invalid.comparison.previousPlan).toEqual(changed.plan);expect((await overlay(page)).visible).toBe(true);expect(await page.locator('[data-comparison="c3"]').getAttribute('data-current-value')).toBeNull();await hit(page,'[data-transfer-action="restore-previous-plan"]');await page.screenshot({path:join(out,'ko-normal-1280-infeasible.png')});
  35 |  await action(page,'restore-previous-plan').click();await ready(page);const restored=accepted(await state(page));expect(restored).toEqual(changed);expect((await state(page)).comparison.previousPlan).toBeNull();expect((await overlay(page)).paths).toHaveLength(0);await expect(action(page,'launch')).toBeEnabled();await page.screenshot({path:join(out,'ko-normal-1280-restored.png')});
  36 |  writeFileSync(join(out,'native-route-return.json'),JSON.stringify({points,original,changed,prior,rows,blockedPoints,blocked:accepted(blocked),invalid:{plan:invalid.plan,comparison:invalid.comparison,error:invalid.error},restored},null,2));
  37 | });
  38 | 
  39 | test('English large comparison survives pointer cancellation context restore and resets on import and launch',async({page})=>{
  40 |  await page.setViewportSize({width:1920,height:1080});await boot(page,true,true);await dragDate(page,2);const before=accepted(await state(page)),comparison=(await state(page)).comparison,prior=await overlay(page);expect(prior.visible).toBe(true);
  41 |  await dragDate(page,5,true);expect(accepted(await state(page))).toEqual(before);expect((await state(page)).comparison).toEqual(comparison);expect(await overlay(page)).toEqual(prior);
  42 |  await action(page,'view-earth').click();expect((await overlay(page)).visible).toBe(false);await action(page,'view-solar').click();expect((await overlay(page)).visible).toBe(true);expect(accepted(await state(page))).toEqual(before);
  43 |  const resources=await page.evaluateHandle(()=>{const g=(window as any).__game.transfer().scene.previousPathGroup;return g.children.map((o:any)=>({object:o,geometry:o.geometry,material:o.material,attribute:o.geometry.getAttribute('position'),array:o.geometry.getAttribute('position').array}));});
  44 |  const extension=await page.evaluateHandle(()=>(window as any).__game.transfer().scene.renderer.getContext().getExtension('WEBGL_lose_context'));await extension.evaluate(x=>x.loseContext());await page.waitForFunction(()=>(window as any).__allContextDeletionAudit.contextLostNotifications>0);await extension.evaluate(x=>x.restoreContext());await page.waitForFunction(()=>(window as any).__allContextDeletionAudit.contexts.some((c:any)=>c.restores>0));await ready(page);await settled(page);await extension.dispose();
  45 |  expect(await resources.evaluate(refs=>{const g=(window as any).__game.transfer().scene.previousPathGroup;return refs.every((r:any,i:number)=>{const o=g.children[i];return o===r.object&&o.geometry===r.geometry&&o.material===r.material&&o.geometry.getAttribute('position')===r.attribute&&o.geometry.getAttribute('position').array===r.array;});})).toBe(true);expect(await overlay(page)).toEqual(prior);expect(accepted(await state(page))).toEqual(before);await resources.dispose();await hit(page,'[data-transfer-action="restore-previous-plan"]');await page.screenshot({path:join(out,'en-large-1920-context-restored.png')});
> 46 |  await page.locator('.transfer-save-tools summary').click();const download=page.waitForEvent('download');await action(page,'export').click();const file=await download,path=await file.path();expect(await file.failure()).toBeNull();const text=readFileSync(path!,'utf8');await page.locator('.transfer-import').setInputFiles({name:'actual-nav05-draft.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(id=>(window as any).__game.transfer().getState().comparison.requestId>id,comparison.requestId,{timeout:60000,polling:250});await ready(page);expect(accepted(await state(page))).toEqual(before);expect((await state(page)).comparison.previousPlan).toBeNull();expect((await overlay(page)).paths).toHaveLength(0);
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ^ Error: expect(received).toEqual(expected) // deep equality
  47 |  await dragDate(page,1);expect((await overlay(page)).visible).toBe(true);const launchedPlan=(await state(page)).plan;await action(page,'launch').click();await page.waitForFunction(()=>!!(window as any).__game.transfer().runtime,null,{polling:250});await ready(page);expect((await state(page)).plan).toEqual(launchedPlan);expect((await state(page)).comparison.status).toBe('empty');expect((await overlay(page)).paths).toHaveLength(0);await action(page,'exit').click();await expect(page.locator('#transfer-experience')).toHaveCount(0);
  48 |  writeFileSync(join(out,'native-lifecycle.json'),JSON.stringify({before,comparison,prior,launchedPlan,scope:'Actual renderer resources, genuine native context recovery, exported/imported worker-validated plan and real launch. No runtime injection.'},null,2));
  49 | });
  50 | 
```