import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {SwingbyObjective,intersectSwingbyAimPlane,magnifiedVelocityDirection,type SwingbyObjectiveSnapshot} from '../src/render/swingby-objective';
const plane={centerKm:[0,0,100] as const,xAxis:[1,0,0] as const,yAxis:[0,1,0] as const,normal:[0,0,1] as const};
const exit={time:20,localPositionKm:[30,0,100] as const,heliocentricVelocityKmS:[.02,0,20] as const,energyKm2S2:-281,directionErrorDeg:.0573,directionPassed:true,energyPassed:true};
const snapshot=():SwingbyObjectiveSnapshot=>({scenarioId:'immutable-target-v1',revision:4,elapsedSeconds:10,aimPlane:plane,aim:{xKm:2,yKm:3},referencePathKm:[[0,0,100],[1,0,100]],predictedPathKm:[[0,0,100],[30,0,100]],actualPathKm:[[0,0,100],[10,0,100]],correction:{time:12,positionKm:[10,0,100],vectorMps:[0,2,0]},predictedExit:exit,achievedExit:null,goal:{targetDirection:[0,0,1],toleranceDeg:.12,energyRangeKm2S2:[-284.5,-279.5]},previewStatus:'accepted'});
const position=(line:THREE.Object3D,index:number)=>{const a=(line as THREE.Line).geometry.getAttribute('position');return [a.getX(index),a.getY(index),a.getZ(index)];};

describe('swingby objective physical display and ownership',()=>{
 it('intersects the frozen physical plane with exact kilometres without solving or clamping',()=>{
  expect(intersectSwingbyAimPlane(new THREE.Ray(new THREE.Vector3(12,-7,200),new THREE.Vector3(0,0,-1)),plane)).toEqual({xKm:12,yKm:-7});
  expect(intersectSwingbyAimPlane(new THREE.Ray(new THREE.Vector3(0,0,200),new THREE.Vector3(1,0,0)),plane)).toBeNull();
 });
 it('maps actual input positions through the same ICRF display frame',()=>{
  const o=new SwingbyObjective(),s=snapshot(),before=structuredClone(s);o.setDisplayFrame([10,0,100],.1);o.setSnapshot(s);
  expect(position(o.group.getObjectByName('predicted-path')!,0)).toEqual([-1,0,-0]);expect(position(o.group.getObjectByName('predicted-path')!,1)).toEqual([2,0,-0]);
  expect(o.group.getObjectByName('predicted-outward-exit')!.position.toArray()).toEqual([2,0,-0]);expect(s).toEqual(before);o.dispose();
 });
 it('keeps planned and recorded exit truth separate and rejects a future achieved event',()=>{
  const o=new SwingbyObjective(),s=snapshot();o.setSnapshot(s);expect(o.group.getObjectByName('recorded-outward-exit')!.visible).toBe(false);expect(o.getLabelDTOs()!.velocity.achieved).toBeNull();
  expect(()=>o.setSnapshot({...s,achievedExit:exit})).toThrow(/before its event/);o.setSnapshot({...s,elapsedSeconds:21,achievedExit:{...exit,directionPassed:false}});
  expect(o.getLabelDTOs()!.velocity.achieved!.directionPassed).toBe(false);expect(o.getLabelDTOs()!.velocity.predicted!.directionPassed).toBe(true);o.dispose();
 });
 it('mutes pending paths, hides invalid prediction and preserves recorded truth',()=>{
  const o=new SwingbyObjective(),s={...snapshot(),elapsedSeconds:21,achievedExit:exit};o.setSnapshot({...s,previewStatus:'pending'});
  expect((o.group.getObjectByName('predicted-path') as THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>).material.opacity).toBe(.24);expect(o.group.getObjectByName('predicted-outward-exit')!.visible).toBe(false);
  o.setSnapshot({...s,previewStatus:'invalid'});expect(o.group.getObjectByName('predicted-path')!.visible).toBe(false);expect(o.getLabelDTOs()!.velocity.predicted).toBeNull();expect(o.group.getObjectByName('recorded-outward-exit')!.visible).toBe(true);o.dispose();
 });
 it('drag returns only a provisional physical aim and cancellation preserves the accepted snapshot',()=>{
  const o=new SwingbyObjective();o.setDisplayFrame([0,0,100],.1);o.setSnapshot(snapshot());const before=o.getLabelDTOs();
  // ICRF +Z maps to Three +Y. The plane is y=0 in this display frame.
  const first=new THREE.Ray(new THREE.Vector3(.2,10,-.3),new THREE.Vector3(0,-1,0));expect(o.pickAim(first)).toBe(true);expect(o.beginAimDrag(first)).toMatchObject({xKm:2,yKm:3,revision:4});
  const move=new THREE.Ray(new THREE.Vector3(1.5,10,.8),new THREE.Vector3(0,-1,0));expect(o.updateAimDrag(move)).toMatchObject({xKm:15,yKm:-8});expect(o.getLabelDTOs()!.aim.ghost).toBe(true);expect(o.endAimDrag(false)).toBeNull();expect(o.getLabelDTOs()).toEqual(before);
  o.beginAimDrag(first);o.updateAimDrag(move);expect(o.endAimDrag(true)).toMatchObject({xKm:15,yKm:-8,scenarioId:'immutable-target-v1'});expect(o.getLabelDTOs()).toEqual(before);o.dispose();
 });
 it('correctly maps world-space picking through a parent scene transform',()=>{
  const o=new SwingbyObjective();o.setDisplayFrame([0,0,100],.1);o.setSnapshot(snapshot());const parent=new THREE.Group();parent.position.set(7,-4,2);parent.rotation.z=.3;parent.add(o.group);parent.updateMatrixWorld(true);
  const ray=new THREE.Ray(new THREE.Vector3(.2,10,-.3),new THREE.Vector3(0,-1,0)).applyMatrix4(parent.matrixWorld);expect(o.beginAimDrag(ray)!.xKm).toBeCloseTo(2,10);expect(o.endAimDrag(true)!.yKm).toBeCloseTo(3,10);o.dispose();
 });
 it('does not allow pending or disabled input to change target geometry',()=>{
  const o=new SwingbyObjective();o.setDisplayFrame([0,0,100],.1);const ray=new THREE.Ray(new THREE.Vector3(.2,10,-.3),new THREE.Vector3(0,-1,0));o.setSnapshot({...snapshot(),previewStatus:'pending'});expect(o.beginAimDrag(ray)).toBeNull();o.setSnapshot(snapshot());o.setEditing(false);expect(o.beginAimDrag(ray)).toBeNull();o.dispose();
 });
 it('declares velocity-space angular magnification while retaining physical tolerances and energy',()=>{
  const o=new SwingbyObjective();o.setSnapshot(snapshot());o.setVelocityDisplay({angularMagnification:40});const labels=o.getLabelDTOs()!;
  expect(labels.velocity.space).toBe('heliocentric-velocity');expect(labels.velocity.physicalToleranceDeg).toBe(.12);expect(labels.velocity.displayToleranceDeg).toBe(4.8);expect(labels.velocity.energyRangeKm2S2).toEqual([-284.5,-279.5]);
  const d=magnifiedVelocityDirection([Math.sin(.01),0,Math.cos(.01)],[0,0,1],40);expect(d.displayAngleRad).toBeCloseTo(.4,9);expect(d.physicalAngleRad).toBeCloseTo(.01,9);expect(d.clamped).toBe(false);expect(magnifiedVelocityDirection([1,0,0],[0,0,1],40).clamped).toBe(true);o.dispose();
 });
 it('keeps resource identity stable across snapshots/drag and releases each resource once',()=>{
  const o=new SwingbyObjective();o.setDisplayFrame([0,0,100],.1);o.setSnapshot(snapshot());const counts=o.getResourceCounts(),resources=new Set<THREE.BufferGeometry|THREE.Material>();
  for(const root of [o.group,o.velocityGroup])root.traverse(n=>{if(n instanceof THREE.Mesh||n instanceof THREE.Line){resources.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])resources.add(m);}});
  const spies=[...resources].map(r=>{const fn=vi.fn();r.addEventListener('dispose',fn);return fn;});const originalPath=(o.group.getObjectByName('predicted-path') as THREE.Line).geometry;
  for(let i=0;i<100;i++){o.setSnapshot({...snapshot(),revision:i,predictedPathKm:[[0,0,100],[i,0,100]]});o.setVelocityDisplay({angularMagnification:20+i*.1});}
  expect(o.getResourceCounts()).toEqual(counts);expect((o.group.getObjectByName('predicted-path') as THREE.Line).geometry).toBe(originalPath);expect(spies.every(s=>s.mock.calls.length===0)).toBe(true);o.dispose();o.dispose();expect(spies.every(s=>s.mock.calls.length===1)).toBe(true);expect(o.getResourceCounts()).toEqual({geometries:0,materials:0,textures:0,disposed:true});
 });
 it('rejects malformed/oversized DTOs before replacing the current accepted display',()=>{
  const o=new SwingbyObjective();o.setSnapshot(snapshot());const before=o.getLabelDTOs();expect(()=>o.setSnapshot({...snapshot(),aimPlane:{...plane,yAxis:[1,0,0]}})).toThrow(/orthonormal/);expect(()=>o.setSnapshot({...snapshot(),aim:{xKm:NaN,yKm:0}})).toThrow();expect(()=>o.setSnapshot({...snapshot(),predictedPathKm:Array.from({length:16385},()=>[0,0,0] as const)})).toThrow(/budget/);expect(o.getLabelDTOs()).toEqual(before);o.setSnapshot(null);expect(o.group.visible).toBe(false);expect(o.getLabelDTOs()).toBeNull();o.dispose();
 });
});
