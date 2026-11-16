import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

/** Camera presentation state only. No attitude or trajectory is inferred. */
export interface OrbitalCameraReference {
 sourceKey:string;timeSeconds:number;radial:THREE.Vector3;
}
const finite=(v:THREE.Vector3)=>v.toArray().every(Number.isFinite)&&Number.isFinite(v.lengthSq())&&v.lengthSq()>1e-20;

/** Minimal radial rotation; exact antipodes use a stable perpendicular axis. */
export function radialTransport(from:THREE.Vector3,to:THREE.Vector3):THREE.Quaternion {
 if(!finite(from)||!finite(to))throw new Error('Invalid orbital camera radial vector.');
 const a=from.clone().normalize(),b=to.clone().normalize();
 const axis=new THREE.Vector3().crossVectors(a,b),sine=axis.length(),cosine=THREE.MathUtils.clamp(a.dot(b),-1,1);
 // atan2 retains the small residual direction near 180 degrees. The usual
 // setFromUnitVectors epsilon intentionally snaps that neighbourhood.
 if(sine>1e-14)return new THREE.Quaternion().setFromAxisAngle(axis.multiplyScalar(1/sine),Math.atan2(sine,cosine));
 if(cosine>=0)return new THREE.Quaternion();
 const aligned=[Math.abs(a.x),Math.abs(a.y),Math.abs(a.z)],index=aligned.indexOf(Math.min(...aligned)),basis=new THREE.Vector3().setComponent(index,1);
 return new THREE.Quaternion().setFromAxisAngle(axis.crossVectors(a,basis).normalize(),Math.PI);
}

export class OrbitalInspectionFollow {
 private reference:OrbitalCameraReference|null=null;
 capture():OrbitalCameraReference|null {const r=this.reference;return r?{...r,radial:r.radial.clone()}:null;}
 restore(reference:OrbitalCameraReference|null){this.reference=reference?{...reference,radial:reference.radial.clone()}:null;}
 reset(){this.reference=null;}
 advance(sourceKey:string,timeSeconds:number,radial:THREE.Vector3):THREE.Quaternion|null {
  if(!sourceKey||!Number.isFinite(timeSeconds)||!finite(radial))throw new Error('Invalid orbital camera reference.');
  const next={sourceKey,timeSeconds,radial:radial.clone().normalize()},previous=this.reference;
  if(previous?.sourceKey===sourceKey&&previous.timeSeconds===timeSeconds&&previous.radial.distanceToSquared(next.radial)<1e-28)return null;
  this.reference=next;
  if(!previous||previous.sourceKey!==sourceKey||timeSeconds<previous.timeSeconds)return null;
  return radialTransport(previous.radial,next.radial);
 }
}

/** Three r182 stores this basis once, although camera.up may later change.
 * Synchronize only the two cached quaternions. Pointer state, damping deltas,
 * zoom and listeners stay owned by the existing controls instance. The local
 * installed implementation/version is exercised by the adapter regression. */
export function synchronizeOrbitUp(controls:OrbitControls,camera:THREE.Camera){
 const cache=controls as unknown as {_quat:THREE.Quaternion;_quatInverse:THREE.Quaternion};
 if(!cache._quat?.isQuaternion||!cache._quatInverse?.isQuaternion||!finite(camera.up))throw new Error('Unsupported OrbitControls up-vector cache.');
 camera.up.normalize();cache._quat.copy(radialTransport(camera.up,new THREE.Vector3(0,1,0)));cache._quatInverse.copy(cache._quat).invert();
}

export function transportInspectionView(camera:THREE.PerspectiveCamera,controls:OrbitControls,rotation:THREE.Quaternion){
 const offset=camera.position.clone().sub(controls.target).applyQuaternion(rotation);
 camera.position.copy(controls.target).add(offset);camera.up.applyQuaternion(rotation).normalize();
 synchronizeOrbitUp(controls,camera);camera.lookAt(controls.target);
}
