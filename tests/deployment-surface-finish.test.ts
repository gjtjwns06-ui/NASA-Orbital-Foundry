import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deploymentPalette} from '../src/render/deployment-link-meshes';
import {DeploymentSurfaceFinish,deploymentSurfacePixels} from '../src/render/deployment-surface-finish';
import {DeploymentView} from '../src/render/deployment-view';
const sha=(data:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
const facts=(p:ReturnType<typeof deploymentPalette>)=>Object.fromEntries(Object.entries(p).map(([name,m])=>[name,{id:m.uuid,color:m.color.getHex(),metalness:m.metalness,roughness:m.roughness,normalMap:m.normalMap?.uuid??null,roughnessMap:m.roughnessMap?.uuid??null,normalScale:m.normalScale.toArray(),polygonOffset:m.polygonOffset,polygonOffsetFactor:m.polygonOffsetFactor,polygonOffsetUnits:m.polygonOffsetUnits}]));
const fixture=JSON.parse(readFileSync('docs/actual-camera-fixture.json','utf8'));
const shape=(view:DeploymentView)=>{const objects:any[]=[];view.actualRoot.updateMatrixWorld(true);view.actualRoot.traverse(o=>{if(o instanceof THREE.Mesh)objects.push({id:o.uuid,geometry:o.geometry.uuid,material:(o.material as THREE.Material).uuid,parent:o.parent?.uuid,matrix:o.matrix.toArray(),world:o.matrixWorld.toArray(),shadow:[o.castShadow,o.receiveShadow],attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([name,a])=>[name,sha((a as THREE.BufferAttribute).array)])),index:o.geometry.index?sha(o.geometry.index.array):null,groups:o.geometry.groups,userData:o.userData});});return objects;};

describe('original bounded spacecraft surface shading',()=>{
 it('generates deterministic opaque maps with distinct materials and approximately unit normals',()=>{
  for(const kind of ['foil','aluminum'] as const){const a=deploymentSurfacePixels(kind),b=deploymentSurfacePixels(kind);expect(sha(a.normal)).toBe(sha(b.normal));expect(sha(a.roughness)).toBe(sha(b.roughness));expect(a.normal.byteLength).toBe(256*256*4);
   let minimum=255,maximum=0,maxDeviation=0,nonOpaque=0;for(let i=0;i<a.normal.length;i+=4){const n=[a.normal[i],a.normal[i+1],a.normal[i+2]].map(x=>x/255*2-1);maxDeviation=Math.max(maxDeviation,Math.abs(Math.hypot(...n)-1));if(a.normal[i+3]!==255||a.roughness[i+3]!==255)nonOpaque++;minimum=Math.min(minimum,a.roughness[i]);maximum=Math.max(maximum,a.roughness[i]);}expect(maxDeviation).toBeLessThan(.012);expect(nonOpaque).toBe(0);expect(maximum-minimum).toBeGreaterThan(35);}
  expect(sha(deploymentSurfacePixels('foil').normal)).not.toBe(sha(deploymentSurfacePixels('aluminum').normal));
 });
 it('does not allocate maps in the default flat style and rejects unbounded map sizes',()=>{
  const palette=deploymentPalette(),finish=new DeploymentSurfaceFinish(palette);expect(finish.getState()).toMatchObject({style:'flat',cachedTextures:0,cpuBytes:0});for(const n of [0,15,300,1024,NaN])expect(()=>deploymentSurfacePixels('foil',n)).toThrow();finish.dispose();Object.values(palette).forEach(m=>m.dispose());
 });
 it('changes only foil, ivory and frame shading, leaving RF gold, solar and PCB unchanged',()=>{
  const palette=deploymentPalette(),before=facts(palette),finish=new DeploymentSurfaceFinish(palette);finish.setStyle('textured');const after=facts(palette);
  for(const name of ['gold','dark','surfaceDark','solar','cell','pcb'])expect(after[name]).toEqual(before[name]);
  for(const name of ['foil','ivory','frame']){expect(after[name].id).toBe(before[name].id);expect(after[name].normalMap).not.toBeNull();expect(after[name].roughnessMap).not.toBeNull();}
  expect(palette.ivory.normalMap).toBe(palette.frame.normalMap);expect(palette.foil.normalMap).not.toBe(palette.ivory.normalMap);
  expect(finish.getState()).toMatchObject({cachedTextures:4,cpuBytes:1048576,estimatedMipBytes:1398096});
  for(const t of finish.textures){expect(t.colorSpace).toBe(THREE.NoColorSpace);expect(t.generateMipmaps).toBe(true);expect(t.wrapS).toBe(THREE.RepeatWrapping);}finish.dispose();Object.values(palette).forEach(m=>m.dispose());
 });
 it('restores exact original material values and retains one set of maps across toggles',()=>{
  const palette=deploymentPalette(),before=facts(palette),finish=new DeploymentSurfaceFinish(palette);finish.setStyle('textured');const textures=finish.textures.slice(),data=textures.map(t=>sha(t.image.data!));
  for(let i=0;i<10;i++){finish.setStyle('flat');expect(facts(palette)).toEqual(before);finish.setStyle('textured');expect(finish.textures).toEqual(textures);expect(finish.textures.map(t=>sha(t.image.data!))).toEqual(data);}
  finish.dispose();expect(facts(palette)).toEqual(before);Object.values(palette).forEach(m=>m.dispose());
 });
 it('has independent per-view ownership and idempotent final disposal',()=>{
  const p=deploymentPalette(),q=deploymentPalette(),a=new DeploymentSurfaceFinish(p),b=new DeploymentSurfaceFinish(q);a.setStyle('textured');b.setStyle('textured');const disposed:number[]=[];
  a.textures.forEach((t,i)=>{disposed[i]=0;t.addEventListener('dispose',()=>disposed[i]++);expect(b.textures).not.toContain(t);});a.dispose();a.dispose();a.setStyle('textured');expect(disposed).toEqual([1,1,1,1]);expect(a.textures).toEqual([]);expect(b.textures).toHaveLength(4);b.dispose();[...Object.values(p),...Object.values(q)].forEach(m=>m.dispose());
 });
 it('does not change any mesh, geometry bytes, transforms, shadow flags, FK state or picking identity',()=>{
  const view=new DeploymentView({definition:fixture.craftView.topology});view.setGeometryView(fixture.craftView.geometry);const state=view.getState(),before=shape(view);
  view.setSurfaceFinish('textured');expect(view.getState()).toEqual(state);expect(shape(view)).toEqual(before);view.setSurfaceFinish('flat');expect(shape(view)).toEqual(before);view.dispose();
 });
 it('retires inactive cached maps on native context loss and permits a later final disposal',()=>{
  const view=new DeploymentView({definition:fixture.craftView.topology},{surfaceFinish:'textured'}),textures=view.getSurfaceTextures(),counts=[0,0,0,0];textures.forEach((t,i)=>t.addEventListener('dispose',()=>counts[i]++));view.setSurfaceFinish('flat');
  const retired=view.retireContext();expect(retired?.textures).toBe(4);expect(counts).toEqual([1,1,1,1]);expect(view.retireContext()).toBeNull();view.contextRestored();view.setSurfaceFinish('textured');expect(view.getSurfaceTextures()).toEqual(textures);view.dispose();view.dispose();expect(counts).toEqual([2,2,2,2]);
 });
});
