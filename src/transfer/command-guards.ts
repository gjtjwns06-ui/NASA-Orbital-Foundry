import {getBusDefinition,getPartDefinition,getPartGeometry,partTransformFor,resolveHardware,hardwareLink} from '../hardware';
import {visibilitySamples} from '../sim/assembly';
import {quaternionAngleDeg,quaternionToBasis,slewQuaternion} from '../sim/attitude';
import {cross,dot,magnitude,normalize,scale,sub} from '../sim/physics';
import type {Design,Part,Quaternion,Vec3} from '../sim/types';
import {COMMAND_NETWORK as N} from './command-network';
import {ackBitAt,commandBitAt,planetInterpolationBounds,signalGeometry,solveRetardedEmission,stationStateAt,uplinkBudget} from './command-link';
import {transferStateAt} from './state';
import type {OperationsRuntimeState,SignalBitEndpoint} from './operations-types';
import type {OperationsReasonCode} from './operations-codes';
import {OperationsError} from './operations-codes';
import {SUN_MU_KM3_S2} from './math';
import type {FullTransferSolution} from './types';

const RAD=180/Math.PI;
// Deliberately loose bound for this immutable, accepted Sun/Earth/Mars patched
// trajectory, checked against endpoint speeds before any certificate is used.
const MAX_ENDPOINT_SPEED_KM_S=300;
const RETARDED_RATE_BOUND=1.003;
const speedCertificates=new WeakMap<FullTransferSolution,Readonly<{certified:boolean;maximumSpacecraftSpeedKmS:number;maximumStationSpeedKmS:number}>>();
/** Conic energy/angular momentum gives the maximum speed at periapsis, even
 * when that periapsis lies outside the played coast arc. Planet-origin speeds
 * are exact cubic-Hermite polynomial bounds over the entire immutable dataset. */
export function trajectorySpeedCertificate(solution:FullTransferSolution){const cached=speedCertificates.get(solution);if(cached)return cached;const t=solution.trajectory,r=t.coastInitialPositionKm,v=t.coast.departureVelocityKmS,h=cross(r,v),h2=dot(h,h),eccentricity=magnitude(sub(scale(cross(v,h),1/SUN_MU_KM3_S2),normalize(r))),peri=h2/SUN_MU_KM3_S2/(1+eccentricity),coast=peri>0?Math.sqrt(h2)/peri:Infinity,earth=planetInterpolationBounds('earth').speedKmS,mars=planetInterpolationBounds('mars').speedKmS,maximumSpacecraftSpeedKmS=Math.max(coast,earth+magnitude(t.earthLocalPeriapsis.velocityKmS),mars+magnitude(t.marsLocal.periapsis.velocityKmS))+1e-5,maximumStationSpeedKmS=earth+6378.137*7.4e-5,result=Object.freeze({certified:Number.isFinite(maximumSpacecraftSpeedKmS)&&maximumSpacecraftSpeedKmS<MAX_ENDPOINT_SPEED_KM_S&&maximumStationSpeedKmS<MAX_ENDPOINT_SPEED_KM_S,maximumSpacecraftSpeedKmS,maximumStationSpeedKmS});if(Object.isFrozen(solution)&&Object.isFrozen(solution.trajectory))speedCertificates.set(solution,result);return result;}
export interface AttitudeInterval {start:number;end:number;startQ:Quaternion;midQ:Quaternion;endQ:Quaternion;receiverPowered:boolean;transmitterPowered:boolean}
export interface GuardResult {valid:boolean;reasonCode:OperationsReasonCode|null;minimumMarginDb:number;minimumClearFraction:number}
const invalid=(reasonCode:OperationsReasonCode):GuardResult=>({valid:false,reasonCode,minimumMarginDb:-120,minimumClearFraction:0});
export function intervalAttitude(interval:AttitudeInterval,time:number):Quaternion {const mid=(interval.start+interval.end)/2,left=time<=mid,a=left?interval.startQ:interval.midQ,b=left?interval.midQ:interval.endQ,duration=(interval.end-interval.start)/2,f=duration?Math.max(0,Math.min(1,(time-(left?interval.start:mid))/duration)):1;return slewQuaternion(a,b,quaternionAngleDeg(a,b)*f);}
function attitudeRate(interval:AttitudeInterval){const half=(interval.end-interval.start)/2;return half?Math.max(quaternionAngleDeg(interval.startQ,interval.midQ),quaternionAngleDeg(interval.midQ,interval.endQ))/half:0;}
function bodyDirection(v:Vec3,q:Quaternion):Vec3 {const b=quaternionToBasis(q);return [dot(v,b.x),dot(v,b.y),dot(v,b.z)];}
function rayBox(o:Vec3,d:Vec3,center:Vec3,half:Vec3){let near=-Infinity,far=Infinity;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-12){if(Math.abs(o[k]-center[k])>half[k])return false;}else{const a=(center[k]-half[k]-o[k])/d[k],b=(center[k]+half[k]-o[k])/d[k];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));}}return far>=Math.max(near,.002)&&far>.002;}
/** Lower bound for the *same* weighted aperture rays used by the visual/physical
 * model over a cone of directions. Inflating each OBB by Dmax·|delta direction|
 * certifies that a central miss stays a miss; uncertainty never creates visibility. */
export function apertureConeLowerBound(craft:Design,part:Part,direction:Vec3,coneDeg:number):number {
 const delta=2*Math.sin(Math.min(180,Math.max(0,coneDeg))*Math.PI/360),samples=visibilitySamples(craft,part,direction,-1),bus=getBusDefinition(craft);
 const misses=(o:Vec3,d:Vec3,c:Vec3,h:Vec3)=>{const expansion=(magnitude(sub(c,o))+magnitude(h))*delta;return !rayBox(o,d,c,[h[0]+expansion,h[1]+expansion,h[2]+expansion]);};
 return samples.reduce((sum,s)=>{if(!s.clear||!misses(s.origin,direction,[0,0,0],[...bus.halfSize]))return sum;for(const other of craft.parts){if(other.id===part.id||getPartDefinition(craft,other).internal)continue;const tr=partTransformFor(craft,other),offset=sub(s.origin,tr.position),o:Vec3=[dot(offset,tr.tangentU),dot(offset,tr.tangentV),dot(offset,tr.normal)],d:Vec3=[dot(direction,tr.tangentU),dot(direction,tr.tangentV),dot(direction,tr.normal)];if(getPartGeometry(craft,other).deployedBoxes.some(box=>!misses(o,d,box.center,box.half)))return sum;}return sum+(s.weight??1/samples.length);},0);
}
function geometryCertified(state:OperationsRuntimeState,stationId:string,bit:SignalBitEndpoint,halfSeconds:number,direction:'uplink'|'ack'){
 if(!trajectorySpeedCertificate(state.solution).certified)return {valid:false,uncertain:false,reason:'INTERVAL_UNCERTAIN' as OperationsReasonCode};const geometry=signalGeometry(state.solution,stationId,bit,direction);if(!geometry.valid)return {valid:false,uncertain:false,reason:geometry.reasonCode??'INTERVAL_UNCERTAIN' as OperationsReasonCode};
 const spacecraft=transferStateAt(state.solution,direction==='uplink'?bit.arrivesAtSeconds:bit.emittedAtSeconds);if(magnitude(spacecraft.heliocentricVelocityKmS)>MAX_ENDPOINT_SPEED_KM_S)return {valid:false,uncertain:false,reason:'INTERVAL_UNCERTAIN' as OperationsReasonCode};
 const movement=2*MAX_ENDPOINT_SPEED_KM_S*RETARDED_RATE_BOUND*halfSeconds,minRange=Math.max(1,geometry.rangeKm-movement),losAngle=2*Math.asin(Math.min(1,movement/minRange))*RAD;
 const stationAngle=7.4e-5*RETARDED_RATE_BOUND*halfSeconds*RAD;
 const valid=geometry.elevationDeg-N.minimumElevationDeg>losAngle+stationAngle&&geometry.solarSeparationDeg-N.solarExclusionDeg>losAngle+stationAngle&&geometry.sunClearanceKm>movement&&geometry.marsClearanceKm-geometry.marsUncertaintyKm>movement+40*RETARDED_RATE_BOUND*halfSeconds;
 return {valid,uncertain:!valid,reason:'INTERVAL_UNCERTAIN' as OperationsReasonCode};
}
function recursiveInterval(start:number,end:number,evaluate:(mid:number,half:number)=>GuardResult&{uncertain?:boolean}):GuardResult {
 const result=evaluate((start+end)/2,(end-start)/2);if(result.valid||!result.uncertain)return result;if(end-start<=N.minimumGuardIntervalSeconds)return invalid('INTERVAL_UNCERTAIN');const mid=(start+end)/2,a=recursiveInterval(start,mid,evaluate);if(!a.valid)return a;const b=recursiveInterval(mid,end,evaluate);return {valid:b.valid,reasonCode:b.reasonCode,minimumMarginDb:Math.min(a.minimumMarginDb,b.minimumMarginDb),minimumClearFraction:Math.min(a.minimumClearFraction,b.minimumClearFraction)};
}
export function guardGroundEmission(state:OperationsRuntimeState,stationId:string,start:number,end:number,eirpDbW:number):GuardResult {
 return recursiveInterval(start,end,(mid,half)=>{try{const bit=commandBitAt(state.solution,stationId,mid),g=geometryCertified(state,stationId,bit,half,'uplink');if(!g.valid)return {...invalid(g.reason),uncertain:g.uncertain};const range=magnitude(sub(bit.receiverPositionKm,bit.emitterPositionKm)),delta=2*MAX_ENDPOINT_SPEED_KM_S*RETARDED_RATE_BOUND*half,far=uplinkBudget(range+delta,0,1,eirpDbW),near=uplinkBudget(Math.max(1,range-delta),0,1,eirpDbW);return {valid:far.valid&&near.valid,reasonCode:far.valid&&near.valid?null:'RX_LEVEL_OUTSIDE_MODEL',minimumMarginDb:far.marginDb,minimumClearFraction:1};}catch(error){if(error instanceof OperationsError)return invalid(error.code);throw error;}});
}
export function guardCommandReception(state:OperationsRuntimeState,stationId:string,start:number,end:number,eirpDbW:number,interval:AttitudeInterval):GuardResult {
 if(!interval.receiverPowered)return invalid('RECEIVER_OFF');const hardware=resolveHardware(state.craft),antenna=hardware.parts.find(p=>p.part.id===hardware.antennaId);if(!antenna)return invalid('COMMAND_ANTENNA_REQUIRED');const rate=attitudeRate(interval);
 return recursiveInterval(start,end,(mid,half)=>{try{const receiver=transferStateAt(state.solution,mid).heliocentricPositionKm,bit=solveRetardedEmission(mid,receiver,t=>stationStateAt(state.solution,stationId,t).positionKm),g=geometryCertified(state,stationId,bit,half,'uplink');if(!g.valid)return {...invalid(g.reason),uncertain:g.uncertain};const range=magnitude(sub(bit.emitterPositionKm,receiver)),movement=2*MAX_ENDPOINT_SPEED_KM_S*RETARDED_RATE_BOUND*half,cone=rate*half+2*Math.asin(Math.min(1,movement/Math.max(1,range-movement)))*RAD,dir=bodyDirection(normalize(sub(bit.emitterPositionKm,receiver)),intervalAttitude(interval,mid)),angle=Math.acos(Math.max(-1,Math.min(1,dot(partTransformFor(state.craft,antenna.part).normal,dir))))*RAD,clear=apertureConeLowerBound(state.craft,antenna.part,dir,cone),worst=uplinkBudget(range+movement,Math.min(180,angle+cone),clear,eirpDbW),upper=uplinkBudget(Math.max(1,range-movement),Math.max(0,angle-cone),1,eirpDbW);
 if(worst.valid&&upper.receiverPowerDbm<=N.receiveTrackingMaximumDbm)return {valid:true,reasonCode:null,minimumMarginDb:worst.marginDb,minimumClearFraction:clear};const exact=uplinkBudget(range,angle,visibilitySamples(state.craft,antenna.part,dir).reduce((s,p)=>s+(p.clear?(p.weight??0):0),0),eirpDbW);if(!exact.valid)return invalid(!exact.clear?'ANTENNA_BLOCKED':!exact.tracking?'RX_LEVEL_OUTSIDE_MODEL':'UPLINK_MARGIN');return {...invalid('INTERVAL_UNCERTAIN'),uncertain:true};}catch(error){if(error instanceof OperationsError)return invalid(error.code);throw error;}});
}
export function guardAckEmission(state:OperationsRuntimeState,stationId:string,start:number,end:number,rateBps:number,interval:AttitudeInterval):GuardResult {
 if(!interval.transmitterPowered)return invalid('TRANSMISSION_INTERRUPTED');const h=resolveHardware(state.craft),antenna=h.parts.find(p=>p.part.id===h.antennaId);if(!antenna)return invalid('COMMAND_ANTENNA_REQUIRED');const rate=attitudeRate(interval);
 return recursiveInterval(start,end,(mid,half)=>{try{const bit=ackBitAt(state.solution,stationId,mid),g=geometryCertified(state,stationId,bit,half,'ack');if(!g.valid)return {...invalid(g.reason),uncertain:g.uncertain};const range=magnitude(sub(bit.receiverPositionKm,bit.emitterPositionKm)),movement=2*MAX_ENDPOINT_SPEED_KM_S*RETARDED_RATE_BOUND*half,cone=rate*half+2*Math.asin(Math.min(1,movement/Math.max(1,range-movement)))*RAD,dir=bodyDirection(normalize(sub(bit.receiverPositionKm,bit.emitterPositionKm)),intervalAttitude(interval,mid)),tr=partTransformFor(state.craft,antenna.part),angle=Math.acos(Math.max(-1,Math.min(1,dot(tr.normal,dir))))*RAD,clear=apertureConeLowerBound(state.craft,antenna.part,dir,cone),link=hardwareLink(state.craft,range+movement,dir,true),extraLoss=3*((angle+cone)**2-angle**2)/(antenna.definition.antenna!.halfPowerAngleDeg**2);
 if(clear>=N.minimumClearFraction&&link.rateBps>=rateBps&&link.marginDb-extraLoss>=0)return {valid:true,reasonCode:null,minimumMarginDb:link.marginDb-extraLoss,minimumClearFraction:clear};const actual=hardwareLink(state.craft,range,dir,true);if(actual.rateBps<rateBps||actual.marginDb<0)return invalid('POINTING_LOSS');return {...invalid('INTERVAL_UNCERTAIN'),uncertain:true};}catch(error){if(error instanceof OperationsError)return invalid(error.code);throw error;}});
}
