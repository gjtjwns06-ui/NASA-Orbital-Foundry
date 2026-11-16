import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export function assertEngineIntegrity(){
 const text=readFileSync(resolve('docs/redesign-engine-manifest.json'),'utf8'),manifest=JSON.parse(text);
 for(const [file,hash] of Object.entries(manifest.files))if(createHash('sha256').update(readFileSync(resolve(file),'utf8').replace(/\r\n?/g,'\n')).digest('hex')!==hash)throw new Error('Immutable engine changed: '+file);
 return {files:Object.keys(manifest.files).length,manifestSha256:createHash('sha256').update(text).digest('hex')};
}
