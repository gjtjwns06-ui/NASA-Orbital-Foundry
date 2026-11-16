import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {OrbitalInspectionFollow,radialTransport,synchronizeOrbitUp,transportInspectionView} from '../../../src/render/orbital-inspection-follow';
import {CraftInspectionCamera} from '../../../src/render/craft-camera';

const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
const close=(a:THREE.Vector3,b:THREE.Vector3)=>expect(a.distanceTo(b)).toBeLessThan(1e-11);
const controlsFor=(camera:THREE.PerspectiveCamera)=>{const doc=new EventTarget(),element=Object.assign(new EventTarget(),{style:{},ownerDocument:doc,getRootNode:()=>doc});return new OrbitControls(camera,element as unknown as HTMLElement);};
describe('orbital inspection presentation transport',()=>{
 it('preserves relative radius and radial bearing for non-axis-aligned views',()=>{
  for(let i=0;i<100;i++){
   const a=v(Math.sin(i+.2),Math.cos(i*.31),.4).normalize(),b=v(Math.cos(i*.41),.3,Math.sin(i*.7)).normalize(),offset=v(.7+Math.sin(i),-.3,1.2),up=v(0,1,0),q=radialTransport(a,b);
   close(a.clone().applyQuaternion(q),b);expect(q.length()).toBeCloseTo(1,14);
   expect(offset.clone().applyQuaternion(q).length()).toBeCloseTo(offset.length(),13);
   expect(offset.clone().normalize().applyQuaternion(q).dot(b)).toBeCloseTo(offset.clone().normalize().dot(a),13);
   expect(up.applyQuaternion(q).length()).toBeCloseTo(1,14);
  }
 });
 it('handles exact and near antipodes deterministically and rejects invalid radial input',()=>{
  for(const a of[v(1,0,0),v(0,1,0),v(1,2,3).normalize()])for(const epsilon of[0,1e-8,1e-5]){
   const b=a.clone().negate().add(v(0,epsilon,0)).normalize(),q=radialTransport(a,b);
   expect(q.toArray()).toEqual(radialTransport(a,b).toArray());expect(q.toArray().every(Number.isFinite)).toBe(true);
   expect(a.clone().applyQuaternion(q).distanceTo(b)).toBeLessThan(2e-7);
  }
  expect(()=>radialTransport(v(0,0,0),v(1,0,0))).toThrow();expect(()=>radialTransport(v(NaN,0,0),v(1,0,0))).toThrow();expect(()=>radialTransport(v(1e300,0,0),v(1,0,0))).toThrow();
 });
 it('makes repeated commits a no-op, copies saved mode references, and resets source/seek history',()=>{
  const f=new OrbitalInspectionFollow(),a=v(1,0,0),b=v(0,1,0);
  expect(f.advance('source|epoch',0,a)).toBeNull();expect(f.advance('source|epoch',0,a)).toBeNull();
  const saved=f.capture()!;f.advance('source|epoch',240,b);close(saved.radial,a);
  f.restore(saved);close(a.clone().applyQuaternion(f.advance('source|epoch',240,b)!),b);
  expect(f.advance('source|epoch',240,b)).toBeNull();expect(f.advance('source|epoch',0,a)).toBeNull();
  expect(f.advance('new-source|epoch',30,b)).toBeNull();expect(f.advance('new-source|new-epoch',40,a)).toBeNull();f.reset();expect(f.capture()).toBeNull();
 });
 it('uses the player current offset and updates installed r182 OrbitControls without clearing input',()=>{
  expect(THREE.REVISION).toBe('182');
  const camera=new THREE.PerspectiveCamera(42,1,.01,100),controls=controlsFor(camera);
  camera.position.set(1,2,5);controls.target.set(.2,.3,.4);controls.update();
  // A player has chosen a different bearing and zoom since the last snapshot.
  camera.position.copy(controls.target).add(v(-2,1,3).multiplyScalar(.63));controls.update();
  const before=camera.position.clone().sub(controls.target),q=radialTransport(v(1,0,0),v(.2,.8,.3));
  const internals=controls as any;internals._sphericalDelta.theta=.05;internals._sphericalDelta.phi=-.02;
  controls.enableDamping=true;transportInspectionView(camera,controls,q);
  close(camera.position.clone().sub(controls.target),before.clone().applyQuaternion(q));
  expect(internals._sphericalDelta.theta).toBe(.05);expect(internals._sphericalDelta.phi).toBe(-.02);
  close(camera.up.clone().applyQuaternion(internals._quat),v(0,1,0));
  const pendingTheta=internals._sphericalDelta.theta;controls.update();expect(internals._sphericalDelta.theta).toBeCloseTo(pendingTheta*(1-controls.dampingFactor),14);
  internals._sphericalDelta.set(0,0,0);const stable=camera.position.clone();for(let i=0;i<60;i++)controls.update();close(camera.position,stable);
  camera.up.set(0,1,0);synchronizeOrbitUp(controls,camera);close(camera.up.clone().applyQuaternion(internals._quat),v(0,1,0));controls.dispose();
 });
 it('retains relative zoom through authoritative focus translation and envelope changes',()=>{
  const camera=new THREE.PerspectiveCamera(42,16/9,.01,100),controls=controlsFor(camera),inspection=new CraftInspectionCamera(camera,controls);
  camera.position.set(1,2,3);controls.update();inspection.setViewport(1280,720,{left:248,right:248,top:170,bottom:120});inspection.enter();
  const frame={position:v(3.3,0,0),quaternion:new THREE.Quaternion(),bounds:new THREE.Box3(v(-1,-1,-1),v(1,1,1)),preferredScale:.25,obstacles:[{center:v(0,0,0),radius:3}],initialDirection:v(1,1,1).normalize(),frameKey:'physical'};
  inspection.update(frame);const offset=camera.position.clone().sub(controls.target).multiplyScalar(1.17);camera.position.copy(controls.target).add(offset);controls.update();
  const ratio=camera.position.distanceTo(controls.target)/inspection.getState().fitDistance!,q=radialTransport(frame.position,v(0,3.3,0));transportInspectionView(camera,controls,q);
  inspection.update({...frame,position:v(0,3.3,0),bounds:new THREE.Box3(v(-1.1,-1,-1),v(1.1,1,1))});
  expect(camera.position.distanceTo(controls.target)/inspection.getState().fitDistance!).toBeCloseTo(ratio,12);
  close(camera.position.clone().sub(controls.target).normalize(),offset.normalize().applyQuaternion(q));inspection.exit();controls.dispose();
 });
});
