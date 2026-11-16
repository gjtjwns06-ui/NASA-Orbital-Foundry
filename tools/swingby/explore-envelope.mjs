/** Design study only. No production scenario, success credit, or GMAT verdict. */
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const bundle=await build({stdin:{contents:`
 export {createHardwareTransferPlan,solveTransferPlan} from './src/transfer/planning';
 export {transferStateAt,TRANSFER_MARS_MU,TRANSFER_MARS_RADIUS_KM} from './src/transfer/state';
 export {transferPlanetState,TRANSFER_DATASET_ID,TRANSFER_DATA_SOURCES} from './src/transfer/ephemeris';
 export {SUN_MU_KM3_S2,hyperbolicLocalStateAt} from './src/transfer/math';
 export {propagateKepler,add,sub,scale,dot,cross,magnitude,normalize} from './src/sim/physics';
`,resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const analytic=process.argv.includes('--analytic-local');
const outputFolder=path.join(root,'tools/swingby',analytic?'exploration-analytic-v1':'exploration-v1');
// Recover the osculating hyperbola's periapsis basis and elapsed anomaly from
// arbitrary Cartesian input. This study still requires independent GMAT checks.
function localPropagator(initial){
 if(!analytic)return dt=>m.propagateKepler(initial,dt,mu);
 const r=m.magnitude(initial.positionKm),v2=m.dot(initial.velocityKmS,initial.velocityKmS);
 const h=m.cross(initial.positionKm,initial.velocityKmS);
 const eccentricityVector=m.sub(m.scale(m.cross(initial.velocityKmS,h),1/mu),m.scale(initial.positionKm,1/r));
 const e=m.magnitude(eccentricityVector),energy=v2/2-mu/r;
 if(e<=1.000001||energy<=0)throw new Error('Study adapter only admits bounded hyperbolic states.');
 const a=mu/(2*energy),rp=m.dot(h,h)/(mu*(1+e));
 const p=m.normalize(eccentricityVector),q=m.cross(m.normalize(h),p);
 const peri={positionKm:m.scale(p,rp),velocityKmS:m.scale(q,Math.sqrt(mu*(1+e)/rp))};
 const sinhH=m.dot(initial.positionKm,initial.velocityKmS)/(e*Math.sqrt(mu*a));
 const elapsed=(e*sinhH-Math.asinh(sinhH))*Math.sqrt(a*a*a/mu);
 return dt=>m.hyperbolicLocalStateAt(peri,mu,elapsed+dt);
}
const solution=m.solveTransferPlan(m.createHardwareTransferPlan());
const nodeTime=solution.marsEntrySeconds+(solution.periapsisSeconds-solution.marsEntrySeconds)*.25;
const node=m.transferStateAt(solution,nodeTime),mu=m.TRANSFER_MARS_MU;
if(node.centerBody!=='Mars')throw new Error('Study node must be inside the Mars patch.');
const initial={positionKm:node.relativePositionKm,velocityKmS:node.relativeVelocityKmS};
const baselinePropagator=localPropagator(initial);
const baselineChecks=[0,.25,.5,.75,1,1.25].map(fraction=>{
 const dt=(solution.periapsisSeconds-nodeTime)*fraction;
 const propagated=baselinePropagator(dt),reference=m.transferStateAt(solution,nodeTime+dt);
 return {fraction,dt,positionErrorM:m.magnitude(m.sub(propagated.positionKm,reference.relativePositionKm))*1000,
  velocityErrorMps:m.magnitude(m.sub(propagated.velocityKmS,reference.relativeVelocityKmS))*1000,
  propagatedAltitudeKm:m.magnitude(propagated.positionKm)-m.TRANSFER_MARS_RADIUS_KM,
  referenceAltitudeKm:m.magnitude(reference.relativePositionKm)-m.TRANSFER_MARS_RADIUS_KM};
});
if(baselineChecks.some(row=>row.positionErrorM>1||row.velocityErrorMps>.001)){
 const folder=outputFolder;await mkdir(folder,{recursive:true});
 const report={status:'REJECTED PROPAGATION ADAPTER',scope:'Long inbound-to-periapsis universal-variable propagation differs from the accepted analytic hyperbola. Do not use initial-unchecked-report.json to select a scenario or goal. Existing transfer local phases use hyperbolicLocalStateAt; no production source was changed.',nodeTime,nodeJdTdb:node.jdTdb,initial,baselineChecks};
 await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));throw new Error('Study adapter failed baseline consistency; no scenario samples accepted.');
}
const along=m.normalize(initial.velocityKmS);
const xAxis=m.normalize(m.sub(initial.positionKm,m.scale(along,m.dot(initial.positionKm,along))));
const yAxis=m.normalize(m.cross(along,xAxis));
const exitRadiusKm=100000;
function rootBetween(fn,lo,hi){
 let a=fn(lo),b=fn(hi);
 if(!Number.isFinite(a)||!Number.isFinite(b)||a>0||b<0)throw new Error('Unbracketed study event');
 for(let i=0;i<60&&hi-lo>1e-7;i++){const mid=(lo+hi)/2,v=fn(mid);if(!Number.isFinite(v))throw new Error('Nonfinite event');if(v>0)hi=mid;else lo=mid;}
 return (lo+hi)/2;
}
const offsets=[0,-2,2,-5,5,-10,10,-20,20];
const controls=[...offsets.map(x=>[x,0]),...offsets.filter(y=>y).map(y=>[0,y]),[-10,-10],[-10,10],[10,-10],[10,10]];
const rows=controls.map(([xMps,yMps])=>{
 const impulse=m.add(m.scale(xAxis,xMps/1000),m.scale(yAxis,yMps/1000));
 const start={positionKm:[...initial.positionKm],velocityKmS:m.add(initial.velocityKmS,impulse)};
 const stateAt=localPropagator(start);
 const maximumTime=(solution.periapsisSeconds-nodeTime)*3;
 const periTime=rootBetween(t=>{const s=stateAt(t);return m.dot(s.positionKm,s.velocityKmS);},0,maximumTime);
 const peri=stateAt(periTime),periRadius=m.magnitude(peri.positionKm);
 if(periRadius>=exitRadiusKm)return {xMps,yMps,periapsisAltitudeKm:periRadius-m.TRANSFER_MARS_RADIUS_KM,noExit:true};
 const exitTime=rootBetween(t=>m.magnitude(stateAt(t).positionKm)-exitRadiusKm,periTime,maximumTime);
 const local=stateAt(exitTime),jdTdb=node.jdTdb+exitTime/86400,planet=m.transferPlanetState('mars',jdTdb);
 const heliocentricPositionKm=m.add(planet.positionKm,local.positionKm),heliocentricVelocityKmS=m.add(planet.velocityKmS,local.velocityKmS);
 return {xMps,yMps,deltaVMps:Math.hypot(xMps,yMps),periapsisElapsedSeconds:nodeTime+periTime,periapsisAltitudeKm:periRadius-m.TRANSFER_MARS_RADIUS_KM,
  intersectsBody:periRadius<=m.TRANSFER_MARS_RADIUS_KM,clearsIllustrative250Km:periRadius>=m.TRANSFER_MARS_RADIUS_KM+250,
  exitElapsedSeconds:nodeTime+exitTime,exitJdTdb:jdTdb,exitRadiusKm:m.magnitude(local.positionKm),outwardRadialSpeedKmS:m.dot(local.positionKm,local.velocityKmS)/exitRadiusKm,
  localExit:local,heliocentricPositionKm,heliocentricVelocityKmS,specificEnergyKm2S2:m.dot(heliocentricVelocityKmS,heliocentricVelocityKmS)/2-m.SUN_MU_KM3_S2/m.magnitude(heliocentricPositionKm)};
});
const baseline=rows[0];
for(const row of rows){
 if(row.noExit)continue;
 const cosine=m.dot(row.heliocentricVelocityKmS,baseline.heliocentricVelocityKmS)/(m.magnitude(row.heliocentricVelocityKmS)*m.magnitude(baseline.heliocentricVelocityKmS));
 row.baselineDirectionDifferenceDeg=Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI;
 row.baselineEnergyDifferenceKm2S2=row.specificEnergyKm2S2-baseline.specificEnergyKm2S2;
}
const report={status:'EXPLORATORY ONLY',method:analytic?'Cartesian to osculating hyperbola + accepted analytic local propagator':'Direct universal-variable propagator',generatedAt:new Date().toISOString(),scope:'Actual-epoch local impulse sensitivity with frozen Horizons Mars positions. Not independent numerical validation, a frozen exit target, a propulsion/ADCS feasibility check, or actual science-return gameplay.',
 datasetId:m.TRANSFER_DATASET_ID,sourceHashes:m.TRANSFER_DATA_SOURCES,nodeTime,nodeJdTdb:node.jdTdb,initial,baselineChecks,basis:{xAxis,yAxis,along},exitRadiusKm,rows};
const folder=outputFolder;await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,nodeBeforePeriapsisHours:(solution.periapsisSeconds-nodeTime)/3600,nodeRadiusKm:m.magnitude(initial.positionKm),exitRadiusKm,
 rows:rows.map(r=>({x:r.xMps,y:r.yMps,dv:r.deltaVMps,alt:r.periapsisAltitudeKm,directionDifference:r.baselineDirectionDifferenceDeg,energyDifference:r.baselineEnergyDifferenceKm2S2}))},null,2));
