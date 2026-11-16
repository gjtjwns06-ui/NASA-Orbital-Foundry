import {validateDesign} from '../sim/persistence';
import {HARDWARE_CATALOG_HASH,HARDWARE_TRANSFER_MODEL_VERSION,isHardwareDesign} from '../hardware';
import type {Design} from '../sim/types';
import {TRANSFER_DATASET_ID,TRANSFER_DATA_SOURCES} from './ephemeris';
import {TRANSFER_MODEL_VERSION,solveTransferPlan,transferCraftDesign,validateTransferPlan} from './planning';
import {advanceTransfer,createTransferRuntime} from './runtime';
import type {FullTransferPlan,TransferRuntimeState} from './types';
export interface TransferSaveFile {
 hardwareCatalogHash?:string;
 format:'orbital-foundry-journey';version:1;modelVersion:string;datasetId:string;
 sourceHashes:{earth:string;mars:string};savedAt:string;plan:FullTransferPlan;craft:Design;runtime?:TransferRuntimeState;
}
const fail=(message:string):never=>{throw new Error(`전이 저장 오류: ${message}`);};
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))fail('객체 형식이 아닙니다.');return value as Record<string,unknown>;}
function keys(value:Record<string,unknown>,allowed:string[]){if(Object.keys(value).some(k=>!allowed.includes(k)))fail('지원하지 않는 필드가 있습니다.');}
function finite(value:unknown,min:number,max:number,label:string):number {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(`${label} 범위가 잘못됐습니다.`);return value as number;}
function planFrom(value:unknown):FullTransferPlan {
 const p=object(value);keys(p,['version','ephemerisDatasetId','departurePeriapsisJdTdb','arrivalPeriapsisJdTdb','earthParkingAltitudeKm','marsPeriapsisAltitudeKm','departurePlaneAngleRad','marsBPlaneAngleRad','launchStageId','operations']);
 if(!Array.isArray(p.operations)||p.operations.length>40)fail('운영 일정이 올바르지 않습니다.');for(const op of p.operations as unknown[])keys(object(op),['id','kind','start','end']);
 const plan=structuredClone(p) as unknown as FullTransferPlan;validateTransferPlan(plan);return plan;
}
const CHECKPOINT_KEYS=['time','requestedTime','energyWh','energyMinimumWh','fuelKg','safeMode','status','failureReason','attitudeQuaternion','packets','signals','pendingFrames','processedEventIds','lastCapture','scienceReceived','tick','integrationStepSeconds'] as const;
function checkpoint(state:TransferRuntimeState){return {...Object.fromEntries(CHECKPOINT_KEYS.map(key=>[key,structuredClone(state[key])])),...(state.hardwareData?{hardwareData:structuredClone(state.hardwareData)}:{})} as Record<string,unknown>;}
function equalTree(expected:unknown,actual:unknown,path:string):void {
 if(typeof expected==='number'){if(typeof actual!=='number'||!Number.isFinite(actual)||Math.abs(expected-actual)>1e-6)fail(`${path} 값이 재현 결과와 다릅니다.`);return;}
 if(Array.isArray(expected)){if(!Array.isArray(actual)||actual.length!==expected.length)fail(`${path} 목록이 재현 결과와 다릅니다.`);expected.forEach((v,i)=>equalTree(v,(actual as unknown[])[i],`${path}[${i}]`));return;}
 if(expected!==null&&typeof expected==='object'){const e=object(expected),a=object(actual);if(Object.keys(e).length!==Object.keys(a).length)fail(`${path} 필드가 다릅니다.`);keys(a,Object.keys(e));for(const [k,v] of Object.entries(e))equalTree(v,a[k],`${path}.${k}`);return;}
 if(actual!==expected)fail(`${path} 값이 재현 결과와 다릅니다.`);
}
/** Drafts need a valid schema, but may be physically infeasible and still worth saving. */
export function makeTransferSave(plan:FullTransferPlan,craft:Design,runtime?:TransferRuntimeState):TransferSaveFile {
 const checkedPlan=planFrom(plan),checkedCraft=transferCraftDesign(validateDesign(craft));
 if(runtime){const currentPlan=solveTransferPlan(checkedPlan).plan;equalTree(currentPlan,runtime.solution.plan,'plan');equalTree(JSON.parse(JSON.stringify(checkedCraft)),JSON.parse(JSON.stringify(runtime.craft)),'craft');}
 return {format:'orbital-foundry-journey',version:1,modelVersion:isHardwareDesign(checkedCraft)?HARDWARE_TRANSFER_MODEL_VERSION:TRANSFER_MODEL_VERSION,...(isHardwareDesign(checkedCraft)?{hardwareCatalogHash:HARDWARE_CATALOG_HASH}:{}),datasetId:TRANSFER_DATASET_ID,sourceHashes:{earth:TRANSFER_DATA_SOURCES.earth.sha256,mars:TRANSFER_DATA_SOURCES.mars.sha256},savedAt:new Date().toISOString(),plan:runtime?structuredClone(runtime.solution.plan):checkedPlan,craft:checkedCraft,...(runtime?{runtime:structuredClone(runtime)}:{})};
}
/** Save only a replay checkpoint: imported coordinates/solved paths are never accepted. */
export function serializeTransferSave(save:TransferSaveFile):string {return JSON.stringify({...save,...(save.runtime?{runtime:checkpoint(save.runtime)}:{})},null,2);}
/** Run in a worker for long checkpoints (about 2–5 seconds for the full mission). */
export function parseTransferSave(text:string):TransferSaveFile {
 if(typeof text!=='string'||text.length>2e6)fail('파일은 2 MB 이하의 JSON이어야 합니다.');let raw:unknown;try{raw=JSON.parse(text);}catch{fail('올바른 JSON이 아닙니다.');}
 const data=object(raw);keys(data,['format','version','modelVersion','datasetId','sourceHashes','savedAt','plan','craft','runtime','hardwareCatalogHash']);
 const checkedCraft=transferCraftDesign(validateDesign(data.craft)),expectedModel=isHardwareDesign(checkedCraft)?HARDWARE_TRANSFER_MODEL_VERSION:TRANSFER_MODEL_VERSION;
 if(data.format!=='orbital-foundry-journey'||data.version!==1||data.modelVersion!==expectedModel||data.datasetId!==TRANSFER_DATASET_ID||data.hardwareCatalogHash!==(isHardwareDesign(checkedCraft)?HARDWARE_CATALOG_HASH:undefined))fail('지원하지 않는 게임·모델·천체력 버전입니다.');
 equalTree({earth:TRANSFER_DATA_SOURCES.earth.sha256,mars:TRANSFER_DATA_SOURCES.mars.sha256},data.sourceHashes,'sourceHashes');
 if(typeof data.savedAt!=='string'||data.savedAt.length>50||!Number.isFinite(Date.parse(data.savedAt)))fail('저장 시각이 올바르지 않습니다.');
 const plan=planFrom(data.plan),craft=checkedCraft,save:TransferSaveFile={format:'orbital-foundry-journey',version:1,modelVersion:expectedModel,...(isHardwareDesign(craft)?{hardwareCatalogHash:HARDWARE_CATALOG_HASH}:{}),datasetId:TRANSFER_DATASET_ID,sourceHashes:{earth:TRANSFER_DATA_SOURCES.earth.sha256,mars:TRANSFER_DATA_SOURCES.mars.sha256},savedAt:data.savedAt as string,plan,craft};
 if(data.runtime!==undefined){
  const rawState=object(data.runtime);keys(rawState,[...CHECKPOINT_KEYS,...(isHardwareDesign(craft)?['hardwareData']:[])]);const solution=solveTransferPlan(plan),time=finite(rawState.time,0,solution.durationSeconds,'실행 시각'),requestedTime=finite(rawState.requestedTime,time,solution.durationSeconds,'요청 시각'),step=rawState.integrationStepSeconds;
  if(step!==300&&step!==600)fail('지원하지 않는 순항 적분 간격입니다.');
  const reproduced=createTransferRuntime(solution,craft,step as 300|600);advanceTransfer(reproduced,time);if(Math.abs(reproduced.time-time)>1e-6)fail('실행 시각이 재현 가능한 체크포인트가 아닙니다.');reproduced.requestedTime=requestedTime;
  equalTree(checkpoint(reproduced),rawState,'runtime');save.runtime=reproduced;
 }
 return save;
}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('브라우저 저장소를 사용할 수 없습니다. JSON 백업을 사용하세요.'));return;}const request=indexedDB.open('orbital-foundry-journey',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('saves'))request.result.createObjectStore('saves');};request.onerror=()=>reject(request.error||new Error('저장소를 열지 못했습니다.'));request.onsuccess=()=>resolve(request.result);});}
export async function saveTransferLocal(save:TransferSaveFile):Promise<void>{const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(serializeTransferSave(save),isHardwareDesign(save.craft)?'autosave:hardware-2.0.0':'autosave');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('저장에 실패했습니다.'));tx.onabort=()=>reject(tx.error||new Error('저장이 취소되었습니다.'));});}finally{db.close();}}
/** Load text on UI thread, then send it to the worker's parseTransferSave call. */
export async function loadTransferLocalText(profile:'legacy'|'hardware'='legacy'):Promise<string|null>{const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('saves','readonly'),r=tx.objectStore('saves').get(profile==='hardware'?'autosave:hardware-2.0.0':'autosave');r.onsuccess=()=>resolve(typeof r.result==='string'?r.result:null);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function loadTransferLocal(profile:'legacy'|'hardware'='legacy'):Promise<TransferSaveFile|null>{const text=await loadTransferLocalText(profile);return text?parseTransferSave(text):null;}
