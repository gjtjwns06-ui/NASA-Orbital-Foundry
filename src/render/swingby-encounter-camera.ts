import * as THREE from 'three';
import type {InspectionViewport} from './craft-camera';
import type {SwingbyVector} from './swingby-objective';

const toScene=(v:SwingbyVector,scale:number)=>new THREE.Vector3(v[0],v[2],-v[1]).multiplyScalar(scale);
const finitePoint=(v:SwingbyVector)=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);

/** Camera bounds only: intersections are on the already drawn polyline, not
 * new trajectory samples or a propagation/closest-approach calculation. */
export function encounterFramePoints(paths:readonly (readonly SwingbyVector[])[],radiusKm:number){
 if(!Number.isFinite(radiusKm)||radiusKm<=0)throw new Error('Invalid encounter camera radius.');
 const points:SwingbyVector[]=[];
 for(const path of paths){
  for(const p of path){if(!finitePoint(p))throw new Error('Invalid encounter camera point.');if(Math.hypot(...p)<=radiusKm)points.push([...p] as [number,number,number]);}
  for(let i=1;i<path.length;i++){
   const a=new THREE.Vector3(...path[i-1]),delta=new THREE.Vector3(...path[i]).sub(a),A=delta.lengthSq();if(A===0)continue;
   const B=2*a.dot(delta),C=a.lengthSq()-radiusKm**2,discriminant=B*B-4*A*C;if(discriminant<0)continue;
   const root=Math.sqrt(discriminant);
   for(const t of [(-B-root)/(2*A),(-B+root)/(2*A)])if(t>0&&t<1)points.push(a.clone().addScaledVector(delta,t).toArray() as [number,number,number]);
  }
 }
 return points;
}

/** A perspective fit of the real Mars sphere and the near-pass portion of
 * existing paths. Insets only move the projection centre and camera position.
 * No planet, craft, mesh, sample, event or physical scale is modified. */
export function swingbyEncounterCamera(paths:readonly (readonly SwingbyVector[])[],options:{
 planetRadiusKm:number;kmToScene:number;cropRadii?:number;width:number;height:number;fovDeg:number;insets:InspectionViewport;
}){
 const {planetRadiusKm,kmToScene,width,height,fovDeg,insets}=options,cropRadii=options.cropRadii??4;
 if(![planetRadiusKm,kmToScene,width,height,fovDeg,cropRadii,...Object.values(insets)].every(Number.isFinite)||planetRadiusKm<=0||kmToScene<=0||cropRadii<=1||width<=0||height<=0||fovDeg<=1||fovDeg>=160||Object.values(insets).some(v=>v<0))throw new Error('Invalid encounter camera viewport.');
 const usableWidth=width-insets.left-insets.right,usableHeight=height-insets.top-insets.bottom;
 if(usableWidth<32||usableHeight<32)throw new Error('Encounter camera viewport is covered by UI.');
 const cropRadiusKm=planetRadiusKm*cropRadii,physicalPoints=encounterFramePoints(paths,cropRadiusKm),points=physicalPoints.map(p=>toScene(p,kmToScene)),R=planetRadiusKm*kmToScene;
 const bounds=new THREE.Box3(new THREE.Vector3(-R,-R,-R),new THREE.Vector3(R,R,R));points.forEach(p=>bounds.expandByPoint(p));
 const target=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(1,.65,1.2).normalize(),right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right).normalize();
 const tanV=Math.tan(fovDeg*Math.PI/360),padding=.88,slopeX=tanV*usableWidth/height*padding,slopeY=tanV*usableHeight/height*padding;
 let distance=0;
 for(const p of points){const v=p.clone().sub(target),z=v.dot(direction);distance=Math.max(distance,z+Math.abs(v.dot(right))/slopeX,z+Math.abs(v.dot(up))/slopeY,z+.001);}
 // Exact sphere-to-frustum half-plane distance, not just its centre or a
 // screen-space radius approximation. It also covers the no-path case.
 const c=target.clone().negate(),z=c.dot(direction);
 distance=Math.max(distance,z+(Math.abs(c.dot(right))+R*Math.sqrt(1+slopeX*slopeX))/slopeX,z+(Math.abs(c.dot(up))+R*Math.sqrt(1+slopeY*slopeY))/slopeY,z+R+.001);
 return {target,position:target.clone().addScaledVector(direction,distance),up:new THREE.Vector3(0,1,0),direction,distance,
  cropRadii,cropRadiusKm,physicalPoints,points,usableWidth,usableHeight,padding,
  view:{fullWidth:width,fullHeight:height,offsetX:width/2-(insets.left+usableWidth/2),offsetY:height/2-(insets.top+usableHeight/2),width,height}};
}
