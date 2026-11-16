import * as THREE from 'three';
import {LazySurfaceTexture} from './lazy-surface-texture';

export interface EarthDetailCapabilities {maxTextureSize:number;compressed:boolean;maximumSize?:8192|16384}
export interface EarthDetailEligibility {actualFlight:boolean;mode:string;quality:string;visible:boolean;contextLost:boolean}
export function earthDetailSize(caps:EarthDetailCapabilities):8192|16384|null {
 if(!caps.compressed||!Number.isFinite(caps.maxTextureSize)||caps.maxTextureSize<8192)return null;
 return Math.min(caps.maxTextureSize,caps.maximumSize??16384)>=16384?16384:8192;
}
export function shouldLoadEarthDetail(s:EarthDetailEligibility){return s.actualFlight&&s.mode==='craft'&&s.quality==='high'&&s.visible&&!s.contextLost;}
const mipBytes=(texture:THREE.Texture|null)=>texture?.mipmaps.reduce((total,mip)=>total+((mip as {data?:ArrayBufferView}).data?.byteLength??0),0)??0;

/** A single selected compressed day map, owned by one renderer. Original 4K
 * stays the fallback. No elevation, UV rotation, shader or light changes. */
export class EarthSurfaceDetail {
 private readonly lazy:LazySurfaceTexture;
 readonly size:8192|16384|null;
 constructor(caps:EarthDetailCapabilities,load:(size:8192|16384)=>Promise<THREE.Texture>,changed:()=>void,anisotropy=1){
  this.size=earthDetailSize(caps);
  this.lazy=new LazySurfaceTexture({load:()=>load(this.size!),changed,validate:t=>{
   const image=t.image as {width?:number;height?:number},compressed=t as THREE.CompressedTexture;
   if(!compressed.isCompressedTexture||t.format===THREE.RGBAFormat||image.width!==this.size||image.height!==this.size!/2||t.mipmaps.length!==Math.log2(this.size!)+1||mipBytes(t)<=0||mipBytes(t)>this.size!*this.size!/2*4/3*1.01)throw new Error('Earth detail must be the verified bounded compressed mip chain.');
  },configure:t=>{
   t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=Math.max(1,Math.min(8,anisotropy));t.generateMipmaps=false;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.name='NASA Earth Observatory · July 2004 Blue Marble close-view day map';
  }});
 }
 setEligibility(state:EarthDetailEligibility){this.lazy.setEligible(this.size!==null&&shouldLoadEarthDetail(state));}
 get texture(){return this.lazy.texture;}
 get activeTexture(){return this.lazy.activeTexture;}
 markContextRestored(){this.lazy.markContextRestored();}
 getState(){return {...this.lazy.getState(),selectedWidth:this.size,format:this.texture?.format??null,mipLevels:this.texture?.mipmaps.length??0,compressedMipBytes:mipBytes(this.texture),source:'NASA Earth Observatory / Reto Stöckli · July 2004',provenance:'/data/earth-surface-detail.json'};}
 dispose(){this.lazy.dispose();}
}

export function createEarthSurfaceDetail(renderer:THREE.WebGLRenderer,changed:()=>void,maximumSize:8192|16384=16384){
 const extensions=['WEBGL_compressed_texture_etc','WEBGL_compressed_texture_etc1','WEBGL_compressed_texture_s3tc','EXT_texture_compression_bptc'];
 const caps={maxTextureSize:renderer.capabilities.maxTextureSize,compressed:extensions.some(name=>renderer.extensions.has(name)),maximumSize};
 return new EarthSurfaceDetail(caps,async size=>{
  // No transcoder module, WASM or worker request until actual high-quality
  // craft inspection qualifies. A missing asset does not start the worker.
  const response=await fetch(`/assets/textures/earth-bmng-july2004-${size/1024}k.ktx2`);if(!response.ok)throw new Error(`Earth detail request failed (${response.status}).`);
  const buffer=await response.arrayBuffer();if(buffer.byteLength>32*1024*1024)throw new Error('Earth detail exceeds the compressed download budget.');
  const {KTX2Loader}=await import('three/addons/loaders/KTX2Loader.js');const loader=new KTX2Loader().setTranscoderPath('/assets/basis/').setWorkerLimit(1).detectSupport(renderer);
  // Initialize explicitly so even corrupt input/failing WASM balances the
  // installed r182 loader's active-loader lifecycle before dispose().
  try{await loader.init();return await new Promise<THREE.CompressedTexture>((resolve,reject)=>loader.parse(buffer,resolve,reject));}
  finally{loader.dispose();}
 },changed,renderer.capabilities.getMaxAnisotropy());
}
