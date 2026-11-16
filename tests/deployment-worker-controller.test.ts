import {afterEach,beforeAll,describe,expect,it} from 'vitest';
import {buildSync} from 'esbuild';
import {Worker} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import {createDeploymentCraft,createDeploymentPlan} from '../src/deployment';

type Message={type:string;requestId:number;controlEpoch:number;[key:string]:any};
let source='';
beforeAll(()=>{
 const bundle=buildSync({entryPoints:[fileURLToPath(new URL('../src/deployment.worker.ts',import.meta.url))],bundle:true,platform:'node',format:'cjs',target:'node24',write:false}).outputFiles[0].text;
 source=`const {parentPort}=require('node:worker_threads');globalThis.self={onmessage:null,postMessage(m){parentPort.postMessage(m)}};parentPort.on('message',data=>self.onmessage({data}));\n${bundle}`;
});
class FlightWorker{
 readonly thread=new Worker(source,{eval:true});readonly history:Message[]=[];
 private inbox:Message[]=[];
 private waiters:{test:(m:Message)=>boolean;resolve:(m:Message)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}[]=[];
 constructor(){this.thread.on('message',(m:Message)=>{this.history.push(m);const i=this.waiters.findIndex(w=>w.test(m));if(i<0)this.inbox.push(m);else{const [w]=this.waiters.splice(i,1);clearTimeout(w.timer);w.resolve(m);}});this.thread.on('error',e=>{for(const w of this.waiters){clearTimeout(w.timer);w.reject(e instanceof Error?e:Error(String(e)));}this.waiters=[];});}
 send(type:string,requestId=1,controlEpoch=0,extra:Record<string,unknown>={}){this.thread.postMessage({type,requestId,controlEpoch,...extra});}
 next(type:string,requestId=1,predicate:(m:Message)=>boolean=()=>true){const test=(m:Message)=>m.type===type&&m.requestId===requestId&&predicate(m),i=this.inbox.findIndex(test);if(i>=0)return Promise.resolve(this.inbox.splice(i,1)[0]);return new Promise<Message>((resolve,reject)=>{const waiter={test,resolve,reject,timer:setTimeout(()=>{this.waiters=this.waiters.filter(w=>w!==waiter);reject(Error(`Missing ${type}/${requestId}; last=${JSON.stringify(this.history.at(-1)?.type)}`));},60000)};this.waiters.push(waiter);});}
 async close(){for(const w of this.waiters)clearTimeout(w.timer);this.waiters=[];await this.thread.terminate();}
}
const opened:FlightWorker[]=[];
const worker=()=>{const w=new FlightWorker();opened.push(w);return w;};
afterEach(async()=>{await Promise.all(opened.splice(0).map(w=>w.close()));});
async function evaluate(w:FlightWorker){w.send('evaluate',1,0,{revision:1,craft:createDeploymentCraft(),plan:createDeploymentPlan()});return (await w.next('evaluated')).draft;}
async function launch(w:FlightWorker){const draft=await evaluate(w);expect(draft.launchable).toBe(true);w.send('launch',1,1,{inputHash:draft.inputHash});return {draft,initial:await w.next('launched')};}
async function pauseSave(w:FlightWorker,session=1,epoch=2){w.send('pause',session,epoch);const paused=await w.next('paused',session,m=>m.controlEpoch===epoch);w.send('save',session,epoch,{saveId:1});const saved=await w.next('save-snapshot',session);return {paused,saved};}

describe('deployment authoritative Worker controls',()=>{
 it('keeps mouse hinge previews detached from the launched joints and energy',async()=>{
  const w=worker(),draft=await evaluate(w),joint=draft.topology.joints[0];
  w.send('preview-hinge',1,0,{previewId:1,sourceId:draft.inputHash,angles:{},jointId:joint.id,targetAngleRad:(joint.minimumRad+joint.maximumRad)/2});
  const preview=await w.next('hinge-preview');expect(preview.authority).toBe('editor-preview-only');expect(preview.geometry.joints[joint.id].angleRad).not.toBe(draft.initial.geometry.joints[joint.id].angleRad);
  w.send('launch',1,1,{inputHash:draft.inputHash});const live=await w.next('launched');expect(live.geometry).toEqual(draft.initial.geometry);expect(live.state.energyWh).toBe(draft.initial.state.energyWh);
  w.send('launch',1,1,{inputHash:draft.inputHash});const duplicate=await w.next('launched',1,m=>m.duplicate===true);expect(duplicate.state).toEqual(live.state);
  w.send('preview-hinge',1,1,{previewId:2,sourceId:draft.inputHash,angles:{},jointId:joint.id,targetAngleRad:joint.deployedRad});expect((await w.next('error')).error).toBe('PREVIEW_UNAVAILABLE');
 },90000);
 it('a pause cuts queued warp demand and duplicate controls cannot add a second minute',async()=>{
  const w=worker();await launch(w);w.send('advance',1,1,{targetTime:300});await w.next('runtime-progress');
  const {paused,saved}=await pauseSave(w);expect(saved.save.checkpoint.time).toBe(paused.state.time);expect(saved.save.checkpoint.requestedTime).toBe(paused.state.time);
  w.send('advance',1,1,{targetTime:1000});w.send('pause',1,2);const duplicate=await w.next('paused',1,m=>m.duplicate===true);expect(duplicate.state).toEqual(paused.state);
  w.send('step',1,2);w.send('save',1,2,{saveId:2});expect((await w.next('save-snapshot',1,m=>m.saveId===2)).save.checkpoint).toEqual(saved.save.checkpoint);
  w.send('step',1,3);const step=await w.next('runtime',1,m=>m.controlEpoch===3);expect(step.state.time).toBeCloseTo(paused.state.time+60,9);
  w.send('step',1,3);expect((await w.next('runtime',1,m=>m.duplicate===true)).state).toEqual(step.state);
 },90000);
 it('strict failed import preserves the old flight and cancelled replay never adopts a new checkpoint',async()=>{
  const w=worker();await launch(w);w.send('advance',1,1,{targetTime:300});const done=await w.next('runtime');expect(done.state.time).toBe(300);
  const {saved}=await pauseSave(w),forged=JSON.parse(saved.text);forged.checkpoint.energyWh+=1;
  w.send('restore',2,0,{text:JSON.stringify(forged)});const error=await w.next('error',2);expect(error.error).toBe('BAD_CHECKPOINT');expect(error.retainedFlight).toBe(true);expect(error.state.time).toBe(300);
  w.send('save',2,0,{saveId:3});expect((await w.next('save-snapshot',2)).save.checkpoint).toEqual(saved.save.checkpoint);
  w.send('restore',3,0,{text:saved.text});await w.next('restore-progress',3);w.send('cancel-restore',3,1);const cancelled=await w.next('restore-cancelled',3);expect(cancelled.state.time).toBe(300);
  w.send('save',3,1,{saveId:4});expect((await w.next('save-snapshot',3)).save.checkpoint).toEqual(saved.save.checkpoint);expect(w.history.filter(m=>m.type==='restored')).toHaveLength(0);
 },120000);
});
