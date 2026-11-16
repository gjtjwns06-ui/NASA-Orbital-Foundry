import * as THREE from 'three';
import {inspectionFit,type InspectionViewport} from './craft-camera';

/** Camera composition only. The body and craft retain their actual positions,
 * radii and attitude. Supply this as initialDirection; the camera controller
 * preserves the user's existing orbit once inspection has entered. */
export function planetInspectionDirection(input:{
 craftPosition:THREE.Vector3;bodyCenter:THREE.Vector3;bodyRadius:number;shoulder:THREE.Vector3;
 width:number;height:number;fovDeg:number;insets:InspectionViewport;
}){
 const fit=inspectionFit(input.width,input.height,input.fovDeg,input.insets);
 const radial=input.craftPosition.clone().sub(input.bodyCenter),distance=radial.length();
 if(![...radial.toArray(),...input.shoulder.toArray(),input.bodyRadius].every(Number.isFinite)||input.bodyRadius<=0||distance<=input.bodyRadius)throw new Error('Inspection composition requires an actual exterior body-relative position.');
 radial.divideScalar(distance);
 const tangent=input.shoulder.clone().addScaledVector(radial,-input.shoulder.dot(radial));
 if(tangent.lengthSq()<1e-12)tangent.crossVectors(Math.abs(radial.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1),radial);
 tangent.normalize();
 const angularRadiusRad=Math.asin(input.bodyRadius/distance);
 const fovTangent=Math.tan(THREE.MathUtils.degToRad(input.fovDeg)/2);
 const usableHalfFovRad=Math.atan(Math.min(fovTangent*fit.availableHeight/input.height,fovTangent*fit.availableWidth/input.height));
 // Keep the planet centre well inside the central usable region. The offset
 // is restrained at distant approach and wide periapsis views alike; it never
 // enlarges a small planet or forces an orbit after pointer input.
 const tangentOffsetRad=Math.min(THREE.MathUtils.degToRad(8),angularRadiusRad*.4+THREE.MathUtils.degToRad(.8),usableHalfFovRad*.3);
 const direction=radial.multiplyScalar(Math.cos(tangentOffsetRad)).addScaledVector(tangent,Math.sin(tangentOffsetRad)).normalize();
 return {direction,angularRadiusRad,tangentOffsetRad,usableHalfFovRad};
}
