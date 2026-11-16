# 지구 출발–화성 조우: 다음 모델 통합 제안

상태: **연구 프로토타입 검증 완료, 현재 게임에는 미통합**. 현재 M02는 계속 국소 화성 조우이며 이 문서나 별도 실험을 현재 게임의 완성 기능으로 표시하면 안 된다. 생산 모델 1.3 및 기존 GMAT 8개 사례는 수정하지 않았다.

## 플레이의 변화

별도 임무 `transfer`를 추가한다. 플레이어가 태양계 지도에서 출발 날짜와 화성 도착 날짜를 드래그하면 실제 행성 위치에 맞춰 궤도가 다시 풀린다. 발사 창을 벗어나도 선을 임의로 끊지 않고 요구 C3·발사 단계 추진제·도착 상대속도가 증가하는 결과를 보여준다. 이어서 화성 최근접 고도와 B-plane 각을 드래그하면 행성간 경로와 조우 궤도를 함께 다시 맞춘다.

자유 곡선을 그려 그대로 비행시키는 방식은 사용하지 않는다. 날짜·조우 조건이 물리적으로 가능한 경로의 경계조건이다. 고가 발사 서비스와 긴 비행 시간, 빠른 도착과 큰 도착 속도, 낮은 최근접점과 큰 방향 전환 사이의 선택이 발생한다.

## 실제 수집 자료

- [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)로 Earth `399`, Mars `499`, Sun 중심 `500@10`의 위치·속도를 직접 받았다. `VECTORS`, `ICRF`, `REF_PLANE=FRAME`, `VEC_CORR=NONE`, `KM-S`, `TIME_TYPE=TDB`를 명시했다.
- 기간은 2026-08-01~2028-03-01 TDB, 간격 6시간, 행성별 2,313개 상태다. 원응답·정확한 요청 URL·SHA-256·조회 시각을 `tools/transfer/data/`에 보존했다. 응답 헤더의 Earth/Sun 자료는 DE441, Mars 자료는 mar099다.
- Hermite 보간은 위치와 속도를 함께 사용하며 자료 범위 밖 외삽을 거부한다. 별도로 요청한 행성별 13개 중간 시점에서 위치 오차는 지구 최대 0.296 m, 화성 0.175 m였다. 이 표본 검사는 모든 시점의 전역 오차 보장은 아니다.
- TDB를 UTC `Z` 또는 기존 TAI epoch와 혼용하지 않는다. [Horizons 시간 설명](https://ssd.jpl.nasa.gov/horizons/manual.html#time)과 같이 자료의 시간척도를 그대로 보존한다. 사용자 날짜는 명시적으로 TDB 달력 라벨을 사용할 수 있으며, UTC 전환이 필요하면 별도 변환을 검증해야 한다.
- 태양 중력상수 `132712440041.27942 km³/s²`는 [JPL Astrodynamic Parameters](https://ssd.jpl.nasa.gov/astro_par.html)의 DE440 값이다. planet ephemeris와 단순 우주선 두 물체 모델의 차이는 공개해야 한다.

## 수치 방법과 현재 실험 결과

1. 태양 중심 두 끝 위치와 비행 시간으로 0회전 Lambert 문제를 푼다. 현재 실험은 universal-variable의 한정된 물리 분기를 탐색하고 이분법으로 수렴시킨다. 공선·지원 범위 밖·미수렴은 오류다. 다중 회전, 임의의 모든 출발/도착 날짜를 지원한다고 주장하지 않는다.
2. 행성 속도를 빼서 출발·도착 상대 무한원 속도를 구한다. `C3=|v∞,Earth|²`다. 고정 4 km/s를 재사용하지 않는다.
3. 행성 중심에 도착하는 Lambert 선을 임의의 화성 쌍곡선에 붙이지 않는다. 유한 지구 경계 924,000 km와 화성 경계 577,000 km를 두고, 출발/도착 상대 무한원 속도 6개 성분을 미분 보정한다. 각 시행에서 지역 쌍곡선의 경계 위치·시각을 다시 계산한 뒤 그 두 경계 사이 Lambert를 다시 푼다. 양 경계의 속도 잔차를 동시에 10⁻⁸ km/s 미만으로 만든다.
4. 지구 탈출은 역시간 입사 쌍곡선으로 구성하고, 화성은 실제 입사 점근선에 직교하는 B-plane의 각을 사용한다. 지역 상태는 안정적인 쌍곡선 Kepler 방정식으로 계산한다. 이는 기존 M02의 초기 위치 둘레 접근각과 다른 정의다.
5. 두 경계의 위치·속도는 이어지지만 지배 중력은 지구→태양→화성으로 전환된다. 가속도까지 연속인 다체 항법 모델은 아니다. 지구·화성 원점은 실제 동시각 천체력으로 옮긴다.

실험 결과:

| 실험 | 검증 결과 |
|---|---|
| 해석적 원궤도 90°/270° Lambert | 속도 오차 10⁻⁹ km/s 미만 |
| 출발/비행 시간 285개 조합 | 끝점 재전파 잔차 최대 0.019 m |
| 3개 출발 날짜 × B-plane 3개 각 | 유한 경계 보정 9개 모두 수렴 |
| 기준 유한 경계 보정 | 속도 잔차 2.04×10⁻¹⁰ km/s |
| 실제 GMAT R2026a 독립 전파 6개 사례 | 4,084개 상태, 위치 차이 최대 0.188 m |

260일짜리 행성 중심 Lambert 비교에서 2026-08-15 / 2026-11-15 / 2027-02-15 출발 C3는 각각 61.74 / 11.73 / 119.81 km²/s²다. 이는 표본의 같은 비행 시간 비교이며 최적 창 전체를 증명하는 수치가 아니다. [JPL 발사 창 교육 자료](https://www.jpl.nasa.gov/edu/resources/lesson-plan/lets-go-to-mars-calculating-launch-windows/)의 “미래의 행성 위치를 겨냥한다”는 개념을 실제 천체력으로 구현할 수 있다.

기준 유한 경계 해는 지구 근지점 시각 2026-11-15, 화성 근지점 시각 2027-08-02 TDB, 지구 주차 고도 300 km, 화성 최근접 고도 1,000 km다. C3는 10.883 km²/s², 화성 v∞는 3.033 km/s, 정렬된 원형 주차궤도에서의 이상적 탈출 기동은 3,687 m/s다. 기존 탐사선의 수백 m/s급 추진제를 이 탈출 기동에 사용한 것으로 처리할 수 없다.

## 통합 계약 제안

현재 `Design`과 `Plan`에 의미가 다른 값을 덮어쓰지 않고 명시적 분기를 둔다.

```ts
type TransferPlan = {
  departurePeriapsisJdTdb: number;
  arrivalPeriapsisJdTdb: number;
  earthParkingAltitudeKm: number;
  marsPeriapsisAltitudeKm: number;
  departurePlaneAngleRad: number;
  marsBPlaneAngleRad: number;
  launchStageId: string;
  ephemerisDatasetId: string; // immutable source hashes + time/frame metadata
};

type TransferSolution = {
  status: 'solved' | 'infeasible';
  reason?: string;
  phaseEvents: { phase: 'earth-exit'|'mars-entry'|'periapsis'|'mars-exit'; jdTdb:number }[];
  c3Km2S2:number;
  departureVInfinityKmS: [number,number,number];
  arrivalVInfinityKmS: [number,number,number];
  escapeBurnMps:number;
  boundaryPositionResidualKm:number;
  boundaryVelocityResidualKmS:number;
  // Immutable segment initial states / physical parameters, not rendered splines.
};
```

새 API는 `solveTransferPlan(plan, ephemerides)`, `transferStateAt(solution,jdTdb)`, `transferEnvironmentAt(state,jdTdb)`로 분리하는 편이 좋다. 위치 조회는 태양 기준 위치·속도, 현재 중심천체 상대 위치·속도, 실제 태양/지구 방향·거리, 편도 통신 지연, 위상 이벤트를 함께 반환한다. 작업자에는 요청 번호를 붙여 날짜를 계속 드래그할 때 늦게 도착한 오래된 결과를 폐기한다. 실패 결과를 마지막 성공 경로처럼 표시하지 않는다.

필요한 게임 작업:

- **발사 단계**: 현재 지구 저궤도 패키지와 다른 탈출 단계가 필요하다. 실제 C3 요구, 탑재 질량과 자체 추진제·건조 질량·Isp를 이용한 로켓 방정식, 비용을 검사한다. 비용과 단계 사양은 명시적 게임 가정으로 둘 수 있다. 분리 후에만 탐사선 질량과 자원을 사용한다. 출발 주차궤도는 탈출 평면에 정렬됐다고 표시하거나, 별도의 평면 변경을 계산해야 한다.
- **운영 시간축**: 260일을 기존 5 s 틱으로 전부 순회하면 약 449만 틱이다. 기존 루프에 그대로 넣지 않는다. 순항 구간은 결정론적인 큰 간격 적분과 사건 시각 분할을 사용하고, 근접 조우·명령 도착·작업 변경에서는 작은 간격으로 전환한다. 300/600 s 비교로 자원 오차 한도를 정해야 한다. 아직 구현하지 않았다.
- **환경**: 실제 태양 거리의 역제곱 발전, 실제 태양 방향, 실제 지구 방향/거리로 교신과 빛의 지연을 계산한다. 현재 고정 1.8억 km와 고정 태양 방향은 이 분기에 사용하지 않는다. 엄밀한 수신 시각은 이동하는 지구 위치와 광속 방정식을 반복 계산한다.
- **궤도와 기동**: 예정 궤도와 실제 실행 상태를 분리한다. 미리 엔진 축을 기동 방향으로 돌려야 하며, 자세·추진제 부족으로 기동이 실행되지 않으면 예정 궤도를 그대로 따라가면 안 된다. 순항 보정과 실패 후 재표적화도 같은 실제 상태에서 풀어야 한다.
- **3D**: 태양계 지도는 물리 좌표에 별도 화면 축척을 적용하고, 지구 탈출/화성 조우에서 지역 좌표로 전환한다. 행성 크기 확대와 거리 압축을 라벨로 구분한다. 경계 카메라 전환이 궤도 순간 이동을 숨기는 수단이 되어서는 안 된다.
- **저장/증거**: 새로운 모델 버전과 천체력 해시를 저장한다. 이전 M02 점수와 혼합하지 않는다. 기존 GMAT 8개 증거는 유지하고 새로운 전이 증거를 별도 경로로 공개한다.

## 검증 및 남은 범위

실행 가능한 연구 도구:

```text
node tools/transfer/check-prototype.mjs
node tools/transfer/check-interpolation.mjs
node tools/transfer/validate-gmat.mjs
```

첫 명령은 로컬 자료만 사용한다. 둘째는 비교용 Horizons 표본을 다시 요청한다. 셋째는 설치된 `.tools/gmat`의 실제 콘솔을 실행하고 별도 `tools/transfer/gmat-evidence/`에만 기록한다. 재수집은 `fetch-horizons.mjs`다.

GMAT 실험은 동일한 수치 초기상태의 중심중력 전파를 검증했다. 자율 중심중력 실험에서는 입력 벡터를 관성 MJ2000Eq 축의 수치로 두고 공통 임의 TAI 기준시각을 사용했다. 이 실험이 ICRF↔MJ2000Eq 또는 TDB↔TAI 변환, GMAT 자체 행성 천체력과 Horizons 일치, 다체 항법 정확도, 발사장 가시성, 모든 기구/자원/통신을 검증한 것은 아니다.

통합 전 수용 조건은 두 경계 위치/속도 잔차 한도, 실제 v∞와 렌더링 일치, 여러 날짜/B-plane의 수렴과 실패 처리, 단계 질량/추진제 회계, 위상 전환 저장 재현, 자원 적분 오차, 조우 및 명령 사건을 건너뛰지 않는 시간 가속, 두 개 이상의 실제 성공 설계, 실패 후 궤적이 예정 경로를 몰래 따라가지 않음이다. 현재 연구 프로토타입은 수치 경로와 소스 자료의 가능성을 증명한 단계이며 이 게임 수용 조건의 완료를 뜻하지 않는다.
