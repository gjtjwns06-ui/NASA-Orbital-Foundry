import {describe,it,expect} from 'vitest';
import {swingbyScenePosition,validateSwingbySceneSnapshot,canInspectSwingbyState,type SwingbySceneSnapshot} from '../src/render/swingby-scene';
const state=():SwingbySceneSnapshot=>({timeSeconds:0,positionKm:[25000,1500,-2000],attitudeQuaternion:[0,0,0,1],sunDirectionICRF:[1,0,0],marsSurfaceRotationRad:.2,objective:{scenarioId:'fixed-scenario',revision:1,elapsedSeconds:0,aimPlane:{centerKm:[0,0,30000],xAxis:[1,0,0],yAxis:[0,1,0],normal:[0,0,1]},aim:{xKm:0,yKm:0},referencePathKm:[],predictedPathKm:[],actualPathKm:[],correction:null,predictedExit:null,achievedExit:null,goal:{targetDirection:[1,0,0],toleranceDeg:.12,energyRangeKm2S2:[-284.5,-279.5]},previewStatus:'accepted'}});
describe('Mars-only scene actual-state adapter',()=>{
 it('maps supplied Mars-relative ICRF positions without orbital propagation or moving the body',()=>{
  expect(swingbyScenePosition([3389.5,0,0]).toArray()).toEqual([3,0,-0]);expect(swingbyScenePosition([0,3389.5,0]).toArray()).toEqual([0,0,-3]);expect(swingbyScenePosition([0,0,3389.5]).toArray()).toEqual([0,3,-0]);
 });
 it('accepts a single coherent actual epoch without changing caller state',()=>{const s=state(),before=structuredClone(s);expect(()=>validateSwingbySceneSnapshot(s)).not.toThrow();expect(s).toEqual(before);});
 it('rejects mixed actual/objective epochs and invalid position/attitude rather than fabricating a preview',()=>{
  expect(()=>validateSwingbySceneSnapshot({...state(),timeSeconds:20})).toThrow(/display epoch/);expect(()=>validateSwingbySceneSnapshot({...state(),positionKm:[NaN,0,1000]})).toThrow(/vector/);expect(()=>validateSwingbySceneSnapshot({...state(),attitudeQuaternion:[0,0,0,0]})).toThrow(/quaternion/);expect(()=>validateSwingbySceneSnapshot({...state(),sunDirectionICRF:[2,0,0]})).toThrow(/unit/);
 });
 it('requires an actual body-frame unit thrust vector when engine pose is supplied',()=>{
  expect(()=>validateSwingbySceneSnapshot({...state(),engine:{partId:'engine',thrustDirectionBody:[0,1,0]}})).not.toThrow();expect(()=>validateSwingbySceneSnapshot({...state(),engine:{partId:'engine',thrustDirectionBody:[0,2,0]}})).toThrow(/unit vector/);
 });
 it('accepts terminal surface/contact states unchanged while making close inspection unavailable',()=>{
  for(const radius of [0,3389.49,3389.5,3389.501,3389.52]){const s={...state(),positionKm:[0,0,radius] as const},before=structuredClone(s);expect(()=>validateSwingbySceneSnapshot(s)).not.toThrow();expect(canInspectSwingbyState(s)).toBe(false);expect(s).toEqual(before);}
  expect(canInspectSwingbyState({...state(),positionKm:[0,0,3389.6]})).toBe(true);
 });
});
