/** Small, offline translation layer. Simulation values and saved designs never change. */
import { translateHardwareMessage } from './hardware-i18n';
export type Language = 'ko' | 'en';
let language: Language = 'ko';
export function setLanguage(next: Language): void { language = next === 'en' ? 'en' : 'ko'; }
export function getLanguage(): Language { return language; }

const en: Record<string, string> = {
  "공유 궤도 투입은 원궤도만 지원합니다. 타원 궤도에는 전용 또는 대형 투입을 선택하세요.":"Rideshare supports circular injection only. Choose Dedicated or Heavy injection for an ellipse.",
  "타원 궤도 모드는 지구 임무에서만 지원합니다.":"Elliptical initial orbits are supported only for Earth missions.",
  "지원하지 않는 지구 초기 궤도 모델입니다.":"Unsupported initial Earth orbit model.",
  "지구 근지점·원지점 순서와 고도·경사각 범위를 확인하세요.":"Check the Earth apsis order and altitude/inclination ranges.",
  "지구 초기 궤도·RTN 계산 모델이 다릅니다.":"The initial Earth orbit / RTN model does not match.",
  "이전 결과의 지구 초기 궤도·RTN 모델 또는 점수 정의가 다릅니다.":"The previous result uses a different initial Earth orbit / RTN model or score definition.",
  "원지점 고도":"Apoapsis altitude",

  'Pe·Ap: 반경 조절 · i: 궤도면 · Esc: 취소':'Pe/Ap: radial drag · i: orbit plane · Esc: cancel',
  '3D 조립과 물리 기반 궤도 계산을 사용합니다. M03 전이 임무는 별도의 저장 슬롯을 사용합니다.':'All missions use 3D assembly and physical trajectory calculations. M03 has a separate save slot.',
  '총 임무 예산 680 크레딧':'Total mission budget: 680 credits',
  '선택한 탈출 단계의 질량·추진제·수납 제한':'Selected escape stage mass, fuel and stowage limits',
  '실제 출발·도착 날짜에 맞는 전이 궤도':'Transfer matched to actual departure and arrival dates',
  '화성 고유 분광 자료 3개를 지구 수신':'Receive 3 unique Mars spectra on Earth',
  '발전판·분광기·안테나·배터리를 3D 기체에 직접 배치하세요.':'Place solar panels, spectrometer, antenna and batteries directly on the 3D spacecraft.',
  '비행 설계에서 지구와 화성 날짜 손잡이를 끌어 전이 창을 정합니다.':'Drag the Earth and Mars date handles in flight planning to choose a transfer window.',
  '태양 거리 증가와 수개월의 순항을 버티는 발전량이 필요합니다.':'Provide enough solar power for increasing Sun distance and months of cruise.',
  '탐사선 추진제와 분리되는 탈출 단계 추진제를 따로 계산합니다.':'Spacecraft propellant and the discarded escape stage propellant are budgeted separately.',
  '출발·도착 날짜: TDB':'Departure and arrival dates: TDB',
  '언어': 'Language', '한국어': '한국어', '영어': 'English',
  '발사 기지': 'Launch complex', '임무 단계': 'Mission stages', '우주선 조립': 'Assembly', '비행 설계': 'Flight plan', '임무 운영': 'Mission control',
  '설계 저장': 'Save design', '조작 안내': 'Controls', '설정': 'Settings', '저장됨': 'Saved',
  '당신의 설계가, 다음 발견이 됩니다.': 'Your design makes the next discovery.',
  '장비를 붙이고 궤도를 그리며': 'Build your craft. Shape its orbit.',
  '하나의 과학 임무를 완성하세요.': 'Bring a science mission to life.',
  '새로운 임무': 'New mission', '계속하기': 'Continue', '실제 궤도 원리 · 직접 만드는 우주선': 'Real orbital principles · A craft you build',
  '전체 보기': 'Reset camera', '탐사선 가까이 보기': 'Focus spacecraft', '정면': 'Front view', '윗면': 'Top view', '옆면': 'Side view',
  '구조와 자원 제한을 충족합니다': 'Structure and resources are within limits',
  '작은 부품 하나가 임무의 가능성을 바꿉니다': 'Every component changes what your mission can do',
  '장비 선반': 'Hardware', '장비를 잡아 기체 표면에 놓으세요.': 'Drag hardware onto the spacecraft.',
  '전체': 'All', '과학': 'Science', '시스템': 'Systems', '전력': 'Power', '통신': 'Communications', '추진': 'Propulsion', '구조': 'Structure',
  '회전': 'Rotate', '제거': 'Remove', '삭제': 'Delete', '되돌리기': 'Undo', '다시 실행': 'Redo', '저장': 'Save',
  '과학 목표': 'Science target', '유효 데이터': 'Valid datasets', '질량 한도': 'Mass limit', '다른 임무 살펴보기': 'Explore missions',
  '부품을 선택하면': 'Select a component', '배치와 성능을 확인할 수 있습니다.': 'to inspect its placement and performance.',
  '균형 설계 불러오기': 'Load balanced design', '질량 / 소비전력': 'Mass / power draw',
  '오른쪽': 'Right', '왼쪽': 'Left', '위': 'Top', '아래': 'Bottom', '앞': 'Front', '뒤': 'Back',
  '상단 서비스 베이의 내부 장비를 노출해 보여줍니다.': 'Internal equipment is shown exposed in the upper service bay.',
  '장착면 위에서 자유롭게 이동합니다. 실제 시야·가림 판정에 이 위치가 사용됩니다.': 'Move freely across the mounting surface. Placement affects visibility and obstruction.',
  '실제 부품 사양 · 원문 비교': 'Hardware specifications · Sources',
  '우클릭': 'Right drag', '카메라 회전': 'Orbit camera', '휠': 'Wheel', '확대': 'Zoom', '드래그': 'Drag', '부품 이동': 'Move part',
  '총 질량': 'Total mass', '사용 예산': 'Budget used', '최대 발전': 'Peak power', '배터리': 'Battery', '가용 Δv': 'Available Δv',
  '비행 경로 설계': 'Plan trajectory', '부품 배치 → 비행 경로 → 임무 운영': 'Assemble → Plan → Operate',
  '중력을 이용해, 다음 목적지로': 'Let gravity take you farther', '지구를 바라보는 새로운 시선': 'A new perspective on Earth',
  '행성 접근점을 드래그해 편향각을 바꿉니다': 'Drag the approach point to change the turn angle',
  '궤도 위의 손잡이를 잡아 비행을 설계하세요': 'Shape your flight by dragging the orbital handles',
  '새로운 경로 계산 중': 'Calculating trajectory', '최신 계획 예측 완료': 'Current prediction ready', '예측을 다시 계산해 주세요': 'Recalculate the prediction',
  '최근접 고도': 'Closest altitude', '편향각': 'Turn angle', '태양 기준 속도 변화': 'Solar-frame speed gain', '접근 보정 Δv': 'Approach Δv',
  '초기 고도': 'Initial altitude', '궤도 경사각': 'Inclination', '기동 시각': 'Burn time', '계획 Δv': 'Planned Δv',
  '주황색 접근점: 위아래로 최근접 고도, 좌우로 접근 평면을 바꿉니다. 화성 기준 무한원 속력은 보존됩니다.': 'Orange approach point: drag vertically for closest altitude and horizontally for the approach plane. Hyperbolic excess speed relative to Mars is conserved.',
  '궤도 선을 클릭해 기동점을 옮기세요. Δv는 진행 방향, N은 궤도면, R은 반경 방향입니다.': 'Click the orbit to move a burn. Δv is prograde, N changes the orbital plane, and R is radial.',
  '궤도 클릭 대기': 'Click an orbit point', '기동점 추가': 'Add burn', '기동점 이동': 'Move burn', '궤도 클릭': 'Click orbit',
  '태양광 구간': 'Sunlight', '행성 그림자': 'Eclipse', '정밀 조정 · 키보드 대체 조작': 'Fine controls · Keyboard access',
  '화성 도착 전부터 시작하는 교육용 근접비행입니다. 지구 출발 전이 설계는 아직 포함하지 않습니다.': 'An educational flyby starting on approach to Mars. Earth-to-Mars transfer design is not included.',
  '점질량 중력 모델. 표시용 우주선 크기는 확대되어 있습니다.': 'Point-mass gravity model. The spacecraft is enlarged for visibility.',
  '예상 과학 성과': 'Predicted science', '기한 내 지구가 수신한 유효 데이터': 'Valid datasets received on Earth before the deadline',
  '현재 설계와 운영 일정에 따른 예측입니다.': 'Prediction based on this design and its operating schedule.',
  '배치·궤도·운영 일정을 함께 시험합니다.': 'Testing placement, trajectory, and operations together.',
  '기동 후 연료': 'Fuel after burns', '전력 최소 잔량': 'Minimum energy', '임무 시작': 'Start mission', '과학 모델 · GMAT 검증': 'Science model · GMAT validation',
  '미세 조정': 'Fine adjustment', '운영 일정': 'Operations', '일시정지': 'Paused', '재생': 'Play', '충전': 'Charge', '관측': 'Observe', '송신': 'Downlink', '기준 일정': 'Reference schedule',
  '관측과 송신 일정을 드래그하는 타임라인': 'Timeline: drag observation and downlink activities',
  '탑재된 일정은 통신이 끊겨도 실행됩니다 · Space 일시정지': 'Onboard activities continue without contact · Space to pause',
  '드래그: 이동 · 오른쪽 끝: 길이 조정 · 우클릭: 제거 · 빈 구간: 충전': 'Drag to move · Right edge to resize · Right-click to remove · Empty time charges',
  '탐사선 상태 수신 중': 'Receiving spacecraft telemetry', '기한 내 수신한 유효 데이터': 'Valid datasets received before the deadline',
  '현재 고도': 'Altitude', '속력': 'Speed', '탑재된 일정에 따라 임무를 수행합니다.': 'Executing the onboard mission schedule.',
  '임무 기록': 'Flight log', '탐사선 상태': 'Spacecraft', '발전 / 소비': 'Generation / load', '저장 데이터': 'Stored data', '통신 상태': 'Link status', '빛의 전달 시간': 'Light time', '남은 추진제': 'Propellant left',
  '충전 지시': 'Charge command', '관측 지시': 'Observe command', '송신 지시': 'Downlink command', '일정 복귀': 'Resume schedule',
  '지상 명령은 교신이 가능할 때 발송합니다.': 'Ground commands are sent when contact is available.',
  '중간 결과': 'Interim result', '기체 추적': 'Focus craft', '닫기': 'Close',
  '어떤 발견을 만들까요?': 'What will you discover?', '첫 탐사': 'First mission', '중력도움 항법': 'Gravity assist', '약 8–12분': 'About 8–12 min', '약 10–15분': 'About 10–15 min',
  '두 임무 모두 실제 3D 조립과 물리 기반 궤도 계산을 사용합니다. 새로운 임무는 저장된 현재 설계를 대체합니다.': 'Both missions use interactive 3D assembly and physics-based trajectories. Starting a mission replaces the saved current design.',
  '손으로 만드는 우주 탐사': 'Hands-on space exploration', '01 · 기체 조립': '01 · Assembly', '02 · 비행과 운영': '02 · Flight and operations',
  '장비 선반에서 부품을 끌어 기체의 평평한 표면 위에 놓습니다. 초록색은 장착 가능, 빨간색은 간섭이나 장착 제한입니다.': 'Drag a component from the library onto a flat spacecraft surface. Green means a valid mount; red means a collision or mounting restriction.',
  '왼쪽 드래그 — 부품 선택·이동': 'Left drag — select and move components', '오른쪽 드래그 — 카메라 회전': 'Right drag — orbit the camera',
  '휠 — 확대 · 중간 버튼 — 화면 이동': 'Wheel — zoom · Middle drag — pan', 'R / 회전 고리 — 회전': 'R / rotation ring — rotate',
  'Delete — 제거 · Ctrl+Z/Y — 되돌리기': 'Delete — remove · Ctrl+Z/Y — undo/redo',
  '궤도의 손잡이를 드래그하면 물리적으로 가능한 경로를 다시 계산합니다. 화성에서는 주황색 접근점으로 최근접 고도와 접근 방향을 조절합니다.': 'Drag orbital handles to recalculate a physically possible trajectory. At Mars, the orange approach point controls closest altitude and approach direction.',
  '궤도 클릭 — 기동 시각 이동': 'Click the orbit — move the burn time', 'Shift 드래그 — 정밀 조정': 'Shift + drag — fine adjustment',
  '타임라인 — 관측·송신 작업 드래그': 'Timeline — drag observation and downlink activities', '작업 오른쪽 끝 — 시간 길이 변경': 'Drag an activity’s right edge — change its duration',
  'Space — 실행 일시정지 · F — 기체 가까이': 'Space — pause/resume · F — focus the craft',
  '성공의 기준': 'What makes a mission succeed',
  '많이 찍는 것으로 끝나지 않습니다. 해상도·시야·전력 조건을 만족한 데이터를 기한 안에 지구로 전달해야 합니다. 기체의 그림자·행성 가림·통신 지연을 함께 확인하세요.': 'Capturing data is only the beginning. Meet resolution, visibility, and power requirements, then deliver the data to Earth on time. Account for spacecraft shadowing, planetary obstruction, and communication delay.',
  '실패하면 한 가지만 바꿔보세요': 'After a setback, change one thing',
  '부품 위치, 궤도, 관측과 송신 시각 중 하나를 바꾸어 같은 조건으로 다시 실행하세요. 결과 화면에서 이전 시도와 비교할 수 있습니다.': 'Change one component position, orbital setting, or activity time, then try again under the same conditions. Compare both attempts in the debrief.',
  '숫자 입력은 정밀 조정을 위한 보조 기능입니다. 주요 제작과 항법은 3D 화면에서 직접 조작합니다.': 'Numeric controls provide fine adjustment. Core assembly and navigation happen directly in the 3D view.',
  '환경 설정': 'Preferences', '그래픽 품질': 'Graphics quality', '높음': 'High', '중간': 'Medium', '낮음': 'Low',
  '인터페이스 크기': 'Interface size', '기본': 'Default', '크게': 'Large', '카메라 전환 효과': 'Camera transitions', '부드러운 전환': 'Smooth', '효과 줄이기': 'Reduced motion',
  '효과음': 'Sound effects', '켜짐': 'On', '꺼짐': 'Off', 'JSON 백업': 'Export JSON', '백업 가져오기': 'Import backup', '출처와 모델': 'Sources and model',
  '플레이는 브라우저 내부에서 계산합니다. 브라우저 저장 공간은 사용자가 삭제할 수 있으므로 중요한 설계는 JSON으로 내려받으세요.': 'The simulation runs locally in your browser. Browser storage can be cleared; export important designs as JSON backups.',
  '항법 정밀 조정': 'Fine navigation controls', '최근접 고도 km': 'Closest altitude km', '접근 궤도면 °': 'Approach plane °', '초기 고도 km': 'Initial altitude km', '경사각 °': 'Inclination °',
  '진행 기동 m/s': 'Prograde m/s', '법선 기동 m/s': 'Normal m/s', '반경 기동 m/s': 'Radial m/s', '완료': 'Done',
  '방향키로도 조절할 수 있습니다. 변경은 3D 경로와 과학 예측에 반영됩니다.': 'Arrow keys also adjust these controls. Changes update the 3D trajectory and science prediction.',
  '무엇을 계산하고 있나요?': 'What are we calculating?', '플레이 모델': 'Simulation model',
  '· 중심천체 점질량 중력, 충격 기동, 화성 무추력 쌍곡선 근접비행을 계산합니다. 전력(W)과 에너지(Wh), 전송량(bit)과 지구 수신량을 구분합니다.': '· Central-body point-mass gravity, impulsive burns, and unpowered hyperbolic Mars flybys. Power (W) is distinct from energy (Wh); transmitted bits are distinct from data received on Earth.',
  '부품은 출처에 기반한 교육용 대표 모듈입니다. 가격·구체적인 성능은 게임 가정이며 NASA 인증 부품이나 실제 임무의 성공확률을 뜻하지 않습니다.': 'Components are educational modules informed by published sources. Prices and unspecified performance are game assumptions, not NASA certification or real mission success probabilities.',
  'GMAT 교차 검증': 'GMAT cross-validation', '실행 기록을 불러오는 중입니다.': 'Loading validation records.',
  '검증 범위: 지구 궤도·화성 주변 국소 근접비행. 실제 지구 출발→화성 전이, 태양 중심 목표 도달, 전력·통신 시스템 전체를 검증했다는 뜻은 아닙니다.': 'Validation covers Earth orbits and local Mars flybys. It does not validate an Earth-to-Mars transfer, heliocentric target arrival, or the complete power and communications systems.',
  'NASA 원문': 'NASA sources', '· 목표부터 설계와 운영까지': '· From objectives to design and operations', '· 구성 요소와 제약': '· Components and constraints', '· 기준계에 따른 속도 변화': '· Speed changes between reference frames', '· 궤도 기준 생성': '· Reference trajectory generation',
  '아트': 'Art', '발사 기지·조립실·탐사선은 이 프로젝트의 독자적인 3D 에셋입니다. 지구·화성 지표는 NASA 자료를 사용합니다. Solar Smash, Mars Horizon, Juno의 에셋을 복사하지 않았습니다.': 'The launch complex, assembly bay, and spacecraft are original project assets. Earth and Mars surfaces use NASA imagery. Assets from Solar Smash, Mars Horizon, and Juno are not copied.',
  'GMAT R2026a 실제 실행 · 기준 사례 8개. 중심천체 궤도 비교 기록이 포함되어 있습니다. 상세 원시 기록은 프로젝트 docs/gmat-validation.md에서 확인할 수 있습니다.': 'GMAT R2026a was executed for 8 reference cases, with central-body trajectory comparisons. Raw records are documented in docs/gmat-validation.md.',
  'GMAT 실행 기록을 현재 불러올 수 없습니다. 검증되었다고 가정하지 않습니다.': 'GMAT execution records are unavailable. Validation is not assumed.',
  '임무를 완수했습니다': 'Mission accomplished', '발견은 다음 설계로 이어집니다': 'Every discovery informs the next design', '이번 임무에서 배운 것': 'Lessons for the next mission',
  '지구가 받은 과학 성과': 'Science received on Earth', '최소 배터리': 'Minimum energy', '설계 개선하기': 'Improve design', '다른 임무': 'Other missions',
  '수신한 관측 구역을 표면 지도로 재구성한 표시입니다. 실제 카메라 사진이 아닙니다.': 'Observation regions reconstructed from a surface map; not actual camera photographs.',
  '수신 자료의 품질과 관측 시각 · 표면 지도 기반 구역 재구성': 'Received data quality and capture time · Regions reconstructed from surface maps',
  '동일 미션 · 동일 조건': 'Same mission · Same conditions', '이전 설계': 'Previous design', '이번 설계': 'Current design', '유효 수신 자료': 'Valid received data', '남은 예산': 'Budget left',
  '과학 성과 60 · 임무 달성 25 · 자원 여유 15 — 출처와 모델 가정이 있는 교육용 평가입니다.': 'Science 60 · Objectives 25 · Resource margin 15 — an educational score with documented sources and assumptions.',
  '교신 가능': 'Contact available', '교신 대기': 'Awaiting contact', '행성 그림자 · 발전 중단': 'Eclipse · Solar generation stopped', '태양광 수신 중': 'Receiving sunlight',
  '안전 모드': 'Safe mode', '과학 관측 중': 'Observing', '데이터 송신 중': 'Downlinking', '태양 지향': 'Sun pointing', '태양 지향 · 충전': 'Sun pointing · Charging',
  '이 회전은 다른 부품과 간섭합니다.': 'This rotation conflicts with another component.',
  '설계 제한과 최신 예측을 먼저 확인해 주세요.': 'Check design constraints and obtain a current prediction first.',
  '발사 장면 건너뛰기 →': 'Skip launch →',
  '탐사선이 임무를 시작했습니다. Space 키로 멈추고 상황을 살펴보세요.': 'Mission started. Press Space to pause and inspect the situation.',
  '비행 설계에서 계획을 검토한 후 임무를 시작하세요.': 'Review the flight plan before starting the mission.',
  '검증용 예시 설계를 불러왔습니다. 장비와 일정을 자유롭게 바꿔보세요.': 'Reference design loaded. Experiment with its hardware and schedule.',
  '지상 명령이 등록되었습니다. 교신과 전파 지연 뒤 탐사선에 도착합니다.': 'Ground command queued. It reaches the craft after contact and light-time delay.',
  '설계와 임무 상태를 이 브라우저에 저장했습니다.': 'Design and mission state saved in this browser.',
  '저장 공간에 접근할 수 없습니다. 설정에서 JSON 백업을 내려받으세요.': 'Storage is unavailable. Export a JSON backup from Settings.',
  '저장된 임무를 불러왔습니다.': 'Saved mission loaded.', '아직 저장된 임무가 없습니다.': 'No mission has been saved yet.', '저장 내용을 읽지 못했습니다.': 'Could not read the saved mission.',
  'JSON 백업을 내려받았습니다.': 'JSON backup downloaded.', '백업을 검증하고 불러왔습니다.': 'Backup validated and loaded.', '유효하지 않은 파일입니다.': 'Invalid file.',
  '다른 탭으로 이동해 임무를 일시정지했습니다.': 'Mission paused while this tab was inactive.',
  '연결이 끊겼지만 로드한 임무는 이 브라우저에서 계속 실행됩니다.': 'Connection lost. The loaded mission can continue in this browser.',
  '놓아서 장착': 'Release to attach', '장착할 수 없는 위치': 'Invalid mounting position',
  '그래픽 컨텍스트가 중단되어 임무를 멈췄습니다. 복구 후 재생할 수 있습니다.': 'Graphics context lost; mission paused. Resume after graphics recover.',
  '궤도 계산 작업이 중단되었습니다. 새로고침 또는 저장 후 다시 시도하세요.': 'Trajectory worker stopped. Save and retry, or reload the page.',
  '3D 공간을 준비하지 못했습니다.': 'Could not initialize the 3D environment.',
  'Chrome 또는 Edge에서 WebGL 2와 그래픽 가속을 확인해 주세요.': 'Check WebGL 2 and hardware acceleration in Chrome or Edge.',
  '다시 시도': 'Retry', '탐사를 위한 공간을 준비하고 있습니다': 'Preparing your mission environment', '3D 엔진 초기화': 'Initializing the 3D engine',
  '브라우저 저장에 실패했습니다. JSON 백업으로 현재 설계를 보관할 수 있습니다.': 'Browser save failed. Export a JSON backup to preserve this design.',
  '예측 계산이 지연되었습니다. 계획을 다시 조정하거나 새로 계산해 주세요.': 'Prediction timed out. Adjust the plan or recalculate.',
  '실행 후 부품 변경은 결과의 재설계를 사용하세요.': 'Use Improve design in the debrief to change hardware after launch.',
  '실행 중에는 탑재된 일정만 확인합니다. 재설계에서 경로를 수정할 수 있습니다.': 'During flight, the onboard schedule is read-only. Revise the trajectory after choosing Improve design.',
  '부품 선반에서 장비를 잡아 기체 표면으로 끌어보세요. 오른쪽 드래그로 뒷면을 볼 수 있습니다.': 'Drag hardware from the library onto the craft. Right-drag to view its other sides.',
  'TSP-45W 태양전지': 'TSP-45W solar wing', '6날개 전력 어레이': 'Six-wing power array', 'BPX 100 Wh 배터리': 'BPX 100 Wh battery',
  '태양전지 날개': 'Solar wing', '확장 태양전지': 'Extended solar array', '광학 카메라': 'Optical camera', '분광 관측기': 'Spectrometer', '지향성 안테나': 'High-gain antenna', '배터리 모듈': 'Battery module', '궤도 보정 엔진': 'Maneuver thruster', '기록장치': 'Data recorder', '방열판': 'Radiator',
  '학습용 대표 부품. 아래 수치는 게임 설계값이며 특정 제조사 제품의 인증 사양이 아닙니다.': 'Representative educational component. Values are game assumptions, not certified specifications of a manufacturer’s product.',
  'GomSpace 공개값: 총질량 0.885 kg, 수명초기 정면 최대 45 W. 장착 형상과 크레딧은 게임 설정입니다.': 'Published by GomSpace: 0.885 kg total mass, up to 45 W at beginning of life and normal incidence. Mount geometry and credits are game assumptions.',
  '45 W 날개 6개의 합산 설계: 최대 270 W, 날개 5.31 kg + 가정 장착구 0.40 kg. 실재 단일 상품이 아닙니다.': 'Derived six-wing assembly: up to 270 W, 5.31 kg of wings plus an assumed 0.40 kg mount. This is not a single commercial product.',
  '선명한 지표 관측을 위한 카메라. 본체 -Z 방향에 배치하면 관측 자세에서 목표를 봅니다.': 'A camera for surface imaging. Mount on the −Z face to view the target in observation attitude.',
  '화성 표면의 분광 자료를 수집합니다. 본체 -Z 방향으로 장착하세요.': 'Collects spectra of the Martian surface. Mount on the −Z face.',
  '수집한 자료를 지구로 전송합니다. 송신 자세에서는 본체 +Z 방향이 지구를 향합니다.': 'Sends collected data to Earth. In downlink attitude, the +Z face points toward Earth.',
  '4S-2P 제조사 공개 질량 0.500 kg, 정격 100 Wh. 게임은 권장 운용 범위의 86 Wh를 사용합니다.': 'Manufacturer’s 4S-2P values: 0.500 kg, 100 Wh nominal. The game uses the 86 Wh recommended operating range.',
  '비추력 230 s인 학습용 화학추진기. 본체 -Y 중앙에 장착하며 한정된 추진제를 사용합니다.': 'Educational chemical thruster with 230 s specific impulse. Mount at the center of the −Y face; propellant is limited.',
  '1.6 Gbit 저장 공간. 교신이 끊겨도 기존 관측 자료를 보관합니다.': '1.6 Gbit storage. Retains captured observations while contact is unavailable.',
  '열 설계를 위한 외장 부품. 현재 버전은 기하학적 간섭과 질량만 계산하고 상세 열전달은 다루지 않습니다.': 'External thermal-control component. This version evaluates geometry and mass, not detailed heat transfer.',
  '푸른 행성의 기록': 'Chronicles of the Blue Planet', '붉은 행성의 도움닫기': 'A Boost from the Red Planet',
  '지구의 북반구 육지와 해안선을 관측하고, 유효한 사진 네 장을 지상국으로 돌려보내세요.': 'Observe northern land and coastlines, then return four valid images to a ground station.',
  '화성에 접근 중인 탐사선을 완성하고, 중력 도움으로 출구 궤적을 바꾸며 화성의 분광 자료를 지구로 전송하세요.': 'Complete a spacecraft approaching Mars, reshape its departure with a gravity assist, and send Martian spectra to Earth.',
  '북반구 관측 회랑': 'Northern observation corridor', '화성 근접 분광 관측': 'Close-range Mars spectroscopy',
  '3시간 이내 고유 사진 4장 수신': 'Receive four unique images within three hours', '안전 고도 180 km 이상': 'Safe altitude of at least 180 km',
  '최근접 고도 250 km 이상': 'Closest altitude of at least 250 km', '태양 기준 속력 증가 1 km/s 이상': 'Heliocentric speed gain of at least 1 km/s', '분광 자료 3개를 기한 내 지구 수신': 'Receive three spectra on Earth before the deadline',
  '광학 카메라를 -Z 면에, 안테나를 +Z 면에 부착하세요.': 'Mount the optical camera on −Z and the antenna on +Z.',
  '태양전지 패널은 +X 방향에서 햇빛을 잘 받습니다.': 'Solar panels receive favorable sunlight on the +X side.',
  '궤도 경사각과 기동으로 관측 기회를 조정하세요.': 'Adjust inclination and burns to shape observation opportunities.',
  '관측 후 교신창에 송신을 예약하세요.': 'Schedule downlinks in contact windows after observing.',
  '화성 접근 상태에서 시작하는 교육용 조우 임무입니다.': 'An educational encounter that begins on approach to Mars.',
  '접근 고도와 B-plane 각도를 드래그해 출구 방향을 조정하세요.': 'Drag approach altitude and B-plane angle to adjust the departure direction.',
  '분광 관측기를 -Z 면에 장착하세요.': 'Mount the spectrometer on the −Z face.',
  '최근접 약 2시간 30분 전후에 관측하고, 광속 지연을 고려해 송신하세요.': 'Observe around closest approach, about 2 h 30 min into the mission, and account for light-time delay when downlinking.',
  '장착판의 경계를 벗어났습니다.': 'Outside the mounting surface boundary.', '내부 모듈은 상단 서비스 베이에 넣으세요.': 'Place internal modules in the upper service bay.',
  '엔진은 -Y 면 중심 반경 0.16 m 안에 장착하세요.': 'Mount the thruster on −Y within 0.16 m of the face center.',
  '발사체의 질량 한도를 초과했습니다.': 'Launch mass limit exceeded.', '안테나가 없어 지상에 자료를 보낼 수 없습니다.': 'No antenna: data cannot be sent to Earth.',
  '발전 장비가 없어 배터리만으로 운용합니다.': 'No generator: operation relies on battery energy alone.',
  '계획한 기동에 필요한 Δv가 가용량을 초과합니다.': 'Planned burn Δv exceeds the available capability.',
  '화성 최근접 고도가 250 km 안전 한계보다 낮습니다.': 'Mars closest altitude is below the 250 km safety limit.',
  '지원하는 초기 고도는 180~2,000 km입니다.': 'Supported initial altitude: 180–2,000 km.',
  '기동 뒤 예상 근지점 고도가 180 km 안전 한계 아래입니다.': 'Predicted post-burn perigee is below the 180 km safety limit.',
  '기동 노드 ID가 중복됩니다.': 'Maneuver node IDs must be unique.', '기동 시각이 임무 기간을 벗어났습니다.': 'Burn time is outside the mission duration.',
  '궤도의 원하는 위치를 클릭해 새 기동점을 추가하세요.': 'Click the desired point on the orbit to add a maneuver.', '기동점은 최대8개입니다.': 'You can add up to 8 maneuver nodes.',
  '작업 시간이 겹칩니다. 타임라인에서 분리하세요.': 'Activities overlap. Separate them on the timeline.', '배터리가 소진되면 안전 모드로 전환합니다.': 'Low battery energy triggers safe mode.',
  '탐사선이 초기 궤도에 투입되었습니다.': 'Spacecraft inserted into its initial trajectory.', '임무 중단': 'Mission stopped',
  '배터리 회복을 위한 안전 모드': 'Safe mode to recover battery energy', '관측기가 없습니다.': 'No science instrument installed.',
  '관측기가 목표를 향하지 않거나 가려져 있습니다.': 'Instrument is obstructed or not pointing at the target.', '과학 관측 회랑 밖입니다.': 'Outside the science observation corridor.',
  '거리가 멀어 요구 품질을 충족하지 못합니다.': 'Range is too great to meet the required data quality.', '유효한 고유 관측 자료 수집 중': 'Collecting valid, unique science data',
  '안테나가 없습니다.': 'No antenna installed.', '천체 뒤편 / 지상국 비가시': 'Planetary obstruction / ground station not visible', '안테나 지향 또는 가림 문제': 'Antenna pointing or obstruction problem',
  '링크 여유가 부족합니다.': 'Insufficient link margin.', '자료를 지상으로 전송 중': 'Transmitting data to Earth', '일식: 배터리로 운영합니다.': 'Eclipse: running on battery energy.', '태양 지향 자세로 충전합니다.': 'Charging in Sun-pointing attitude.',
  '탑재된 일정 실행 중': 'Executing onboard schedule', '진행 중인 임무에만 새 명령을 보낼 수 있습니다.': 'Commands can only be sent during an active mission.',
  '지원하지 않는 명령입니다.': 'Unsupported command.', '명령 지속 시간은 5~7,200초여야 합니다.': 'Command duration must be 5–7,200 seconds.', '한 임무에서 명령은 최대 128개까지 보낼 수 있습니다.': 'A mission supports up to 128 ground commands.',
  '지상국에서 송신 가능한 자세와 교신창을 기다립니다.': 'Waiting for suitable attitude and a ground-station contact window.',
  '지상 명령의 운용 구간 종료 · 탑재 일정을 재개합니다.': 'Ground-command interval ended · Resuming onboard schedule.',
  '전파가 탐사선으로 이동 중입니다.': 'The signal is traveling toward the spacecraft.', '안전 모드: 탑재 자율 복구를 기다립니다.': 'Safe mode: awaiting onboard autonomous recovery.',
  '지상국/행성 가림: 지상 큐에서 기다립니다.': 'Ground station / planet obstructed: waiting in the ground queue.',
  '수신 안테나 지향·링크 조건이 맞지 않아 지상 큐에서 기다립니다.': 'Waiting on the ground for receiver pointing and link conditions.',
  '도착 시각의 가시성·지향·수신 전력 조건을 잃었습니다. 다시 보내야 합니다.': 'Visibility, pointing, or receiver power was lost at arrival. Resend the command.',
  '탐사선이 명령을 수신해 실행했습니다.': 'Spacecraft received and executed the command.',
  '요구 전력이 배터리 출력 한도를 넘어 안전 모드로 전환합니다.': 'Demand exceeds battery output capability; entering safe mode.',
  '기동 추진제가 부족합니다.': 'Insufficient propellant for the maneuver.',
  '배터리 임계치: 과학 관측과 송신을 중단하고 태양을 향합니다.': 'Battery critical: stopping science and downlink to point toward the Sun.',
  '충전 회복: 예약된 임무를 재개합니다.': 'Battery recovered: resuming scheduled activities.',
  '경로가 안전 표면을 침범했습니다.': 'Trajectory crossed the safety surface.', '행성 그림자 진입 · 태양발전 중지': 'Entered eclipse · Solar generation stopped', '행성 그림자 이탈 · 태양발전 회복': 'Exited eclipse · Solar generation restored',
  '기록장치 포화: 기존 자료를 보존하고 새 관측을 중단합니다.': 'Recorder full: preserving stored data and stopping new observations.',
  '수신 시각의 가시성 조건을 잃어 미확인 자료를 다음 교신 때 재전송합니다.': 'Visibility was lost at arrival. Unconfirmed data will be retransmitted during the next contact.',
  '임무 기한 도달 · 수신 자료와 항법 성과를 평가합니다.': 'Mission deadline reached · Evaluating received data and navigation.',
  '진행 시간은 0 이상의 유한한 초여야 합니다.': 'Advance time must be a finite, nonnegative number of seconds.',
  '임무에 맞는 과학 관측기를 -Z 면에 장착하세요.': 'Mount the mission’s science instrument on the −Z face.', '+Z 면에 지향성 안테나를 추가하세요.': 'Add a high-gain antenna on the +Z face.',
  '관측 뒤 더 긴 송신 구간을 확보하고 지상국 교신창을 확인하세요.': 'Allow longer downlinks after observation and check ground-station contact windows.',
  '관측기를 -Z 방향에 노출시키고 관측 회랑에 맞춰 작업 시간을 옮기세요.': 'Expose the instrument toward −Z and align activity times with the observation corridor.',
  '필수 항법·안전 조건 미충족': 'Required navigation or safety conditions not met',
  '최근접 250 km 이상, B-plane 각도 0° 부근에서 출구 속력 증가를 확인하세요.': 'Keep closest altitude at least 250 km and check departure speed gain near a 0° B-plane angle.',
  '궤도 고도와 기동 크기를 줄여 안전한 경로를 확보하세요.': 'Adjust orbital altitude and reduce maneuver magnitude to obtain a safe trajectory.',
  '배터리 부족으로 임무가 중단된 구간이 있습니다.': 'Low battery energy interrupted some mission activities.',
  '태양전지 위치, 배터리 용량, 충전 작업 구간을 조정하세요.': 'Adjust solar-panel placement, battery capacity, and charging intervals.',
  '필수 과학 자료를 기한 내 지구로 전달하고 항법 조건을 충족했습니다.': 'Required science data reached Earth on time and navigation conditions were met.',
  '임무 성공': 'Mission successful', '부분 성과 확보': 'Partial success', '다음 설계를 위한 기록': 'Lessons for the next design',
  '접촉 판정 · 임무 중단': 'Contact detected · Mission stopped', '근접 통과 · 분리 기준 충족': 'Close approach · Separation target met',
  '근접 통과 · 훈련 분리 기준 미달': 'Close approach · Training separation target not met',
  '탑재 일정 복귀': 'Resume onboard schedule', '관측 사진': 'Observation image', '분광 자료': 'Spectrum',
  '두 궤적의 분리 거리가 교육용 접촉 경계 20 m 미만입니다.': 'Trajectory separation is below the educational contact threshold of 20 m.',
  '훈련 분리 기준 충족': 'Training separation target met', '2 km 훈련 분리 기준 미달, 자동 충돌 아님': 'Below the 2 km training target; this does not automatically imply a collision',
  '교육용 궤도 잔해 접촉 판정으로 임무가 중단되었습니다.': 'Mission stopped by contact detection in the educational debris scenario.',
  '잔해 근접 통과 이전의 중간 결과입니다.': 'Interim result before the debris close approach.',
  '근접 통과보다 충분히 이른 작은 법선 기동을 만들고, 전체 궤적의 최소 거리를 다시 확인하세요.': 'Add a small normal burn well before the close approach, then recheck minimum separation along the entire trajectory.',
  '최근접 250 km 이상, 접근 궤도면 각도 0° 부근에서 출구 속력 증가를 확인하세요.': 'Keep closest altitude at least 250 km and check departure speed gain near a 0° approach-plane angle.',
  '궤도 잔해 훈련은 지구관측 임무에서만 사용할 수 있습니다.': 'The orbital-debris exercise is available only in the Earth observation mission.',
  '알 수 없는 우주 환경 시나리오입니다.': 'Unknown space-environment scenario.',
  '제조사 조건: BOL, 태양 플럭스 1367 W/m²에서 약 45 W/wing.': 'Manufacturer conditions: beginning of life, approximately 45 W per wing at a solar flux of 1367 W/m².',
  '자세·온도·열화에 따라 실제 출력이 달라집니다. 게임은 입사각·그림자·거리만 계산합니다.': 'Actual output varies with attitude, temperature, and degradation. The game evaluates incidence angle, shadowing, and distance only.',
  '추적 구동기 소비전력은 공개 단일값 미확인. 게임은 고정 패널과 전체 기체 자세를 모델링합니다.': 'No verified scalar tracking-drive consumption is available. The game models fixed panels and whole-spacecraft attitude.',
  '3D 형상·장착 크기·가격은 실물 CAD 또는 제조사 가격이 아닙니다.': 'Mesh geometry, mounting dimensions, and credits are not physical CAD or manufacturer prices.',
  '출력 = 6 × 45 W, 날개 질량 = 6 × 0.885 kg.': 'Output = 6 × 45 W; wing mass = 6 × 0.885 kg.',
  '장착구 질량 0.40 kg, 전체 형상·크레딧은 게임 가정입니다.': 'The 0.40 kg mount mass, complete geometry, and credits are game assumptions.',
  '제조사가 검증한 6날개 통합 시스템이나 실물 제품으로 표시하지 않습니다.': 'This is not presented as a manufacturer-validated six-wing integrated system or physical product.',
  'DS1076870 rev1.1.0 (2026-04-21), 4S-2P 구성.': 'DS1076870 rev1.1.0 (2026-04-21), 4S-2P configuration.',
  '§1.2의 권장 범위 86 Wh를 보수적으로 사용. 전압 조건별 표의 87/89 Wh와 혼합하지 않습니다.': 'The game conservatively uses the 86 Wh recommended range in §1.2, without blending it with voltage-dependent 87/89 Wh table values.',
  '충전 한도 25 W, 방전 한도 60 W, 효율·대기 전력·크레딧·장착 형상은 게임의 EPS 정책입니다.': 'Charge limit 25 W, discharge limit 60 W, efficiency, standby draw, credits, and mounting geometry are game EPS assumptions.',
  '히터가 켜졌을 때의 6 W는 상시 소비로 합산하지 않습니다.': 'The 6 W heater-on draw is not counted as continuous consumption.',
  '3D 우주선과 궤도 편집 화면. 오른쪽 드래그로 회전, 휠로 확대합니다.': '3D spacecraft and trajectory editor. Right-drag to orbit; scroll to zoom.',
  '조립실': 'Assembly bay', '지구 표면': 'Earth surface', '화성 표면': 'Mars surface', '구름층': 'Cloud layer', '지구 야간': 'Earth night lights',
  '발전': 'Power', '시야': 'Visibility', '교신': 'Contact', '노란 태양 손잡이를 드래그해 입사각을 바꾸세요.': 'Drag the yellow Sun handle to change the incidence angle.',
  '관측기를 뒤쪽 −Z 면에 놓으세요': 'Place the instrument on the rear −Z face', '태양전지를 오른쪽 +X 면에 놓으세요': 'Place a solar wing on the right +X face',
  '안테나를 앞쪽 +Z 면에 놓으세요': 'Place the antenna on the front +Z face', '첫 설계 길잡이 · 권장 배치': 'First-design guide · Suggested placement', '그 면 보기': 'View this face',
  '내부 베이': 'Service bay', '복제': 'Duplicate', '자원 곡선': 'Resource curves', '자세 전환 중': 'Reorienting', '자세 지향 완료': 'Attitude acquired',
  '검사 종료': 'Close inspection', '임무 요구와 설계 안내': 'Mission requirements and design guide', '지역 정밀 관측': 'Precision regional observation', '광역 지표 조사': 'Wide-area surface survey',
  '교육용 임무': 'Educational mission', '비용 단위는 게임 크레딧입니다.': 'Costs are expressed in game credits.',
  '선택한 작은 지역 전체를 요구 공간 해상도로 한 번 관측할 수 있는가?': 'Can you observe the entire selected small region once at the required spatial resolution?',
  '선택한 넓은 지역에서 서로 다른 지표 구획 네 곳의 자료를 받을 수 있는가?': 'Can Earth receive data from four distinct surface cells within the selected broad region?',
  '북반구 육지와 해안의 고유 관측 자료를 지상으로 전달할 수 있는가?': 'Can you return unique observations of northern land and coastlines to Earth?',
  '지원하지 않는 과학 목표 유형입니다.': 'Unsupported science target profile.', '목표 위도·경도 범위를 확인하세요.': 'Check the target latitude and longitude ranges.',
  '유효한 지구 중심 위치·시각이 필요합니다.': 'A valid Earth-centered position and time are required.', '센서 반각은 0도 초과 90도 미만이어야 합니다.': 'Sensor half-angle must be greater than 0° and less than 90°.',
  '고도와 개구 가시율은 유한한 값이어야 합니다.': 'Altitude and aperture visibility must be finite values.',
  '공유 궤도 투입': 'Rideshare injection', '전용 궤도 투입': 'Dedicated injection', '대형 탐사선 투입': 'Heavy spacecraft injection',
  '낮은 크레딧으로 정해진 중경사 궤도 범위에 투입합니다.': 'A lower-cost injection into a fixed range of moderate-inclination orbits.',
  '더 많은 크레딧으로 관측 지역에 맞는 고도와 궤도면을 고릅니다.': 'Spend more credits to choose altitude and orbital plane for your observation region.',
  '큰 페어링과 더 높은 질량 한도를 제공하지만 예산을 많이 사용합니다.': 'A larger fairing and higher mass limit, at a greater budget cost.',
  '게임 크레딧 · 실제 발사 가격 아님': 'Game credits · Not real launch prices', '지원하지 않는 발사 패키지입니다.': 'Unsupported launch package.',
  '내부 베이를 열어 기체 안의 장비를 배치합니다. 비행 중에는 외피가 닫힙니다.': 'Open the service bay to arrange internal equipment. The outer shell closes during flight.',
  '마우스로 복제 부품을 옮긴 뒤 클릭하여 놓으세요. Escape로 취소합니다.': 'Move the duplicate with the mouse, then click to place it. Press Escape to cancel.',
  '관측기': 'Science instrument', '안테나': 'Antenna', '초록: 보임 · 노랑: 일부 가림/낮은 입사각 · 빨강/×: 가림 또는 방향 불일치 · 파랑: 장비 법선': 'Green: clear · Yellow: partial obstruction / low incidence · Red / ×: blocked or misaligned · Blue: instrument normal',
  '근접접근 훈련 켜짐': 'Close-approach exercise on', '근접접근 훈련 추가': 'Add close-approach exercise',
  '태양전지 날개를 장착하면 실제 입사각과 자기 그림자에 따른 발전량을 확인할 수 있습니다.': 'Install solar wings to inspect generation at the actual incidence angle with self-shadowing.',
  '관측 기준 −Z': 'Observation reference −Z', '지구 기준 +Z': 'Earth reference +Z',
  '관측기를 장착하면 기준 방향의 시야와 가림을 확인할 수 있습니다.': 'Install an instrument to inspect visibility and obstruction toward the reference direction.',
  '안테나를 장착하면 기준 방향의 시야와 가림을 확인할 수 있습니다.': 'Install an antenna to inspect visibility and obstruction toward the reference direction.',
  '고도': 'Altitude', '궤도면': 'Orbital plane', '접근점': 'Approach point', '기록 없음': 'No record', '× 가속': '× speed', '계획 계산 실패:': 'Plan calculation failed:',
  '실제 부품과 설계 근거': 'Hardware and design sources', '전체 질량': 'Total mass', '날개 최대 출력': 'Peak wing power', '질량': 'Mass', '정격 저장 에너지': 'Nominal stored energy',
  '권장 범위 에너지': 'Recommended energy range', '송신 DC 소비전력': 'Transmit DC power draw', 'RF 출력': 'RF output', '최대 신호 전송률': 'Maximum signal rate', '안테나 이득': 'Antenna gain', 'RF 입력 허용': 'Maximum RF input', '질량 상한': 'Mass upper bound', '반전력 빔 폭': 'Half-power beamwidth',
  '실제 하드웨어의 공개 사양과 게임 모듈을 비교합니다. 제조사가 공개한 값이며 독립 성능 시험이나 NASA 인증을 뜻하지 않습니다. 크레딧은 실제 구매 가격이 아닙니다.': 'Compare published hardware specifications with game modules. These are manufacturer-published values, not independent test results or NASA certification. Credits are not purchase prices.',
  '제품 설명': 'Product description', '전체 출처 데이터': 'Full source dataset', '원문 조건·단위·차이·계산식:': 'Original conditions, units, differences, and derivations:',
  '이 부품의 개별 제조사 수치는 아직 데이터베이스에 연결되지 않았습니다. 게임에 표시된 대표 사양을 실물 제품의 보증 성능으로 해석하지 않습니다.': 'No individual manufacturer specification is linked for this module yet. Representative game values are not guaranteed real-product performance.',
  '객체 형식이 아닙니다.': 'Expected an object.', '지원하지 않는 필드가 있습니다.': 'Unsupported fields are present.', '지원하지 않는 설계 버전입니다.': 'Unsupported design version.',
  '알 수 없는 임무입니다.': 'Unknown mission.', '우주선 이름': 'Spacecraft name', '시드': 'Seed', '부품 ID': 'Component ID', '장착 U': 'Mount U', '장착 V': 'Mount V',
  '부품 목록을 확인하세요.': 'Check the component list.', '부품 ID가 비어 있거나 중복됩니다.': 'Component IDs are empty or duplicated.', '알 수 없는 부품입니다.': 'Unknown component.', '장착 면을 확인하세요.': 'Check the mounting face.',
  '작업 목록을 확인하세요.': 'Check the activity list.', '기동 노드는 최대 12개입니다.': 'At most 12 maneuver nodes are supported.', '기동 ID': 'Maneuver ID', '기동 ID가 비어 있거나 중복됩니다.': 'Maneuver IDs are empty or duplicated.',
  '진행 기동': 'Prograde burn', '반경 기동': 'Radial burn', '법선 기동': 'Normal burn', '작업 ID': 'Activity ID', '작업 ID가 중복됩니다.': 'Activity IDs are duplicated.',
  '알 수 없는 작업입니다.': 'Unknown activity.', '작업 시작': 'Activity start', '작업 끝': 'Activity end', '작업 끝은 시작 이후여야 합니다.': 'Activity end must follow its start.', '궤도 고도': 'Orbital altitude', '경사각': 'Inclination', '접근 각도': 'Approach angle',
  '명령 이력을 확인하세요.': 'Check command history.', '알 수 없는 지상 명령입니다.': 'Unknown ground command.', '명령 요청 시각': 'Command request time',
  '명령 시각 순서가 올바르지 않습니다.': 'Command times are out of order.', '명령 길이': 'Command duration', '명령 길이 경계가 올바르지 않습니다.': 'Command duration is not aligned to valid boundaries.',
  '종료된 실행에 새 명령이 있습니다.': 'A command was added after the run ended.', '파일이 2 MB 한도를 초과합니다.': 'File exceeds the 2 MB limit.', '올바른 JSON이 아닙니다.': 'Invalid JSON.',
  '호환되지 않는 게임 또는 모델 버전입니다.': 'Incompatible game or model version.', '저장 시각': 'Save time', '저장 시각이 올바르지 않습니다.': 'Invalid save timestamp.',
  '부품 사양·전력 모델이 1.1로 갱신되었습니다. 설계는 복원했으며 이전 모델의 실행·점수는 재계산을 위해 초기화했습니다.': 'Component specifications and the power model were updated to 1.1. Your design was restored; the earlier run and score were reset for recalculation.',
  '실행 모델 버전이 다릅니다.': 'Run model version differs.', '저장 설계와 실행 설계가 다릅니다.': 'Saved design differs from the run design.', '실행 시간': 'Elapsed time', '미처리 시간': 'Unprocessed time',
  '실행 시간이 체크포인트 경계가 아닙니다.': 'Elapsed time is not on a checkpoint boundary.', '임무 상태가 재현 결과와 다릅니다.': 'Mission status differs from replay.', '기동 실행 이력이 재현 결과와 다릅니다.': 'Burn history differs from replay.',
  '결과 평가 시각': 'Evaluation time', '결과 평가 시각이 체크포인트 경계가 아닙니다.': 'Evaluation time is not on a checkpoint boundary.', '이전 결과가 재현 결과와 다릅니다.': 'Previous result differs from replay.',
  '브라우저 저장소를 사용할 수 없습니다. JSON 백업을 다운로드하세요.': 'Browser storage unavailable. Download a JSON backup.', '저장소 접근에 실패했습니다.': 'Could not access storage.',
  '저장 공간이 부족합니다. JSON 백업을 사용하세요.': 'Storage is full. Use a JSON backup.', '저장 트랜잭션이 취소되었습니다.': 'Save transaction was canceled.',
};

type Rule = readonly [RegExp, (...groups: string[]) => string];
const rules: Rule[] = [
  [/^기체 예산 ([\d.]+) 크레딧 초과$/, n => `Spacecraft budget exceeded by ${n} credits`],
  [/^탈출 단계 탑재 질량 ([\d.]+) kg 초과$/, n => `Escape stage payload limit of ${n} kg exceeded`],
  [/^(.+) 드래그하여 장착$/, name => `${translate(name)} — drag to attach`],
  [/^([\d,.]+) kg 이내$/, value => `Up to ${value} kg`],
  [/^이전 시도 대비 ([+−\-\d,.]+)점$/, value => `${value} points versus the previous attempt`],
  [/^([\d,.]+)× 가속$/, value => `${value}× speed`],
  [/^(charge|observe|downlink) (.+) · 우클릭으로 제거$/, (kind, range) => `${({charge:'Charge',observe:'Observe',downlink:'Downlink'} as Record<string,string>)[kind]} ${range} · Right-click to remove`],
  [/^(.+) 준비 완료 · (\d+) \/ (\d+)$/, (label, done, total) => `${translate(label)} ready · ${done} / ${total}`],
  [/^계획 계산 실패: (.+)$/, reason => `Plan calculation failed: ${translate(reason)}`],
  [/^이 부품은 최대 (\d+)개까지 장착할 수 있습니다\.$/, count => `You can install up to ${count} of this component.`],
  [/^(.+)의 전개 형상과 간섭합니다\.$/, name => `Intersects the deployed geometry of ${translate(name)}.`],
  [/^예산 ([\d,.]+) 크레딧 초과$/, amount => `Budget exceeded by ${amount} credits`],
  [/^예산 ([\d,.]+) 크레딧$/, amount => `Budget: ${amount} credits`],
  [/^발사 질량 ([\d,.]+) kg 이하$/, amount => `Launch mass at most ${amount} kg`],
  [/^(.+)가 없어 과학 자료를 만들 수 없습니다\.$/, instrument => `No ${translate(instrument).toLowerCase()}: science data cannot be collected.`],
  [/^실제 엔진 추력선과 질량중심 간 거리 ([\d.]+) m가 버스의 0\.18 m 허용값을 초과합니다\.$/, distance => `Thrust-line offset from the center of mass is ${distance} m, exceeding the bus limit of 0.18 m.`],
  [/^진입점 표적화 기동 ([\d.]+) m\/s · 추진제 ([\d.]+) kg$/, (dv, fuel) => `Approach targeting burn ${dv} m/s · Propellant ${fuel} kg`],
  [/^지상 명령 실행 중 · ([\d.]+) s 남음$/, seconds => `Ground command active · ${seconds} s remaining`],
  [/^명령 (\d+)개 대기·전파 중$/, count => `${count} command(s) queued or in transit`],
  [/^(탑재 일정 복귀|관측|송신|충전) 명령을 지상 송신 큐에 추가했습니다\.$/, kind => `${operationName(kind)} command added to the ground queue.`],
  [/^(.+) 송신 · 편도 지연 ([\d.]+) s$/, (id, seconds) => `${id} sent · One-way delay ${seconds} s`],
  [/^(.+) 수신 실패 · 신호는 우주에서 대기하지 않습니다\.$/, id => `${id} reception failed · Signals do not wait in space.`],
  [/^(.+) 수신 · (탑재 일정 복귀|관측|송신|충전) 실행$/, (id, kind) => `${id} received · Executing ${operationName(kind).toLowerCase()}`],
  [/^(.+) 기동 추진제가 부족해 경로를 실행하지 못했습니다\.$/, id => `${id}: insufficient propellant to execute the trajectory.`],
  [/^(.+) · 궤도 보정 ([\d.]+) m\/s · 추진제 ([\d.]+) kg$/, (id, dv, fuel) => `${id} · Maneuver ${dv} m/s · Propellant ${fuel} kg`],
  [/^(관측|송신|충전) 자세로 전환$/, kind => `Switching to ${operationName(kind).toLowerCase()} attitude`],
  [/^고유 (관측 사진|분광 자료) 확보 · 품질 (\d+)$/, (kind, quality) => `Unique ${kind==='관측 사진'?'image':'spectrum'} captured · Quality ${quality}`],
  [/^지구 수신 완료 · 과학 자료 (\d+)\/(\d+)$/, (received, target) => `Received on Earth · Science ${received}/${target}`],
  [/^유효 수신 자료 (\d+)\/(\d+)개$/, (received, target) => `Valid datasets received: ${received}/${target}`],
  [/^예상 최소 거리 ([\d.]+) km · T\+([\d.]+) s$/, (distance, time) => `Predicted minimum separation ${distance} km · T+${time} s`],
  [/^교육용 잔해의 예상 최소 거리 ([\d.]+) m · 훈련 목표는 2 km 이상입니다\.$/, distance => `Training debris: predicted minimum separation ${distance} m · Target at least 2 km.`],
  [/^교육용 추적 잔해 · 예상 최근접 T\+([\d.]+) s, 최소 거리 ([\d.]+) km\. 기준 2 km이며 충돌확률 수치가 아닙니다\.$/, (time, distance) => `Training debris · Predicted closest approach T+${time} s, minimum separation ${distance} km. The 2 km target is not a collision probability.`],
  [/^잔해 근접 통과 · 최소 거리 ([\d.]+) km · (.+)$/, (distance, status) => `Debris close approach · Minimum separation ${distance} km · ${translate(status)}`],
  [/^잔해 분리 목표 미달: 최소 ([\d.]+) km \/ 요구 2 km$/, distance => `Debris separation target not met: minimum ${distance} km / required 2 km`],
  [/^최소 거리 ([\d,.]+) km \/ 목표 2 km$/, distance => `Minimum separation ${distance} km / target 2 km`],
  [/^T\+([\d:]+) · 이른 기동으로 궤도를 분리하세요\. 확률이 아닌 주어진 두 궤도의 거리입니다\.$/, time => `T+${time} · Separate the trajectories with an early burn. This is distance between two given trajectories, not probability.`],
  [/^([\d.]+) AU · 일식 없음 · 입사각과 5개 광선의 가림을 반영한 발전량\. 태양 손잡이를 움직여 빛의 방향을 바꿉니다\.$/, au => `${au} AU · No eclipse · Generation includes incidence angle and five-ray obstruction sampling. Move the Sun handle to change the light direction.`],
  [/^(관측 기준 −Z|지구 기준 \+Z) · 반각 (\d+)° · (\d+)\/(\d+)개 장비에서 기준 방향이 보입니다\. 최고 개구 가시율이며 거리·임무 품질·행성 가림은 별도입니다\.$/, (direction, halfAngle, visible, total) => `${translate(direction)} · Half-angle ${halfAngle}° · ${visible}/${total} instruments see the reference direction. This is best aperture visibility; range, mission quality, and planetary obstruction are separate.`],
  [/^저장 파일 오류: (.+)$/, reason => `Save file error: ${translate(reason)}`],
  [/^(.+) 범위를 확인하세요\.$/, field => `Check the range of ${translate(field)}.`],
  [/^(.+) 형식을 확인하세요\.$/, field => `Check the format of ${translate(field)}.`],
  [/^명령 (.+)가 재현 결과와 다릅니다\.$/, field => `Command ${field} differs from replay.`],
  [/^(.+)가 재현 결과와 다릅니다\.$/, field => `${translate(field)} differs from replay.`],
  [/^선택한 발사 (?:조건의 질량 한도|패키지의 젖은 질량 한도) ([\d.]+) kg를 초과(?:했습니다|합니다)\.$/, mass => `Selected launch wet-mass limit of ${mass} kg exceeded.`],
  [/^접은 기체가 페어링 반경을 ([\d.]+) m 초과합니다\. 장비 위치 또는 발사 패키지를 바꾸세요\.$/, excess => `Stowed craft exceeds the fairing radius by ${excess} m. Change component placement or the launch package.`],
  [/^접은 기체가 페어링 높이를 ([\d.]+) m 초과합니다\.$/, excess => `Stowed craft exceeds fairing height by ${excess} m.`],
  [/^수납 상태에서 (.+)와 (.+)가 간섭합니다\.$/, (a,b) => `${a} and ${b} interfere in the stowed configuration.`],
  [/^(.+)의 초기 투입 고도는 ([\d.]+)~([\d.]+) km입니다\.$/, (name,min,max) => `${translate(name)} supports initial altitude ${min}–${max} km.`],
  [/^(.+)의 원지점 고도도 ([\d.]+)~([\d.]+) km 이내여야 합니다\.$/, (name,min,max) => `${translate(name)} also requires an apoapsis altitude within ${min}–${max} km.`],
  [/^(.+)의 초기 궤도 경사각은 ([\d.]+)~([\d.]+)°입니다\.$/, (name,min,max) => `${translate(name)} supports initial inclination ${min}–${max}°.`],
  [/^발사 패키지를 포함한 비용이 임무 예산을 ([\d.]+) 크레딧 초과합니다\.$/, excess => `Total cost including launch exceeds the mission budget by ${excess} credits.`],
];
function operationName(kind: string): string { return kind === '탑재 일정 복귀' ? 'Resume schedule' : translate(kind); }

function translate(source: string): string {
  const whitespace = source.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  const [, before, value, after] = whitespace;
  if (!value || !/[가-힣]/.test(value)) return source;
  let result = en[value];
  if (result === undefined) {
    for (const [pattern, replacement] of rules) {
      const match = value.match(pattern);
      if (match) { result = replacement(...match.slice(1)); break; }
    }
  }
  if(result === undefined){
    const hardware=translateHardwareMessage(value);
    if(hardware!==value)result=translate(hardware);
  }
  if (result === undefined) {
    const bullet = value.match(/^([→•]\s*)(.+)$/);
    if (bullet) result = bullet[1] + translate(bullet[2]);
    // Several templates combine independently translated status fragments.
    else if (value.includes(' · ')) result = value.split(' · ').map(translate).join(' · ');
    else if (/[.!?]\s+/.test(value)) result = value.split(/(?<=[.!?])\s+/).map(translate).join(' ');
  }
  return before + (result ?? value) + after;
}

/** Unknown text is retained; never invent a translation or modify a numeric value. */
export function t(source: string): string { return language === 'en' ? translate(source) : source; }

type Original = { source: string; rendered: string };
const textOriginals = new WeakMap<Text, Original>();
const attributeOriginals = new WeakMap<Element, Map<string, Original>>();
const skipSelector = 'script,style,code,pre,textarea,[contenteditable]:not([contenteditable="false"]),[data-i18n-skip],[translate="no"]';
const translatedAttributes = ['title', 'aria-label', 'placeholder'] as const;

function refresh(original: Original | undefined, current: string): Original {
  // Runtime telemetry can reuse a node. A new value becomes its new original.
  return original && current === original.rendered ? original : { source: current, rendered: current };
}

/**
 * Translate display text only. Mark user-generated names with data-i18n-skip.
 * Calling this repeatedly is safe; Korean is restored from the original nodes.
 * Values, IDs, data attributes, listeners, markup, and layout styles are preserved.
 */
export function translateDOM(root: HTMLElement): void {
  if (root.closest(skipSelector)) return;
  const visit = (element: Element): void => {
    if (element.matches(skipSelector)) return;
    let attributes = attributeOriginals.get(element);
    for (const name of translatedAttributes) {
      const current = element.getAttribute(name);
      if (current === null) continue;
      const original = refresh(attributes?.get(name), current);
      original.rendered = t(original.source);
      if (current !== original.rendered) element.setAttribute(name, original.rendered);
      if (!attributes) { attributes = new Map(); attributeOriginals.set(element, attributes); }
      attributes.set(name, original);
    }
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === 1) visit(node as Element);
      else if (node.nodeType === 3) {
        const text = node as Text;
        const original = refresh(textOriginals.get(text), text.data);
        original.rendered = t(original.source);
        if (text.data !== original.rendered) text.data = original.rendered;
        textOriginals.set(text, original);
      }
    }
  };
  visit(root);
}
