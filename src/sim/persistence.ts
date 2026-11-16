import { MODEL_VERSION, MISSIONS, PARTS } from './catalog';
import {normalizeScienceTarget,type ScienceTarget} from './targets';
import {LAUNCH_PACKAGES,type LaunchPackageId} from './launch';
import { advanceSimulation, createSimulation, getResult, queueCommand } from './simulation';
import type { CommandKind, Design, Maneuver, MissionResult, SaveFile, SimulationState } from './types';
import {HARDWARE_VERSION,HARDWARE_SIM_MODEL_VERSION,HARDWARE_CATALOG_HASH,HARDWARE_MODELS,BUSES} from '../hardware/catalog';
import {isHardwareDesign} from '../hardware/resolve';
import {EARTH_ORBIT_VERSION,initialEarthOrbit,earthOrbitModelVersion} from './earth-orbit';
const fail=(message:string):never=>{throw new Error(`저장 파일 오류: ${message}`);};
function obj(x:unknown):Record<string,unknown>{if(typeof x!=='object'||x===null||Array.isArray(x))fail('객체 형식이 아닙니다.');return x as Record<string,unknown>;}
function number(x:unknown,min:number,max:number,label:string):number{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)fail(`${label} 범위를 확인하세요.`);return x as number;}
function string(x:unknown,max:number,label:string):string{if(typeof x!=='string'||x.length>max)fail(`${label} 형식을 확인하세요.`);return x as string;}
function exactKeys(o:Record<string,unknown>,allowed:string[]){if(Object.keys(o).some(k=>!allowed.includes(k)))fail('지원하지 않는 필드가 있습니다.');}
export function validateDesign(value:unknown):Design {
 const d=obj(value);exactKeys(d,['version','missionId','name','parts','plan','seed','hazard','scienceTarget','launchPackageId','hardwareVersion','busId','activeRadioId']);if(d.version!==1)fail('지원하지 않는 설계 버전입니다.');
 const hardware=d.hardwareVersion!==undefined;
 if(hardware){if(d.hardwareVersion!==HARDWARE_VERSION||typeof d.busId!=='string'||!Object.hasOwn(BUSES,d.busId))fail('지원하지 않는 하드웨어 버전 또는 버스입니다.');if(d.activeRadioId!==undefined)string(d.activeRadioId,80,'무전기 선택');}
 else if(d.busId!==undefined||d.activeRadioId!==undefined)fail('기존 설계에는 새 하드웨어 필드를 사용할 수 없습니다.');
 if(d.missionId!=='earth'&&d.missionId!=='mars')fail('알 수 없는 임무입니다.');
 const missionId=d.missionId as 'earth'|'mars',name=string(d.name,80,'우주선 이름'),seed=number(d.seed,0,2**32-1,'시드');
 if(d.hazard!==undefined&&d.hazard!=='none'&&d.hazard!=='debris')fail('알 수 없는 우주 환경 시나리오입니다.');
 if(d.launchPackageId!==undefined&&(typeof d.launchPackageId!=='string'||!Object.hasOwn(LAUNCH_PACKAGES,d.launchPackageId)))fail('알 수 없는 발사 패키지입니다.');
 let scienceTarget:ScienceTarget|undefined;if(d.scienceTarget!==undefined){if(missionId!=='earth')fail('지표 지역 선택은 지구 임무에서만 지원합니다.');const t=obj(d.scienceTarget);exactKeys(t,['profile','latDeg','lonDeg']);try{scienceTarget=normalizeScienceTarget({profile:t.profile,latDeg:t.latDeg,lonDeg:t.lonDeg} as ScienceTarget);}catch{fail('과학 목표의 유형·위도·경도를 확인하세요.');}}
 if(!Array.isArray(d.parts)||d.parts.length>(hardware?20:32))fail('부품 목록을 확인하세요.');
 const ids=new Set<string>();
 const parts=(d.parts as unknown[]).map(x=>{const p=obj(x);exactKeys(p,hardware?['id','kind','face','u','v','rotation','modelId']:['id','kind','face','u','v','rotation']);const id=string(p.id,80,'부품 ID');if(!id||ids.has(id))fail('부품 ID가 비어 있거나 중복됩니다.');ids.add(id);if(hardware){if(typeof p.modelId!=='string'||!Object.hasOwn(HARDWARE_MODELS,p.modelId)||HARDWARE_MODELS[p.modelId].kind!==p.kind)fail('장비 모델과 종류가 일치하지 않습니다.');}else if(typeof p.kind!=='string'||!Object.hasOwn(PARTS,p.kind))fail('알 수 없는 부품입니다.');if(!['px','nx','py','ny','pz','nz'].includes(p.face as string))fail('장착 면을 확인하세요.');return {id,kind:p.kind,face:p.face,u:number(p.u,-1,1,'장착 U'),v:number(p.v,-1,1,'장착 V'),rotation:number(p.rotation,-3600,3600,'회전'),...(hardware?{modelId:p.modelId}:{})} as Design['parts'][number];});
 const p=obj(d.plan);exactKeys(p,['altitudeKm','inclinationDeg','burnTime','progradeMps','normalMps','radialMps','periapsisAltitudeKm','bPlaneAngleDeg','operations','maneuvers','earthOrbit']);
 let earthOrbit:Design['plan']['earthOrbit'];
 if(p.earthOrbit!==undefined){
  if(missionId!=='earth')fail('타원 궤도 모드는 지구 임무에서만 지원합니다.');
  const orbit=obj(p.earthOrbit);exactKeys(orbit,['version','apoapsisAltitudeKm']);
  if(orbit.version!==EARTH_ORBIT_VERSION)fail('지원하지 않는 지구 초기 궤도 모델입니다.');
  earthOrbit={version:EARTH_ORBIT_VERSION,apoapsisAltitudeKm:number(orbit.apoapsisAltitudeKm,180,2000,'원지점 고도')};
  try{initialEarthOrbit({...p,earthOrbit} as unknown as Design['plan']);}catch{fail('지구 근지점·원지점 순서와 고도·경사각 범위를 확인하세요.');}
 }
 if(!Array.isArray(p.operations)||p.operations.length>40)fail('작업 목록을 확인하세요.');
 const opIds=new Set<string>(),duration=MISSIONS[missionId].duration;
 let maneuvers:Maneuver[]|undefined;
 if(p.maneuvers!==undefined){if(!Array.isArray(p.maneuvers)||p.maneuvers.length>12)fail('기동 노드는 최대 12개입니다.');const ids=new Set<string>();maneuvers=(p.maneuvers as unknown[]).map(value=>{const n=obj(value);exactKeys(n,['id','time','progradeMps','radialMps','normalMps']);const id=string(n.id,80,'기동 ID');if(!id||ids.has(id))fail('기동 ID가 비어 있거나 중복됩니다.');ids.add(id);return {id,time:number(n.time,0,duration,'기동 시각'),progradeMps:number(n.progradeMps,-400,400,'진행 기동'),radialMps:number(n.radialMps,-400,400,'반경 기동'),normalMps:number(n.normalMps,-400,400,'법선 기동')};});}
 const operations=(p.operations as unknown[]).map(x=>{const o=obj(x);exactKeys(o,['id','kind','start','end']);const id=string(o.id,80,'작업 ID');if(!id||opIds.has(id))fail('작업 ID가 중복됩니다.');opIds.add(id);if(!['charge','observe','downlink'].includes(o.kind as string))fail('알 수 없는 작업입니다.');const start=number(o.start,0,duration,'작업 시작'),end=number(o.end,0,duration,'작업 끝');if(end<=start)fail('작업 끝은 시작 이후여야 합니다.');return {id,kind:o.kind,start,end} as Design['plan']['operations'][number];});
 return {version:1,missionId,name,seed,parts,...(hardware?{hardwareVersion:HARDWARE_VERSION,busId:d.busId as Design['busId'],...(d.activeRadioId?{activeRadioId:d.activeRadioId as string}:{})}:{}),...(d.hazard?{hazard:d.hazard as 'none'|'debris'}:{}),...(scienceTarget?{scienceTarget}:{}),...(d.launchPackageId?{launchPackageId:d.launchPackageId as LaunchPackageId}:{}),plan:{altitudeKm:number(p.altitudeKm,180,2000,'궤도 고도'),inclinationDeg:number(p.inclinationDeg,0,180,'경사각'),burnTime:number(p.burnTime,0,duration,'기동 시각'),progradeMps:number(p.progradeMps,-400,400,'진행 기동'),normalMps:number(p.normalMps,-400,400,'법선 기동'),radialMps:number(p.radialMps,-400,400,'반경 기동'),periapsisAltitudeKm:number(p.periapsisAltitudeKm,100,20000,'최근접 고도'),bPlaneAngleDeg:number(p.bPlaneAngleDeg,-180,180,'접근 각도'),operations,...(maneuvers?{maneuvers}:{}),...(earthOrbit?{earthOrbit}:{})}};
}
export function makeSave(design:Design,simulation?:SimulationState,previousResult?:MissionResult):SaveFile {
 return {format:'orbital-foundry',version:1,modelVersion:earthOrbitModelVersion(design.plan,isHardwareDesign(design)?HARDWARE_SIM_MODEL_VERSION:MODEL_VERSION),...(isHardwareDesign(design)?{hardwareCatalogHash:HARDWARE_CATALOG_HASH}:{}),savedAt:new Date().toISOString(),design:structuredClone(design),...(simulation?{simulation:structuredClone(simulation)}:{}),...(previousResult?{previousResult:structuredClone(previousResult)}:{})};
}
export function serializeSave(save:SaveFile):string{return JSON.stringify(save,null,2);}
function replay(design:Design,time:number,history:unknown):SimulationState{
 if(history!==undefined&&(!Array.isArray(history)||history.length>128))fail('명령 이력을 확인하세요.');
 const state=createSimulation(design);let previousTime=-1;
 for(const raw of (history||[]) as unknown[]){const c=obj(raw);exactKeys(c,['id','kind','requestedAt','durationSeconds','status','sentAt','arrivesAt','executedAt','reason']);
   if(!['charge','observe','downlink','resume'].includes(c.kind as string))fail('알 수 없는 지상 명령입니다.');
   const requestedAt=number(c.requestedAt,0,time,'명령 요청 시각');if(requestedAt%5!==0||requestedAt<previousTime)fail('명령 시각 순서가 올바르지 않습니다.');previousTime=requestedAt;
   const duration=number(c.durationSeconds,0,7200,'명령 길이');if(c.kind!=='resume'&&(duration<5||duration%5!==0))fail('명령 길이 경계가 올바르지 않습니다.');
   advanceSimulation(state,requestedAt-state.time);if(state.status!=='running')fail('종료된 실행에 새 명령이 있습니다.');queueCommand(state,c.kind as CommandKind,c.kind==='resume'?5:duration);
 }
 advanceSimulation(state,time-state.time);
 const input=(history||[]) as Record<string,unknown>[];
 for(let i=0;i<input.length;i++){const raw=input[i],actual=state.commands[i];for(const k of ['id','status','sentAt','arrivesAt','executedAt'] as const){if(raw[k]!==actual[k])fail(`명령 ${k}가 재현 결과와 다릅니다.`);}}
 return state;
}
export function parseSave(text:string):SaveFile{
 if(text.length>2e6)fail('파일이 2 MB 한도를 초과합니다.');let value:unknown;try{value=JSON.parse(text);}catch{fail('올바른 JSON이 아닙니다.');}
 const o=obj(value);exactKeys(o,['format','version','modelVersion','savedAt','design','simulation','previousResult','migrationNotice','hardwareCatalogHash']);if(o.format!=='orbital-foundry'||o.version!==1||![MODEL_VERSION,HARDWARE_SIM_MODEL_VERSION,`${MODEL_VERSION}+${EARTH_ORBIT_VERSION}`,`${HARDWARE_SIM_MODEL_VERSION}+${EARTH_ORBIT_VERSION}`,'1.0.0','1.1.0','1.2.0'].includes(o.modelVersion as string))fail('호환되지 않는 게임 또는 모델 버전입니다.');
 const savedAt=string(o.savedAt,50,'저장 시각');if(!Number.isFinite(Date.parse(savedAt)))fail('저장 시각이 올바르지 않습니다.');const design=validateDesign(o.design);
 const expectedModel=earthOrbitModelVersion(design.plan,isHardwareDesign(design)?HARDWARE_SIM_MODEL_VERSION:MODEL_VERSION);
 if((design.plan.earthOrbit!==undefined||String(o.modelVersion).includes(EARTH_ORBIT_VERSION))&&o.modelVersion!==expectedModel)fail('지구 초기 궤도·RTN 계산 모델이 다릅니다.');
 if(isHardwareDesign(design)&&(o.modelVersion!==expectedModel||o.hardwareCatalogHash!==HARDWARE_CATALOG_HASH))fail('하드웨어 계산 모델 또는 카탈로그 해시가 다릅니다.');if(!isHardwareDesign(design)&&(o.modelVersion===HARDWARE_SIM_MODEL_VERSION||o.hardwareCatalogHash!==undefined))fail('기존 설계와 새 하드웨어 모델이 혼합되었습니다.');
 const result:SaveFile={format:'orbital-foundry',version:1,modelVersion:expectedModel,savedAt,design,...(isHardwareDesign(design)?{hardwareCatalogHash:HARDWARE_CATALOG_HASH}:{})};
 if(o.modelVersion!==expectedModel){result.migrationNotice=`부품·전력·자세·발사 모델이 ${MODEL_VERSION}로 갱신되었습니다. 설계는 복원했으며 이전 모델의 실행·점수는 재계산을 위해 초기화했습니다.`;return result;}
 if(o.simulation!==undefined){const raw=obj(o.simulation);if(raw.modelVersion!==expectedModel||raw.version!==1)fail('실행 모델 버전이 다릅니다.');const sd=validateDesign(raw.design);if(JSON.stringify(sd)!==JSON.stringify(design))fail('저장 설계와 실행 설계가 다릅니다.');const time=number(raw.time,0,MISSIONS[design.missionId].duration,'실행 시간'),remainder=number(raw.remainder,0,5,'미처리 시간');if(time%5!==0)fail('실행 시간이 체크포인트 경계가 아닙니다.');
   // Recreate deterministic state instead of trusting imported resources or packet totals.
   const simulated=replay(design,time,raw.commands);simulated.remainder=remainder;
   for(const key of ['energyWh','fuelKg','scienceReceived','tick'] as const){const old=number(raw[key],0,1e12,key);if(Math.abs(old-simulated[key])>1e-6)fail(`${key}가 재현 결과와 다릅니다.`);}
   if(raw.status!==simulated.status)fail('임무 상태가 재현 결과와 다릅니다.');result.simulation=simulated;
   if(raw.executedBurnIds!==undefined&&JSON.stringify(raw.executedBurnIds)!==JSON.stringify(simulated.executedBurnIds))fail('기동 실행 이력이 재현 결과와 다릅니다.');
   if(!Array.isArray(raw.attitudeQuaternion)||raw.attitudeQuaternion.length!==4||raw.attitudeQuaternion.some((v,i)=>typeof v!=='number'||!Number.isFinite(v)||Math.abs(v-simulated.attitudeQuaternion![i])>1e-8))fail('기체 자세가 재현 결과와 다릅니다.');
   if(isHardwareDesign(design)){for(const key of ['hardwareData','dataPackets','inFlight'] as const)if(JSON.stringify(raw[key])!==JSON.stringify(simulated[key]))fail(`${key}가 재현 결과와 다릅니다.`);}
 }
 if(o.previousResult!==undefined){const raw=obj(o.previousResult),previousDesign=validateDesign(raw.design),evaluatedAt=raw.evaluatedAt===undefined?MISSIONS[previousDesign.missionId].duration:number(raw.evaluatedAt,0,MISSIONS[previousDesign.missionId].duration,'결과 평가 시각');if(evaluatedAt%5!==0)fail('결과 평가 시각이 체크포인트 경계가 아닙니다.');const reproduced=getResult(replay(previousDesign,evaluatedAt,raw.commandHistory));if((previousDesign.plan.earthOrbit!==undefined||String(raw.modelVersion).includes(EARTH_ORBIT_VERSION))&&(raw.modelVersion!==reproduced.modelVersion||raw.scoreDefinitionId!==reproduced.scoreDefinitionId))fail('이전 결과의 지구 초기 궤도·RTN 모델 또는 점수 정의가 다릅니다.');if(raw.status!==reproduced.status||raw.score!==reproduced.score||raw.received!==reproduced.received)fail('이전 결과가 재현 결과와 다릅니다.');result.previousResult=reproduced;}
 return result;
}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('브라우저 저장소를 사용할 수 없습니다. JSON 백업을 다운로드하세요.'));return;}const request=indexedDB.open('orbital-foundry',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('saves'))request.result.createObjectStore('saves');};request.onerror=()=>reject(request.error||new Error('저장소 접근에 실패했습니다.'));request.onsuccess=()=>resolve(request.result);});}
export async function saveLocal(save:SaveFile):Promise<void>{const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(serializeSave(save),isHardwareDesign(save.design)?'autosave:hardware-2.0.0':'autosave');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('저장 공간이 부족합니다. JSON 백업을 사용하세요.'));tx.onabort=()=>reject(tx.error||new Error('저장 트랜잭션이 취소되었습니다.'));});}finally{db.close();}}
export async function loadLocal(profile:'legacy'|'hardware'='legacy'):Promise<SaveFile|null>{const db=await database();try{return await new Promise<SaveFile|null>((resolve,reject)=>{const tx=db.transaction('saves','readonly'),request=tx.objectStore('saves').get(profile==='hardware'?'autosave:hardware-2.0.0':'autosave');request.onsuccess=()=>{try{resolve(request.result?parseSave(request.result):null);}catch(e){reject(e);}};request.onerror=()=>reject(request.error);});}finally{db.close();}}
