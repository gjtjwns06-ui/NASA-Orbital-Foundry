import {BUS,PARTS,createDesign} from '../sim/catalog';
import {getBusDefinition,getPartDefinition,isHardwareDesign,resolveHardware,HARDWARE_TRANSFER_MISSION_BUDGET,LEGACY_TRANSFER_MISSION_BUDGET} from '../hardware';
import {evaluateDesign} from '../sim/assembly';
import {availableDeltaV,fuelForDeltaV} from '../sim/physics';
import {stowedEnvelope} from '../sim/launch';
import type {Design,Warning} from '../sim/types';
import {DAY_S,solvePatchedTransfer} from './math';
import {EPHEMERIS_END_JD_TDB,EPHEMERIS_START_JD_TDB,TRANSFER_DATASET_ID,TRANSFER_DATA_SOURCES,tdbCalendarToJd,transferEphemerides} from './ephemeris';
import type {EscapeStage,EscapeStageEvaluation,EscapeStageId,FullTransferPlan,FullTransferSolution,TransferSolveResult} from './types';
import {freezeTransferInput} from './immutable';
export const TRANSFER_MODEL_VERSION='transfer-1.0.0';
export const TRANSFER_MISSION_BUDGET=LEGACY_TRANSFER_MISSION_BUDGET;
export {HARDWARE_TRANSFER_MISSION_BUDGET} from '../hardware';
export const ESCAPE_STAGES:Readonly<Record<EscapeStageId,EscapeStage>>=Object.freeze({
 pathfinder:{id:'pathfinder',name:'패스파인더 탈출 단계',description:'좋은 발사 창에 맞춘 경량 단계',dryMassKg:28,fuelKg:240,ispS:330,maxPayloadKg:85,payloadFairingDiameterM:2.8,payloadFairingHeightM:3,cost:95,provenance:'game-assumption'},
 explorer:{id:'explorer',name:'익스플로러 탈출 단계',description:'출발 에너지와 탑재량에 여유가 있는 단계',dryMassKg:40,fuelKg:380,ispS:340,maxPayloadKg:110,payloadFairingDiameterM:3.2,payloadFairingHeightM:3.6,cost:140,provenance:'game-assumption'},
 heavy:{id:'heavy',name:'헤비 탈출 단계',description:'큰 추진제와 페어링을 제공하는 고비용 단계',dryMassKg:60,fuelKg:600,ispS:350,maxPayloadKg:140,payloadFairingDiameterM:3.8,payloadFairingHeightM:4.4,cost:210,provenance:'game-assumption'},
});
export function createTransferPlan(preset:'balanced'|'science'='balanced'):FullTransferPlan {
 const departure=tdbCalendarToJd(preset==='balanced'?'2026-11-15':'2026-11-03'),flightDays=preset==='balanced'?260:285,peri=flightDays*DAY_S;
 return {version:1,ephemerisDatasetId:TRANSFER_DATASET_ID,departurePeriapsisJdTdb:departure,arrivalPeriapsisJdTdb:departure+flightDays,earthParkingAltitudeKm:300,marsPeriapsisAltitudeKm:preset==='balanced'?1000:1500,departurePlaneAngleRad:0,marsBPlaneAngleRad:preset==='balanced'?0:Math.PI/4,launchStageId:preset==='balanced'?'pathfinder':'explorer',operations:[{id:'encounter-science',kind:'observe',start:peri-5400,end:peri+5400},{id:'science-return',kind:'downlink',start:peri+5400,end:peri+2*DAY_S}]};
}
/** Authored operations for the hardware profile: repeated charging windows
 * compensate for the real Sun/Earth pointing conflict of the reference route. */
export function createHardwareTransferPlan(preset:'balanced'|'science'='balanced'):FullTransferPlan {
 const plan=createTransferPlan(preset);if(preset==='science')return plan;
 const peri=(plan.arrivalPeriapsisJdTdb-plan.departurePeriapsisJdTdb)*DAY_S;
 plan.operations=[{id:'encounter-science',kind:'observe',start:peri-3600,end:peri+1800}];
 for(let i=0;i<16;i++){const start=peri+1800+i*10800;plan.operations.push({id:`science-return-${i+1}`,kind:'downlink',start,end:start+3600});}
 return plan;
}
function bound(value:number,min:number,max:number,name:string){if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${name} 범위는 ${min}~${max}입니다.`);}
export function validateTransferPlan(plan:FullTransferPlan):void {
 if(plan.version!==1||plan.ephemerisDatasetId!==TRANSFER_DATASET_ID)throw new Error('전이 계획 또는 천체력 자료 버전이 다릅니다.');
 bound(plan.departurePeriapsisJdTdb,EPHEMERIS_START_JD_TDB,EPHEMERIS_END_JD_TDB-125,'출발 TDB');bound(plan.arrivalPeriapsisJdTdb,plan.departurePeriapsisJdTdb+120,Math.min(plan.departurePeriapsisJdTdb+450,EPHEMERIS_END_JD_TDB-5),'도착 TDB');
 bound(plan.earthParkingAltitudeKm,200,1000,'지구 주차 고도');bound(plan.marsPeriapsisAltitudeKm,250,10000,'화성 최근접 고도');bound(plan.departurePlaneAngleRad,-Math.PI,Math.PI,'출발 평면 각');bound(plan.marsBPlaneAngleRad,-Math.PI,Math.PI,'B-plane 각');
 if(!Object.hasOwn(ESCAPE_STAGES,plan.launchStageId))throw new Error('알 수 없는 탈출 단계입니다.');
 if(!Array.isArray(plan.operations)||plan.operations.length>40)throw new Error('운영 일정이 올바르지 않습니다.');
 const ids=new Set<string>();for(const op of plan.operations){if(typeof op.id!=='string'||!op.id||op.id.length>80||ids.has(op.id))throw new Error('작업 ID가 잘못되거나 중복됩니다.');ids.add(op.id);if(!['charge','observe','downlink'].includes(op.kind))throw new Error('알 수 없는 작업입니다.');bound(op.start,0,455*DAY_S,'작업 시작');bound(op.end,op.start+1,455*DAY_S,'작업 종료');}
 for(let i=0;i<plan.operations.length;i++)for(let j=i+1;j<plan.operations.length;j++){const a=plan.operations[i],b=plan.operations[j];if(a.start<b.end&&b.start<a.end)throw new Error('작업 시간이 겹칩니다.');}
}
/** Canonical structural/resource view, deliberately ignoring old M01/M02 trajectory settings. */
export function transferCraftDesign(craft:Design):Design {const d=structuredClone(craft),base=createDesign('mars');return {...d,missionId:'mars',hazard:'none',scienceTarget:undefined,launchPackageId:undefined,plan:{...base.plan,operations:[]}};}
export function solveTransferPlan(input:FullTransferPlan):FullTransferSolution {
 validateTransferPlan(input);const plan=structuredClone(input),tables=transferEphemerides(),trajectory=solvePatchedTransfer(tables.earth,tables.mars,plan),periapsisSeconds=(plan.arrivalPeriapsisJdTdb-plan.departurePeriapsisJdTdb)*DAY_S,earthExitSeconds=(trajectory.exitJdTdb-plan.departurePeriapsisJdTdb)*DAY_S,marsEntrySeconds=(trajectory.entryJdTdb-plan.departurePeriapsisJdTdb)*DAY_S,durationSeconds=periapsisSeconds+trajectory.marsLocal.secondsToPeriapsis;
 if(durationSeconds/DAY_S+plan.departurePeriapsisJdTdb>EPHEMERIS_END_JD_TDB-.05)throw new Error('임무 종료가 검증된 천체력 범위를 벗어납니다.');
 const scheduleWarnings=plan.operations.filter(op=>op.end>durationSeconds).map(op=>durationSeconds-op.start<1
  ?`${op.id}: 임무 종료 전에 남는 시간이 1초 미만이어서 이 작업은 실행하지 않습니다.`
  :`${op.id}: 화성 영향권 이탈 이후의 일정 구간은 임무 종료 시각에서 잘립니다.`);
 // Keep the normalized plan inside the same >=1 s schema used by strict saves.
 // A boundary-clipped fraction of a second must not create an unreadable save.
 plan.operations=plan.operations.map(op=>({...op,end:Math.min(op.end,durationSeconds)})).filter(op=>op.end-op.start>=1);
 const phaseEvents=([['departure',0],['earth-exit',earthExitSeconds],['mars-entry',marsEntrySeconds],['periapsis',periapsisSeconds],['mars-exit',durationSeconds]] as const).map(([id,elapsedSeconds])=>({id,elapsedSeconds,jdTdb:plan.departurePeriapsisJdTdb+elapsedSeconds/DAY_S}));
 return freezeTransferInput({version:1,modelVersion:TRANSFER_MODEL_VERSION,status:'solved',plan,datasetId:TRANSFER_DATASET_ID,sourceHashes:{earth:TRANSFER_DATA_SOURCES.earth.sha256,mars:TRANSFER_DATA_SOURCES.mars.sha256},durationSeconds,periapsisSeconds,earthExitSeconds,marsEntrySeconds,phaseEvents,trajectory,c3Km2S2:trajectory.c3Km2S2,arrivalVInfinityKmS:trajectory.arrivalVInfinityKmS,departureVInfinityKmS:trajectory.departureVInfinityKmS,escapeBurnMps:trajectory.escapeBurnMps,boundaryPositionResidualKm:trajectory.coast.endpointErrorKm,boundaryVelocityResidualKmS:trajectory.residualNorm,scheduleWarnings} as FullTransferSolution);
}
export function evaluateEscapeStage(solution:FullTransferSolution,craft:Design):EscapeStageEvaluation {
 const stage=ESCAPE_STAGES[solution.plan.launchStageId],normalized=transferCraftDesign(craft),structural=evaluateDesign(normalized),bus=getBusDefinition(craft),budget=isHardwareDesign(craft)?HARDWARE_TRANSFER_MISSION_BUDGET:TRANSFER_MISSION_BUDGET,payloadMassKg=structural.massKg,dryMass=stage.dryMassKg+payloadMassKg,stageInitialMassKg=dryMass+stage.fuelKg,availableDeltaVMps=availableDeltaV(dryMass,stage.fuelKg,stage.ispS),requiredDeltaVMps=solution.escapeBurnMps,fuelUsedKg=fuelForDeltaV(stageInitialMassKg,requiredDeltaVMps,stage.ispS),componentCost=bus.cost+craft.parts.reduce((sum,p)=>sum+getPartDefinition(craft,p).cost,0),totalCost=componentCost+stage.cost,shape=stowedEnvelope(craft);
 const warnings:Warning[]=structural.warnings.filter(w=>['PLACEMENT','THRUST_OFFSET','NO_SCIENCE','NO_ANTENNA','NO_SOLAR'].includes(w.code)).map(w=>({...w}));
 if(isHardwareDesign(craft))warnings.push(...resolveHardware(craft).issues);
 for(const message of solution.scheduleWarnings)warnings.push({code:'SCHEDULE_CLIPPED',severity:'warning',message});
 if(payloadMassKg>stage.maxPayloadKg)warnings.push({code:'STAGE_PAYLOAD',severity:'error',message:'선택한 탈출 단계의 탑재 질량 한도를 초과합니다.'});
 if(fuelUsedKg>stage.fuelKg+1e-8)warnings.push({code:'STAGE_FUEL',severity:'error',message:`탈출 단계 추진제가 ${(fuelUsedKg-stage.fuelKg).toFixed(1)} kg 부족합니다. 발사 날짜 또는 단계를 바꾸세요.`});
 if(shape.diameterM+.06>stage.payloadFairingDiameterM||shape.heightM+.06>stage.payloadFairingHeightM||shape.interferencePairs.length)warnings.push({code:'STAGE_FAIRING',severity:'error',message:'접은 탐사선이 탈출 단계의 탑재 페어링에 들어가지 않습니다.'});
 if(totalCost>budget)warnings.push({code:'TRANSFER_BUDGET',severity:'error',message:`임무 예산을 ${totalCost-budget} 크레딧 초과합니다.`});
 return {stage,payloadMassKg,stageInitialMassKg,stageAfterBurnMassKg:stageInitialMassKg-fuelUsedKg,availableDeltaVMps,requiredDeltaVMps,fuelUsedKg,stageFuelRemainingKg:stage.fuelKg-fuelUsedKg,payloadFuelUnchangedKg:bus.fuelKg,componentCost,stageCost:stage.cost,totalCost,budget,launchable:!warnings.some(w=>w.severity==='error'),warnings};
}
export function trySolveTransferPlan(plan:FullTransferPlan,craft:Design):TransferSolveResult {try{const solution=solveTransferPlan(plan);return {status:'solved',solution,evaluation:evaluateEscapeStage(solution,craft)};}catch(error){return {status:'infeasible',errors:[error instanceof Error?error.message:String(error)]};}}
