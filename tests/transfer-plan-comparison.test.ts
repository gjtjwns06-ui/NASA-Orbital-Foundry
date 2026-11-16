import {describe,expect,it} from 'vitest';
import {TransferPlanComparison} from '../src/transfer-plan-comparison';
import type {Design} from '../src/sim/types';
import type {FullTransferPlan,FullTransferSolution,EscapeStageEvaluation} from '../src/transfer/types';
import type {TransferResult} from '../src/transfer/runtime';

// Deliberately minimal state-holder fixtures, NOT propagated trajectories or
// evidence of physical mission success. The holder never reads trajectory data.
const craft=():Design=>({version:1,missionId:'mars',name:'comparison fixture',seed:7,parts:[],plan:{altitudeKm:300,inclinationDeg:0,burnTime:0,progradeMps:0,normalMps:0,radialMps:0,periapsisAltitudeKm:300,bPlaneAngleDeg:0,operations:[]}});
const plan=(arrivalShift=0):FullTransferPlan=>({version:1,ephemerisDatasetId:'comparison-fixture',departurePeriapsisJdTdb:2450000,arrivalPeriapsisJdTdb:2450000+(1000+arrivalShift)/86400,earthParkingAltitudeKm:300,marsPeriapsisAltitudeKm:250,departurePlaneAngleRad:0,marsBPlaneAngleRad:0,launchStageId:'explorer',operations:[{id:'crosses-end',kind:'downlink',start:1500,end:2500},{id:'past-end',kind:'charge',start:2600,end:3000}]});
function solution(input:FullTransferPlan,duration=2000):FullTransferSolution {
 const solved=structuredClone(input);solved.operations=solved.operations.map(op=>({...op,end:Math.min(op.end,duration)})).filter(op=>op.end-op.start>=1);
 return {version:1,modelVersion:'comparison-fixture',status:'solved',plan:solved,datasetId:'comparison-fixture',sourceHashes:{earth:'fixture',mars:'fixture'},durationSeconds:duration,periapsisSeconds:(input.arrivalPeriapsisJdTdb-input.departurePeriapsisJdTdb)*86400,earthExitSeconds:100,marsEntrySeconds:500,phaseEvents:[{id:'mars-exit',elapsedSeconds:duration,jdTdb:input.departurePeriapsisJdTdb+duration/86400}],trajectory:{} as FullTransferSolution['trajectory'],c3Km2S2:12,arrivalVInfinityKmS:[1,0,0],departureVInfinityKmS:[1,0,0],escapeBurnMps:1000,boundaryPositionResidualKm:0,boundaryVelocityResidualKmS:0,scheduleWarnings:['Fixture operations clipped at their computed endpoint.']};
}
const evaluation=(launchable=true,fuelUsedKg=20):EscapeStageEvaluation=>({stage:{id:'explorer',name:'fixture',description:'state-holder fixture only',dryMassKg:50,fuelKg:100,ispS:300,maxPayloadKg:100,payloadFairingDiameterM:2,payloadFairingHeightM:3,cost:100,provenance:'game-assumption'},payloadMassKg:10,stageInitialMassKg:160,stageAfterBurnMassKg:160-fuelUsedKg,availableDeltaVMps:1200,requiredDeltaVMps:1000,fuelUsedKg,stageFuelRemainingKg:100-fuelUsedKg,payloadFuelUnchangedKg:9,componentCost:10,stageCost:100,totalCost:110,budget:1000,launchable,warnings:[]});
const result=(elapsedSeconds=2000,received=3):TransferResult=>({status:received>=3?'success':received?'partial':'failed',score:0,received,required:3,reasons:[],elapsedSeconds,energyMinimumWh:10,fuelRemainingKg:999,totalCost:110,budgetRemaining:890,packets:[],events:[]});
function accept(c:TransferPlanComparison,id:number,p=plan(),r=result(),e=evaluation(),s=solution(p)){c.begin(id,p,craft());c.solved(id,s,e);c.finish(id,r);}

describe('M03 submitted-plan comparison ownership (synthetic state fixtures)',()=>{
 it('pairs matching solved and forecast messages, ignoring stale and out-of-order responses',()=>{
  const c=new TransferPlanComparison();accept(c,1);
  c.begin(2,plan(100),craft());c.solved(2,solution(plan(100)),evaluation());expect(c.status).toBe('forecasting');
  c.begin(3,plan(200),craft());c.finish(2,result());c.solved(2,solution(plan(100)),evaluation());c.reject(2);c.finish(3,result());
  expect(c.status).toBe('pending');expect(c.current).toBeNull();expect(c.previous?.requestId).toBe(1);
  c.solved(3,solution(plan(200)),evaluation());expect(c.status).toBe('forecasting');c.finish(3,result());expect(c.status).toBe('ready');expect(c.current?.requestId).toBe(3);expect(c.previous?.requestId).toBe(1);
 });
 it('restores the exact submitted operations rather than the clipped solution plan',()=>{
  const c=new TransferPlanComparison(),original=plan();accept(c,1,original);
  expect(c.current?.solution.plan.operations).not.toEqual(original.operations);
  c.begin(2,plan(100),craft());c.reject(2);expect(c.restorePlan()).toEqual(original);expect(c.restorePlan()?.operations).toHaveLength(2);
  const restored=c.restorePlan()!;c.begin(3,restored,craft());expect(c.previous?.plan).toEqual(restored);c.solved(3,solution(restored),evaluation());c.finish(3,result());
  expect(c.current?.plan).toEqual(original);expect(c.previous).toBeNull();expect(c.inspect().delta).toBeNull();
 });
 it('copies all inputs, worker messages, getter snapshots, inspection data and restored plans',()=>{
  const c=new TransferPlanComparison(),p=plan(),ship=craft(),s=solution(p),e=evaluation(),r=result();
  c.begin(1,p,ship);p.operations[0].end=99999;ship.name='mutated caller';c.solved(1,s,e);s.plan.operations=[];e.stageFuelRemainingKg=-999;c.finish(1,r);r.received=999;
  const current=c.current!;current.plan.operations[0].end=-1;current.solution.c3Km2S2=-1;current.evaluation.stageFuelRemainingKg=-1;current.result!.received=-1;
  expect(c.current?.plan.operations[0].end).toBe(2500);expect(c.inspect().current?.stageFuelRemainingKg).toBe(80);expect(c.inspect().current?.received).toBe(3);
  c.begin(2,plan(100),craft());const restored=c.restorePlan()!;restored.operations=[];const inspection=c.inspect();inspection.previousPlan!.operations=[];inspection.previous!.received=123;
  expect(c.previous?.plan.operations).toHaveLength(2);expect(c.inspect().previous?.received).toBe(3);
 });
 it('retains the last accepted candidate across pending, invalid and unlaunchable edits',()=>{
  const c=new TransferPlanComparison();accept(c,1);
  c.begin(2,plan(100),craft());expect(c.status).toBe('pending');expect(c.previous?.requestId).toBe(1);c.reject(2);
  expect(c.status).toBe('infeasible');expect(c.restorePlan()).toEqual(plan());
  c.begin(3,plan(200),craft());c.solved(3,solution(plan(200)),evaluation(false));c.finish(3,result());
  expect(c.status).toBe('unlaunchable');expect(c.previous?.requestId).toBe(1);
  c.begin(4,plan(300),craft());expect(c.previous?.requestId).toBe(1);
 });
 it('accepts full-duration zero/partial science but rejects early termination as a comparison anchor',()=>{
  const c=new TransferPlanComparison();accept(c,1,plan(),result(2000,0));
  expect(c.status).toBe('ready');expect(c.inspect().current?.received).toBe(0);
  c.begin(2,plan(100),craft());c.solved(2,solution(plan(100)),evaluation());c.finish(2,result(1900,1));
  expect(c.status).toBe('flight-failed');expect(c.inspect().current?.fullDurationForecast).toBe(false);expect(c.inspect().current?.received).toBeNull();expect(c.previous?.result?.received).toBe(0);
  c.begin(3,plan(200),craft());expect(c.previous?.requestId).toBe(1);c.solved(3,solution(plan(200)),evaluation());c.finish(3,result(2000,1));expect(c.status).toBe('ready');
  c.begin(4,plan(300),craft());expect(c.previous?.requestId).toBe(3);c.solved(4,solution(plan(300)),evaluation());c.finish(4,result(2000-5e-7,3));expect(c.status).toBe('flight-failed');
 });
 it('reports stage fuel rather than spacecraft fuel and keeps each computed receipt deadline',()=>{
  const c=new TransferPlanComparison();accept(c,1,plan(),result(2000,1),evaluation(true,20));
  const p=plan(100);c.begin(2,p,craft());const s=solution(p,2200);s.c3Km2S2=14;c.solved(2,s,evaluation(true,27));
  expect(c.inspect().delta?.received).toBeNull();c.finish(2,result(2200,3));const i=c.inspect();
  expect(i.current?.stageFuelUsedKg).toBe(27);expect(i.current?.stageFuelRemainingKg).toBe(73);expect(i.delta?.stageFuelUsedKg).toBe(7);expect(i.delta?.stageFuelRemainingKg).toBe(-7);expect(i.delta?.received).toBe(2);expect(i.delta?.c3Km2S2).toBe(2);
  expect(i.previous?.receiptDeadlineSeconds).toBe(2000);expect(i.current?.receiptDeadlineSeconds).toBe(2200);expect(i.delta?.receiptDeadlineShiftSeconds).toBeCloseTo(200,3);expect(i.delta?.arrivalShiftSeconds).toBeCloseTo(100,3);
 });
 it('clears comparison after a craft identity change, explicit reset or exact successful restore',()=>{
  const c=new TransferPlanComparison();accept(c,1);accept(c,2,plan(100));expect(c.previous?.requestId).toBe(1);
  const restored=c.restorePlan()!;c.begin(3,restored,craft());expect(c.previous?.plan).toEqual(restored);c.solved(3,solution(restored),evaluation());c.finish(3,result());expect(c.previous).toBeNull();
  const other=craft();other.parts.push({id:'new-part',kind:'battery',face:'px',u:0,v:0,rotation:0});c.begin(4,plan(200),other);expect(c.previous).toBeNull();expect(c.restorePlan()).toBeNull();expect(c.status).toBe('pending');
  c.reset();expect(c.inspect()).toEqual({status:'empty',requestId:null,submittedPlan:null,currentPlan:null,previousPlan:null,current:null,previous:null,delta:null,canRestore:false});
 });
 it('retains exact restore input through pending/rejection and preserves an existing comparison on no-op recalculation',()=>{
  const c=new TransferPlanComparison();accept(c,1);accept(c,2,plan(100));const a=c.restorePlan()!;
  c.begin(3,plan(100),craft());expect(c.previous?.requestId).toBe(1);c.solved(3,solution(plan(100)),evaluation());c.finish(3,result());expect(c.previous?.requestId).toBe(1);
  c.begin(4,a,craft());expect(c.status).toBe('pending');expect(c.restorePlan()).toEqual(a);c.reject(4);expect(c.status).toBe('infeasible');expect(c.restorePlan()).toEqual(a);
  c.begin(5,a,craft());c.solved(5,solution(a),evaluation());c.finish(5,result());expect(c.status).toBe('ready');expect(c.previous).toBeNull();
 });
 it('does not invent missing/nonfinite facts or overwrite completed work with duplicate messages',()=>{
  const c=new TransferPlanComparison(),p=plan(),s=solution(p);s.phaseEvents=[];s.c3Km2S2=NaN;
  c.begin(1,p,craft());c.solved(1,s,evaluation());c.finish(1,result());expect(c.inspect().current?.receiptDeadlineJdTdb).toBeNull();expect(c.inspect().current?.c3Km2S2).toBeNull();
  c.solved(1,solution(p),evaluation(false));c.finish(1,result(1,99));c.reject(1);c.begin(1,plan(500),craft());expect(c.status).toBe('ready');expect(c.current?.result?.received).toBe(3);
 });
});
