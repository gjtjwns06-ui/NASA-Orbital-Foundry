import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import catalogSnapshot from '../public/data/hardware-catalog-v2.json';
import {BUSES,HARDWARE_MODELS,HARDWARE_CATALOG_HASH,HARDWARE_VERSION,HARDWARE_TRANSFER_MISSION_BUDGET,LEGACY_TRANSFER_MISSION_BUDGET,hardwareSafePower} from '../src/hardware';
import {createHardwareDesign,createHardwareRegionDesign,createHardwarePart,getPartDefinition,resolveHardware,hardwareAttitudeLimits,hardwareSlew,advanceAcquisition,connectedInstruments} from '../src/hardware';
import {createSimulation,advanceSimulation,getResult,previewMission,evaluateDesign,getTelemetry,evaluateEarthTarget,earthStateAt,earthSubpoint,quaternionAngleDeg} from '../src/sim';
import type {HardwareRuntimeData} from '../src/hardware';

describe('hardware runtime consequences',()=>{
 it('pins the exact public catalog content, not a draft or arbitrary label',()=>{
  const content={version:HARDWARE_VERSION,buses:BUSES,models:HARDWARE_MODELS,transferBudget:HARDWARE_TRANSFER_MISSION_BUDGET,legacyTransferBudget:LEGACY_TRANSFER_MISSION_BUDGET};expect(content).toEqual(catalogSnapshot.content);expect(createHash('sha256').update(JSON.stringify(content)).digest('hex')).toBe(HARDWARE_CATALOG_HASH);expect(catalogSnapshot.sha256).toBe(HARDWARE_CATALOG_HASH);expect(Object.keys(HARDWARE_MODELS)).toHaveLength(16);
 });
 for(const mission of ['earth','mars'] as const)for(const preset of ['balanced','science'] as const)it(`${mission} ${preset} returns enough real received packets`,()=>{
  const d=createHardwareDesign(mission,preset),p=previewMission(d);expect(evaluateDesign(d).launchable).toBe(true);expect(p.result.status).toBe('success');expect(p.result.received).toBeGreaterThanOrEqual(p.result.required);expect(p.finalState.modelVersion).toBe('2.0.0');expect(p.finalState.dataPackets.every(x=>x.bits===getPartDefinition(d,d.parts.find(p=>p.kind===(mission==='earth'?'camera':'spectrometer'))!).optics!.bitsPerFrame)).toBe(true);
 });
 it('a missing battery is a finite failed result, never NaN credits or score',()=>{
  const s=createSimulation(createHardwareDesign('earth','starter')),r=getResult(s);expect(s.status).toBe('failed');expect([r.score,r.resourceScore,r.energyMinimumWh,r.fuelRemainingKg].every(Number.isFinite)).toBe(true);expect(r.resourceScore).toBeGreaterThanOrEqual(0);
 });
 it('safe mode retains real sun-seeking ADCS power instead of free slewing',()=>{const d=createHardwareDesign(),a=hardwareSafePower(d,false),b=hardwareSafePower(d,true);expect(b).toBeGreaterThan(a);const s=createSimulation(d);s.safeMode=true;advanceSimulation(s,5);expect(getTelemetry(s).loadPowerW).toBeGreaterThanOrEqual(a);});
 it('mixed optical payloads are explicitly blocked instead of borrowing visibility and resolution',()=>{
  const d=createHardwareDesign('earth','science');d.parts.push(createHardwarePart('narrow-mono-v2','second-camera','nz',.4,.4));expect(resolveHardware(d).issues.some(i=>i.code==='INSTRUMENT_COUNT')).toBe(true);expect(evaluateDesign(d).launchable).toBe(false);
 });
 it('wheel momentum and geometry-based inertia bound actual angular motion',()=>{
  const d=createHardwareDesign('earth','balanced'),from:[number,number,number,number]=[0,0,0,1],to:[number,number,number,number]=[0,1,0,0],limits=hardwareAttitudeLimits(d),turned=hardwareSlew(d,from,to,1);expect(quaternionAngleDeg(from,turned.quaternion)).toBeLessThanOrEqual(limits.accelerationDegS2*.5+1e-8);expect(turned.rateDegS).toBeLessThanOrEqual(limits.maximumRateDegS);
  const slow=structuredClone(d);slow.parts=slow.parts.map(p=>p.kind==='adcs'?createHardwarePart('xact15-carrier-v1',p.id,p.face,p.u,p.v):p);expect(hardwareAttitudeLimits(slow).maximumRateDegS).toBeLessThan(limits.maximumRateDegS);const outcome=previewMission(slow);expect(outcome.result.received).toBeLessThan(previewMission(d).result.received);
 });
 it('camera IFOV and footprint are from the same chosen model and affect regional science',()=>{
  const d=createHardwareDesign('earth','science'),r=earthStateAt(d.plan,1200).positionKm,target={profile:'survey' as const,...earthSubpoint(r,1200)},wide=getPartDefinition(d,d.parts.find(p=>p.kind==='camera')!).optics!,narrow=getPartDefinition(d,createHardwarePart('narrow-mono-v2','narrow','nz')).optics!;
  const a=evaluateEarthTarget(target,r,1200,600,1,wide),b=evaluateEarthTarget(target,r,1200,600,1,narrow);expect(a.groundSamplingDistanceM).toBeGreaterThan(b.groundSamplingDistanceM);expect(a.groundFootprintRadiusKm).toBeGreaterThan(b.groundFootprintRadiusKm);expect(a.resolutionAcceptable).toBe(false);expect(b.resolutionAcceptable).toBe(true);
 });
 it('exposure and data readout take real time and respect port bandwidth',()=>{
  const d=createHardwareDesign('earth','balanced'),source=connectedInstruments(d,'camera')[0],instrument={...source,definition:{...source.definition,optics:{...source.definition.optics!,exposureSeconds:5}}},bits=instrument.definition.optics!.bitsPerFrame,state:HardwareRuntimeData={angularRateDegS:0,acquisition:null},candidate={id:'a',target:'a',quality:.9};
  advanceAcquisition(state,instrument,5,0,true,candidate,1e6,bits);expect(state.acquisition?.remainingBits).toBe(bits);expect(advanceAcquisition(state,instrument,5,5,true,candidate,1e6,bits).completed).toBe(null);expect(state.acquisition?.remainingBits).toBe(bits);expect(advanceAcquisition(state,instrument,10,15,true,candidate,1e6,bits).completed).toBe(null);const done=advanceAcquisition(state,instrument,1,16,true,candidate,1e6,bits).completed;expect(done?.bits).toBe(bits);expect(done?.startedAt).toBe(0);
 });
 it('lost pointing during exposure discards the unfinished frame',()=>{
  const d=createHardwareDesign(),instrument=connectedInstruments(d,'camera')[0],state:HardwareRuntimeData={angularRateDegS:0,acquisition:null};advanceAcquisition(state,instrument,5,0,true,{id:'a',target:'a',quality:1},1e6,1e9);const r=advanceAcquisition(state,instrument,1,1,false,null,1e6,1e9);expect(r.cancelled).toBe(true);expect(state.acquisition).toBe(null);
 });
 for(const profile of ['precision','survey'] as const)it(`actual ${profile} detector window completes a selected-region mission`,()=>{const d=createHardwareRegionDesign(profile),r=previewMission(d),pixels=profile==='precision'?1024:512;expect(r.result.status).toBe('success');expect(r.result.received).toBeGreaterThanOrEqual(profile==='precision'?1:4);expect(r.finalState.dataPackets.every(p=>p.bits===pixels*pixels*12)).toBe(true);const wide=structuredClone(d);wide.parts=wide.parts.map(p=>p.kind==='camera'?createHardwarePart('wide-mono-v2',p.id,p.face,p.u,p.v):p);expect(previewMission(wide).result.received).toBe(0);});
 it('a detector crop cannot claim a larger region than its projected pixel window',()=>{const d=createHardwareRegionDesign('precision');d.plan.altitudeKm=400;const r=earthStateAt(d.plan,1500).positionKm,target={profile:'precision' as const,...earthSubpoint(r,1500)},optics=connectedInstruments(d,'camera')[0].definition.optics!,e=evaluateEarthTarget(target,r,1500,400,1,optics,true);expect(e.resolutionAcceptable).toBe(true);expect(e.detectorWindowCoverageKm).toBeLessThan(20);expect(e.windowCoverageAcceptable).toBe(false);expect(e.eligible).toBe(false);});
 it('elapsed request partitioning leaves the new controller and science identical',()=>{
  const d=createHardwareDesign(),a=createSimulation(d),b=createSimulation(d);advanceSimulation(a,2400);for(let i=0;i<240;i++)advanceSimulation(b,10);expect(b).toEqual(a);expect(getTelemetry(a).energyWh).toBeGreaterThan(0);
 });
});
