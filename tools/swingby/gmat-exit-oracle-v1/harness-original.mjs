/** Independent GMAT authoring oracle. This validates the candidate local conic
 * study, not an implemented swingby runtime, attitude model or science return. */
import {build} from 'esbuild';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const arg=(name,fallback)=>process.argv.find(a=>a.startsWith(name+'='))?.slice(name.length+1)??fallback;
const suffix=arg('--output','gmat-exit-oracle-v1');
if(!/^[a-z0-9-]+$/.test(suffix))throw Error('Invalid evidence directory');
const evidence=path.join(root,'tools/swingby',suffix);
try{await access(path.join(evidence,'report.json'));throw Error('Evidence exists; choose a new --output to preserve it');}catch(e){if(e.code!=='ENOENT')throw e;}
const limit=Number(arg('--limit','24'));if(!Number.isInteger(limit)||limit<1||limit>24)throw Error('Invalid case limit');
const bin=path.resolve(process.env.GMAT_HOME||path.join(root,'../.tools/gmat'),'bin');
const executable=path.join(bin,'GmatConsole.exe');
const sha=v=>createHash('sha256').update(v).digest('hex'),n=v=>Number(v).toPrecision(17),slash=v=>v.replaceAll('\\','/');
const bundle=await build({stdin:{contents:`
 export {transferPlanetState,TRANSFER_DATASET_ID,TRANSFER_DATA_SOURCES} from './src/transfer/ephemeris';
 export {hyperbolicLocalStateAt,SUN_MU_KM3_S2} from './src/transfer/math';
 export {add,sub,scale,dot,cross,magnitude,normalize} from './src/sim/physics';
 export {createHardwareTransferDesign} from './src/hardware/presets';
 export {getPartDefinition,getBusDefinition} from './src/hardware/resolve';
`,resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const studyText=await readFile(path.join(root,'tools/swingby/exploration-analytic-v1/report.json'),'utf8');
const study=JSON.parse(studyText),mu=42828.375214,radius=3389.5,nodeSeconds=3600;
const epochJdTdb=study.nodeJdTdb-nodeSeconds/86400,epochGmatTdb=epochJdTdb-2430000;
function arc(initial){
 const r=m.magnitude(initial.positionKm),h=m.cross(initial.positionKm,initial.velocityKmS),energy=m.dot(initial.velocityKmS,initial.velocityKmS)/2-mu/r;
 const eVector=m.sub(m.scale(m.cross(initial.velocityKmS,h),1/mu),m.scale(initial.positionKm,1/r)),e=m.magnitude(eVector);
 if(!Number.isFinite(energy)||energy<=0||e<=1.000001)throw Error('Invalid hyperbola');
 const a=mu/(2*energy),rp=m.dot(h,h)/(mu*(1+e)),p=m.normalize(eVector),q=m.cross(m.normalize(h),p);
 const peri={positionKm:m.scale(p,rp),velocityKmS:m.scale(q,Math.sqrt(mu*(1+e)/rp))};
 const sinhH=m.dot(initial.positionKm,initial.velocityKmS)/(e*Math.sqrt(mu*a));
 const t=(e*sinhH-Math.asinh(sinhH))*Math.sqrt(a*a*a/mu);
 return {at:dt=>m.hyperbolicLocalStateAt(peri,mu,t+dt),periDt:-t};
}
const baseline=arc(study.initial),initial=baseline.at(-nodeSeconds);
const craft=m.createHardwareTransferDesign(),bus=m.getBusDefinition(craft);
const carrierKg=.4,fuelKg=.25,ispSeconds=230,g0=9.80665;
const dryMassKg=bus.massKg+craft.parts.reduce((s,p)=>s+m.getPartDefinition(craft,p).massKg,0)+carrierKg;
const target=m.normalize([16.0771950773341,-15.997929860769286,-7.476894084426893]);
const controls=[[0,0],[0,2],[-1,2],[1,2],[0,1.5],[0,-2],[-2,0],[2,0],[-5,0],[5,0],[0,-5],[0,5],[-2,-2],[-2,2],[2,-2],[2,2],[-5,-5],[-5,5],[5,-5],[5,5],[-7,0],[7,0],[0,-7],[0,7]].slice(0,limit);
const angle=(a,b)=>Math.atan2(m.magnitude(m.cross(a,b)),m.dot(a,b))*180/Math.PI;
function crossing(a,r){let lo=a.periDt,hi=lo+300000;if(m.magnitude(a.at(lo).positionKm)>=r||m.magnitude(a.at(hi).positionKm)<=r)throw Error('Unbracketed outward crossing');for(let i=0;i<70&&hi-lo>1e-8;i++){const mid=(lo+hi)/2;if(m.magnitude(a.at(mid).positionKm)>r)hi=mid;else lo=mid;}return(lo+hi)/2;}
function solar(state,jd){const planet=m.transferPlanetState('mars',jd),r=m.add(planet.positionKm,state.positionKm),v=m.add(planet.velocityKmS,state.velocityKmS);const energy=m.dot(v,v)/2-m.SUN_MU_KM3_S2/m.magnitude(r),direction=angle(v,target);return {positionKm:r,velocityKmS:v,energyKm2S2:energy,directionErrorDeg:direction,directionPassed:direction<=.12,energyPassed:energy>=-284.5&&energy<=-279.5};}
const baseStartup=await readFile(path.join(bin,'gmat_startup_file.txt'),'utf8');
await mkdir(evidence,{recursive:true});
const fixtures=[];
for(let index=0;index<controls.length;index++){
 const [x,y]=controls[index],caseId=`case-${String(index+1).padStart(2,'0')}`,dir=path.join(evidence,caseId);await mkdir(dir,{recursive:true});
 const delta=m.add(m.scale(study.basis.xAxis,x/1000),m.scale(study.basis.yAxis,y/1000));
 const corrected=arc({positionKm:study.initial.positionKm,velocityKmS:m.add(study.initial.velocityKmS,delta)});
 const exitDt=crossing(corrected,100000),patchDt=crossing(corrected,577000),fuelUsed=(dryMassKg+fuelKg)*(1-Math.exp(-Math.hypot(x,y)/(g0*ispSeconds)));
 const startup=baseStartup.replace(/^PLUGIN\s*=.*$/gm,line=>'# oracle excludes '+line).replace(/^ROOT_PATH\s*=.*$/m,`ROOT_PATH = ${slash(path.resolve(bin,'..'))}/`).replace(/^OUTPUT_PATH\s*=.*$/m,`OUTPUT_PATH = ${slash(dir)}/`);
 const startupPath=path.join(dir,'startup.txt');await writeFile(startupPath,startup);
 const fields=['X','Y','Z','VX','VY','VZ'];
 const lines=[`% Candidate local-arc oracle ${caseId}: X=${x}, Y=${y} m/s.`,`Mars.Mu = ${n(mu)};`,'Create CoordinateSystem LocalICRF;','LocalICRF.Origin = Mars;','LocalICRF.Axes = ICRF;',
 'Create ChemicalTank Tank;','Tank.AllowNegativeFuelMass = false;',`Tank.FuelMass = ${n(fuelKg)};`,
 'Create Spacecraft Probe;','Probe.DateFormat = TDBModJulian;',`Probe.Epoch = '${n(epochGmatTdb)}';`,'Probe.CoordinateSystem = LocalICRF;','Probe.DisplayStateType = Cartesian;',...([...initial.positionKm,...initial.velocityKmS].map((v,i)=>`Probe.${fields[i]} = ${n(v)};`)),`Probe.DryMass = ${n(dryMassKg)};`,'Probe.Tanks = {Tank};',
 'Create ImpulsiveBurn Correction;','Correction.CoordinateSystem = LocalICRF;',...delta.map((v,i)=>`Correction.Element${i+1} = ${n(v)};`),'Correction.DecrementMass = true;','Correction.Tank = {Tank};',`Correction.Isp = ${n(ispSeconds)};`,`Correction.GravitationalAccel = ${n(g0)};`,
 'Create ForceModel Gravity;','Gravity.CentralBody = Mars;','Gravity.PrimaryBodies = {};','Gravity.PointMasses = {Mars};','Gravity.Drag = None;','Gravity.SRP = Off;','Gravity.RelativisticCorrection = Off;',
 'Create Propagator Prop;','Prop.FM = Gravity;','Prop.Type = PrinceDormand78;','Prop.InitialStepSize = 10;','Prop.Accuracy = 1e-12;','Prop.MinStep = 0.000001;','Prop.MaxStep = 60;','Prop.MaxStepAttempts = 100;','Prop.StopIfAccuracyIsViolated = true;',
 'Create ReportFile States;',"States.Filename = 'states.csv';",'States.Precision = 17;','States.WriteHeaders = false;','States.FixedWidth = false;',"States.Delimiter = ',';",'States.WriteReport = true;','BeginMissionSequence;'];
 const report=`Report States Probe.ElapsedSecs Probe.TDBModJulian ${fields.map(f=>`Probe.LocalICRF.${f}`).join(' ')} Probe.Tank.FuelMass Probe.TotalMass;`;
 lines.push(report,'Propagate Prop(Probe) {Probe.ElapsedSecs = 3599};',report,'Propagate Prop(Probe) {Probe.ElapsedSecs = 1};',report,'Maneuver Correction(Probe);',report,'Propagate Prop(Probe) {Probe.ElapsedSecs = 1};',report,'Propagate Prop(Probe) {Probe.Mars.Periapsis, StopTolerance = 1e-10};',report,'Propagate Prop(Probe) {Probe.Mars.RMAG = 100000, StopTolerance = 1e-7};',report,'Propagate Prop(Probe) {Probe.Mars.RMAG = 577000, StopTolerance = 1e-7};',report);
 const script=lines.join('\n')+'\n',scriptPath=path.join(dir,'oracle.script');await writeFile(scriptPath,script);
 const execution=spawnSync(executable,['--startup_file',startupPath,'--run',scriptPath,'--verbose','off','--logfile',path.join(dir,'oracle.log')],{cwd:bin,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:2*1024*1024});
 const consoleText=(execution.stdout||'')+(execution.stderr||'');await writeFile(path.join(dir,'console.txt'),consoleText);
 if(execution.error||execution.status!==0||!consoleText.includes('GMAT Integration test (Console version) successful!'))throw Error(`GMAT failed ${caseId}; raw console retained`);
 const csv=await readFile(path.join(dir,'states.csv'),'utf8'),rows=csv.trim().split(/\r?\n/).map(s=>s.split(',').map(Number));
 if(rows.length!==8||rows.some(r=>r.length!==10||!r.every(Number.isFinite)))throw Error(`Malformed output ${caseId}`);
 const names=['start','node-minus-1','before-burn','after-burn','node-plus-1','periapsis','outward-exit','outward-patch'];
 const samples=rows.map((row,i)=>{
  const [elapsed,tdb,...v]=row,dt=(tdb-epochGmatTdb)*86400;
  const state={positionKm:v.slice(0,3),velocityKmS:v.slice(3,6)};
  const expected=i<=2?baseline.at(dt-nodeSeconds):corrected.at(dt-nodeSeconds);
  return {name:names[i],elapsed,tdbModJulian:tdb,tdbElapsedSeconds:dt,state,fuelKg:v[6],totalMassKg:v[7],positionErrorM:m.magnitude(m.sub(state.positionKm,expected.positionKm))*1000,velocityErrorMps:m.magnitude(m.sub(state.velocityKmS,expected.velocityKmS))*1000};
 });
 const peri=samples[5],exit=samples[6],patch=samples[7],analyticExit=corrected.at(exitDt),gmatSolar=solar(exit.state,exit.tdbModJulian+2430000),analyticSolar=solar(analyticExit,study.nodeJdTdb+exitDt/86400);
 const errors={maxPositionM:Math.max(...samples.map(s=>s.positionErrorM)),maxVelocityMps:Math.max(...samples.map(s=>s.velocityErrorMps)),periapsisAltitudeKm:Math.abs(m.magnitude(peri.state.positionKm)-m.magnitude(corrected.at(corrected.periDt).positionKm)),exitTimeS:Math.abs(exit.tdbElapsedSeconds-nodeSeconds-exitDt),patchTimeS:Math.abs(patch.tdbElapsedSeconds-nodeSeconds-patchDt),exitSpeedRelative:Math.abs(m.magnitude(gmatSolar.velocityKmS)-m.magnitude(analyticSolar.velocityKmS))/m.magnitude(analyticSolar.velocityKmS),exitDirectionDeg:angle(gmatSolar.velocityKmS,analyticSolar.velocityKmS),exitEnergyKm2S2:Math.abs(gmatSolar.energyKm2S2-analyticSolar.energyKm2S2),fuelKg:Math.abs(samples[3].fuelKg-(fuelKg-fuelUsed)),burnPositionJumpM:m.magnitude(m.sub(samples[3].state.positionKm,samples[2].state.positionKm))*1000,burnVectorErrorMps:m.magnitude(m.sub(m.sub(samples[3].state.velocityKmS,samples[2].state.velocityKmS),delta))*1000};
 const pass=errors.maxPositionM<=10&&errors.maxVelocityMps<=.01&&errors.exitTimeS<=.1&&errors.patchTimeS<=.1&&errors.periapsisAltitudeKm<=.01&&errors.exitSpeedRelative<=.005&&errors.exitDirectionDeg<=.005&&errors.exitEnergyKm2S2<=.01&&errors.fuelKg<=1e-10&&errors.burnPositionJumpM<=1e-5&&errors.burnVectorErrorMps<=1e-8&&gmatSolar.directionPassed===analyticSolar.directionPassed&&gmatSolar.energyPassed===analyticSolar.energyPassed&&m.dot(exit.state.positionKm,exit.state.velocityKmS)>0&&m.dot(patch.state.positionKm,patch.state.velocityKmS)>0;
 const fixture={caseId,xMps:x,yMps:y,deltaVelocityKmS:delta,pass,scriptSha256:sha(script),csvSha256:sha(csv),samples,errors,periapsisAltitudeKm:m.magnitude(peri.state.positionKm)-radius,clears250Km:m.magnitude(peri.state.positionKm)>=radius+250,gmatSolar,analyticSolar,expectedFuelUsedKg:fuelUsed};
 fixtures.push(fixture);await writeFile(path.join(dir,'comparison.json'),JSON.stringify(fixture,null,2)+'\n');console.log(JSON.stringify({caseId,x,y,pass,alt:fixture.periapsisAltitudeKm,errors}));
}
const report={status:'CANDIDATE LOCAL-CONIC ORACLE ONLY',generatedAt:new Date().toISOString(),pass:fixtures.every(f=>f.pass),scope:'Independent central-Mars GMAT propagation and ideal inertial impulsive mass depletion against the analytic authoring study. Not production swingby runtime validation, actual ADCS/gimbal/fuel feasibility, science-return validation, or independent planetary ephemerides. Both solar reconstructions use the same frozen Horizons Mars data.',gmatRelease:'R2026a',executableSha256:sha(await readFile(executable)),harnessSha256:sha(await readFile(fileURLToPath(import.meta.url))),studySha256:sha(studyText),bundleSha256:sha(bundle.outputFiles[0].text),datasetId:m.TRANSFER_DATASET_ID,sourceHashes:m.TRANSFER_DATA_SOURCES,epochJdTdb,epochGmatTdb,nodeSeconds,initial,nodeState:study.initial,basis:study.basis,mu,radius,dryMassKg,fuelKg,carrierKg,ispSeconds,g0,craft,massScope:'Current balanced hardware transfer design dry mass plus proposed0.4kg carrier; initial0.25kg tank. No prior-flight ledger or carrier-geometry feasibility claim.',candidateGoal:{targetDirection:target,halfAngleDeg:.12,energyRangeKm2S2:[-284.5,-279.5]},fixtures};
await writeFile(path.join(evidence,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,cases:fixtures.length,evidence}));if(!report.pass)process.exitCode=1;
