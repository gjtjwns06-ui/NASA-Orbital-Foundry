import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHardwareDesign,createHardwarePart,HARDWARE_CATALOG_HASH,resolveHardware} from '../src/hardware';
import {evaluateDesign,evaluatePlacement} from '../src/sim/assembly';
import {createTransferPlan,solveTransferPlan,transferTrajectory} from '../src/transfer';
import type {Part} from '../src/sim/types';

const output=join(process.cwd(),'tests/browser/artifacts/performance-standard-prep');mkdirSync(output,{recursive:true});
const design=createHardwareDesign('mars','starter','pathfinder-d35-v1');design.name='STANDARD-20 · geometry benchmark';
const add=(id:string,model:string,face:Part['face'],u=0,v=0)=>design.parts.push(createHardwarePart(model,id,face,u,v));
for(const face of ['px','nx'] as const){
  add(`solar-${face}-left`,'tsp45-fixed-v2',face,-.35,0);add(`solar-${face}-right`,'tsp45-fixed-v2',face,.35,0);
  add(`camera-${face}`,'wide-mono-v2',face,0,-.56);add(`spectrometer-${face}`,'mars-spectra-v2',face,0,.53);
}
add('solar-sixwing','tsp45-sixwing-v2','py');add('antenna-uhf','uhf-dipole-pair-v1','pz');add('antenna-xband','xband-reflector-1m-v1','nz');add('engine','chemical230-v2','ny');
const internals=[
  ['battery-a','bpx100-4s2p-v2',-.4,-.4],['battery-b','bpx100-4s2p-v2',0,-.4],['battery-c','bpx100-4s2p-v2',.4,-.4],
  ['radio-uhf','ax100u-carrier-v1',-.4,0],['radio-xband','iris22-carrier-v1',0,0],['adcs','xact50-carrier-v1',.4,0],
  ['recorder-a','recorder-1p6-v2',-.4,.4],['recorder-b','recorder-8-v2',0,.4],
] as const;
for(const [id,model,u,v] of internals)add(id,model,'py',u,v);design.activeRadioId='radio-xband';
const placements=design.parts.map(part=>({id:part.id,modelId:part.modelId,...evaluatePlacement(design,part)}));
const evaluation=evaluateDesign(design),hardware=resolveHardware(design),plan=createTransferPlan(),solution=solveTransferPlan(plan);
const spacecraftPathPoints={earthEscape:transferTrajectory(solution,'earth-escape',100).length,solarCoast:transferTrajectory(solution,'solar-coast',360).length,marsFlyby:transferTrajectory(solution,'mars-flyby',100).length};
const replay:Array<{atMs:number;type:string;button?:'right';x?:number;y?:number;deltaY?:number}>=[];
for(let cycle=0;cycle<6;cycle++){
  const start=cycle*20000;
  for(const [offset,from,to] of [[1200,[.60,.40],[.70,.44]],[7200,[.47,.35],[.37,.43]]] as const){
    replay.push({atMs:start+offset,type:'move',x:from[0],y:from[1]},{atMs:start+offset+30,type:'down',button:'right'});
    for(let step=1;step<=16;step++)replay.push({atMs:start+offset+30+step*55,type:'move',x:from[0]+(to[0]-from[0])*step/16,y:from[1]+(to[1]-from[1])*step/16});
    replay.push({atMs:start+offset+930,type:'up',button:'right'});
  }
  replay.push({atMs:start+4500,type:'wheel',deltaY:-110},{atMs:start+12500,type:'wheel',deltaY:110});
}
const report={
  status:'PREPARED ONLY — no GPU, browser, timing or performance PASS',catalogHash:HARDWARE_CATALOG_HASH,
  partCount:design.parts.length,uniqueInstanceIds:new Set(design.parts.map(p=>p.id)).size,
  allPlacementsValid:placements.every(p=>p.valid),placements,
  missionLaunchable:evaluation.launchable,massKg:evaluation.massKg,cost:evaluation.cost,warnings:evaluation.warnings,
  connections:hardware.connections,connectionIssues:hardware.issues,
  intendedMeasurement:{width:1920,height:1080,quality:'medium',warmupSeconds:10,durationSeconds:120,inputReplay:true,planets:['Earth','Mars'],targetMeanFps:60,targetP99Ms:33.3},
  plannedInputReplay:'input-replay.json contains a fixed120s right-button orbit/wheel event list in normalized viewport coordinates. Times start after10s warmup. Assert canvas hit targets before the timed run; no full mission launch required.',
  currentRendererDifferences:{spacecraftPathPoints,planetOrbitPoints:600,quality:'Renderer now supports explicit medium: DPRcap1,64x48 planet tessellation,48x32 clouds/atmosphere,anisotropy4,AA/ACES retained. Verify final inherited UI setting and actual getRenderSettings() before measuring.',pathCount:'560 spacecraft samples +600 planetary-orbit samples =1160 plotted samples, distinct from1000 spacecraft samples; original acceptance difference must be disclosed or adapted explicitly. Do not reduce science/path points merely to match a nominal count.'},
  limitations:['All20 are real catalogue parts at validated physical mounts, not decorative clones.','Placement legality is separate from power, interface, budget and launch eligibility; warnings retained below.','This is a planning scene stress fixture, not a successful or sensible mission design.','Do not silently enlarge budgets, disable compatibility validation or change recorded geometry to make the fixture launchable.'],
};
writeFileSync(join(output,'hardware-20-design.json'),JSON.stringify(design,null,2));writeFileSync(join(output,'transfer-plan.json'),JSON.stringify(plan,null,2));writeFileSync(join(output,'legality-report.json'),JSON.stringify(report,null,2));
writeFileSync(join(output,'input-replay.json'),JSON.stringify({version:1,width:1920,height:1080,warmupMs:10000,durationMs:120000,coordinateSystem:'normalized viewport; apply x*width,y*height',actions:replay},null,2));
if(design.parts.length!==20||!report.allPlacementsValid)throw new Error(JSON.stringify({count:design.parts.length,invalid:placements.filter(p=>!p.valid)}));
console.log(JSON.stringify({parts:design.parts.length,placementsValid:report.allPlacementsValid,missionLaunchable:report.missionLaunchable,massKg:report.massKg,cost:report.cost,warnings:evaluation.warnings.map(w=>w.code),output}));
