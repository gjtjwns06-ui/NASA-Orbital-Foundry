import {afterEach,beforeAll,describe,it,expect} from 'vitest';
import {buildSync} from 'esbuild';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {createSwingbyDesign,createSwingbyPlan,solveSwingbyPlan,createSwingbyRuntime,advanceSwingby,
 makeSwingbySave,serializeSwingbySave,getSwingbyNextEventTime} from '../src/swingby';

// Real worker thread and unchanged production engine. Only browser postMessage
// transport is adapted; no fake orbit, resource state or success is injected.
let source='';
beforeAll(()=>{
 const bundled=buildSync({entryPoints:[fileURLToPath(new URL('../src/swingby.worker.ts',import.meta.url))],bundle:true,platform:'node',format:'cjs',target:'node24',write:false}).outputFiles[0].text;
 source=`const {parentPort}=require('node:worker_threads');globalThis.self={onmessage:null,postMessage(m){parentPort.postMessage(m)}};parentPort.on('message',data=>Promise.resolve(self.onmessage({data})).catch(e=>parentPort.postMessage({type:'fatal',error:String(e)})));\n${bundled}`;
});
type Message={type:string;requestId?:number;[key:string]:any};
class ActualWorker {
 readonly thread=new Worker(source,{eval:true});readonly history:Message[]=[];
 private inbox:Message[]=[];private waiters:{predicate:(m:Message)=>boolean;resolve:(m:Message)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}[]=[];
 constructor(){this.thread.on('message',(m:Message)=>{this.history.push(m);const i=this.waiters.findIndex(w=>w.predicate(m));if(i<0)this.inbox.push(m);else{const [w]=this.waiters.splice(i,1);clearTimeout(w.timer);w.resolve(m);}});this.thread.on('error',e=>{for(const w of this.waiters){clearTimeout(w.timer);w.reject(e instanceof Error?e:new Error(String(e)));}this.waiters=[];});}
 send(m:Message){this.thread.postMessage(m);}
 next(type:string,id:number,where:(m:Message)=>boolean=()=>true,timeout=30000):Promise<Message>{const predicate=(m:Message)=>m.type===type&&m.requestId===id&&where(m),i=this.inbox.findIndex(predicate);if(i>=0)return Promise.resolve(this.inbox.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={predicate,resolve,reject,timer:setTimeout(()=>{this.waiters=this.waiters.filter(x=>x!==w);reject(Error(`Missing ${type}/${id}; latest ${JSON.stringify(this.history.at(-1)?.type)}`));},timeout)};this.waiters.push(w);});}
 async close(){for(const w of this.waiters)clearTimeout(w.timer);await this.thread.terminate();}
}
const workers:ActualWorker[]=[];function worker(){const w=new ActualWorker();workers.push(w);return w;}
afterEach(async()=>{await Promise.all(workers.splice(0).map(w=>w.close()));});
const plan=createSwingbyPlan(),craft=createSwingbyDesign();
async function launched(){const w=worker();w.send({type:'solve',requestId:1,revision:1,plan,craft});const solved=await w.next('solved',1);expect(solved.status).toBe('solved');expect(solved.evaluation.launchable).toBe(true);const command={type:'launch',requestId:1,controlEpoch:1,inputHash:solved.solution.inputHash};w.send(command);const launch=await w.next('launched',1);return {w,launch,command};}

describe('actual swingby worker lifecycle',()=>{
 it('launches once, cancels pending time at pause and caps warp to the next physical event',async()=>{
  const {w,launch,command}=await launched();expect(launch.state.time).toBe(0);w.send(command);expect((await w.next('launched',1)).state).toEqual(launch.state);
  w.send({type:'advance',requestId:1,controlEpoch:1,targetTime:300000});const progress=await w.next('runtime-progress',1);expect(progress.state.time).toBeGreaterThan(0);expect(progress.state.time).toBeLessThan(300000);
  w.send({type:'pause',requestId:1,controlEpoch:2});const paused=(await w.next('paused',1)).state;expect(paused.time).toBeGreaterThanOrEqual(progress.state.time);expect(paused.requestedTime).toBe(paused.time);
  const fence=w.history.length;w.send({type:'advance',requestId:1,controlEpoch:1,targetTime:300000});w.send({type:'warp',requestId:1,controlEpoch:1,targetTime:300000});w.send({type:'save',requestId:1,saveId:'pause-fence'});const saved=await w.next('save-snapshot',1);expect(saved.save.checkpoint.time).toBe(paused.time);expect(w.history.slice(fence).some(m=>m.type==='runtime-progress')).toBe(false);
  const next=getSwingbyNextEventTime(paused);w.send({type:'warp',requestId:1,controlEpoch:3,targetTime:300000});const warped=(await w.next('runtime',1,m=>m.controlEpoch===3)).state;expect(warped.time).toBe(next);expect(warped.requestedTime).toBe(next);
  w.send({type:'warp',requestId:1,controlEpoch:3,targetTime:300000});expect((await w.next('runtime',1,m=>m.duplicate)).state).toEqual(warped);expect(w.history.some(m=>m.type==='fatal')).toBe(false);
 },60000);
 it('invalidates a prior accepted solution and supersedes a detached forecast before launch',async()=>{
  const w=worker();w.send({type:'solve',requestId:1,revision:1,plan,craft});const old=await w.next('solved',1);
  w.send({type:'forecast',requestId:1});await w.next('forecast-progress',1);
  const invalid={...plan,aim:{xKm:100000,yKm:0}};w.send({type:'solve',requestId:2,revision:2,plan:invalid,craft});expect((await w.next('solved',2)).status).toBe('infeasible');
  w.send({type:'launch',requestId:2,controlEpoch:1,inputHash:old.solution.inputHash});expect((await w.next('error',2)).error).toBe('LAUNCH_NOT_ACCEPTED');
  const nextPlan=createSwingbyPlan('economy');w.send({type:'solve',requestId:3,revision:3,plan:nextPlan,craft});const valid=await w.next('solved',3);w.send({type:'launch',requestId:3,controlEpoch:1,inputHash:valid.solution.inputHash});const started=await w.next('launched',3);expect(started.state.solution.plan).toEqual(nextPlan);
  expect(w.history.some(m=>m.type==='forecast'&&m.requestId===1)).toBe(false);expect(w.history.some(m=>m.type==='launched'&&m.requestId===2)).toBe(false);
 },60000);
 it('keeps a paused flight after malformed and forged imports and replays its genuine snapshot',async()=>{
  const {w}=await launched();w.send({type:'advance',requestId:1,controlEpoch:1,targetTime:600});const original=(await w.next('runtime',1)).state;
  w.send({type:'save',requestId:1,saveId:'genuine'});const genuine=await w.next('save-snapshot',1);
  w.send({type:'restore',requestId:2,text:'{bad json'});const malformed=await w.next('error',2);expect(malformed.retainedFlight).toBe(true);expect(malformed.state).toEqual(original);expect(malformed.plan).toEqual(plan);
  // A new session retains the prior physical state, with demand paused.
  w.send({type:'advance',requestId:2,controlEpoch:0,targetTime:600});expect((await w.next('runtime',2)).state).toEqual(original);
  const forged=JSON.parse(genuine.text);forged.checkpoint.energyWh+=1;w.send({type:'restore',requestId:3,text:JSON.stringify(forged)});const rejected=await w.next('error',3);expect(rejected.error).toBe('BAD_CHECKPOINT');expect(rejected.state).toEqual(original);
  w.send({type:'restore',requestId:4,text:genuine.text});const restored=await w.next('restored',4);expect(restored.state).toEqual(original);
  w.send({type:'advance',requestId:3,controlEpoch:0,targetTime:900});w.send({type:'advance',requestId:4,controlEpoch:0,targetTime:900});expect((await w.next('runtime',4)).state.time).toBe(900);
 },60000);
 it('cancels bounded replay, ignores its stale completion and preserves draft numerical settings',async()=>{
  const solution=solveSwingbyPlan(plan,craft);if(solution.status!=='solved')throw Error('baseline');const flight=createSwingbyRuntime(solution.solution,craft);advanceSwingby(flight,5000,Infinity);expect(flight.time).toBe(5000);
  const text=serializeSwingbySave(makeSwingbySave(plan,craft,flight));const w=worker();w.send({type:'restore',requestId:1,text});await w.next('restore-progress',1);
  const settings={cruiseStepSeconds:60 as const,activeStepSeconds:.5 as const},draft=serializeSwingbySave(makeSwingbySave(createSwingbyPlan('economy'),craft,undefined,settings));w.send({type:'restore',requestId:2,text:draft});const restored=await w.next('restored',2);expect(restored.state).toBeNull();expect(restored.numerics).toEqual(settings);
  expect(restored.visualPath.certified).toBe(true);expect(restored.visualPath.maxChordErrorKm).toBeLessThanOrEqual(restored.visualPath.toleranceKm);
  w.send({type:'save',requestId:2,saveId:'draft'});expect((await w.next('save-snapshot',2)).save.numerics).toEqual(settings);expect(w.history.some(m=>m.type==='restored'&&m.requestId===1)).toBe(false);
 },60000);
 it('preserves a valid but unreachable draft without carrying over an old launchable solution',async()=>{
  const w=worker();w.send({type:'solve',requestId:1,revision:1,plan,craft});const old=await w.next('solved',1);
  const unreachable={...plan,aim:{xKm:4000,yKm:0}};expect(solveSwingbyPlan(unreachable,craft).status).toBe('infeasible');
  const text=serializeSwingbySave(makeSwingbySave(unreachable,craft));w.send({type:'restore',requestId:2,text});const restored=await w.next('restored',2);
  expect(restored.plan).toEqual(unreachable);expect(restored.draftSaveable).toBe(true);expect(restored.solution).toBeNull();expect(restored.evaluation).toBeNull();expect(restored.initial).toBeNull();expect(restored.predictedTrajectory).toBeNull();expect(restored.issues.length).toBeGreaterThan(0);
  w.send({type:'launch',requestId:2,controlEpoch:1,inputHash:old.solution.inputHash});expect((await w.next('error',2)).error).toBe('LAUNCH_NOT_ACCEPTED');
  w.send({type:'save',requestId:2,saveId:'unreachable'});expect((await w.next('save-snapshot',2)).save.plan).toEqual(unreachable);
 },60000);
});
