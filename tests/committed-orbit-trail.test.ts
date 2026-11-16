import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {CommittedOrbitTrail,type CommittedTrailPoint} from '../src/render/committed-orbit-trail';
import {retireContextResources} from '../src/render/context-resources';
import {deploymentVector} from '../src/render/deployment-scene-math';
import type {DeploymentSceneSnapshot} from '../src/render/deployment-scene-types';
const scale=3/6378.137;
const fixture=JSON.parse(readFileSync('docs/qa/milestone-8/camera-component/camera-replay-fixture.json','utf8'));
const actual:CommittedTrailPoint[]=fixture.snapshots.map((s:DeploymentSceneSnapshot)=>({timeSeconds:s.timeSeconds,positionKm:[...s.environment.positionKm]}));
const synthetic=(count:number):CommittedTrailPoint[]=>Array.from({length:count},(_,i)=>({timeSeconds:i,positionKm:[6978+i*.03,90+i*.1,120+i*.07]}));
const positions=(trail:CommittedOrbitTrail)=>Array.from((trail.line.geometry.attributes.position.array as Float32Array).slice(0,trail.line.geometry.drawRange.count*3));
const baseline=(points:readonly CommittedTrailPoint[])=>new THREE.BufferGeometry().setFromPoints(points.map(p=>deploymentVector([...p.positionKm]).multiplyScalar(scale)));

describe('retained committed orbit history',()=>{
 it('keeps empty and single-position histories invisible without a fabricated segment',()=>{
  const trail=new CommittedOrbitTrail(scale),geometry=trail.line.geometry,material=trail.line.material,attribute=geometry.attributes.position;
  expect(trail.line.visible).toBe(false);expect(geometry.drawRange).toEqual({start:0,count:0});
  trail.setHistory([actual[0]]);expect(trail.line.visible).toBe(false);expect(geometry.drawRange.count).toBe(1);expect(positions(trail)).toEqual(Array.from(baseline([actual[0]]).attributes.position.array));
  expect(geometry.boundingSphere!.radius).toBe(0);expect(geometry.boundingSphere!.center.toArray()).toEqual(positions(trail));
  trail.clear();expect(trail.line.visible).toBe(false);expect(geometry.drawRange.count).toBe(0);expect(geometry.boundingBox!.isEmpty()).toBe(true);expect(geometry.boundingSphere!.radius).toBe(0);
  expect(trail.line.geometry).toBe(geometry);expect(trail.line.material).toBe(material);expect(geometry.attributes.position).toBe(attribute);trail.dispose();
 });
 it('matches every old Float32 position and active bound using actual committed native-Chrome positions',()=>{
  const trail=new CommittedOrbitTrail(scale),original=JSON.stringify(actual);
  for(let count=2;count<=actual.length;count++){
   const points=actual.slice(0,count),old=baseline(points);old.computeBoundingBox();old.computeBoundingSphere();trail.setHistory(points);
   expect(positions(trail)).toEqual(Array.from(old.attributes.position.array));expect(trail.line.geometry.boundingBox!.equals(old.boundingBox!)).toBe(true);expect(trail.line.geometry.boundingSphere!.equals(old.boundingSphere!)).toBe(true);expect(trail.line.geometry.drawRange).toEqual({start:0,count});expect(trail.line.visible).toBe(true);old.dispose();
  }
  expect(JSON.stringify(actual)).toBe(original);expect(trail.line.material.color.getHex()).toBe(0x61aaa8);expect(trail.line.material.opacity).toBe(.55);expect(trail.line.material.transparent).toBe(true);trail.dispose();
 });
 it('preserves the same camera-frustum decisions as the old geometry, including offscreen actual histories',()=>{
  const trail=new CommittedOrbitTrail(scale);trail.setHistory(actual);const old=new THREE.Line(baseline(actual),new THREE.LineBasicMaterial());
  old.geometry.computeBoundingSphere();const camera=new THREE.PerspectiveCamera(42,16/9,.005,5000),target=old.geometry.boundingSphere!.center,distance=old.geometry.boundingSphere!.radius*3+.1;let visible=0,hidden=0;
  for(let i=0;i<24;i++){
   camera.position.copy(target).add(new THREE.Vector3(Math.cos(i*Math.PI/12),.2,Math.sin(i*Math.PI/12)).multiplyScalar(distance));camera.lookAt(i%2?camera.position.clone().sub(target).multiplyScalar(10).add(camera.position):target);camera.updateMatrixWorld();
   const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   const prior=frustum.intersectsObject(old);expect(frustum.intersectsObject(trail.line)).toBe(prior);if(prior)visible++;else hidden++;
  }
  expect(visible).toBeGreaterThan(0);expect(hidden).toBeGreaterThan(0);old.geometry.dispose();old.material.dispose();trail.dispose();
 });
 it('retains geometry, attribute, array, and material over host-sized growth and history decimation',()=>{
  const trail=new CommittedOrbitTrail(scale),g=trail.line.geometry,a=g.attributes.position,buffer=a.array,m=trail.line.material,points=synthetic(720);let retired=0;g.addEventListener('dispose',()=>retired++);
  for(let i=2;i<=720;i++)trail.setHistory(points.slice(0,i));
  trail.setHistory(points.filter((_,i)=>i%2===0||i===719));
  expect(g.attributes.position.count).toBe(1024);expect(trail.line.geometry).toBe(g);expect(g.attributes.position).toBe(a);expect(a.array).toBe(buffer);expect(trail.line.material).toBe(m);expect(retired).toBe(0);expect((a as THREE.BufferAttribute).usage).toBe(THREE.DynamicDrawUsage);
  expect(g.drawRange.count).toBe(361);expect((a as THREE.BufferAttribute).updateRanges).toEqual([{start:0,count:1083}]);
  const old=baseline(points.filter((_,i)=>i%2===0||i===719));old.computeBoundingSphere();expect(g.boundingSphere!.equals(old.boundingSphere!)).toBe(true);old.dispose();trail.dispose();expect(retired).toBe(1);
 });
 it('grows without truncation and retires the previous GPU geometry registration once',()=>{
  const trail=new CommittedOrbitTrail(scale),line=trail.line,g=line.geometry,m=line.material;let geometryDisposals=0,materialDisposals=0;g.addEventListener('dispose',()=>geometryDisposals++);m.addEventListener('dispose',()=>materialDisposals++);
  const points=synthetic(1025);trail.setHistory(points);expect(trail.line).toBe(line);expect(line.material).toBe(m);expect(line.geometry).not.toBe(g);expect(line.geometry.attributes.position.count).toBe(2048);expect(line.geometry.drawRange.count).toBe(1025);expect(positions(trail)).toEqual(Array.from(baseline(points).attributes.position.array));expect(geometryDisposals).toBe(1);expect(materialDisposals).toBe(0);
  const grown=line.geometry;let finalDisposals=0;grown.addEventListener('dispose',()=>finalDisposals++);trail.setHistory(synthetic(1800));expect(line.geometry).toBe(grown);trail.dispose();trail.dispose();expect(geometryDisposals).toBe(1);expect(finalDisposals).toBe(1);expect(materialDisposals).toBe(1);
 });
 it('excludes stale tail and unused origin from bounds after shorter or reset source history',()=>{
  const trail=new CommittedOrbitTrail(scale);trail.setHistory(synthetic(720));trail.setHistory(actual.slice(0,2));const old=baseline(actual.slice(0,2));old.computeBoundingBox();old.computeBoundingSphere();
  expect(trail.line.geometry.boundingBox!.equals(old.boundingBox!)).toBe(true);expect(trail.line.geometry.boundingSphere!.equals(old.boundingSphere!)).toBe(true);expect(trail.line.geometry.boundingBox!.containsPoint(new THREE.Vector3())).toBe(false);
  trail.clear();trail.setHistory(actual.slice(2));expect(positions(trail)).toEqual(Array.from(baseline(actual.slice(2)).attributes.position.array));old.dispose();trail.dispose();
 });
 it('retains exact CPU history across three pre-loss GPU registration retirements and final idempotent disposal',()=>{
  const root=new THREE.Group(),trail=new CommittedOrbitTrail(scale);root.add(trail.line);trail.setHistory(actual);const g=trail.line.geometry,m=trail.line.material,a=g.attributes.position,expected=positions(trail);let gd=0,md=0;g.addEventListener('dispose',()=>gd++);m.addEventListener('dispose',()=>md++);
  for(let i=0;i<3;i++){expect(retireContextResources([root])).toEqual({geometries:1,materials:1,textures:0});expect(trail.line.geometry).toBe(g);expect(trail.line.material).toBe(m);expect(g.attributes.position).toBe(a);expect(positions(trail)).toEqual(expected);expect(trail.line.parent).toBe(root);}
  trail.dispose();trail.dispose();trail.setHistory(actual.slice(0,2));expect(gd).toBe(4);expect(md).toBe(4);expect(positions(trail)).toEqual(expected);expect(trail.line.parent).toBe(null);expect(trail.line.visible).toBe(false);
 });
 it('rejects invalid or Float32-overflow positions before changing the retained history',()=>{
  const trail=new CommittedOrbitTrail(scale);trail.setHistory(actual);const g=trail.line.geometry,before=positions(trail);
  for(const value of [NaN,Infinity,Number.MAX_VALUE])expect(()=>trail.setHistory([{timeSeconds:1,positionKm:[value,0,0]}])).toThrow(/Invalid/);
  expect(positions(trail)).toEqual(before);expect(trail.line.geometry).toBe(g);expect(()=>new CommittedOrbitTrail(0)).toThrow();expect(()=>new CommittedOrbitTrail(scale,1)).toThrow();trail.dispose();
 });
});
