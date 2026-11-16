import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {BusDefinition} from '../hardware';

export type BusSurfaceStyle='classic'|'panelled-v1';
export interface BusDetailPalette {insulation:THREE.Material;silver:THREE.Material;dark:THREE.Material;white:THREE.Material}
/** Original authored shell artwork. Every added vertex stays inside the bus
 * envelope and outside its certified module-placement bay. No mass, thermal,
 * port, wiring or collision capability is inferred from decorative surfaces. */
export function createDetailedBusSides(profile:BusDefinition,palette:BusDetailPalette){
 const group=new THREE.Group(),[hx,hy,hz]=profile.halfSize;
 group.name='original-panelled-bus-surfaces';
 const add=(size:[number,number,number],position:[number,number,number],material:THREE.Material,radius=.004,cover=false)=>{
  const geometry=radius>0?new RoundedBoxGeometry(...size,1,radius):new THREE.BoxGeometry(...size);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={originalBusDetail:true,bayCover:cover};group.add(mesh);return mesh;
 };
 const placeFace=(axis:'x'|'z',sign:number,width:number,extent:number)=>{
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),axis==='z'?(sign>0?0:Math.PI):sign*Math.PI/2);
  const local=(size:[number,number,number],point:[number,number,number],material:THREE.Material,radius:number,cover=false)=>{
   const mesh=add(size,point,material,radius,cover);mesh.position.applyQuaternion(rotation);mesh.quaternion.copy(rotation);return mesh;
  };
  for(const [height,y,cover] of [[1.03,-.265,false],[.5,.55,true]] as const){
   // Dark continuous substrate closes the shell; independent foil blankets sit
   // above it with a real recessed18mm joint, never a coplanar painted stripe.
   local([width-.055,height,.018],[0,y,extent-.0225],palette.dark,.004,cover);
   const total=width-.071,gap=.018,panel=(total-gap)/2;
   for(const u of [-1,1])local([panel,height-.016,.026],[u*(panel+gap)/2,y,extent-.0175],palette.insulation,.009,cover);
  }
  // One original service hatch per±Z face. The visible gasket/lid remain below
  // the exact physical surface. Existing plaque/vent regions are left clear.
  if(axis==='z'){
   local([.315,.232,.006],[.31,-.555,extent-.0044],palette.dark,.008);
   local([.279,.197,.0024],[.31,-.555,extent-.0016],palette.silver,.001);
   for(const u of [-1,1])for(const v of [-1,1]){
    const geo=new THREE.CylinderGeometry(.008,.008,.0015,6);geo.rotateX(Math.PI/2);
    const fastener=new THREE.Mesh(geo,palette.dark);fastener.position.set(.31+u*.12,-.555+v*.079,extent-.001);fastener.position.applyQuaternion(rotation);fastener.quaternion.copy(rotation);fastener.castShadow=fastener.receiveShadow=true;fastener.userData.originalBusDetail=true;group.add(fastener);
   }
   local([.084,.012,.001],[.31,-.555,extent-.0007],palette.dark,.0004);
  }
 };
 for(const sign of [-1,1]){placeFace('z',sign,2*hx,hz);placeFace('x',sign,2*hz,hx);}
 // Coherent L-shaped end shoes join existing50mm corner rails without solid
 // blocks intruding into the Pathfinder's nearly full-width service bay.
 for(const x of [-1,1])for(const z of [-1,1])for(const y of [-1,1]){
  add([.082,.068,.024],[x*(hx-.041),y*(hy-.034),z*(hz-.012)],palette.silver,.004);
  add([.024,.068,.082],[x*(hx-.012),y*(hy-.034),z*(hz-.041)],palette.silver,.004);
 }
 // Fixed chassis conduit outside the declared bay, not a simulated cable to a
 // board. The tiny stand-off and clips fit in verified wall clearance.
 const bay=profile.bay,cx=bay.max[0]+.018,low=bay.mountY+.042,high=Math.min(bay.max[1]-.07,low+.18),z0=bay.min[2]+.15,z1=bay.max[2]-.15;
 const points=[new THREE.Vector3(cx,low,z0),new THREE.Vector3(cx,high,z0),new THREE.Vector3(cx,high,z1),new THREE.Vector3(cx,low,z1)];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,delta.length(),8),palette.dark);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.castShadow=mesh.receiveShadow=true;mesh.userData={originalBusDetail:true,chassisConduit:true};group.add(mesh);
 }
 for(const z of [z0,z1])add([.01,.018,.014],[cx,high-.025,z],palette.silver,.001);
 return group;
}
