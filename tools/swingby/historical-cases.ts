import {createOperationsLesson} from '../../src/transfer/operations-lesson';
import {solveTransferPlan} from '../../src/transfer/planning';
import {createOperationsRuntime,advanceOperations,getOperationsTelemetry,getOperationsResult} from '../../src/transfer/runtime-v3';
import {queueTransferCommand} from '../../src/transfer/operations';
import {operationsCheckpoint} from '../../src/transfer/persistence-v2';
import {freezeTransferInput} from '../../src/transfer/immutable';
import type {OperationsRuntimeState} from '../../src/transfer/operations-types';

/** Same deterministic inputs and request sequence for pre/post extraction.
 * No supplied checkpoint or changed physical field is used to produce a run. */
export function historicalCases(notify:(name:string)=>void=()=>{}){
 const lesson=createOperationsLesson(),solution=solveTransferPlan(lesson.plan),records:{name:string;value:unknown}[]=[];
 const capture=(name:string,state:OperationsRuntimeState)=>{records.push({name,value:{checkpoint:operationsCheckpoint(state),telemetry:getOperationsTelemetry(state),result:getOperationsResult(state)}});notify(name);};
 const base=createOperationsRuntime(solution,lesson.craft,{scenarioId:lesson.id});
 advanceOperations(base,lesson.suggestedCommandAtSeconds);capture('before-send',base);
 for(const mode of ['early','none','late'] as const){
  const s=structuredClone(base);freezeTransferInput(s.craft);freezeTransferInput(s.solution);
  if(mode==='early'){
   queueTransferCommand(s,lesson.suggestedPayload,{actionId:'fixture-send',commandId:'fixture-command',expiresAtSeconds:lesson.suggestedExpirySeconds});capture('queued',s);
   advanceOperations(s,1);capture('partial-transmit',s);
   const a=s.operations.commands[0].attempts[0];advanceOperations(s,a.plannedTransmitEndSeconds!-s.requestedTime);capture('propagating',s);
   advanceOperations(s,a.lastBit!.arrivesAtSeconds-s.requestedTime);capture('installed-before-ack',s);
   const ack=s.operations.commands[0].acknowledgements[0];advanceOperations(s,ack.lastBit!.emittedAtSeconds-s.requestedTime);capture('ack-propagating',s);
   advanceOperations(s,ack.lastBit!.arrivesAtSeconds-s.requestedTime);capture('ack-received',s);
  }
  if(mode==='late'){advanceOperations(s,lesson.suggestedPayload.replaceFromSeconds-300-s.requestedTime);queueTransferCommand(s,lesson.suggestedPayload,{actionId:'late-action',commandId:'late-command',expiresAtSeconds:lesson.suggestedExpirySeconds});}
  advanceOperations(s,solution.durationSeconds-s.requestedTime);capture(`full-${mode}`,s);
 }
 for(const active of [1,.5,.25] as const){
  const s=createOperationsRuntime(solution,lesson.craft,{scenarioId:lesson.id,activeStepSeconds:active});
  for(const offset of [5,15,30,60,120,300,600]){advanceOperations(s,lesson.listeningWindow.start+offset-s.requestedTime);capture(`slew-${active}-${offset}`,s);}
  advanceOperations(s,lesson.suggestedCommandAtSeconds-s.requestedTime);queueTransferCommand(s,lesson.suggestedPayload,{actionId:'fixture-send',commandId:'fixture-command',expiresAtSeconds:lesson.suggestedExpirySeconds});
  for(const offset of [5,15,30,60,120,300,600]){advanceOperations(s,lesson.suggestedPayload.replaceFromSeconds+offset-s.requestedTime);capture(`observe-${active}-${offset}`,s);}
 }
 return {inputs:{lesson,solution},records};
}
