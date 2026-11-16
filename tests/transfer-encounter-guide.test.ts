import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {transferEncounterGuide} from '../src/render/transfer-scene';
import type {Vec3} from '../src/sim/types';

const input={arrivalVInfinityKmS:[1.7,-2.1,.45] as Vec3};
const incoming=new THREE.Vector3(input.arrivalVInfinityKmS[0],input.arrivalVInfinityKmS[2],-input.arrivalVInfinityKmS[1]).normalize();
describe('Direct encounter edit guides retain physical meaning',()=>{
  it('altitude handle is a true periapsis distance while the other handle lies in the incoming B-plane',()=>{
    for(const altitude of [250,1000,10000])for(const angle of [-Math.PI,-.6,0,Math.PI]){
      const guide=transferEncounterGuide(input,altitude,angle);
      expect(guide.periapsis.length()).toBeCloseTo((3389.5+altitude)*3/3389.5,10);
      expect(Math.abs(guide.bPlane.dot(incoming))).toBeLessThan(1e-10);
      const speed2=input.arrivalVInfinityKmS.reduce((sum,v)=>sum+v*v,0),rp=3389.5+altitude;
      expect(guide.bPlane.length()).toBeCloseTo(rp*Math.sqrt(1+2*42828.375214/(rp*speed2))*3/3389.5,10);
    }
  });
  it('angle rotates the impact vector in its plane without changing altitude or mutating the accepted asymptote',()=>{
    const before=[...input.arrivalVInfinityKmS];
    const a=transferEncounterGuide(input,1000,0),quarter=transferEncounterGuide(input,1000,Math.PI/2),opposite=transferEncounterGuide(input,1000,Math.PI);
    expect(a.bPlane.clone().normalize().dot(quarter.bPlane.clone().normalize())).toBeCloseTo(0,10);
    expect(a.bPlane.clone().add(opposite.bPlane).length()).toBeLessThan(1e-10);
    expect(quarter.periapsis.length()).toBeCloseTo(a.periapsis.length(),10);
    expect(input.arrivalVInfinityKmS).toEqual(before);
  });
});
