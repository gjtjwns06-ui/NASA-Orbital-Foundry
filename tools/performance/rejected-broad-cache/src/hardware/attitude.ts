import type {Design,Quaternion} from '../sim/types';
import {quaternionAngleDeg,slewQuaternion} from '../sim/attitude';
import {resolveHardware} from './resolve';
export function hardwareAttitudeLimits(design:Design){const r=resolveHardware(design),adcs=r.parts.find(p=>p.part.id===r.adcsId)?.definition.adcs,I=Math.max(...r.inertiaKgM2,.001);return {inertiaKgM2:I,accelerationDegS2:adcs?adcs.torqueNm/I*180/Math.PI:0,maximumRateDegS:adcs?adcs.momentumNms/I*180/Math.PI:0};}
/** Scalar largest-body-diagonal-inertia controller; published torque/momentum inputs,
 * authored control law. Not vendor flight software or disturbance/desaturation dynamics. */
export function hardwareSlewFromLimits(limits:ReturnType<typeof hardwareAttitudeLimits>,from:Quaternion,to:Quaternion,dt:number,initialRateDegS=0){const angle=quaternionAngleDeg(from,to);if(angle<1e-9)return {quaternion:[...to] as Quaternion,rateDegS:0};if(dt<=0||limits.accelerationDegS2<=0)return {quaternion:[...from] as Quaternion,rateDegS:0};const a=limits.accelerationDegS2,brakingRate=Math.sqrt(2*a*angle),targetRate=Math.min(limits.maximumRateDegS,brakingRate),rate=initialRateDegS<targetRate?Math.min(targetRate,initialRateDegS+a*dt):Math.max(targetRate,initialRateDegS-a*dt),step=Math.min(angle,(initialRateDegS+rate)*.5*dt);return {quaternion:slewQuaternion(from,to,step),rateDegS:step>=angle-1e-9?0:rate};}
export function hardwareSlew(design:Design,from:Quaternion,to:Quaternion,dt:number,initialRateDegS=0){return hardwareSlewFromLimits(hardwareAttitudeLimits(design),from,to,dt,initialRateDegS);}
export function hardwareSlewDuration(design:Design,angleDeg:number){const l=hardwareAttitudeLimits(design);if(!l.maximumRateDegS)return Infinity;return angleDeg/l.maximumRateDegS+l.maximumRateDegS/l.accelerationDegS2;}
