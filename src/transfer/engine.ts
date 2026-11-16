/** Explicit version dispatch. Released runtime 1/2 defaults remain unchanged. */
import type {Design} from '../sim/types';
import type {FullTransferPlan,FullTransferSolution,TransferSolveResult} from './types';
import type {TransferTelemetry,TransferResult} from './runtime';
import {createTransferRuntime,advanceTransfer,getTransferTelemetry,getTransferResult} from './runtime';
import {trySolveTransferPlan} from './planning';
import {makeTransferSave,serializeTransferSave,parseTransferSave,saveTransferLocal,loadTransferLocalText} from './persistence';
import type {TransferSaveFile} from './persistence';
import {OPERATIONS_MODEL_VERSION} from './operations-types';
import type {AnyTransferRuntimeState,TransferEngineOptions,OperationsRuntimeState,OperationsSaveFile,OperationsLesson,OperationsNumerics,ScheduleReplacement,QueueCommandOptions,GroundAction,OperationsSnapshot,CommandPreview,TransferReplayTask} from './operations-types';
import {OperationsError} from './operations-codes';
import {createOperationsRuntime,advanceOperations,getOperationsTelemetry,getOperationsResult} from './runtime-v3';
import * as commands from './operations';
import {createOperationsLesson as operationsLesson} from './operations-lesson';
import {makeOperationsSave,serializeOperationsSave,saveOperationsLocal,loadOperationsLocalText,createOperationsReplay} from './persistence-v2';
import {isHardwareDesign} from '../hardware';
import {utf8Length} from './operations-codec';
import {COMMAND_NETWORK} from './command-network';
export * from './operations-types';
export * from './operations-codes';
export interface OperationsTelemetry extends TransferTelemetry {radioMode:'off'|'rx'|'tx'|'rx-tx';receiverPowered:boolean;commandUplinkActive:boolean;ackDownlinkActive:boolean;operations:OperationsSnapshot}
export type AnyTransferSave=TransferSaveFile|OperationsSaveFile;
export type TransferEngineProfile='legacy'|'hardware'|'operations';
export interface TransferEngineSaveOptions extends TransferEngineOptions {numerics?:OperationsNumerics;editorDraft?:ScheduleReplacement}
export interface LoadedTransferEngineSave {plan:FullTransferPlan;craft:Design;runtime?:AnyTransferRuntimeState;editorDraft?:ScheduleReplacement;modelVersion:string;scenarioId?:string;numerics?:OperationsNumerics;save:AnyTransferSave}
function checkedOptions(craft:Design,input:TransferEngineOptions,save=false){const o=commands.operationsObject(input);commands.operationsKeys(o,save?['modelVersion','scenarioId','integrationStepSeconds','activeStepSeconds','numerics','editorDraft']:['modelVersion','scenarioId','integrationStepSeconds','activeStepSeconds']);const model=o.modelVersion??(isHardwareDesign(craft)?'transfer-2.0.0':'transfer-1.0.0');if(model!=='transfer-1.0.0'&&model!=='transfer-2.0.0'&&model!==OPERATIONS_MODEL_VERSION||model==='transfer-1.0.0'&&isHardwareDesign(craft)||model==='transfer-2.0.0'&&!isHardwareDesign(craft))throw new OperationsError('MODEL_UNSUPPORTED');if(o.integrationStepSeconds!==undefined&&o.integrationStepSeconds!==300&&o.integrationStepSeconds!==600)throw new OperationsError('INVALID_INPUT');if(o.activeStepSeconds!==undefined&&(model!==OPERATIONS_MODEL_VERSION||o.activeStepSeconds!==1&&o.activeStepSeconds!==.5&&o.activeStepSeconds!==.25))throw new OperationsError('INVALID_INPUT');if(o.scenarioId!==undefined){if(model!==OPERATIONS_MODEL_VERSION)throw new OperationsError('INVALID_INPUT');commands.operationsId(o.scenarioId);}if(model!==OPERATIONS_MODEL_VERSION&&(o.numerics!==undefined||o.editorDraft!==undefined))throw new OperationsError('MODEL_UNSUPPORTED');return model;}
export function isOperationsRuntime(state:AnyTransferRuntimeState):state is OperationsRuntimeState{return state.modelVersion===OPERATIONS_MODEL_VERSION;}
export function createTransferEngineRuntime(solution:FullTransferSolution,craft:Design,options:TransferEngineOptions={}):AnyTransferRuntimeState {if(checkedOptions(craft,options)===OPERATIONS_MODEL_VERSION)return createOperationsRuntime(solution,craft,options);return createTransferRuntime(solution,craft,options.integrationStepSeconds??600);}
export function advanceTransferEngine(state:AnyTransferRuntimeState,elapsedSeconds:number,maxSteps=Infinity):AnyTransferRuntimeState {return isOperationsRuntime(state)?advanceOperations(state,elapsedSeconds,maxSteps):advanceTransfer(state,elapsedSeconds,maxSteps);}
export function getTransferEngineTelemetry(state:AnyTransferRuntimeState):TransferTelemetry|OperationsTelemetry {return isOperationsRuntime(state)?getOperationsTelemetry(state):getTransferTelemetry(state);}
export function getTransferEngineResult(state:AnyTransferRuntimeState):TransferResult {return isOperationsRuntime(state)?getOperationsResult(state):getTransferResult(state);}
export function trySolveTransferEnginePlan(plan:FullTransferPlan,craft:Design,options:TransferEngineOptions={}):TransferSolveResult {const model=checkedOptions(craft,options),result=trySolveTransferPlan(plan,craft);if(model===OPERATIONS_MODEL_VERSION){const issues=commands.evaluateCommandCompatibility(craft);if(issues.length)return {status:'infeasible',errors:[...(result.status==='infeasible'?result.errors:[]),...issues.map(i=>i.message)]};}return result;}
export function previewTransferEngine(solution:FullTransferSolution,craft:Design,options:TransferEngineOptions={}){const state=createTransferEngineRuntime(solution,craft,options);advanceTransferEngine(state,solution.durationSeconds);return {state,result:getTransferEngineResult(state)};}
export function createOperationsLesson(id:'iris-schedule-rescue-v1'='iris-schedule-rescue-v1'):OperationsLesson {return operationsLesson(id);}
export function queueTransferCommand(state:OperationsRuntimeState,payload:ScheduleReplacement,options:QueueCommandOptions):GroundAction {return commands.queueTransferCommand(state,payload,options);}
export function cancelUnsentTransferCommand(state:OperationsRuntimeState,commandId:string,actionId:string):GroundAction {return commands.cancelUnsentTransferCommand(state,commandId,actionId);}
export function retryTransferCommand(state:OperationsRuntimeState,commandId:string,actionId:string):GroundAction {return commands.retryTransferCommand(state,commandId,actionId);}
export function getTransferOperationsSnapshot(state:OperationsRuntimeState):OperationsSnapshot {return commands.getTransferOperationsSnapshot(state);}
export function previewTransferCommand(state:OperationsRuntimeState,payload:ScheduleReplacement,options?:Partial<QueueCommandOptions>):CommandPreview {return commands.previewTransferCommand(state,payload,options);}
export function makeTransferEngineSave(plan:FullTransferPlan,craft:Design,runtime?:AnyTransferRuntimeState,options:TransferEngineSaveOptions={}):AnyTransferSave {const model=checkedOptions(craft,{...options,modelVersion:options.modelVersion??runtime?.modelVersion} as TransferEngineSaveOptions,true);if(runtime&&model!==runtime.modelVersion)throw new OperationsError('MODEL_UNSUPPORTED');if(model===OPERATIONS_MODEL_VERSION){if(runtime&&!isOperationsRuntime(runtime))throw new OperationsError('MODEL_UNSUPPORTED');return makeOperationsSave(plan,craft,runtime,options);}return makeTransferSave(plan,craft,runtime);}
export function serializeTransferEngineSave(save:AnyTransferSave):string {return save.version===2?serializeOperationsSave(save):serializeTransferSave(save);}
export async function saveTransferEngineLocal(save:AnyTransferSave):Promise<void> {if(save.version===2)return saveOperationsLocal(save);return saveTransferLocal(save);}
export async function loadTransferEngineLocalText(profile:TransferEngineProfile='legacy'):Promise<string|null> {return profile==='operations'?loadOperationsLocalText():loadTransferLocalText(profile);}
export function createTransferEngineReplay(text:string):TransferReplayTask<LoadedTransferEngineSave> {
 // Version-1 is intentionally still the released strict parser. Version-2 will
 // supply a bounded, cancellable journal-replay task with the same public shape.
 let value:LoadedTransferEngineSave|undefined,status:'running'|'complete'|'cancelled'='running';
 if(typeof text!=='string'||text.length>COMMAND_NETWORK.maximumSaveBytes||utf8Length(text)>COMMAND_NETWORK.maximumSaveBytes)throw new OperationsError('SAVE_TOO_LARGE');let input:unknown;try{input=JSON.parse(text);}catch{throw new OperationsError('INVALID_INPUT','Invalid JSON.');}const raw=commands.operationsObject(input);if(raw.version===2)return createOperationsReplay(text);if(raw.version!==1)throw new OperationsError('MODEL_UNSUPPORTED');
 const progress=()=>({status,fraction:status==='complete'?1:0,committedTime:value?.runtime?.time??0,targetTime:value?.runtime?.time??0});
 return {get progress(){return progress();},step(maxSteps=500){if(!Number.isInteger(maxSteps)||maxSteps<0)throw new OperationsError('INVALID_INPUT');if(status!=='running'||maxSteps===0)return progress();const save=parseTransferSave(text);value={plan:save.plan,craft:save.craft,runtime:save.runtime,modelVersion:save.modelVersion,save};status='complete';return progress();},cancel(){if(status==='running')status='cancelled';},result(){if(!value||status!=='complete')throw new OperationsError(status==='cancelled'?'REPLAY_CANCELLED':'BAD_CHECKPOINT');return value;}};
}
