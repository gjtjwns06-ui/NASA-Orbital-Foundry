import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {retireContextResources} from '../src/render/context-resources';
import {CommandSignals} from '../src/render/command-signals';

describe('lost-context GPU registration retirement',()=>{
 it('retires old generation listeners while preserving scene, arrays, image and object identity',()=>{
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),image={width:8,height:4},texture=new THREE.Texture(image),material=new THREE.MeshStandardMaterial({map:texture}),mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
  const array=geometry.getAttribute('position').array,oldCalls:string[]=[];
  const register=(resource:THREE.BufferGeometry|THREE.Material|THREE.Texture,name:string)=>{const listener=()=>{oldCalls.push(name);resource.removeEventListener('dispose',listener);};resource.addEventListener('dispose',listener);};
  register(geometry,'geometry');register(material,'material');register(texture,'texture');const version=texture.version;
  expect(retireContextResources([scene])).toEqual({geometries:1,materials:1,textures:1});expect(oldCalls.sort()).toEqual(['geometry','material','texture']);
  expect(scene.children).toEqual([mesh]);expect(mesh.geometry).toBe(geometry);expect(geometry.getAttribute('position').array).toBe(array);expect(texture.image).toBe(image);expect(material.map).toBe(texture);expect(texture.version).toBe(version+1);
  // New generation attaches its own listeners. A later normal rebuild must
  // never invoke the previously retired generation's closures again.
  const newDispose=vi.fn();geometry.addEventListener('dispose',newDispose);texture.addEventListener('dispose',newDispose);geometry.dispose();texture.dispose();expect(newDispose).toHaveBeenCalledTimes(2);expect(oldCalls).toHaveLength(3);material.dispose();
 });
 it('deduplicates shared geometry/material/maps across roots and inactive pools',()=>{
  const a=new THREE.Group(),b=new THREE.Group(),g=new THREE.BoxGeometry(),t=new THREE.Texture(),m=new THREE.MeshStandardMaterial({map:t,bumpMap:t});a.add(new THREE.Mesh(g,m));b.add(new THREE.Mesh(g,m));
  const spy=vi.fn();g.addEventListener('dispose',spy);m.addEventListener('dispose',spy);t.addEventListener('dispose',spy);
  expect(retireContextResources([a,b],{geometries:[g],materials:[m],textures:[t]})).toEqual({geometries:1,materials:1,textures:1});expect(spy).toHaveBeenCalledTimes(3);
 });
 it('includes ordinary shader uniform maps but never borrowed environment/render-target attachments',()=>{
  const scene=new THREE.Scene(),target=new THREE.WebGLRenderTarget(4,4),depth=new THREE.DepthTexture(4,4),environment=new THREE.Texture(),noise=new THREE.Texture(),material=new THREE.ShaderMaterial({uniforms:{noise:{value:noise},history:{value:[target.texture,depth]}}});scene.environment=environment;scene.add(new THREE.Mesh(new THREE.PlaneGeometry(),material));
  const borrowed=vi.fn();target.addEventListener('dispose',borrowed);target.texture.addEventListener('dispose',borrowed);depth.addEventListener('dispose',borrowed);environment.addEventListener('dispose',borrowed);
  expect(retireContextResources([scene],{textures:[target.texture,depth]}).textures).toBe(1);expect(borrowed).not.toHaveBeenCalled();expect(scene.environment).toBe(environment);
 });
 it('retains reusable command marker pools even when all previously rendered frames are removed',()=>{
  const signals=new CommandSignals(),pool=signals.getContextResources();expect(pool.geometries.length).toBe(3);const called=vi.fn();pool.geometries.forEach(g=>g.addEventListener('dispose',called));
  const result=retireContextResources([signals.group],pool);expect(result.geometries).toBe(3);expect(called).toHaveBeenCalledTimes(3);expect(signals.group.parent).toBeNull();expect(signals.getContextResources().geometries).toEqual(pool.geometries);signals.dispose();
 });
 it('handles Points and hidden objects that may retain uploaded buffers',()=>{
  const root=new THREE.Group(),g=new THREE.BufferGeometry(),m=new THREE.PointsMaterial();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3));const points=new THREE.Points(g,m);points.visible=false;root.add(points);
  expect(retireContextResources([root])).toEqual({geometries:1,materials:1,textures:0});expect(points.visible).toBe(false);expect(g.getAttribute('position').count).toBe(1);
 });
});
