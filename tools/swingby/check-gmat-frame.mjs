/** Prerequisite probe only: actual-epoch TDB and ICRF input/output in GMAT.
 * This is NOT the proposed twenty-case exit-corridor acceptance test. */
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const evidence=path.join(project,'tools/swingby/frame-probe');
const bin=path.resolve(process.env.GMAT_HOME||path.join(project,'../.tools/gmat'),'bin');
const bundled=await build({stdin:{contents:`export {createTransferPlan,solveTransferPlan} from './src/transfer/planning';export {transferStateAt} from './src/transfer/state';export {propagateKepler} from './src/sim/physics';export {TRANSFER_DATASET_ID,TRANSFER_DATA_SOURCES} from './src/transfer/ephemeris';`,resolveDir:project},bundle:true,platform:'node',format:'esm',target:'node24',write:false});
const model=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const solution=model.solveTransferPlan(model.createTransferPlan());
// Start one second inside the Mars patch, away from the boundary selection.
const flightElapsed=solution.marsEntrySeconds+1;
const state=model.transferStateAt(solution,flightElapsed);
if(state.centerBody!=='Mars')throw new Error('Probe must start in the Mars patch.');
const epochJdTdb=state.jdTdb,epochGmatTdb=epochJdTdb-2430000;
const initial={positionKm:state.relativePositionKm,velocityKmS:state.relativeVelocityKmS};
const mu=42828.375214,duration=600,step=60;
const sha=value=>createHash('sha256').update(value).digest('hex');
const number=value=>Number(value).toPrecision(17);
const slash=value=>value.replaceAll('\\','/');
await mkdir(evidence,{recursive:true});
const startup=(await readFile(path.join(bin,'gmat_startup_file.txt'),'utf8'))
 .replace(/^PLUGIN\s*=.*$/gm,line=>'# frame probe excludes '+line)
 .replace(/^ROOT_PATH\s*=.*$/m,`ROOT_PATH = ${slash(path.resolve(bin,'..'))}/`)
 .replace(/^OUTPUT_PATH\s*=.*$/m,`OUTPUT_PATH = ${slash(evidence)}/`);
const startupPath=path.join(evidence,'startup.txt');await writeFile(startupPath,startup);
const fields=['X','Y','Z','VX','VY','VZ'];
const lines=[
 '% Actual-epoch TDB/ICRF adapter probe; central Mars gravity only.',
 `Mars.Mu = ${number(mu)};`,'Create CoordinateSystem ProbeMarsICRF;',
 'ProbeMarsICRF.Origin = Mars;','ProbeMarsICRF.Axes = ICRF;',
 'Create Spacecraft Probe;','Probe.DateFormat = TDBModJulian;',
 `Probe.Epoch = '${number(epochGmatTdb)}';`,'Probe.CoordinateSystem = ProbeMarsICRF;',
 'Probe.DisplayStateType = Cartesian;',
 ...[...initial.positionKm,...initial.velocityKmS].map((value,i)=>`Probe.${fields[i]} = ${number(value)};`),
 'Create ForceModel Gravity;','Gravity.CentralBody = Mars;','Gravity.PrimaryBodies = {};',
 'Gravity.PointMasses = {Mars};','Gravity.Drag = None;','Gravity.SRP = Off;','Gravity.RelativisticCorrection = Off;',
 'Create Propagator Prop;','Prop.FM = Gravity;','Prop.Type = PrinceDormand78;',
 'Prop.InitialStepSize = 10;','Prop.Accuracy = 1e-12;','Prop.MinStep = 0.000001;',
 'Prop.MaxStep = 60;','Prop.MaxStepAttempts = 100;','Prop.StopIfAccuracyIsViolated = true;',
 'Create ReportFile States;',"States.Filename = 'states.csv';",'States.Precision = 17;',
 'States.WriteHeaders = false;','States.FixedWidth = false;',"States.Delimiter = ',';",'States.WriteReport = true;',
 'BeginMissionSequence;',
];
const reportLine=`Report States Probe.ElapsedSecs Probe.TDBModJulian ${fields.map(field=>`Probe.ProbeMarsICRF.${field}`).join(' ')};`;
lines.push(reportLine);
for(let time=step;time<=duration;time+=step)lines.push(`Propagate Prop(Probe) {Probe.ElapsedSecs = ${step}};`,reportLine);
const script=lines.join('\n')+'\n',scriptPath=path.join(evidence,'frame-probe.script');await writeFile(scriptPath,script);
const executable=path.join(bin,'GmatConsole.exe');
const execution=spawnSync(executable,['--startup_file',startupPath,'--run',scriptPath,'--verbose','off','--logfile',path.join(evidence,'frame-probe.log')],{cwd:bin,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:2*1024*1024});
const output=(execution.stdout||'')+(execution.stderr||'');await writeFile(path.join(evidence,'console.txt'),output);
if(execution.error||execution.status!==0||!output.includes('GMAT Integration test (Console version) successful!'))throw new Error('GMAT frame probe failed; inspect its preserved console.txt.');
const csv=await readFile(path.join(evidence,'states.csv'),'utf8');
const rows=csv.trim().split(/\r?\n/).map(line=>line.split(',').map(Number));
if(rows.length!==duration/step+1||rows.some(row=>row.length!==8||!row.every(Number.isFinite)))throw new Error('Incomplete frame-probe output.');
const norm=(a,b)=>Math.hypot(...a.map((value,i)=>value-b[i]));
let maxPositionErrorM=0,maxVelocityErrorMps=0,maxElapsedErrorS=0,maxTdbEpochErrorS=0;
for(let i=0;i<rows.length;i++){
 const [elapsed,tdb,...vector]=rows[i],expectedSeconds=i*step;
 // Compare at the reported TDB epoch, independently checking elapsed-time
 // drift. GMAT's integrator clock is not silently relabelled as TDB.
 const actualTdbSeconds=(tdb-epochGmatTdb)*86400;
 const expected=model.propagateKepler(initial,actualTdbSeconds,mu);
 maxPositionErrorM=Math.max(maxPositionErrorM,norm(vector.slice(0,3),expected.positionKm)*1000);
 maxVelocityErrorMps=Math.max(maxVelocityErrorMps,norm(vector.slice(3),expected.velocityKmS)*1000);
 maxElapsedErrorS=Math.max(maxElapsedErrorS,Math.abs(elapsed-expectedSeconds));
 maxTdbEpochErrorS=Math.max(maxTdbEpochErrorS,Math.abs(actualTdbSeconds-expectedSeconds));
}
const report={status:'PREREQUISITE PROBE ONLY',generatedAt:new Date().toISOString(),scope:'One600-second central-Mars trajectory at actual epoch in ICRF, reported TDB and elapsed integration clock. Not a Sun-frame ephemeris/exit-objective/20case acceptance result.',gmatRelease:'R2026a',executableSha256:sha(await readFile(executable)),scriptSha256:sha(script),csvSha256:sha(csv),datasetId:model.TRANSFER_DATASET_ID,sourceHashes:model.TRANSFER_DATA_SOURCES,epochJdTdb,epochGmatTdb,flightElapsed,initial,mu,rows:rows.length,maxPositionErrorM,maxVelocityErrorMps,maxElapsedErrorS,maxTdbEpochErrorS,limits:{positionM:10,velocityMps:.01,elapsedS:.001,tdbEpochS:.001}};
report.pass=maxPositionErrorM<=10&&maxVelocityErrorMps<=.01&&maxElapsedErrorS<=.001&&maxTdbEpochErrorS<=.001;
await writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({pass:report.pass,rows:rows.length,maxPositionErrorM,maxVelocityErrorMps,maxElapsedErrorS,maxTdbEpochErrorS,report:'tools/swingby/frame-probe/report.json'}));
if(!report.pass)process.exitCode=1;
