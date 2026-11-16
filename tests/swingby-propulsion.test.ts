import {describe,it,expect} from 'vitest';
import {createSwingbyDesign,createSwingbyPlan,solveSwingbyPlan} from '../src/swingby/planning';
import {swingbyMassProperties,swingbyThrustGeometry,swingbyFuelUsed,swingbyEngine} from '../src/swingby/propulsion';
import {SWINGBY_PROPULSION as P} from '../src/swingby/scenario';
import {getPartGeometry,createHardwarePart} from '../src/hardware';
import oracle from './fixtures/swingby-gmat/oracle-v2.json';
describe('authored CG trim carrier physical contract',()=>{
 it('uses real initial fuel, carrier centroid and dynamic inertia, and agrees with GMAT ideal impulse fuel',()=>{
  const craft=createSwingbyDesign(),initial=swingbyMassProperties(craft,.25),empty=swingbyMassProperties(craft,0);expect(initial.massKg).toBeCloseTo(oracle.dryMassKg+.25,12);expect(initial.massKg-empty.massKg).toBeCloseTo(.25,12);expect(initial.carrierMassKg).toBe(.4);expect(initial.inertiaKgM2.every(n=>n>0&&Number.isFinite(n))).toBe(true);expect(initial.centerOfMassM).not.toEqual(empty.centerOfMassM);expect(initial.inertiaKgM2).not.toEqual(empty.inertiaKgM2);
  for(const f of oracle.fixtures)expect(Math.abs(swingbyFuelUsed(craft,.25,Math.hypot(f.xMps,f.yMps))-f.expectedFuelUsedKg)).toBeLessThan(1e-10);
  const g=swingbyThrustGeometry(craft,.25);expect(g.gimbalAngleDeg).toBeLessThan(P.maximumGimbalDeg);expect(g.gimbalAngleDeg).toBeGreaterThan(7);
 });
 it('keeps fixed carrier and entire10degree moving bell inside the existing collision proxy',()=>{
  const craft=createSwingbyDesign(),engine=swingbyEngine(craft)!;expect(getPartGeometry(craft,engine.part).deployedBoxes).toEqual([P.geometry.envelope]);
  const box=P.geometry.envelope;for(let tilt=0;tilt<=10;tilt+=1)for(let az=0;az<360;az+=15)for(let theta=0;theta<360;theta+=15){const a=tilt*Math.PI/180,b=az*Math.PI/180,t=theta*Math.PI/180;for(const z of [0,P.geometry.bell.lengthM]){const radius=z?P.geometry.bell.mouthRadiusM:P.geometry.bell.neckRadiusM,x=radius*Math.cos(t),y=radius*Math.sin(t),q=[(x*Math.cos(a)+z*Math.sin(a))*Math.cos(b)-y*Math.sin(b),(x*Math.cos(a)+z*Math.sin(a))*Math.sin(b)+y*Math.cos(b),P.geometry.pivot[2]-x*Math.sin(a)+z*Math.cos(a)];q.forEach((v,i)=>expect(Math.abs(v-box.center[i])).toBeLessThanOrEqual(box.half[i]+1e-12));}}
  const near=structuredClone(craft);near.parts.push(createHardwarePart('uhf-dipole-pair-v1','near','ny',.15,0,0));const solved=solveSwingbyPlan(createSwingbyPlan(),near);expect(solved.status).toBe('solved');if(solved.status==='solved')expect(solved.evaluation.issues.some(i=>i.code==='PLACEMENT')).toBe(true);
 });
 it('cannot choose a different engine by reorder and blocks duplicate engines',()=>{
  const craft=createSwingbyDesign(),part=craft.parts.find(p=>p.kind==='engine')!;craft.parts.push({...part,id:'engine-second',u:.1});expect(swingbyEngine(craft)).toBeNull();craft.parts.reverse();expect(swingbyEngine(craft)).toBeNull();const solved=solveSwingbyPlan(createSwingbyPlan(),craft);expect(solved.status).toBe('solved');if(solved.status==='solved'){expect(solved.evaluation.launchable).toBe(false);expect(solved.evaluation.issues.some(i=>i.code==='PROPULSION_UNAVAILABLE')).toBe(true);}
 });
});
