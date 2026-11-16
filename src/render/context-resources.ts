import * as THREE from 'three';

export interface ContextResourceExtras {
 geometries?:Iterable<THREE.BufferGeometry>;
 materials?:Iterable<THREE.Material>;
 textures?:Iterable<THREE.Texture>;
}

/** Retire the PRE-LOSS WebGL registration, not the CPU object. Three 0.182's
 * geometry/texture dispose listeners capture generation-specific GL caches;
 * retaining them past onContextRestore makes later ordinary disposal delete
 * handles from the previous generation. Call once during webglcontextlost,
 * BEFORE Three initializes a new context cache. No parent removal, attribute
 * clearing, image closing, or borrowed render-target disposal takes place.
 * Ordinary shared resources notify every registered renderer; a still-live
 * renderer safely reuploads the same retained CPU data on its next render. */
export function retireContextResources(roots:Iterable<THREE.Object3D>,extras:ContextResourceExtras={}){
 const geometries=new Set(extras.geometries),materials=new Set(extras.materials),textures=new Set<THREE.Texture>();
 const addTexture=(value:unknown)=>{
  if(value instanceof THREE.Texture){
   // Framebuffer/depth attachments have a separate explicit target owner.
   if(!value.isRenderTargetTexture&&!(value instanceof THREE.DepthTexture))textures.add(value);
  }else if(Array.isArray(value))value.forEach(addTexture);
 };
 for(const t of extras.textures??[])addTexture(t);
 for(const root of roots)root.traverse(object=>{
  const renderable=object as THREE.Mesh;
  if(renderable.geometry instanceof THREE.BufferGeometry)geometries.add(renderable.geometry);
  if(renderable.material){for(const material of Array.isArray(renderable.material)?renderable.material:[renderable.material])if(material instanceof THREE.Material)materials.add(material);}
 });
 for(const material of materials){
  for(const value of Object.values(material))addTexture(value);
  const uniforms=(material as THREE.ShaderMaterial).uniforms;
  if(uniforms)for(const uniform of Object.values(uniforms))addTexture(uniform.value);
 }
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials){material.dispose();material.needsUpdate=true;}
 for(const texture of textures){texture.dispose();texture.needsUpdate=true;}
 return {geometries:geometries.size,materials:materials.size,textures:textures.size};
}
