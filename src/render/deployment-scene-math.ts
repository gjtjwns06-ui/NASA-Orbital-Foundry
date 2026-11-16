import * as THREE from 'three';
import type {DeploymentGeometryView,MechanismTopology,Quaternion,Vec3} from '../deployment/types';
import type {DeploymentCraftView,DeploymentMountPlane,DeploymentPreviewView,DeploymentSceneSnapshot} from './deployment-scene-types';
import {inspectionFit} from './craft-camera';
import type {DeploymentViewport} from './deployment-scene-types';

/** Coordinate-display rotation only: EarthMJ2000Eq (x,y,z) -> Three (x,z,-y). */
export const DEPLOYMENT_DISPLAY_FRAME=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
export const deploymentVector=(v:Vec3)=>new THREE.Vector3(v[0],v[2],-v[1]);
const finite=(a:unknown,n:number):a is number[]=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
const unit=(v:Vec3)=>finite(v,3)&&Math.abs(Math.hypot(...v)-1)<1e-6;
const unitQ=(q:Quaternion)=>finite(q,4)&&Math.abs(Math.hypot(...q)-1)<1e-6;

/** First-entry camera composition only. At low Earth altitude the real planet
 * is larger than the usable field of view: aim near its limb, never shrink or
 * relocate it. Subsequent player orbit is preserved by CraftInspectionCamera. */
export function deploymentLimbDirection(position:THREE.Vector3,radius:number,width:number,height:number,fov:number,viewport:DeploymentViewport){
 const fit=inspectionFit(width,height,fov,viewport),distance=position.length();if(!Number.isFinite(radius)||radius<=0||distance<=radius)throw new Error('Actual craft must be outside the displayed Earth.');
 const radial=position.clone().normalize(),tangent=new THREE.Vector3(0,1,0).addScaledVector(radial,-radial.y);if(tangent.lengthSq()<1e-8)tangent.set(0,0,1).addScaledVector(radial,-radial.z);tangent.normalize();
 const angularRadius=Math.asin(radius/distance),halfFov=Math.atan(Math.tan(fov*Math.PI/360)*Math.min(fit.availableWidth,fit.availableHeight)/height),offset=angularRadius>halfFov*1.5?angularRadius-halfFov*.55:Math.min(8*Math.PI/180,angularRadius*.35);
 return {direction:radial.multiplyScalar(Math.cos(offset)).addScaledVector(tangent,Math.sin(offset)),angularRadius,halfFov,offset};
}

export function validateDeploymentSnapshot(s:DeploymentSceneSnapshot,sourceId:string){
 if(!s||s.sourceId!==sourceId||s.frame!=='EarthMJ2000Eq'||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} TAI$/.test(s.epochTai)||!Number.isFinite(s.timeSeconds)||s.timeSeconds<0||!unitQ(s.attitudeQuaternion)||!finite(s.environment.positionKm,3)||!unit(s.environment.sunDirection)||!Number.isFinite(s.environment.earthRotationRad)||!finite(s.geometry.mass.centerOfMassM,3))throw new Error('Invalid or mismatched committed commissioning snapshot.');
 const ids=new Set<string>();for(const state of s.mechanisms){if(ids.has(state.partId)||!s.geometry.links.some(l=>l.partId===state.partId)||!Number.isFinite(state.motorEnergyJ)||state.motorEnergyJ<0)throw new Error('Invalid actual mechanism metadata.');ids.add(state.partId);}
 if(typeof s.environment.eclipse!=='boolean'||s.environment.ground.some(g=>!g.id||!finite(g.positionKm,3)||typeof g.visible!=='boolean'))throw new Error('Invalid commissioning environment.');
 let previous=-Infinity;for(const p of s.actualHistory??[]){if(!Number.isFinite(p.timeSeconds)||p.timeSeconds<previous||p.timeSeconds>s.timeSeconds+1e-8||!finite(p.positionKm,3))throw new Error('Actual history contains future or invalid positions.');previous=p.timeSeconds;}
}
export function physicalStructuralOrigin(snapshot:Pick<DeploymentSceneSnapshot,'attitudeQuaternion'|'environment'|'geometry'>):Vec3{
 const offset=new THREE.Vector3(...snapshot.geometry.mass.centerOfMassM).applyQuaternion(new THREE.Quaternion(...snapshot.attitudeQuaternion)).multiplyScalar(.001);
 return new THREE.Vector3(...snapshot.environment.positionKm).sub(offset).toArray() as Vec3;
}
export function deploymentBounds(geometry:DeploymentGeometryView,partId?:string){
 const result=new THREE.Box3(),solids:THREE.Box3[]=[];
 for(const box of geometry.boxes){if(partId&&box.partId!==partId)continue;const bounds=new THREE.Box3();for(let mask=0;mask<8;mask++){const p=new THREE.Vector3(...box.centerM);for(let axis=0;axis<3;axis++)p.addScaledVector(new THREE.Vector3(...box.axes[axis]),(mask&(1<<axis)?1:-1)*box.halfM[axis]);bounds.expandByPoint(p);}result.union(bounds);solids.push(bounds);}
 return {bounds:result,solids};
}
export function validateMountPlanes(craft:DeploymentCraftView){
 const keys=new Set<string>(),parts=new Map(craft.partMounts.map(p=>[p.partId,p]));if(parts.size!==craft.partMounts.length)throw new Error('Duplicate mounted part.');
 for(const p of craft.partMounts)if(!p.partId||![p.u,p.v,p.rotation].every(Number.isFinite)||!p.allowedFaces.includes(p.face)||!craft.topology.links.some(l=>l.partId===p.partId))throw new Error('Invalid mounted part.');
 for(const p of craft.mountPlanes){const key=p.partId+'|'+p.face;if(keys.has(key)||!parts.get(p.partId)?.allowedFaces.includes(p.face)||!finite(p.originBodyM,3)||![p.normalBody,p.axisUBody,p.axisVBody].every(unit)||![p.minimumU,p.maximumU,p.minimumV,p.maximumV].every(Number.isFinite)||p.minimumU>=p.maximumU||p.minimumV>=p.maximumV)throw new Error('Invalid part-specific mount plane.');const n=new THREE.Vector3(...p.normalBody),u=new THREE.Vector3(...p.axisUBody),v=new THREE.Vector3(...p.axisVBody);if(Math.abs(n.dot(u))>1e-6||Math.abs(n.dot(v))>1e-6||u.clone().cross(v).distanceTo(n)>1e-6)throw new Error('Mount axes must be a right-handed orthonormal frame.');keys.add(key);}
 for(const p of craft.partMounts)for(const face of p.allowedFaces)if(!keys.has(p.partId+'|'+face))throw new Error('Missing allowed part-specific mount plane.');
}
export interface DeploymentMountGrab {face:DeploymentMountPlane['face'];offsetU:number;offsetV:number}
/** Preserve where the pointer grabbed a protruding part, rather than snapping
 * its mounting origin to the projected proxy centre. The initial ray may land
 * beyond the mounting limits; the adjusted candidate must still be within them. */
export function deploymentMountGrab(ray:THREE.Ray,bodyMatrix:THREE.Matrix4,plane:DeploymentMountPlane,mount:{u:number;v:number}):DeploymentMountGrab|null{
 const local=ray.clone().applyMatrix4(bodyMatrix.clone().invert()),n=new THREE.Vector3(...plane.normalBody),origin=new THREE.Vector3(...plane.originBodyM);if(local.direction.dot(n)>=-.04)return null;const point=local.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n,origin),new THREE.Vector3());if(!point)return null;const relative=point.sub(origin);return {face:plane.face,offsetU:mount.u-relative.dot(new THREE.Vector3(...plane.axisUBody)),offsetV:mount.v-relative.dot(new THREE.Vector3(...plane.axisVBody))};
}
/** Exact supplied plane intersection. The original face keeps its grab offset;
 * crossing to another declared face uses that face's explicit coordinates. */
export function deploymentMountRay(ray:THREE.Ray,bodyMatrix:THREE.Matrix4,partId:string,planes:readonly DeploymentMountPlane[],grab?:DeploymentMountGrab|null){
 const local=ray.clone().applyMatrix4(bodyMatrix.clone().invert());let nearest:{plane:DeploymentMountPlane;u:number;v:number;bodyPoint:THREE.Vector3;distance:number}|null=null;
 for(const plane of planes){if(plane.partId!==partId)continue;const n=new THREE.Vector3(...plane.normalBody);if(local.direction.dot(n)>=-.04)continue;const origin=new THREE.Vector3(...plane.originBodyM),hit=local.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n,origin),new THREE.Vector3());if(!hit)continue;const relative=hit.clone().sub(origin),u=relative.dot(new THREE.Vector3(...plane.axisUBody))+(grab?.face===plane.face?grab.offsetU:0),v=relative.dot(new THREE.Vector3(...plane.axisVBody))+(grab?.face===plane.face?grab.offsetV:0);if(u<plane.minimumU||u>plane.maximumU||v<plane.minimumV||v>plane.maximumV)continue;const distance=hit.distanceTo(local.origin),bodyPoint=origin.clone().addScaledVector(new THREE.Vector3(...plane.axisUBody),u).addScaledVector(new THREE.Vector3(...plane.axisVBody),v);if(!nearest||distance<nearest.distance)nearest={plane,u,v,bodyPoint,distance};}
 return nearest;
}
export function validateWitnessPreview(preview:DeploymentPreviewView){
 if(preview.kind!=='clearance-witness')return;const report=preview.report,witness=report?.firstWitness??report?.firstUncertainWitness;if(!report||!witness||!Number.isFinite(witness.sampleAngleRad)||Math.abs((preview.geometry.joints[witness.jointId]?.angleRad??Infinity)-witness.sampleAngleRad)>1e-8)throw new Error('Clearance outlines require the actual sampled witness pose.');
 for(const item of[witness.a,witness.b])if(!preview.geometry.boxes.some(b=>b.linkId===item.linkId&&b.id===item.boxId))throw new Error('Unknown clearance witness box.');
}
export function changedMountBoxes(actual:MechanismTopology,candidate:MechanismTopology){
 const before=new Map(actual.links.flatMap(l=>l.boxes.map(b=>[l.id+'|'+b.id,JSON.stringify(b)] as const)));
 return candidate.links.filter(l=>l.partId==='bus').flatMap(l=>l.boxes.filter(b=>before.get(l.id+'|'+b.id)!==JSON.stringify(b)).map(box=>({linkId:l.id,box})));
}
