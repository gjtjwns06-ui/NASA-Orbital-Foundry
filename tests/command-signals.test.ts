import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {COMMAND_SIGNAL_LIMITS,CommandSignals,sampleCommandSignal,type CommandSignalDTO,type SignalPositionMapper} from '../src/render/command-signals';

const signal = (): CommandSignalDTO => ({
  id:'frame-1',commandId:'instruction-1',kind:'command',
  firstBit:{emittedAtSeconds:10,arrivesAtSeconds:20,emitterPositionKm:[0,0,0],receiverPositionKm:[100,0,0]},
  lastBit:{emittedAtSeconds:12,arrivesAtSeconds:22,emitterPositionKm:[0,10,0],receiverPositionKm:[120,20,0]},
});
const icrfToScene:SignalPositionMapper=(p,out)=>{out.set(p[0]*.1,p[2]*.1,-p[1]*.1);};
const item=(renderer:CommandSignals,id='frame-1')=>renderer.group.getObjectByName(`signal:${id}`)!;
const marker=(renderer:CommandSignals,name:string)=>item(renderer).getObjectByName(name)!;
const position=(renderer:CommandSignals,name:string)=>marker(renderer,name).position.toArray();
const frameGeometry=(renderer:CommandSignals)=>(marker(renderer,'emission-reception-guides') as THREE.LineSegments).geometry;
const expectPosition=(actual:number[],expected:number[])=>expected.forEach((value,axis)=>expect(actual[axis]).toBeCloseTo(value,10));

describe('command signal causal geometry',()=>{
 it('uses independent retarded endpoints and durations for first and last bits',()=>{
  const data=signal(),before=structuredClone(data),sample=sampleCommandSignal(data,15);
  expect(sample.firstBit).toEqual({inFlight:true,emitted:true,progress:.5,positionKm:[50,0,0]});
  expect(sample.lastBit).toEqual({inFlight:true,emitted:true,progress:.3,positionKm:[36,13,0]});
  expect(data).toEqual(before);
  expect(Object.keys(sample).sort()).toEqual(['commandId','firstBit','id','kind','lastBit','lastBitIsPlanned','visible']);
 });
 it('hides the frame before emission and at complete arrival, with no early last-bit marker',()=>{
  const renderer=new CommandSignals();renderer.setSignals([signal()]);
  expect(renderer.update(9,icrfToScene)[0].visible).toBe(false);expect(item(renderer).visible).toBe(false);
  renderer.update(10,icrfToScene);expect(marker(renderer,'first-bit').visible).toBe(true);expect(marker(renderer,'last-bit').visible).toBe(false);expect(frameGeometry(renderer).drawRange.count).toBe(2);
  renderer.update(12,icrfToScene);expect(marker(renderer,'last-bit').visible).toBe(true);expect(position(renderer,'last-bit')).toEqual([0,0,-1]);expect(frameGeometry(renderer).drawRange.count).toBe(4);
  renderer.update(20,icrfToScene);expect(marker(renderer,'first-bit').visible).toBe(false);expect(marker(renderer,'last-bit').visible).toBe(true);
  const end=renderer.update(22,icrfToScene)[0];expect(end.visible).toBe(false);expect(item(renderer).visible).toBe(false);expect(marker(renderer,'last-bit').visible).toBe(false);expect(end.lastBit.progress).toBe(1);
  renderer.dispose();
 });
 it('applies the caller frame to every endpoint and moving marker, without using renderer time',()=>{
  const renderer=new CommandSignals();renderer.setSignals([signal()]);renderer.update(15,icrfToScene);
  expectPosition(position(renderer,'first-bit'),[5,0,0]);expectPosition(position(renderer,'last-bit'),[3.6,0,-1.3]);
  const mapped:SignalPositionMapper=(p,out)=>{out.set((p[0]-50)*.1,(p[2]-5)*.1,-(p[1]-10)*.1);};
  renderer.update(15,mapped);expect(position(renderer,'first-bit')).toEqual([0,-.5,1]);
  const points=frameGeometry(renderer).getAttribute('position');expect([points.getX(0),points.getY(0),points.getZ(0)]).toEqual([-5,-.5,1]);expect([points.getX(3),points.getY(3),points.getZ(3)]).toEqual([7,-.5,-1]);
  renderer.dispose();
 });
 it('supports a finite emission interval longer than the light time without inventing a travelling bit',()=>{
  const renderer=new CommandSignals(),data=signal();
  const longFrame={...data,lastBit:{...data.lastBit,emittedAtSeconds:30,arrivesAtSeconds:40}};
  renderer.setSignals([longFrame]);const sample=renderer.update(25,icrfToScene)[0];
  expect(sample.visible).toBe(true);expect(marker(renderer,'first-bit').visible).toBe(false);expect(marker(renderer,'last-bit').visible).toBe(false);expect(sample.lastBit.positionKm).toBe(null);
  renderer.dispose();
 });
 it('distinguishes command and ACK colours and first/last-bit geometry without altering status',()=>{
  const renderer=new CommandSignals(),data=signal(),ack={...signal(),id:'ack-1',kind:'ack' as const};renderer.setSignals([data,ack]);renderer.update(15,icrfToScene);
  const first=marker(renderer,'first-bit') as THREE.Mesh,last=marker(renderer,'last-bit') as THREE.Mesh,ackFirst=item(renderer,'ack-1').getObjectByName('first-bit') as THREE.Mesh;
  expect((first.material as THREE.MeshBasicMaterial).wireframe).toBe(false);expect((last.material as THREE.MeshBasicMaterial).wireframe).toBe(true);
  expect((first.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x77e1d1);expect((ackFirst.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xf3b56b);
  expect(data).toEqual(signal());renderer.dispose();
 });
 it('reduced motion keeps a static direction guide while returning truthful progress',()=>{
  const renderer=new CommandSignals();renderer.setSignals([signal()]);const first=renderer.update(13,icrfToScene,{reducedMotion:true})[0],p1=position(renderer,'static-direction');
  const second=renderer.update(17,icrfToScene,{reducedMotion:true})[0],p2=position(renderer,'static-direction');
  expect(first.firstBit.progress).toBe(.3);expect(second.firstBit.progress).toBe(.7);expect(p1).toEqual(p2);
  expect(marker(renderer,'first-bit').visible).toBe(false);expect(marker(renderer,'last-bit').visible).toBe(false);expect(marker(renderer,'static-direction').visible).toBe(true);
  renderer.update(17,icrfToScene);expect(marker(renderer,'first-bit').visible).toBe(true);expect(marker(renderer,'static-direction').visible).toBe(false);renderer.dispose();
 });
 it('never turns a planned tail into an emitted bit, even after its forecast emission',()=>{
  const renderer=new CommandSignals(),predicted={...signal(),lastBitIsPlanned:true};renderer.setSignals([predicted]);
  const stale=renderer.update(15,icrfToScene)[0];expect(stale.lastBitIsPlanned).toBe(true);expect(stale.lastBit).toEqual({inFlight:false,emitted:false,progress:0,positionKm:null});
  expect(marker(renderer,'first-bit').visible).toBe(true);expect(marker(renderer,'last-bit').visible).toBe(false);expect(frameGeometry(renderer).drawRange.count).toBe(2);
  renderer.update(20,icrfToScene);expect(item(renderer).visible).toBe(false);
  renderer.setSignals([{...predicted,lastBitIsPlanned:false}]);renderer.update(20,icrfToScene);expect(item(renderer).visible).toBe(true);expect(marker(renderer,'last-bit').visible).toBe(true);
  renderer.dispose();
 });
});

describe('command signal bounds and ownership',()=>{
 it('rejects malformed snapshots atomically, retaining the previous entry and buffers',()=>{
  const renderer=new CommandSignals();renderer.setSignals([signal()]);const original=item(renderer),buffer=frameGeometry(renderer);
  const bad:unknown[]=[
   {...signal(),id:''},{...signal(),id:'bad\nidentifier'},{...signal(),commandId:'x'.repeat(COMMAND_SIGNAL_LIMITS.idLength+1)},
   {...signal(),kind:'receipt'},
   {...signal(),lastBitIsPlanned:'yes'},
   {...signal(),firstBit:{...signal().firstBit,emittedAtSeconds:NaN}},
   {...signal(),firstBit:{...signal().firstBit,emittedAtSeconds:-1}},
   {...signal(),firstBit:{...signal().firstBit,arrivesAtSeconds:10}},
   {...signal(),lastBit:{...signal().lastBit,emittedAtSeconds:9}},
   {...signal(),lastBit:{...signal().lastBit,arrivesAtSeconds:19}},
   {...signal(),lastBit:{...signal().lastBit,receiverPositionKm:[Infinity,0,0]}},
   {...signal(),lastBit:{...signal().lastBit,receiverPositionKm:[1e13,0,0]}},
   {...signal(),lastBit:{...signal().lastBit,receiverPositionKm:[0,0]}},
  ];
  for(const value of bad)expect(()=>renderer.setSignals([value as CommandSignalDTO])).toThrow();
  expect(()=>renderer.setSignals([signal(),signal()])).toThrow(/Duplicate/);
  expect(()=>renderer.setSignals(Array.from({length:COMMAND_SIGNAL_LIMITS.count+1},(_,i)=>({...signal(),id:String(i)})))).toThrow(/count/);
  expect(item(renderer)).toBe(original);expect(frameGeometry(renderer)).toBe(buffer);renderer.dispose();
 });
 it('detaches caller data and keeps equal updates resource-idempotent',()=>{
  const renderer=new CommandSignals(),input=structuredClone(signal());renderer.setSignals([input]);const original=item(renderer),geometry=frameGeometry(renderer);let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
  renderer.setSignals([structuredClone(input)]);expect(item(renderer)).toBe(original);expect(frameGeometry(renderer)).toBe(geometry);expect(disposed).toBe(0);
  (input as unknown as {firstBit:{emitterPositionKm:number[]}}).firstBit.emitterPositionKm[0]=999;renderer.update(15,icrfToScene);expectPosition(position(renderer,'first-bit'),[5,0,0]);
  renderer.dispose();expect(disposed).toBe(1);
 });
 it('does not write nonfinite or out-of-range mapped values into live buffers',()=>{
  const renderer=new CommandSignals();renderer.setSignals([signal()]);renderer.update(15,icrfToScene);const before=Array.from(frameGeometry(renderer).getAttribute('position').array);
  expect(()=>renderer.update(NaN,icrfToScene)).toThrow();expect(()=>renderer.update(-1,icrfToScene)).toThrow();
  expect(()=>renderer.update(15,(_p,out)=>{out.set(Infinity,0,0);})).toThrow();expect(()=>renderer.update(15,(_p,out)=>{out.set(1e8,0,0);})).toThrow();
  expect(Array.from(frameGeometry(renderer).getAttribute('position').array)).toEqual(before);renderer.dispose();
 });
 it('disposes per-signal buffers once and owned shared materials/geometries exactly once',()=>{
  const renderer=new CommandSignals(),parent=new THREE.Group();parent.add(renderer.group);renderer.setSignals([signal(),{...signal(),id:'ack-1',kind:'ack'}]);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  renderer.group.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.LineSegments){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
  const counts=new Map<THREE.BufferGeometry|THREE.Material,number>();for(const object of [...geometries,...materials]){counts.set(object,0);object.addEventListener('dispose',()=>counts.set(object,counts.get(object)!+1));}
  const removed=frameGeometry(renderer);renderer.setSignals([{...signal(),id:'ack-1',kind:'ack'}]);expect(counts.get(removed)).toBe(1);
  for(const material of materials)expect(counts.get(material)).toBe(0);
  renderer.dispose();renderer.dispose();expect(parent.children).toHaveLength(0);expect(renderer.group.children).toHaveLength(0);
  for(const count of counts.values())expect(count).toBe(1);
  expect(()=>renderer.setSignals([])).toThrow(/disposed/);expect(()=>renderer.update(0,icrfToScene)).toThrow(/disposed/);
 });
});
