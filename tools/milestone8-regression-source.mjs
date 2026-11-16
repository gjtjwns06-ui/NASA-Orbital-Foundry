import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const [outputArg,url]=process.argv.slice(2);
if(!outputArg||!url)throw Error('Usage: node tools/milestone8-regression-source.mjs OUTPUT_JSON PREVIEW_URL');
const root=process.cwd(),output=resolve(outputArg),files=[];
function add(path){const bytes=readFileSync(path);files.push({path:relative(root,path).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
function walk(path){for(const entry of readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(path,entry.name);if(entry.isDirectory())walk(p);else if(entry.isFile())add(p);}}
for(const name of ['src','public','dist'])walk(join(root,name));
for(const name of ['deployment-flow.spec.ts','keyboard-assembly.spec.ts','hardware-interaction.spec.ts','swingby-builder.spec.ts','remote-operations.spec.ts','native-gl-audit.ts'])add(join(root,'tests/browser',name));
for(const name of ['package.json','package-lock.json','playwright.config.ts','tools/milestone8-regression-source.mjs'])add(join(root,name));
const response=await fetch(url);if(!response.ok)throw Error(`Preview HTTP ${response.status}`);
const served=Buffer.from(await response.arrayBuffer()),local=readFileSync(join(root,'dist/index.html'));
if(!served.equals(local))throw Error('Served entry HTML differs from local frozen dist/index.html');
const snapshot={capturedAt:new Date().toISOString(),root,scope:'Frozen production src/public/dist, harness/configuration identities. Preview entry bytes verified against dist/index.html. Functional browser evidence, not FPS/latency measurement.',url,servedIndexSha256:createHash('sha256').update(served).digest('hex'),files};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(snapshot,null,2));console.log(`${files.length} identities captured; preview HTML exactly matches dist.`);
