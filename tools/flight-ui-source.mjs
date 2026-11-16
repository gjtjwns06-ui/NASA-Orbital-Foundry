import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const [outputArg,url]=process.argv.slice(2);
if(!outputArg||!url)throw Error('Usage: node tools/flight-ui-source.mjs OUTPUT_JSON PREVIEW_URL');
const root=process.cwd(),output=resolve(outputArg),files=[];
function add(path){const bytes=readFileSync(path);files.push({path:relative(root,path).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
function walk(path){for(const entry of readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=join(path,entry.name);if(entry.isDirectory())walk(p);else if(entry.isFile())add(p);}}
for(const name of ['src','public','dist'])walk(join(root,name));
for(const name of ['tests/browser/deployment-flight-ui.spec.ts','tests/deployment-flight-presentation.test.ts','tests/browser/native-gl-audit.ts','tests/browser/artifacts/deployment-flow/m8-production-r1-closure/repaired-terminal-save.json','package.json','package-lock.json','playwright.config.ts','tools/flight-ui-source.mjs'])add(join(root,name));

const response=await fetch(url);if(!response.ok)throw Error(`Preview HTTP ${response.status}`);
const served=Buffer.from(await response.arrayBuffer()),local=readFileSync(join(root,'dist/index.html'));
if(!served.equals(local))throw Error('Served entry HTML differs from local frozen dist/index.html');
const snapshot={capturedAt:new Date().toISOString(),root,scope:'Frozen production src/public/dist, compact-flight UI harness and actual earlier Chrome flight source. Native functional evidence; no performance claim.',url,browserTarget:process.env.PLAYWRIGHT_BROWSER||'chrome',servedIndexSha256:createHash('sha256').update(served).digest('hex'),files};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(snapshot,null,2));console.log(`${files.length} identities captured; preview HTML exactly matches dist.`);
