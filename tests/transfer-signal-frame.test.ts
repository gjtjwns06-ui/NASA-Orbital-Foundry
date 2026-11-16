import {describe,expect,it} from 'vitest';
import {transferSignalDisplayFrame} from '../src/render/transfer-scene';
import {AU_KM,TRANSFER_EARTH_RADIUS_KM,TRANSFER_MARS_RADIUS_KM} from '../src/transfer/state';
import type {TransferStateVector} from '../src/transfer/types';

const frame=(phase:TransferStateVector['phase'])=>({phase,centerPositionKm:[100,200,300] as [number,number,number]});
describe('transfer RF frame uses one current epoch',()=>{
 it('uses heliocentric origin and AU scale for every solar phase',()=>{
  for(const phase of ['earth-escape','solar-coast','mars-flyby'] as const){const result=transferSignalDisplayFrame('solar',frame(phase),false);expect(result.visible).toBe(true);expect(result.centerPositionKm).toEqual([0,0,0]);expect(result.scale).toBe(10/AU_KM);}
 });
 it('uses the same current body origin for all local emission/reception endpoints',()=>{
  for(const [view,phase,radius] of [['earth','earth-escape',TRANSFER_EARTH_RADIUS_KM],['mars','mars-flyby',TRANSFER_MARS_RADIUS_KM]] as const){const state=frame(phase),result=transferSignalDisplayFrame(view,state,false);expect(result.visible).toBe(true);expect(result.centerPositionKm).toEqual(state.centerPositionKm);expect(result.centerPositionKm).not.toBe(state.centerPositionKm);expect(result.scale).toBe(3/radius);}
 });
 it('hides live RF in other-epoch local previews instead of mixing time frames',()=>{
  expect(transferSignalDisplayFrame('earth',frame('earth-escape'),true).visible).toBe(false);
  expect(transferSignalDisplayFrame('mars',frame('mars-flyby'),true).visible).toBe(false);
  expect(transferSignalDisplayFrame('earth',frame('solar-coast'),false).visible).toBe(false);
  expect(transferSignalDisplayFrame('mars',frame('earth-escape'),false).visible).toBe(false);
 });
});
