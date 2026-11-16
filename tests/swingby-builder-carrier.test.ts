import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {SwingbyBuilderCarrier} from '../src/render/swingby-builder-carrier';
import type {SwingbyCarrierProfile} from '../src/render/swingby-carrier';
import {retireContextResources} from '../src/render/context-resources';
const profile:SwingbyCarrierProfile={id:'test-cg-v1',hash:'authored-test',engineModelId:'chemical230-v2',provenance:'game-assumption',carrierMassKg:.4,carrierCost:12,maximumGimbalDeg:10,geometry:{envelope:{center:[0,0,.3],half:[.19,.19,.3]},annulus:{center:[0,0,.07],outerRadiusM:.18,innerRadiusM:.07,thicknessM:.04},pivot:[0,0,.12],nominalThrust:[0,0,-1],bell:{lengthM:.46,mouthRadiusM:.10,neckRadiusM:.025}}};
const descriptors=[{id:'engine-a',kind:'engine',modelId:'chemical230-v2'}];
const engine=()=>{const o=new THREE.Group();o.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.5),new THREE.MeshStandardMaterial()));return o;};
const resources=(o:THREE.Object3D)=>{const set=new Set<THREE.BufferGeometry|THREE.Material>();o.traverse(c=>{if(c instanceof THREE.Mesh){set.add(c.geometry);for(const m of Array.isArray(c.material)?c.material:[c.material])set.add(m);}});return set;};
describe('builder scenario carrier',()=>{
 it('reapplies domain body thrust through a remounted engine without rebuilding unchanged geometry',()=>{
  const a=engine(),map=new Map([['engine-a',a]]),adapter=new SwingbyBuilderCarrier();a.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),.6);
  const local=new THREE.Vector3(Math.sin(.09),0,-Math.cos(.09)),body=local.clone().applyQuaternion(a.quaternion).toArray() as [number,number,number];
  adapter.configure(profile,'engine-a',body);adapter.sync(map,descriptors);const group=a.getObjectByName('scenario-cg-trim-carrier')!;
  expect(adapter.getState().poseAccepted).toBe(true);expect(adapter.getState().carrier!.gimbalAngleDeg).toBeCloseTo(.09*180/Math.PI,9);
  for(let i=0;i<20;i++){adapter.configure(profile,'engine-a',body);adapter.sync(map,descriptors);expect(a.getObjectByName(group.name)).toBe(group);}
  a.quaternion.identity();adapter.configure(profile,'engine-a',local.toArray() as [number,number,number]);adapter.sync(map,descriptors);expect(adapter.getState().carrier!.thrustDirectionLocal).toEqual(local.toArray());adapter.dispose();
 });
 it('detaches once before model replacement and restores a valid engine after undo, excluding incompatible models',()=>{
  const a=engine(),stock=a.children[0],map=new Map([['engine-a',a]]),adapter=new SwingbyBuilderCarrier();adapter.configure(profile,'engine-a');adapter.sync(map,descriptors);
  const owned=resources(a.getObjectByName('scenario-cg-trim-carrier')!),dispose=vi.fn(),borrowed=vi.fn();owned.forEach(r=>r.addEventListener('dispose',dispose));resources(stock).forEach(r=>r.addEventListener('dispose',borrowed));
  adapter.beforePartDisposal(a);expect(dispose).toHaveBeenCalledTimes(owned.size);expect(borrowed).not.toHaveBeenCalled();expect(stock.visible).toBe(true);
  const b=engine();map.set('engine-a',b);adapter.sync(map,[{...descriptors[0],modelId:'resistojet-v2'}]);expect(adapter.getState().attachedPartId).toBeNull();
  adapter.sync(map,descriptors);expect(adapter.getState().attachedPartId).toBe('engine-a');adapter.configure(null,null);expect(b.children).toHaveLength(1);expect(b.children[0].visible).toBe(true);expect(dispose).toHaveBeenCalledTimes(owned.size);adapter.dispose();
 });
 it('gives the moving ghost its real carrier and ignores hidden stock ray hits, without borrowing ownership',()=>{
  const a=engine(),stock=a.children[0],ghost=engine(),ghostStock=ghost.children[0],adapter=new SwingbyBuilderCarrier();adapter.configure(profile,'engine-a');adapter.sync(new Map([['engine-a',a]]),descriptors);
  expect(adapter.permitsHit(stock)).toBe(false);const ring=a.getObjectByName('scenario-cg-trim-carrier')!;expect(adapter.permitsHit(ring.children[0])).toBe(true);
  adapter.syncGhost(ghost,'engine-a');expect(ghostStock.visible).toBe(false);expect(ghost.getObjectByName('scenario-cg-trim-carrier')).toBeDefined();adapter.clearGhost();expect(ghost.children).toEqual([ghostStock]);expect(ghostStock.visible).toBe(true);
  adapter.configure(null,null);expect(adapter.permitsHit(stock)).toBe(true);expect(stock.visible).toBe(true);adapter.dispose();
 });
 it('retains CPU geometry through generation retirement and later removes only owned carrier resources',()=>{
  const a=engine(),scene=new THREE.Scene();scene.add(a);const adapter=new SwingbyBuilderCarrier();adapter.configure(profile,'engine-a');adapter.sync(new Map([['engine-a',a]]),descriptors);
  const group=a.getObjectByName('scenario-cg-trim-carrier')!,own=resources(group),counts=new Map([...own].map(r=>[r,0]));own.forEach(r=>r.addEventListener('dispose',()=>counts.set(r,counts.get(r)!+1)));
  retireContextResources([scene]);expect(a.getObjectByName(group.name)).toBe(group);expect([...counts.values()].every(v=>v===1)).toBe(true);
  adapter.beforePartDisposal(a);expect([...counts.values()].every(v=>v===2)).toBe(true);expect(a.children).toHaveLength(1);adapter.dispose();expect([...counts.values()].every(v=>v===2)).toBe(true);
 });
});
