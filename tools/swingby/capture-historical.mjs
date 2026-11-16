import {build} from 'esbuild';
import {mkdir,writeFile,readFile,readdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
const output='tests/fixtures/swingby-historical',sha=b=>createHash('sha256').update(b).digest('hex');
try{await access(output+'/manifest.json');throw new Error('Frozen oracle exists; refusing overwrite.');}catch(e){if(e.code!=='ENOENT')throw e;}
const files=[];async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())await collect(file);else if(/\.(ts|json)$/.test(file))files.push({file,sha256:sha(await readFile(file))});}}
for(const dir of ['src/transfer','src/sim','src/hardware'])await collect(dir);
const bundle=await build({entryPoints:['tools/swingby/historical-cases.ts'],bundle:true,platform:'node',format:'esm',write:false});
await mkdir(output,{recursive:true});await writeFile(output+'/pre-extraction-engine.mjs',bundle.outputFiles[0].contents);
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64')),start=performance.now(),data=api.historicalCases(name=>console.log(name)),bytes=serialize(data);
await writeFile(output+'/checkpoints.bin',bytes);await writeFile(output+'/manifest.json',JSON.stringify({createdAt:new Date().toISOString(),node:process.version,method:'Actual flight from declared initial conditions; original engine bundled before extraction; V8 preserves signed zero/undefined/nonfinite values; no fixture injection.',bundleSha256:sha(bundle.outputFiles[0].contents),fixtureSha256:sha(bytes),caseCount:data.records.length,sourceFiles:files,wallMs:performance.now()-start},null,2));console.log(JSON.stringify({cases:data.records.length,bytes:bytes.length,wallMs:performance.now()-start}));
