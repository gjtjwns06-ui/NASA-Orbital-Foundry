import {beforeAll,describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createSwingbyDesign,createSwingbyPlan,solveSwingbyPlan,createSwingbyRuntime,getSwingbyTelemetry,getSwingbyScenario,SWINGBY_PROPULSION,swingbyStateAt} from '../src/swingby';
import {prepareReviewFrame,ReviewFrameSelection,type ReviewSceneSample,type ReviewSceneContext} from '../src/render/review-frame';
import {SwingbyObjective} from '../src/render/swingby-objective';
import type {RunId,Sha256} from '../src/redesign/schema';
let fixture:ReviewSceneSample,context:ReviewSceneContext;
beforeAll(()=>{
 const craft=createSwingbyDesign(),solved=solveSwingbyPlan(createSwingbyPlan('starter'),craft);if(solved.status!=='solved')throw new Error('Actual initial fixture failed');const rt=createSwingbyRuntime(solved.solution,craft),physical=swingbyStateAt(rt.actualArcs,0),s=getSwingbyScenario();
 context={scenarioId:s.id,initialEpochJdTdb:s.epochJdTdb,aimPlane:s.aimPlane,goal:{targetDirection:s.exit.targetDirection,toleranceDeg:s.exit.toleranceDeg,energyRangeKm2S2:s.exit.energyRangeKm2S2},carrierProfile:SWINGBY_PROPULSION};
 // Real domain initial state. This fixture tests the display boundary; it is
 // not evidence that this unit harness performed strict save replay.
 fixture={cursor:{runId:'A' as RunId,sourceSha256:'a'.repeat(64) as Sha256,requestedTimeSeconds:0,committedTimeSeconds:0,epochJdTdb:physical.jdTdb,phase:'mars-flyby',stateOrigin:'replayed-actual'},renderDto:{craft,physical,attitudeQuaternion:rt.attitudeQuaternion,burn:null,achievedExit:null,packets:[],signals:[],events:rt.events,status:rt.status,trajectory:{kind:'actual-history',certified:true,maxChordErrorKm:0,points:[physical],sampleLimit:2000}},telemetry:{values:getSwingbyTelemetry(rt),unknownFields:[]}};
});
const sample=()=>structuredClone(fixture);
describe('same-time read-only review frames',()=>{
 it('uses the actual initial physical pose, attitude, Sun and thrust and never fabricates a future trajectory',()=>{
  const s=sample(),before=JSON.stringify(s),f=prepareReviewFrame(s,context);expect(f.snapshot.positionKm).toEqual(s.renderDto.physical.relativePositionKm);expect(f.snapshot.attitudeQuaternion).toEqual(s.renderDto.attitudeQuaternion);expect(f.snapshot.sunDirectionICRF).toEqual(s.telemetry.values.environment.sunDirection);expect(f.snapshot.engine?.thrustDirectionBody).toEqual(s.telemetry.values.thrust.thrustDirectionBody);expect(f.snapshot.objective.predictedPathKm).toEqual([]);expect(f.snapshot.objective.referencePathKm).toEqual([]);expect(f.snapshot.objective.actualPathKm).toHaveLength(1);expect(JSON.stringify(s)).toBe(before);
 });
 it('preserves requested versus committed times without rendering an uncommitted requested state',()=>{const s=sample();s.cursor={...s.cursor,requestedTimeSeconds:.1};const f=prepareReviewFrame(s,context);expect(f.cursor.requestedTimeSeconds).toBe(.1);expect(f.snapshot.timeSeconds).toBe(0);expect(f.cursor.committedTimeSeconds).toBe(0);});
 it('rejects future, mixed-frame and mixed-epoch history before it reaches the renderer',()=>{
  for(const change of [(s:ReviewSceneSample)=>{s.renderDto.trajectory.points[0].elapsedSeconds=1;},(s:ReviewSceneSample)=>{s.renderDto.physical.jdTdb+=1;},(s:ReviewSceneSample)=>{s.telemetry.values.environment.state.elapsedSeconds=1;},(s:ReviewSceneSample)=>{s.renderDto.physical.centerBody='Earth';}]){const s=sample();change(s);expect(()=>prepareReviewFrame(s,context)).toThrow();}
 });
 it('refuses unknown required Sun/thrust/pose instead of substituting zero or retaining old physical values under a new label',()=>{
  for(const change of [(s:ReviewSceneSample)=>{s.telemetry.values.environment.sunDirection[0]=null;},(s:ReviewSceneSample)=>{s.telemetry.values.thrust.thrustDirectionBody[0]=null;},(s:ReviewSceneSample)=>{s.renderDto.attitudeQuaternion[0]=NaN;}]){const s=sample();change(s);expect(()=>prepareReviewFrame(s,context)).toThrow(/UNKNOWN/);}
 });
 it('withholds uncertified historical geometry and retains its explicit availability metadata',()=>{const s=sample();Object.assign(s.renderDto.trajectory,{certified:false});const f=prepareReviewFrame(s,context);expect(f.snapshot.objective.actualPathKm).toEqual([]);expect(f.history.certified).toBe(false);});
 it('detaches craft, frame and unknown-field metadata from the source sample',()=>{const s=sample(),f=prepareReviewFrame(s,context);s.renderDto.craft.parts[0].u=999;s.renderDto.physical.relativePositionKm[0]=999;expect(f.craft.parts[0].u).not.toBe(999);expect(f.snapshot.positionKm[0]).not.toBe(999);});
 it('keeps visible A labeled A when B lacks the common cursor, then commits B only when its frame is available',()=>{
  const store=new ReviewFrameSelection(),A=prepareReviewFrame(sample(),context);store.put('A',A);store.commit(store.candidate()!);store.setSide('B');expect(store.candidate()).toBeNull();expect(store.getState()).toMatchObject({requestedSide:'B',displayedSide:'A',displayedRunId:'A',pendingSelection:true});
  const b=sample();b.cursor={...b.cursor,runId:'B' as RunId,sourceSha256:'b'.repeat(64) as Sha256};store.put('B',prepareReviewFrame(b,context));store.commit(store.candidate()!);expect(store.getState()).toMatchObject({displayedSide:'B',displayedRunId:'B',pendingSelection:false});
  store.setCommonCursor(20);expect(store.candidate()).toBeNull();expect(store.getState()).toMatchObject({displayedSide:'B',commonRequestedTimeSeconds:20,committedTimeSeconds:0,pendingSelection:true});expect(store.put('A',A)).toBe(false);
 });
 it('hides planning geometry and all aim picking in history mode while preserving ordinary flight defaults',()=>{
  const f=prepareReviewFrame(sample(),context),o=new SwingbyObjective();o.setSnapshot(f.snapshot.objective);const raw=o as unknown as {planeGroup:THREE.Group;handleGroup:THREE.Group;burnStem:THREE.Line;predicted:THREE.Line};expect(raw.planeGroup.visible).toBe(true);o.setHistoryOnly(true);expect(raw.planeGroup.visible).toBe(false);expect(raw.handleGroup.visible).toBe(false);expect(o.velocityGroup.visible).toBe(false);expect(raw.burnStem.visible).toBe(false);expect(raw.predicted.visible).toBe(false);expect(o.pickAim(new THREE.Ray())).toBe(false);o.setSnapshot({...f.snapshot.objective,revision:1});expect(raw.planeGroup.visible).toBe(false);o.setHistoryOnly(false);expect(raw.planeGroup.visible).toBe(true);o.dispose();
 });
});
