import {createSwingbyReplay} from '../../swingby/persistence';
import type {LoadedSwingbySave} from '../../swingby/persistence';
import {createSwingbyRuntime,advanceSwingby,getSwingbyResult,getSwingbyTelemetry} from '../../swingby/runtime';
import {getSwingbyScenario,SWINGBY_PROPULSION} from '../../swingby/scenario';
import {getSwingbyVisualTrajectory} from '../../swingby/visual';
import {swingbyStateAt} from '../../swingby/orbit';
import type {SwingbyRuntime} from '../../swingby/types';
import {HARDWARE_CATALOG_HASH} from '../../hardware';
import {utf8Length} from '../../transfer/operations-codec';
import type {ExactRunSource,VerifiedRun,RunId,Json,ReviewCursor,Sha256,Target} from '../schema';
import {ENGINE_MANIFEST_SHA256,SWINGBY_RUNTIME_SHA256} from '../engine-pin';
import {freeze,finite,hashText,hashValue,ReviewError,validateSource,MAX_ENGINE_BYTES} from '../validation';
import {semanticCraft,semanticOperations,resolvePartTarget,registerSemanticTargets} from '../semantics';
import {swingbyDiagnostics} from '../diagnostics';
import {markVerified,requireVerified} from '../compare';
import type {SwingbyReviewRenderDto,ReviewFocus,SwingbyReviewTelemetry} from '../render-types';

export interface ReviewTaskOptions {cancelled?:()=>boolean;progress?:(fraction:number,committedTime:number)=>void;yieldControl?:()=>Promise<void>;batchSteps?:number}
export const SWINGBY_REVIEW_SCORE=freeze({id:'swingby-exit-1',navigation:{direction:20,energy:20},science:{max:40,saturatedAt:'scenario.science.targetPackets'},resources:{max:20,fuelFractionWeight:.5,minEnergyFractionWeight:.5},rounding:'Math.round',implementationSha256:SWINGBY_RUNTIME_SHA256});
interface CachedSource {key:string;text:string;loaded:LoadedSwingbySave;checkpoints:SwingbyRuntime[]}
const loadedRuns=new WeakMap<VerifiedRun,CachedSource>();
const histories=new Map<string,CachedSource>();
const MAX_HISTORIES=3,MAX_CHECKPOINTS=48;
let verifiedCacheHits=0,strictVerifications=0;
function activate(entry:CachedSource){histories.delete(entry.key);histories.set(entry.key,entry);while(histories.size>MAX_HISTORIES){const oldest=histories.values().next().value!;histories.delete(oldest.key);oldest.checkpoints.length=0;}}
function cloneRuntime(source:SwingbyRuntime){const state=structuredClone(source);freeze(state.craft);freeze(state.solution);return state;}
function remember(entry:CachedSource,state:SwingbyRuntime,force=false){
 if(entry.checkpoints.some(s=>s.time===state.time))return;
 const end=entry.loaded.runtime!.time,bucket=(t:number)=>Math.floor(t/Math.max(1,end/40));
 if(!force&&entry.checkpoints.some(s=>bucket(s.time)===bucket(state.time)))return;
 entry.checkpoints.push(freeze(structuredClone(state)) as SwingbyRuntime);entry.checkpoints.sort((a,b)=>a.time-b.time);
 while(entry.checkpoints.length>MAX_CHECKPOINTS){let best=1,gap=Infinity;for(let i=1;i<entry.checkpoints.length-1;i++){const span=entry.checkpoints[i+1].time-entry.checkpoints[i-1].time;if(span<gap){gap=span;best=i;}}entry.checkpoints.splice(best,1);}
}
export function reviewCacheStats(){return {strictVerifications,verifiedCacheHits,histories:Array.from(histories.values()).map(e=>({key:e.key,checkpointCount:e.checkpoints.length,checkpointTimes:e.checkpoints.map(s=>s.time)})),limits:{sources:MAX_HISTORIES,checkpointsPerSource:MAX_CHECKPOINTS}};}
const defaultYield=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
function check(options:ReviewTaskOptions){if(options.cancelled?.())throw new ReviewError('REVIEW_CANCELLED');}
function batch(options:ReviewTaskOptions){const n=options.batchSteps??128;if(!Number.isInteger(n)||n<1||n>500)throw new ReviewError('INVALID_BATCH');return n;}
async function strictReplay(text:string,options:ReviewTaskOptions){
 check(options);batch(options);if(typeof text!=='string'||text.length>MAX_ENGINE_BYTES||utf8Length(text)>MAX_ENGINE_BYTES)throw new ReviewError('REVIEW_SIZE');
 const sourceHash=hashText(text),existing=Array.from(histories.values()).find(e=>e.text===text&&e.key.startsWith(sourceHash+':'));
 if(existing){activate(existing);verifiedCacheHits++;options.progress?.(1,existing.loaded.runtime!.time);check(options);return existing;}
 const task=createSwingbyReplay(text),steps=batch(options);strictVerifications++;
 try{while(task.progress.status==='running'){check(options);task.step(steps);options.progress?.(task.progress.fraction,task.progress.committedTime);if(task.progress.status==='running')await(options.yieldControl??defaultYield)();}check(options);const loaded=task.result();if(!loaded.runtime)throw new ReviewError('ACTUAL_RUN_REQUIRED');const entry:CachedSource={key:`${sourceHash}:${ENGINE_MANIFEST_SHA256}:${hashValue(loaded.numerics)}`,text,loaded:freeze(loaded),checkpoints:[]};remember(entry,loaded.runtime,true);activate(entry);return entry;}catch(e){task.cancel();throw e;}
}
function verified(source:ExactRunSource,entry:CachedSource):VerifiedRun{
 const loaded=entry.loaded;
 const state=loaded.runtime!,r=getSwingbyResult(state),scenario=getSwingbyScenario();
 if(source.capture.committedTimeSeconds!==state.time||source.capture.requestedTimeSeconds!==state.requestedTime)throw new ReviewError('CAPTURE_TIME_MISMATCH');
 const run:VerifiedRun={source,identity:{modelVersion:r.modelVersion,adapterId:'m02b-strict-replay',adapterVersion:'1.0.0',engineManifestSha256:ENGINE_MANIFEST_SHA256 as Sha256,hardwareCatalogSha256:HARDWARE_CATALOG_HASH as Sha256,scenarioId:scenario.id,scenarioSha256:scenario.hash as Sha256,propulsionProfileSha256:SWINGBY_PROPULSION.hash as Sha256,networkModelSha256:null,ephemerisDatasetId:scenario.ephemeris.datasetId,ephemerisSourceHashes:{earth:scenario.ephemeris.earthHash as Sha256,mars:scenario.ephemeris.marsHash as Sha256},frame:'ICRF',timeScale:'TDB',initialEpochJdTdb:scenario.epochJdTdb,initialPhysicalConditionsSha256:hashValue({initial:scenario.initial,initialFuelKg:scenario.initialFuelKg,epochJdTdb:scenario.epochJdTdb}),requirementsSha256:hashValue({exit:scenario.exit,science:scenario.science,safetyAltitudeKm:scenario.safetyAltitudeKm,deadlineSeconds:scenario.deadlineSeconds}),numericalPolicySha256:hashValue(loaded.numerics),score:{id:r.scoreDefinitionId,definitionSha256:hashValue(SWINGBY_REVIEW_SCORE),origin:'pinned-version-adapter',implementationSha256:SWINGBY_RUNTIME_SHA256 as Sha256},logCoverage:'complete'},simulationStatus:state.status,evaluation:{committedTimeSeconds:state.time,final:state.status!=='running',completionPolicyId:'swingby-1.0.0:actual-patch-exit-or-deadline-or-physical-failure',stopReason:state.failureReason??(state.status==='complete'?'SUPPORTED_ENCOUNTER_END':null)},result:{status:r.status as VerifiedRun['result']['status'],score:r.score,received:r.received,required:r.required,energyMinimumWh:r.energyMinimumWh,fuelRemainingKg:r.fuelRemainingKg,totalCost:r.totalCost,budgetRemaining:r.budgetRemaining,navigation:{directionErrorDeg:r.achievedExit?.directionErrorDeg??null,specificEnergyKm2S2:r.achievedExit?.energyKm2S2??null,directionPassed:r.achievedExit?.directionPassed??null,energyPassed:r.achievedExit?.energyPassed??null,minimumAltitudeKm:state.minimumAltitudeKm}},semanticInputs:{craft:semanticCraft(loaded.craft),trajectoryPlan:{aim:loaded.plan.aim},initialOperations:semanticOperations(loaded.plan),groundActions:[],installedRevisions:[]},diagnostics:swingbyDiagnostics(state,source.runId)};
 const accepted=markVerified(run);loadedRuns.set(accepted,entry);registerSemanticTargets(accepted,loaded.craft,loaded.plan);return accepted;
}
export async function pinSwingbyRun(engineSaveText:string,metadata:{runId:string;displayName:string;pinnedAtUtc?:string;origin?:ExactRunSource['capture']['origin']},options:ReviewTaskOptions={}):Promise<VerifiedRun>{
 const entry=await strictReplay(engineSaveText,options),state=entry.loaded.runtime!;
 const source=validateSource({format:'orbital-foundry-review-run',version:1,runId:metadata.runId,missionFamily:'m02b-swingby',engineSaveText,engineSaveSha256:hashText(engineSaveText),engineSaveUtf8Bytes:utf8Length(engineSaveText),pinnedAtUtc:metadata.pinnedAtUtc??new Date().toISOString(),capture:{origin:metadata.origin??'strict-engine-import',requestedTimeSeconds:state.requestedTime,committedTimeSeconds:state.time},displayName:metadata.displayName});
 return verified(source,entry);
}
export async function verifySwingbySource(input:unknown,options:ReviewTaskOptions={}):Promise<VerifiedRun>{const source=validateSource(input),entry=await strictReplay(source.engineSaveText,options);return verified(source,entry);}
export function createSwingbyAttempt(run:VerifiedRun){requireVerified(run);const loaded=loadedRuns.get(run)?.loaded;if(!loaded)throw new ReviewError('ADAPTER_MISMATCH');return {parentRunId:run.source.runId,craft:structuredClone(loaded.craft),plan:structuredClone(loaded.plan),numerics:structuredClone(loaded.numerics)};}
export function resolveSwingbyInspection(run:VerifiedRun,target:Target):{timeSeconds:number;focus:ReviewFocus}{
 requireVerified(run);const loaded=loadedRuns.get(run)?.loaded;if(!loaded?.runtime)throw new ReviewError('ADAPTER_MISMATCH');let timeSeconds=run.evaluation.committedTimeSeconds,focus:ReviewFocus;
 if(target.kind==='part'){const match=resolvePartTarget(target,loaded.craft);if(match.status==='stale'||match.status==='ambiguous')throw new ReviewError('TARGET_'+match.status.toUpperCase());focus={kind:'part',partIds:match.partIds,mapping:match.status};}
 else if(target.kind==='part-family')focus={kind:'part-family',partKind:target.partKind,partIds:loaded.craft.parts.filter(p=>p.kind===target.partKind).map(p=>p.id)};
 else if(target.kind==='operation'){
  if(target.revision!==null)throw new ReviewError('TARGET_REVISION');const matches=loaded.plan.operations.filter(o=>o.kind===target.signature.kind&&o.start===target.signature.startSeconds&&o.end===target.signature.endSeconds);if(matches.length!==1)throw new ReviewError(matches.length?'TARGET_AMBIGUOUS':'TARGET_STALE');timeSeconds=matches[0].start;focus={kind:'operation',operationId:matches[0].id,mapping:matches[0].id===target.operationId?'exact':'semantic'};
 }else if(target.kind==='maneuver'){const burn=loaded.runtime.burn;if(!burn||target.maneuverId!==burn.id||target.timeSeconds!==burn.time)throw new ReviewError('TARGET_STALE');timeSeconds=burn.time;focus={kind:'maneuver',maneuverId:burn.id};}
 else if(target.kind==='packet'){const packet=loaded.runtime.packets.find(p=>p.id===target.packetId);if(!packet)throw new ReviewError('TARGET_STALE');timeSeconds=packet.capturedAt;focus={kind:'packet',packetId:packet.id};}
 else if(target.kind==='time'){timeSeconds=target.timeSeconds;focus={kind:'time',panel:target.panel};}
 else throw new ReviewError('MODEL_UNSUPPORTED');
 finite(timeSeconds,0,run.evaluation.committedTimeSeconds);return {timeSeconds,focus};
}
/** Missing/nonfinite observational fields stay explicit null, never fabricated zero. */
function jsonObservation(value:unknown,path='',unknownFields:string[]=[]):{value:Json;unknownFields:string[]}{
 if(value===undefined||typeof value==='number'&&!Number.isFinite(value)){unknownFields.push(path);return {value:null,unknownFields};}
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number')return {value,unknownFields};
 if(Array.isArray(value))return {value:value.map((v,i)=>jsonObservation(v,`${path}[${i}]`,unknownFields).value),unknownFields};
 const out:Record<string,Json>={};for(const [k,v] of Object.entries(value as object))out[k]=jsonObservation(v,`${path}.${k}`,unknownFields).value;return {value:out,unknownFields};
}
export interface SwingbyReviewSample {cursor:ReviewCursor;renderDto:SwingbyReviewRenderDto;telemetry:SwingbyReviewTelemetry;work:{elapsedMs:number;replayedSteps:number;fromCheckpointSeconds:number}}
export async function seekSwingbyRun(run:VerifiedRun,requestedTime:number,options:ReviewTaskOptions={}):Promise<SwingbyReviewSample>{
 const started=performance.now();requireVerified(run);finite(requestedTime,0,run.evaluation.committedTimeSeconds);check(options);const entry=loadedRuns.get(run);if(!entry?.loaded.runtime)throw new ReviewError('ADAPTER_MISMATCH');const loaded=entry.loaded;activate(entry);remember(entry,loaded.runtime!,true);
 const cached=entry.checkpoints.filter(s=>s.time<=requestedTime).at(-1),state=cached?cloneRuntime(cached):createSwingbyRuntime(loaded.runtime!.solution,loaded.craft,loaded.numerics),steps=batch(options),startTick=state.tick,fromCheckpointSeconds=state.time;
 // Pending time demand is a controller queue, not physical state. This is the
 // same pause convention used by the live worker; original saved bytes stay intact.
 state.requestedTime=state.time;remember(entry,state,true);advanceSwingby(state,requestedTime-state.time,0);
 while(state.status==='running'&&state.time<requestedTime-1e-7){check(options);const tick=state.tick;advanceSwingby(state,0,steps);remember(entry,state);options.progress?.(requestedTime?state.time/requestedTime:1,state.time);if(state.tick===tick)break;if(state.time<requestedTime-1e-7)await(options.yieldControl??defaultYield)();}
 remember(entry,state,true);
 check(options);const physical=swingbyStateAt(state.actualArcs,state.time),path=getSwingbyVisualTrajectory(state),telemetry=jsonObservation(getSwingbyTelemetry(state));
 const cursor:ReviewCursor={runId:run.source.runId,sourceSha256:run.source.engineSaveSha256,requestedTimeSeconds:requestedTime,committedTimeSeconds:state.time,phase:'mars-flyby',epochJdTdb:physical.jdTdb,stateOrigin:'replayed-actual'};
 const dto=jsonObservation({craft:loaded.craft,physical,attitudeQuaternion:state.attitudeQuaternion,burn:state.burn,achievedExit:state.achievedExit,packets:state.packets,signals:state.signals,events:state.events,trajectory:{kind:'actual-history' as const,certified:path.certified,maxChordErrorKm:path.maxChordErrorKm,points:path.certified?path.points.filter(p=>p.elapsedSeconds<=state.time):[],sampleLimit:path.maxSamples},status:state.status}).value as unknown as SwingbyReviewRenderDto;
 return freeze({cursor,renderDto:dto,telemetry:{values:telemetry.value,unknownFields:telemetry.unknownFields} as unknown as SwingbyReviewTelemetry,work:{elapsedMs:performance.now()-started,replayedSteps:state.tick-startTick,fromCheckpointSeconds}});
}
