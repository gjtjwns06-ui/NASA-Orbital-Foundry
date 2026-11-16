import type {ReviewRequest,ReviewResponse,VerifiedRun,RunId,Json} from './schema';
import {pinSwingbyRun,verifySwingbySource,seekSwingbyRun,createSwingbyAttempt,resolveSwingbyInspection} from './adapters/swingby';
import {compareRuns} from './compare';
import {canonical,finite,identifier,record,ReviewError,exactKeys,jsonTree} from './validation';
import {IndexedReviewStore,importReviewPair,makeReviewPair,type AtomicReviewStore,type PreparedReviewPair} from './archive';
/** Detached worker state only. No reference to the live engine, scene or autosave. */
export function createReviewController(post:(response:ReviewResponse)=>void,store:AtomicReviewStore=new IndexedReviewStore()){
 let session=-1,lastRequest=-1,generation=0,archiveRevision:number|null=null;
 const runs=new Map<RunId,VerifiedRun>(),requests=new Map<number,{fingerprint:string;response?:ReviewResponse}>(),commits=new Map<string,Extract<ReviewResponse,{type:'archive-commit'}>>();
 let active:{requestId:number;generation:number}|null=null,activeWrite:AbortController|null=null;
 const get=(id:RunId)=>{const r=runs.get(id);if(!r)throw new ReviewError('RUN_NOT_VERIFIED');return r;};
 const invalidate=()=>{activeWrite?.abort();activeWrite=null;generation++;active=null;};
 const errorCode=(e:unknown)=>e instanceof ReviewError?e.code:typeof(e as {code?:unknown})?.code==='string'?(e as {code:string}).code:'REVIEW_FAILED';
 async function handle(raw:ReviewRequest){
  let request:ReviewRequest;
  try{record(raw);finite(raw.sessionId,0);finite(raw.requestId,0);if(!Number.isSafeInteger(raw.sessionId)||!Number.isSafeInteger(raw.requestId))throw new ReviewError('INVALID_REQUEST');jsonTree(raw as unknown);request=raw;}
  catch(e){if(raw&&Number.isSafeInteger(raw.sessionId)&&raw.sessionId>=Math.max(0,session)&&Number.isSafeInteger(raw.requestId)&&raw.requestId>=0)post({type:'error',sessionId:raw.sessionId,requestId:raw.requestId,code:errorCode(e),detail:{ko:'검토 입력 형식이 올바르지 않습니다. 이전 보관본은 유지됩니다.',en:'The review input is invalid. The previous archive is preserved.'},preservesPrevious:true});return;}
  if(request.sessionId<session)return;
  if(request.sessionId>session){invalidate();session=request.sessionId;lastRequest=-1;runs.clear();requests.clear();}
  const {sessionId,requestId}=request;let fingerprint:string;try{fingerprint=canonical(request);}catch{return;}
  const prior=requests.get(requestId);if(prior){if(prior.fingerprint!==fingerprint)post({type:'error',sessionId,requestId,code:'REQUEST_ID_CONFLICT',detail:{ko:'같은 요청 번호의 내용이 다릅니다.',en:'The same request ID has different content.'},preservesPrevious:true});else if(prior.response)post(prior.response);else{const committed=commits.get(`${sessionId}:${requestId}`);if(committed)post({...committed,stale:true});}return;}
  if(requestId<=lastRequest)return;lastRequest=requestId;requests.set(requestId,{fingerprint});if(requests.size>256)requests.delete(requests.keys().next().value!);
  const send=(response:ReviewResponse)=>{if(sessionId!==session)return;const entry=requests.get(requestId);if(entry)entry.response=response;post(response);};
  if(request.type==='cancel'){
   if(active?.requestId===request.cancelledRequestId)invalidate();const revision=commits.get(`${sessionId}:${request.cancelledRequestId}`)?.revision;
   send({type:'cancelled',sessionId,requestId,...(revision===undefined?{}:{committedRevision:revision})});return;
  }
  invalidate();const token=generation;active={requestId,generation:token};const current=()=>session===sessionId&&generation===token;
  const options={cancelled:()=>!current(),progress:(fraction:number,committedTime:number)=>{if(current())post({type:'progress',sessionId,requestId,fraction,committedTimeSeconds:committedTime});}};
  const archiveOptions={cancelled:options.cancelled,sourceProgress:(runId:RunId,fraction:number,committedTime:number)=>{if(current())post({type:'progress',sessionId,requestId,runId,fraction,committedTimeSeconds:committedTime});}};
  const adopt=(prepared:PreparedReviewPair)=>{runs.clear();runs.set(prepared.baseline.source.runId,prepared.baseline);if(prepared.attempt)runs.set(prepared.attempt.source.runId,prepared.attempt);};
  const respondArchive=(prepared:PreparedReviewPair|null,persisted:boolean,storageError:string|null)=>send({type:'archive',sessionId,requestId,baseline:prepared?.baseline??null,attempt:prepared?.attempt??null,text:prepared?.text??null,revision:archiveRevision,persisted,storageError,retainedRunIds:Array.from(runs.keys())});
  async function persist(prepared:PreparedReviewPair){
   try{
    if(archiveRevision===null){const observed=await store.read();if(!current())throw new ReviewError('REVIEW_CANCELLED');archiveRevision=observed.revision;}
    if(!current())throw new ReviewError('REVIEW_CANCELLED');const controller=new AbortController();activeWrite=controller;
    const saved=await store.replace(archiveRevision,prepared.pair,controller.signal);if(activeWrite===controller)activeWrite=null;
    archiveRevision=Math.max(archiveRevision??0,saved.revision);
    // Storage completion is an independent fact, even when cursor/session adoption
    // has been superseded. Consumers must not describe this commit as undone.
    const notice:Extract<ReviewResponse,{type:'archive-commit'}>={type:'archive-commit',sessionId,requestId,revision:saved.revision,baselineRunId:prepared.baseline.source.runId,attemptRunId:prepared.attempt?.source.runId??null,stale:!current()};commits.set(`${sessionId}:${requestId}`,notice);if(commits.size>256)commits.delete(commits.keys().next().value!);post(notice);
    return {persisted:true,storageError:null};
   }catch(e){return {persisted:false,storageError:errorCode(e)};}
  }
  try{
   const shape:Record<string,string[]>={pin:['engineSaveText','runId','displayName'],verify:['source'],fork:['runId'],seek:['runId','timeSeconds'],inspect:['runId','target'],compare:['beforeRunId','afterRunId'],'release-run':['runId'],'load-archive':[],'import-archive':['text','persist'],'save-pair':['beforeRunId','afterRunId'],'export-pair':['beforeRunId','afterRunId']};
   if(!shape[request.type])throw new ReviewError('REQUEST_UNSUPPORTED');exactKeys(record(request),['type','sessionId','requestId',...shape[request.type]]);
   if(request.type==='verify'||request.type==='pin'){
    const proposedId=request.type==='pin'?request.runId:request.source.runId;if(!runs.has(proposedId as RunId)&&runs.size>=4)throw new ReviewError('REVIEW_CAPACITY');
    const run=request.type==='verify'?await verifySwingbySource(request.source,options):await pinSwingbyRun(request.engineSaveText,{runId:identifier(request.runId),displayName:request.displayName,origin:'authoritative-worker'},options);
    if(!current())return;const old=runs.get(run.source.runId);if(old&&old.source.engineSaveSha256!==run.source.engineSaveSha256)throw new ReviewError('DUPLICATE_RUN_ID');runs.set(run.source.runId,old??run);send({type:'verified',sessionId,requestId,run:old??run});
   }else if(request.type==='load-archive'){
    const stored=await store.read();if(!current())return;
    if(stored.text===null){archiveRevision=stored.revision;respondArchive(null,false,null);}
    else{const prepared=await importReviewPair(stored.text,archiveOptions);if(!current())return;archiveRevision=stored.revision;adopt(prepared);respondArchive(prepared,true,null);}
   }else if(request.type==='import-archive'){
    if(typeof request.persist!=='boolean')throw new ReviewError('INVALID_REQUEST');const prepared=await importReviewPair(request.text,archiveOptions);if(!current())return;
    const saved=request.persist?await persist(prepared):{persisted:false,storageError:null};if(!current())return;adopt(prepared);respondArchive(prepared,saved.persisted,saved.storageError);
   }else if(request.type==='save-pair'||request.type==='export-pair'){
    const prepared=makeReviewPair(get(request.beforeRunId),request.afterRunId===null?null:get(request.afterRunId));
    if(request.type==='export-pair')send({type:'archive-export',sessionId,requestId,pair:prepared.pair,text:prepared.text});
    else{const saved=await persist(prepared);if(current())respondArchive(prepared,saved.persisted,saved.storageError);}
   }else if(request.type==='release-run'){
    identifier(request.runId);runs.delete(request.runId);send({type:'released',sessionId,requestId,runId:request.runId,retainedRunIds:Array.from(runs.keys())});
   }else if(request.type==='compare')send({type:'comparison',sessionId,requestId,comparison:compareRuns(get(request.beforeRunId),get(request.afterRunId))});
   else if(request.type==='fork'){const draft=createSwingbyAttempt(get(request.runId));send({type:'draft',sessionId,requestId,parentRunId:draft.parentRunId,draft:draft as unknown as Json});}
   else if(request.type==='seek'||request.type==='inspect'){
    const run=get(request.runId),navigation=request.type==='inspect'?resolveSwingbyInspection(run,request.target):null;
    const sample=await seekSwingbyRun(run,request.type==='seek'?request.timeSeconds:navigation!.timeSeconds,options);
    if(current())send({type:'sample',sessionId,requestId,...sample,renderDto:navigation?{...sample.renderDto,reviewFocus:navigation.focus}:sample.renderDto});
   }else throw new ReviewError('REQUEST_UNSUPPORTED');
  }catch(e){if(current())send({type:'error',sessionId,requestId,code:errorCode(e),detail:{ko:'검토 요청을 완료하지 못했습니다. 이전 보관본은 유지됩니다.',en:'The review request could not complete. The previous archive is preserved.'},preservesPrevious:true});}
  finally{if(current())active=null;}
 }
 return {handle,dispose(){invalidate();runs.clear();requests.clear();},getState(){return {sessionId:session,lastRequestId:lastRequest,verifiedRunIds:Array.from(runs.keys()),pendingRequestId:active?.requestId??null,archiveRevision};}};
}
