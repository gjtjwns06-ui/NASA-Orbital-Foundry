import { BUS, PARTS, MISSIONS } from './catalog';
import {getBusDefinition,getPartDefinition,getPartGeometry,partTransformFor,isHardwareDesign,resolveHardware} from '../hardware/resolve';
import { conjunctionMetrics } from './hazards';
import {evaluateLaunchPackage} from './launch';
import type { Design, Part, PartKind, LegacyPartKind, Vec3, Warning, DesignEvaluation, Face } from './types';
import { add, availableDeltaV, clamp, cross, dot, EARTH_RADIUS_KM, flybyMetrics, fuelForDeltaV, getManeuvers, magnitude, maneuverMagnitude, minimumEarthPeriapsisKm, normalize, scale, sub } from './physics';
const BASES:Record<Face,{normal:Vec3;u:Vec3;v:Vec3;half:number}>= {
 px:{normal:[1,0,0],u:[0,0,-1],v:[0,1,0],half:.65}, nx:{normal:[-1,0,0],u:[0,0,1],v:[0,1,0],half:.65},
 py:{normal:[0,1,0],u:[1,0,0],v:[0,0,-1],half:.8}, ny:{normal:[0,-1,0],u:[1,0,0],v:[0,0,1],half:.8},
 pz:{normal:[0,0,1],u:[1,0,0],v:[0,1,0],half:.65}, nz:{normal:[0,0,-1],u:[-1,0,0],v:[0,1,0],half:.65}
};
export function partTransform(part:Part):{position:Vec3;normal:Vec3;tangentU:Vec3;tangentV:Vec3}{
 const b=BASES[part.face],a=part.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const mount=PARTS[part.kind as LegacyPartKind]?.internal&&part.face==='py'?.22:b.half+.012;
 return {position:add(scale(b.normal,mount),add(scale(b.u,part.u),scale(b.v,part.v))),normal:[...b.normal],tangentU:add(scale(b.u,c),scale(b.v,s)),tangentV:add(scale(b.v,c),scale(b.u,-s))};
}
type ObstructionBox={center:Vec3;half:Vec3};
// These proxy surfaces follow render/parts.ts dimensions. The mounting footprint is deliberately separate from deployed geometry.
export function localPartBoxes(kind:PartKind):ObstructionBox[]{
 const base:ObstructionBox={center:[0,0,.038],half:[.1,.1,.038]};
 switch(kind){
  case 'solar':return [base,{center:[0,0,.2],half:[.065,.065,.16]},{center:[0,0,.4],half:[.49,.61,.035]}];
  case 'solarLarge':return [base,{center:[0,0,.2],half:[.065,.065,.16]},{center:[0,0,.4],half:[.71,.935,.035]}];
  case 'antenna':return [base,{center:[0,0,.18],half:[.07,.07,.14]},{center:[0,0,.46],half:[.52,.52,.16]},{center:[0,0,.93],half:[.06,.06,.09]}];
  case 'camera':return [base,{center:[0,0,.29],half:[.20,.20,.31]}];
  case 'spectrometer':return [base,{center:[0,0,.29],half:[.20,.20,.31]},{center:[.27,0,.18],half:[.09,.135,.145]}];
  case 'engine':return [base,{center:[0,0,.39],half:[.27,.27,.36]}];
  case 'battery':return [base,{center:[0,0,.19],half:[.21,.165,.15]}];
  case 'storage':return [base,{center:[0,0,.14],half:[.175,.14,.14]}];
  case 'radiator':return [base,{center:[0,0,.12],half:[.31,.415,.075]}];
  default:throw new Error('새 장비는 버스별 형상 조회가 필요합니다.');
 }
}
function worldBoxes(part:Part,design?:Design){const tr=design?partTransformFor(design,part):partTransform(part),boxes=design?getPartGeometry(design,part).deployedBoxes:localPartBoxes(part.kind);return boxes.map(b=>({center:add(tr.position,add(add(scale(tr.tangentU,b.center[0]),scale(tr.tangentV,b.center[1])),scale(tr.normal,b.center[2]))),half:b.half,axes:[tr.tangentU,tr.tangentV,tr.normal]}));}
function boxesIntersect(a:ReturnType<typeof worldBoxes>[number],b:ReturnType<typeof worldBoxes>[number]):boolean{
 const delta=sub(b.center,a.center),axes=[...a.axes,...b.axes,...a.axes.flatMap(x=>b.axes.map(y=>cross(x,y)))];
 for(const axis0 of axes){if(magnitude(axis0)<1e-7)continue;const axis=normalize(axis0),ra=a.axes.reduce((s,v,i)=>s+Math.abs(dot(axis,v))*a.half[i],0),rb=b.axes.reduce((s,v,i)=>s+Math.abs(dot(axis,v))*b.half[i],0);if(Math.abs(dot(delta,axis))>=ra+rb-.003)return false;}return true;
}
export function evaluatePlacement(design:Design,part:Part):{valid:boolean;reasons:string[]}{
 const p=getPartDefinition(design,part),bus=getBusDefinition(design),reasons:string[]=[],limitU=.65,limitV=part.face==='py'||part.face==='ny'?.65:.8;
 const rad=part.rotation*Math.PI/180,extentU=(Math.abs(Math.cos(rad))*p.footprint[0]+Math.abs(Math.sin(rad))*p.footprint[1])/2,extentV=(Math.abs(Math.sin(rad))*p.footprint[0]+Math.abs(Math.cos(rad))*p.footprint[1])/2;
 if(Math.abs(part.u)+extentU>limitU+.001||Math.abs(part.v)+extentV>limitV+.001)reasons.push('장착판의 경계를 벗어났습니다.');
 if(p.internal&&part.face!=='py')reasons.push('내부 모듈은 상단 서비스 베이에 넣으세요.');
 if(part.kind==='engine'&&(part.face!=='ny'||Math.hypot(part.u,part.v)>.16))reasons.push('엔진은 -Y 면 중심 반경 0.16 m 안에 장착하세요.');
 if(design.parts.filter(x=>x.kind===part.kind&&x.id!==part.id).length>=p.maxCount)reasons.push(`이 부품은 최대 ${p.maxCount}개까지 장착할 수 있습니다.`);
 const ownBoxes=worldBoxes(part,design);
 if(p.internal&&part.face==='py'){for(const box of ownBoxes){const extent:Vec3=[0,0,0];for(let axis=0;axis<3;axis++)extent[axis]=box.axes.reduce((sum,v,i)=>sum+Math.abs(v[axis])*box.half[i],0);if([0,1,2].some(i=>box.center[i]-extent[i]<bus.bay.min[i]-1e-6||box.center[i]+extent[i]>bus.bay.max[i]+1e-6)){reasons.push('내부 모듈의 실제 형상이 서비스 베이의 수납 공간을 벗어납니다.');break;}}}
 for(const other of design.parts){if(other.id===part.id)continue;const q=getPartDefinition(design,other);if(ownBoxes.some(a=>worldBoxes(other,design).some(b=>boxesIntersect(a,b))))reasons.push(`${q.name}의 전개 형상과 간섭합니다.`);}
 return {valid:!reasons.length,reasons:[...new Set(reasons)]};
}
function rayBox(origin:Vec3,dir:Vec3,center:Vec3,half:Vec3):boolean {
 let near=-Infinity,far=Infinity;
 for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-8){if(Math.abs(origin[i]-center[i])>half[i])return false;}else{const a=(center[i]-half[i]-origin[i])/dir[i],b=(center[i]+half[i]-origin[i])/dir[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}}
 return far>=Math.max(near,.002)&&far>.002;
}
type CachedOccluder={id:string;tr:ReturnType<typeof partTransformFor>;boxes:ReturnType<typeof getPartGeometry>['deployedBoxes']};
const obstructionCache=new WeakMap<Design,CachedOccluder[]>();
function occluders(design:Design){let value=obstructionCache.get(design);if(value)return value;value=design.parts.filter(p=>!getPartDefinition(design,p).internal).map(p=>({id:p.id,tr:partTransformFor(design,p),boxes:getPartGeometry(design,p).deployedBoxes}));if(Object.isFrozen(design)&&Object.isFrozen(design.parts)&&design.parts.every(Object.isFrozen))obstructionCache.set(design,value);return value;}
function rayOccluded(design:Design,part:Part,origin:Vec3,direction:Vec3):boolean{
 if(rayBox(origin,direction,[0,0,0],[.65,.8,.65]))return true;
 for(const o of occluders(design)){if(o.id===part.id)continue;
 const tr=o.tr,local=sub(origin,tr.position),org:Vec3=[dot(local,tr.tangentU),dot(local,tr.tangentV),dot(local,tr.normal)],dir:Vec3=[dot(direction,tr.tangentU),dot(direction,tr.tangentV),dot(direction,tr.normal)];
 if(o.boxes.some(box=>rayBox(org,dir,box.center,box.half)))return true;
 }return false;
}
type ApertureSample={origin:Vec3;normal:Vec3;weight:number};
const apertureCache=new WeakMap<Design,Map<string,ApertureSample[]>>();
function hardwareApertures(design:Design,part:Part){let cached=apertureCache.get(design);const found=cached?.get(part.id);if(found)return found;const tr=partTransformFor(design,part),apertures=getPartGeometry(design,part).apertures;const result=apertures.flatMap(a=>{const normal=add(add(scale(tr.tangentU,a.normal[0]),scale(tr.tangentV,a.normal[1])),scale(tr.normal,a.normal[2])),center=add(tr.position,add(add(scale(tr.tangentU,a.center[0]),scale(tr.tangentV,a.center[1])),scale(tr.normal,a.center[2])));return [[0,0],[-.3,-.3],[-.3,.3],[.3,-.3],[.3,.3]].map(([u,v])=>({origin:add(center,add(scale(tr.tangentU,u*a.width),scale(tr.tangentV,v*a.height))),normal,weight:(a.powerFraction??1/apertures.length)/5}));});if(Object.isFrozen(design)&&Object.isFrozen(design.parts)&&design.parts.every(Object.isFrozen)){if(!cached){cached=new Map();apertureCache.set(design,cached);}cached.set(part.id,result);}return result;}
// Five aperture samples with oriented box obstruction; dimensions are gameplay proxy geometry, not CAD certification.
export function visibilitySamples(design:Design,part:Part,direction:Vec3,cosFov=-1):{origin:Vec3;direction:Vec3;clear:boolean;pointing:boolean;weight?:number}[]{
 if(isHardwareDesign(design)){const dir=normalize(direction);return hardwareApertures(design,part).map(a=>({origin:[...a.origin] as Vec3,direction:dir,clear:!rayOccluded(design,part,a.origin,dir),pointing:dot(a.normal,dir)>=cosFov,weight:a.weight}));}
 const tr=partTransform(part),dir=normalize(direction),pointing=dot(tr.normal,dir)>=cosFov;
 const aperture=part.kind==='solar'?[.91,1.15,.445]:part.kind==='solarLarge'?[1.35,1.8,.445]:part.kind==='antenna'?[.5,.5,1.035]:part.kind==='camera'||part.kind==='spectrometer'?[.28,.28,.61]:[.2,.2,getPartDefinition(design,part).depth+.01];
 return [[0,0],[-.3,-.3],[-.3,.3],[.3,-.3],[.3,.3]].map(([u,v])=>{
 const origin=add(add(tr.position,scale(tr.normal,aperture[2])),add(scale(tr.tangentU,u*aperture[0]),scale(tr.tangentV,v*aperture[1])));
 return {origin,direction:dir,clear:!rayOccluded(design,part,origin,dir),pointing};
 });
}
export function partVisibility(design:Design,part:Part,direction:Vec3,cosFov=-1):number{
 if(isHardwareDesign(design))return visibilitySamples(design,part,direction,cosFov).reduce((s,a)=>s+(a.clear&&a.pointing?(a.weight??0):0),0);
 if(dot(partTransform(part).normal,normalize(direction))<cosFov)return 0;
 const samples=visibilitySamples(design,part,direction,cosFov);return samples.filter(s=>s.clear&&s.pointing).length/samples.length;
}
export function solarGeneration(design:Design,sunBodyDirection:Vec3,eclipse:boolean,distanceAU=1):{powerW:number;visibility:number}{
 if(eclipse)return {powerW:0,visibility:0};let powerW=0,total=0,weighted=0;
 for(const p of design.parts){const d=getPartDefinition(design,p);if(!d.outputW)continue;const incidence=Math.max(0,dot(partTransformFor(design,p).normal,normalize(sunBodyDirection))),vis=partVisibility(design,p,sunBodyDirection,0);powerW+=d.outputW*incidence*vis/(distanceAU*distanceAU);total+=d.outputW;weighted+=d.outputW*vis;}
 return {powerW:isHardwareDesign(design)?Math.min(powerW,getBusDefinition(design).solarLimitW):powerW,visibility:total?weighted/total:0};
}
const designCache=new WeakMap<Design,{signature:string;value:DesignEvaluation}>();
export function evaluateDesign(design:Design):DesignEvaluation{
 const signature=JSON.stringify(design),cached=designCache.get(design);if(cached?.signature===signature)return cached.value;
 const mission=MISSIONS[design.missionId],warnings:Warning[]=[],defs=design.parts.map(p=>getPartDefinition(design,p)),bus=getBusDefinition(design),hardware=isHardwareDesign(design)?resolveHardware(design):null;
 const dryMassKg=bus.massKg+defs.reduce((s,p)=>s+p.massKg,0),fuelKg=bus.fuelKg,massKg=dryMassKg+fuelKg;
 const launch=evaluateLaunchPackage(design),cost=launch.totalCost,batteryWh=bus.batteryWh+defs.reduce((s,p)=>s+(p.capacityWh||0),0),storageBits=bus.storageBits+defs.reduce((s,p)=>s+(p.capacityBits||0),0);
 const chargeLimitW=hardware?Math.min(bus.chargeLimitW,defs.reduce((s,p)=>s+(p.chargeLimitW||0),0)):bus.chargeLimitW+defs.reduce((s,p)=>s+(p.chargeLimitW||0),0),dischargeLimitW=hardware?Math.min(bus.dischargeLimitW,defs.reduce((s,p)=>s+(p.dischargeLimitW||0),0)):bus.dischargeLimitW+defs.reduce((s,p)=>s+(p.dischargeLimitW||0),0);
 if(hardware)warnings.push(...hardware.issues);
 const engine=defs.some(p=>p.kind==='engine'),requiredDeltaVMps=design.missionId==='earth'?getManeuvers(design.plan).reduce((sum,n)=>sum+maneuverMagnitude(n),0):flybyMetrics(design.plan).correctionDeltaVMps;
 const deltaVMps=engine?availableDeltaV(dryMassKg,fuelKg):0,propellantUsedKg=fuelForDeltaV(massKg,requiredDeltaVMps),solarPowerW=defs.reduce((s,p)=>s+(p.outputW||0),0)/(design.missionId==='mars'?1.524**2:1);
 let centerOfMass:Vec3=hardware?[...hardware.centerOfMassM]:[0,0,0];if(!hardware)for(const p of design.parts){centerOfMass=add(centerOfMass,scale(partTransformFor(design,p).position,getPartDefinition(design,p).massKg/massKg));}
 for(const p of design.parts){for(const msg of evaluatePlacement(design,p).reasons)warnings.push({code:'PLACEMENT',severity:'error',message:msg,partId:p.id});}
 const cameraCount=defs.filter(d=>d.kind===(design.missionId==='earth'?'camera':'spectrometer')).length,antennaCount=defs.filter(d=>d.kind==='antenna').length;
 if(cost>mission.budget)warnings.push({code:'BUDGET',severity:'error',message:`예산 ${cost-mission.budget} 크레딧 초과`});
 if(massKg>launch.maxWetMassKg)warnings.push({code:'MASS',severity:'error',message:`선택한 발사 조건의 질량 한도 ${launch.maxWetMassKg} kg를 초과했습니다.`});
 for(const issue of launch.issues){if(issue.code==='BUDGET'||issue.code==='LAUNCH_MASS')continue;warnings.push({...issue,severity:'error'});}
 if(!cameraCount)warnings.push({code:'NO_SCIENCE',severity:'warning',message:`${design.missionId==='earth'?'광학 카메라':'분광 관측기'}가 없어 과학 자료를 만들 수 없습니다.`});
 if(!antennaCount)warnings.push({code:'NO_ANTENNA',severity:'warning',message:'안테나가 없어 지상에 자료를 보낼 수 없습니다.'});
 if(!solarPowerW)warnings.push({code:'NO_SOLAR',severity:'warning',message:'발전 장비가 없어 배터리만으로 운용합니다.'});
 if(requiredDeltaVMps>deltaVMps+.001)warnings.push({code:'FUEL',severity:'error',message:'계획한 기동에 필요한 Δv가 가용량을 초과합니다.'});
 if(design.missionId==='mars'&&design.plan.periapsisAltitudeKm<250)warnings.push({code:'UNSAFE_FLYBY',severity:'error',message:'화성 최근접 고도가 250 km 안전 한계보다 낮습니다.'});
 if(design.missionId==='earth'&&(design.plan.altitudeKm<180||design.plan.altitudeKm>2000))warnings.push({code:'ALTITUDE',severity:'error',message:'지원하는 초기 고도는 180~2,000 km입니다.'});
 if(design.missionId==='earth'&&minimumEarthPeriapsisKm(design.plan)<EARTH_RADIUS_KM+180-1e-6)warnings.push({code:'UNSAFE_PERIAPSIS',severity:'error',message:'기동 뒤 예상 근지점 고도가 180 km 안전 한계 아래입니다.'});
 if(design.missionId==='earth'){const ids=new Set<string>();for(const n of getManeuvers(design.plan)){if(ids.has(n.id))warnings.push({code:'DUPLICATE_BURN',severity:'error',message:'기동 노드 ID가 중복됩니다.'});ids.add(n.id);if(n.time<0||n.time>mission.duration)warnings.push({code:'BURN_TIME',severity:'error',message:'기동 시각이 임무 기간을 벗어났습니다.'});}}
 for(let i=0;i<design.plan.operations.length;i++)for(let j=i+1;j<design.plan.operations.length;j++){const a=design.plan.operations[i],b=design.plan.operations[j];if(a.start<b.end&&b.start<a.end)warnings.push({code:'SCHEDULE_CONFLICT',severity:'error',message:'작업 시간이 겹칩니다. 타임라인에서 분리하세요.'});}
 const thruster=design.parts.find(p=>p.kind==='engine');if(thruster){const tr=partTransformFor(design,thruster),offset=magnitude(cross(sub(centerOfMass,tr.position),tr.normal));if(offset>.18)warnings.push({code:'THRUST_OFFSET',severity:'error',message:`실제 엔진 추력선과 질량중심 간 거리 ${offset.toFixed(3)} m가 버스의 0.18 m 허용값을 초과합니다.`,partId:thruster.id});}
 if(!defs.some(p=>p.outputW))warnings.push({code:'ENERGY',severity:'info',message:'배터리가 소진되면 안전 모드로 전환합니다.'});
 if(design.hazard==='debris'&&design.missionId!=='earth')warnings.push({code:'HAZARD_CONTEXT',severity:'error',message:'궤도 잔해 훈련은 지구관측 임무에서만 사용할 수 있습니다.'});
 const conjunction=conjunctionMetrics(design);if(conjunction.enabled&&!conjunction.safe)warnings.push({code:'CONJUNCTION',severity:'warning',message:`교육용 잔해의 예상 최소 거리 ${(conjunction.minDistanceKm*1000).toFixed(0)} m · 훈련 목표는 2 km 이상입니다.`});
 const value={massKg,dryMassKg,cost,batteryWh,storageBits,solarPowerW,basePowerW:hardware?hardware.modeLoadW.charge:bus.basePowerW+defs.reduce((s,p)=>s+p.idlePowerW,0),activePowerW:hardware?Math.max(...Object.values(hardware.modeLoadW)):bus.basePowerW+defs.reduce((s,p)=>s+p.activePowerW,0),deltaVMps,requiredDeltaVMps,fuelKg,propellantUsedKg,centerOfMass,warnings,launchable:!warnings.some(x=>x.severity==='error'),cameraCount,antennaCount,chargeLimitW,dischargeLimitW,componentCost:launch.componentCost,launchCost:launch.launchCost,massLimitKg:launch.maxWetMassKg,stowedSizeM:launch.envelope.size,stowedDiameterM:launch.envelope.diameterM,stowedHeightM:launch.envelope.heightM};designCache.set(design,{signature,value});return value;
}
export function bodyBasis(targetDirection:Vec3,sunDirection:Vec3,mode:'sun'|'target'|'earth',earthDirection:Vec3):{x:Vec3;y:Vec3;z:Vec3}{
 // Target boresight is -Z; downlink +Z. Each mode rotates the entire rigid spacecraft.
 let z=normalize(mode==='earth'?earthDirection:scale(targetDirection,-1));
 let x=normalize(sub(sunDirection,scale(z,dot(sunDirection,z))));if(magnitude(x)<.1)x=normalize(cross([0,1,0],z));
 if(mode==='sun'){x=normalize(sunDirection);z=normalize(sub(z,scale(x,dot(z,x))));if(magnitude(z)<.1)z=normalize(cross(x,[0,1,0]));}
 const y=normalize(cross(z,x));return {x,y,z};
}
export function worldToBody(direction:Vec3,targetDirection:Vec3,sunDirection:Vec3,mode:'sun'|'target'|'earth',earthDirection:Vec3):Vec3{const {x,y,z}=bodyBasis(targetDirection,sunDirection,mode,earthDirection);return [dot(direction,x),dot(direction,y),dot(direction,z)];}
