import {beforeAll,expect,it} from 'vitest';
import {createReviewController} from '../src/redesign/worker-controller';
import {createSwingbyDesign,createSwingbyPlan,solveSwingbyPlan,createSwingbyRuntime,makeSwingbySave,serializeSwingbySave} from '../src/swingby';
import type {AtomicReviewStore,ArchiveSnapshot} from '../src/redesign/archive';
import type {ReviewPair,ReviewResponse} from '../src/redesign/schema';
import {ReviewError} from '../src/redesign/validation';
import {assertEngineIntegrity} from './review-integrity';
let text='';beforeAll(()=>{assertEngineIntegrity();const craft=createSwingbyDesign(),plan=createSwingbyPlan(),s=solveSwingbyPlan(plan,craft);if(s.status!=='solved')throw Error();text=serializeSwingbySave(makeSwingbySave(plan,craft,createSwingbyRuntime(s.solution,craft)));});
class CommitStore implements AtomicReviewStore {
 state:ArchiveSnapshot={revision:0,text:null};writes=0;finish:(()=>void)|null=null;committed=false;
 async read(){return structuredClone(this.state);}
 replace(expected:number,pair:ReviewPair,signal?:AbortSignal):Promise<ArchiveSnapshot>{this.writes++;return new Promise((resolve,reject)=>{
  if(expected!==this.state.revision){reject(new ReviewError('ARCHIVE_CONFLICT'));return;}
  const abort=()=>{if(!this.committed)reject(new ReviewError('REVIEW_CANCELLED'));};signal?.addEventListener('abort',abort,{once:true});
  this.finish=()=>{signal?.removeEventListener('abort',abort);if(signal?.aborted&&!this.committed){reject(new ReviewError('REVIEW_CANCELLED'));return;}if(!this.committed)this.state={revision:expected+1,text:JSON.stringify(pair)};resolve(structuredClone(this.state));};
  if(this.committed)this.state={revision:expected+1,text:JSON.stringify(pair)};
 });}
}
async function until(p:()=>boolean){for(let i=0;i<100&&!p();i++)await new Promise(r=>setTimeout(r,0));expect(p()).toBe(true);}
it('reports a truly committed stale write separately and never replays it on duplicate delivery',async()=>{
 const store=new CommitStore();store.committed=true;const messages:ReviewResponse[]=[],c=createReviewController(m=>messages.push(m),store);await c.handle({type:'pin',sessionId:1,requestId:1,engineSaveText:text,runId:'A',displayName:'A'});
 const save={type:'save-pair' as const,sessionId:1,requestId:2,beforeRunId:'A' as any,afterRunId:null};const pending=c.handle(save);await until(()=>Boolean(store.finish));
 await c.handle({type:'seek',sessionId:1,requestId:3,runId:'A' as any,timeSeconds:0});store.finish!();await pending;
 expect(messages.some(m=>m.type==='archive-commit'&&m.requestId===2&&m.stale&&m.revision===1)).toBe(true);expect(messages.some(m=>m.type==='archive'&&m.requestId===2)).toBe(false);expect(messages.some(m=>m.type==='sample'&&m.requestId===3)).toBe(true);
 await c.handle(save);expect(store.writes).toBe(1);await c.handle({type:'cancel',sessionId:1,requestId:4,cancelledRequestId:2});const ack=messages.at(-1);expect(ack?.type).toBe('cancelled');if(ack?.type==='cancelled')expect(ack.committedRevision).toBe(1);c.dispose();
});
it('a newer session aborts an uncommitted archive write and cannot adopt its old pair',async()=>{
 const store=new CommitStore(),messages:ReviewResponse[]=[],c=createReviewController(m=>messages.push(m),store);await c.handle({type:'pin',sessionId:1,requestId:1,engineSaveText:text,runId:'A',displayName:'A'});
 const pending=c.handle({type:'save-pair',sessionId:1,requestId:2,beforeRunId:'A' as any,afterRunId:null});await until(()=>Boolean(store.finish));await c.handle({type:'pin',sessionId:2,requestId:1,engineSaveText:text,runId:'new-A',displayName:'new-A'});store.finish!();await pending;
 expect(store.state.text).toBeNull();expect(messages.some(m=>m.type==='archive-commit')).toBe(false);expect(c.getState().verifiedRunIds).toEqual(['new-A']);expect(messages.some(m=>m.type==='archive'&&m.sessionId===1)).toBe(false);c.dispose();
});
