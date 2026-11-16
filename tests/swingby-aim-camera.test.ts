import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {swingbyAimCamera} from '../src/render/swingby-aim-camera';
import {intersectSwingbyAimPlane,type SwingbyAimPlane} from '../src/render/swingby-objective';
const plane:SwingbyAimPlane={centerKm:[30000,0,0],normal:[1,0,0],xAxis:[0,1,0],yAxis:[0,0,1]};
const scale=3/3389.5;
describe('fixed physical aim-plane camera',()=>{
 it('looks squarely along the actual normal with physical +Y up and fits the grid at narrow/wide UI sizes',()=>{
  for(const [width,height] of [[1280,720],[1440,900],[900,1100]])for(const insets of [{left:286,right:286,top:190,bottom:174},{left:300,right:300,top:235,bottom:204}]){
   const f=swingbyAimCamera(plane,{xKm:430,yKm:-70},{kmToScene:scale,halfSpanKm:2000,width,height,fovDeg:43,insets}),camera=new THREE.PerspectiveCamera(43,width/height,.001,5000);
   camera.position.copy(f.position);camera.up.copy(f.up);camera.lookAt(f.target);const v=f.view;camera.setViewOffset(v.fullWidth,v.fullHeight,v.offsetX,v.offsetY,v.width,v.height);camera.updateMatrixWorld();
   expect(f.position.clone().sub(f.target).normalize().dot(f.normal)).toBeCloseTo(1,12);expect(f.up.toArray()).toEqual([0,1,-0]);
   for(const x of [-2000,2000])for(const y of [-2000,2000]){const p=new THREE.Vector3(30000*scale,y*scale,-x*scale).project(camera),px=(p.x+1)*width/2,py=(1-p.y)*height/2;expect(px).toBeGreaterThan(insets.left);expect(px).toBeLessThan(width-insets.right);expect(py).toBeGreaterThan(insets.top);expect(py).toBeLessThan(height-insets.bottom);}
  }
 });
 it('turns an actual projected pointer ray back into the same authored physical aim, without moving the plane',()=>{
  const before=structuredClone(plane),aim={xKm:423,yKm:-208},f=swingbyAimCamera(plane,aim,{kmToScene:scale,halfSpanKm:2000,width:1280,height:720,fovDeg:43,insets:{left:286,right:286,top:190,bottom:174}}),camera=new THREE.PerspectiveCamera(43,1280/720,.001,5000);camera.position.copy(f.position);camera.up.copy(f.up);camera.lookAt(f.target);const v=f.view;camera.setViewOffset(v.fullWidth,v.fullHeight,v.offsetX,v.offsetY,v.width,v.height);camera.updateMatrixWorld();
  const ndc=new THREE.Vector3(30000*scale,aim.yKm*scale,-aim.xKm*scale).project(camera),caster=new THREE.Raycaster();caster.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  const r=caster.ray,physical=new THREE.Ray(new THREE.Vector3(r.origin.x,-r.origin.z,r.origin.y).divideScalar(scale),new THREE.Vector3(r.direction.x,-r.direction.z,r.direction.y)),hit=intersectSwingbyAimPlane(physical,plane)!;expect(hit.xKm).toBeCloseTo(aim.xKm,7);expect(hit.yKm).toBeCloseTo(aim.yKm,7);expect(plane).toEqual(before);
 });
 it('rejects covered viewports and invalid physical bases',()=>{
  const o={kmToScene:scale,halfSpanKm:2000,width:1280,height:720,fovDeg:43,insets:{left:700,right:700,top:0,bottom:0}};expect(()=>swingbyAimCamera(plane,{xKm:0,yKm:0},o)).toThrow(/covered/);expect(()=>swingbyAimCamera({...plane,normal:[1,1,0]},{xKm:0,yKm:0},{...o,insets:{left:0,right:0,top:0,bottom:0}})).toThrow(/plane/);
 });
});
