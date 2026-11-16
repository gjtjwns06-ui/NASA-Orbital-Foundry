# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transfer-date-recovery.spec.ts >> ko: the reported 80-day arrival has an explicit date repair, not a retry loop
- Location: tests\browser\transfer-date-recovery.spec.ts:11:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.transfer-error')
Expected substring: "2027-03-15"
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" locator('.transfer-error') with timeout 15000ms
  - waiting for locator('.transfer-error')

```

```yaml
- text: SUN 현재 경로를 계산하지 못했습니다 · 점선은 이전 계획 · 이전 계획으로 돌아갈 수 있습니다.
- banner:
  - button "ORBITAL MISSION FOUNDRY"
  - text: M03 · 지구에서 화성까지
  - button "태양계"
  - button "지구 탈출"
  - button "화성 조우"
  - button "탐사선" [disabled]
- complementary:
  - text: FLIGHT WINDOW
  - heading "두 행성을 잇는 궤적" [level=2]
  - paragraph: 지구와 화성 날짜 손잡이를 궤도 위로 끌어 보세요. 달라진 만남에 필요한 추진제와 전력을 다시 계산합니다.
  - text: 지구 출발 · TDB
  - textbox "지구 출발 · TDB": 2026-11-15
  - text: 화성 최근접 · TDB
  - textbox "화성 최근접 · TDB": 2027-02-03
  - text: 행성 간 비행
  - strong: 260 d
  - text: 화성 최근접 고도 1,000 km
  - slider "화성 최근접 고도 1,000 km": "1000"
  - text: 조우 평면 각도 0°
  - slider "조우 평면 각도 0°": "0"
  - button "장비 배치 수정"
  - group: 예시 계획 불러오기
  - group: 저장과 백업
  - group: 과학 모델과 출처
- complementary:
  - text: DEPARTURE REVIEW
  - heading "출발 준비" [level=2]
  - text: 탈출 추진 단계
  - combobox "탈출 추진 단계":
    - option "패스파인더 탈출 단계 · 95 C" [selected]
    - option "익스플로러 탈출 단계 · 140 C"
    - option "헤비 탈출 단계 · 210 C"
  - text: 탈출 기동
  - strong: 3,687 m/s
  - text: C3
  - strong: 10.88 km²/s²
  - text: 단계 추진제 여유
  - strong: 18.6 kg
  - text: 총 예산
  - strong: 499 / 680 C
  - text: SCIENCE RETURN FORECAST 3/ 3
  - paragraph: 과학 목표를 충족하는 계획입니다.
  - button "지구 탈출 기동 실행"
  - paragraph: 추진 단계와 가격은 게임 설정입니다. 궤도는 JPL 천체력과 구간별 중력 모델을 사용합니다.
- text: 날짜 손잡이 드래그 · 오른쪽 드래그로 회전 · 휠로 확대 행성·탐사선 크기 확대 표시 · 거리와 시간은 계산값
- strong: 화성 조우 일정
- button "접근 6시간"
- button "수신 48시간"
- text: 블록을 끌어 이동 · 오른쪽 끝으로 길이 조절 분광 관측 지구 송신 -3h -1.5h 0h 1.5h 3h 0h = 화성 최근접 · 빈 구간은 태양 지향 충전 · 날짜 변경 시 조우 기준 일정 유지
```

# Test source

```ts
  1  | import {test, expect} from '@playwright/test';
  2  | import {mkdirSync, writeFileSync} from 'node:fs';
  3  | import {join} from 'node:path';
  4  | 
  5  | const artifacts = join(process.cwd(), 'tests/browser/artifacts/transfer-date-recovery');
  6  | mkdirSync(artifacts, {recursive: true});
  7  | test.setTimeout(90000);
  8  | test.use({viewport: {width: 1440, height: 900}});
  9  | 
  10 | for (const language of ['ko', 'en'] as const) {
  11 |   test(`${language}: the reported 80-day arrival has an explicit date repair, not a retry loop`, async ({page}) => {
  12 |     const errors: string[] = [];
  13 |     page.on('pageerror', error => errors.push(error.message));
  14 |     await page.addInitScript(language => localStorage.setItem('orbital-language', language), language);
  15 |     await page.goto('/?qa');
  16 |     await page.waitForFunction(() => Boolean((window as any).__game?.getState().assetsReady));
  17 |     await page.locator('[data-action="missions"]').first().click();
  18 |     await page.locator('[data-action="mission-transfer"]').click();
  19 |     await page.locator('[data-action="plan"]').last().click();
  20 |     await page.waitForFunction(() => {const state = (window as any).__game.transfer()?.getState(); return state && !state.pending;}, null, {timeout: 45000});
  21 |     const original = await page.evaluate(() => (window as any).__game.transfer().getState());
  22 |     expect(original.error).toBe('');
  23 |     const arrival = page.locator('[data-transfer-date="arrival"]');
  24 |     await expect(arrival).toHaveAttribute('min', '2027-03-15');
  25 |     await expect(arrival).toHaveAttribute('max', '2028-02-08');
  26 |     await arrival.fill('2027-02-03');
  27 |     await arrival.press('Tab');
> 28 |     await expect(page.locator('.transfer-error')).toContainText('2027-03-15');
     |                                                   ^ Error: expect(locator).toContainText(expected) failed
  29 |     await expect(page.locator('.transfer-error')).not.toContainText('2461479.5');
  30 |     await expect(page.locator('[data-transfer-action="recalculate"]')).toHaveCount(0);
  31 |     await expect(page.locator('[data-transfer-date="arrival"]')).toHaveAttribute('aria-invalid', 'true');
  32 |     await expect(page.locator('[data-transfer-action="repair-dates"]')).toContainText('2027-03-15');
  33 |     const invalid = await page.evaluate(() => (window as any).__game.transfer().getState());
  34 |     expect(invalid.pending).toBe(false);
  35 |     expect(invalid.solution).toBeNull();
  36 |     expect(invalid.craft).toEqual(original.craft);
  37 |     await page.screenshot({path: join(artifacts, `${language}-invalid-date.png`)});
  38 |     await page.locator('[data-transfer-action="repair-dates"]').click();
  39 |     await expect(page.locator('[data-transfer-date="arrival"]')).toHaveValue('2027-03-15');
  40 |     await page.waitForFunction(() => !(window as any).__game.transfer().getState().pending, null, {timeout: 45000});
  41 |     const repaired = await page.evaluate(() => (window as any).__game.transfer().getState());
  42 |     expect(repaired.error).toBe('');
  43 |     expect(repaired.solution).toBeTruthy();
  44 |     expect(repaired.craft).toEqual(original.craft);
  45 |     expect(repaired.plan.arrivalPeriapsisJdTdb - repaired.plan.departurePeriapsisJdTdb).toBe(120);
  46 |     const originalPeri = (original.plan.arrivalPeriapsisJdTdb - original.plan.departurePeriapsisJdTdb) * 86400;
  47 |     const repairedPeri = 120 * 86400;
  48 |     expect(repaired.plan.operations.map((op: any) => ({...op, start: op.start - repairedPeri, end: op.end - repairedPeri})))
  49 |       .toEqual(original.plan.operations.map((op: any) => ({...op, start: op.start - originalPeri, end: op.end - originalPeri})));
  50 |     // Shortest supported time is not automatically launchable: don't relabel fuel feasibility.
  51 |     expect(repaired.evaluation.launchable).toBe(false);
  52 |     expect(repaired.evaluation.warnings.some((warning: any) => warning.code === 'STAGE_FUEL')).toBe(true);
  53 |     await expect(page.locator('[data-transfer-action="launch"]')).toBeDisabled();
  54 |     await page.screenshot({path: join(artifacts, `${language}-date-repaired.png`)});
  55 |     await page.locator('[data-transfer-action="restore-previous-plan"]').first().click();
  56 |     await page.waitForFunction(() => !(window as any).__game.transfer().getState().pending, null, {timeout: 45000});
  57 |     const restored = await page.evaluate(() => (window as any).__game.transfer().getState());
  58 |     expect(restored.plan).toEqual(original.plan);
  59 |     expect(restored.craft).toEqual(original.craft);
  60 |     expect(restored.evaluation.launchable).toBe(true);
  61 |     expect(errors).toEqual([]);
  62 |     writeFileSync(join(artifacts, `${language}-result.json`), JSON.stringify({language, errors, browser: page.context().browser()?.version(), repairedFlightDays: 120, originalPlanRestored: true, actualFuelRestrictionPreserved: true}, null, 2));
  63 |   });
  64 | }
  65 | 
```