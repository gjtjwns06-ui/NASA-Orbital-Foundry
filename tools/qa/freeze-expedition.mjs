import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';

const [mode,file,url='http://127.0.0.1:5188/']=process.argv.slice(2);
if(!['capture','verify'].includes(mode)||!file)throw Error('Usage: node tools/qa/freeze-expedition.mjs capture|verify MANIFEST [PREVIEW_URL]');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
if(mode==='verify'){
 const manifest=JSON.parse(readFileSync(file,'utf8'));
 const changed=manifest.files.filter(entry=>hash(entry.path)!==entry.sha256);
 if(changed.length)throw Error(`Runtime changed: ${changed.map(entry=>entry.path).join(', ')}`);
 console.log(`Verified ${manifest.files.length} unchanged source/output identities.`);
}else{
 const files=[];
 const walk=root=>{for(const entry of readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(root,entry.name).replaceAll('\\','/');if(entry.isDirectory())walk(path);else if(entry.isFile())files.push({path,sha256:hash(path)});}};
 for(const root of ['src','public','dist'])walk(root);
 for(const path of ['package.json','package-lock.json','.openai/hosting.json','index.html','tsconfig.json','tools/qa/freeze-expedition.mjs'])files.push({path,sha256:hash(path)});
 const response=await fetch(url);if(!response.ok)throw Error(`Preview HTTP ${response.status}`);
 if(!Buffer.from(await response.arrayBuffer()).equals(readFileSync('dist/index.html')))throw Error('Preview is not serving this build.');
 mkdirSync(dirname(resolve(file)),{recursive:true});
 writeFileSync(file,JSON.stringify({capturedAt:new Date().toISOString(),preview:url,scope:'v13 runtime/source identity. Native input and CPU evidence recorded separately; no human fun rating or hosted performance claim.',files},null,2));
 console.log(`Frozen ${files.length} source/output identities; preview HTML matches dist.`);
}
