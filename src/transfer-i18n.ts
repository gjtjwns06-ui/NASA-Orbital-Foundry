import {getLanguage, t} from './i18n';

/** Display-only, offline translation. Never writes to a plan, event or save.
 * Call before HTML escaping. Captured numbers, paths and operation IDs stay intact.
 * Unknown diagnostics remain visible verbatim instead of inventing an explanation.
 */
const messages:Record<string,string>={
  '임무 중단':'Mission stopped',
  '전력 안전 모드':'Power safe mode',
  '행성 그림자':'Planetary eclipse',
  '조명 또는 관측 거리 조건을 기다립니다.':'Waiting for suitable illumination and observation range.',
  '관측기 지향·가림을 확인하세요.':'Check instrument pointing and obstructions.',
  '교신 가시성·태양 간섭·안테나 지향 조건을 기다립니다.':'Waiting for ground visibility, solar clearance and antenna pointing.',
  '지구 수신까지 광속 지연이 적용됩니다.':'Earth reception includes light travel time.',
  '탑재 일정에 따라 자율 운용합니다.':'Operating autonomously according to the onboard schedule.',
  '고유 분광 자료가 지구에 완전히 수신되었습니다.':'A unique spectrum has been fully received on Earth.',
  '지구 중력 구간을 떠나 태양 중심 순항으로 전환했습니다.':'Left the Earth gravity segment and entered heliocentric cruise.',
  '같은 위치·속도로 화성 조우 구간에 진입했습니다.':'Entered the Mars encounter segment with continuous position and velocity.',
  '계획한 실제 최근접점을 통과했습니다.':'Passed the computed periapsis.',
  '화성 영향권 경계에 도착했습니다.':'Reached the Mars sphere-of-influence boundary.',
  '배터리 잔량 또는 EPS 방전 한도로 안전 모드에 진입했습니다.':'Entered safe mode because of battery charge or the EPS discharge limit.',
  '충전 후 탑재 일정으로 복귀했습니다.':'Resumed the onboard schedule after charging.',
  '배터리가 소진되어 버스 최소 생존 전력도 유지하지 못했습니다.':'The depleted battery could no longer sustain the spacecraft bus.',
  '새 화성 분광 구간을 기록했습니다.':'Recorded a new Mars spectral interval.',
  '화성 영향권 이탈까지 임무가 아직 완료되지 않았습니다.':'The mission has not yet reached the Mars sphere-of-influence exit.',
  '조명·거리·장비 방향·운영 일정의 관측 조건을 확인하세요.':'Check observation lighting, range, instrument pointing and schedule.',
  '선상 기록과 송신 중 자료는 완전 수신 전까지 과학 성과에 포함되지 않습니다.':'Onboard and transmitting data count toward science only after full reception.',
  '지원하지 않는 전이 모델입니다.':'Unsupported transfer model.',
  '순항 적분 간격은 300 또는 600초입니다.':'Cruise integration steps must be 300 or 600 seconds.',
  '경과 시간은 음수가 아닌 유한값이어야 합니다.':'Elapsed time must be finite and nonnegative.',
  '작업 청크는 0 이상의 정수여야 합니다.':'The work chunk must be a nonnegative integer.',
  '유효하지 않은 시간 이동입니다.':'Invalid time-warp request.',
  '전이 임무의 유효한 경과 시간이 필요합니다.':'A valid elapsed time within the transfer mission is required.',
  'TDB 날짜는 YYYY-MM-DD 형식이어야 합니다.':'TDB dates must use YYYY-MM-DD.',
  '유효하지 않은 TDB 날짜입니다.':'Invalid TDB date.',
  '유효하지 않은 TDB 시각입니다.':'Invalid TDB time.',
  '전이 계획 또는 천체력 자료 버전이 다릅니다.':'The transfer plan or ephemeris dataset version does not match.',
  '알 수 없는 탈출 단계입니다.':'Unknown escape stage.',
  '운영 일정이 올바르지 않습니다.':'Invalid operating schedule.',
  '작업 ID가 잘못되거나 중복됩니다.':'An operation ID is invalid or duplicated.',
  '알 수 없는 작업입니다.':'Unknown operation.',
  '작업 시간이 겹칩니다.':'Operations overlap.',
  '임무 종료가 검증된 천체력 범위를 벗어납니다.':'Mission end is outside the verified ephemeris interval.',
  '선택한 탈출 단계의 탑재 질량 한도를 초과합니다.':'Payload mass exceeds the selected escape stage limit.',
  '접은 탐사선이 탈출 단계의 탑재 페어링에 들어가지 않습니다.':'The stowed spacecraft does not fit the escape stage payload fairing.',
  '패스파인더 탈출 단계':'Pathfinder escape stage',
  '익스플로러 탈출 단계':'Explorer escape stage',
  '헤비 탈출 단계':'Heavy escape stage',
  '좋은 발사 창에 맞춘 경량 단계':'A lightweight stage for a favorable launch window',
  '출발 에너지와 탑재량에 여유가 있는 단계':'A stage with additional departure energy and payload capacity',
  '큰 추진제와 페어링을 제공하는 고비용 단계':'A higher-cost stage with more propellant and a larger fairing',
  '객체 형식이 아닙니다.':'Expected an object.',
  '지원하지 않는 필드가 있습니다.':'An unsupported field is present.',
  '파일은 2 MB 이하의 JSON이어야 합니다.':'The file must be JSON no larger than 2 MB.',
  '올바른 JSON이 아닙니다.':'Invalid JSON.',
  '지원하지 않는 게임·모델·천체력 버전입니다.':'Unsupported game, model or ephemeris version.',
  '저장 시각이 올바르지 않습니다.':'Invalid save timestamp.',
  '지원하지 않는 순항 적분 간격입니다.':'Unsupported cruise integration interval.',
  '실행 시각이 재현 가능한 체크포인트가 아닙니다.':'The runtime timestamp is not a reproducible checkpoint.',
  '브라우저 저장소를 사용할 수 없습니다. JSON 백업을 사용하세요.':'Browser storage is unavailable. Use a JSON backup.',
  '저장소를 열지 못했습니다.':'Could not open browser storage.',
  '저장에 실패했습니다.':'Saving failed.',
  '저장이 취소되었습니다.':'Saving was cancelled.',
};
const labels:Record<string,string>={
  '출발 TDB':'Departure TDB','도착 TDB':'Arrival TDB','지구 주차 고도':'Earth parking altitude',
  '화성 최근접 고도':'Mars periapsis altitude','출발 평면 각':'Departure plane angle','B-plane 각':'B-plane angle',
  '작업 시작':'Operation start','작업 종료':'Operation end','실행 시각':'Runtime timestamp','요청 시각':'Requested timestamp',
};
const codes:Record<string,string>={
  ESCAPE_BURN:'Earth escape burn',LAUNCH_BLOCKED:'Launch blocked',DATA_RECEIVED:'Spectrum received',
  EARTH_EXIT:'Earth sphere-of-influence exit',MARS_ENTRY:'Mars sphere-of-influence entry',
  PERIAPSIS:'Mars periapsis',MARS_EXIT:'Mars sphere-of-influence exit',SAFE_MODE:'Power safe mode',
  RECOVERED:'Schedule resumed',POWER_LOSS:'Power lost',SCIENCE_CAPTURED:'Spectrum recorded',
  SCHEDULE_CLIPPED:'Schedule clipped at mission end',STAGE_PAYLOAD:'Stage payload limit',
  STAGE_FUEL:'Stage propellant shortage',STAGE_FAIRING:'Stage fairing clearance',TRANSFER_BUDGET:'Mission budget exceeded',
};
const label=(source:string)=>labels[source]??t(source);
const number='([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?)';
const dynamic:Array<[RegExp,(...values:string[])=>string]>=[
  [new RegExp(`정렬된 발사 단계가 ${number} m/s 순간 탈출 기동을 수행하고 분리되었습니다\\. 단계 추진제 ${number} kg · 탐사선 추진제는 유지됩니다\\.`,'g'),(dv,fuel)=>`The aligned launch stage performed an instantaneous ${dv} m/s escape burn and separated. Stage propellant used: ${fuel} kg · Spacecraft propellant is unchanged.`],
  [new RegExp(`탈출 단계 추진제가 ${number} kg 부족합니다\\. 발사 날짜 또는 단계를 바꾸세요\\.`,'g'),fuel=>`The escape stage is short of ${fuel} kg of propellant. Change the departure date or stage.`],
  [new RegExp(`임무 예산을 ${number} 크레딧 초과합니다\\.`,'g'),cost=>`Mission cost exceeds the budget by ${cost} credits.`],
  [/지구에 완전히 수신된 고유 분광 자료 (\d+)\/(\d+)개/g,(received,required)=>`Unique spectra fully received on Earth: ${received}/${required}`],
  [/^([\s\S]*?): 화성 영향권 이탈 이후의 일정 구간은 임무 종료 시각에서 잘립니다\.$/,(id)=>`${id}: schedule portions after the Mars sphere-of-influence exit are clipped at mission end.`],
  [/^([\s\S]*?): 임무 종료 전에 남는 시간이 1초 미만이어서 이 작업은 실행하지 않습니다\.$/,(id)=>`${id}: this operation is skipped because less than 1 second remains before mission end.`],
  [new RegExp(`^(.+) 범위는 ${number}~${number}입니다\\.$`),(name,min,max)=>`${label(name)} must be within ${min}–${max}.`],
  [/^(.+) 범위가 잘못됐습니다\.$/,name=>`${label(name)} is out of range.`],
  [/^(.+) 값이 재현 결과와 다릅니다\.$/,path=>`${path} does not match the replayed value.`],
  [/^(.+) 목록이 재현 결과와 다릅니다\.$/,path=>`${path} does not match the replayed list.`],
  [/^(.+) 필드가 다릅니다\.$/,path=>`${path} has different fields.`],
];

export function transferText(source:string):string {
  if(getLanguage()!=='en')return source;
  const exact=messages[source]??labels[source]??codes[source];
  if(exact!==undefined)return exact;
  const prefix=source.match(/^(\s*(?:Error: )?)(전이 저장 오류: |저장 파일 오류: )?([\s\S]*)$/)!;
  if(prefix[1]||prefix[2])return prefix[1]+(prefix[2]==='전이 저장 오류: '?'Transfer save error: ':prefix[2]?'Save file error: ':'')+transferText(prefix[3]);
  let result=source;
  for(const [pattern,replacement] of dynamic)result=result.replace(pattern,(...args)=>replacement(...args.slice(1,-2)));
  // A blocked launch can join several complete warning sentences. Translate each
  // known sentence while retaining the original order and numerical diagnostics.
  for(const [ko,en] of Object.entries(messages))if(ko.endsWith('.'))result=result.split(ko).join(en);
  return t(result);
}
