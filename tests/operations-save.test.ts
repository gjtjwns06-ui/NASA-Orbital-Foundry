import {describe,it,expect} from 'vitest';
import {createOperationsLesson} from '../src/transfer/operations-lesson';
import {createOperationsReplay,makeOperationsSave,serializeOperationsSave} from '../src/transfer/persistence-v2';
import {createTransferEngineReplay,createTransferEngineRuntime,trySolveTransferEnginePlan} from '../src/transfer/engine';
import {solveTransferPlan} from '../src/transfer/planning';
import {createDesign} from '../src/sim/catalog';
import type {TransferEngineOptions} from '../src/transfer/operations-types';
import {COMMAND_NETWORK as N} from '../src/transfer/command-network';
describe('operations save structural trust boundary',()=>{
 it('preserves draft-only numerical settings and keeps editor changes non-authoritative',()=>{
  const lesson=createOperationsLesson(),save=makeOperationsSave(lesson.plan,lesson.craft,undefined,{scenarioId:lesson.id,numerics:{cruiseStepSeconds:300,activeStepSeconds:.5},editorDraft:lesson.suggestedPayload}),task=createTransferEngineReplay(serializeOperationsSave(save));expect(task.progress.status).toBe('running');task.step(1);const restored=task.result();expect(restored.numerics).toEqual({cruiseStepSeconds:300,activeStepSeconds:.5});expect(restored.runtime).toBeUndefined();expect(restored.editorDraft).toEqual(lesson.suggestedPayload);expect(restored.save.version).toBe(2);expect(restored.save).toHaveProperty('journal',[]);
 });
 it('rejects oversized input, future identities, unknown fields, missing checkpoint and journal disorder before replay',()=>{
  expect(()=>createOperationsReplay(' '.repeat(N.maximumSaveBytes+1))).toThrow();const lesson=createOperationsLesson(),original=makeOperationsSave(lesson.plan,lesson.craft);
  for(const mutate of [(x:Record<string,unknown>)=>x.commandNetworkHash='bad',(x:Record<string,unknown>)=>x.modelVersion='transfer-4.0.0',(x:Record<string,unknown>)=>x.trustedOutcome='success',(x:Record<string,unknown>)=>x.numerics={cruiseStepSeconds:600,activeStepSeconds:0},(x:Record<string,unknown>)=>x.journal=[{sequence:2,actionId:'a',commandId:'c',issuedAtSeconds:0,kind:'cancel-unsent'}]]){const copy=structuredClone(original) as unknown as Record<string,unknown>;mutate(copy);expect(()=>createOperationsReplay(JSON.stringify(copy))).toThrow();}
  for(const text of ['null','{bad']){try{createTransferEngineReplay(text);throw new Error('unexpected success');}catch(error){expect(error).toHaveProperty('code','INVALID_INPUT');}}expect(()=>createTransferEngineReplay(JSON.stringify({padding:'가'.repeat(2800000)}))).toThrow();
 });
 it('validates untrusted worker model/profile options before dispatching a released engine',()=>{const lesson=createOperationsLesson(),solution=solveTransferPlan(lesson.plan);for(const value of [{modelVersion:'future'},{modelVersion:'transfer-1.0.0'},{integrationStepSeconds:0},{modelVersion:'transfer-3.0.0',activeStepSeconds:.2},{modelVersion:'transfer-3.0.0',scenarioId:Infinity},{hiddenControl:true}]){const options=value as unknown as TransferEngineOptions;expect(()=>createTransferEngineRuntime(solution,lesson.craft,options)).toThrow();expect(()=>trySolveTransferEnginePlan(lesson.plan,lesson.craft,options)).toThrow();}expect(()=>createTransferEngineRuntime(solution,createDesign('mars','balanced'),{modelVersion:'transfer-2.0.0'})).toThrow();});
 it('rejects conflicting numerical identity and editor operations beyond a solved flight',()=>{const lesson=createOperationsLesson(),solution=solveTransferPlan(lesson.plan);expect(()=>makeOperationsSave(lesson.plan,lesson.craft,undefined,{numerics:{cruiseStepSeconds:300,activeStepSeconds:.5},integrationStepSeconds:600})).toThrow();const draft=structuredClone(lesson.suggestedPayload);draft.operations=[{id:'outside',kind:'observe',start:solution.durationSeconds+1,end:solution.durationSeconds+10}];expect(()=>makeOperationsSave(lesson.plan,lesson.craft,undefined,{editorDraft:draft})).toThrow();});
});
