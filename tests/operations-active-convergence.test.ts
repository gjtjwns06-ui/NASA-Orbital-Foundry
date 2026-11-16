import {describe,it,expect} from 'vitest';
import {createOperationsLesson} from '../src/transfer/operations-lesson';
import {solveTransferPlan} from '../src/transfer/planning';
import {createOperationsRuntime,advanceOperations,getOperationsTelemetry} from '../src/transfer/runtime-v3';
import {queueTransferCommand} from '../src/transfer/operations';
import {quaternionAngleDeg} from '../src/sim/attitude';
import {mkdirSync,writeFileSync} from 'node:fs';
import type {Quaternion} from '../src/sim/types';
type Sample={time:number;q:Quaternion;marginDb:number;slewAngleDeg:number};
describe('predeclared active attitude/margin convergence during transitions',()=>{
 it('retains the .05 degree/.1 dB gates through the listening and observation slews',()=>{
  const lesson=createOperationsLesson(),solution=solveTransferPlan(lesson.plan),samples=[...Array.from({length:120},(_,i)=>lesson.listeningWindow.start+(i+1)*5),...Array.from({length:120},(_,i)=>lesson.suggestedPayload.replaceFromSeconds+(i+1)*5)],runs:{active:number;values:Sample[]}[]=[];
  for(const active of [1,.5,.25] as const){const state=createOperationsRuntime(solution,lesson.craft,{activeStepSeconds:active}),values:Sample[]=[];let sent=false;for(const time of samples){if(!sent&&time>lesson.suggestedCommandAtSeconds){advanceOperations(state,lesson.suggestedCommandAtSeconds-state.requestedTime);queueTransferCommand(state,lesson.suggestedPayload,{actionId:'send',commandId:'slew-check',expiresAtSeconds:lesson.suggestedExpirySeconds});sent=true;}advanceOperations(state,time-state.requestedTime);expect(state.time).toBeLessThanOrEqual(time);const t=getOperationsTelemetry(state);if(values.at(-1)?.time!==state.time)values.push({time:state.time,q:[...state.attitudeQuaternion] as typeof state.attitudeQuaternion,marginDb:t.linkMarginDb,slewAngleDeg:t.slewAngleDeg});}expect(state.operations.onboardRevision).toBe(1);runs.push({active,values});}
  const reference=runs[2],commonTimes=reference.values.map(v=>v.time).filter(time=>runs.every(run=>run.values.some(v=>v.time===time))),differences=runs.map(run=>({active:run.active,values:commonTimes.map(time=>{const v=run.values.find(v=>v.time===time)!,ref=reference.values.find(v=>v.time===time)!;return {time:v.time,slewAngleDeg:v.slewAngleDeg,angleDifferenceDeg:quaternionAngleDeg(v.q,ref.q),marginDifferenceDb:v.marginDb-ref.marginDb};})}));expect(commonTimes.length).toBeGreaterThanOrEqual(100);expect(differences[0].values.filter(v=>v.slewAngleDeg>.25&&v.slewAngleDeg<10).length).toBeGreaterThanOrEqual(20);
  mkdirSync('docs/qa/operations',{recursive:true});writeFileSync('docs/qa/operations/active-slew-convergence.json',JSON.stringify({generatedAt:new Date().toISOString(),samples:differences},null,2));for(const run of differences)for(const sample of run.values){expect(sample.angleDifferenceDeg).toBeLessThanOrEqual(.05);expect(Math.abs(sample.marginDifferenceDb)).toBeLessThanOrEqual(.1);}expect(runs[0].values.some(v=>v.slewAngleDeg>1)).toBe(true);
 },180000);
});
