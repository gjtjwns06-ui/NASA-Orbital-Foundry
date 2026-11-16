import {expect,it,beforeAll} from 'vitest';
import {createSwingbyDesign,createSwingbyPlan,solveSwingbyPlan,createSwingbyRuntime,makeSwingbySave,serializeSwingbySave} from '../src/swingby';
import {pinSwingbyRun} from '../src/redesign/adapters/swingby';
import {ReviewArchive,makeReviewPair,type AtomicReviewStore,type ArchiveSnapshot} from '../src/redesign/archive';
import {ReviewError} from '../src/redesign/validation';
import type {ReviewPair,VerifiedRun} from '../src/redesign/schema';
import {assertEngineIntegrity} from './review-integrity';
let A:VerifiedRun,B:VerifiedRun;
beforeAll(async()=>{assertEngineIntegrity();const craft=createSwingbyDesign(),plan=createSwingbyPlan(),solved=solveSwingbyPlan(plan,craft);if(solved.status!=='solved')throw Error();const state=createSwingbyRuntime(solved.solution,craft),text=serializeSwingbySave(makeSwingbySave(plan,craft,state));A=await pinSwingbyRun(text,{runId:'A',displayName:'A'});B=await pinSwingbyRun(text,{runId:'B',displayName:'B'});});
class DeferredStore implements AtomicReviewStore {
 state:ArchiveSnapshot={revision:0,text:null};writes:{signal?:AbortSignal;finish:()=>void}[]=[];
 async read(){return structuredClone(this.state);}
 replace(expected:number,pair:ReviewPair,signal?:AbortSignal):Promise<ArchiveSnapshot>{return new Promise((resolve,reject)=>{
  const abort=()=>reject(new ReviewError('REVIEW_CANCELLED'));if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  this.writes.push({signal,finish:()=>{signal?.removeEventListener('abort',abort);if(signal?.aborted){abort();return;}if(this.state.revision!==expected){reject(new ReviewError('ARCHIVE_CONFLICT'));return;}this.state={revision:expected+1,text:JSON.stringify(pair)};resolve(structuredClone(this.state));}});
 });}
}
async function until(predicate:()=>boolean){for(let i=0;i<100&&!predicate();i++)await new Promise(r=>setTimeout(r,0));expect(predicate()).toBe(true);}
it('cancelling after verification but before atomic commit preserves the prior archive',async()=>{
 const store=new DeferredStore();store.state={revision:1,text:makeReviewPair(A).text};const archive=new ReviewArchive(store),pending=archive.importAndPersist(makeReviewPair(B).text);await until(()=>store.writes.length===1);archive.cancel();const result=await pending;store.writes[0].finish();expect(result.persisted).toBe(false);expect(result.error).toBe('REVIEW_CANCELLED');expect(store.state).toEqual({revision:1,text:makeReviewPair(A).text});expect(result.prepared.baseline.source.runId).toBe('B');
});
it('a newer import aborts a pending older replacement rather than causing a stale CAS conflict',async()=>{
 const store=new DeferredStore(),archive=new ReviewArchive(store),older=archive.importAndPersist(makeReviewPair(A).text);await until(()=>store.writes.length===1);const newer=archive.importAndPersist(makeReviewPair(B).text);await until(()=>store.writes.length===2);store.writes[0].finish();store.writes[1].finish();expect((await older).persisted).toBe(false);expect((await newer).persisted).toBe(true);expect(store.state.revision).toBe(1);expect(JSON.parse(store.state.text!).baseline.runId).toBe('B');
});
it('cancellation cannot falsely report that an already completed commit was recalled',async()=>{
 const store=new DeferredStore(),archive=new ReviewArchive(store),pending=archive.importAndPersist(makeReviewPair(A).text);await until(()=>store.writes.length===1);store.writes[0].finish();const committed=await pending;archive.cancel();expect(committed.persisted).toBe(true);expect(store.state.text).toBe(makeReviewPair(A).text);
});
