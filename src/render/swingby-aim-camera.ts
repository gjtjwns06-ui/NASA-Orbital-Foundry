import * as THREE from 'three';
import type {SwingbyAimPlane} from './swingby-objective';
import type {InspectionViewport} from './craft-camera';

/** Camera-only framing of the real fixed plane. The grid is ±halfSpanKm;
 * neither the physical plane nor the player's coordinates are transformed. */
export function swingbyAimCamera(plane:SwingbyAimPlane,aim:{xKm:number;yKm:number},options:{kmToScene:number;halfSpanKm:number;width:number;height:number;fovDeg:number;insets:InspectionViewport}){
 const {kmToScene,halfSpanKm,width,height,fovDeg,insets}=options;
 if(![kmToScene,halfSpanKm,width,height,fovDeg,...Object.values(insets),aim.xKm,aim.yKm].every(Number.isFinite)||kmToScene<=0||halfSpanKm<=0||width<=0||height<=0||fovDeg<=1||fovDeg>=160||Object.values(insets).some(v=>v<0))throw new Error('Invalid aim-camera viewport.');
 const map=(v:readonly [number,number,number])=>new THREE.Vector3(v[0],v[2],-v[1]);
 const normal=map(plane.normal),up=map(plane.yAxis),right=map(plane.xAxis),target=map(plane.centerKm).multiplyScalar(kmToScene);
 if(![...target.toArray(),...normal.toArray(),...up.toArray(),...right.toArray()].every(Number.isFinite)||Math.max(Math.abs(normal.length()-1),Math.abs(up.length()-1),Math.abs(right.length()-1),Math.abs(normal.dot(up)),Math.abs(right.dot(up)),Math.abs(right.dot(normal)))>1e-5||right.clone().cross(up).dot(normal)<.99999)throw new Error('Invalid aim-camera physical plane.');
 const usableWidth=width-insets.left-insets.right,usableHeight=height-insets.top-insets.bottom;
 if(usableWidth<32||usableHeight<32)throw new Error('Aim-camera viewport is covered by UI.');
 const tanV=Math.tan(fovDeg*Math.PI/360),halfWidthKm=Math.max(halfSpanKm,Math.abs(aim.xKm)+200),halfHeightKm=Math.max(halfSpanKm,Math.abs(aim.yKm)+200);
 const distance=Math.max(halfWidthKm*kmToScene/(tanV*usableWidth/height),halfHeightKm*kmToScene/(tanV*usableHeight/height))/.82;
 return {target,position:target.clone().addScaledVector(normal,distance),up,right,normal,distance,halfSpanKm,
  view:{fullWidth:width,fullHeight:height,offsetX:width/2-(insets.left+usableWidth/2),offsetY:height/2-(insets.top+usableHeight/2),width,height}};
}
