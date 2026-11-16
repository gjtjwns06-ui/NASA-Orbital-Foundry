// Isolated CPU benchmark. No browser, server, GPU or main-workspace mutation.
// Full default suite is intentionally expensive: get an exclusive CPU window.
import {build} from 'esbuild';
import {Worker} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cpus,totalmem,platform,release} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {verifyBaselineManifest} from './integrity.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const baseline=await verifyBaselineManifest(root);
const option=(name,fallback)=>process.argv.find(s=>s.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const rounds=Number(option('rounds','7')),scenarios=option('cases','legacy-balanced,legacy-science,hardware-balanced,hardware-science,nightside,weak-solar').split(','),steps=option('steps','600').split(',').map(Number),restore=process.argv.includes('--restore');
const valid=['legacy-balanced','legacy-science','hardware-balanced','hardware-science','nightside','weak-solar'];
if(!Number.isInteger(rounds)||rounds<1||rounds>20||scenarios.some(x=>!valid.includes(x))||steps.some(x=>x!==300&&x!==600))throw new Error('Invalid benchmark arguments');
const destination=path.join(root,'.perf-build'),out=path.join(destination,'worker.mjs');await mkdir(destination,{recursive:true});
await build({entryPoints:[path.join(root,'tools/performance/worker.ts')],outfile:out,bundle:true,platform:'node',format:'esm',target:'node24',logLevel:'warning'});
const sourceHash=createHash('sha256').update(await readFile(out)).digest('hex');
let powerProfile='not measured';if(platform()==='win32'){try{powerProfile=execFileSync('powercfg',['/GETACTIVESCHEME'],{encoding:'utf8',windowsHide:true}).trim();}catch{powerProfile='unavailable';}}
const metadata={createdAt:new Date().toISOString(),node:process.version,os:`${platform()} ${release()}`,cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem(),powerProfile,rounds,scenarios,steps,restore,bundleHash:sourceHash,baseline,policy:'One new worker per variant/case/round; alternating original/optimized order. Both engines bundled identically. Startup includes both imports. Compute starts after ready. Cold model caches; warm exact-time query only. No warm checkpoint reuse implemented. Heap delta is not peak memory.'};
console.log(JSON.stringify({metadata}));
const results=[];
function run(request){return new Promise((resolve,reject)=>{const started=performance.now(),worker=new Worker(out),timeout=setTimeout(()=>{worker.terminate();reject(new Error('Benchmark worker timed out'));},600000);let startupMs=0;worker.once('error',e=>{clearTimeout(timeout);reject(e);});worker.on('message',async message=>{if(message.type==='ready'){startupMs=performance.now()-started;worker.postMessage(request);}else{clearTimeout(timeout);await worker.terminate();if(message.type==='error')reject(new Error(message.error));else resolve({...message,startupMs});}});});}
for(const scenario of scenarios)for(const step of steps)for(let round=0;round<rounds;round++){
 const pair=[];for(const variant of round%2?['optimized','original']:['original','optimized']){const result=await run({variant,scenario,step,restore});results.push({...result,round});pair.push(result);console.log(JSON.stringify({round,...result}));}
 for(const key of ['inputHash','stateHash','resultHash','queryHash','publicTelemetryHash','ticks'])if(pair[0][key]!==pair[1][key])throw new Error(`EXACT MISMATCH ${scenario}/${step}/${round}: ${key}`);
 if(restore)for(const r of pair)if(r.restoredHash!==r.stateHash)throw new Error(`REPLAY MISMATCH ${scenario}/${r.variant}`);
}
const median=a=>{const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const summaries=[];for(const scenario of scenarios)for(const step of steps)for(const variant of ['original','optimized']){const rows=results.filter(r=>r.scenario===scenario&&r.step===step&&r.variant===variant),metrics={};for(const metric of ['startupMs','solveMs','constructMs','forecastMs','warmQueryMs','warmPublicTelemetryMs','serializationMs','restoreMs']){const values=rows.map(r=>r[metric]).filter(x=>x!==null);if(values.length)metrics[metric]={median:median(values),min:Math.min(...values),max:Math.max(...values)};}summaries.push({scenario,step,variant,metrics});}
const report={metadata,results,summaries};const target=path.resolve(root,option('output',`tools/performance/results-${new Date().toISOString().replaceAll(/[:.]/g,'-')}.json`));if(!target.startsWith(root+path.sep))throw new Error('Output must stay inside prototype');await writeFile(target,JSON.stringify(report,null,2));console.log(JSON.stringify({report:target,summaries}));
