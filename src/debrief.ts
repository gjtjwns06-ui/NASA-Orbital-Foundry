import type {Design,Part,PartKind,OperationKind,MissionResult,Warning} from './sim/types';
import {scienceTargetKey} from './sim/targets';

export type DebriefDesign=Design&{hardwareVersion?:string;busId?:string;activeRadioId?:string;parts:(Part&{modelId?:string})[]};
export interface HardwareCanonicalization {defaultModelIds?:Partial<Record<PartKind,string>>;defaultBusId?:string}
export interface DebriefMetadata {
  modelVersion:string|null;scoreDefinitionId:string|null;
  simulationStatus:'running'|'complete'|'failed'|'unknown';
  requirements:{targetPackets:number;minimumQuality:number;deadlineSeconds:number}|null;
  eventLogCoverage:'complete'|'truncated'|'unknown';
}
export interface DebriefRun {result:Readonly<MissionResult>;meta?:Partial<DebriefMetadata>;designWarnings?:readonly Warning[]}
export interface LocalizedText {ko:string;en:string}
export interface PartSignature {kind:PartKind;modelId:string;face:string;u:number;v:number;rotation:number}
export type DebriefTarget=
  |{kind:'part';partId:string;signature:PartSignature}
  |{kind:'part-kind';partKind:PartKind}
  |{kind:'operation';operationId:string;operationKind:OperationKind;start:number;end:number}
  |{kind:'maneuver';maneuverId?:string;time:number;progradeMps?:number;radialMps?:number;normalMps?:number}
  |{kind:'time';time:number;panel:'trajectory'|'timeline'|'resources'}
  |{kind:'command';commandId:string;time:number};
export interface TargetResolution {status:'exact'|'semantic'|'stale'|'ambiguous';target:DebriefTarget}
export interface DebriefEvidence {
  kind:'event'|'packet'|'command'|'design'|'warning';code:string;time?:number;index?:number;
  ids?:string[];values?:Record<string,number|string|boolean|null>;
}
export interface DebriefAction {kind:'inspect'|'review';label:LocalizedText;target:DebriefTarget}
export interface DebriefDiagnostic {
  id:string;code:string;severity:'error'|'warning'|'info';confidence:'observed'|'supported'|'inspect';
  title:LocalizedText;detail:LocalizedText;evidence:DebriefEvidence[];actions:DebriefAction[];
}
export interface DesignChange {
  kind:'hardware'|'layout'|'operation'|'trajectory'|'bus'|'radio'|'launch'|'hardware-profile'|'conditions';
  key:string;before:unknown;after:unknown;beforeIds?:string[];afterIds?:string[];target?:DebriefTarget;
  ambiguous?:boolean;
}
export interface ComparisonBlocker {code:string;label:LocalizedText;before?:unknown;after?:unknown}
export interface DebriefComparison {
  available:boolean;comparable:boolean;blockers:ComparisonBlocker[];designChanges:readonly DesignChange[];
  scoreDelta?:{total:number;science:number;mission:number;resource:number};
  metricDeltas?:{received:number;budgetRemaining:number;energyMinimumWh:number;fuelRemainingKg:number};
  commandStrategyChanged?:boolean;
}
export interface Debrief {
  evaluatedAt:number;isFinal:boolean;diagnostics:DebriefDiagnostic[];
  transport:{captured:number;fullyReceived:number;qualifyingReceived:number|null;partlyEmitted:number;fullyEmittedUnconfirmed:number;neverEmitted:number;unconfirmedBits:number};
  comparison:DebriefComparison;limitations:LocalizedText[];
}

const text=(ko:string,en:string):LocalizedText=>({ko,en});
const key=(x:unknown):string=>JSON.stringify(x,(_name,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value)??'undefined';
const num=(x:number)=>Object.is(x,-0)?0:x;
const angle=(x:number)=>num(((x%360)+360)%360);
function immutable<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(immutable);Object.freeze(value);}return value;}
// The final clone ensures no output shares/freeze-mutates the caller's records.
const output=<T>(value:T):T=>immutable(structuredClone(value));
function signature(part:Part&{modelId?:string},hardware:HardwareCanonicalization={}):PartSignature {
  return {kind:part.kind,modelId:part.modelId??hardware.defaultModelIds?.[part.kind]??`legacy:${part.kind}`,face:part.face,u:num(part.u),v:num(part.v),rotation:angle(part.rotation)};
}
const partTarget=(p:Part&{modelId?:string},h:HardwareCanonicalization):DebriefTarget=>({kind:'part',partId:p.id,signature:signature(p,h)});
const operationTarget=(op:{id:string;kind:OperationKind;start:number;end:number}):DebriefTarget=>({kind:'operation',operationId:op.id,operationKind:op.kind,start:op.start,end:op.end});
const timeTarget=(time:number,panel:'trajectory'|'timeline'|'resources'='timeline'):DebriefTarget=>({kind:'time',time,panel});
const opSignature=(op:{kind:OperationKind;start:number;end:number})=>({kind:op.kind,start:num(op.start),end:num(op.end)});
function maneuvers(design:DebriefDesign){
  const p=design.plan;
  return (p.maneuvers??[{id:'legacy',time:p.burnTime,progradeMps:p.progradeMps,radialMps:p.radialMps,normalMps:p.normalMps}]).slice().sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
}
function orbit(design:DebriefDesign){
  if(design.missionId==='mars')return {periapsisAltitudeKm:design.plan.periapsisAltitudeKm,bPlaneAngleDeg:angle(design.plan.bPlaneAngleDeg)};
  return {altitudeKm:design.plan.altitudeKm,inclinationDeg:design.plan.inclinationDeg,maneuvers:maneuvers(design).map(({id:_,...physical})=>physical)};
}
function radio(design:DebriefDesign,h:HardwareCanonicalization){
  if(!design.activeRadioId)return 'automatic';
  const part=design.parts.find(p=>p.id===design.activeRadioId);return part?signature(part,h):`unresolved:${design.activeRadioId}`;
}

/** Neutral semantic changes, not an attribution of a score improvement to a part.
 * Legacy/current hardware aliases must only be supplied when physically identical.
 */
export function compareDesigns(before:DebriefDesign,after:DebriefDesign,hardware:HardwareCanonicalization={}):readonly DesignChange[]{
  const changes:DesignChange[]=[];
  const field=(kind:DesignChange['kind'],name:string,a:unknown,b:unknown,target?:DebriefTarget)=>{if(key(a)!==key(b))changes.push({kind,key:name,before:a,after:b,...(target?{target}:{})});};
  field('bus','busId',before.busId??hardware.defaultBusId??'legacy:bus',after.busId??hardware.defaultBusId??'legacy:bus');
  field('hardware-profile','hardwareVersion',before.hardwareVersion??'legacy',after.hardwareVersion??'legacy');
  field('launch','launchPackageId',before.launchPackageId??'rideshare',after.launchPackageId??'rideshare');
  const activeRadio=after.activeRadioId?after.parts.find(p=>p.id===after.activeRadioId):undefined;
  field('radio','activeRadio',radio(before,hardware),radio(after,hardware),activeRadio?partTarget(activeRadio,hardware):{kind:'part-kind',partKind:after.hardwareVersion?'radio':'antenna'});
  for(const [name,a,b] of [['missionId',before.missionId,after.missionId],['seed',before.seed,after.seed],['hazard',before.hazard??'none',after.hazard??'none'],['target',scienceTargetKey(before.scienceTarget),scienceTargetKey(after.scienceTarget)]] as const)field('conditions',name,a,b);
  field('trajectory','orbit',orbit(before),orbit(after),timeTarget(0,'trajectory'));

  const left=before.parts.slice(),right=after.parts.slice();
  // Cancel exact semantic occurrences first: IDs and catalogue ordering alone
  // never manufacture a change, including identical duplicated components.
  for(let i=left.length-1;i>=0;i--){const j=right.findIndex(p=>key(signature(p,hardware))===key(signature(left[i],hardware)));if(j>=0){left.splice(i,1);right.splice(j,1);}}
  const pair=(i:number,j:number)=>{const a=left.splice(i,1)[0],b=right.splice(j,1)[0],sa=signature(a,hardware),sb=signature(b,hardware);changes.push({kind:sa.kind===sb.kind&&sa.modelId===sb.modelId?'layout':'hardware',key:`part:${b.kind}`,before:sa,after:sb,beforeIds:[a.id],afterIds:[b.id],target:partTarget(b,hardware)});};
  for(let i=left.length-1;i>=0;i--){const j=right.findIndex(p=>p.id===left[i].id);if(j>=0)pair(i,j);}
  for(const kind of Array.from(new Set([...left,...right].map(p=>p.kind))).sort()){
    const a=left.filter(p=>p.kind===kind),b=right.filter(p=>p.kind===kind);
    if(a.length===1&&b.length===1)pair(left.indexOf(a[0]),right.indexOf(b[0]));
    else if(a.length||b.length)changes.push({kind:'hardware',key:`group:${kind}`,before:a.map(p=>signature(p,hardware)).sort((x,y)=>key(x).localeCompare(key(y))),after:b.map(p=>signature(p,hardware)).sort((x,y)=>key(x).localeCompare(key(y))),beforeIds:a.map(p=>p.id).sort(),afterIds:b.map(p=>p.id).sort(),ambiguous:a.length>0&&b.length>0,target:{kind:'part-kind',partKind:kind}});
  }
  const aOps=before.plan.operations.slice(),bOps=after.plan.operations.slice();
  for(let i=aOps.length-1;i>=0;i--){const j=bOps.findIndex(o=>key(opSignature(o))===key(opSignature(aOps[i])));if(j>=0){aOps.splice(i,1);bOps.splice(j,1);}}
  for(const b of bOps){const candidates=aOps.filter(a=>a.id===b.id),sameKind=aOps.filter(a=>a.kind===b.kind);const a=candidates[0]??(sameKind.length===1&&bOps.filter(o=>o.kind===b.kind).length===1?sameKind[0]:undefined);if(a)aOps.splice(aOps.indexOf(a),1);changes.push({kind:'operation',key:`operation:${b.kind}`,before:a?opSignature(a):null,after:opSignature(b),beforeIds:a?[a.id]:[],afterIds:[b.id],target:operationTarget(b)});}
  for(const a of aOps)changes.push({kind:'operation',key:`operation:${a.kind}`,before:opSignature(a),after:null,beforeIds:[a.id],afterIds:[],target:timeTarget(a.start)});
  return output(changes.sort((a,b)=>a.kind.localeCompare(b.kind)||a.key.localeCompare(b.key)||key(a.after).localeCompare(key(b.after))));
}

/** Resolve against today's design; an ID reused for a different object is unsafe. */
export function resolveDebriefTarget(target:DebriefTarget,current:DebriefDesign,hardware:HardwareCanonicalization={}):TargetResolution{
  if(target.kind==='part'){
    const matches=current.parts.filter(p=>key(signature(p,hardware))===key(target.signature)),exact=matches.find(p=>p.id===target.partId);
    if(exact)return output({status:'exact',target});
    if(matches.length===1)return output({status:'semantic',target:partTarget(matches[0],hardware)});
    return output({status:matches.length?'ambiguous':'stale',target:{kind:'part-kind',partKind:target.signature.kind}});
  }
  if(target.kind==='operation'){
    const matches=current.plan.operations.filter(o=>o.kind===target.operationKind&&o.start===target.start&&o.end===target.end),exact=matches.find(o=>o.id===target.operationId);
    if(exact)return output({status:'exact',target});
    if(matches.length===1)return output({status:'semantic',target:operationTarget(matches[0])});
    return output({status:matches.length?'ambiguous':'stale',target:timeTarget(target.start)});
  }
  if(target.kind==='maneuver'){
    const matches=maneuvers(current).filter(n=>n.time===target.time&&(target.progradeMps===undefined||n.progradeMps===target.progradeMps)&&(target.radialMps===undefined||n.radialMps===target.radialMps)&&(target.normalMps===undefined||n.normalMps===target.normalMps));
    if(matches.length===1)return output({status:matches[0].id===target.maneuverId?'exact':'semantic',target:{...target,maneuverId:matches[0].id}});
    return output({status:matches.length?'ambiguous':'stale',target:timeTarget(target.time,'trajectory')});
  }
  // A command refers to the historical log, not a live editable command object.
  return output({status:'exact',target});
}

function metadata(run:DebriefRun):{value:DebriefMetadata;conflict:boolean}{
  const result=run.result as MissionResult&Partial<DebriefMetadata>,captured=run.meta??{};
  const value:DebriefMetadata={modelVersion:result.modelVersion??captured.modelVersion??null,scoreDefinitionId:result.scoreDefinitionId??captured.scoreDefinitionId??null,simulationStatus:result.simulationStatus??captured.simulationStatus??'unknown',requirements:result.requirements??captured.requirements??null,eventLogCoverage:result.eventLogCoverage??captured.eventLogCoverage??'unknown'};
  const known=(v:unknown)=>v!==undefined&&v!==null&&v!=='unknown';
  const conflict=Object.entries(captured).some(([k,v])=>known(v)&&known(result[k as keyof DebriefMetadata])&&key(v)!==key(result[k as keyof DebriefMetadata]));
  return {value,conflict};
}
function compareRuns(current:DebriefRun,previous:DebriefRun|undefined,h:HardwareCanonicalization):DebriefComparison{
  if(!previous)return {available:false,comparable:false,blockers:[],designChanges:[]};
  const a=previous.result,b=current.result,am=metadata(previous),bm=metadata(current),blockers:ComparisonBlocker[]=[];
  const check=(code:string,label:LocalizedText,before:unknown,after:unknown)=>{if(key(before)!==key(after))blockers.push({code,label,before,after});};
  if(am.conflict||bm.conflict)blockers.push({code:'METADATA_CONFLICT',label:text('결과의 출처 정보가 서로 충돌합니다.','Result provenance metadata conflicts.')});
  for(const field of ['modelVersion','scoreDefinitionId'] as const){if(!am.value[field]||!bm.value[field])blockers.push({code:`MISSING_${field}`,label:text('모델 또는 점수 정의의 출처가 없어 비교하지 않습니다.','Comparison requires known model and score-definition provenance.')});else check(field,text('계산 모델 또는 점수 정의가 다릅니다.','Model or score definition differs.'),am.value[field],bm.value[field]);}
  check('MISSION',text('임무가 다릅니다.','Missions differ.'),a.design.missionId,b.design.missionId);
  check('SEED',text('환경 시드가 다릅니다.','Scenario seeds differ.'),a.design.seed,b.design.seed);
  check('TARGET',text('과학 목표가 다릅니다.','Science targets differ.'),scienceTargetKey(a.design.scienceTarget),scienceTargetKey(b.design.scienceTarget));
  check('HAZARD',text('환경 시나리오가 다릅니다.','Hazard scenarios differ.'),a.design.hazard??'none',b.design.hazard??'none');
  check('EVALUATED_AT',text('평가 시각이 다릅니다.','Evaluation times differ.'),a.evaluatedAt,b.evaluatedAt);
  check('REQUIRED',text('요구 자료 수가 다릅니다.','Required dataset counts differ.'),a.required,b.required);
  if(!am.value.requirements||!bm.value.requirements)blockers.push({code:'MISSING_REQUIREMENTS',label:text('품질·기한 조건의 기록이 없습니다.','Quality and deadline requirements were not recorded.')});
  else check('REQUIREMENTS',text('품질 또는 기한 조건이 다릅니다.','Quality or deadline requirements differ.'),am.value.requirements,bm.value.requirements);
  const comparison:DebriefComparison={available:true,comparable:blockers.length===0,blockers,designChanges:compareDesigns(a.design,b.design,h)};
  if(comparison.comparable){comparison.scoreDelta={total:b.score-a.score,science:b.scienceScore-a.scienceScore,mission:b.missionScore-a.missionScore,resource:b.resourceScore-a.resourceScore};comparison.metricDeltas={received:b.received-a.received,budgetRemaining:b.budgetRemaining-a.budgetRemaining,energyMinimumWh:b.energyMinimumWh-a.energyMinimumWh,fuelRemainingKg:b.fuelRemainingKg-a.fuelRemainingKg};
    const strategy=(r:MissionResult)=>(r.commandHistory??[]).map(c=>({kind:c.kind,requestedAt:c.requestedAt,durationSeconds:c.durationSeconds}));comparison.commandStrategyChanged=key(strategy(a))!==key(strategy(b));}
  return comparison;
}

/** Evidence-led analysis of M01/M02 results. No re-simulation or causal guesses. */
export function buildDebrief(current:DebriefRun,previous?:DebriefRun,hardware:HardwareCanonicalization={}):Debrief{
  const r=current.result,d=r.design as DebriefDesign,m=metadata(current),diagnostics:DebriefDiagnostic[]=[],limitations:LocalizedText[]=[];
  const action=(target:DebriefTarget,label=text('이 위치 살펴보기','Inspect this location')):DebriefAction=>({kind:'inspect',label,target});
  const category=(partKind:PartKind)=>action({kind:'part-kind',partKind},text('장비 배치 점검','Inspect hardware layout'));
  const add=(code:string,severity:DebriefDiagnostic['severity'],confidence:DebriefDiagnostic['confidence'],title:LocalizedText,detail:LocalizedText,evidence:DebriefEvidence[],actions:DebriefAction[])=>diagnostics.push({id:`${code}:${evidence[0]?.ids?.[0]??evidence[0]?.time??'design'}`,code,severity,confidence,title,detail,evidence,actions});
  const sensor:PartKind=d.missionId==='earth'?'camera':'spectrometer';
  for(const [kind,code,title,detail] of [
    [sensor,'MISSING_SENSOR',text('임무 관측기가 없습니다','Required instrument is absent'),text('평가한 설계에 이 임무의 관측기가 없습니다. 장착 후 새 예측으로 확인하세요.','The evaluated design has no instrument for this mission. Add one and run a new prediction.')],
    ['antenna','MISSING_ANTENNA',text('통신 안테나가 없습니다','Communications antenna is absent'),text('평가한 설계에 안테나가 없습니다. 관측 자료의 지구 전달을 위해 통신 장비가 필요합니다.','The evaluated design has no antenna. Communications hardware is needed to return observations.')],
  ] as const)if(!d.parts.some(p=>p.kind===kind))add(code,'error','observed',title,detail,[{kind:'design',code,values:{partKind:kind,count:0}}],[category(kind)]);
  const eventRules:Record<string,{title:LocalizedText;detail:LocalizedText;panel:'resources'|'timeline'|'trajectory';part?:PartKind}>={
    SAFE_MODE:{title:text('배터리 안전 모드가 기록됐습니다','Battery safe mode was recorded'),detail:text('기록된 시각에 관측·송신이 일시 중단됐습니다. 이 기록만으로 발전판 가림이나 배터리 용량을 원인으로 단정할 수 없습니다.','Observation and transmission were interrupted at the recorded time. This alone does not identify panel obstruction or battery capacity as the cause.'),panel:'resources',part:'battery'},
    DISCHARGE_LIMIT:{title:text('배터리 출력 한도를 넘었습니다','Battery discharge-power limit was exceeded'),detail:text('전력 요구가 EPS 출력 한도를 넘었다는 사건입니다. 에너지 용량(Wh)과 출력(W)은 서로 다른 제한입니다.','The event records load exceeding the EPS power limit. Energy capacity (Wh) and output power (W) are different constraints.'),panel:'resources',part:'battery'},
    STORAGE_FULL:{title:text('기록장치 포화가 기록됐습니다','Recorder saturation was recorded'),detail:text('기존 자료를 보존하며 새 관측을 중단한 기록입니다. 송신 시점과 기록 용량을 함께 검토하세요.','New observations were withheld to preserve existing data. Review downlink timing and recorder capacity together.'),panel:'timeline',part:'storage'},
    LINK_RETRY:{title:text('수신 확인에 실패해 재전송했습니다','Reception failed and data was retried'),detail:text('수신 시각의 가시성 상실이 기록됐습니다. 송신 시작뿐 아니라 지구 수신 시각도 살펴보세요.','The log records loss of visibility at reception. Inspect the arrival time as well as the transmission start.'),panel:'timeline'},
    FUEL:{title:text('기동 추진제 부족이 기록됐습니다','Maneuver propellant shortage was recorded'),detail:text('해당 기동을 실행하지 못했다는 기록입니다. 기동량과 가용 추진제를 다시 예측하세요.','The recorded maneuver could not be executed. Recheck its delta-v and available propellant with a new prediction.'),panel:'trajectory'},
    IMPACT:{title:text('안전 표면 침범이 기록됐습니다','A surface safety violation was recorded'),detail:text('기록 시각의 경로를 확인하세요. 특정 기동 하나의 책임으로 단정하지 않습니다.','Inspect the trajectory at the recorded time. The record does not isolate one maneuver as the cause.'),panel:'trajectory'},
    DEBRIS_CONTACT:{title:text('교육용 잔해 접촉 판정','Educational debris-contact event'),detail:text('두 궤적의 분리 거리가 교육용 접촉 경계 안에 들었습니다. 이는 충돌 확률 추정이 아닙니다.','The two trajectories entered the educational contact-distance boundary. This is not a collision-probability estimate.'),panel:'trajectory'},
  };
  for(const [code,rule] of Object.entries(eventRules)){
    const events=r.timeline.map((e,index)=>({e,index})).filter(x=>x.e.code===code);if(!events.length)continue;
    add(code,events.some(x=>x.e.severity==='error')?'error':'warning','observed',rule.title,rule.detail,events.map(({e,index})=>({kind:'event',code,time:e.time,index})),[action(timeTarget(events[0].e.time,rule.panel)),...(rule.part?[category(rule.part)]:[])]);
  }
  const connectionCodes=new Set(['POWER_VOLTAGE','POWER_PORT_LIMIT','DATA_INTERFACE','DATA_PORT_CAPACITY','SOLAR_INPUT_LIMIT','BATTERY_MISSING','NO_RADIO','RADIO_SELECTION','RF_BAND','ADCS_MISSING','ADCS_COUNT','POWER_TOTAL_LIMIT','PART_LIMIT']);
  for(const [index,warning] of (current.designWarnings??[]).entries()){
    if(!['PLACEMENT','THRUST_OFFSET'].includes(warning.code)&&!connectionCodes.has(warning.code))continue;
    const p=d.parts.find(p=>p.id===warning.partId);
    const supplied=warning as Warning&{required?:number|string;available?:number|string};
    const fallback:PartKind|undefined=['NO_RADIO','RADIO_SELECTION','RF_BAND'].includes(warning.code)?'radio':warning.code.startsWith('ADCS')?'adcs':warning.code==='BATTERY_MISSING'?'battery':undefined;
    add(`DESIGN_${warning.code}`,warning.severity,'observed',text('설계 검사가 제한을 발견했습니다','A design check found a constraint violation'),text('제공된 설계 검사 기록을 바탕으로 해당 장착 위치와 연결 조건을 점검하세요.','Inspect the mounting location and connection constraints identified by the supplied design-check record.'),[{kind:'warning',code:warning.code,index,ids:p?[p.id]:[],values:{message:warning.message,...(supplied.required!==undefined?{required:supplied.required}:{}),...(supplied.available!==undefined?{available:supplied.available}:{})}}],[p?action(partTarget(p,hardware)):fallback?category(fallback):action(timeTarget(0,'resources'))]);
    diagnostics[diagnostics.length-1].id+=`:${index}`;
  }
  const complete=(p:MissionResult['packets'][number])=>p.receivedAt!==null&&p.receivedAt<=r.evaluatedAt&&p.receivedBits>=p.bits-.01;
  const recorded=r.packets.filter(p=>p.capturedAt<=r.evaluatedAt),unconfirmed=recorded.filter(p=>!complete(p));
  const transport={captured:recorded.length,fullyReceived:recorded.filter(complete).length,qualifyingReceived:m.value.requirements?recorded.filter(p=>complete(p)&&p.quality>=m.value.requirements!.minimumQuality).length:null,partlyEmitted:unconfirmed.filter(p=>p.transmittedBits>0&&p.transmittedBits<p.bits-.01).length,fullyEmittedUnconfirmed:unconfirmed.filter(p=>p.transmittedBits>=p.bits-.01).length,neverEmitted:unconfirmed.filter(p=>p.transmittedBits<=0).length,unconfirmedBits:unconfirmed.reduce((sum,p)=>sum+Math.max(0,p.bits-p.receivedBits),0)};
  if(unconfirmed.length){
    const op=d.plan.operations.filter(o=>o.kind==='downlink'&&o.end>recorded[0].capturedAt).sort((a,b)=>a.start-b.start)[0];
    add('DELIVERY_UNCONFIRMED','info','observed',text('아직 수신이 확인되지 않은 자료','Data without confirmed reception'),text(`${unconfirmed.length}개 자료의 완전 수신이 평가 시각까지 확인되지 않았습니다. 완전 송신만으로 전파 이동 중이라고 단정할 수 없습니다.`,`${unconfirmed.length} datasets lack confirmed full reception at evaluation. Full emission alone does not prove they are currently in flight.`),[{kind:'packet',code:'DELIVERY_UNCONFIRMED',ids:unconfirmed.map(p=>p.id),values:{count:unconfirmed.length,bits:transport.unconfirmedBits,fullyEmitted:transport.fullyEmittedUnconfirmed}}],[op?action(operationTarget(op),text('송신 일정 살펴보기','Review downlink schedule')):action(timeTarget(r.evaluatedAt)),category('antenna')]);
  }
  if(!recorded.length&&d.parts.some(p=>p.kind===sensor))add('NO_CAPTURE_EVIDENCE','info','inspect',text('관측 자료가 기록되지 않았습니다','No observations were recorded'),text('원인을 특정할 기록이 충분하지 않습니다. 관측기 방향·가림, 목표 시야·조명, 운영 시각을 예측 화면에서 함께 점검하세요.','The records do not isolate a cause. Inspect instrument pointing/obstruction, target visibility/lighting and operating times in the prediction view.'),[{kind:'packet',code:'NO_CAPTURE_EVIDENCE',values:{count:0,evaluatedAt:r.evaluatedAt}}],[category(sensor),action(timeTarget(d.plan.operations.find(o=>o.kind==='observe')?.start??r.evaluatedAt))]);
  for(const c of r.commandHistory??[]){if(!['failed','queued','inflight'].includes(c.status))continue;
    add(`COMMAND_${c.status.toUpperCase()}`,'warning','observed',text('명령 전달 기록을 확인하세요','Review command delivery'),text(c.status==='failed'?'명령이 실행되지 못한 기록입니다. 더 이른 요청의 성공을 보장하지는 않습니다.':'평가 시각까지 이 명령의 실행이 확인되지 않았습니다.',c.status==='failed'?'The record shows a command failed to execute. An earlier request is not guaranteed to succeed.':'Execution of this command is not confirmed by the evaluation time.'),[{kind:'command',code:c.status,ids:[c.id],time:c.executedAt??c.arrivesAt??c.sentAt??c.requestedAt,values:{kind:c.kind,requestedAt:c.requestedAt,sentAt:c.sentAt,arrivesAt:c.arrivesAt,executedAt:c.executedAt,status:c.status}}],[action({kind:'command',commandId:c.id,time:c.requestedAt}),action(timeTarget(c.requestedAt))]);
  }
  if(r.hazard&&!r.hazard.safe&&r.evaluatedAt>=r.hazard.time)add('HAZARD_SEPARATION','warning','observed',text('훈련 분리 기준에 못 미쳤습니다','Training separation criterion was not met'),text('기록된 최소 거리를 확인하고 이전 경로를 수정해 다시 예측하세요.','Inspect the recorded minimum distance, then revise and predict the earlier trajectory.'),[{kind:'event',code:'HAZARD_SEPARATION',time:r.hazard.time,values:{distanceKm:r.hazard.minDistanceKm,thresholdKm:r.hazard.thresholdKm}}],[action(timeTarget(r.hazard.time,'trajectory'))]);
  if(m.value.eventLogCoverage!=='complete')limitations.push(text('사건 기록이 일부이거나 완전성이 확인되지 않았습니다. 표시한 사건 수는 전체 횟수나 중단 시간을 뜻하지 않습니다.','Event history is partial or its completeness is unknown. Listed records do not establish total event counts or outage duration.'));
  if(m.value.simulationStatus==='running'||m.value.simulationStatus==='unknown')limitations.push(text('이 화면은 평가 시각의 기록입니다. 아직 최종 임무 결과라고 단정하지 않습니다.','This is a record at the evaluation time; it is not asserted to be the final mission outcome.'));
  limitations.push(text('추천은 다음 점검 위치를 가리킵니다. 변경의 효과는 새 시뮬레이션으로 확인해야 합니다.','Recommendations identify inspection locations. A new simulation is required to evaluate a change.'));
  const rank={error:0,warning:1,info:2};diagnostics.sort((a,b)=>rank[a.severity]-rank[b.severity]||a.code.localeCompare(b.code)||a.id.localeCompare(b.id));
  return output({evaluatedAt:r.evaluatedAt,isFinal:m.value.simulationStatus==='complete'||m.value.simulationStatus==='failed',diagnostics,transport,comparison:compareRuns(current,previous,hardware),limitations});
}
