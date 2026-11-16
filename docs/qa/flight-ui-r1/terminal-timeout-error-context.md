# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: deployment-flight-ui.spec.ts >> actual terminal replay displays compact truthful objective beside baseline
- Location: tests\browser\deployment-flight-ui.spec.ts:66:1

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: page.waitForFunction: Test timeout of 180000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - generic "3D commissioning craft. Drag a part to its mounting plane; right-drag to orbit, scroll to zoom, F to focus." [ref=f1e5]
  - banner [ref=f1e6]:
    - generic [ref=f1e7]:
      - text: ORBITAL FOUNDRY / FIRST LIGHT
      - heading "접힌 우주선에 첫 빛을" [level=1] [ref=f1e8]
    - navigation [ref=f1e9]:
      - button "저장" [disabled] [ref=f1e10]
      - button "JSON ↓" [disabled] [ref=f1e11]
      - button "JSON ↑" [disabled] [ref=f1e12]
      - button "임무 선택" [ref=f1e13] [cursor=pointer]
  - complementary [ref=f1e14]:
    - text: 3D 전개 작업장
    - heading "직접 만드는 첫 빛" [level=2] [ref=f1e15]
    - paragraph [ref=f1e16]: 발전 90 W · 안정된 자세 60초 → 지구 수신 16 Mbit. 기한 3시간.
    - button "다른 설계 · 전력 회복 연습" [disabled] [ref=f1e17]
    - paragraph [ref=f1e18]: 부품을 드래그해 배치합니다. 부품을 선택하면 경첩 호로 전개 형상을 검사할 수 있습니다.
    - generic [ref=f1e20]:
      - button "01 배터리 bpx100-4s2p-v2 · py" [ref=f1e21] [cursor=pointer]:
        - generic [ref=f1e22]: "01"
        - generic [ref=f1e23]:
          - strong [ref=f1e24]: 배터리
          - generic [ref=f1e25]: bpx100-4s2p-v2 · py
      - button "02 무전기 iris22-carrier-v1 · py" [ref=f1e26] [cursor=pointer]:
        - generic [ref=f1e27]: "02"
        - generic [ref=f1e28]:
          - strong [ref=f1e29]: 무전기
          - generic [ref=f1e30]: iris22-carrier-v1 · py
      - button "03 자세제어 xact50-carrier-v1 · py" [ref=f1e31] [cursor=pointer]:
        - generic [ref=f1e32]: "03"
        - generic [ref=f1e33]:
          - strong [ref=f1e34]: 자세제어
          - generic [ref=f1e35]: xact50-carrier-v1 · py
      - button "04 기록장치 recorder-1p6-v2 · py" [ref=f1e36] [cursor=pointer]:
        - generic [ref=f1e37]: "04"
        - generic [ref=f1e38]:
          - strong [ref=f1e39]: 기록장치
          - generic [ref=f1e40]: recorder-1p6-v2 · py
      - button "05 전개 제어기 mechanism-controller-v1 · py" [ref=f1e41] [cursor=pointer]:
        - generic [ref=f1e42]: "05"
        - generic [ref=f1e43]:
          - strong [ref=f1e44]: 전개 제어기
          - generic [ref=f1e45]: mechanism-controller-v1 · py
      - button "06 접이식 태양판 hinged-pv135-v1 · pz" [ref=f1e46] [cursor=pointer]:
        - generic [ref=f1e47]: "06"
        - generic [ref=f1e48]:
          - strong [ref=f1e49]: 접이식 태양판
          - generic [ref=f1e50]: hinged-pv135-v1 · pz
      - button "07 전개식 안테나 folded-x-array-v1 · px" [ref=f1e51] [cursor=pointer]:
        - generic [ref=f1e52]: "07"
        - generic [ref=f1e53]:
          - strong [ref=f1e54]: 전개식 안테나
          - generic [ref=f1e55]: folded-x-array-v1 · px
      - button "08 회복용 태양판 body-pv15-v1 · pz" [ref=f1e56] [cursor=pointer]:
        - generic [ref=f1e57]: "08"
        - generic [ref=f1e58]:
          - strong [ref=f1e59]: 회복용 태양판
          - generic [ref=f1e60]: body-pv15-v1 · pz
      - button "09 케이블 지지대 passive-cable-guide-v1 · pz" [ref=f1e61] [cursor=pointer]:
        - generic [ref=f1e62]: "09"
        - generic [ref=f1e63]:
          - strong [ref=f1e64]: 케이블 지지대
          - generic [ref=f1e65]: passive-cable-guide-v1 · pz
    - generic [ref=f1e66]:
      - button "선택 부품 초점" [ref=f1e67] [cursor=pointer]
      - button "기체 전체" [ref=f1e68] [cursor=pointer]
  - complementary [ref=f1e69]:
    - text: 설계와 실행 창
    - heading "선택의 결과를 확인하세요" [level=2] [ref=f1e70]
    - generic [ref=f1e71]:
      - strong [ref=f1e72]: 먼저 이 부분을 고쳐보세요
      - paragraph [ref=f1e73]: 펼치는 경로에 다른 부품이 있습니다. · 케이블 지지대
      - button "케이블 지지대 가까이 보기" [disabled] [ref=f1e74]
    - button "궤도에서 가동 시작" [disabled] [ref=f1e75]
    - button "전개 순서의 간섭 검사" [disabled] [ref=f1e76]
    - generic [ref=f1e77]:
      - button "되돌리기" [disabled] [ref=f1e78]
      - button "다시 실행" [disabled] [ref=f1e79]
    - generic [ref=f1e80]:
      - text: 저장된 비행 재생 · 91%
      - progressbar [ref=f1e81]
      - button "취소" [ref=f1e82] [cursor=pointer]
    - generic [ref=f1e83]:
      - generic [ref=f1e84]: 질량 / 예산
      - generic [ref=f1e85]: 49.81 kg · 377 /560
    - generic [ref=f1e86]:
      - generic [ref=f1e87]: 배터리
      - generic [ref=f1e88]: 30.1 / 86 Wh
    - generic [ref=f1e89]:
      - generic [ref=f1e90]: 발전 / 소비
      - generic [ref=f1e91]: 15 / 30.21 W
    - generic [ref=f1e92]:
      - generic [ref=f1e93]: 모터 입력 / 누적 에너지
      - generic [ref=f1e94]: 0 W / 0 J
    - generic [ref=f1e95]:
      - generic [ref=f1e96]: 지향 오차 / 회전 속도
      - generic [ref=f1e97]: 0° / 0°/s
    - generic [ref=f1e98]:
      - generic [ref=f1e99]: 안정된 발전 조건
      - generic [ref=f1e100]: 0 /60 s
    - generic [ref=f1e101]:
      - generic [ref=f1e102]: 지구 수신 보고서
      - generic [ref=f1e103]: 0 /16 Mbit
    - generic [ref=f1e104]:
      - generic [ref=f1e105]: 조명 / 교신
      - generic [ref=f1e106]: 태양광 · 대기
    - generic [ref=f1e107]:
      - generic [ref=f1e108]: 접이식 태양판
      - generic [ref=f1e109]: 수납 잠금
    - generic [ref=f1e110]:
      - generic [ref=f1e111]: 전개식 안테나
      - generic [ref=f1e112]: 수납 잠금
    - generic [ref=f1e113]:
      - generic [ref=f1e114]: 접힌 폭 / 높이
      - generic [ref=f1e115]: 2.26 / 1.58 m
    - generic [ref=f1e116]:
      - heading "접이식 태양판 · 모터 속도" [level=3] [ref=f1e117]
      - combobox "접이식 태양판 · 모터 속도" [disabled] [ref=f1e118] [cursor=pointer]:
        - option "완만하게 · 1°/s"
        - option "보통 · 4°/s" [selected]
    - generic [ref=f1e119]:
      - heading "전개식 안테나 · 모터 속도" [level=3] [ref=f1e120]
      - combobox "전개식 안테나 · 모터 속도" [disabled] [ref=f1e121] [cursor=pointer]:
        - option "완만하게 · 1°/s"
        - option "보통 · 4°/s" [selected]
    - button "전체 비행 예측" [disabled] [ref=f1e122]
    - group [ref=f1e123]:
      - generic "모델과 단순화" [ref=f1e124] [cursor=pointer]
  - generic:
    - button "일정 접기" [ref=f1e126] [cursor=pointer]
    - paragraph: "부품을 직접 드래그 · 경첩 호: 1° 미리보기 · Esc 취소"
  - generic [ref=f1e127]:
    - generic [ref=f1e128]:
      - strong [ref=f1e129]: 기체에 실을 실행 일정
      - generic [ref=f1e130]:
        - button "←" [disabled] [ref=f1e131]
        - button "30 분 보기" [ref=f1e132] [cursor=pointer]
        - button "→" [ref=f1e133] [cursor=pointer]
        - button "현재 시각" [ref=f1e134] [cursor=pointer]
    - generic [ref=f1e135]:
      - group "태양판 · 전개 · 20s → 600s" [ref=f1e136]:
        - generic: 태양판 · 전개
      - group "안테나 · 전개 · 200s → 800s" [ref=f1e137]:
        - generic: 안테나 · 전개
      - group "충전 · 0s → 600s" [ref=f1e138]:
        - generic: 충전
      - group "송신 · station-a · 600s → 1800s" [ref=f1e139]:
        - generic: 송신 · station-a
      - generic "T+0.00s"
    - generic [ref=f1e140]:
      - generic [ref=f1e141]: 0m
      - generic [ref=f1e142]: 5m
      - generic [ref=f1e143]: 10m
      - generic [ref=f1e144]: 15m
      - generic [ref=f1e145]: 20m
      - generic [ref=f1e146]: 25m
      - generic [ref=f1e147]: 30m
    - paragraph [ref=f1e148]: 탑재 일정 실행 중 · 위쪽 줄은 시작 가능 시각부터 마감까지의 창입니다.
```

# Test source

```ts
  1  | import {test as base,expect,type Page} from '@playwright/test';
  2  | import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
  3  | import {join} from 'node:path';
  4  | import {installNativeDeletionAudit} from './native-gl-audit';
  5  | 
  6  | const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'flight-ui-unfrozen';
  7  | if(!/^[a-z0-9-]+$/.test(candidate))throw Error('Invalid candidate');
  8  | const out=join(process.cwd(),'tests/browser/artifacts/deployment-flight-ui',candidate);mkdirSync(out,{recursive:true});
  9  | const terminalText=readFileSync('tests/browser/artifacts/deployment-flow/m8-production-r1-closure/repaired-terminal-save.json','utf8');
  10 | const test=base.extend<{audit:void}>({audit:[async({page},use,info)=>{
  11 |  const errors:string[]=[],warnings:string[]=[];await installNativeDeletionAudit(page);
  12 |  page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  13 |  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  14 |  await use();const native=await page.evaluate(()=>(window as any).__allContextDeletionAudit).catch(()=>null);
  15 |  const name=info.title.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
  16 |  writeFileSync(join(out,name+'.json'),JSON.stringify({title:info.title,status:info.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),errors,warnings,native,scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[])},null,2));
  17 |  if(info.status!==info.expectedStatus)await page.screenshot({path:join(out,name+'-failure.png')}).catch(()=>{});
  18 |  expect(errors).toEqual([]);expect(native?.errors??[]).toEqual([]);expect(native?.contexts?.length).toBeGreaterThan(0);expect(warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors/.test(w))).toEqual([]);
  19 | },{auto:true}]});
  20 | test.setTimeout(180000);test.use({actionTimeout:15000});
  21 | const state=(p:Page)=>p.evaluate(()=>(window as any).__game.deployment().getState());
  22 | const physical=(s:any)=>({craft:s.craft,plan:s.plan,numerics:s.numerics,runtime:s.runtime,telemetry:s.telemetry,result:s.result});
  23 | const control=(p:Page,a:string)=>p.locator(`[data-deployment-action="${a}"]`).first();
  24 | const ready=(p:Page)=>p.waitForFunction(()=>{const s=(window as any).__game.deployment()?.getState();return s&&!s.pending&&!s.busy&&!s.restoring&&!s.saving&&!s.closing;},null,{timeout:180000});
  25 | const camera=(p:Page)=>p.evaluate(()=>(window as any).__game.deployment().scene.qa.getCamera());
  26 | async function settledCamera(p:Page){let last='',count=0;for(let i=0;i<60;i++){const current=await camera(p),text=JSON.stringify(current);count=text===last?count+1:0;if(count>=3)return current;last=text;await p.waitForTimeout(50);}throw Error('Actual camera damping did not converge');}
  27 | async function hit(p:Page,selector:string){const result=await p.locator(selector).evaluate(el=>{const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,hit:el===h||el.contains(h),vw:innerWidth,vh:innerHeight};});expect(result.x).toBeGreaterThanOrEqual(0);expect(result.y).toBeGreaterThanOrEqual(0);expect(result.right).toBeLessThanOrEqual(result.vw);expect(result.bottom).toBeLessThanOrEqual(result.vh);expect(result.hit).toBe(true);return result;}
  28 | async function boot(p:Page,language:'ko'|'en'='ko',scale:'normal'|'large'='normal',url='/?qa'){
  29 |  await p.goto(url);await p.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
  30 |  if(language==='en')await p.locator('[data-action="language"]').click();
  31 |  await p.locator('[data-action="settings"]').click();await p.locator('#ui-scale').selectOption(scale);await p.locator('#motion').selectOption('reduced');await p.locator('[data-action="close-modal"]').click();
  32 |  await p.locator('[data-action="missions"]').click();await p.locator('[data-action="mission-deployment"]').click();await ready(p);
  33 | }
  34 | async function shortFlight(p:Page){await control(p,'variants').click();await control(p,'preset:compact').click();await ready(p);await control(p,'launch').click();await p.waitForFunction(()=>(window as any).__game.deployment().getState().runtime?.time>=3);await control(p,'play').click();await ready(p);expect((await state(p)).playing).toBe(false);await settledCamera(p);}
> 35 | async function restoreTerminal(p:Page){const choose=p.waitForEvent('filechooser');await control(p,'import').click();await(await choose).setFiles({name:'actual-v8-terminal.json',mimeType:'application/json',buffer:Buffer.from(terminalText)});await p.waitForFunction(()=>(window as any).__game.deployment().getState().result?.success===true,null,{timeout:180000});await ready(p);expect((await state(p)).error).toBe('');}
     |                                                                                                                                                                                                                                                         ^ Error: page.waitForFunction: Test timeout of 180000ms exceeded.
  36 | async function factsMatch(p:Page){const s=await state(p);const values=await p.locator('.deployment-objective-row meter').evaluateAll(es=>es.map(e=>({id:e.parentElement?.dataset.objective,value:(e as HTMLMeterElement).value,text:e.getAttribute('aria-valuetext')})));expect(values.find(v=>v.id==='power')?.value).toBeCloseTo(Math.min(90,Math.max(0,s.telemetry.solarPowerW)),10);expect(values.find(v=>v.id==='stable')?.value).toBeCloseTo(Math.min(60,s.runtime.solarGoodSeconds),10);expect(values.find(v=>v.id==='received')?.value).toBeCloseTo(Math.min(16e6,s.runtime.diagnosticReceivedBits),10);return values;}
  37 | 
  38 | for(const size of [{width:1280,height:720},{width:1920,height:1080}])for(const scale of ['normal','large'] as const)for(const language of ['ko','en'] as const)test(`flight drawer ${language} ${scale} ${size.width}`,async({page})=>{
  39 |  await page.setViewportSize(size);await boot(page,language,scale);await shortFlight(page);await expect(control(page,'equipment')).toHaveAttribute('aria-expanded','false');
  40 |  const baseline=physical(await state(page)),view=await settledCamera(page),closedBounds=await hit(page,'.deployment-left'),readings=await factsMatch(page);
  41 |  await expect(page.locator('#deployment-equipment-drawer')).toBeHidden();expect(await page.locator('#deployment-equipment-drawer button').evaluateAll(es=>es.every(e=>(e as HTMLElement).getClientRects().length===0))).toBe(true);
  42 |  await hit(page,'[data-deployment-action="equipment"]');await page.screenshot({path:join(out,`${language}-${scale}-${size.width}-closed.png`)});
  43 |  await control(page,'equipment').click();await expect(control(page,'equipment')).toHaveAttribute('aria-expanded','true');await expect(control(page,'equipment')).toBeFocused();await expect(page.locator('#deployment-equipment-drawer')).toBeVisible();
  44 |  await hit(page,'[data-deployment-action="equipment-close"]');const openedBounds=await hit(page,'.deployment-left');expect(openedBounds.x+openedBounds.width).toBe(closedBounds.x+closedBounds.width);expect(await settledCamera(page)).toEqual(view);expect(physical(await state(page))).toEqual(baseline);
  45 |  await page.screenshot({path:join(out,`${language}-${scale}-${size.width}-open.png`)});await page.keyboard.press('Escape');await expect(control(page,'equipment')).toHaveAttribute('aria-expanded','false');await expect(control(page,'equipment')).toBeFocused();expect(await settledCamera(page)).toEqual(view);
  46 |  await page.keyboard.press('Space');await expect(control(page,'equipment')).toHaveAttribute('aria-expanded','true');expect((await state(page)).playing).toBe(false);await control(page,'equipment-close').click();await expect(control(page,'equipment')).toBeFocused();expect(physical(await state(page))).toEqual(baseline);
  47 |  writeFileSync(join(out,`${language}-${scale}-${size.width}-observations.json`),JSON.stringify({closedBounds,openedBounds,view,readings,physical:baseline},null,2));
  48 | });
  49 | 
  50 | test('actual mesh selection details focus flight lock and repaint recovery',async({page})=>{
  51 |  await page.setViewportSize({width:1280,height:720});await boot(page);await shortFlight(page);await control(page,'step').click();await ready(page);await control(page,'working-faces').click();await settledCamera(page);
  52 |  const target=await page.evaluate(()=>{const s=(window as any).__game.deployment().scene;for(const id of ['wing','antenna','recovery','battery','radio','adcs']){const p=s.qa.getPartScreen(id);if(!p?.visible)continue;for(const dx of [0,-8,8,-18,18])for(const dy of [0,-8,8,-18,18]){const x=p.x+dx,y=p.y+dy;if(document.elementFromPoint(x,y)!==s.qa.canvas)continue;const picked=s.pick(x,y);if(picked)return {x,y,id:picked};}}return null;});expect(target).not.toBeNull();
  53 |  const before=physical(await state(page)),beforeView=await settledCamera(page);await page.mouse.click(target!.x,target!.y);await expect(page.locator('.deployment-selected-part')).toHaveAttribute('data-selected-part',target!.id);await expect(control(page,'equipment')).toHaveAttribute('aria-expanded','false');expect(await settledCamera(page)).toEqual(beforeView);expect(physical(await state(page))).toEqual(before);
  54 |  await hit(page,'[data-deployment-action="equipment-details"]');await control(page,'equipment-details').click();await expect(control(page,'equipment-close')).toBeFocused();await expect(page.locator('.deployment-selected-part')).toHaveAttribute('data-selected-part',target!.id);await page.keyboard.press('Escape');await expect(control(page,'equipment-details')).toBeFocused();expect(await settledCamera(page)).toEqual(beforeView);
  55 |  await control(page,'focus').click();const focused=await settledCamera(page);expect(focused).not.toEqual(beforeView);expect(physical(await state(page))).toEqual(before);await page.screenshot({path:join(out,'actual-selected-part-focused.png')});
  56 |  // Placement remains locked: a real left drag may select, but cannot edit craft or plan.
  57 |  const p=await page.evaluate(id=>(window as any).__game.deployment().scene.qa.getPartScreen(id),target!.id);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+30,p.y+18,{steps:12});await page.mouse.up();expect(physical(await state(page))).toEqual(before);expect((await state(page)).scene.workshopEditable).toBe(false);
  58 |  await control(page,'equipment').click();await expect(control(page,'equipment')).toBeFocused();await control(page,'play').click();await page.keyboard.press('Tab');
  59 |  // Repeated live telemetry paints retain the actual disclosure focus.
  60 |  await control(page,'equipment').click();await expect(control(page,'equipment')).toBeFocused();const liveStart=(await state(page)).runtime.time;await page.waitForFunction(t=>(window as any).__game.deployment().getState().runtime.time>=t+5,liveStart);await expect(control(page,'equipment')).toBeFocused();await control(page,'play').click();await ready(page);
  61 |  await control(page,'equipment').click();await expect(control(page,'equipment')).toBeFocused();const paused=physical(await state(page));
  62 |  await page.evaluate(()=>{const c=(window as any).__game.deployment().scene.qa.canvas,gl=c.getContext('webgl2'),x=gl.getExtension('WEBGL_lose_context');x.loseContext();setTimeout(()=>x.restoreContext(),100);});await page.waitForFunction(()=>!(window as any).__game.deployment().scene.getState().contextLost);await page.waitForFunction(()=>(window as any).__allContextDeletionAudit.contextLostNotifications>0);await ready(page);await expect(control(page,'equipment')).toBeFocused();expect(physical(await state(page))).toEqual(paused);
  63 |  writeFileSync(join(out,'mesh-focus-and-flight-lock.json'),JSON.stringify({target,before,beforeView,focused,paused,final:physical(await state(page))},null,2));
  64 | });
  65 | 
  66 | test('actual terminal replay displays compact truthful objective beside baseline',async({page})=>{
  67 |  await page.setViewportSize({width:1280,height:720});await boot(page,'ko','normal','http://127.0.0.1:5188/?qa');await restoreTerminal(page);await control(page,'working-faces').click();await settledCamera(page);const original=physical(await state(page));await page.screenshot({path:join(out,'terminal-baseline-v8.png')});
  68 |  await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-deployment"]').click();await ready(page);await restoreTerminal(page);expect(physical(await state(page))).toEqual(original);await control(page,'working-faces').click();await settledCamera(page);await expect(page.locator('[data-flight-status="complete"]')).toContainText('지구 수신 완료');await factsMatch(page);await page.screenshot({path:join(out,'terminal-compact-ui.png')});
  69 |  await control(page,'equipment').click();await expect(control(page,'equipment')).toHaveAttribute('aria-expanded','true');await control(page,'part:wing').click();await settledCamera(page);await control(page,'equipment-close').click();await expect(control(page,'equipment')).toBeFocused();await page.screenshot({path:join(out,'terminal-selected-wing.png')});expect(physical(await state(page))).toEqual(original);
  70 |  writeFileSync(join(out,'terminal-before-after-physical.json'),JSON.stringify({before:original,after:physical(await state(page))},null,2));
  71 | });
  72 | 
```