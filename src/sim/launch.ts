import {BUS,MISSIONS,PARTS} from './catalog';
import {getBusDefinition,getPartDefinition,getPartGeometry,partTransformFor} from '../hardware/resolve';
import {localPartBoxes,partTransform} from './assembly';
import {add,cross,dot,magnitude,normalize,scale,sub} from './physics';
import type {Design,Part,PartKind,Vec3} from './types';
import {initialEarthOrbit} from './earth-orbit';

export type LaunchPackageId='rideshare'|'precision'|'heavy';
export type LaunchDesign=Design&{launchPackageId?:LaunchPackageId};
export interface LaunchPackage {
 readonly id:LaunchPackageId;readonly name:string;readonly description:string;
 readonly cost:number;readonly maxWetMassKg:number;readonly fairingDiameterM:number;readonly fairingHeightM:number;
 readonly clearanceM:number;readonly altitudeRangeKm:readonly[number,number];readonly inclinationRangeDeg:readonly[number,number];
 readonly provenance:'game-assumption';readonly priceLabel:string;
}
export const LAUNCH_PACKAGES:Readonly<Record<LaunchPackageId,LaunchPackage>>=Object.freeze({
 rideshare:Object.freeze({id:'rideshare',name:'공유 궤도 투입',description:'낮은 크레딧으로 정해진 중경사 궤도 범위에 투입합니다.',cost:36,maxWetMassKg:85,fairingDiameterM:2.8,fairingHeightM:3,clearanceM:.03,altitudeRangeKm:[500,700] as const,inclinationRangeDeg:[45,55] as const,provenance:'game-assumption',priceLabel:'게임 크레딧 · 실제 발사 가격 아님'}),
 precision:Object.freeze({id:'precision',name:'전용 궤도 투입',description:'더 많은 크레딧으로 관측 지역에 맞는 고도와 궤도면을 고릅니다.',cost:70,maxWetMassKg:85,fairingDiameterM:2.8,fairingHeightM:3,clearanceM:.03,altitudeRangeKm:[300,1000] as const,inclinationRangeDeg:[0,100] as const,provenance:'game-assumption',priceLabel:'게임 크레딧 · 실제 발사 가격 아님'}),
 heavy:Object.freeze({id:'heavy',name:'대형 탐사선 투입',description:'큰 페어링과 더 높은 질량 한도를 제공하지만 예산을 많이 사용합니다.',cost:110,maxWetMassKg:140,fairingDiameterM:3.8,fairingHeightM:4.4,clearanceM:.04,altitudeRangeKm:[180,2000] as const,inclinationRangeDeg:[0,180] as const,provenance:'game-assumption',priceLabel:'게임 크레딧 · 실제 발사 가격 아님'})
});
/** Authored insertion capabilities, not launch-vehicle performance data.
 * Package cost supplies the initial state; no onboard impulse is fabricated.
 * Both apsides must remain inside the package's published altitude range. */
export const EARTH_INJECTION_POLICIES=Object.freeze({
 version:'earth-injection-policy-1',provenance:'game-assumption',
 rideshare:'circular-only',precision:'bounded-ellipse',heavy:'bounded-ellipse',
 description:'Initial insertion is supplied by the selected launch package. Rideshare is circular; dedicated and heavy insertion may use an ellipse whose two apsides satisfy their altitude limits. This does not model launch ascent or permit changing an orbit during flight.',
} as const);
export interface LocalStowBox {center:Vec3;half:Vec3}
export interface LaunchBox {partId:string;center:Vec3;half:Vec3;axes:[Vec3,Vec3,Vec3]}
export interface StowedEnvelope {
 min:Vec3;max:Vec3;size:Vec3;centerY:number;radiusM:number;diameterM:number;heightM:number;
 boxes:LaunchBox[];corners:Vec3[];interferencePairs:{a:string;b:string}[];
}
export interface LaunchIssue {code:string;message:string;partId?:string}
export interface LaunchEvaluation {
 enabled:boolean;package:LaunchPackage;massKg:number;maxWetMassKg:number;componentCost:number;launchCost:number;totalCost:number;
 envelope:StowedEnvelope;radialMarginM:number;heightMarginM:number;fitsMass:boolean;fitsEnvelope:boolean;injectionSupported:boolean;withinBudget:boolean;
 launchable:boolean;issues:LaunchIssue[];
}
export function getLaunchPackage(designOrId:LaunchDesign|LaunchPackageId='rideshare'):LaunchPackage {
 const id=typeof designOrId==='string'?designOrId:designOrId.launchPackageId||'rideshare';
 if(!Object.hasOwn(LAUNCH_PACKAGES,id))throw new Error('지원하지 않는 발사 패키지입니다.');return LAUNCH_PACKAGES[id];
}
/** Authored compact configurations shared by renderer and validator; not certified mechanical CAD.
 * The single/6-wing package uses 330x208 mm plates with gameplay cover/hinge thickness.
 * Antenna is an explicitly fictional collapsible reflector package. Rigid parts keep exact render proxies.
 */
export function localStowedPartBoxes(kind:PartKind):LocalStowBox[]{
 const mount:LocalStowBox={center:[0,0,.038],half:[.1,.1,.038]};
 if(kind==='solar')return [mount,{center:[0,0,.105],half:[.165,.104,.025]}];
 if(kind==='solarLarge')return [mount,{center:[0,0,.13],half:[.165,.104,.05]}];
 if(kind==='antenna')return [mount,{center:[0,0,.18],half:[.28,.28,.14]}];
 return localPartBoxes(kind);
}
export function partEnvelopeBoxes(part:Part,configuration:'stowed'|'deployed'='stowed',design?:Design):LaunchBox[]{
 const tr=design?partTransformFor(design,part):partTransform(part),local=design?getPartGeometry(design,part)[configuration==='stowed'?'stowedBoxes':'deployedBoxes']:configuration==='stowed'?localStowedPartBoxes(part.kind):localPartBoxes(part.kind);
 return local.map(b=>({partId:part.id,center:add(tr.position,add(add(scale(tr.tangentU,b.center[0]),scale(tr.tangentV,b.center[1])),scale(tr.normal,b.center[2]))),half:b.half,axes:[tr.tangentU,tr.tangentV,tr.normal]}));
}
export function envelopeBoxCorners(box:LaunchBox):Vec3[]{const result:Vec3[]=[];for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])result.push(add(box.center,add(add(scale(box.axes[0],sx*box.half[0]),scale(box.axes[1],sy*box.half[1])),scale(box.axes[2],sz*box.half[2]))));return result;}
function intersect(a:LaunchBox,b:LaunchBox):boolean {
 const difference=sub(b.center,a.center),axes=[...a.axes,...b.axes,...a.axes.flatMap(x=>b.axes.map(y=>cross(x,y)))];
 for(const raw of axes){if(magnitude(raw)<1e-8)continue;const axis=normalize(raw),ra=a.axes.reduce((s,v,i)=>s+Math.abs(dot(axis,v))*a.half[i],0),rb=b.axes.reduce((s,v,i)=>s+Math.abs(dot(axis,v))*b.half[i],0);if(Math.abs(dot(difference,axis))>=ra+rb-.003)return false;}return true;
}
export function stowedEnvelope(design:Design):StowedEnvelope {
 // Includes the closed top cover, external corner rails, bolts and lift rings.
 const bus:LaunchBox={partId:'bus',center:[0,0,0],half:[.7,.86,.7],axes:[[1,0,0],[0,1,0],[0,0,1]]};
 const boxes=[bus,...design.parts.flatMap(p=>partEnvelopeBoxes(p,'stowed',design))],corners=boxes.flatMap(envelopeBoxCorners),min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];let radiusM=0;
 for(const corner of corners){for(let i=0;i<3;i++){min[i]=Math.min(min[i],corner[i]);max[i]=Math.max(max[i],corner[i]);}radiusM=Math.max(radiusM,Math.hypot(corner[0],corner[2]));}
 const interferencePairs:{a:string;b:string}[]=[],pairs=new Set<string>();
 for(let a=1;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){if(boxes[a].partId===boxes[b].partId)continue;const key=[boxes[a].partId,boxes[b].partId].sort().join('|');if(!pairs.has(key)&&intersect(boxes[a],boxes[b])){pairs.add(key);interferencePairs.push({a:boxes[a].partId,b:boxes[b].partId});}}
 return {min,max,size:sub(max,min),centerY:(min[1]+max[1])/2,radiusM,diameterM:2*radiusM,heightM:max[1]-min[1],boxes,corners,interferencePairs};
}
export function evaluateLaunchPackage(design:LaunchDesign,packageId?:LaunchPackageId):LaunchEvaluation {
 const pkg=getLaunchPackage(packageId||design),enabled=design.missionId==='earth',bus=getBusDefinition(design),massKg=bus.massKg+bus.fuelKg+design.parts.reduce((s,p)=>s+getPartDefinition(design,p).massKg,0),componentCost=bus.cost+design.parts.reduce((s,p)=>s+getPartDefinition(design,p).cost,0),launchCost=enabled?pkg.cost:0,totalCost=componentCost+launchCost,envelope=stowedEnvelope(design);
 const radialMarginM=pkg.fairingDiameterM/2-pkg.clearanceM-envelope.radiusM,heightMarginM=pkg.fairingHeightM-2*pkg.clearanceM-envelope.heightM;
 const fitsMass=massKg<=pkg.maxWetMassKg+1e-9,fitsEnvelope=radialMarginM>=-1e-9&&heightMarginM>=-1e-9&&!envelope.interferencePairs.length;
 const orbit=enabled&&design.plan.earthOrbit!==undefined?initialEarthOrbit(design.plan):null;
 const altitudeSupported=design.plan.altitudeKm>=pkg.altitudeRangeKm[0]&&design.plan.altitudeKm<=pkg.altitudeRangeKm[1],apoapsisSupported=!orbit||orbit.apoapsisAltitudeKm>=pkg.altitudeRangeKm[0]&&orbit.apoapsisAltitudeKm<=pkg.altitudeRangeKm[1],shapeSupported=!orbit||EARTH_INJECTION_POLICIES[pkg.id]!=='circular-only'||orbit.apoapsisAltitudeKm===orbit.periapsisAltitudeKm,inclinationSupported=design.plan.inclinationDeg>=pkg.inclinationRangeDeg[0]&&design.plan.inclinationDeg<=pkg.inclinationRangeDeg[1],injectionSupported=altitudeSupported&&apoapsisSupported&&shapeSupported&&inclinationSupported,withinBudget=totalCost<=MISSIONS[design.missionId].budget;
 const issues:LaunchIssue[]=[];
 if(enabled){
  if(!fitsMass)issues.push({code:'LAUNCH_MASS',message:`선택한 발사 패키지의 젖은 질량 한도 ${pkg.maxWetMassKg} kg를 초과합니다.`});
  if(radialMarginM<0)issues.push({code:'STOW_RADIAL',message:`접은 기체가 페어링 반경을 ${(-radialMarginM).toFixed(3)} m 초과합니다. 장비 위치 또는 발사 패키지를 바꾸세요.`});
  if(heightMarginM<0)issues.push({code:'STOW_HEIGHT',message:`접은 기체가 페어링 높이를 ${(-heightMarginM).toFixed(3)} m 초과합니다.`});
  for(const pair of envelope.interferencePairs)issues.push({code:'STOW_INTERFERENCE',message:`수납 상태에서 ${pair.a}와 ${pair.b}가 간섭합니다.`,partId:pair.a});
  if(!altitudeSupported)issues.push({code:'INJECTION_ALTITUDE',message:`${pkg.name}의 초기 투입 고도는 ${pkg.altitudeRangeKm[0]}~${pkg.altitudeRangeKm[1]} km입니다.`});
  if(!apoapsisSupported)issues.push({code:'INJECTION_APOAPSIS',message:`${pkg.name}의 원지점 고도도 ${pkg.altitudeRangeKm[0]}~${pkg.altitudeRangeKm[1]} km 이내여야 합니다.`});
  if(!shapeSupported)issues.push({code:'INJECTION_SHAPE',message:'공유 궤도 투입은 원궤도만 지원합니다. 타원 궤도에는 전용 또는 대형 투입을 선택하세요.'});
  if(!inclinationSupported)issues.push({code:'INJECTION_INCLINATION',message:`${pkg.name}의 초기 궤도 경사각은 ${pkg.inclinationRangeDeg[0]}~${pkg.inclinationRangeDeg[1]}°입니다.`});
  if(!withinBudget)issues.push({code:'BUDGET',message:`발사 패키지를 포함한 비용이 임무 예산을 ${totalCost-MISSIONS[design.missionId].budget} 크레딧 초과합니다.`});
 }
 return {enabled,package:pkg,massKg,maxWetMassKg:enabled?pkg.maxWetMassKg:MISSIONS[design.missionId].massLimitKg,componentCost,launchCost,totalCost,envelope,radialMarginM,heightMarginM,fitsMass,fitsEnvelope,injectionSupported,withinBudget,launchable:!enabled||issues.length===0,issues};
}
