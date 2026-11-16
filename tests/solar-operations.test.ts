import {describe,it,expect} from 'vitest';
import {freshCampaign,observationProfile} from '../src/solar/campaign';
import {createEncounter,localEncounterFrame} from '../src/solar/encounter';
import {createOperations,encounterFrame,evaluateExposure,advanceOperations,releaseExposure,operationsSummary,executeCommand,resolveCruiseEvent,scheduledCruiseEvent,restoreOperations,advanceDownlink,type OperationsState,type ObservationInput} from '../src/solar/operations';
import {solarBody,findDefaultSolarRoute,SOLAR_EPOCH_JD,type SolarBodyId} from '../src/solar/model';
import type {Vec3} from '../src/sim';

const targets:SolarBodyId[]=['aster','mercury','venus','mars','jupiter','saturn','uranus','neptune'];
const unit=(v:Vec3)=>v.map(x=>x/Math.hypot(...v)) as Vec3;
function setup(target:SolarBodyId){const design=freshCampaign().design;design.parts.find(p=>p.kind==='camera')!.kind=observationProfile(target).sensor;const state=createOperations(design,target,8);state.playSeconds=75;return {state,design};}
function aim(state:OperationsState,detail=false,band:'visible'|'nir'='visible'):ObservationInput {
 const frame=encounterFrame(state),point=detail?state.encounter.features[2].positionBodyKm:[0,0,0] as Vec3;
 return {aimDirection:unit(point.map((x,i)=>x-frame.positionKm[i]) as Vec3),fovDeg:detail?6:65,shutterHeld:true,band};
}
function capture(state:OperationsState,detail=false,band:'visible'|'nir'='visible',seconds=1){let s=state;for(let t=0;t<seconds-1e-6;t+=.02)s=advanceOperations(s,.02,aim(s,detail,band));return releaseExposure(s);}

describe('local encounter science and recoverable operations',()=>{
 it('hyperbolic frames conserve two-body energy and angular momentum for all visitable bodies',()=>{
  for(const target of targets){const e=createEncounter(target,8),peri=localEncounterFrame(e,0);expect(peri.rangeKm).toBeCloseTo(solarBody(target).radiusKm*3,8);
   const h0=peri.positionKm[2]*peri.velocityKmS[0];
   for(const time of [-e.halfWindowSeconds,0,e.halfWindowSeconds]){const f=localEncounterFrame(e,time),energy=f.velocityKmS.reduce((n,v)=>n+v*v,0)/2-e.muKm3S2/f.rangeKm;
    expect(energy).toBeCloseTo(32,6);expect((f.positionKm[2]*f.velocityKmS[0]-f.positionKm[0]*f.velocityKmS[2])/h0).toBeCloseTo(1,9);expect(f.altitudeKm).toBeGreaterThan(0);}
  }
 });
 it('all eight targets have reachable meaningful science with actual aperture rays',()=>{
  for(const target of targets){let {state}=setup(target);
   if(state.sensor==='camera'){const wide=capture(state,false);expect(wide.record?.valid,`${target} context ${wide.record?.reason}`).toBe(true);state=wide.state;const close=capture(state,true);expect(close.record?.valid,`${target} detail ${close.record?.reason}`).toBe(true);state=close.state;}
   else{const a=capture(state,true,'visible');expect(a.record?.valid,`${target} visible ${a.record?.reason}`).toBe(true);const b=capture(a.state,true,'nir');expect(b.record?.valid,`${target} nir ${b.record?.reason}`).toBe(true);state=b.state;expect(operationsSummary(state).spectralRatio).toBeGreaterThan(0);}
   expect(operationsSummary(state).ready,target).toBe(true);expect(operationsSummary(state).transmittedReady,target).toBe(false);
  }
 });
 it('actual planned arrival speeds stay finite and produce usable local science, including faster asteroid passes',()=>{
  for(const target of targets){const route=findDefaultSolarRoute('earth',target,SOLAR_EPOCH_JD);expect(route.status).toBe('solved');if(route.status!=='solved')continue;
   const {design}=setup(target);let state=createOperations(design,target,route.arrivalVInfinityKmS);state.playSeconds=75;
   const result=capture(state,state.sensor==='spectrometer','visible',2);expect(result.record?.valid,`${target}: ${route.arrivalVInfinityKmS} km/s ${result.record?.reason}`).toBe(true);
  }
  const {design}=setup('aster');const fast=createOperations(design,'aster',80);fast.playSeconds=75;expect(capture(fast,false,'visible',3).record?.valid).toBe(true);
 });
 it('empty space and the far side cannot generate scientific credit',()=>{
  let {state}=setup('aster');const before=JSON.stringify(state);state=advanceOperations(state,1,{...aim(state),aimDirection:[0,0,1]});expect(evaluateExposure(state,{...aim(state),aimDirection:[0,0,1]}).hit).toBe(false);
  expect(releaseExposure(state).record).toBeNull();expect(state.records).toHaveLength(0);expect(before).not.toContain('NaN');
 });
 it('losing or changing the scene during a held exposure cannot award old science with a new empty photo',()=>{
  let {state}=setup('aster');
  for(let i=0;i<50;i++)state=advanceOperations(state,.02,aim(state));
  expect(operationsSummary(state).exposureSnr).toBeGreaterThan(10);
  state=advanceOperations(state,.1,{...aim(state),aimDirection:[0,0,1]});expect(state.exposure).toBeNull();expect(releaseExposure(state).record).toBeNull();
  // The next stable segment can recover normally, without losing old records.
  const recovered=capture(state,false);expect(recovered.record?.valid).toBe(true);
  let spectral=setup('venus').state;for(let i=0;i<50;i++)spectral=advanceOperations(spectral,.02,aim(spectral,true,'visible'));
  spectral=advanceOperations(spectral,.02,aim(spectral,true,'nir'));expect(spectral.exposure).toBeNull();expect(releaseExposure(spectral).record).toBeNull();
 });
 it('digital zoom changes framing but cannot exceed native angular resolution',()=>{
  const {state}=setup('mars'),input=aim(state,true);const a=evaluateExposure(state,{...input,fovDeg:6}),b=evaluateExposure(state,{...input,fovDeg:2});
  expect(b.footprintKm).toBeLessThan(a.footprintKm);expect(b.gsdM).toBeCloseTo(a.gsdM,10);
 });
 it('spectral retrieval compares the same region and returns measured contrast plus uncertainty',()=>{
  let {state}=setup('venus');const visible=capture(state,true,'visible');const nir=capture(visible.state,true,'nir');state=nir.state;
  expect(visible.record?.reflectanceEstimate).toBeCloseTo(.3,2);expect(nir.record?.reflectanceEstimate).toBeCloseTo(.24,2);
  const summary=operationsSummary(state);expect(summary.spectralRatio).toBeCloseTo(.8,2);expect(summary.spectralRatioUncertainty).toBeGreaterThan(0);
  const changed=structuredClone(state);changed.records[1].featureId=changed.encounter.features[0].id;expect(operationsSummary(changed).ready).toBe(false);
 });
 it('declining the forecast costs image stability; stabilization recovers it without deleting data',()=>{
  expect(scheduledCruiseEvent(.1)).toBeNull();expect(scheduledCruiseEvent(.3)?.id).toBe('star-reference');
  let {state}=setup('mars');state=resolveCruiseEvent(state,'continue');const unstable=capture(state,true);expect(unstable.record?.reason).toBe('blurred');expect(unstable.state.records).toHaveLength(0);
  let recovered=executeCommand(unstable.state,'stabilize');for(let i=0;i<70;i++)recovered=advanceOperations(recovered,.1,{...aim(recovered,true),shutterHeld:false});
  const stable=capture(recovered,true);expect(stable.record?.valid).toBe(true);expect(stable.record!.smearPixels).toBeLessThan(unstable.record!.smearPixels);
  const safe=resolveCruiseEvent(setup('mars').state,'safe-mode');expect(safe.playSeconds).toBe(87);expect(safe.jitterDegS).toBeLessThan(state.jitterDegS);
 });
 it('near-Sun heating is continuous; safe orientation cools and preserves acquired records',()=>{
  let {state}=setup('mercury');state=capture(state,false).state;state.temperatureC=69.9;
  for(let i=0;i<300&&state.mode!=='safe';i++)state=advanceOperations(state,.1,{...aim(state),shutterHeld:false});
  expect(state.mode).toBe('safe');expect(state.lastIssue).toBe('thermal-safe');const count=state.records.length,hot=state.temperatureC;
  for(let i=0;i<300;i++)state=advanceOperations(state,.1,{...aim(state),shutterHeld:false});
  expect(state.temperatureC).toBeLessThan(hot);expect(state.records).toHaveLength(count);
 });
 it('physical downlink is independent of asteroid slow motion and does not assert Earth receipt',()=>{
  let {state}=setup('aster');state=capture(state,false).state;state=capture(state,true).state;state.mode='downlink';const position=state.playSeconds,required=state.storedBits/state.downlinkRateBps;
  const sent=advanceDownlink(state,required+1);expect(sent.playSeconds).toBe(position);expect(sent.storedBits).toBe(0);expect(operationsSummary(sent).transmittedReady).toBe(true);expect(state.storedBits).toBeGreaterThan(0);
 });
 it('closing the finite encounter window prevents new science but retains acquired data for return',()=>{
  let {state}=setup('aster');state=capture(state,false).state;const count=state.records.length;state.playSeconds=150;
  const closed=advanceOperations(state,1,aim(state,true));expect(operationsSummary(closed).canCapture).toBe(false);expect(evaluateExposure(closed,aim(closed,true)).reason).toBe('window-closed');expect(closed.records).toHaveLength(count);expect(closed.exposure).toBeNull();
  closed.mode='downlink';expect(advanceDownlink(closed,100).records[0].transmittedBits).toBeGreaterThan(0);
 });
 it('checkpoints rebuild physics, clear held exposures and reject invalid or nonfinite science',()=>{
  const {state,design}=setup('venus');let saved=capture(state,true).state;saved=advanceOperations(saved,.1,aim(saved,true,'nir'));saved=executeCommand(saved,'safe-mode');
  const serialized=JSON.parse(JSON.stringify(saved));serialized.encounter.radiusKm=1e200;
  const restored=restoreOperations(serialized,design,'venus',8)!;expect(restored).not.toBeNull();expect(restored.exposure).toBeNull();expect(restored.encounter.radiusKm).toBe(solarBody('venus').radiusKm);expect(restored.records).toHaveLength(1);expect(restored.pendingCommand?.command).toBe('safe-mode');
  const bad=structuredClone(serialized);bad.records[0].gsdM=Infinity;expect(restoreOperations(bad,design,'venus',8)).toBeNull();expect(restoreOperations({...serialized,playSeconds:1e300},design,'venus',8)).toBeNull();expect(restoreOperations(serialized,design,'mars',8)).toBeNull();
  const overflow=structuredClone(serialized);overflow.records[0].transmittedBits=overflow.records[0].dataBits+1;expect(restoreOperations(overflow,design,'venus',8)).toBeNull();
 });
 it('rejects nonfinite orbital arguments instead of producing a corrupt encounter',()=>{
  for(const speed of [NaN,Infinity,-1,0,1e300])expect(()=>createEncounter('aster',speed)).toThrow();
  expect(()=>localEncounterFrame(createEncounter('mars',8),Infinity)).toThrow();
 });
});
