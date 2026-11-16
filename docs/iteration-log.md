# 구현·검증 반복 기록

## 0 — 2026-11-15 — 준비

- 기존 기능명세서 v1.1과 사용자 추가 요구(완전한 3D, 상용작 수준의 시각 목표, 자율 반복)를 읽었다.
- 공식 게임 자료와 변경 기록을 조사해 조립·궤도·카메라 입력 규칙을 정했다.
- Blender 5.2, Node 24, Python 3.13, Chrome/Edge 설치를 확인했다.
- 그래픽 에셋 제작, 물리 엔진, GMAT 검증을 별도 담당으로 병행한다.
- Ouroboros 런타임은 없음. 정식 Ralph 작업 ID는 발급되지 않았다. 현재는 세션 안에서 직접 제작/검증을 진행한다.
- 아직 기능·시각·성능 PASS 없음. 상용 게임급 목표 미달.

## 1 — 실제 3D 플레이 루프

- Blender로 발사 시설과 조립실을 제작하고, Three.js의 실제 메시 부품·행성·궤도·발사 장면을 연결했다.
- 지구 관측과 화성 국소 중력 도움 임무에 조립→항법→운영→결과→재설계 흐름을 구현했다.
- 실제 포인터 테스트에서 부품 이동/회전/간섭, 궤도 핸들, 일정 이동/리사이즈/삭제, 저장/복원을 확인했다.
- 수정: 회전 고리의 배치 검사 누락, 부품 회전 중복 적용, 같은 ID의 종류 변경 시 기존 메시 유지, 중간 결과 저장의 잘못된 재현 시각, 계산 실패 뒤 오래된 예측으로 발사 가능하던 경로를 해결했다.
- 구름 텍스처의 알파 적용 오류, 과대 SVG, 외부 폰트 요청을 수정했다. 폰트는 OFL 원본에서 로컬 WOFF 부분집합을 생성한다.

## 2 — 과학적 근거와 실제 GMAT 대조

- GMAT R2026a 콘솔에서 지구 24시간 4사례와 화성 국소 조우 5시간 4사례를 실행했다. 6,968개 상태에서 최대 위치 차이 0.1982m로 비교 기준을 통과했다. 행성간 전이 검증으로 확장해 주장하지 않는다.
- TSP-45W의 공개 질량/발전량, BPX 배터리의 공개 질량/용량을 적용하고 조건과 가정을 분리했다. 6날개 어레이는 실제 단일 상품이 아닌 합산 설계임을 명시했다.
- 교신 조건과 전파 지연을 가진 지상 명령 큐, 여러 순차 기동, 물리 궤도의 근접접근 훈련, 실제 부품 가림 오버레이를 추가했다.
- production `index-Di_VSFLN.js`: 기존 브라우저11개 전부 PASS. 이전 빌드에서 기동 핸들의 겹친 클릭 영역이 잘못 선택되던 문제는 화면상 가장 가까운 중심을 선택하도록 수정했다.

## 3 — 현재 통합 작업

- 한·영 전환을 연결했다. 실제 브라우저에서 새로고침 후 접근성 언어 속성이 유지되지 않는 결함을 발견해 초기화 시 `lang`과 언어 CSS 상태를 설정했다. 다음 production 재검증 대상이다.
- 모델1.2: 유한 자세 회전, 실제 자세에 따른 발전/관측/교신, 자세 전환 중 저장 재현, 내부 베이의 물리 수납 범위를 구현했다. 담당 도메인 테스트38개와 TypeScript/GMAT 회귀가 통과했다.
- 기체 상단을 열어 실제 내부 장비를 보는 서비스 베이, 시간축 자원 곡선, 명시적 임무 요구표, 조립 길잡이와 복제 조작을 통합했다. 통합 후 플레이·시각 검증 중이다.
- NASA 공식 Blue Marble 지구 지도를 4096×2048 원본 응답으로 교체했다. 원본·용량·사용 조건은 출처 문서에 기록했다.
- 반복 항법 편집에서 폐기되지 않던 라벨 텍스처와 임시 부품 재질을 정리했다. 장기 그래픽 메모리 측정은 별도 검증한다.
- 남은 작업: 지표 목표 직접 선택, 발사 수납/패키지, 최신 빌드의 Edge·오프라인·컨텍스트 복구·성능 검증, 원 요구 추적표 갱신, 실제 배포. 외부 사용자5명 평가와 상용작 동등성은 미달/미검증을 유지한다.

## 4 — 첫 비공개 배포 후보 검증

- 모델1.3에 지표 지역 직접 선택, 정밀 관측/광역 조사, 실제 지상 해상도와 고유 구획 과학 성과, 발사 패키지의 비용·질량·수납·초기 궤도 제약을 통합했다.
- 예측 자원 곡선, 내부 베이, 수납 외형 검사, 조립 길잡이, 다중 기동과 실제 관측/교신 선의 끝점을 연결했다. 수납 외형은 전개 기구의 운동 해석으로 주장하지 않는다.
- `index-BJKhhqBm.js` 전체 브라우저21개 PASS. 최종 `index-l4xtqTRr.js` 엄격 재검사4개 PASS: 1280×720 영어 결과 버튼 전체 노출/접근성/복원, 내부 조립 길잡이, 직접 ROI·자원 곡선, 수납 Escape·발사 패키지 조건과 영어 경고.
- 시각 확인에서 테스트가 놓친 결과 버튼 하단 잘림을 찾아 sticky 위치를 고치고 전체 버튼 경계 검사를 강화했다. 경로 라벨 재생성의 GPU 텍스처 누적은 12회 재생성 후 일정한 수치로 회귀 통과했다.
- Chrome157/Edge157의 로드 후 오프라인 운용·저장·WebGL 손실 일시정지/복구·저장 차단 시 JSON 백업을 확인했다.
- 4K 빌드, 1280×720/high, Intel Arc130V: 캐시 없는10Mbps/40ms 조건에서 준비9.60초. 120초 비행7,200프레임 p95 18.0ms/p99 18.7ms,33.34ms 초과0개, 그래픽 자원 일정. 해당 조건의 측정이며 모든 기기나 원 명세서의20부품·2천체 조건을 보증하지 않는다.
- 이 후보는 완주 가능한 플레이 버전이다. 상용 게임 규모·완성도 동등성을 달성했다고 판정하지 않는다. 다음 반복은 운영 중 판단, 과학 자료 이동의 시각적 보상, 독립 검증 중인 실제 행성간 전이의 통합 설계를 다룬다.

## 5 — 원본 3D 관제실과 행성간 전이 화면

- Blender로 12개 운영 좌석·24개 책상 모니터·운영요원·장비 랙·계단식 통로·천장 조명을 가진 관제실을 새로 제작했다. 실제 메시 51,571개 삼각형, 27개 메시/재질 묶음, GLB 3,019,548바이트다. 상용 게임의 에셋을 복제하거나 유료 생성 API를 사용하지 않았다. [에셋 출처](asset-provenance.md), [관제실 상세 출처](mission-control-provenance.md), [Blender 렌더](qa/mission-control.png).
- 중앙 `MainScreen`은 분리된 메시이며 게임의 현재 우주 장면을 렌더 타깃으로 표시한다. 정적인 배경 사진이 아니다. glTF 이미지 UV와 렌더 타깃의 세로 좌표 차이로 화면이 뒤집히던 결함을 시각 검사에서 발견해 한 번의 V 반전으로 수정했다. WebGL 복구 시 사라지는 반사 맵도 다시 생성한다.
- 별도의 `TransferScene`에서 지구·화성 천체력, 실제 전이 상태와 구간별 경로를 동일한 ICRF→Three 좌표 변환으로 표시한다. 실제 저장된 부품 배치로 기체를 만들고, 출발·도착 날짜 손잡이를 마우스로 끌며 예고 위치를 볼 수 있다. 상세 보기에서는 요청한 행성 기준의 경로를 사용하고, 현재 운항 단계 밖의 화면은 구간 미리 보기로 표시한다. 기체 확대 비율과 설명용 자세를 숨기지 않는다.
- 실제 포인터 검사에서 두 날짜 손잡이가 각각 +18 TDB일을 확정했다. 계산 불능 계획은 이전 경로·행성 위치·기체·날짜 손잡이를 지우며, 유효한 해를 다시 넣으면 복원된다. [전이 렌더러 QA](transfer-renderer-qa.md), [계산 불능 경로 제거 검사](qa/transfer-clear-solution.json).
- 반복 기체 재생성에서 매번 하나씩 증가하던 GPU 텍스처를 발견했다. foil `bumpMap`의 소유권·폐기 처리가 빠져 있었으며 수정 후 12회 재생성에서 텍스처 9개가 유지됐다. 구간에 따라 지오메트리는 115/120개로 일정했다. 컨텍스트 손실/복구 후 화성 정지 화면은 픽셀까지 같았다. [측정 기록](qa/transfer-scene-resilience.json). 이 검사는 새 빌드의 장기 프레임 성능 측정을 대신하지 않는다.
- production **`index-as3YeZTu.js`**, Chrome 157, **1280×720**에서 첫 임무 선택→M03 조립→태양계 계획→화성 상세를 실제 UI로 열고, 지구 임무의 관제실도 확인했다. 세 임무 카드가 첫 화면에 모두 보였고 두 날짜 손잡이를 가리는 패널이 없었다. 경로 설명은 y=566에서 끝나 y=581에 시작하는 일정표와 겹치지 않았다. 화성 기체는 화면 약 (737,409)에 보였으며 관제실의 하단 안내 카드가 중앙 모니터를 가리지 않았다. 페이지·콘솔·리소스 오류는 0개였다. [기록과 좌표](qa/iteration-5/visual-review.json), [태양계 화면](qa/iteration-5/transfer-solar-1280.png), [화성 화면](qa/iteration-5/transfer-mars-1280.png), [관제실 화면](qa/iteration-5/control-room-1280.png).
- 같은 흐름에서 관제실 GLB 요청은 진입 전 0회, 진입 후 1회였다. 상시 초기 다운로드에 추가되지 않은 것은 확인했으나 새 장면의 콜드 로드·장기 성능 수치로 확대해서 주장하지 않는다.
- 마지막 시각 확인에서 태양계의 MARS 이름표와 상단 설명이 약 10px 겹치고, 상세 보기의 중복 이름표가 설명 아래에 숨는 점을 발견했다. 상세 이름표 숨김과 상단 설명 이동을 소스에 반영했으며 이 두 미세 수정의 최종 빌드 재검사는 다음 확인 대상이다. 전체 상용작 규모·완성도, 외부 사용자 5명 평가, 새 빌드의 장기 성능은 별도 미검증 상태를 유지한다.

### 5차 반복의 통합 검증

- 최종 후보 `index-B-z3t1tK.js`에서 영문 태양계 화면을 다시 확인해 이름표 겹침 수정과 실제 M03 지구 이탈 사건의 번역을 확인했다. 이전 문단의 장기 성능·이름표 확인 대기는 아래의 구체적 범위에서 해소됐다.
- M03은 실제 JPL 천체력에서 출발 날짜·화성 도착 날짜를 조절하고, 지구 탈출→태양 중심 순항→화성 접근→지구 자료 수신까지 실행한다. 날짜와 일정의 직접 드래그, 전이 단계의 실제 질량·추진제 조건, 관측 자세·전력·통신·빛의 이동 시간이 결과에 반영된다. 완주와 엄격한 체크포인트 재생, 변조 파일 거부, 저장 차단 시 JSON 백업을 확인했다. 국소 스윙바이 M02와 별도 임무이며, 순항 보정이나 비행 중 지상 명령은 아직 M03에 없다.
- 단위시험 137개/20파일 PASS. Chrome의 27사례 배치에서 25개 통과 후 발견한 안내 카드 테스트의 접힘 처리와 잘못된 JSON 안내 회귀를 수정하고 관련 3개를 최종 후보에서 재검사했다. 별도 M03 복구 5개와 최종 영문 1개를 합쳐 고유 사례는 33개이며, 모두를 최종 후보에서 한 번에 실행했다는 의미는 아니다.
- 다른 브라우저·빌드 작업을 중단하고 최종 후보의 실제 관제실과 화성 근접 비행을 각각 120초 측정했다. Chrome157/Intel Arc130V/1280×720/DPR1/실제 6부품 조건에서 두 장면 모두 7,203개 프레임 간격, p95 16.9ms/p99 17.0ms, 33.34ms 초과 0개, 오류·long task 0개였다. 관제실과 전이 렌더러의 그래픽 자원은 6회 표본에서 일정했다. 원 명세서의 20부품 표준 장면 또는 모든 장치의 성능 검증으로 확대하지 않는다. [원 측정](../tests/browser/artifacts/performance-extended/report.json)
- 검증된 플레이 버전의 다음 배포를 준비한다. 원 요구 57개 중 부분 구현 44개 등 큰 미완 범위를 추적하며, 부품/버스의 실제 차이, 호환성, 운항 중 판단과 재설계 연결을 다음 반복으로 남긴다. 최종 상용 게임급 목표는 계속 열려 있다.

### 두 번째 비공개 배포

- 정확한 소스 커밋 `3c0caebd6b66a7d463349e5217a288f941026f27`을 원격에 저장한 뒤 같은 소스에서 만든 `orbital-foundry-milestone-2.tar.gz`로 배포했다. 최종 검증 번들 해시가 그대로 유지됐다. 배포 ID `appgdep_6af89f3fd4c08191bedd7de920cd37d4`, 상태 `succeeded`.
- [플레이 주소](https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site)의 기존 소유자 전용 접근을 유지했다. 새 최종 Edge 3사례도 통과했으며 상세 환경·범위는 [브라우저 QA](browser-qa.md)에 기록했다.

## 6 — 기능이 다른 하드웨어와 원인 기반 재설계

- 다음 반복을 시작했다. [하드웨어 제안](hardware-expansion-proposal.md)에 따라 두 버스와 전원·센서·무선기·안테나·자세제어·기록장치의 서로 다른 기능을 구현한다. 과거 1.3/transfer1.0 비행은 같은 수치와 규칙으로 재현해야 하며, 새 설계 버전과 저장 슬롯을 분리한다.
- 실제 전압·포트·프로토콜·RF 대역이 맞는 연결, 실제 전력과 데이터 이동 한도, 질량/기하에 따른 자세 전환이 새로운 선택의 결과가 된다. 공개된 제조사 값과 자체 통합 가정을 구분한다. 외형은 같은 치수를 사용하는 두 버스로 시작하고 내부 구성과 성능을 다르게 한다.
- 별도 결과 분석 모듈에서 실제 사건·패킷·명령 근거를 표시하고 관련 부품/일정/시각으로 돌아가도록 한다. 낮은 점수만으로 원인을 단정하거나 모델·목표가 다른 결과를 점수 차이로 비교하지 않는다.
- 현재는 구현 중이며 새 16종·새 성공 프리셋·신규 버전 저장 호환·성능을 아직 통과로 세지 않는다.

### 6차 통합 후보와 검증

- 위의 구현 시작 시점 이후 두 버스와 16개 모델의 전압·포트·RF 연결, 실제 전력·읽기/송신 속도, 노출·관성에 따른 자세 전환이 구현됐다. 새 하드웨어 카탈로그는 `25a47f24340365b5b52d62708ce987f7a90df4ee6559879b91464a2d24ae9a98`로 고정했다. 기존 1.3/transfer1.0 체크포인트 6개는 전체 상태를 대조해 재현했다. 수치·가정·계산 단위는 [하드웨어 모델](hardware-model-v2.md)과 공개 카탈로그에 있다.
- 초기 지역 정밀 관측을 그대로 새 카메라에 적용하면 70 km 반경·해상도·노출을 함께 만족하기 어렵다는 문제를 발견했다. 새 프로필만 반경 10 km와 실제 검출기 창 읽기를 정의했다. FOV·IFOV·픽셀 범위·해상도를 그대로 검사하며, 광역 조사와 정밀 관측 모두 실제 최종 수신이 있는 성공 설계를 확보했다. 기존 프로필의 조건과 점수는 바꾸지 않았다.
- **2026-11-15 03:27:43 KST 시작, 전체 28파일·236시험 PASS, 128.45초**. 같은 초록 결과를 반복 실행해 숫자를 부풀리지 않는다. 실제 UI 조작과 성능·외부 초보자 평가는 별도 증거다.
- 생산 빌드 A `index-BQvbEXhp.js`에서 신규 조작 4개 고유 사례를 확인했다. 최초 배치 3개 PASS 후, 접힌 스크롤 선반 밖 좌표로 드래그하던 시험 가정을 바로잡고 해당 1개를 다시 통과했다. 장비 16종 전부 실제 포인터 부착, 작은 부품 초점/버스 undo, 같은 ID의 모델 교체·복제, M03 두 접근 손잡이의 확정/취소/계산 중 잠금이다. 브라우저 오류 0. [원본 18모델 렌더](qa/hardware/models-v2-production.png)는 A의 제작 메시를 사용한다.
- A의 Mars 화면에서 B-plane 손잡이 위에 안내문이 겹치는 것을 직접 보고 위치를 수정했다. 새 카메라의 실제 반시야각과 10 km 지역 경계를 3D 표시에 연결하고, 카메라가 없는 새 버스는 가상의 관측 범위를 표시하지 않게 했다. 버스 교체·되돌리기에서 렌더 선택과 UI 선택도 맞췄다.
- 후보 B `index-pCM8atUN.js` / `transfer-ui-DpQ628Tm.js`에서 실제 실패→안테나 포인터 수정→동일 조건 완주 비교, 영어 중간 결과/CTA, 16종·빈 배터리 그래프, 분리 저장 슬롯, 실제 무선기 연결 수리 사례가 통과했다. 새 M03 실제 완주와 엄격 JSON 재생도 통과했다: **12/3 자료, 점수 93, 최소 배터리 81.26 Wh, 탐사선 추진제 6 kg**. 중단 없는 송신으로는 전력 부족이 생기므로 새 균형 일정은 실제 충전 구간을 사용한다.
- 후보 B의 나머지 지역 관측·되돌리기·언어/큰 UI 행렬과 후속 생산 후보는 아직 확인 중이다. 아직 이 기록을 전체 최종 브라우저 PASS, 20부품 성능 PASS 또는 상용 게임 동등성으로 읽지 않는다. 20부품 성능용 기체는 물리 장착은 유효하지만 예산·전력·다중 관측기 제한이 남는 계획 장면이며, 임무 완주 설계로 포장하지 않는다.

### 6차 후보 C의 전체 회귀와 D 수정

- 후보 C `index-CNPUcqf4.js` / `transfer-ui-Bh6EDW1H.js`의 단일 Chrome 배치 **45개 중 42개 PASS, 3개 FAIL, 12.5분**. 원래33개·새 하드웨어/결과8개·언어/배율4개를 포함한다. 성공 사례의 페이지·콘솔·자산 오류는 없었다. [C 배치 기록](../tests/browser/artifacts/candidate-c-benchmark/batch-summary.json)
- 세 실패 중 실제 제품 결함은 수신 직후 일시정지가 알림 DOM을 비우는 현상이었다. 실제 패킷·수신 점수는 정상이었다. D에서는 실제 새 패킷 ID·알림 시작 시각을 보존하고, 화면 갱신 뒤 원래 3초 중 남은 시간만 이어 표시한다. 새 수신 없이 효과음·수신 사건을 추가하지 않는다. 동작 줄이기에서도 같은 텍스트가 보인다.
- 나머지 두 건은 시험 가정을 바로잡았다. 날짜 입력의 Tab이 입력 내부 구획에 남는 경우 명시적으로 초점을 옮기며, 카메라의 완전한 영문 aria 문구 변경을 정확한 기대 문자열에 반영한다. undo·판정·경계·언어 검사는 약화하지 않았다.
- C의 한국어/영어×기본/큰 UI 네 여정은 모두 실제 지구 임무 결과와 M03 태양계/화성 계획까지 통과했다. 새 하드웨어 M03 완주/엄격 재생, 결과 진단의 상단 배치, 종료·복원 시 실제 종료 시각을 유지하는 Solar overview도 통과했다.
- **03:54 KST 현재** D `index-Bauqs6KO.js` / `transfer-ui-Ol57z1SB.js`를 동결했다. 영향을 받은 Chrome5개·Edge4개 및 렌더러 후속 검사와 성능은 진행 중이다. 전체236단위 이후 계산 모델 변경은 없으며, 후속 아트/계산 최적화는 배포 후보와 분리한 작업본에서 준비한다.

### 6차 후보 D에서 발견한 저장·표면 결함과 E

- D의 Chrome 표적5개 중4개가 통과했다. 수신 알림은 실제 표시 이후 일시정지·같은 패킷/시각 유지·동작 줄이기·원래3초 만료·물리 상태 불변까지 통과했다. 나머지1개는 고쳐진 시험이 더 진행하며 실제 새 저장 결함을 드러냈다. custom 날짜/드래그 일정과 undo/redo 자체는 맞았지만, 조립의 지연 저장을 취소하고 새 항법 화면을 나가면 최신 초안이 저장되지 않았다.
- E는 새 조립 초안을 전달받은 항법 화면을 저장 대상으로 표시한다. 계산 결과 이후 또는 화면 종료 시 현재 초안을 저장하며, 종료는 저장 응답을 기다린다. 이미 저장된 임무를 읽는 동안 임시 기본 기체를 저장하지 않는다. 주 UI의 비동기 저장도 import 전에 기체/계획과 프로필을 캡처해 다른 임무의 전역 상태를 참조하지 않게 했다.
- 별도 육안 검사에서 새 버스 상판의 겹친 면과 측면 표식이 단열재 내부에 묻힌 것을 발견했다. 상·하부 어두운 판 두께0.050→0.044m, 측면 단열 두께0.035→0.028m로 내부 여유를 만들었다. 물리 경계·기둥·뚜껑·기존 프로필은 그대로다. 추가2개 raycast 회귀를 포함한 **하드웨어 렌더24개 PASS**. 기존 전체236개와 합쳐 새 전체238개 실행이라고 세지 않는다.
- E `index-C6OHa66y.js` / `transfer-ui-Da1kv3FN.js`를 동결하고 저장 관련 Chrome8개·Edge4개를 확인 중이다. E의 전체 단일 회귀 통과 또는 배포 완료는 아직 선언하지 않는다.

### 6차 E 배포 전 검증 완료

- E Chrome 표적8/8 PASS(3.7분), Edge4/4 PASS(1.7분), 렌더 후속3/3 PASS(20.9초). 새 초안 저장 누락이 실제 IDB·임무 전환·복원까지 해소됐고, 새 하드웨어의 실제 WebGL 손실/복구·환경 맵 재생성·정지 상태 보존·물리 시간 재개가 통과했다.
- 같은 E에서 Chrome/Edge 화성 완주 결과435개 원시 값(숫자234개),12패킷,29사건을 직접 비교해 차이0을 확인했다. C의45개 배치와 D/E의 표적 수정 검사를 서로 다른 스냅샷으로 기록하며, E에서 전체45개를 한 번에 재실행한 것으로 부르지 않는다.
- 다른 GPU/CPU 시험을 멈추고 로컬 E의1080p/중간/DPR1/20실제부품/2행성/경로1160점(+2점 안내선)을10초 준비 후120.013초 측정했다.7200프레임·원 평균60.000650FPS·p99 17.0ms·최대17.3ms·long task/오류0,12오른쪽드래그/12휠 입력,6표본GPU자원 일정. 실제 배포 URL 측정과 콜드 로드는 이어서 수행한다. 임무 제약 위반을 남긴 계획 스트레스 기체이지 완주 기체는 아니다.
- E 상판/측면과 Mars 손잡이 화면을 직접 확인했다. 새로운 아트·캐시 시제품은 별도 형제 디렉터리에 있으며 이 배포 소스에 합치지 않았다. 원 기능명세서의 변경 없는 사본을 저장소에 포함해 외부 소스에서도 추적할 수 있게 했다.

### 세 번째 비공개 배포와 실제 HTTPS 측정

- 커밋 `2eaa0fa530107daef991ef12e4bb967c29c14de0`을 원격에 저장하고 같은 E 번들로 `orbital-foundry-milestone-3.tar.gz`를 만들었다. 배포 `appgdep_6af8b299738c8191a6abb22193062a7d` / 버전3 / 상태`succeeded`. 배포 파일 SHA-256은 `e796c6f53dd5d1114ad2d453539cf3743d23320504b6226a759b92fcbea34dc6`다. 기존 소유자 전용 접근을 유지했다.
- [실제 HTTPS 주소](https://orbital-foundry-mission-lab.gjtjwns06.chatgpt.site)에서 정확한 E 번들·16종 선반·실제3D 조립을 확인했다. 빈 캐시·20Mbps·RTT100ms·1920×1080에서 첫 조립 준비 **6.561706초 / 약11.760192MiB**, 모든 응답 측정·오류0으로 초기 기준을 통과했다.
- 같은 실제 URL의 표준 장면도10초 준비 후120.0104초 입력 재생을 마쳤다.7199프레임 간격·원평균 **60.00076678296223FPS**,p99 **17.0ms**,최대17.2ms,오류/long task0.12오른쪽드래그/12휠과GPU자원 일정까지 통과했다. 로컬 측정을 배포 측정인 것처럼 바꾸지 않고 별도 원자료를 보관했다.
- 이 판정은 명시된20부품 계획 스트레스 장면과 첫 로딩 조건에 한정한다. 상용 게임 동등성·모든 장면·외부 초보자 시험의 완료 선언은 아니다.

## 7 — 부품 표면 디테일과 결과를 보존하는 계산 개선

- 6차 배포·실제 HTTPS 검증 뒤 다음 반복을 시작했다. 별도 작업본의 기판 atlas·깊이가 있는 광학계·단열 이음새·확대 그림자 개선을 실제3D 화면과 물리 경계로 확인한다. 기본 시점에서 부품이 읽히는 구성과 실제 모델을 사용한 선반 썸네일도 검토한다.
- 별도 계산 작업본은 정확한 시각·통신망 모드별 환경과 고정 하드웨어 계산을 재사용한다. 독립 검토에서 기준 소스/입력의 독립성 및 특수 숫자 해시 검증을 강화하기로 했다. 기존 수치 분할·광선 수·연산 순서는 유지하며, 원본과 정확한 결과 비교가 먼저다. 아직 생산 소스에 합치거나 속도 향상을 확정하지 않았다.
- 아트 작업본의 물리 경계·광학·기존 모델 관련35개 집중 시험과 실제 초점/그림자 복원/컨텍스트 복구가 통과했다. 루트가18모델 시트와 기본·큰 UI의 새 카메라 시점을 직접 확인했다. 실제 모델을 촬영한16타일 투명WebP는77,488바이트이며, 선반은 모델ID별로 타일을 찾도록 연결했다. 아직 합쳐진 생산 빌드의 조작·성능 검증은 전이다.
- 원격운용은 [Phase A 구현 계약](m03-operations-phase-a-contract.md)으로 범위를 고정했다. 미래 일정 교체·미송신 취소·동일 명령 재시도와 별도ACK를 먼저 완결하며, 실제 명령 엔진은 아직 구현하지 않았다. `ui-transfer-operations.ts/.css`의 지상 명령 카드와 확인/전송/초안 표시는 준비했지만 아직 앱에서 불러오지 않는다. 저장 버전과 기존 비행의 경계를 유지한 뒤 Worker·실제 마우스 조작에 연결한다.
- 광범위 환경 캐시는 **채택하지 않았다**. 독립 실행18회/원본·후보9쌍의 입력·전체 상태·결과·환경·공개 원격측정 해시는 모두 같았고18개 엄격 재생도 일치했지만, 전체 예측/재생 중앙값이 기존 임무1.958/1.900→2.730/3.777초, 하드웨어 균형26.740/26.768→30.835/30.615초, 과학11.240/11.210→12.961/12.801초로 악화됐다. 반복 조회의 빠른 수치를 전체 임무 향상으로 제시하지 않는다. [실패 실험과 원자료](../tools/performance/rejected-broad-cache/REPORT.md)를 보관했으며 해당 코드는 실제 앱에 반영하지 않았다.
- 승인된 렌더2파일과 실제 썸네일만 합친 **7A `index-pj8dkhVB.js` / `transfer-ui-B6nugUBY.js`**는 TypeScript/생산 빌드와 집중35개 시험을 통과했다. 계산 Worker3개는 E와 동일하다. 실제 하드웨어 조작5/5도42.3초에 통과했다. 전체 이전236개를 새로 실행한 것으로 합산하지 않는다. 언어/배율 조립 화면과 새 아트의 표준 성능은 이어서 확인한다.
- 하드웨어 상수만 미리 계산한 두 번째 성능 시제품도 채택하지 않았다. 독립 단일 비교에서 균형 임무 예측26.695→25.475초, 재생27.038→25.242초로 줄었지만 미리 정한 약10% 이상의 유의미한 개선 기준에 미달했고 반복 분포의 근거도 아니다. 정확한 결과와 네 저장 재생은 일치했다. [제한된 측정과 미채택 근거](../tools/performance/rejected-compiled-only/REPORT.md)를 보관하고 새 게임 기능 구현으로 이동했다.
- 7A 네 언어/배율 조립 화면도 통과했다. 육안 검토의 초기 toast/길잡이 제목 겹침은 CSS 위치만 조정한 **7B `index-BHzw1aRT.js` / `transfer-ui-Dcapz3WI.js`**에서 고쳤다. 네 화면을 다시 확인해 실제 안내가 떠 있는170–262ms 시점에19/21px 간격을 측정했다. 별도 Edge1/1 actualWebGL복구도15.2초에 통과했다. [7B 기록](../tests/browser/artifacts/candidate-7b-benchmark/batch-summary.json)
- 7B의 고립된1080p/중간/20부품 표준 장면은10초 준비 후120.0073초 동안7199프레임 간격·원평균60.00091680800768FPS·p99 17.0ms·최대17.2ms·오류/long task0·GPU자원 일정으로 통과했다. 실제12오른쪽드래그/12휠을 확인했다. 이 기록은 로컬이며 새 배포의 HTTPS/콜드 로드 기록과 구분한다.

### 네 번째 비공개 배포와 실제 HTTPS 확인

- 커밋 `dc96ef18cd4cb169a0ff9ed101e107da500df926`, 버전4, 배포 `appgdep_6af8bcf76b20819198d9420d7817837a`가 성공했다. 7B 번들 `index-BHzw1aRT.js`를 유지했고 소유자 전용 접근도 그대로다. 로컬 gzip 아카이브는9,152,532바이트/SHA-256 `bc8785abc3ca704853485ce8f8dc393efacc1e9ec0689933c6eeeac61a74b36a`; 호스팅이 저장한 압축 해제 TAR은17,377,280바이트/48파일/SHA-256 `5954f977c8512b98f82cac2cc6f7bcb468416b2421b4fbc455b1dd8ee1d77775`다. 서로 다른 두 포맷의 해시를 혼동하지 않는다.
- 실제 HTTPS에서 정확한 번들·16모델 선반·3D 조립 화면을 확인했고 오류0이었다. 빈 캐시20Mbps/100ms RTT/1080p 초기 조립은 **6.6339307초 /11.8093538284MiB**로 통과했다. [배포4 로딩](../tests/browser/artifacts/cold-load-deployed-v4/report.json)
- 별도10초 준비 후 **120.0172초/7200간격/평균60.00085001204206FPS/p99 17ms/최대17.2ms**를 기록했다. 실제12드래그/12휠, 오류·long task0,6표본GPU자원 일정이다. 이전 배포3 증거를 덮어쓰지 않고 별도폴더에 보관했다. [배포4 표준 장면](../tests/browser/artifacts/performance-standard-deployed-v4/report.json)
- 배포4 이후 원격 운용3 작업본에서 명령/ACK의 실제 시각·좌표 렌더14시험과 제어 epoch3시험이 통과했다. 초안 타임라인·Worker 연결은 작성 중이며, 실제 운용3 엔진·구제 시나리오·브라우저 완주가 아직 없어 플레이 가능한 완료 기능으로 세지 않는다. 잘못된 import의 기존 비행 보존과 중복 제어의 부작용을 독립 검토에서 발견해 고쳤으며 실제 Worker 회귀를 진행한다.

## 8 — 지연된 원격 명령과 비행 중 일정 편집

- 새 제어 코드의 실제Worker8/8시험이 통과했다. 기존5개 물리/저장 검사를 유지했고, 같은 비행의 오래된 시간 이동 차단, 중복 warp의 물리/대기수요 불변 및 상충 입력 거부, 잘못된 JSON/위조 에너지 import 이후 기존 비행 보존·엄격재생·재개를 추가했다. 명령의 실제 무선 전송 성공을 이 시험으로 세지 않는다.
- 로컬 **8A `index-CAmXh2e9.js` / `transfer-ui-DY92q0dV.js` / `transfer.worker-wy0VbKhl.js`**는 TypeScript/빌드와 기존M03브라우저5/5를 통과했다(151.9초). 새하드웨어와 기존프로필의 실제3단계 완주/저장재생, 날짜/일정 포인터조작, 위조저장 보존, 실제WebGL복구다. [8A 원자료](../tests/browser/artifacts/candidate-8a-regression/manifest.json). 원격운용3 facade는 이때 준비용 skeleton이며 실제3임무 진입은 노출하지 않았다. 배포4와 별도다.
- 추적 로그의 페이지/콘솔오류·HTTP실패는0이지만, 경고 검토에서 복구 시 이전 PMREM 자원을 새컨텍스트에서 삭제하는 WebGL INVALID_OPERATION 3건을 발견했다. 화면·상태 복구가 통과했다고 이 수명 관리 경고를 숨기지 않는다. 렌더 담당이 원인 분리와 제한된 수정·직접 재현 검사를 진행한다. 기타PMREM 필터샘플/드라이버 셰이더 정밀도 경고도 원문 보존한다.
- 별도 운용3 작업본의 순수 명령 기록/ACK지식 감사12개가 통과했다. 중간확인누락·이전 신호가 남은 재시도취소·만료후 중복설치방지·UTF8한도·조작ID중복 등을 다루며, 설치 함수를 직접 호출한 규칙검사를 RF전송 검증으로 바꾸지 않는다. 실제전송/구제미션/수치수렴/저장2재생은 아직 진행 중이다.

### 8A → 8B → 8C: 실제 컨텍스트 복구의 자원 수명 수정

- 8A의 기존 M03 브라우저5/5 통과와 별도로, 실제 WebGL 삭제 함수를 계측한 새 시험은 **M03 복구3회에서 INVALID_OPERATION9건**으로 실패했다. 매번 이전 PMREM의 프레임버퍼·깊이 렌더버퍼·텍스처를 복구 뒤 새 캐시에서 삭제했다. 화면이 복구됐다는 이유로 경고를 무시하지 않았다. [8A 직접 재현](../tests/browser/artifacts/transfer-context-ownership/before-8a/report.json)
- PMREM을 컨텍스트 손실 시점에 정리한 **8B `index-w_0zFQ-h.js`**에서는 M03 복구3회가 깨끗하게 통과했다. 하지만 하드웨어 지구 비행3회+관제실3회의 결합 시험은 **추가9건**으로 실패했다. 첫 비행 프레임의 `WebGLShadowMap.render`가 재초기화된 그림자 유형 상태에 따라 이전 그림자 맵을 교체하며 옛 깊이 텍스처·프레임버퍼·텍스처를 삭제한 것이 원인이었다. 두 번째 실패와 통과한 화면·물리 상태 검사를 구분해 보존했다. [8B 원인 기록](../tests/browser/artifacts/transfer-context-ownership/after-8b/diagnosis.json)
- **8C `index-DvcSvFfY.js` / `transfer-ui-BIw0rpyT.js` / `transfer.worker-EieOABJZ.js`**는 소유한 그림자 맵도 손실 시 정리하고 참조를 비워 복구 뒤 재생성한다. 관제실은 자신이 만든 환경 맵·모니터 렌더 타깃만 정리하고, 주 화면에서 빌린 환경은 삭제하지 않는다. 손실 중 관제실 렌더도 중지한다. 조명·부품·물리 모델은 바꾸지 않았다.
- 같은 엄격한 두 시험이 **2/2 PASS, 실제 복구9회,23.1초**로 완료됐다. 잘못된 GPU 삭제0·컨텍스트 소유권 경고0·페이지/콘솔오류0, 일시정지 물리 상태의 정확한 유지·실제 시간 재개·관제실 모니터 픽셀까지 확인했다. 세 화면의 캡처를 직접 검토했다. 각3회에서 GPU수량은 M03 **108/7/13**, 비행 **54/15/21**, 관제실 **80/13/20**(geometry/texture/program)으로 일정했다. 성능 측정으로 부르지 않는다.
- M03의 기존 PMREM 필터 샘플 한도·드라이버 셰이더 정밀도 경고는 별도로 남아 있다. 제거한 것은 실제 잘못된 컨텍스트 삭제이며, 모든 종류의 경고를 없앴다고 주장하지 않는다. Chrome157/1280×720 검증 후 브라우저는 모두 종료했다. [8C 검증 묶음](../tests/browser/artifacts/transfer-context-ownership/after-8c/manifest.json). 이 결과는 아직 준비용인 운용3 명령 임무의 성공이나 새 배포를 의미하지 않는다.


## Iteration 8D: actual remote operations integration

Local production candidate8D: entry `index-8sGqNdQq.js`, shared `index-BHZ2O11J.js`, transfer UI `transfer-ui-A1hoqGtM.js`, worker `transfer.worker-D8HCV3Ql.js`. This is not yet the published version4. Explicit operations3 source integration preserved all15 approved production hashes;41 domain tests passed, including real no-command0/3, late-command0/3 and early-command12/3 outcomes, five checkpoint phases and declared numerical convergence gates. See [domain acceptance](qa/operations/acceptance-summary.md).

The actual bundled Worker passed10/10 tests in29.30s, with47 captured dependency/source files unchanged. [Worker audit](qa/operations/worker-contract-audit/result.json). Actual Chrome157 at1280x720 then passed3/3 new UI cases in3.2minutes: real pointer repair through distinct command installation/Earth acknowledgement/science delivery/exact replay; cancel/retry preserving emitted signals and invalid-import recovery; bounded restore/context recovery plus immediate Send/Exit/Continue with no phantom draft. All six captured candidate entries stayed byte-identical and application errors were0. [Browser batch](../tests/browser/artifacts/remote-operations/8d/batch-summary.json).

The real UI repaired flight received12 packets; its longer UUID-bearing command arrived at22456736.79475602s and its Earth acknowledgement at22457635.5238937s. Domain fixture IDs encode different byte lengths, so their exact frame times are not interchangeable. In the late domain case the real receiver/link loses the frame after the listening window; Earth remains unconfirmed, rather than inventing an acknowledged expiry rejection.

UI review caught three races before the final run: pending restore could advance the UI epoch while the worker ignored input; immediate exit could save an already submitted draft as unsent; an epoch change could strand an in-flight draft preview. Central pending/transaction guards, deferred exit/save/import intent, authoritative restore epochs and preview invalidation were exercised by the final browser tests. Preserved screenshots have two timing caveats: the first queued capture preceded the180ms UI redraw and the recovery capture preceded the new Play label; later visible-queue evidence is the immediate-exit/continue capture. Terminal result/Retry remains below the initial right-panel fold, and the Korean command heading wraps its final syllable. These are presentation fixes queued for the next camera integration, not a claim of flawless/commercial-level completion.


## Iteration9B: current-flight inspection, NASA4K Mars and GPU generation retirement

The frozen candidate `index-TfmOhXw5.js` integrates8D remote operations, direct part inspection and the optional NASA Trek4096×2048 Mars mosaic. The initial9A functional pass revealed stale geometry/VAO disposal after restoration; its failed native proof is retained.9B retires owned old-generation registrations at loss while retaining CPU state, covering primary/room/transfer rendering and inactive resources.37 focused CPU cases passed. The real command/ACK/science/replay/Exit journey passed with three loaded4K restores; two additional strict browser cases passed nine restores and actual geometry rebuilding with zero invalid native deletions. Other driver/PMREM warnings are disclosed.

The isolated high-quality720p actual8-part craft+visible4K Mars measurement passed120.0094s, mean60.000750FPS,p9917ms and stable64/11/23 geometry/texture/program counts. Paused runtime and frozen files were unchanged. Twelve orbit drags and twelve wheels were observed. A suspected blank tool preview was checked against saved PNG pixels and independently viewed; the craft and204px Mars were present. This fixture does not replace the original1080p20-part HTTPS requirement. Private publication and its separate deployed checks remain pending at this entry. [Detailed scope and evidence](qa/milestone-5-local.md).


### Version5 private deployment

The exact9B source `8dcf0519bf8401b8f66126b48b0f1704e31e1011` was pushed and privately published as version5/deployment `appgdep_6af8d19544d88191928b1ae406497ed6`, entry `index-TfmOhXw5.js`. Actual HTTPS smoke/cold/standard checks passed:16hardwarecards,firstassembly6675.5183ms/11.8437443MiB at20Mbps/100ms,and20parts/medium1080p120.0167s at60.0009000135FPS/p9917ms. Twelve drags/twelve wheels,zero errors/longtasks,and stable125/10/18 geometry/texture/program counts. The standard stress craft retains its model warnings; no mission-success or all-device claim is made. The optional4K Mars map was not fetched onfirstassembly. Three saved screenshots were independently reviewed. [Full publication provenance, rejected9A evidence and acceptance scope](qa/milestone-5-local.md). Separate M02 work remains candidate.

## M02B / production-v6a integration

Implemented actual-epoch Mars exit corridor, authoritative bounded Worker, pointer aim/timeline, actual CG carrier/builder handoff, separate strict saves and failure recovery. Integrated original bus surface art and9Cplanet inspection. Fixed UI-safe part focus, true internal-bay drag plane and coherent save/Exit barriers. Promoted main controls and compacted the read-only flight schedule.58 files/409 tests PASS398.50s; staged Chrome13 new+4legacy cases and Edge2 passed,491 terminal fields exact. Earlier browser harness failures remain recorded. Frozen60-file build reproduced byte-for-byte in main. Publication/performance pending in [release evidence](qa/milestone-6-local.md); A/B and actual articulation remain isolated next iterations.


Version6 hosted verification completed: [release receipt](qa/milestone-6/deployment.json), [exact scope/results](qa/milestone-6-local.md#actual-hosted-version-6). ActualM02B pointer correction/fired burn, cold6.7133s/11.8672MiB, isolated120.0172s/60.0008FPS passed. A/B review and articulated deployment remain next candidates.


## Version7: actual review, redesign and hosted acceptance

Published source `e34088c6f903730d561fcbfc622f7a3c71ffe93f` adds M02B strict flight review, actual hardware diagnosis, immutable A-source preservation and real B redesign/reflight. Full main unit suite64files/449tests passed; separate Chrome/Edge complete journeys, storage-response races, denied-storage recovery and existing-mission/context regressions passed within their recorded source scopes. Rejected fixtures and harness failures remain. First strict replay still takes tens of seconds.

Actual private HTTPS correction→review→archive→unchanged paused return passed. Isolated cold readiness7.7526s/11.8152MiB;1080p20part planning scene120.0134s/60.0007500FPS/p9917.1ms, all scheduled camera gestures observed, stable resources and zero errors. [Receipt and exact limits](qa/milestone-7-local.md). Version8 deployment mechanics and keyboard placement remain isolated candidates; no commercial parity or complete original-spec claim.


## Iteration 8 — First Light and direct inspection

Resumed the authorized work on2026-11-15. The new separate commissioning mission joins actual articulated hardware, conservative swept clearance, coupled momentum and energy, onboard schedules, radio propagation and strict reconstruction to direct3D mouse repair. A fixed-wing/fairing alternative also completes through its actual state. Keyboard mounting in the existing builder shares ordinary placement validation and undo. Original hardware/transfer/swingby/review physical workers remain unchanged.

The frozen domain has69 unique passing cases across65 resumed +1 retained recovery convergence +3 retained terminal-drain cases, not one clean full batch. Main's first integrated production acceptance has17 unique UI cases across15 initial passes and two corrected-harness closure passes; real blocked guide repair, full report receipt and exact replay are included. The raw failures, native graphics audits and exact source/output manifests are preserved in [milestone8](qa/milestone-8-local.md).

Visual review drove two further changes: current orbital-frame camera tracking prevents the Earth limb drifting over the entire view, and an explicit working-face action chooses a camera view from the current PV/RF surfaces without changing physical attitude. The latter caught and fixed a nonunit direction validation defect before integration. Original internal art differentiates five equipment families inside their physical envelopes without extra textures. The fixed-wing Korean label now follows its actual component identity. The local v8b build `index-CJ7SVJJP.js` / `deployment-ui-PlZTXnvP.js` passed four scoped Chrome/Edge cases, including an actual repaired flight and exact Chrome-save→Edge physical-state reconstruction. Its isolated local cold and20-part planning measurements passed within their recorded source scope. [v8b evidence and limits](qa/milestone-8-local.md).

The initial v8b active-flight120s run passed FPS, actual physics progression and zero-error conditions but **failed its exact resource-count gate**. The first real trail legitimately changed geometry/program counts, and a separate actual-flight probe then identified repeated trail geometry/material replacement on Worker snapshots. The original failed report and attribution are retained; neither is relabelled as a pass.

Final retained-trail output is `index-BA0mrQ_m.js` / `deployment-ui-DOLz7QoT.js`, with unchanged `deployment.worker-BIezmTdy.js`. Only the deployment renderer and new retained-trail helper changed from v8b. Build and35 focused camera/scene/grab/trail CPU checks passed. One Edge integration case passed after a preserved harness-only correction excluding upload-dirty attribute.version from payload equality: actual T65s state, component pose and exact Float32 path bits survived three native restores; real orbit/wheel and1x resumption reached T74.25s with5→20 samples in the same1024-position buffer. Save/Exit retired resources with zero native errors. [CPU result](qa/milestone-8/integrated-retained-trail-results.json), [Edge acceptance and rejected attempt](qa/milestone-8/trail-native-terminal-manifest.json).

The separately declared retained-resource successor passed its isolated actual8-part flight at1080p/medium/DPR1 on Chrome157/Intel Arc130V:120.0132s,7200 intervals,60.0008000FPS,p9917ms,max18.7ms;119.75 physical seconds and564J actual motor work;12 native drags/12 wheels; zero errors/long tasks. The first visible history at T5s made exactly its declared buffer/VAO/program/shader allocations, then native lifetime counters and owned object/buffer identities stayed fixed. Six samples held82 geometries/7 textures/12 programs; final history had393 points of the720 active cap. Original FPS/physics/native-error limits were unchanged. The frozen source/bundle manifest hash was identical before/after (`b69801c757f230a6850f020297c7b5173c1f683f729050c81b0d793815a481e5`). [Unmodified final report](../tests/browser/artifacts/performance-deployment-retained/m8-retained-active-r1/chrome/report.json). This warm local flight result does not rerun v8b cold/20-part checks or establish hosted/all-device performance.

The last actual screenshots still fall short of the requested polished game presentation: flat gold walls and a pale bay dominate over small equipment, close Earth geography is soft, and full-height part/telemetry panels compete with the3D action. The next product work should improve selected-part composition and material separation, put the live objective and actual obstruction cue near the manipulated part, and make the completed repair/tradeoff visible in the debrief. This is a specific art/interaction backlog, not a claim that more passing tests establishes Mars Horizon-level quality. [Screenshot review](qa/milestone-8-local.md#visual-and-direct-interaction-review).

The original57 requirement rows and20 QA rows remain intact. ASM05 is now implemented for the demonstrated First Light devices; overall counts are15 implemented /40 partial /2 unverified, with QA5 implemented /14 partial /1 unverified. This is traceability, not a percentage of commercial-game quality. External novice study, broader content and remaining scientific/interaction scope stay open.

The private site remains version7. Publication cannot currently receive credentials through the supported hidden stdin path because Windows PTY creation fails before process launch. No source push or v8 deployment was attempted, no credential was persisted, and no OS security setting was changed. Local accepted builds and evidence are retained for a normal publication retry when the execution tool is restored.

### Version8 publication after runtime recovery

The restored Node runtime supplied a supported memory-to-stdin bridge for the normal Sites helper. Private version8 is now live from source`e0853fe9454667282ca2c90c3dede41ae28fc474`, with all70 archived dist files identical to the local reviewed build and unchanged owner-only access. Native publication succeeded on2026-11-15T09:22:21Z. New hosted browser/performance evidence is not inferred from that deployment result. The next isolated candidates address direct initial-ellipse editing, optional high-quality16K Earth imagery, compact flight UI and original surface materials.


## Version 9 local — direct ellipse manipulation and flight presentation

NAV01 now satisfies its original direct Pe/Ap/plane editing and physical propagation criterion in the local candidate. Four native Chrome user flows passed in one batch, including genuine terminal flight and exact JSON replay; all 302 frozen identities stayed unchanged. The independent scene audit found and then closed an F-key camera cancellation defect. Separate domain/GMAT and renderer evidence is preserved in [the local release record](qa/milestone-9-local.md). No blanket whole-suite or commercial quality claim is made.

Accepted Earth detail and four original PBR map sources are now integrated in the isolated candidate. The compact flight panel's final restore/cancel closure, combined graphical review, isolated sustained measurements and publication remain pending. Version 8 remains live.


9차 최종 통합은 Edge의16K/PBR/목표 UI·복구·실제 재개·자원 해제와 Chrome의120초 표준/고품질 측정을 통과했다. 최초59.8대 FPS 미달과 두 준비 단계 실패를 보존하고, 같은 제품의 한 번의 명시적 v8 대조 및 v9 교차 측정 결과를 따로 기록했다. 임계값이나 원 요구를 바꾸지 않았다. [최종 로컬 범위](qa/milestone-9-local.md).


## Version 9 private publication — 2026-11-15

Native private deployment succeeded from source `0a7932fb212ce0ddfb08e2dbca82b4a184578882`. The live site now contains independent Earth apsis/plane manipulation, strict ellipse replay, optional compressed NASA 16K Earth detail, original metal/foil shading and compact First Light objectives with reachable restoration controls. All compiled runtime/assets match the reviewed integrated candidate; three public reference JSON documents differ only in canonical line endings. [Publication receipt](qa/milestone-9/deployment.json), [complete acceptance scope and preserved failures](qa/milestone-9-local.md). This is native publication confirmation, not a new hosted browser/performance run.

The next bounded candidate adds honest previous-route comparison to M03 planning. A separate replay optimization was rejected: in a single fresh actual-Worker pair, unchanged baseline replay took42.7587s and the combined ray/corner reuse candidate48.9803s. Four binary64 output hashes matched, but it provided no demonstrated speedup. Neither the rejected optimization nor an unverified performance claim is included in version9. Original feature/QA scope, novice study and commercial-game quality remain open.


## Version 10 local acceptance — visible route consequences

Imported only four frozen NAV05 production files onto publishedv9. The new in-memory anchor and dashed heliocentric previous path expose actual arrival/TOF/C3/stage fuel/received-science changes and exact submitted-input restoration. Invalid and fuel-infeasible candidates preserve the last valid anchor; original operation definitions are replayed through the ordinary Worker. Per-route deadlines remain explicit. NAV05 stays partial for observation/contact/eclipse diffs and in-flight correction.

Integrated build passed; five focused CPU files passed48tests. All six physical Worker bundles are byte-identical to publishedv9. Actual Edge157 acceptance passed2/2 in40.508s; all305 frozen identities matched, errors/native ownership errors0, driver warnings retained. Earlier candidate9CPU/2Chrome cases and its two harness failures stay separately recorded. [Full scope](qa/milestone-10-local.md). Private publication follows; no new FPS/HTTPS measurements are implied.


Version10 native private deployment succeeded at2026-11-15 10:38:23UTC from `4c1a7829fb6c382755923ca5b30bf64925025f25`. The unchanged helper archive contains79 verified distfiles plus hosting metadata. [Publication receipt](qa/milestone-10/deployment.json). No new hosted browser/performance result is implied. Spatial witness cues remain isolated for a subsequent release.


## Version11 local acceptance — spatial repair cues

Integrated five reviewed presentation files onto accepted version10. Actual clearance-guide centers and current source/request identity drive two persistent numbered DOM labels; selection retains the exact camera/design and repair remains a real surface drag. Independent review caught and corrected persistent keyboard focus. The candidate’s incorrect unconditional resize-cancellation assertion and original failure are retained.

Integrated build and43focused CPU cases passed. The final combined Edge suite passed2/2 in59.114s with311unchanged identities, zero application/native errors and one retained driver warning. Actual direct repair/Undo, resize projection, context cleanup and live-flight exclusion passed. All6physical Workers remain byte-identical to version10. [Scope and evidence](qa/milestone-11-local.md). No new performance/hosted/full-spec claim; native publication follows.


Version11 private native deployment succeeded at2026-11-15 10:58:08UTC from `69014f57f00cb313e7c2450cec36bafa6e7f2ef8`. [Publication receipt](qa/milestone-11/deployment.json). Only task-owned QA previews5191/5193/5194/5195 were stopped after use; main5188 remains available and user desktop browsers were untouched. The separate v11 checkout completed as an unused version10 baseline; tested integration/provenance is explicitly recorded. No new hosted performance, automatic Ralph daemon or full commercial-quality completion is claimed.

## Version 12 — exploration experience reset

The user's negative playtest changes the entry and gameplay priority. The new 3D Solar campaign starts with a short fictional observation incident, supports seven planetary destinations plus ASTER-7 from Earth, and connects actual craft assembly, direct date/encounter dragging, calculated routes, destination-specific instruments, close-up sampling and a persistent illustrated journal. It preserves the old assets and separates the approximate campaign from the higher-fidelity legacy laboratories. The assembly loses redundant permanent view/inspection controls and false optical-camera selection. M03 gets an explicit calendar repair instead of retrying the same invalid 80-day route.

Build and43focused CPU cases passed. A final unchanged production preview passed8native Edge cases in116.808seconds, including complete fresh asteroid and Venus journeys, actual Venus spectrometer installation, selection/drag regression, English keyboard/Undo and pointerEscape, and Korean/English/saved M03 recovery. The first pointerEscape test found a real BODY-focus defect; its rejected run is retained and the active-lifetime key/capture fix passes the same assertions. Startup-click, moving observation-target and smaller-viewport layout defects were also corrected before final acceptance. Runtime source/build manifest contains314unchanged identities.

[Full evidence, independent advisory, failures and limitations](qa/experience-reset-release.md). This is not eight end-to-end destination runs, a human novice study, proven fun, a continuous swingby grand tour, inherited GMAT validation or commercial-quality completion. Private publication follows the bounded accepted build.

Version12 native private publication succeeded at2026-11-15T12:19:31Z from `30e8407c603d6ae815288b97d2b7bd1dbd7e7efa`. All83distfiles in the25,688,874-byte archive matched the tested output. A subsequent access read confirmed version12 and unchanged owner-only sharing. [Receipt](qa/experience-reset-deployment.json). The task-owned dev5199 process was stopped; main production preview5188 remains available. No new hosted browser/performance result is inferred from publication.

2026-11-15 · v13: replaced three-marker observations with actual mounted-aperture exposure and same-region spectral comparison; added local hyperbolic encounters, star-reference recovery, thermal safing, target tracking, single-assist route comparison, real camera JPEG records and paused journey restore. Final local candidate: 58 CPU tests and 10 native Edge integration cases passed; source/output freeze has 328 identities. Detailed bounded evidence: docs/qa/v13-expedition-release.md. Private publication receipt follows deployment.
