import {describe,it,expect} from 'vitest';
import {ReviewClient,ReviewCancelled} from '../src/review-client';

// Transport-only fixtures are intentionally NOT evidence of engine validation.
// Real Worker replay and genuine flights are tested separately.
class Transport {
 onmessage:((event:MessageEvent)=>void)|null=null;onerror:(()=>void)|null=null;
 sent:any[]=[];terminated=false;
 postMessage(message:unknown){this.sent.push(structuredClone(message));}
 terminate(){this.terminated=true;}
 emit(message:any){this.onmessage?.({data:{sessionId:1,...message}} as MessageEvent);}
}
const fixture=(id:string)=>({source:{runId:id,engineSaveText:JSON.stringify({immutableSource:id}),engineSaveSha256:id.repeat(64)},result:{score:10}} as any);
const create=()=>{const transport=new Transport(),client=new ReviewClient(transport as unknown as Worker);return {transport,client};};
describe('review client logical ownership and asynchronous response ordering',()=>{
 it('a cancelled request and its late error cannot reject a newer cursor',async()=>{
  const {transport,client}=create();const first=client.request({type:'seek',runId:'A' as any,timeSeconds:4000}).catch(e=>e),firstId=transport.sent.at(-1).requestId;
  client.cancel();expect(await first).toBeInstanceOf(ReviewCancelled);const second=client.request({type:'seek',runId:'A' as any,timeSeconds:0}),secondId=transport.sent.at(-1).requestId;
  transport.emit({type:'error',requestId:firstId,code:'OLD_FAILURE'});expect(client.pending).toBe(secondId);
  const sample={type:'sample',requestId:secondId,cursor:{committedTimeSeconds:0}};transport.emit(sample);expect(await second).toEqual({sessionId:1,...sample});expect(client.pending).toBeNull();client.dispose();
 });
 it('an already committed cancelled save remains observable without completing a different request',async()=>{
  const {transport,client}=create(),commits:any[]=[];client.onCommit(e=>commits.push(e));const save=client.request({type:'save-pair',beforeRunId:'A' as any,afterRunId:null}).catch(e=>e),saveId=transport.sent.at(-1).requestId;client.cancel();await save;
  const seek=client.request({type:'seek',runId:'A' as any,timeSeconds:0}),seekId=transport.sent.at(-1).requestId;
  transport.emit({type:'archive-commit',requestId:saveId,revision:7,baselineRunId:'A',attemptRunId:null,stale:true});expect(commits).toHaveLength(1);expect(commits[0].revision).toBe(7);expect(commits[0].stale).toBe(true);expect(client.pending).toBe(seekId);
  transport.emit({type:'sample',requestId:seekId,cursor:{committedTimeSeconds:0}});await seek;client.dispose();
 });
 it('a stale archive replacement reports missing registrations but preserves detached source bytes for re-verification',async()=>{
  const {transport,client}=create(),a=fixture('A');client.setSessionPair({baseline:a,attempt:null,persisted:false,revision:null});
  transport.emit({type:'verified',requestId:0,run:a});expect(client.retainedRuns.has('A' as any)).toBe(true);
  const load=client.request({type:'load-archive'}).catch(e=>e),loadId=transport.sent.at(-1).requestId;client.cancel();await load;
  transport.emit({type:'archive',requestId:loadId,baseline:fixture('B'),attempt:null,persisted:true,revision:4,text:'verified archived B',storageError:null,retainedRunIds:['B']});
  expect(client.retainedRuns.has('A' as any)).toBe(false);expect(client.retainedRuns.has('B' as any)).toBe(true);expect(client.getSessionPair()?.baseline.source.engineSaveText).toBe(a.source.engineSaveText);expect(client.getSessionPair()?.persisted).toBe(false);
  const copy=client.getSessionPair()!;(copy.baseline.source as any).engineSaveText='modified by view';expect(client.getSessionPair()?.baseline.source.engineSaveText).toBe(a.source.engineSaveText);
  const verify=client.request({type:'verify',source:a.source}),id=transport.sent.at(-1).requestId;transport.emit({type:'verified',requestId:id,run:a});await verify;expect(client.retainedRuns.has('A' as any)).toBe(true);client.dispose();
 });
 it('releasing obsolete attempts preserves A and waits for actual sequential acknowledgements',async()=>{
  const {transport,client}=create();for(const id of ['A','B','C'])transport.emit({type:'verified',requestId:0,run:fixture(id)});
  const work=client.releaseExcept(new Set(['A'] as any));expect(transport.sent.at(-1).runId).toBe('B');const first=transport.sent.at(-1).requestId;
  transport.emit({type:'released',requestId:first,runId:'B',retainedRunIds:['A','C']});await Promise.resolve();expect(transport.sent.at(-1).runId).toBe('C');
  transport.emit({type:'released',requestId:transport.sent.at(-1).requestId,runId:'C',retainedRunIds:['A']});await work;expect([...client.retainedRuns]).toEqual(['A']);client.dispose();
 });
 it('worker failure rejects pending work explicitly and retains source data until disposal',async()=>{
  const {transport,client}=create();client.setSessionPair({baseline:fixture('A'),attempt:null,persisted:false,revision:null});const work=client.request({type:'load-archive'}).catch(e=>e);transport.onerror?.();expect((await work).message).toBe('REVIEW_WORKER_FAILED');expect(client.unavailable).toBe(true);expect(client.pending).toBeNull();expect(client.getSessionPair()?.baseline.source.runId).toBe('A');await expect(client.request({type:'load-archive'})).rejects.toThrow('REVIEW_WORKER_FAILED');client.dispose();expect(transport.terminated).toBe(true);expect(client.getSessionPair()).toBeNull();
 });
});
