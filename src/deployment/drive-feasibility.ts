import type {CompiledTopology} from './kinematics';
import type {ActuatorProfile} from './types';
import {DeploymentError,length} from './math';
export interface DriveFeasibility {
 jointId:string;profileId:string;certified:boolean;movingMassKg:number;movingRadiusBoundM:number;
 bodyRateBoundRadS:number;bodyAccelerationBoundRadS2:number;
 mechanicalPowerBoundW:number;availableMechanicalPowerW:number;
}
/** An intentionally loose, configuration-independent inertial-work bound for
 * the declared one-active-hinge, zero-external-torque model. Triangle bounds
 * cover every permitted joint angle; no sampled clearance is substituted.
 * Rotor momentum is bounded but its electrical efficiency is a separate ADCS
 * assumption. The drive reserves only20% of its authored DC power for useful
 * mechanical work; friction/damping/hold losses fit the remaining80%.
 * This is NOT a vendor torque-speed or qualification claim. */
export function certifyDriveFeasibility(topology:CompiledTopology,jointId:string,profile:ActuatorProfile,limits:{minimumBodyInertiaKgM2:number;wheelMomentumNormNms:number;wheelTorqueNormNm:number;inertialMomentumNormNms:number}):DriveFeasibility {
 const def=topology.definition,joint=def.joints.find(j=>j.id===jointId);if(!joint||!Number.isFinite(limits.minimumBodyInertiaKgM2)||limits.minimumBodyInertiaKgM2<=0||Object.values(limits).some(v=>!Number.isFinite(v)||v<0))throw new DeploymentError('INVALID_DRIVE_CERTIFICATE');
 const rootRadius=new Map<string,number>(),movingRadius=new Map<string,number>();for(const id of topology.linkOrder){const link=def.links.find(l=>l.id===id)!,incoming=def.joints.find(j=>j.childLinkId===id);if(incoming){rootRadius.set(id,rootRadius.get(incoming.parentLinkId)!+length(incoming.pivotParentM)+length(incoming.pivotChildM));if(id===joint.childLinkId)movingRadius.set(id,length(joint.pivotChildM));else if(movingRadius.has(incoming.parentLinkId))movingRadius.set(id,movingRadius.get(incoming.parentLinkId)!+length(incoming.pivotParentM)+length(incoming.pivotChildM));}else rootRadius.set(id,length(link.rootPose!.positionM));}
 let totalMass=0,originRadius=0,secondMomentBound=0,movingMass=0,hingeRadius=0,movingSpinInertia=0;for(const link of def.links)for(const m of link.massElements){const trace=m.inertiaKgM2[0]+m.inertiaKgM2[4]+m.inertiaKgM2[8],r=rootRadius.get(link.id)!+length(m.centerM);totalMass+=m.massKg;originRadius=Math.max(originRadius,r);secondMomentBound+=2*m.massKg*r*r+trace;if(movingRadius.has(link.id)){movingMass+=m.massKg;hingeRadius=Math.max(hingeRadius,movingRadius.get(link.id)!+length(m.centerM));movingSpinInertia+=trace;}}
 const w=profile.maximumRateRadS,a=Math.max(profile.accelerationRadS2,profile.brakeDecelerationRadS2),shapeH=4*movingMass*originRadius*hingeRadius*w+movingSpinInertia*w,Iprime=16*movingMass*originRadius*hingeRadius*w+2*movingSpinInertia*w,hprime=4*movingMass*originRadius*hingeRadius*(a+w*w)+movingSpinInertia*(a+2*w*w),omega=(limits.inertialMomentumNormNms+limits.wheelMomentumNormNms+shapeH)/limits.minimumBodyInertiaKgM2;
 // d(I*w+h+wheel)/dt + w×(I*w+h+wheel)=0 in body axes.
 const alpha=(omega*(secondMomentBound*omega+shapeH+limits.wheelMomentumNormNms)+Iprime*omega+hprime+limits.wheelTorqueNormNm)/limits.minimumBodyInertiaKgM2,comV=movingMass/totalMass*w*hingeRadius,comA=movingMass/totalMass*hingeRadius*(a+w*w),absoluteAcceleration=2*originRadius*(alpha+omega*omega)+2*omega*(w*hingeRadius+comV)+hingeRadius*(a+w*w)+comA,spinAcceleration=alpha+a+omega*w+(omega+w)**2,torque=movingMass*hingeRadius*absoluteAcceleration+movingSpinInertia*spinAcceleration,power=torque*w,available=profile.activePowerW*.2;
 return {jointId,profileId:profile.id,certified:power<=available,movingMassKg:movingMass,movingRadiusBoundM:hingeRadius,bodyRateBoundRadS:omega,bodyAccelerationBoundRadS2:alpha,mechanicalPowerBoundW:power,availableMechanicalPowerW:available};
}
