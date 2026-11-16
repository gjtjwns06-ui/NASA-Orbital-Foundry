import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';

const [output,url]=process.argv.slice(2);
if(!output||!url)throw Error('Usage: node tools/qa/freeze-clearance-source.mjs OUTPUT_JSON PREVIEW_URL');
const files=[];
const add=path=>files.push({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});
function walk(root){for(const entry of readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(root,entry.name).replaceAll('\\','/');if(entry.isDirectory())walk(path);else if(entry.isFile())add(path);}}
for(const path of ['src','public','dist'])walk(path);
for(const path of ['tests/deployment-clearance-cues.test.ts','tests/deployment-scene.test.ts','tests/deployment-view.test.ts','tests/deployment-flight-presentation.test.ts','tests/deployment-surface-finish.test.ts','tests/transfer-plan-comparison.test.ts','tests/browser/deployment-clearance-cues.spec.ts','tests/browser/native-gl-audit.ts','package.json','package-lock.json','playwright.config.ts','tools/qa/freeze-clearance-source.mjs'])add(path);
const response=await fetch(url);
if(!response.ok)throw Error(`Preview HTTP ${response.status}`);
const served=Buffer.from(await response.arrayBuffer());
if(!served.equals(readFileSync('dist/index.html')))throw Error('Preview HTML differs from current dist');
const target=resolve(output);mkdirSync(dirname(target),{recursive:true});
writeFileSync(target,JSON.stringify({capturedAt:new Date().toISOString(),root:process.cwd(),url,scope:'Version11 integrated functional source/build/harness freeze; no performance or hosted claim.',files},null,2));
console.log(`Frozen ${files.length} identities; served HTML exactly matches the integrated build.`);
