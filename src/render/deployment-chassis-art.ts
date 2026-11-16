import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {LocalBox} from '../deployment/types';

export interface ChassisPalette {ivory:THREE.Material;frame:THREE.Material;dark:THREE.Material;foil:THREE.Material}

/** Original v6-style trim fitted to one authoritative thin chassis solid.
 * Nothing spans the free service bay. These are appearance details, not a
 * second mass distribution, cable network, collision or thermal model. */
export function createDeploymentChassis(box:LocalBox,p:ChassisPalette){
 const group=new THREE.Group(),half=box.halfM,axis=half.indexOf(Math.min(...half)),floor=box.id==='bay-floor';
 // A future non-shell box is deliberately left to the caller's fallback.
 if(half[axis]>.04||half.filter((_,i)=>i!==axis).some(n=>n<.15))return null;
 const sign=floor?1:Math.sign(box.centerM[axis])||1,n=new THREE.Vector3().setComponent(axis,sign),u=axis===0?new THREE.Vector3(0,0,-sign):new THREE.Vector3(axis===2?sign:1,0,0),v=n.clone().cross(u),basis=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,v,n)),boxQ=box.quaternion?new THREE.Quaternion(...box.quaternion):new THREE.Quaternion(),rotation=boxQ.clone().multiply(basis);
 const extent=(direction:THREE.Vector3)=>Math.abs(direction.x)*half[0]+Math.abs(direction.y)*half[1]+Math.abs(direction.z)*half[2],w=extent(u),h=extent(v),d=half[axis];
 const add=(size:[number,number,number],at:[number,number,number],material:THREE.Material,bevel=0)=>{
  const radius=Math.min(bevel,Math.min(...size)*.4),geometry=radius>0?new RoundedBoxGeometry(...size,1,radius):new THREE.BoxGeometry(...size),mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(...at).applyQuaternion(rotation).add(new THREE.Vector3(...box.centerM));mesh.quaternion.copy(rotation);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={proxyBoxId:box.id,originalChassisDetail:true,surfaceDetail:true};group.add(mesh);return mesh;
 };
 const fastener=(x:number,y:number,z:number,r=.007)=>{
  const geometry=new THREE.CylinderGeometry(r,r,d*.12,6);geometry.rotateX(Math.PI/2);const mesh=new THREE.Mesh(geometry,p.dark);mesh.position.set(x,y,z).applyQuaternion(rotation).add(new THREE.Vector3(...box.centerM));mesh.quaternion.copy(rotation);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={proxyBoxId:box.id,originalChassisDetail:true,surfaceDetail:true};group.add(mesh);
 };
 if(floor){
  // Actual service-floor solid; the tracks stop inside its physical boundary.
  add([w*2,h*2,d*.8],[0,0,-d*.6],p.dark,.0015);
  add([w*2-.022,h*2-.022,d*.9],[0,0,d*.05],p.ivory,.003);
  const edge=.023;
  for(const y of [-1,1])add([w*2-.02,edge,d*.5],[0,y*(h-.018),d*.72],p.frame,.0015);
  for(const x of [-1,1])add([edge,h*2-.055,d*.5],[x*(w-.018),0,d*.72],p.frame,.0015);
  for(const x of [-.36,0,.36])if(Math.abs(x)<w-.045){
   add([.016,h*2-.10,d*.12],[x,0,d*.56],p.dark);
   for(const y of [-1,1])fastener(x,y*(h-.072),d*.7);
  }
  // Quiet transverse panel joints are recessed surface strips, not new ports.
  for(const y of [-1,1])add([w*2-.10,.005,d*.10],[0,y*h*.32,d*.55],p.dark);
  return group;
 }
 // Continuous inner wall and backing close the thin physical shell. Outer
 // blankets are independent solids with real joints instead of painted lines.
 add([w*2,h*2,d*.50],[0,0,-d*.65],p.ivory);
 add([w*2,h*2,d*.40],[0,0,-d*.20],p.dark);
 const rail=.034,margin=.043,gap=.016,panelW=(2*w-2*margin-gap)/2,panelH=(2*h-2*margin-gap)/2;
 for(const sx of [-1,1])for(const sy of [-1,1])add([panelW,panelH,d*.70],[sx*(panelW+gap)/2,sy*(panelH+gap)/2,d*.38],p.foil,.003);
 for(const sy of [-1,1])add([w*2-.104,rail,d*1.10],[0,sy*(h-.017),d*.43],p.ivory,.003);
 for(const sx of [-1,1])add([rail,h*2-.104,d*1.10],[sx*(w-.017),0,d*.43],p.ivory,.003);
 for(const sx of [-1,1])for(const sy of [-1,1]){
  // Flat machined end plates retain the silhouette without spending curved
  // geometry on subpixel corners. The adjoining long rails remain bevelled.
  add([.052,.052,d*.65],[sx*(w-.026),sy*(h-.026),d*.65],p.frame);
  fastener(sx*(w-.026),sy*(h-.026),d*.935,.006);
 }
 if(axis!==1){
  const hx=Math.min(.145,w*.25),hy=Math.min(.105,h*.18),x=w*.44,y=-h*.48;
  add([hx*2,hy*2,d*.14],[x,y,d*.79],p.dark,.0012);
  add([hx*2-.022,hy*2-.022,d*.10],[x,y,d*.91],p.frame,.0008);
  for(const sx of [-1,1])for(const sy of [-1,1])fastener(x+sx*(hx-.022),y+sy*(hy-.022),d*.935,.005);
  add([.065,.008,d*.018],[x,y,d*.972],p.dark);
  // A continuous inner-wall trim conduit and clips never leave this wall.
  // It intentionally does not claim a connection to the real board ports.
  const trackX=-w+.067,trackY=h*.18,length=h*.94;
  add([.009,length,d*.12],[trackX,trackY,-d*.94],p.dark,.0004);
  for(const sy of [-1,1])add([.021,.014,d*.14],[trackX,trackY+sy*(length*.36),-d*.92],p.frame,.0005);
 }
 return group;
}
