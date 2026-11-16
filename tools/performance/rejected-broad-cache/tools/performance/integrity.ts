import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

/** Type tags prevent number/string/null/signed-zero collisions. Nonfinite model
 * numbers are a defect and abort comparison instead of becoming JSON null. */
export function canonicalExact(value:unknown):string {
 const encode=(item:unknown):unknown=>{
  if(item===null)return ['null'];
  if(typeof item==='number'){if(!Number.isFinite(item))throw new Error('Nonfinite number in exact model evidence');return ['number',Object.is(item,-0)?'-0':String(item)];}
  if(typeof item==='string')return ['string',item];
  if(typeof item==='boolean')return ['boolean',item];
  if(item===undefined)return ['undefined'];
  if(Array.isArray(item))return ['array',item.map(encode)];
  if(typeof item==='object')return ['object',Object.keys(item).sort().map(k=>[k,encode((item as Record<string,unknown>)[k])])];
  throw new Error(`Unsupported ${typeof item} in exact model evidence`);
 };
 return JSON.stringify(encode(value));
}
export const exactDigest=(value:unknown)=>createHash('sha256').update(canonicalExact(value)).digest('hex');

/** Fail closed if the supposedly fixed original engine changed or gained files. */
export async function verifyBaselineManifest(root:string){
 const source=path.resolve(root,'baseline/src'),manifestText=(await readFile(path.join(root,'baseline/manifest.json'),'utf8')).replace(/^\uFEFF/,''),manifest=JSON.parse(manifestText) as {files:{path:string;sha256:string}[]};
 if(!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('Invalid baseline manifest');
 const listed=new Set<string>();for(const row of manifest.files){const target=path.resolve(source,row.path);if(!target.startsWith(source+path.sep)||listed.has(row.path)||!/^[0-9a-f]{64}$/.test(row.sha256))throw new Error('Invalid baseline manifest entry');listed.add(row.path);const actual=createHash('sha256').update(await readFile(target)).digest('hex');if(actual!==row.sha256)throw new Error(`Baseline source changed: ${row.path}`);}
 const actual:string[]=[];async function visit(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await visit(file);else if(entry.isFile())actual.push(path.relative(source,file).split(path.sep).join('/'));else throw new Error('Unexpected baseline source entry');}}await visit(source);
 if(actual.length!==listed.size||actual.some(p=>!listed.has(p)))throw new Error('Baseline source file inventory changed');
 return {files:listed.size,manifestSha256:createHash('sha256').update(manifestText).digest('hex')};
}
