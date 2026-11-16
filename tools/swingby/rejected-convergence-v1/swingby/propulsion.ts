import {getBusDefinition,getPartDefinition,partTransformFor,resolveHardware} from '../hardware';
import {add,cross,dot,magnitude,normalize,scale,sub} from '../sim/physics';
import {quaternionAngleDeg,quaternionToBasis,slewQuaternion} from '../sim/attitude';
import type {Design,Quaternion,Vec3} from '../sim/types';
import type {BodyAxes} from '../sim/attitude';
import {SWINGBY_PROPULSION as P} from './scenario';
import {SwingbyError} from './conic';
const angle=(a:Vec3,b:Vec3)=>Math.atan2(magnitude(cross(a,b)),dot(a,b))*180/Math.PI;
export function swingbyEngine(craft:Design){const h=resolveHardware(craft),installed=h.parts.filter(p=>p.part.kind==='engine');return installed.length===1&&installed[0].definition.modelId===P.engineModelId&&installed[0].powered&&installed[0].dataConnected?installed[0]:null;}
export function swingbyMassProperties(craft:Design,fuelKg:number){
 const h=resolveHardware(craft),bus=h.bus;if(!Number.isFinite(fuelKg)||fuelKg<0||fuelKg>bus.fuelKg)throw new SwingbyError('FUEL_RANGE');
 const engine=swingbyEngine(craft),tr=engine?partTransformFor(craft,engine.part):null,centroid=tr?add(tr.position,add(add(scale(tr.tangentU,P.geometry.annulus.center[0]),scale(tr.tangentV,P.geometry.annulus.center[1])),scale(tr.normal,P.geometry.annulus.center[2]))):[0,0,0] as Vec3,carrierMassKg=tr?P.carrierMassKg:0;
 const fullMass=bus.massKg+bus.fuelKg+h.parts.reduce((sum,p)=>sum+p.definition.massKg,0),massKg=fullMass-bus.fuelKg+fuelKg+carrierMassKg,centerOfMassM=scale(add(scale(h.centerOfMassM,fullMass),scale(centroid,carrierMassKg)),1/massKg),inertiaKgM2:Vec3=[...h.inertiaKgM2];
 const a=P.geometry.annulus,principal:Vec3=[carrierMassKg/12*(3*(a.outerRadiusM**2+a.innerRadiusM**2)+a.thicknessM**2),carrierMassKg/12*(3*(a.outerRadiusM**2+a.innerRadiusM**2)+a.thicknessM**2),carrierMassKg*.5*(a.outerRadiusM**2+a.innerRadiusM**2)],axes=tr?[tr.tangentU,tr.tangentV,tr.normal]:[[1,0,0],[0,1,0],[0,0,1]];
 // Translate the released full-tank proxy inertia to the origin, replace the
 // centered fuel cube, add the authored carrier, then translate to actual CG.
 for(let i=0;i<3;i++){const j=(i+1)%3,k=(i+2)%3;inertiaKgM2[i]+=fullMass*(h.centerOfMassM[j]**2+h.centerOfMassM[k]**2)+(fuelKg-bus.fuelKg)*(.15**2+.15**2)/3+principal.reduce((sum,I,n)=>sum+I*axes[n][i]**2,0)+carrierMassKg*(centroid[j]**2+centroid[k]**2)-massKg*(centerOfMassM[j]**2+centerOfMassM[k]**2);}
 return {massKg,dryMassKg:massKg-fuelKg,centerOfMassM,inertiaKgM2,carrierCentroidM:centroid,carrierMassKg};
}
export function swingbyThrustGeometry(craft:Design,fuelKg:number){
 const engine=swingbyEngine(craft),mass=swingbyMassProperties(craft,fuelKg);if(!engine)return {...mass,enginePartId:null,pivotM:[0,0,0] as Vec3,nominalThrustBody:[0,1,0] as Vec3,thrustDirectionBody:[0,1,0] as Vec3,gimbalAngleDeg:180};
 const tr=partTransformFor(craft,engine.part),p=P.geometry.pivot,pivotM=add(tr.position,add(add(scale(tr.tangentU,p[0]),scale(tr.tangentV,p[1])),scale(tr.normal,p[2]))),nominalThrustBody=scale(tr.normal,-1),thrustDirectionBody=normalize(sub(mass.centerOfMassM,pivotM));
 return {...mass,enginePartId:engine.part.id,pivotM,nominalThrustBody,thrustDirectionBody,gimbalAngleDeg:angle(nominalThrustBody,thrustDirectionBody)};
}
export function swingbyBurnAxes(craft:Design,fuelKg:number,deltaVMps:Vec3,sunDirection:Vec3):BodyAxes {
 const t=swingbyThrustGeometry(craft,fuelKg).thrustDirectionBody,w=normalize(deltaVMps);let a=sub([1,0,0],scale(t,t[0])),A=sub(sunDirection,scale(w,dot(sunDirection,w)));
 if(magnitude(a)<1e-8)a=sub([0,0,1],scale(t,t[2]));if(magnitude(A)<1e-8)A=cross(w,Math.abs(w[1])<.9?[0,1,0]:[1,0,0]);a=normalize(a);A=normalize(A);const b=cross(t,a),B=cross(w,A),column=(i:number)=>add(add(scale(A,a[i]),scale(B,b[i])),scale(w,t[i]));return {x:column(0),y:column(1),z:column(2)};
}
export function swingbyActualThrust(craft:Design,fuelKg:number,q:Quaternion):Vec3 {const t=swingbyThrustGeometry(craft,fuelKg).thrustDirectionBody,b=quaternionToBasis(q);return normalize(add(add(scale(b.x,t[0]),scale(b.y,t[1])),scale(b.z,t[2])));}
export function swingbySlew(craft:Design,fuelKg:number,from:Quaternion,to:Quaternion,dt:number,initialRateDegS=0){
 const h=resolveHardware(craft),adcs=h.parts.find(p=>p.part.id===h.adcsId)?.definition.adcs,I=Math.max(...swingbyMassProperties(craft,fuelKg).inertiaKgM2,.001),acceleration=adcs?adcs.torqueNm/I*180/Math.PI:0,maximumRate=adcs?adcs.momentumNms/I*180/Math.PI:0,remaining=quaternionAngleDeg(from,to);
 if(remaining<1e-9)return {quaternion:[...to] as Quaternion,rateDegS:0};if(dt<=0||acceleration<=0)return {quaternion:[...from] as Quaternion,rateDegS:0};const targetRate=Math.min(maximumRate,Math.sqrt(2*acceleration*remaining)),rate=initialRateDegS<targetRate?Math.min(targetRate,initialRateDegS+acceleration*dt):Math.max(targetRate,initialRateDegS-acceleration*dt),step=Math.min(remaining,(initialRateDegS+rate)*.5*dt);return {quaternion:slewQuaternion(from,to,step),rateDegS:step>=remaining-1e-9?0:rate};
}
export function swingbyFuelUsed(craft:Design,fuelKg:number,deltaVMps:number){const engine=swingbyEngine(craft);if(!engine||!Number.isFinite(deltaVMps)||deltaVMps<0)throw new SwingbyError('PROPULSION_UNAVAILABLE');return swingbyMassProperties(craft,fuelKg).massKg*(1-Math.exp(-deltaVMps/(9.80665*getPartDefinition(craft,engine.part).ispS!)));}
