import type {ReviewPair,VerifiedRun,RunId} from './schema';
import {exactKeys,freeze,parseJson,record,ReviewError,validateSource,MAX_ARCHIVE_BYTES,identifier} from './validation';
import {utf8Length} from '../transfer/operations-codec';
import {verifySwingbySource,type ReviewTaskOptions} from './adapters/swingby';
import {requireVerified} from './compare';
export interface PreparedReviewPair {pair:ReviewPair;baseline:VerifiedRun;attempt:VerifiedRun|null;text:string}
export function makeReviewPair(a:VerifiedRun,b:VerifiedRun|null=null):PreparedReviewPair{
 requireVerified(a);if(b)requireVerified(b);if(b&&b.source.runId===a.source.runId)throw new ReviewError('DUPLICATE_RUN_ID');
 const pair:ReviewPair=freeze({format:'orbital-foundry-review-pair',version:1,baseline:a.source,attempt:b?.source??null,parentRunId:a.source.runId}),text=JSON.stringify(pair);if(utf8Length(text)>MAX_ARCHIVE_BYTES)throw new ReviewError('REVIEW_SIZE');return freeze({pair,baseline:a,attempt:b,text});
}
export interface ArchiveTaskOptions extends ReviewTaskOptions {sourceProgress?:(runId:RunId,fraction:number,committedTime:number)=>void}
export async function importReviewPair(text:string,options:ArchiveTaskOptions={}):Promise<PreparedReviewPair>{
 const v=record(parseJson(text));exactKeys(v,['format','version','baseline','attempt','parentRunId']);if(v.format!=='orbital-foundry-review-pair'||v.version!==1)throw new ReviewError('ARCHIVE_VERSION');
 const a=validateSource(v.baseline),b=v.attempt===null?null:validateSource(v.attempt);if(v.parentRunId!==a.runId||b&&b.runId===a.runId)throw new ReviewError('ARCHIVE_PARENT');
 const stage=(source:typeof a,offset:number,weight:number)=>({...options,progress:(fraction:number,time:number)=>{const combined=offset+weight*fraction;options.progress?.(combined,time);options.sourceProgress?.(source.runId,combined,time);}});
 const aa=await verifySwingbySource(a,stage(a,0,b ? .5 : 1)),bb=b?await verifySwingbySource(b,stage(b,.5,.5)):null;return makeReviewPair(aa,bb);
}
export interface ArchiveSnapshot {revision:number;text:string|null}
export interface AtomicReviewStore {read():Promise<ArchiveSnapshot>;replace(expectedRevision:number,pair:ReviewPair,signal?:AbortSignal):Promise<ArchiveSnapshot>}
export const REVIEW_DATABASE='orbital-foundry-review',REVIEW_DATABASE_VERSION=1;
function storedIndex(value:unknown){const v=record(value);exactKeys(v,['revision','baselineId','attemptId']);if(typeof v.revision!=='number'||!Number.isSafeInteger(v.revision)||v.revision<1)throw new ReviewError('ARCHIVE_INDEX');return {revision:v.revision,baselineId:identifier(v.baselineId),attemptId:v.attemptId===null?null:identifier(v.attemptId)};}
function database(signal?:AbortSignal):Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 if(typeof indexedDB==='undefined'){reject(new ReviewError('STORAGE_UNAVAILABLE'));return;}
 if(signal?.aborted){reject(new ReviewError('REVIEW_CANCELLED'));return;}
 let settled=false;const abort=()=>{if(!settled){settled=true;reject(new ReviewError('REVIEW_CANCELLED'));}},cleanup=()=>signal?.removeEventListener('abort',abort);
 signal?.addEventListener('abort',abort,{once:true});const r=indexedDB.open(REVIEW_DATABASE,REVIEW_DATABASE_VERSION);
 r.onupgradeneeded=()=>{r.result.createObjectStore('runs');r.result.createObjectStore('index');};
 r.onerror=()=>{cleanup();if(!settled){settled=true;reject(r.error);}};
 r.onblocked=()=>{cleanup();if(!settled){settled=true;reject(new ReviewError('STORAGE_BLOCKED'));}};
 r.onsuccess=()=>{cleanup();if(settled||signal?.aborted){r.result.close();if(!settled){settled=true;reject(new ReviewError('REVIEW_CANCELLED'));}}else{settled=true;resolve(r.result);}};
});}
/** Both complete source records and the active pair index commit in ONE IDB transaction.
 * Abort is honored until transaction completion. A completed commit cannot be recalled. */
export class IndexedReviewStore implements AtomicReviewStore {
 async read():Promise<ArchiveSnapshot>{const db=await database();try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction(['index','runs'],'readonly'),idx=tx.objectStore('index').get('active');let result:ArchiveSnapshot={revision:0,text:null};
  idx.onsuccess=()=>{if(!idx.result)return;let v:ReturnType<typeof storedIndex>;try{v=storedIndex(idx.result);}catch{tx.abort();return;}
   const a=tx.objectStore('runs').get(v.baselineId),b=v.attemptId?tx.objectStore('runs').get(v.attemptId):null;
   const join=()=>{if(a.readyState!=='done'||b&&b.readyState!=='done')return;if(!a.result||b&&!b.result){tx.abort();return;}result={revision:v.revision,text:JSON.stringify({format:'orbital-foundry-review-pair',version:1,baseline:a.result,attempt:b?.result??null,parentRunId:v.baselineId})};};a.onsuccess=join;if(b)b.onsuccess=join;
  };
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error??new ReviewError('STORAGE_READ'));tx.onabort=()=>reject(tx.error??new ReviewError('STORAGE_READ'));
 });}finally{db.close();}}
 async replace(expectedRevision:number,pair:ReviewPair,signal?:AbortSignal):Promise<ArchiveSnapshot>{
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision===Number.MAX_SAFE_INTEGER)throw new ReviewError('ARCHIVE_INDEX');
  const db=await database(signal);try{return await new Promise((resolve,reject)=>{
   if(signal?.aborted){reject(new ReviewError('REVIEW_CANCELLED'));return;}
   const tx=db.transaction(['runs','index'],'readwrite'),idx=tx.objectStore('index'),read=idx.get('active');let error:Error|null=null,settled=false;
   const cleanup=()=>{settled=true;signal?.removeEventListener('abort',abort);};
   const abort=()=>{if(settled)return;error=new ReviewError('REVIEW_CANCELLED');try{tx.abort();}catch{/* If already committed, oncomplete reports the actual success. */}};
   signal?.addEventListener('abort',abort,{once:true});
   read.onsuccess=()=>{if(signal?.aborted){abort();return;}try{
    const current=read.result?storedIndex(read.result).revision:0;if(current!==expectedRevision){error=new ReviewError('ARCHIVE_CONFLICT');tx.abort();return;}
    const runs=tx.objectStore('runs');runs.put(pair.baseline,pair.baseline.runId);if(signal?.aborted)return;
    if(pair.attempt)runs.put(pair.attempt,pair.attempt.runId);if(signal?.aborted)return;
    idx.put({revision:expectedRevision+1,baselineId:pair.baseline.runId,attemptId:pair.attempt?.runId??null},'active');
   }catch(e){error=e instanceof Error?e:new ReviewError('STORAGE_WRITE');try{tx.abort();}catch{/* oncomplete/onabort is the commit authority */}}};
   tx.oncomplete=()=>{cleanup();resolve({revision:expectedRevision+1,text:JSON.stringify(pair)});};
   tx.onerror=()=>{cleanup();reject(error??tx.error??new ReviewError('STORAGE_WRITE'));};
   tx.onabort=()=>{cleanup();reject(error??tx.error??new ReviewError('STORAGE_WRITE'));};
  });}finally{db.close();}
 }
}
/** Long detached validation happens before writing. An invalid/superseded import
 * never starts replacement; CAS also prevents another tab's newer index being lost. */
export class ReviewArchive {
 private generation=0;
 private activeWrite:AbortController|null=null;
 constructor(private readonly store:AtomicReviewStore=new IndexedReviewStore()){}
 cancel(){this.generation++;this.activeWrite?.abort();this.activeWrite=null;}
 async importAndPersist(text:string,options:ReviewTaskOptions={}){
  this.activeWrite?.abort();const controller=new AbortController();this.activeWrite=controller;const token=++this.generation;let previous:ArchiveSnapshot|null=null,readError:string|null=null;
  try{previous=await this.store.read();}catch(error){readError=error instanceof ReviewError?error.code:'STORAGE_READ';}
  const prepared=await importReviewPair(text,{...options,cancelled:()=>token!==this.generation||Boolean(options.cancelled?.())});
  if(token!==this.generation)throw new ReviewError('REVIEW_CANCELLED');
  if(!previous)return {persisted:false as const,prepared,snapshot:null,previous:null,error:readError};
  try{const persisted=await this.store.replace(previous.revision,prepared.pair,controller.signal);return {persisted:true as const,prepared,snapshot:persisted,previous,error:null};}
  catch(error){return {persisted:false as const,prepared,snapshot:previous,previous,error:error instanceof ReviewError?error.code:'STORAGE_WRITE'};}
 }
 async persistPrepared(prepared:PreparedReviewPair){return this.importAndPersist(prepared.text);}
}
