import {describe,it,expect} from 'vitest';
import oracle from './fixtures/swingby-gmat/oracle-v2.json';
import {localArcFromCartesian,localArcStateAt,localArcRadiusTime,SWINGBY_MARS_MU} from '../src/swingby/conic';
import {solveSwingbyControl,aimFromSwingbyControl,solveSwingbyAim} from '../src/swingby/orbit';
import {getSwingbyScenario} from '../src/swingby/scenario';
import {cross,dot,magnitude,sub} from '../src/sim/physics';
import type {Vec3} from '../src/sim/types';
describe('actual-epoch bounded swingby orbital adapter',()=>{
 it('matches independent GMAT24 ICRF/TDB cases at all192 raw sampled states and both outward events',()=>{
  expect(oracle.pass).toBe(true);const s=getSwingbyScenario();expect(s.initial).toEqual(oracle.initial);expect(s.epochJdTdb).toBe(oracle.epochJdTdb);
  for(const f of oracle.fixtures){const o=solveSwingbyControl(f),arc=o.arcs[1];for(const row of f.samples){const a=['start','node-minus-1','before-burn'].includes(row.name)?o.arcs[0]:arc,state=localArcStateAt(a,row.tdbElapsedSeconds);expect(magnitude(sub(state.positionKm,row.state.positionKm as Vec3))*1000,f.caseId+' '+row.name+' position').toBeLessThan(10);expect(magnitude(sub(state.velocityKmS,row.state.velocityKmS as Vec3))*1000).toBeLessThan(.01);}
   expect(Math.abs(o.periapsisAltitudeKm-f.periapsisAltitudeKm)).toBeLessThan(.01);expect(Math.abs(o.exit.time-f.samples.find(s=>s.name==='outward-exit')!.tdbElapsedSeconds)).toBeLessThan(.1);expect(Math.abs(o.patchExitSeconds-f.samples.find(s=>s.name==='outward-patch')!.tdbElapsedSeconds)).toBeLessThan(.1);expect(Math.abs(o.exit.directionErrorDeg-f.gmatSolar.directionErrorDeg)).toBeLessThan(.005);expect(Math.abs(o.exit.energyKm2S2-f.gmatSolar.energyKm2S2)).toBeLessThan(.01);expect(o.exit.directionPassed).toBe(f.gmatSolar.directionPassed);expect(o.exit.energyPassed).toBe(f.gmatSolar.energyPassed);expect(o.exit.outwardRadialSpeedKmS).toBeGreaterThan(0);
  }
 });
 it('inverts direct aim-plane drags for all24 controls while preserving the fixed pre-node state',()=>{
  for(const f of oracle.fixtures){const aim=aimFromSwingbyControl(f),solution=solveSwingbyAim(aim);expect(Math.abs(solution.correction.xMps-f.xMps)).toBeLessThan(.0002);expect(Math.abs(solution.correction.yMps-f.yMps)).toBeLessThan(.0002);expect(solution.correction.residualKm).toBeLessThanOrEqual(.01);const before=localArcStateAt(solution.arcs[0],3600),after=localArcStateAt(solution.arcs[1],3600);expect(magnitude(sub(before.positionKm,after.positionKm))).toBeLessThan(1e-6);expect(magnitude(sub(sub(after.velocityKmS,before.velocityKmS),solution.correction.vectorMps.map(v=>v/1000) as Vec3))).toBeLessThan(1e-10);}
 });
 it('has four orbital target candidates and independent direction/energy/safety negatives',()=>{
  for(const [xMps,yMps] of [[0,2],[-1,2],[1,2],[0,1.5]]){const o=solveSwingbyControl({xMps,yMps});expect(o.exit.directionPassed&&o.exit.energyPassed&&o.periapsisAltitudeKm>=250).toBe(true);}
  const no=solveSwingbyControl({xMps:0,yMps:0});expect(no.exit.directionPassed).toBe(false);expect(no.exit.energyPassed).toBe(true);
  const energy=solveSwingbyControl({xMps:-2,yMps:2});expect(energy.exit.directionPassed).toBe(true);expect(energy.exit.energyPassed).toBe(false);expect(solveSwingbyControl({xMps:-7,yMps:0}).periapsisAltitudeKm).toBeLessThan(250);
 });
 it('uses feasible one-sided Jacobians on the circular8m/s control boundary',()=>{
  for(const degrees of [35,45,55,125,225,315]){const angle=degrees*Math.PI/180,xMps=8*Math.cos(angle),yMps=8*Math.sin(angle),aim=aimFromSwingbyControl({xMps,yMps}),solved=solveSwingbyAim(aim);expect(solved.correction.residualKm).toBeLessThanOrEqual(.01);expect(Math.abs(solved.correction.xMps-xMps)).toBeLessThan(.0002);expect(Math.abs(solved.correction.yMps-yMps)).toBeLessThan(.0002);}
 });
 it('conserves Mars energy/angular momentum and refuses unsupported or nonfinite conics and unreachable drags',()=>{
  const arc=localArcFromCartesian(getSwingbyScenario().initial),initial=localArcStateAt(arc,0),energy=(v:typeof initial)=>dot(v.velocityKmS,v.velocityKmS)/2-SWINGBY_MARS_MU/magnitude(v.positionKm),e0=energy(initial);
  const h0=cross(initial.positionKm,initial.velocityKmS);for(const t of [3600,100000,141841,200000,326000]){const value=localArcStateAt(arc,t);expect(Math.abs(energy(value)-e0)).toBeLessThan(1e-11);expect(magnitude(sub(cross(value.positionKm,value.velocityKmS),h0))).toBeLessThan(1e-7);}
  for(const direction of ['inbound','outbound'] as const){const t=localArcRadiusTime(arc,100000,direction),r=localArcStateAt(arc,t);expect(magnitude(r.positionKm)).toBeCloseTo(100000,6);expect(Math.sign(dot(r.positionKm,r.velocityKmS))).toBe(direction==='inbound'?-1:1);}
  expect(()=>localArcFromCartesian({positionKm:[4000,0,0],velocityKmS:[0,1,0]})).toThrow('UNSUPPORTED_CONIC');expect(()=>localArcFromCartesian({positionKm:[NaN,0,0],velocityKmS:[0,1,0]})).toThrow('INVALID_STATE');expect(()=>solveSwingbyAim({xKm:5001,yKm:0})).toThrow();expect(()=>solveSwingbyControl({xMps:7,yMps:7})).toThrow('CONTROL_RANGE');
 });
});
