import {add,cross,dot,magnitude,normalize,scale,sub} from '../sim/physics';
import type {OrbitalState,Vec3} from '../sim/types';
import {hyperbolicLocalStateAt} from '../transfer/math';
import {freezeTransferInput} from '../transfer/immutable';
import type {LocalArc} from './types';
export const SWINGBY_MARS_MU=42828.375214,SWINGBY_MARS_RADIUS_KM=3389.5;
export class SwingbyError extends Error {constructor(public readonly code:string,message=code){super(message);this.name='SwingbyError';}}
function finiteVector(v:Vec3){return Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);}
/** Bounded positive-energy osculating hyperbola. No universal-variable fallback. */
export function localArcFromCartesian(state:OrbitalState,epochSeconds=0,muKm3S2=SWINGBY_MARS_MU):LocalArc {
 if(!finiteVector(state.positionKm)||!finiteVector(state.velocityKmS)||!Number.isFinite(epochSeconds)||!Number.isFinite(muKm3S2)||muKm3S2<=0)throw new SwingbyError('INVALID_STATE');
 const r=magnitude(state.positionKm),v2=dot(state.velocityKmS,state.velocityKmS),h=cross(state.positionKm,state.velocityKmS),h2=dot(h,h);
 if(r<1||r>1e8||h2<1e-12||v2>90000)throw new SwingbyError('UNSUPPORTED_CONIC');
 const ev=sub(scale(cross(state.velocityKmS,h),1/muKm3S2),scale(state.positionKm,1/r)),eccentricity=magnitude(ev),energy=v2/2-muKm3S2/r;
 if(eccentricity<=1.000001||energy<=0)throw new SwingbyError('UNSUPPORTED_CONIC');
 const a=muKm3S2/(2*energy),rp=h2/(muKm3S2*(1+eccentricity)),p=normalize(ev),q=cross(normalize(h),p),periapsis={positionKm:scale(p,rp),velocityKmS:scale(q,Math.sqrt(muKm3S2*(1+eccentricity)/rp))},sinhH=dot(state.positionKm,state.velocityKmS)/(eccentricity*Math.sqrt(muKm3S2*a)),elapsed=(eccentricity*sinhH-Math.asinh(sinhH))*Math.sqrt(a*a*a/muKm3S2);
 const arc:LocalArc={version:1,muKm3S2,epochSeconds,elapsedAtEpochSeconds:elapsed,periapsis,eccentricity,semiMajorMagnitudeKm:a,periapsisRadiusKm:rp},check=localArcStateAt(arc,epochSeconds);
 if(magnitude(sub(check.positionKm,state.positionKm))>1e-5||magnitude(sub(check.velocityKmS,state.velocityKmS))>1e-8)throw new SwingbyError('CONIC_RECONSTRUCTION');
 return freezeTransferInput(arc);
}
export function localArcStateAt(arc:LocalArc,time:number):OrbitalState {
 if(!Number.isFinite(time)||Math.abs(time-arc.epochSeconds)>7*86400)throw new SwingbyError('TIME_OUTSIDE_MODEL');
 const elapsed=arc.elapsedAtEpochSeconds+time-arc.epochSeconds,state=hyperbolicLocalStateAt(arc.periapsis,arc.muKm3S2,elapsed);
 if(!finiteVector(state.positionKm)||!finiteVector(state.velocityKmS))throw new SwingbyError('CONIC_NONFINITE');return state;
}
export const localArcPeriapsisTime=(arc:LocalArc)=>arc.epochSeconds-arc.elapsedAtEpochSeconds;
export function localArcRadiusTime(arc:LocalArc,radiusKm:number,direction:'inbound'|'outbound'):number {
 if(!Number.isFinite(radiusKm)||radiusKm<arc.periapsisRadiusKm||!['inbound','outbound'].includes(direction))throw new SwingbyError('NO_RADIUS_CROSSING');
 const H=Math.acosh((radiusKm/arc.semiMajorMagnitudeKm+1)/arc.eccentricity),dt=(arc.eccentricity*Math.sinh(H)-H)*Math.sqrt(arc.semiMajorMagnitudeKm**3/arc.muKm3S2);
 return localArcPeriapsisTime(arc)+(direction==='outbound'?dt:-dt);
}
export function applyLocalImpulse(arc:LocalArc,time:number,deltaVICRFMps:Vec3):LocalArc {
 if(!finiteVector(deltaVICRFMps)||magnitude(deltaVICRFMps)>100)throw new SwingbyError('INVALID_IMPULSE');
 const before=localArcStateAt(arc,time);return localArcFromCartesian({positionKm:before.positionKm,velocityKmS:add(before.velocityKmS,scale(deltaVICRFMps,.001))},time,arc.muKm3S2);
}
