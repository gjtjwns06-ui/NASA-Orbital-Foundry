/** Independent GMAT initial-element / RTN oracle. Writes only a new evidence run. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const gmat=path.resolve(process.env.GMAT_HOME||path.join(project,'../.tools/gmat')),bin=path.join(gmat,'bin');
const tag=process.env.NAV01_GMAT_RUN||'r1';if(!/^[a-z0-9-]{1,40}$/.test(tag))throw Error('Invalid run tag');
const evidence=path.join(project,'tools/nav01/evidence',tag);await fs.mkdir(path.dirname(evidence),{recursive:true});await fs.mkdir(evidence); // never overwrite any run
const sha=x=>createHash('sha256').update(x).digest('hex'),slash=x=>x.replaceAll('\\','/'),num=x=>Number(x).toPrecision(17);
const executable=path.join(bin,'GmatConsole.exe'),executableSha256=sha(await fs.readFile(executable));
const sourceFiles=['src/sim/earth-orbit.ts','src/sim/physics.ts','src/sim/types.ts','src/sim/hazards.ts','src/sim/launch.ts','src/sim/persistence.ts','src/sim/simulation.ts','src/sim/index.ts','tools/nav01/validate-initial-orbit.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,sha(await fs.readFile(path.join(project,f)))])));
const sourceBefore=await manifest();
const {earthStateAt}=await import(pathToFileURL(path.join(project,'src/sim/physics.ts')));
// Constants below are independent authored oracle inputs, not imported from product helpers.
const mu=398600.4418,radius=6378.137,spacing=60,duration=86400;
const cases=[
 {id:'ellipse-zero-burn',pe:400,ap:900,inc:51.6,burn:null},
 {id:'ellipse-perigee-burn',pe:400,ap:900,inc:51.6,burn:{time:0,progradeMps:80,radialMps:0,normalMps:15}},
 {id:'ellipse-off-apse-rtn',pe:400,ap:900,inc:51.6,burn:{time:1200,progradeMps:60,radialMps:35,normalMps:12}},
 {id:'ellipse-range-extremes-polar',pe:180,ap:2000,inc:97.6,burn:null},
];
// Solve the elliptic Kepler equation independently of the game's universal propagator.
// Orbit plane axes are P=(1,0,0), Q=(0,cos i,sin i); R/T are analytic true-anomaly axes.
function analyticBurn(c){
 const a=radius+(c.pe+c.ap)/2,e=(c.ap-c.pe)/(2*a),n=Math.sqrt(mu/a**3),M=n*c.burn.time;let E=M;
 for(let k=0;k<30;k++){const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-14)break;}
 const cosf=(Math.cos(E)-e)/(1-e*Math.cos(E)),sinf=Math.sqrt(1-e*e)*Math.sin(E)/(1-e*Math.cos(E)),i=c.inc*Math.PI/180;
 const R=[cosf,sinf*Math.cos(i),sinf*Math.sin(i)],T=[-sinf,cosf*Math.cos(i),cosf*Math.sin(i)],N=[0,-Math.sin(i),Math.cos(i)];
 return {R,T,N,deltaKmS:R.map((r,j)=>(r*c.burn.radialMps+T[j]*c.burn.progradeMps+N[j]*c.burn.normalMps)/1000)};
}
const fields=['X','Y','Z','VX','VY','VZ'];
function script(c){
 const a=radius+(c.pe+c.ap)/2,e=(c.ap-c.pe)/(2*a),lines=[
 '% Independent NAV01 oracle: Keplerian initial elements, analytic RTN, point-mass gravity.',
 `Earth.Mu = ${num(mu)};`,`Earth.EquatorialRadius = ${num(radius)};`,
 'Create Spacecraft Probe;','Probe.DateFormat = TAIGregorian;',"Probe.Epoch = '15 Nov 2026 00:00:00.000';",'Probe.CoordinateSystem = EarthMJ2000Eq;','Probe.DisplayStateType = Keplerian;',
 `Probe.SMA = ${num(a)};`,`Probe.ECC = ${num(e)};`,`Probe.INC = ${num(c.inc)};`,'Probe.RAAN = 0;','Probe.AOP = 0;','Probe.TA = 0;','Probe.DryMass = 100;',
 'Create ForceModel PointMass;','PointMass.CentralBody = Earth;','PointMass.PrimaryBodies = {};','PointMass.PointMasses = {Earth};','PointMass.Drag = None;','PointMass.SRP = Off;','PointMass.RelativisticCorrection = Off;',
 'Create Propagator Prop;','Prop.FM = PointMass;','Prop.Type = PrinceDormand78;','Prop.InitialStepSize = 10;','Prop.Accuracy = 1e-12;','Prop.MinStep = 0.000001;','Prop.MaxStep = 60;','Prop.MaxStepAttempts = 100;','Prop.StopIfAccuracyIsViolated = true;',
 'Create ReportFile States;',`States.Filename = '${c.id}.csv';`,'States.Precision = 17;','States.WriteHeaders = false;','States.FixedWidth = false;',"States.Delimiter = ',';",'States.WriteReport = true;'];
 if(c.burn){lines.push('Create ImpulsiveBurn Correction;','Correction.CoordinateSystem = EarthMJ2000Eq;','Correction.DecrementMass = false;',...analyticBurn(c).deltaKmS.map((v,i)=>`Correction.Element${i+1} = ${num(v)};`));}
 const report=`Report States Probe.ElapsedSecs ${fields.map(f=>`Probe.EarthMJ2000Eq.${f}`).join(' ')};`;
 lines.push('BeginMissionSequence;',report);if(c.burn?.time===0)lines.push('Maneuver Correction(Probe);');
 for(let t=spacing;t<=duration;t+=spacing){lines.push(`Propagate Prop(Probe) {Probe.ElapsedSecs = ${spacing}};`,report);if(c.burn?.time===t)lines.push('Maneuver Correction(Probe);');}
 return lines.join('\n')+'\n';
}
const originalStartup=await fs.readFile(path.join(bin,'gmat_startup_file.txt'),'utf8');
const startup=originalStartup.replace(/^PLUGIN\s*=.*$/gm,x=>'# independent oracle excludes optional '+x).replace(/^ROOT_PATH\s*=.*$/m,`ROOT_PATH = ${slash(gmat)}/`).replace(/^OUTPUT_PATH\s*=.*$/m,`OUTPUT_PATH = ${slash(evidence)}/`);
const startupFile=path.join(evidence,'startup.txt');await fs.writeFile(startupFile,startup);
const summary={schemaVersion:1,startedAt:new Date().toISOString(),baseCommit:'b0c0c5cc07c8e0f7f77e06fb1eef86c99a274586',model:'earth-ellipse-rtn-1',oracle:'Actual GMAT R2026a PrinceDormand78, independently authored initial Kepler elements and elliptic Kepler-equation RTN burn vectors',executableSha256,sourceBefore,tolerance:{maxPositionErrorKm:.01,maxVelocityErrorKmS:.00001,maxStopResidualSeconds:.001},scope:'Earth central point mass, no J2/drag/SRP/third bodies/ephemerides; not launch insertion certification or full spacecraft resource validation.',cases:[],pass:false};
try{
 for(const c of cases){
  const plan={altitudeKm:c.pe,inclinationDeg:c.inc,burnTime:1200,progradeMps:0,radialMps:0,normalMps:0,periapsisAltitudeKm:1000,bPlaneAngleDeg:0,operations:[],earthOrbit:{version:'earth-ellipse-rtn-1',apoapsisAltitudeKm:c.ap},maneuvers:c.burn?[{id:c.id,...c.burn}]:[]};
  const body=script(c),scriptFile=path.join(evidence,c.id+'.script');await fs.writeFile(scriptFile,body);
  const start=performance.now(),run=spawnSync(executable,['--startup_file',startupFile,'--run',scriptFile,'--verbose','off','--logfile',path.join(evidence,c.id+'.log')],{cwd:bin,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8*1024*1024}),consoleText=(run.stdout||'')+(run.stderr||'');await fs.writeFile(path.join(evidence,c.id+'.console.txt'),consoleText);
  if(run.error||run.status!==0||!consoleText.includes('GMAT Integration test (Console version) successful!'))throw Error(`${c.id}: GMAT failed: ${run.error||run.status}`);
  const csv=await fs.readFile(path.join(evidence,c.id+'.csv'),'utf8'),rows=csv.trim().split(/\r?\n/).map(x=>x.split(',').map(Number));
  if(rows.length!==duration/spacing+1||rows.some(r=>r.length!==7||r.some(x=>!Number.isFinite(x))))throw Error(c.id+': missing or invalid actual samples');
  let maxPositionErrorKm=0,maxVelocityErrorKmS=0,maxStopResidualSeconds=0;
  for(const [i,row]of rows.entries()){const t=i*spacing;maxStopResidualSeconds=Math.max(maxStopResidualSeconds,Math.abs(row[0]-t));const actual=earthStateAt(plan,t);maxPositionErrorKm=Math.max(maxPositionErrorKm,Math.hypot(...actual.positionKm.map((v,k)=>v-row[k+1])));maxVelocityErrorKmS=Math.max(maxVelocityErrorKmS,Math.hypot(...actual.velocityKmS.map((v,k)=>v-row[k+4])));}
  const pass=maxPositionErrorKm<=.01&&maxVelocityErrorKmS<=.00001&&maxStopResidualSeconds<=.001;
  summary.cases.push({...c,plan,analyticBurn:c.burn?analyticBurn(c):null,sampleCount:rows.length,maxPositionErrorKm,maxVelocityErrorKmS,maxStopResidualSeconds,pass,runMs:performance.now()-start,scriptSha256:sha(body),csvSha256:sha(csv),consoleSha256:sha(consoleText)});
  console.log(`${c.id}: ${pass?'PASS':'FAIL'}; ${rows.length} actual GMAT states; ${maxPositionErrorKm.toExponential(4)} km; ${maxVelocityErrorKmS.toExponential(4)} km/s`);
 }
 summary.sourceAfter=await manifest();summary.sourceUnchanged=JSON.stringify(summary.sourceBefore)===JSON.stringify(summary.sourceAfter);summary.pass=summary.sourceUnchanged&&summary.cases.length===cases.length&&summary.cases.every(c=>c.pass);
}catch(error){summary.error=String(error);throw error;}finally{summary.finishedAt=new Date().toISOString();await fs.writeFile(path.join(evidence,'summary.json'),JSON.stringify(summary,null,2)+'\n');if(!summary.pass)process.exitCode=1;}
