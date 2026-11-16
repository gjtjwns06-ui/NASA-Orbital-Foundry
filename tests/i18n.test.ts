import {afterEach, describe, expect, it} from 'vitest';
import {getLanguage, setLanguage, t} from '../src/i18n';
import {MISSIONS, PARTS} from '../src/sim/catalog';

afterEach(() => setLanguage('ko'));

describe('offline English display translations', () => {
  it('preserves the Korean default and can switch repeatedly', () => {
    expect(getLanguage()).toBe('ko');
    expect(t('비행 경로 설계')).toBe('비행 경로 설계');
    for (let i=0;i<3;i++) {
      setLanguage('en');
      expect(t('비행 경로 설계')).toBe('Plan trajectory');
      setLanguage('ko');
      expect(t('비행 경로 설계')).toBe('비행 경로 설계');
    }
  });

  it('translates every displayed hardware name and description without changing catalog data', () => {
    const before = JSON.stringify(PARTS);
    setLanguage('en');
    for (const part of Object.values(PARTS)) {
      expect(t(part.name)).toBe(part.nameEn);
      expect(t(part.description)).not.toMatch(/[가-힣]/);
      for (const condition of part.conditions ?? []) expect(t(condition)).not.toMatch(/[가-힣]/);
      expect(t(`${part.name} 드래그하여 장착`)).toContain('drag to attach');
    }
    expect(JSON.stringify(PARTS)).toBe(before);
  });

  it('provides English mission goals, constraints and briefings', () => {
    setLanguage('en');
    for (const mission of Object.values(MISSIONS)) {
      for (const text of [mission.title,mission.description,mission.target,...mission.constraints,...mission.briefing]) {
        expect(t(text),text).not.toMatch(/[가-힣]/);
      }
    }
  });

  it('retains numerical telemetry, units, spacecraft IDs and timing in dynamic messages', () => {
    setLanguage('en');
    expect(t('태양 지향 · 충전 · 600× 가속')).toBe('Sun pointing · Charge · 600× speed');
    expect(t('지상 명령 실행 중 · 595 s 남음')).toBe('Ground command active · 595 s remaining');
    expect(t('cmd-7 송신 · 편도 지연 738.4 s')).toBe('cmd-7 sent · One-way delay 738.4 s');
    expect(t('M2 · 궤도 보정 46.2 m/s · 추진제 1.07 kg')).toBe('M2 · Maneuver 46.2 m/s · Propellant 1.07 kg');
    expect(t('지구 수신 완료 · 과학 자료 3/4')).toBe('Received on Earth · Science 3/4');
    expect(t('이전 시도 대비 +12점')).toBe('+12 points versus the previous attempt');
  });

  it('explains placement failures and safe mode with actionable English', () => {
    setLanguage('en');
    expect(t('광학 카메라의 전개 형상과 간섭합니다.')).toBe('Intersects the deployed geometry of Optical camera.');
    expect(t('광학 카메라가 없어 과학 자료를 만들 수 없습니다.')).toContain('science data cannot be collected');
    expect(t('배터리 임계치: 과학 관측과 송신을 중단하고 태양을 향합니다.')).toContain('stopping science and downlink');
    expect(t('→ 관측 뒤 더 긴 송신 구간을 확보하고 지상국 교신창을 확인하세요.')).toBe('→ Allow longer downlinks after observation and check ground-station contact windows.');
    expect(t('장착판의 경계를 벗어났습니다. 내부 모듈은 상단 서비스 베이에 넣으세요.')).toBe('Outside the mounting surface boundary. Place internal modules in the upper service bay.');
  });

  it('translates accessibility titles and save validation errors', () => {
    setLanguage('en');
    expect(t('observe 00:30:00–00:45:00 · 우클릭으로 제거')).toBe('Observe 00:30:00–00:45:00 · Right-click to remove');
    expect(t('저장 파일 오류: 궤도 고도 범위를 확인하세요.')).toBe('Save file error: Check the range of Orbital altitude.');
    expect(t('저장 파일 오류: 명령 status가 재현 결과와 다릅니다.')).toBe('Save file error: Command status differs from replay.');
    expect(t('이 부품은 최대 3개까지 장착할 수 있습니다.')).toBe('You can install up to 3 of this component.');
  });

  it('keeps debris training thresholds separate from collision probability', () => {
    setLanguage('en');
    expect(t('교육용 추적 잔해 · 예상 최근접 T+4200.0 s, 최소 거리 1.253 km. 기준 2 km이며 충돌확률 수치가 아닙니다.')).toBe('Training debris · Predicted closest approach T+4200.0 s, minimum separation 1.253 km. The 2 km target is not a collision probability.');
    expect(t('잔해 근접 통과 · 최소 거리 1.253 km · 2 km 훈련 분리 기준 미달, 자동 충돌 아님')).toContain('does not automatically imply a collision');
    expect(t('실제 엔진 추력선과 질량중심 간 거리 0.243 m가 버스의 0.18 m 허용값을 초과합니다.')).toBe('Thrust-line offset from the center of mass is 0.243 m, exceeding the bus limit of 0.18 m.');
    expect(t('최소 거리 0.50 km / 목표 2 km')).toBe('Minimum separation 0.50 km / target 2 km');
  });

  it('explains workshop power and visibility assumptions in English', () => {
    setLanguage('en');
    const power=t('1.524 AU · 일식 없음 · 입사각과 5개 광선의 가림을 반영한 발전량. 태양 손잡이를 움직여 빛의 방향을 바꿉니다.');
    expect(power).toContain('1.524 AU');expect(power).toContain('five-ray obstruction');expect(power).not.toMatch(/[가-힣]/);
    const visibility=t('지구 기준 +Z · 반각 12° · 1/2개 장비에서 기준 방향이 보입니다. 최고 개구 가시율이며 거리·임무 품질·행성 가림은 별도입니다.');
    expect(visibility).toContain('Half-angle 12°');expect(visibility).toContain('1/2 instruments');expect(visibility).toContain('planetary obstruction are separate');
  });

  it('explains launch-package limits without altering part IDs or units', () => {
    setLanguage('en');
    expect(t('공유 궤도 투입의 초기 투입 고도는 500~700 km입니다.')).toBe('Rideshare injection supports initial altitude 500–700 km.');
    expect(t('선택한 발사 조건의 질량 한도 85 kg를 초과했습니다.')).toBe('Selected launch wet-mass limit of 85 kg exceeded.');
    expect(t('접은 기체가 페어링 반경을 0.143 m 초과합니다. 장비 위치 또는 발사 패키지를 바꾸세요.')).toContain('fairing radius by 0.143 m');
    expect(t('수납 상태에서 solar-1와 antenna-2가 간섭합니다.')).toBe('solar-1 and antenna-2 interfere in the stowed configuration.');
  });

  it('preserves surrounding whitespace, unknown proper names, numeric values, and original strings', () => {
    setLanguage('en');
    expect(t(' \u00a0회전 \u00a0 ')).toBe(' \u00a0Rotate \u00a0 ');
    expect(t('ORBITAL / AURORA-01')).toBe('ORBITAL / AURORA-01');
    expect(t('우리 탐사선 은하-01')).toBe('우리 탐사선 은하-01');
    expect(t('86.0 / 200 Wh')).toBe('86.0 / 200 Wh');
    expect(t('   ')).toBe('   ');
  });
});
