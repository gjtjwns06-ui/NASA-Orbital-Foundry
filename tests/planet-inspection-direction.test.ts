import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {CraftInspectionCamera,type InspectionControls} from '../src/render/craft-camera';
import {planetInspectionDirection} from '../src/render/planet-inspection-direction';
const dimensions=[{width:1280,height:720,insets:{left:280,right:300,top:165,bottom:150}},{width:1280,height:720,insets:{left:315,right:330,top:180,bottom:170}},{width:1920,height:1080,insets:{left:350,right:380,top:180,bottom:200}},{width:900,height:1400,insets:{left:180,right:200,top:180,bottom:250}}];
function rig(width:number,height:number){const camera=new THREE.PerspectiveCamera(43,width/height,.01,5000);camera.position.set(12,6,14);const controls:InspectionControls={target:new THREE.Vector3(),enabled:true,enablePan:true,enableDamping:false,minDistance:2,maxDistance:100,minPolarAngle:.1,maxPolarAngle:3,minAzimuthAngle:-Infinity,maxAzimuthAngle:Infinity,update:()=>{}};return {camera,controls,inspection:new CraftInspectionCamera(camera,controls)};}
describe('first-entry Mars composition',()=>{
 it('keeps the actual planet centre inside usable portrait/landscape viewports at25,000km and1,000km altitude',()=>{
  for(const size of dimensions)for(const altitudeKm of [25000,1000])for(let i=0;i<12;i++){
   const {camera,controls,inspection}=rig(size.width,size.height),position=new THREE.Vector3(.6,.3,.74).normalize().multiplyScalar(3*(3389.5+altitudeKm)/3389.5),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(i*.17,i*.31,-i*.13)),shoulder=new THREE.Vector3(5.9,3.9,-4.6).normalize().applyQuaternion(q);
   const result=planetInspectionDirection({craftPosition:position,bodyCenter:new THREE.Vector3(),bodyRadius:3,shoulder,...size,fovDeg:43});
   inspection.setViewport(size.width,size.height,size.insets);inspection.enter();inspection.update({position,quaternion:q,bounds:new THREE.Box3(new THREE.Vector3(-3,-1,-1),new THREE.Vector3(3,1,1)),preferredScale:.18,minimumClearance:3*1000/3389.5-.005,obstacles:[{center:new THREE.Vector3(),radius:3.005}],initialDirection:result.direction,frameKey:'mars-flyby'});
   camera.updateMatrixWorld();const ndc=new THREE.Vector3().project(camera),x=(ndc.x+1)*size.width/2,y=(1-ndc.y)*size.height/2;
   expect(x).toBeGreaterThan(size.insets.left);expect(x).toBeLessThan(size.width-size.insets.right);expect(y).toBeGreaterThan(size.insets.top);expect(y).toBeLessThan(size.height-size.insets.bottom);expect(camera.position.length()).toBeGreaterThan(3.005);expect(result.tangentOffsetRad).toBeLessThanOrEqual(result.usableHalfFovRad*.3+1e-12);expect(controls.target.length()).toBeCloseTo(position.length(),8);
  }
 });
 it('does not alter caller state and handles a shoulder parallel to the radial vector',()=>{
  const position=new THREE.Vector3(0,5,0),shoulder=new THREE.Vector3(0,1,0),before=position.clone(),result=planetInspectionDirection({craftPosition:position,bodyCenter:new THREE.Vector3(),bodyRadius:3,shoulder,...dimensions[0],fovDeg:43});
  expect(result.direction.length()).toBeCloseTo(1,12);expect(result.direction.toArray().every(Number.isFinite)).toBe(true);expect(position.equals(before)).toBe(true);expect(shoulder.toArray()).toEqual([0,1,0]);
 });
 it('changes first entry only: subsequent user orbit and exact overview restoration remain intact',()=>{
  const size=dimensions[0],{camera,controls,inspection}=rig(size.width,size.height),original={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone()},position=new THREE.Vector3(0,0,25),q=new THREE.Quaternion(),bounds=new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1));
  inspection.setViewport(size.width,size.height,size.insets);inspection.enter();const first=planetInspectionDirection({craftPosition:position,bodyCenter:new THREE.Vector3(),bodyRadius:3,shoulder:new THREE.Vector3(1,1,-1),...size,fovDeg:43});const frame={position,quaternion:q,bounds,preferredScale:.18,obstacles:[{center:new THREE.Vector3(),radius:3}],initialDirection:first.direction,frameKey:'mars-flyby'};inspection.update(frame);
  const chosen=new THREE.Vector3(.7,.2,.5).normalize(),distance=camera.position.distanceTo(controls.target);camera.position.copy(controls.target).addScaledVector(chosen,distance);inspection.update({...frame,initialDirection:new THREE.Vector3(-1,0,0)});expect(camera.position.clone().sub(controls.target).normalize().distanceTo(chosen)).toBeLessThan(1e-10);
  inspection.exit();expect(camera.position.equals(original.position)).toBe(true);expect(camera.quaternion.equals(original.quaternion)).toBe(true);expect(controls.target.equals(original.target)).toBe(true);
 });
 it('rejects interior or invalid-body state instead of moving a planet to fit',()=>{expect(()=>planetInspectionDirection({craftPosition:new THREE.Vector3(0,0,2),bodyCenter:new THREE.Vector3(),bodyRadius:3,shoulder:new THREE.Vector3(1,0,0),...dimensions[0],fovDeg:43})).toThrow(/exterior/);});
});
