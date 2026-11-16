import {parentPort} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import * as original from '../../baseline/src/transfer';
import * as optimized from '../../src/transfer';
import {createDesign} from '../../src/sim/catalog';
import {createHardwareTransferDesign} from '../../src/hardware';
import {createDesign as originalCreateDesign} from '../../baseline/src/sim/catalog';
import {createHardwareTransferDesign as originalHardwareDesign} from '../../baseline/src/hardware';
import type {TransferRuntimeState} from '../../src/transfer/types';
import {exactDigest as digest} from './integrity';

parentPort!.postMessage({type:'ready'});
parentPort!.on('message',(request:{variant:'original'|'optimized';scenario:string;step:300|600;restore:boolean})=>{
 try{
  const engine=request.variant==='original'?original:optimized,preset=request.scenario.endsWith('science')?'science':'balanced',hardware=request.scenario.startsWith('hardware'),craft=hardware?(request.variant==='original'?originalHardwareDesign(preset):createHardwareTransferDesign(preset)):(request.variant==='original'?originalCreateDesign('mars',preset):createDesign('mars',preset)),plan=hardware?engine.createHardwareTransferPlan(preset):engine.createTransferPlan(preset);
  if(request.scenario==='nightside')plan.marsBPlaneAngleRad=Math.PI;
  if(request.scenario==='weak-solar')craft.parts[0].kind='solar';
  const inputHash=digest({plan,craft,step:request.step}),heapBefore=process.memoryUsage().heapUsed,solveStart=performance.now(),solution=engine.solveTransferPlan(plan),solveMs=performance.now()-solveStart,constructStart=performance.now(),state=engine.createTransferRuntime(solution,craft,request.step),constructMs=performance.now()-constructStart;
  const forecastStart=performance.now();engine.advanceTransfer(state,solution.durationSeconds);const forecastMs=performance.now()-forecastStart,result=engine.getTransferResult(state),stateHash=digest(state),resultHash=digest(result);
  const query=()=>engine.transferEnvironmentAt(state.solution,solution.periapsisSeconds+600,true);
  query();const warmQueryStart=performance.now();for(let i=0;i<2000;i++)query();const warmQueryMs=performance.now()-warmQueryStart,queryHash=digest(query());
  engine.getTransferTelemetry(state);const telemetryStart=performance.now();for(let i=0;i<200;i++)engine.getTransferTelemetry(state);const warmPublicTelemetryMs=performance.now()-telemetryStart,publicTelemetryHash=digest(engine.getTransferTelemetry(state));
  const serializationStart=performance.now(),text=engine.serializeTransferSave(engine.makeTransferSave(plan,craft,state)),serializationMs=performance.now()-serializationStart;
  let restoreMs:number|null=null,restoredHash:string|null=null;if(request.restore){const restoreStart=performance.now(),restored=engine.parseTransferSave(text);restoreMs=performance.now()-restoreStart;restoredHash=digest(restored.runtime as TransferRuntimeState);}
  parentPort!.postMessage({type:'result',...request,inputHash,stateHash,resultHash,queryHash,publicTelemetryHash,restoredHash,solveMs,constructMs,forecastMs,warmQueryMs,warmQueryIterations:2000,warmPublicTelemetryMs,warmPublicTelemetryIterations:200,serializationMs,restoreMs,heapDeltaBytes:process.memoryUsage().heapUsed-heapBefore,cacheEntries:null,optimization:'hardware-compiled-constants-only',ticks:state.tick,status:result.status,received:result.received,energyWh:state.energyWh,energyMinimumWh:state.energyMinimumWh});
 }catch(error){parentPort!.postMessage({type:'error',error:error instanceof Error?error.stack:String(error)});}
});
