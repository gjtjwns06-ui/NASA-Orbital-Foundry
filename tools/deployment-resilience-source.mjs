import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const [sourceArg,outArg]=process.argv.slice(2);
if(!sourceArg||!outArg)throw Error('Usage: node tools/deployment-resilience-source.mjs SOURCE_ROOT OUTPUT_JSON');
const sourceRoot=resolve(sourceArg),output=resolve(outArg),files=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile()){const bytes=readFileSync(path);files.push({path:relative(sourceRoot,path).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}}
for(const name of ['src','public'])walk(join(sourceRoot,name));
const testPath=resolve('tests/browser/deployment-resilience.spec.ts'),testBytes=readFileSync(testPath);
const record={capturedAt:new Date().toISOString(),sourceRoot,scope:'All product src/public bytes; dev candidate read-only QA snapshot, not deployed archive.',files,test:{path:testPath,bytes:testBytes.length,sha256:createHash('sha256').update(testBytes).digest('hex')}};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(record,null,2));console.log(`${files.length} product file identities captured.`);
