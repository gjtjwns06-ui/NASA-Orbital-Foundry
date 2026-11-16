import {describe,it,expect} from 'vitest';
import {createDesign} from '../src/sim/catalog';
import {advanceTransfer,createTransferPlan,createTransferRuntime,makeTransferSave,parseTransferSave,serializeTransferSave,solveTransferPlan} from '../src/transfer';
describe('strict standalone M03 save boundary',()=>{
 it('round-trips a draft without mixing M01/M02 save storage or loading a supplied trajectory',()=>{const p=createTransferPlan(),craft=createDesign('mars'),save=makeTransferSave(p,craft),restored=parseTransferSave(serializeTransferSave(save));expect(restored.plan).toEqual(p);expect(restored.craft.parts).toEqual(craft.parts);expect(restored.runtime).toBeUndefined();const forged=JSON.parse(serializeTransferSave(save));forged.solution={positionKm:[0,0,0]};expect(()=>parseTransferSave(JSON.stringify(forged))).toThrow(/필드/);});
 it('rejects version/source changes, non-finite fields and unknown schema keys',()=>{const raw=JSON.parse(serializeTransferSave(makeTransferSave(createTransferPlan(),createDesign('mars'))));for(const change of [(x:typeof raw)=>x.modelVersion='future',(x:typeof raw)=>x.sourceHashes.earth='fake',(x:typeof raw)=>x.plan.departurePeriapsisJdTdb=null,(x:typeof raw)=>x.plan.operations[0].exploit=true]){const copy=structuredClone(raw);change(copy);expect(()=>parseTransferSave(JSON.stringify(copy))).toThrow();}});
 it('re-solves coordinates and rejects forged fuel, energy and flight time',()=>{const plan=createTransferPlan(),craft=createDesign('mars'),s=createTransferRuntime(solveTransferPlan(plan),craft);advanceTransfer(s,1000);const raw=JSON.parse(serializeTransferSave(makeTransferSave(plan,craft,s)));expect(raw.runtime.solution).toBeUndefined();for(const [key,value] of [['fuelKg',999],['energyWh',10000],['time',1000.1234]] as const){const bad=structuredClone(raw);bad.runtime[key]=value;expect(()=>parseTransferSave(JSON.stringify(bad))).toThrow();}const restored=parseTransferSave(JSON.stringify(raw)).runtime!;expect(restored.solution.trajectory).toEqual(s.solution.trajectory);expect(restored.attitudeQuaternion).toEqual(s.attitudeQuaternion);});
 it('round-trips a runtime whose final scheduled operation was clipped below the schema minimum',()=>{
  const plan=createTransferPlan(),craft=createDesign('mars'),end=solveTransferPlan(plan).durationSeconds;
  plan.operations=[{id:'last-half-second',kind:'charge',start:end-.5,end:end+20}];
  const solution=solveTransferPlan(plan);
  expect(solution.plan.operations).toEqual([]);
  expect(solution.scheduleWarnings).toEqual(['last-half-second: 임무 종료 전에 남는 시간이 1초 미만이어서 이 작업은 실행하지 않습니다.']);
  const runtime=createTransferRuntime(solution,craft),restored=parseTransferSave(serializeTransferSave(makeTransferSave(plan,craft,runtime)));
  expect(restored.runtime?.time).toBe(0);expect(restored.runtime?.energyWh).toBe(runtime.energyWh);expect(restored.plan.operations).toEqual([]);
  plan.operations=[{id:'last-second',kind:'charge',start:end-1,end:end+20}];
  expect(solveTransferPlan(plan).plan.operations).toEqual([{id:'last-second',kind:'charge',start:end-1,end}]);
 });
});
