import {afterEach,beforeAll,describe,it,expect} from 'vitest';
import {buildSync} from 'esbuild';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {createDesign} from '../src/sim/catalog';
import {createTransferPlan,createTransferRuntime,makeTransferSave,parseTransferSave,serializeTransferSave,solveTransferPlan} from '../src/transfer';
import {createOperationsLesson,createTransferEngineRuntime,advanceTransferEngine,makeTransferEngineSave,serializeTransferEngineSave} from '../src/transfer/engine';

// Execute the REAL browser-worker entry in a genuine Node worker thread. This
// adapter changes only the message transport; solver, resources, serialization,
// cancellation and event-loop yielding are bundled from production unchanged.
let workerSource='';
beforeAll(()=>{
 const bundled=buildSync({entryPoints:[fileURLToPath(new URL('../src/transfer.worker.ts',import.meta.url))],bundle:true,format:'cjs',platform:'node',target:'node24',write:false}).outputFiles[0].text;
 workerSource=`const {parentPort}=require('node:worker_threads');globalThis.self={onmessage:null,postMessage(message){parentPort.postMessage(message)}};parentPort.on('message',data=>{Promise.resolve(globalThis.self.onmessage({data})).catch(error=>parentPort.postMessage({type:'fatal',error:String(error)}));});\n${bundled}`;
});

describe('actual runtime 3 worker transaction contracts',()=>{
 let lesson:ReturnType<typeof createOperationsLesson>,decisionSave='';
 beforeAll(()=>{
  // Genuine elapsed runtime is prepared once and serialized. The worker must
  // still independently replay it: this is a transport test starting at a valid
  // decision checkpoint, not the full UI flight acceptance proof.
  lesson=createOperationsLesson();const route=solveTransferPlan(lesson.plan),options={modelVersion:'transfer-3.0.0' as const,scenarioId:lesson.id},state=createTransferEngineRuntime(route,lesson.craft,options);
  advanceTransferEngine(state,lesson.suggestedCommandAtSeconds);expect(state.status).toBe('running');expect(state.time).toBe(lesson.suggestedCommandAtSeconds);
  decisionSave=serializeTransferEngineSave(makeTransferEngineSave(lesson.plan,lesson.craft,state,options));
 },120000);
 it('cancels backlog at command commit, keeps previews detached and redelivers action IDs without new expiry or journal entries',async()=>{
  const w=worker();w.send({type:'restore',requestId:1,text:decisionSave});const restored=await w.next('restored',1,120000);expect(restored.state.modelVersion).toBe('transfer-3.0.0');
  w.send({type:'advance',requestId:1,controlEpoch:0,delta:10000});const moving=(await w.next('runtime',1,30000)).state;
  expect(moving.requestedTime).toBeGreaterThan(moving.time);expect(moving.time).toBeLessThan(lesson.suggestedPayload.replaceFromSeconds);
  const command={type:'queue-operations',requestId:1,controlEpoch:1,actionId:'worker-queue-action',commandId:'worker-schedule-command',payload:lesson.suggestedPayload,expiresAtSeconds:lesson.suggestedExpirySeconds};
  w.send(command);const committed=await w.next('operations-state',1),queued=committed.state;
  expect(committed.action.issuedAtSeconds).toBe(moving.time);expect(committed.committedTime).toBe(moving.time);expect(queued.time).toBe(moving.time);expect(queued.requestedTime).toBe(moving.time);
  expect(queued.operations.journal).toHaveLength(1);expect(queued.operations.commands[0].attempts[0].firstBit).toBeNull();expect(queued.operations.onboardRevision).toBe(0);expect(queued.operations.groundConfirmedRevision).toBe(0);
  const previewStart=w.history.length;
  w.send({type:'preview-operations',requestId:1,controlEpoch:0,draftRevision:99,payload:lesson.suggestedPayload});
  w.send({type:'preview-operations',requestId:1,controlEpoch:1,draftRevision:11,payload:lesson.suggestedPayload});
  const preview=await w.next('operations-preview',1);expect(preview.controlEpoch).toBe(1);expect(preview.draftRevision).toBe(11);expect(preview.baseTime).toBe(queued.time);
  w.send({type:'advance',requestId:1,controlEpoch:1,delta:0});expect((await w.next('runtime',1)).state).toEqual(queued);
  w.send({type:'save',requestId:1,export:true});await w.next('export',1);expect(w.history.slice(previewStart).filter(m=>m.type==='operations-preview')).toHaveLength(1);
  w.send(command);expect((await w.next('operations-state',1)).state).toEqual(queued);
  w.send({type:'advance',requestId:1,controlEpoch:1,delta:10000});const advanced=(await w.next('runtime',1,30000)).state;expect(advanced.time).toBeGreaterThan(queued.time);expect(advanced.requestedTime).toBeGreaterThan(advanced.time);
  // Same-epoch cached redelivery and a newer-epoch redelivery must both preserve
  // the already running demand and return the original transaction timestamp.
  for(const controlEpoch of [1,2]){w.send({...command,controlEpoch});const duplicate=await w.next('operations-state',1);expect(duplicate.state).toEqual(advanced);expect(duplicate.action).toEqual(committed.action);expect(duplicate.committedTime).toBe(committed.committedTime);expect(duplicate.state.operations.journal).toHaveLength(1);expect(duplicate.state.operations.commands[0].envelope.expiresAtSeconds).toBe(lesson.suggestedExpirySeconds);}
  for(const controlEpoch of [2,3]){w.send({...command,controlEpoch,expiresAtSeconds:lesson.suggestedExpirySeconds-1});const conflict=await w.next('error',1);expect(conflict.code).toBe('ACTION_ID_CONFLICT');expect(conflict.state).toEqual(advanced);}
  w.send({type:'advance',requestId:1,controlEpoch:2,delta:100000});w.send({type:'advance',requestId:1,controlEpoch:3,delta:0});const continued=(await w.next('runtime',1,30000)).state;expect(continued.time).toBeGreaterThan(advanced.time);expect(continued.operations.journal).toHaveLength(1);
  expect(w.history.some(m=>m.type==='fatal')).toBe(false);
 },180000);
 it('cancels bounded operations replay when a newer session restores another real flight',async()=>{
  const w=worker();w.send({type:'restore',requestId:1,text:decisionSave});const progress=await w.next('restore-progress',1,30000);expect(progress.status).toBe('running');expect(progress.committedTime).toBeLessThan(lesson.suggestedCommandAtSeconds);
  w.send({type:'restore',requestId:2,text:launchSave});const latest=await w.next('restored',2,30000);expect(latest.state.modelVersion).toBe('transfer-1.0.0');expect(latest.state.time).toBe(0);
  w.send({type:'advance',requestId:1,controlEpoch:0,delta:100000});w.send({type:'advance',requestId:2,controlEpoch:0,delta:5});const active=(await w.next('runtime',2)).state;expect(active.modelVersion).toBe('transfer-1.0.0');expect(active.time).toBeGreaterThan(0);expect(active.solution.plan).toEqual(plan);
  w.send({type:'save',requestId:2,export:true});const exported=await w.next('export',2);expect(JSON.parse(exported.text).version).toBe(1);
  expect(w.history.some(m=>m.type==='restored'&&m.requestId===1)).toBe(false);expect(w.history.some(m=>m.type==='fatal')).toBe(false);
 },60000);
});
type Message={type:string;requestId?:number;[key:string]:any};
class ActualWorker {
 readonly thread=new Worker(workerSource,{eval:true});
 readonly history:Message[]=[];
 private inbox:Message[]=[];
 private waiters:{predicate:(message:Message)=>boolean;resolve:(message:Message)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}[]=[];
 constructor(){this.thread.on('message',(message:Message)=>{this.history.push(message);const index=this.waiters.findIndex(w=>w.predicate(message));if(index>=0){const [waiter]=this.waiters.splice(index,1);clearTimeout(waiter.timer);waiter.resolve(message);}else this.inbox.push(message);});this.thread.on('error',error=>{for(const w of this.waiters){clearTimeout(w.timer);w.reject(error instanceof Error?error:new Error(String(error)));}this.waiters=[];});}
 send(message:Message){this.thread.postMessage(message);}
 next(type:string,requestId:number,timeout=15000):Promise<Message>{const predicate=(m:Message)=>m.type===type&&m.requestId===requestId,index=this.inbox.findIndex(predicate);if(index>=0)return Promise.resolve(this.inbox.splice(index,1)[0]);return new Promise((resolve,reject)=>{const waiter={predicate,resolve,reject,timer:setTimeout(()=>{this.waiters=this.waiters.filter(w=>w!==waiter);reject(new Error(`Worker did not produce ${type}/${requestId}; latest ${this.history.at(-1)?.type}`));},timeout)};this.waiters.push(waiter);});}
 async close(){for(const w of this.waiters)clearTimeout(w.timer);this.waiters=[];await this.thread.terminate();}
}
const workers:ActualWorker[]=[];
function worker(){const w=new ActualWorker();workers.push(w);return w;}
afterEach(async()=>{await Promise.all(workers.splice(0).map(w=>w.close()));});
const plan=createTransferPlan(),craft=createDesign('mars'),solution=solveTransferPlan(plan);
const launchSave=serializeTransferSave(makeTransferSave(plan,craft,createTransferRuntime(solution,craft)));
async function restoredWorker(){const w=worker();w.send({type:'restore',requestId:1,text:launchSave});const restored=await w.next('restored',1);expect(restored.state.time).toBe(0);return w;}

describe('actual M03 worker integration contracts',()=>{
 it('supersedes a long preview and never accepts the stale revision as the launch solution',async()=>{
  const w=worker(),nextPlan=createTransferPlan('science');w.send({type:'solve',requestId:1,plan,craft});w.send({type:'solve',requestId:2,plan:nextPlan,craft:createDesign('mars','science')});
  const latest=await w.next('preview',2);expect(latest.result.status).toBe('success');expect(w.history.filter(m=>m.type==='preview'&&m.requestId===1)).toHaveLength(0);
  w.send({type:'launch',requestId:2,controlEpoch:1});const launched=await w.next('runtime',2);expect(launched.controlEpoch).toBe(1);expect(launched.state.solution.plan).toEqual(nextPlan);expect(launched.state.time).toBe(0);
 },30000);
 it('caps an explicit milestone warp even when a much later requested time is already queued',async()=>{
  const w=await restoredWorker();w.send({type:'advance',requestId:1,controlEpoch:0,delta:solution.durationSeconds});let current=(await w.next('runtime',1)).state;
  expect(current.time).toBeLessThan(solution.earthExitSeconds);expect(current.requestedTime).toBeGreaterThan(solution.earthExitSeconds);
  w.send({type:'warp',requestId:1,controlEpoch:1,target:solution.earthExitSeconds});current=(await w.next('runtime',1)).state;
  for(let i=0;i<20&&current.time<solution.earthExitSeconds-1e-6;i++){expect(current.time).toBeLessThanOrEqual(solution.earthExitSeconds);w.send({type:'advance',requestId:1,controlEpoch:1,delta:0});current=(await w.next('runtime',1)).state;}
  expect(current.time).toBe(solution.earthExitSeconds);expect(current.requestedTime).toBe(solution.earthExitSeconds);expect(current.events.filter((e:any)=>e.code==='EARTH_EXIT')).toHaveLength(1);
  w.send({type:'advance',requestId:1,controlEpoch:1,delta:0});expect((await w.next('runtime',1)).state.time).toBe(solution.earthExitSeconds);
 },30000);
 it('exports the committed checkpoint, restores it by replay, and ignores old-session advances',async()=>{
  const w=await restoredWorker();w.send({type:'advance',requestId:1,controlEpoch:0,delta:1000000});const current=(await w.next('runtime',1)).state;
  w.send({type:'save',requestId:1,plan,export:true});const exported=await w.next('export',1),raw=JSON.parse(exported.text);expect(raw.runtime.solution).toBeUndefined();const checked=parseTransferSave(exported.text).runtime!;expect(checked.time).toBe(current.time);expect(checked.requestedTime).toBe(current.requestedTime);expect(checked.energyWh).toBe(current.energyWh);
  w.send({type:'restore',requestId:2,text:exported.text});const restored=await w.next('restored',2);w.send({type:'advance',requestId:1,controlEpoch:0,delta:10000000});w.send({type:'pause',requestId:2,controlEpoch:1});const paused=(await w.next('runtime',2)).state;
  expect(paused.time).toBe(restored.state.time);expect(paused.energyWh).toBe(restored.state.energyWh);expect(paused.requestedTime).toBe(paused.time);
 },30000);
 it('clears the previous launchable solution when new validation fails',async()=>{
  const w=await restoredWorker(),invalid={...plan,marsPeriapsisAltitudeKm:10};w.send({type:'solve',requestId:2,plan:invalid,craft});expect((await w.next('solved',2)).status).toBe('infeasible');
  w.send({type:'launch',requestId:2,controlEpoch:1});w.send({type:'save',requestId:2,plan:invalid,export:true});expect((await w.next('error',2)).operation).toBe('save');expect(w.history.some(m=>m.type==='runtime'&&m.requestId===2)).toBe(false);
 });
 it('restores an editable draft without inventing a runtime or trusting imported coordinates',async()=>{
  const w=worker(),draft=serializeTransferSave(makeTransferSave(plan,craft));w.send({type:'restore',requestId:4,text:draft});const restored=await w.next('restored',4);expect(restored.plan).toEqual(plan);expect(restored.craft.parts).toEqual(craft.parts);expect(restored.state).toBeNull();expect(restored.solution).toBeNull();expect(restored.evaluation).toBeNull();
 });
 it('rejects same-flight old warp demand after pause without rewinding completed physics',async()=>{
  const w=await restoredWorker();
  w.send({type:'warp',requestId:1,controlEpoch:1,target:solution.durationSeconds});const moving=(await w.next('runtime',1)).state;
  expect(moving.time).toBeGreaterThan(0);expect(moving.requestedTime).toBeGreaterThan(moving.time);
  w.send({type:'pause',requestId:1,controlEpoch:2});const pause=await w.next('runtime',1),paused=pause.state;
  expect(pause.controlEpoch).toBe(2);expect(paused).toEqual({...moving,requestedTime:moving.time});
  const start=w.history.length;
  w.send({type:'advance',requestId:1,controlEpoch:1,delta:solution.durationSeconds});
  w.send({type:'warp',requestId:1,controlEpoch:1,target:solution.durationSeconds});
  w.send({type:'advance',requestId:1,controlEpoch:3,delta:solution.durationSeconds});
  w.send({type:'advance',requestId:1,delta:solution.durationSeconds});
  w.send({type:'advance',requestId:1,controlEpoch:2,delta:0});
  // Export is an ordered transport fence, not a delay-based assertion that a
  // stale request probably had no effect.
  w.send({type:'save',requestId:1,export:true});await w.next('export',1);
  const responses=w.history.slice(start).filter(m=>m.type==='runtime');
  expect(responses).toHaveLength(1);expect(responses[0].controlEpoch).toBe(2);expect(responses[0].state).toEqual(paused);
  expect(w.history.slice(start).some(m=>m.type==='error'||m.type==='fatal')).toBe(false);
 },30000);
 it('redelivers an identical warp outcome without advancing or resetting demand and rejects conflicting reuse',async()=>{
  const w=await restoredWorker(),warp={type:'warp',requestId:1,controlEpoch:1,target:solution.durationSeconds};
  w.send(warp);const transaction=await w.next('runtime',1);
  w.send({type:'advance',requestId:1,controlEpoch:1,delta:0});const advanced=(await w.next('runtime',1)).state;
  expect(advanced.time).toBeGreaterThan(transaction.state.time);expect(advanced.requestedTime).toBeGreaterThan(advanced.time);
  w.send(warp);const duplicate=await w.next('runtime',1);
  expect(duplicate.state).toEqual(advanced);expect(duplicate.committedTime).toBe(transaction.committedTime);
  w.send({...warp,target:solution.earthExitSeconds});const conflict=await w.next('error',1);
  expect(conflict.code).toBe('ACTION_ID_CONFLICT');expect(conflict.controlEpoch).toBe(1);expect(conflict.state).toEqual(advanced);
  w.send(warp);const afterConflict=await w.next('runtime',1);
  expect(afterConflict.state).toEqual(advanced);expect(afterConflict.committedTime).toBe(transaction.committedTime);
  // A valid continuation remains usable; the conflict did not replace the
  // original transaction or make the engine permanently busy.
  w.send({type:'advance',requestId:1,controlEpoch:1,delta:0});expect((await w.next('runtime',1)).state.time).toBeGreaterThan(advanced.time);
 },30000);
 it('keeps the prior flight paused and playable after malformed and forged-checkpoint imports',async()=>{
  const w=await restoredWorker();w.send({type:'advance',requestId:1,controlEpoch:0,delta:1000000});let before=(await w.next('runtime',1)).state;
  // The existing journey parser normalizes the craft and keeps its schedule in
  // the transfer plan. Compare to the actual live craft, not a raw catalog draft.
  const retainedCraft=structuredClone(before.craft);
  w.send({type:'save',requestId:1,export:true});const exported=await w.next('export',1),forged=JSON.parse(exported.text);forged.runtime.energyWh+=1;
  for(const [index,text] of ['{not JSON',JSON.stringify(forged)].entries()){
   const requestId=index+2;w.send({type:'restore',requestId,text});const rejected=await w.next('error',requestId);
   expect(rejected.operation).toBe('restore');expect(rejected.retained).toBe(true);expect(rejected.controlEpoch).toBe(0);
   expect(rejected.plan).toEqual(plan);expect(rejected.craft).toEqual(retainedCraft);expect(rejected.solution).toEqual(before.solution);
   const paused={...before,requestedTime:before.time};expect(rejected.state).toEqual(paused);
   w.send({type:'advance',requestId,controlEpoch:0,delta:0});expect((await w.next('runtime',requestId)).state).toEqual(paused);
   w.send({type:'save',requestId,export:true});const retained=await w.next('export',requestId),checked=parseTransferSave(retained.text).runtime!;
   expect(checked.time).toBe(paused.time);expect(checked.energyWh).toBe(paused.energyWh);expect(checked.requestedTime).toBe(paused.time);
   w.send({type:'advance',requestId,controlEpoch:0,delta:1000});before=(await w.next('runtime',requestId)).state;
   expect(before.time).toBeGreaterThan(paused.time);expect(before.craft).toEqual(retainedCraft);
  }
  expect(w.history.some(m=>m.type==='fatal')).toBe(false);
 },30000);
});
