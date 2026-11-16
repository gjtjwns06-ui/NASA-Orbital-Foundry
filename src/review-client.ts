import type {ReviewRequest,ReviewResponse,RunId,VerifiedRun} from './redesign/schema';

type RequestBody<T=ReviewRequest>=T extends ReviewRequest?Omit<T,'sessionId'|'requestId'>:never;
type Progress=Extract<ReviewResponse,{type:'progress'}>;
type Commit=Extract<ReviewResponse,{type:'archive-commit'}>;
export interface SessionReviewPair {baseline:VerifiedRun;attempt:VerifiedRun|null;persisted:boolean;revision:number|null;storageUnconfirmed?:boolean}
export class ReviewCancelled extends Error {constructor(){super('REVIEW_CANCELLED');}}

/** One detached Worker survives closing a review so verified A remains warm
 * while the player edits and flies B. No live flight object enters this client. */
export class ReviewClient {
 private worker:Worker;
 private sequence=0;
 private readonly sessionId=1;
 private failed=false;
 private active:{id:number;resolve:(response:ReviewResponse)=>void;reject:(error:Error)=>void;progress?:(value:Progress)=>void}|null=null;
 private commits=new Set<(event:Commit)=>void>();
 private pair:SessionReviewPair|null=null;
 readonly retainedRuns=new Set<RunId>();
 constructor(worker?:Worker){
  this.worker=worker??new Worker(new URL('./redesign/review.worker.ts',import.meta.url),{type:'module'});
  this.worker.onmessage=event=>this.receive(event.data as ReviewResponse);
  this.worker.onerror=()=>{this.failed=true;this.active?.reject(new Error('REVIEW_WORKER_FAILED'));this.active=null;};
 }
 get pending(){return this.active?.id??null;}
 get unavailable(){return this.failed;}
 getSessionPair(){return this.pair?structuredClone(this.pair):null;}
 setSessionPair(pair:SessionReviewPair|null){this.pair=pair?structuredClone(pair):null;}
 private receive(response:ReviewResponse){
  if(response.sessionId!==this.sessionId)return;
  // Storage commit is a fact even if the view has cancelled an older request.
  if(response.type==='archive-commit'){for(const listener of this.commits)listener(response);return;}
  if(response.type==='verified')this.retainedRuns.add(response.run.source.runId);
  if(response.type==='archive'||response.type==='released'){
   this.retainedRuns.clear();for(const id of response.retainedRunIds)this.retainedRuns.add(id);
  }
  const task=this.active;if(!task||response.requestId!==task.id)return;
  if(response.type==='progress'){task.progress?.(response);return;}
  this.active=null;
  if(response.type==='error')task.reject(new Error(response.code));
  else if(response.type==='cancelled')task.reject(new ReviewCancelled());
  else task.resolve(response);
 }
 request(body:RequestBody,progress?:(value:Progress)=>void):Promise<ReviewResponse>{
  if(this.failed)return Promise.reject(new Error('REVIEW_WORKER_FAILED'));
  this.cancel();const requestId=++this.sequence;
  return new Promise((resolve,reject)=>{
   this.active={id:requestId,resolve,reject,progress};
   this.worker.postMessage({...body,sessionId:this.sessionId,requestId} satisfies ReviewRequest);
  });
 }
 cancel(){
  const task=this.active;if(!task)return;
  this.active=null;task.reject(new ReviewCancelled());
  this.worker.postMessage({type:'cancel',sessionId:this.sessionId,requestId:++this.sequence,cancelledRequestId:task.id} satisfies ReviewRequest);
 }
 onCommit(listener:(event:Commit)=>void){this.commits.add(listener);return ()=>this.commits.delete(listener);}
 async releaseExcept(keep:ReadonlySet<RunId>){
  for(const runId of [...this.retainedRuns])if(!keep.has(runId))await this.request({type:'release-run',runId});
 }
 dispose(){this.cancel();this.failed=true;this.pair=null;this.commits.clear();this.retainedRuns.clear();this.worker.terminate();}
}
let shared:ReviewClient|null=null;
export function getReviewClient(){if(!shared||shared.unavailable){shared?.dispose();shared=new ReviewClient();}return shared;}
