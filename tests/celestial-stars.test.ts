import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {CelestialStars} from '../src/render/celestial-stars';
import {retireContextResources} from '../src/render/context-resources';
describe('original fixed celestial starfield',()=>{
 it('has deterministic bounded original directions and no textures',()=>{
  const a=new CelestialStars(),b=new CelestialStars();expect(a.object.geometry.getAttribute('position').array).toEqual(b.object.geometry.getAttribute('position').array);expect(a.object.geometry.getAttribute('color').array).toEqual(b.object.geometry.getAttribute('color').array);expect(a.count).toBe(640);expect(a.object.material.map).toBeNull();expect(a.object.material.sizeAttenuation).toBe(false);
  const shader={vertexShader:'#include <project_vertex>'};a.object.material.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);expect(shader.vertexShader).toContain('gl_Position.z = gl_Position.w');expect(a.object.material.depthTest).toBe(true);expect(a.object.material.depthWrite).toBe(false);
  const points=a.object.geometry.getAttribute('position'),colours=a.object.geometry.getAttribute('color');for(let i=0;i<points.count;i++){expect(new THREE.Vector3().fromBufferAttribute(points,i).length()).toBeCloseTo(2000,3);expect(colours.getZ(i)).toBeGreaterThanOrEqual(colours.getX(i));expect(colours.getZ(i)).toBeLessThanOrEqual(.81);}
  a.dispose();b.dispose();
 });
 it('has no translational parallax while retaining correct camera-rotation response',()=>{
  const stars=new CelestialStars(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,16/9,.01,5000);scene.add(stars.object);camera.position.set(0,0,0);camera.updateMatrixWorld();stars.centerOn(camera);const p=new THREE.Vector3().fromBufferAttribute(stars.object.geometry.getAttribute('position'),0),before=p.clone().applyMatrix4(stars.object.matrixWorld).project(camera);
  for(const translation of [new THREE.Vector3(100,500,-20),new THREE.Vector3(-5000,1500,2000)]){camera.position.copy(translation);camera.updateMatrixWorld();stars.centerOn(camera);const after=p.clone().applyMatrix4(stars.object.matrixWorld).project(camera);expect(after.distanceTo(before)).toBeLessThan(1e-10);}
  camera.rotation.y=.2;camera.updateMatrixWorld();stars.centerOn(camera);expect(p.clone().applyMatrix4(stars.object.matrixWorld).project(camera).distanceTo(before)).toBeGreaterThan(.01);stars.dispose();
 });
 it('retires GPU registrations without losing CPU data, then disposes owned resources once',()=>{
  const stars=new CelestialStars(),scene=new THREE.Scene();scene.add(stars.object);const geometry=stars.object.geometry,material=stars.object.material,g=vi.fn(),m=vi.fn(),positions=geometry.getAttribute('position').array;geometry.addEventListener('dispose',g);material.addEventListener('dispose',m);
  retireContextResources([scene]);expect(geometry.getAttribute('position').array).toBe(positions);expect(stars.object.parent).toBe(scene);expect(g).toHaveBeenCalledTimes(1);expect(m).toHaveBeenCalledTimes(1);stars.dispose();stars.dispose();expect(g).toHaveBeenCalledTimes(2);expect(m).toHaveBeenCalledTimes(2);expect(stars.object.parent).toBeNull();
 });
 it('does not animate through repeated centering and rejects an unbounded field',()=>{
  const stars=new CelestialStars(),camera=new THREE.PerspectiveCamera(),before=stars.object.geometry.getAttribute('position').array.slice();for(let i=0;i<100;i++)stars.centerOn(camera);expect(stars.object.geometry.getAttribute('position').array).toEqual(before);expect(()=>new CelestialStars(100000)).toThrow();expect(()=>new CelestialStars(300)).toThrow();stars.dispose();
 });
});
