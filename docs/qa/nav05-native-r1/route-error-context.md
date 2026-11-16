# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transfer-plan-comparison.spec.ts >> native date route change preserves computed consequences through infeasible input and exact return
- Location: tests\browser\transfer-plan-comparison.spec.ts:29:1

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.transfer-topbar>span')
    - locator resolved to <span>M03 · 지구에서 화성까지</span>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <canvas width="1280" height="720" data-quality="medium" id="transfer-universe" data-engine="three.js r182" aria-label="3D 지구–화성 전이. 출발·도착 손잡이를 왼쪽 드래그, 시점을 오른쪽 드래그, 휠로 확대합니다."></canvas> from <div class="transfer-viewport">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <canvas width="1280" height="720" data-quality="medium" id="transfer-universe" data-engine="three.js r182" aria-label="3D 지구–화성 전이. 출발·도착 손잡이를 왼쪽 드래그, 시점을 오른쪽 드래그, 휠로 확대합니다."></canvas> from <div class="transfer-viewport">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    26 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <canvas width="1280" height="720" data-quality="medium" id="transfer-universe" data-engine="three.js r182" aria-label="3D 지구–화성 전이. 출발·도착 손잡이를 왼쪽 드래그, 시점을 오른쪽 드래그, 휠로 확대합니다."></canvas> from <div class="transfer-viewport">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic "3D 지구–화성 전이. 출발·도착 손잡이를 왼쪽 드래그, 시점을 오른쪽 드래그, 휠로 확대합니다." [ref=e5]
    - generic:
      - generic: SUN
      - generic: 현재 경로를 계산하지 못했습니다 · 점선은 이전 계획 · 이전 계획으로 돌아갈 수 있습니다.
  - generic:
    - banner:
      - button "ORBITAL MISSION FOUNDRY" [ref=e6] [cursor=pointer]:
        - text: ORBITAL
        - generic [ref=e7]: MISSION FOUNDRY
      - generic: M03 · 지구에서 화성까지
      - generic:
        - button "태양계" [ref=e8] [cursor=pointer]
        - button "지구 탈출" [ref=e9] [cursor=pointer]
        - button "화성 조우" [ref=e10] [cursor=pointer]
        - button "탐사선" [disabled] [ref=e11]
    - complementary [ref=e12]:
      - generic [ref=e13]: FLIGHT WINDOW
      - heading "두 행성을 잇는 궤적" [level=2] [ref=e14]
      - paragraph [ref=e15]: 지구와 화성 날짜 손잡이를 궤도 위로 끌어 보세요. 달라진 만남에 필요한 추진제와 전력을 다시 계산합니다.
      - generic [ref=e16]:
        - text: 지구 출발 · TDB
        - textbox "지구 출발 · TDB" [ref=e17]: 2026-12-30
      - generic [ref=e18]:
        - text: 화성 최근접 · TDB
        - textbox "화성 최근접 · TDB" [active] [ref=e19]: 2026-11-20
      - generic [ref=e20]:
        - generic [ref=e21]: 행성 간 비행
        - strong [ref=e22]: 215 d
      - generic [ref=e23]:
        - text: 화성 최근접 고도
        - generic [ref=e24]: 1,000 km
        - slider "화성 최근접 고도 1,000 km" [ref=e25]: "1000"
      - generic [ref=e26]:
        - text: 조우 평면 각도
        - generic [ref=e27]: 0°
        - slider "조우 평면 각도 0°" [ref=e28]: "0"
      - button "장비 배치 수정" [ref=e29] [cursor=pointer]
      - group [ref=e30]:
        - generic "예시 계획 불러오기" [ref=e31] [cursor=pointer]
      - group [ref=e32]:
        - generic "저장과 백업" [ref=e33] [cursor=pointer]
      - group [ref=e34]:
        - generic "과학 모델과 출처" [ref=e35] [cursor=pointer]
    - complementary [ref=e36]:
      - region "경로를 바꾼 결과" [ref=e37]:
        - generic [ref=e38]: ROUTE COMPARISON
        - heading "경로를 바꾼 결과" [level=2] [ref=e39]
        - paragraph [ref=e40]: "금색 점선: 이전 · 실선: 변경"
        - button "이전 계획으로 돌아가기" [ref=e41] [cursor=pointer]
        - status [ref=e42]: 새 계획은 발사 제약을 충족하지 못합니다.
        - generic [ref=e43]:
          - generic [ref=e44]:
            - generic [ref=e45]: 화성 최근접 · TDB
            - generic [ref=e46]: 0 d
          - generic [ref=e47]:
            - generic [ref=e48]: 2027-08-02
            - generic [aria-hidden] [ref=e49]: →
            - strong [ref=e50]: 2027-08-02
        - generic [ref=e51]:
          - generic [ref=e52]:
            - generic [ref=e53]: 화성까지 비행 기간
            - generic [ref=e54]: "-43 d"
          - generic [ref=e55]:
            - generic [ref=e56]: 258 d
            - generic [aria-hidden] [ref=e57]: →
            - strong [ref=e58]: 215 d
        - generic [ref=e59]:
          - generic [ref=e60]:
            - generic [ref=e61]: 출발 에너지 C3
            - generic [ref=e62]: +39.84 km²/s²
          - generic [ref=e63]:
            - generic [ref=e64]: "11.32"
            - generic [aria-hidden] [ref=e65]: →
            - strong [ref=e66]: "51.16"
        - generic [ref=e67]:
          - generic [ref=e68]:
            - generic [ref=e69]: 탈출단 추진제 소비
            - generic [ref=e70]: +40.9 kg
          - generic [ref=e71]:
            - generic [ref=e72]: 222 kg
            - generic [aria-hidden] [ref=e73]: →
            - strong [ref=e74]: 262.9 kg
        - generic [ref=e75]:
          - generic [ref=e76]:
            - generic [ref=e77]: 지구 수신 자료
            - generic [ref=e78]: —
          - generic [ref=e79]:
            - generic [ref=e80]: 3 / 3
            - generic [aria-hidden] [ref=e81]: →
            - strong [ref=e82]: —
        - paragraph [ref=e83]: "계획된 수신 마감: 각 경로의 화성 영향권 이탈2027-08-04 → 2027-08-03 TDB"
      - generic [ref=e84]: DEPARTURE REVIEW
      - heading "출발 준비" [level=2] [ref=e85]
      - generic [ref=e86]:
        - text: 탈출 추진 단계
        - combobox "탈출 추진 단계" [ref=e87]:
          - option "패스파인더 탈출 단계 · 95 C" [selected]
          - option "익스플로러 탈출 단계 · 140 C"
          - option "헤비 탈출 단계 · 210 C"
      - generic [ref=e88]:
        - generic [ref=e89]: 탈출 기동
        - strong [ref=e90]: 5,333 m/s
      - generic [ref=e91]:
        - generic [ref=e92]: C3
        - strong [ref=e93]: 51.16 km²/s²
      - generic [ref=e94]:
        - generic [ref=e95]: 단계 추진제 여유
        - strong [ref=e96]: "-22.9 kg"
      - generic [ref=e97]:
        - generic [ref=e98]: 총 예산
        - strong [ref=e99]: 499 / 680 C
      - generic [ref=e101]: SCIENCE RETURN FORECAST
      - generic [ref=e102]: 0/ 3
      - paragraph [ref=e103]: 관측과 지구 수신 조건을 다시 확인하세요.
      - paragraph [ref=e104]: "science-return: 화성 영향권 이탈 이후의 일정 구간은 임무 종료 시각에서 잘립니다."
      - paragraph [ref=e105]: 탈출 단계 추진제가 22.9 kg 부족합니다. 발사 날짜 또는 단계를 바꾸세요.
      - button "지구 탈출 기동 실행" [disabled] [ref=e106]
      - paragraph [ref=e107]: 추진 단계와 가격은 게임 설정입니다. 궤도는 JPL 천체력과 구간별 중력 모델을 사용합니다.
    - generic:
      - text: 날짜 손잡이 드래그 · 오른쪽 드래그로 회전 · 휠로 확대
      - generic: 행성·탐사선 크기 확대 표시 · 거리와 시간은 계산값
    - generic [ref=e108]:
      - generic [ref=e109]:
        - strong [ref=e110]: 화성 조우 일정
        - generic [ref=e111]:
          - button "접근 6시간" [ref=e112] [cursor=pointer]
          - button "수신 48시간" [ref=e113] [cursor=pointer]
        - generic [ref=e114]: 블록을 끌어 이동 · 오른쪽 끝으로 길이 조절
      - generic [ref=e115]:
        - generic [ref=e116]: 분광 관측
        - generic [ref=e119]: 지구 송신
      - generic [ref=e122]:
        - generic [ref=e123]: "-3h"
        - generic [ref=e124]: "-1.5h"
        - generic [ref=e125]: 0h
        - generic [ref=e126]: 1.5h
        - generic [ref=e127]: 3h
      - text: 0h = 화성 최근접 · 빈 구간은 태양 지향 충전 · 날짜 변경 시 조우 기준 일정 유지
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
> 34 |  await page.locator('[data-transfer-date="arrival"]').fill('2026-11-20');await page.locator('[data-transfer-date="arrival"]').press('Tab');await page.locator('.transfer-topbar>span').click();await ready(page);const invalid=await state(page);expect(invalid.comparison.status).toBe('infeasible');expect(invalid.solution).toBeNull();expect(invalid.comparison.previousPlan).toEqual(changed.plan);expect((await overlay(page)).visible).toBe(true);expect(await page.locator('[data-comparison="c3"]').getAttribute('data-current-value')).toBeNull();await hit(page,'[data-transfer-action="restore-previous-plan"]');await page.screenshot({path:join(out,'ko-normal-1280-infeasible.png')});
     |                                                                                                                                                                                        ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
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
  46 |  await page.locator('.transfer-save-tools summary').click();const download=page.waitForEvent('download');await action(page,'export').click();const file=await download,path=await file.path();expect(await file.failure()).toBeNull();const text=readFileSync(path!,'utf8');await page.locator('.transfer-import').setInputFiles({name:'actual-nav05-draft.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(id=>(window as any).__game.transfer().getState().comparison.requestId>id,comparison.requestId,{timeout:60000,polling:250});await ready(page);expect(accepted(await state(page))).toEqual(before);expect((await state(page)).comparison.previousPlan).toBeNull();expect((await overlay(page)).paths).toHaveLength(0);
  47 |  await dragDate(page,1);expect((await overlay(page)).visible).toBe(true);const launchedPlan=(await state(page)).plan;await action(page,'launch').click();await page.waitForFunction(()=>!!(window as any).__game.transfer().runtime,null,{polling:250});await ready(page);expect((await state(page)).plan).toEqual(launchedPlan);expect((await state(page)).comparison.status).toBe('empty');expect((await overlay(page)).paths).toHaveLength(0);await action(page,'exit').click();await expect(page.locator('#transfer-experience')).toHaveCount(0);
  48 |  writeFileSync(join(out,'native-lifecycle.json'),JSON.stringify({before,comparison,prior,launchedPlan,scope:'Actual renderer resources, genuine native context recovery, exported/imported worker-validated plan and real launch. No runtime injection.'},null,2));
  49 | });
  50 | 
```