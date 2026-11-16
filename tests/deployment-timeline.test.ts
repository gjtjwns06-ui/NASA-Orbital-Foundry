import {describe,it,expect} from 'vitest';
import {editDeploymentInterval} from '../src/deployment-timeline';
describe('deployment execution-window boundaries',()=>{
 it('retains a valid short imported window at the terminal boundary',()=>{
  expect(editDeploymentInterval(10799,10800,0,true)).toEqual({start:10799,end:10800});
  expect(editDeploymentInterval(10799,10800,60,true)).toEqual({start:10799,end:10800});
  expect(editDeploymentInterval(10799,10800,-60,true)).toEqual({start:10799,end:10800});
 });
 it('moves the whole interval inside the mission without shortening it',()=>{
  expect(editDeploymentInterval(600,1800,-1000,false)).toEqual({start:0,end:1200});
  expect(editDeploymentInterval(600,1800,20000,false)).toEqual({start:9600,end:10800});
 });
 it('rejects non-finite and already out-of-mission imported boundaries',()=>{
  expect(()=>editDeploymentInterval(10,20,NaN,false)).toThrow('INVALID_TIMELINE_INTERVAL');
  expect(()=>editDeploymentInterval(10799,10801,0,true)).toThrow('INVALID_TIMELINE_INTERVAL');
 });
});
