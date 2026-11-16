import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {EarthSurfaceDetail,earthDetailSize,shouldLoadEarthDetail,type EarthDetailEligibility} from '../src/render/earth-surface-detail';
const eligible:EarthDetailEligibility={actualFlight:true,mode:'craft',quality:'high',visible:true,contextLost:false};
const caps={maxTextureSize:16384,compressed:true};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
// CPU ownership fixture, not encoded-image evidence; real mip bytes and format
// are checked separately by the native browser on the actual KTX2 asset.
function texture(size=16384){return new THREE.CompressedTexture(Array.from({length:Math.log2(size)+1},(_,i)=>({data:new Uint8Array(8),width:Math.max(1,size>>i),height:Math.max(1,(size/2)>>i)})),size,size/2,THREE.RGBA_S3TC_DXT1_Format);}
describe('optional compressed Earth detail',()=>{
 it('chooses a capability-bounded single map with an explicit 8K ceiling and no uncompressed path',()=>{
  expect(earthDetailSize(caps)).toBe(16384);expect(earthDetailSize({...caps,maximumSize:8192})).toBe(8192);expect(earthDetailSize({...caps,maxTextureSize:8192})).toBe(8192);expect(earthDetailSize({...caps,maxTextureSize:4096})).toBe(null);expect(earthDetailSize({...caps,maxTextureSize:NaN})).toBe(null);expect(earthDetailSize({...caps,compressed:false})).toBe(null);
 });
 it('excludes medium, low, workshop, overview, preview/no actual, hidden and lost context',()=>{
  expect(shouldLoadEarthDetail(eligible)).toBe(true);
  for(const change of [{quality:'medium'},{quality:'low'},{mode:'workshop'},{mode:'orbit'},{actualFlight:false},{visible:false},{contextLost:true}])expect(shouldLoadEarthDetail({...eligible,...change})).toBe(false);
 });
 it('never starts any load until eligibility and compressed capability both qualify',async()=>{
  const load=vi.fn(async()=>texture()),detail=new EarthSurfaceDetail(caps,load,()=>{}),unsupported=new EarthSurfaceDetail({...caps,compressed:false},load,()=>{});
  detail.setEligibility({...eligible,quality:'medium'});unsupported.setEligibility(eligible);await tick();expect(load).not.toHaveBeenCalled();detail.dispose();unsupported.dispose();
 });
 it('loads once through rapid quality/view changes and retains the same texture on return',async()=>{
  let resolve!:(value:THREE.Texture)=>void;const load=vi.fn(()=>new Promise<THREE.Texture>(r=>resolve=r)),detail=new EarthSurfaceDetail(caps,load,()=>{},16);
  detail.setEligibility(eligible);detail.setEligibility({...eligible,mode:'orbit'});detail.setEligibility(eligible);await tick();expect(load).toHaveBeenCalledTimes(1);expect(detail.activeTexture).toBe(null);
  const t=texture();resolve(t);await tick();expect(detail.activeTexture).toBe(t);expect(t.flipY).toBe(false);expect(t.colorSpace).toBe(THREE.SRGBColorSpace);expect(t.anisotropy).toBe(8);expect(t.generateMipmaps).toBe(false);expect(t.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  detail.setEligibility({...eligible,quality:'medium'});expect(detail.activeTexture).toBe(null);expect(detail.texture).toBe(t);detail.setEligibility(eligible);expect(detail.activeTexture).toBe(t);expect(detail.getState().requestCount).toBe(1);detail.dispose();
 });
 it('falls back on network failure without retrying each render frame',async()=>{
  const load=vi.fn(async()=>{throw Error('missing asset');}),detail=new EarthSurfaceDetail(caps,load,()=>{});detail.setEligibility(eligible);await tick();for(let i=0;i<30;i++)detail.setEligibility(eligible);await tick();expect(load).toHaveBeenCalledTimes(1);expect(detail.activeTexture).toBe(null);expect(detail.getState().status).toBe('error');expect(detail.getState().error).toContain('missing');detail.dispose();
 });
 it('rejects wrong dimensions, uncompressed fallback and incomplete mip chains, disposing each rejected map',async()=>{
  const wrong=texture(8192),raw=new THREE.Texture(),noMips=texture();noMips.mipmaps=[];
  for(const t of [wrong,raw,noMips]){let disposed=0;t.addEventListener('dispose',()=>disposed++);const detail=new EarthSurfaceDetail(caps,async()=>t,()=>{});detail.setEligibility(eligible);await tick();expect(detail.getState().status).toBe('error');expect(detail.texture).toBe(null);expect(disposed).toBe(1);detail.dispose();expect(disposed).toBe(1);}
 });
 it('disposes a completed late load without changing a destroyed scene',async()=>{
  let resolve!:(t:THREE.Texture)=>void;const changed=vi.fn(),detail=new EarthSurfaceDetail(caps,()=>new Promise(r=>resolve=r),changed);detail.setEligibility(eligible);await tick();detail.dispose();const calls=changed.mock.calls.length,t=texture();let disposed=0;t.addEventListener('dispose',()=>disposed++);resolve(t);await tick();expect(disposed).toBe(1);expect(changed.mock.calls.length).toBe(calls);expect(detail.texture).toBe(null);expect(detail.getState().status).toBe('disposed');
 });
 it('keeps a completed hidden-view load cached without applying it',async()=>{
  let resolve!:(t:THREE.Texture)=>void;const detail=new EarthSurfaceDetail(caps,()=>new Promise(r=>resolve=r),()=>{});detail.setEligibility(eligible);await tick();detail.setEligibility({...eligible,mode:'orbit'});const t=texture();resolve(t);await tick();expect(detail.texture).toBe(t);expect(detail.activeTexture).toBe(null);detail.setEligibility(eligible);expect(detail.activeTexture).toBe(t);detail.dispose();
 });
 it('reuses the retained compressed data across restore notifications and final idempotent disposal',async()=>{
  const t=texture(),load=vi.fn(async()=>t),detail=new EarthSurfaceDetail(caps,load,()=>{});let disposed=0;t.addEventListener('dispose',()=>disposed++);detail.setEligibility(eligible);await tick();const version=t.version;
  for(let i=0;i<3;i++){detail.setEligibility({...eligible,contextLost:true});expect(detail.activeTexture).toBe(null);detail.markContextRestored();detail.setEligibility(eligible);expect(detail.activeTexture).toBe(t);}
  expect(t.version).toBe(version+3);expect(load).toHaveBeenCalledTimes(1);detail.dispose();detail.dispose();expect(disposed).toBe(1);
 });
});
