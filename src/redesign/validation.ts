import {canonicalOperationsJson,operationsSha256,utf8Length} from '../transfer/operations-codec';
import type {ExactRunSource,Json,Sha256} from './schema';
export const MAX_ENGINE_BYTES=2*1024*1024;
export const MAX_ARCHIVE_BYTES=8*1024*1024+65536;
export class ReviewError extends Error {constructor(readonly code:string,message=code){super(message);this.name='ReviewError';}}
export const hashText=(text:string)=>operationsSha256(text) as Sha256;
export const hashValue=(value:unknown)=>hashText(canonicalOperationsJson(value));
export const canonical=(value:unknown)=>canonicalOperationsJson(value);
export function freeze<T>(value:T):Readonly<T>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
export function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new ReviewError('INVALID_RECORD');return value as Record<string,unknown>;}
export function exactKeys(value:Record<string,unknown>,keys:readonly string[]){if(Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))throw new ReviewError('UNKNOWN_OR_MISSING_KEY');}
export function finite(value:unknown,min=0,max=Number.MAX_VALUE):number{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new ReviewError('INVALID_NUMBER');return value;}
export function boundedText(value:unknown,max:number):string{if(typeof value!=='string'||value.length>max)throw new ReviewError('INVALID_STRING');return value;}
export function identifier(value:unknown):string{const s=boundedText(value,96);if(!/^[A-Za-z0-9._:-]{1,96}$/.test(s))throw new ReviewError('INVALID_ID');return s;}
export function jsonTree(value:unknown):asserts value is Json {const stack:[unknown,number][]=[[value,0]];let count=0;while(stack.length){const [v,depth]=stack.pop()!;if(++count>250000||depth>48)throw new ReviewError('REVIEW_LIMIT');if(v===null||typeof v==='boolean')continue;if(typeof v==='number'){if(!Number.isFinite(v))throw new ReviewError('INVALID_NUMBER');continue;}if(typeof v==='string'){if(v.length>MAX_ARCHIVE_BYTES)throw new ReviewError('REVIEW_LIMIT');continue;}if(Array.isArray(v)){for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))throw new ReviewError('INVALID_ARRAY');stack.push([v[i],depth+1]);}continue;}const obj=record(v);for(const [k,item] of Object.entries(obj)){if(k.length>256)throw new ReviewError('REVIEW_LIMIT');stack.push([item,depth+1]);}}}
export function parseJson(text:string,maxBytes=MAX_ARCHIVE_BYTES):unknown{if(typeof text!=='string'||text.length>maxBytes||utf8Length(text)>maxBytes)throw new ReviewError('REVIEW_SIZE');let v:unknown;try{v=JSON.parse(text);}catch{throw new ReviewError('INVALID_JSON');}jsonTree(v);return v;}
/** Structural/hash verification only. Physical authenticity requires strict replay. */
export function validateSource(input:unknown):ExactRunSource{
 jsonTree(input);const v=record(input);exactKeys(v,['format','version','runId','missionFamily','engineSaveText','engineSaveSha256','engineSaveUtf8Bytes','pinnedAtUtc','capture','displayName']);
 if(v.format!=='orbital-foundry-review-run'||v.version!==1||v.missionFamily!=='m02b-swingby')throw new ReviewError('MODEL_UNSUPPORTED');identifier(v.runId);
 const text=boundedText(v.engineSaveText,MAX_ENGINE_BYTES),bytes=utf8Length(text);if(bytes>MAX_ENGINE_BYTES)throw new ReviewError('REVIEW_SIZE');if(v.engineSaveUtf8Bytes!==bytes||v.engineSaveSha256!==hashText(text))throw new ReviewError('SOURCE_HASH_MISMATCH');
 const time=boundedText(v.pinnedAtUtc,40);if(!time.endsWith('Z')||!Number.isFinite(Date.parse(time)))throw new ReviewError('INVALID_DATE');boundedText(v.displayName,160);
 const c=record(v.capture);exactKeys(c,['origin','requestedTimeSeconds','committedTimeSeconds']);if(c.origin!=='authoritative-worker'&&c.origin!=='strict-engine-import')throw new ReviewError('INVALID_CAPTURE');finite(c.requestedTimeSeconds);finite(c.committedTimeSeconds,0,c.requestedTimeSeconds as number);
 return freeze(structuredClone(input)) as unknown as ExactRunSource;
}
