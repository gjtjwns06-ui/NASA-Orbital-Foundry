import {beforeAll,describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {createBus,mats,isSharedPartMaterial,isSharedPartTexture} from '../src/render/parts';
import {createBus as baselineBus} from './fixtures/parts-v5-baseline';
import {createDetailedBusSides} from '../src/render/bus-surface-detail';
import {BUSES,HARDWARE_VERSION} from '../src/hardware';
import type {Design} from '../src/sim/types';
const context={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},createLinearGradient(){return {addColorStop(){}};}};
beforeAll(()=>vi.stubGlobal('document',{createElement:()=>({width:1,height:1,getContext:()=>context})}));
const design=(busId:'surveyor-l18-v1'|'pathfinder-d35-v1'):Design=>({version:1,hardwareVersion:HARDWARE_VERSION,busId,missionId:'earth',name:'Bounded art',parts:[],seed:1,plan:{altitudeKm:500,inclinationDeg:51,burnTime:0,progradeMps:0,normalMps:0,radialMps:0,periapsisAltitudeKm:1000,bPlaneAngleDeg:0,operations:[]}});
const vertices=(root:THREE.Object3D)=>{const out:THREE.Vector3[]=[];root.updateMatrixWorld(true);root.traverse(o=>{if(o instanceof THREE.Mesh){const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++)out.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));}});return out;};
function stats(root:THREE.Object3D){let triangles=0,draws=0;const textures=new Set<THREE.Texture>();root.traverse(o=>{if(o instanceof THREE.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}});return {triangles,draws,textures:textures.size};}
function snapshot(root:THREE.Object3D){const records:unknown[]=[];root.updateMatrixWorld(true);root.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material as THREE.MeshStandardMaterial;records.push({matrix:o.matrixWorld.toArray(),positions:Array.from(o.geometry.getAttribute('position').array),normal:Array.from(o.geometry.getAttribute('normal').array),uv:o.geometry.getAttribute('uv')?Array.from(o.geometry.getAttribute('uv').array):null,index:o.geometry.index?Array.from(o.geometry.index.array):null,material:{type:m.type,color:m.color?.getHex(),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,side:m.side,transparent:m.transparent},cover:o.userData.bayCover});}});return records;}
describe('bounded original bus surface candidate',()=>{
 for(const id of Object.keys(BUSES) as Array<'surveyor-l18-v1'|'pathfinder-d35-v1'>){
  it(`${id}: every shell and additional detail vertex remains inside the exact physical envelope and outside the certified bay`,()=>{
   const p=BUSES[id],d=design(id),shell=createBus(d),additional=createDetailedBusSides(p,{...mats,insulation:mats.gold}),half=p.halfSize,inside=(v:THREE.Vector3)=>v.toArray().every((n,i)=>n>=p.bay.min[i]+1e-5&&n<=p.bay.max[i]-1e-5);
   expect(vertices(shell).every(v=>v.toArray().every((n,i)=>Math.abs(n)<=half[i]+.00005))).toBe(true);expect(vertices(additional).filter(inside)).toEqual([]);expect(shell.userData.bayBounds).toEqual(p.bay);
   additional.traverse(o=>{if(o.userData.chassisConduit)expect(vertices(o).every(v=>v.x>p.bay.max[0])).toBe(true);});
  });
  it(`${id}: respects the triangle/batch/texture budget and preserves exact classic output`,()=>{
   const d=design(id),classic=createBus(d,'classic'),next=createBus(d,'panelled-v1'),before=stats(classic),after=stats(next);expect(after.triangles-before.triangles).toBeLessThanOrEqual(8000);expect(after.draws-before.draws).toBeLessThanOrEqual(2);expect(after.textures).toBe(before.textures);expect(snapshot(classic)).toEqual(snapshot(baselineBus(d))); 
  });
  it(`${id}: every removable foil section and substrate clears the open bay while fixed corner joints remain`,()=>{
   const d=design(id),g=createBus(d),closed=vertices(g),covers=g.children.filter(o=>o.userData.bayCover);expect(covers.length).toBeGreaterThan(1);for(const cover of covers)cover.visible=false;
   g.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(.1,1.2,.1),new THREE.Vector3(0,-1,0)),visible=ray.intersectObject(g,true).filter(h=>h.object.visible);expect(visible[0].point.y).toBeLessThanOrEqual(BUSES[id].bay.mountY+.01);expect(new THREE.Box3().setFromObject(g).max.y).toBeCloseTo(.8,5);expect(closed.length).toBeGreaterThan(0);
  });
 }
 it('keeps legacy bus geometry/material output byte-numerically identical to the captured production factory',()=>{expect(snapshot(createBus())).toEqual(snapshot(baselineBus()));expect(snapshot(createBus(undefined,'classic'))).toEqual(snapshot(baselineBus()));});
 it('uses separated hatch surfaces and a real recessed foil joint without burying existing labels/vents',()=>{
  const g=createBus(design('pathfinder-d35-v1'));g.updateMatrixWorld(true);const cast=(x:number,y:number)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(g,true);
  const seam=cast(0,-.69)[0],blanket=cast(.12,-.69)[0];expect(seam.point.z).toBeLessThan(blanket.point.z-.006);
  const hatch=cast(.36,-.55);expect((hatch[0].object as THREE.Mesh).material).toBe(mats.silver);expect(hatch[1].distance-hatch[0].distance).toBeGreaterThan(.0005);
  const topEdge=new THREE.Raycaster(new THREE.Vector3(.0091,1.2,.1),new THREE.Vector3(0,-1,0)).intersectObject(g,true);expect((topEdge[0].object as THREE.Mesh).material).toBe(mats.white);expect(topEdge[0].point.y).toBeGreaterThan(.798);const backing=topEdge.find(h=>(h.object as THREE.Mesh).material===mats.dark)!;expect(backing.distance-topEdge[0].distance).toBeGreaterThan(.001);
 });
 it('releases only per-instance materials and keeps all shared atlases/factory materials alive',()=>{
  const a=createBus(design('surveyor-l18-v1')),b=createBus(design('pathfinder-d35-v1')),borrowed=new Set<THREE.Material|THREE.Texture>(),ownedMaterials=new Set<THREE.Material>(),ownedTextures=new Set<THREE.Texture>(),geometry=new Set<THREE.BufferGeometry>();
  a.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){(isSharedPartMaterial(m)?borrowed:ownedMaterials).add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)(isSharedPartTexture(value)?borrowed:ownedTextures).add(value);}}});
  const borrowDispose=vi.fn();borrowed.forEach(r=>r.addEventListener('dispose',borrowDispose));geometry.forEach(g=>g.dispose());ownedMaterials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());expect(borrowDispose).not.toHaveBeenCalled();expect(stats(b).triangles).toBeGreaterThan(0);
 });
});
