import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {LocalBox} from '../deployment/types';
export interface InternalPalette {dark:THREE.Material;frame:THREE.Material;ivory:THREE.Material;foil:THREE.Material;pcb:THREE.Material}
type XYZ=[number,number,number];
/** Original authored appearance inside an existing mass/collision proxy. No
 * vendor CAD, dynamics, wiring connectivity, texture or additional bounds. */
export function createDeploymentInternal(box:LocalBox,variant:string,p:InternalPalette):THREE.Group|null{
 const family=variant.startsWith('bpx')?'battery':variant.startsWith('iris')||variant.startsWith('ax100')?'radio':variant.startsWith('xact')?'adcs':variant.startsWith('recorder')?'recorder':variant==='mechanism-controller-v1'?'controller':null;if(!family)return null;
 // The declared bay foot already uses ivory. Reuse it as the board's coated
 // metal finish (or ADCS hub) so the complete link stays within four batches.
 p=family==='adcs'?{...p,foil:p.ivory}:family==='battery'?p:{...p,frame:p.ivory};
 const group=new THREE.Group(),h=box.halfM,rotation=box.quaternion?new THREE.Quaternion(...box.quaternion):new THREE.Quaternion(),center=new THREE.Vector3(...box.centerM);
 const place=(geometry:THREE.BufferGeometry,at:XYZ,material:THREE.Material,localQ=new THREE.Quaternion())=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(at[0]*h[0],at[1]*h[1],at[2]*h[2]).applyQuaternion(rotation).add(center);mesh.quaternion.copy(rotation).multiply(localQ);mesh.castShadow=mesh.receiveShadow=true;mesh.userData={proxyBoxId:box.id,originalInternalDetail:true,appearanceFamily:family,appearanceOnly:true};group.add(mesh);return mesh;};
 const block=(size:XYZ,at:XYZ,material:THREE.Material,bevel=false)=>{const xyz=size.map((n,i)=>n*h[i]) as XYZ,r=Math.min(...xyz)*.13;return place(bevel?new RoundedBoxGeometry(...xyz,1,r):new THREE.BoxGeometry(...xyz),at,material);};
 const disk=(at:XYZ,radius:number,length:number,axis:XYZ,material:THREE.Material,segments=12)=>place(new THREE.CylinderGeometry(radius,radius,length,segments),at,material,new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...axis)));
 const screws=(z:number)=>{for(const x of[-.83,.83])for(const y of[-.82,.82]){disk([x,y,z],Math.min(h[0],h[1])*.043,h[2]*.045,[0,0,1],p.frame,6);block([.047,.010,.008],[x,y,z+.025],p.dark);}};
 const pcb=()=>{block([1.94,1.94,.16],[0,0,-.90],p.dark,true);block([1.83,1.82,.08],[0,0,-.77],p.frame);block([1.79,1.78,.10],[0,0,-.67],p.pcb);screws(-.58);};
 const header=(x:number,y:number,z:number,width=.74)=>{block([width,.20,.22],[x,y,z],p.dark);for(let i=0;i<6;i++)block([width*.075,.075,.055],[x-width*.40+i*width*.16,y,z+.137],p.foil);};
 const traces=(x:number,y:number,z:number,count=3)=>{for(let i=0;i<count;i++){block([.34,.012,.010],[x,y+i*.075,z],p.foil);block([.012,.18,.010],[x+.17,y+i*.075+.09,z],p.foil);}};
 if(family==='battery'){
  block([1.98,1.98,1.62],[0,0,-.18],p.dark,true);block([1.88,1.86,.16],[0,0,.70],p.frame,true);
  const dual=variant.includes('dual');for(const x of(dual?[-.45,.45]:[0])){const w=dual?.84:1.76;block([w,1.70,.13],[x,0,.845],p.ivory,true);for(const y of[-.42,.42])block([w*.97,.10,.04],[x,y,.93],p.dark);block([w*.34,.26,.022],[x,.06,.927],p.frame);for(let i=0;i<3;i++)block([w*.22,.018,.008],[x,.0+i*.045,.943],p.dark);}
  for(const x of[-.68,.68]){block([.19,.22,.12],[x,-.72,.82],p.dark);disk([x,-.72,.93],Math.min(h[0],h[1])*.055,h[2]*.08,[0,0,1],p.foil,8);}screws(.91);
 }else if(family==='radio'){
  pcb();block([1.62,1.56,.10],[0,0,-.45],p.pcb);block([1.43,.86,.08],[-.08,.22,-.28],p.dark);block([.70,.81,.90],[-.43,.24,.22],p.frame,true);block([.63,.81,.62],[.32,.24,.08],p.frame,true);
  for(const x of[-.43,.32]){block([.36,.025,.012],[x,.30,x<0?.678:.398],p.dark);block([.25,.025,.012],[x,.20,x<0?.678:.398],p.dark);}
  header(0,-.65,-.34,1.15);for(const y of[-.38,.11,.58]){disk([.82,y,.04],Math.min(h[1],h[2])*.105,h[0]*.22,[1,0,0],p.foil,10);disk([.94,y,.04],Math.min(h[1],h[2])*.060,h[0]*.02,[1,0,0],p.dark,10);}traces(-.50,-.39,-.385,2);
 }else if(family==='adcs'){
  pcb();const r=Math.min(h[0],h[1],h[2])* .40,len=Math.min(...h)*.27;
  for(const [at,axis] of [[[-.45,-.42,.02],[1,0,0]],[[.45,-.08,.10],[0,1,0]],[[-.15,.48,.15],[0,0,1]]] as [XYZ,XYZ][]){disk(at,r,len,axis,p.dark,16);disk(at,r*.86,len*1.15,axis,p.frame,16);disk(at,r*.40,len*1.20,axis,p.dark,12);disk(at,r*.18,len*1.25,axis,p.foil,10);}
  header(.12,-.76,-.40,.83);block([.28,.30,.34],[.60,.62,-.43],p.dark,true);traces(-.57,.12,-.605,2);
 }else if(family==='recorder'){
  pcb();for(const x of[-.42,.42])for(const y of[-.34,.06,.46]){block([.54,.28,.24],[x,y,-.43],p.dark,true);block([.29,.018,.009],[x,y+.035,-.303],p.frame);for(const sign of[-1,1])for(let i=0;i<3;i++)block([.048,.026,.045],[x+sign*.292,y-.08+i*.08,-.50],p.foil);}
  header(0,-.73,-.40,1.16);traces(-.19,-.26,-.605,3);
 }else{
  pcb();block([.65,.62,.34],[-.34,.25,-.40],p.dark,true);block([.38,.30,.24],[.42,.34,-.45],p.dark,true);for(const x of[.25,.56])disk([x,-.22,-.38],Math.min(h[0],h[1])*.15,h[2]*.36,[0,0,1],p.frame,12);header(0,-.73,-.40,1.13);header(.25,.75,-.42,.74);traces(-.55,-.27,-.605,3);block([.32,.025,.012],[-.34,.25,-.223],p.frame);
 }
 return group;
}
