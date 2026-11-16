/** This slot is independent of released M01/M02/M03 saves. Only a Worker-
 * verified coherent source is written; loading returns bytes for strict replay. */
export interface DeploymentRecord {revision:number;text:string|null}
const DATABASE='orbital-foundry-deployment',STORE='saves',KEY='current';
const storageError=(code:string)=>new Error(code);
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 if(typeof indexedDB==='undefined'){reject(storageError('STORAGE_UNAVAILABLE'));return;}
 let settled=false;const timer=setTimeout(()=>{if(!settled){settled=true;reject(storageError('STORAGE_OPEN_TIMEOUT'));}},5000);
 let request:IDBOpenDBRequest;
 try{request=indexedDB.open(DATABASE,1);}catch{clearTimeout(timer);reject(storageError('STORAGE_UNAVAILABLE'));return;}
 const fail=(code:string)=>{if(!settled){settled=true;clearTimeout(timer);reject(storageError(code));}};
 request.onblocked=()=>fail('STORAGE_BLOCKED');request.onerror=()=>fail('STORAGE_UNAVAILABLE');
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
 request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;clearTimeout(timer);request.result.onversionchange=()=>request.result.close();resolve(request.result);};
});}
function record(value:unknown):DeploymentRecord{
 if(value===undefined)return {revision:0,text:null};
 const r=value as DeploymentRecord;
 if(!r||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.text!=='string'||new TextEncoder().encode(r.text).length>2*1024*1024)throw storageError('STORAGE_RECORD_INVALID');
 return {revision:r.revision,text:r.text};
}
export async function readDeploymentRecord():Promise<DeploymentRecord>{
 const db=await open();try{return await new Promise<DeploymentRecord>((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(KEY);let result:DeploymentRecord|undefined,error:Error|null=null,settled=false;
  const finish=(e?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);if(e)reject(e);else resolve(result!);};
  const timer=setTimeout(()=>{try{tx.abort();}catch{}finish(storageError('STORAGE_READ_TIMEOUT'));},5000);
  request.onsuccess=()=>{try{result=record(request.result);}catch(e){error=e as Error;tx.abort();}};
  tx.oncomplete=()=>finish(result?undefined:storageError('STORAGE_RECORD_INVALID'));tx.onerror=()=>finish(error??storageError('STORAGE_UNAVAILABLE'));tx.onabort=()=>finish(error??storageError('STORAGE_READ_ABORTED'));
 });}finally{db.close();}
}
export async function writeDeploymentRecord(text:string,expectedRevision:number):Promise<DeploymentRecord>{
 if(typeof text!=='string'||new TextEncoder().encode(text).length>2*1024*1024||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw storageError('INVALID_STORAGE_WRITE');
 const db=await open();try{return await new Promise<DeploymentRecord>((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),request=store.get(KEY);let result:DeploymentRecord|undefined,error:Error|null=null,settled=false;
  const finish=(e?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);if(e)reject(e);else resolve(result!);};
  const timer=setTimeout(()=>{try{tx.abort();}catch{}finish(storageError('STORAGE_STATE_UNCONFIRMED'));},5000);
  request.onsuccess=()=>{try{const previous=record(request.result);if(previous.revision!==expectedRevision)throw storageError('STORAGE_CONFLICT');result={revision:previous.revision+1,text};store.put(result,KEY);}catch(e){error=e as Error;tx.abort();}};
  tx.oncomplete=()=>finish(result?undefined:storageError('STORAGE_RECORD_INVALID'));tx.onerror=()=>finish(error??storageError('STORAGE_WRITE_FAILED'));tx.onabort=()=>finish(error??storageError('STORAGE_WRITE_ABORTED'));
 });}finally{db.close();}
}
