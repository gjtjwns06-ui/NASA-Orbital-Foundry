import {describe,it,expect} from 'vitest';
import {radialRayParameter,planeAngleFromRay,angularDragDelta} from '../src/render/orbit-manipulator';
import type {Vec3} from '../src/sim/types';
const aim=(eye:Vec3,point:Vec3):Vec3=>point.map((v,i)=>v-eye[i]) as Vec3;
describe('actual ray constrained orbit manipulation',()=>{
 it('follows either radial apsis under different camera positions and unnormalised rays',()=>{
  for(const eye of [[8,7,10],[-10,3,8],[2,12,-8]] as Vec3[])for(const sign of [-1,1])for(const r of [3.1,3.8,4.2]){
   const point:Vec3=[sign*r,0,0];expect(radialRayParameter(eye,aim(eye,point),[sign,0,0])).toBeCloseTo(r,12);
  }
 });
 it('recovers the orbital plane angle from the same rendered ring for oblique cameras',()=>{
  for(const eye of [[8,7,10],[-10,3,8]] as Vec3[])for(const angle of [0,20,51.6,90,135,180]){
   const a=angle*Math.PI/180,point:Vec3=[0,4*Math.sin(a),-4*Math.cos(a)];
   expect(planeAngleFromRay(eye,aim(eye,point))).toBeCloseTo(angle,11);
  }
 });
 it('rejects unobservable, backwards and nonfinite constraints without generating a plan',()=>{
  expect(radialRayParameter([10,0,0],[1,0,0],[1,0,0])).toBeNull();
  expect(radialRayParameter([5,5,5],[1,1,1],[1,0,0])).toBeNull();
  expect(radialRayParameter([NaN,0,0],[0,1,0],[1,0,0])).toBeNull();
  expect(planeAngleFromRay([0,4,5],[0,0,-1])).toBeNull();
  expect(planeAngleFromRay([5,4,5],[1,0,0])).toBeNull();
  expect(planeAngleFromRay([5,0,0],[-1,0,0])).toBeNull();
 });
 it('does not jump by a full turn across the atan2 seam',()=>{
  expect(angularDragDelta(179,-179)).toBe(2);expect(angularDragDelta(-179,179)).toBe(-2);
  expect(angularDragDelta(51.6,54.6)).toBeCloseTo(3,12);
 });
});
