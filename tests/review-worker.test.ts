import {afterEach,beforeAll,describe,it,expect} from 'vitest';
import {buildSync} from 'esbuild';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {createSwingbyDesign,createSwingbyPlan,solveSwingbyPlan,createSwingbyRuntime,advanceSwingby,makeSwingbySave,serializeSwingbySave} from '../src/swingby';
import {assertEngineIntegrity} from './review-integrity';
import {hashText} from '../src/redesign/validation';
let source='',zeroText='',partialText='';
beforeAll(()=>{
 assertEngineIntegrity();
 const bundled=buildSync({entryPoints:[fileURLToPath(new URL('../src/redesign/review.worker.ts',import.meta.url))],bundle:true,platform:'node',format:'cjs',target:'node24',write:false}).outputFiles[0].text;
 source=`const {parentPort}=require('node:worker_threads');globalThis.self={onmessage:null,postMessage(m){parentPort.postMessage(m)}};parentPort.on('message',data=>Promise.resolve(self.onmessage({data})).catch(e=>parentPort.postMessage({type:'fatal',error:String(e)})));\n${bundled}`;
 const craft=createSwingbyDesign();craft.parts.find(p=>p.kind==='adcs')!.modelId='xact15-carrier-v1';const plan=createSwingbyPlan(),solved=solveSwingbyPlan(plan,craft);if(solved.status!=='solved')throw Error('actual fixture');const runtime=createSwingbyRuntime(solved.solution,craft);zeroText=serializeSwingbySave(makeSwingbySave(plan,craft,runtime));advanceSwingby(runtime,5000,Infinity);partialText=serializeSwingbySave(makeSwingbySave(plan,craft,runtime));
},30000);
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

const pin=(text:string,runId:string,requestId:number,sessionId=1)=>({type:'pin',sessionId,requestId,engineSaveText:text,runId,displayName:runId});
describe('actual detached review Worker',()=>{
 it('exports and imports verified A/B entirely in the Worker and retains memory review when storage is unavailable',async()=>{
  const w=worker();w.send(pin(zeroText,'A',1));await w.next('verified',1);w.send(pin(zeroText,'B',2));await w.next('verified',2);w.send({type:'export-pair',sessionId:1,requestId:3,beforeRunId:'A',afterRunId:'B'});const exported=await w.next('archive-export',3);expect(exported.pair.baseline.engineSaveText).toBe(zeroText);
  w.send({type:'release-run',sessionId:1,requestId:4,runId:'B'});expect((await w.next('released',4)).retainedRunIds).toEqual(['A']);
  w.send({type:'import-archive',sessionId:1,requestId:5,text:exported.text,persist:false});const imported=await w.next('archive',5);expect(imported.retainedRunIds).toEqual(['A','B']);expect(imported.persisted).toBe(false);expect(imported.storageError).toBeNull();
  w.send({type:'save-pair',sessionId:1,requestId:6,beforeRunId:'A',afterRunId:'B'});const saved=await w.next('archive',6);expect(saved.persisted).toBe(false);expect(saved.storageError).toBe('STORAGE_UNAVAILABLE');expect(saved.text).toBe(exported.text);
  const bad=JSON.parse(exported.text);bad.baseline.engineSaveSha256='0'.repeat(64);w.send({type:'import-archive',sessionId:1,requestId:7,text:JSON.stringify(bad),persist:false});await w.next('error',7);w.send({type:'compare',sessionId:1,requestId:8,beforeRunId:'A',afterRunId:'B'});expect((await w.next('comparison',8)).comparison.compatibility.mode).toBe('controlled');
 });
 it('releases an obsolete logical handle so repeated redesigns respect the four-run bound',async()=>{
  const w=worker();for(let i=1;i<=4;i++){w.send(pin(zeroText,'run-'+i,i));await w.next('verified',i);}w.send(pin(zeroText,'run-5',5));expect((await w.next('error',5)).code).toBe('REVIEW_CAPACITY');w.send({type:'release-run',sessionId:1,requestId:6,runId:'run-2'});expect((await w.next('released',6)).retainedRunIds).toEqual(['run-1','run-3','run-4']);w.send(pin(zeroText,'run-5',7));await w.next('verified',7);
 });
 it('returns a routed error for invalid payload values instead of leaving the UI pending',async()=>{
  const w=worker();w.send(pin(zeroText,'A',1));await w.next('verified',1);w.send({...pin(zeroText,'invalid',2),displayName:undefined});expect((await w.next('error',2)).preservesPrevious).toBe(true);w.send({type:'seek',sessionId:1,requestId:3,runId:'A',timeSeconds:0});expect((await w.next('sample',3)).cursor.committedTimeSeconds).toBe(0);
 });
 it('strictly pins an actual run, rejects forged import, and preserves prior verified A',async()=>{
  const w=worker();w.send(pin(zeroText,'A',1));const original=(await w.next('verified',1)).run;expect(original.source.engineSaveSha256).toBe(hashText(zeroText));
  const bad=JSON.parse(zeroText);bad.checkpoint.fuelKg=99;w.send(pin(JSON.stringify(bad),'forged',2));expect((await w.next('error',2)).preservesPrevious).toBe(true);
  w.send({type:'seek',sessionId:1,requestId:3,runId:'A',timeSeconds:0});const sample=await w.next('sample',3);expect(sample.cursor.committedTimeSeconds).toBe(0);expect(sample.renderDto.physical.elapsedSeconds).toBe(0);expect(sample.renderDto.packets).toEqual([]);
  w.send({type:'fork',sessionId:1,requestId:4,runId:'A'});const draft=await w.next('draft',4);expect(Object.keys(draft.draft).sort()).toEqual(['craft','numerics','parentRunId','plan']);expect(draft.draft.craft).toEqual(JSON.parse(zeroText).craft);expect(w.history.some(m=>m.type==='fatal')).toBe(false);
 });
 it('latest seek wins without publishing an old cursor, and duplicate IDs cannot change work',async()=>{
  const w=worker();w.send(pin(partialText,'A',1));await w.next('verified',1);
  const seek={type:'seek',sessionId:1,requestId:2,runId:'A',timeSeconds:4500};w.send(seek);await w.next('progress',2);w.send({type:'seek',sessionId:1,requestId:3,runId:'A',timeSeconds:0});const latest=await w.next('sample',3);expect(latest.cursor.committedTimeSeconds).toBe(0);
  w.send({type:'seek',sessionId:1,requestId:3,runId:'A',timeSeconds:4000});expect((await w.next('error',3)).code).toBe('REQUEST_ID_CONFLICT');
  w.send({type:'seek',sessionId:1,requestId:3,runId:'A',timeSeconds:0});expect((await w.next('sample',3)).cursor).toEqual(latest.cursor);
  w.send({type:'fork',sessionId:1,requestId:4,runId:'A'});await w.next('draft',4);expect(w.history.some(m=>m.type==='sample'&&m.requestId===2)).toBe(false);
 },30000);
 it('explicit cancel and newer sessions supersede strict replay without adopting its late result',async()=>{
  const w=worker();w.send(pin(partialText,'cancelled',1));await w.next('progress',1);w.send({type:'cancel',sessionId:1,requestId:2,cancelledRequestId:1});await w.next('cancelled',2);w.send(pin(zeroText,'new-A',1,2));await w.next('verified',1,m=>m.sessionId===2);
  w.send({type:'fork',sessionId:2,requestId:2,runId:'cancelled'});expect((await w.next('error',2,m=>m.sessionId===2)).code).toBe('RUN_NOT_VERIFIED');expect(w.history.some(m=>m.type==='verified'&&m.sessionId===1)).toBe(false);
  w.send({type:'seek',sessionId:1,requestId:50,runId:'new-A',timeSeconds:0});w.send({type:'seek',sessionId:2,requestId:3,runId:'new-A',timeSeconds:0});expect((await w.next('sample',3)).sessionId).toBe(2);expect(w.history.some(m=>m.requestId===50)).toBe(false);
 });
 it('rejects an ID reused for another part model instead of focusing the wrong geometry',async()=>{
  const w=worker();w.send(pin(zeroText,'A',1));await w.next('verified',1);const craft=JSON.parse(zeroText).craft,part=craft.parts.find((p:any)=>p.kind==='adcs');w.send({type:'inspect',sessionId:1,requestId:2,runId:'A',target:{kind:'part',partId:part.id,signature:{kind:part.kind,modelId:'xact50-carrier-v1',face:part.face,uMeters:part.u,vMeters:part.v,rotationDeg:part.rotation}}});expect((await w.next('error',2)).code).toBe('TARGET_STALE');
 });
});
