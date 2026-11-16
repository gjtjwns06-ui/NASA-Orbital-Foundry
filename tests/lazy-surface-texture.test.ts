import {describe,expect,it,vi} from 'vitest';
import {Texture,SRGBColorSpace} from 'three';
import {LazySurfaceTexture,shouldLoadMarsSurfaceDetail,type MarsSurfaceEligibility} from '../src/render/lazy-surface-texture';

const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
const texture=(width=4096,height=2048)=>new Texture({width,height});
function fixture(){
 let resolve!:(value:Texture)=>void,reject!:(reason:unknown)=>void;
 const promise=new Promise<Texture>((yes,no)=>{resolve=yes;reject=no;});
 const load=vi.fn(()=>promise),changed=vi.fn();
 const configure=vi.fn((t:Texture)=>{t.colorSpace=SRGBColorSpace;});
 const cache=new LazySurfaceTexture({load,changed,configure,validate:t=>{const image=t.image as {width:number;height:number};if(image.width!==4096||image.height!==2048)throw new Error('wrong asset dimensions');}});
 return {cache,load,changed,configure,resolve,reject};
}
const eligible:MarsSurfaceEligibility={hasSolution:true,inspectionEnabled:true,phase:'mars-flyby',view:'mars',phasePreview:false,contextLost:false,quality:'high',maxTextureSize:8192};

describe('lazy Mars surface texture ownership',()=>{
 it('does not request anything at construction or while ineligible',async()=>{
  const f=fixture();f.cache.setEligible(false);await flush();expect(f.load).not.toHaveBeenCalled();expect(f.cache.getState().status).toBe('idle');f.cache.dispose();
 });
 it('requests once despite rapid eligible toggles and reuses one configured texture',async()=>{
  const f=fixture(),t=texture(),dispose=vi.fn();t.addEventListener('dispose',dispose);
  for(let i=0;i<30;i++){f.cache.setEligible(true);f.cache.setEligible(false);}f.cache.setEligible(true);await flush();
  expect(f.load).toHaveBeenCalledTimes(1);f.resolve(t);await flush();
  expect(f.cache.activeTexture).toBe(t);expect(t.colorSpace).toBe(SRGBColorSpace);expect(f.configure).toHaveBeenCalledTimes(1);
  for(let i=0;i<30;i++){f.cache.setEligible(false);expect(f.cache.activeTexture).toBeNull();f.cache.setEligible(true);expect(f.cache.activeTexture).toBe(t);}
  expect(f.cache.getState()).toMatchObject({status:'ready',requestCount:1,width:4096,height:2048});expect(dispose).not.toHaveBeenCalled();f.cache.dispose();expect(dispose).toHaveBeenCalledTimes(1);
 });
 it('caches an exit-during-load completion without activating it',async()=>{
  const f=fixture(),t=texture();f.cache.setEligible(true);await flush();f.cache.setEligible(false);f.resolve(t);await flush();
  expect(f.cache.texture).toBe(t);expect(f.cache.activeTexture).toBeNull();expect(f.cache.getState()).toMatchObject({status:'ready',cached:true,active:false});f.cache.setEligible(true);expect(f.cache.activeTexture).toBe(t);expect(f.load).toHaveBeenCalledTimes(1);f.cache.dispose();
 });
 it('releases late completion exactly once after repeated dispose and never calls the view again',async()=>{
  const f=fixture(),t=texture(),dispose=vi.fn();t.addEventListener('dispose',dispose);f.cache.setEligible(true);await flush();
  f.cache.dispose();f.cache.dispose();const changes=f.changed.mock.calls.length;f.resolve(t);await flush();
  expect(dispose).toHaveBeenCalledTimes(1);expect(f.changed).toHaveBeenCalledTimes(changes);expect(f.configure).not.toHaveBeenCalled();expect(f.cache.texture).toBeNull();expect(f.cache.getState().status).toBe('disposed');
 });
 it('disposes an invalid decoded asset once and leaves fallback selection available',async()=>{
  const f=fixture(),t=texture(512,256),dispose=vi.fn();t.addEventListener('dispose',dispose);f.cache.setEligible(true);await flush();f.resolve(t);await flush();
  expect(f.cache.getState()).toMatchObject({status:'error',active:false,cached:false,error:'wrong asset dimensions'});expect(dispose).toHaveBeenCalledTimes(1);f.cache.dispose();expect(dispose).toHaveBeenCalledTimes(1);
 });
 it('falls back after network failure without repeated requests on toggles',async()=>{
  const f=fixture();f.cache.setEligible(true);await flush();f.reject(new Error('404'));await flush();
  for(let i=0;i<10;i++){f.cache.setEligible(false);f.cache.setEligible(true);}await flush();
  expect(f.cache.getState()).toMatchObject({status:'error',active:false,error:'404',requestCount:1});expect(f.load).toHaveBeenCalledTimes(1);f.cache.dispose();
 });
 it('ignores rejection after destruction without notifying a destroyed view',async()=>{
  const f=fixture();f.cache.setEligible(true);await flush();f.cache.dispose();const changes=f.changed.mock.calls.length;f.reject(new Error('network after exit'));await flush();expect(f.cache.getState().status).toBe('disposed');expect(f.changed).toHaveBeenCalledTimes(changes);
 });
 it('reuses CPU image after context restoration without disposing or reloading it',async()=>{
  const f=fixture(),t=texture(),dispose=vi.fn();t.addEventListener('dispose',dispose);f.cache.setEligible(true);await flush();f.resolve(t);await flush();
  const image=t.image,version=t.version;for(let i=0;i<3;i++){f.cache.setEligible(false);f.cache.markContextRestored();f.cache.setEligible(true);}
  expect(t.version).toBe(version+3);expect(t.image).toBe(image);expect(f.load).toHaveBeenCalledTimes(1);expect(dispose).not.toHaveBeenCalled();f.cache.dispose();expect(dispose).toHaveBeenCalledTimes(1);
 });
 it('will not restart a disposed cache',async()=>{
  const f=fixture();f.cache.dispose();f.cache.setEligible(true);f.cache.markContextRestored();await flush();expect(f.load).not.toHaveBeenCalled();expect(f.cache.activeTexture).toBeNull();
 });
});

describe('Mars detail request eligibility',()=>{
 it('requires actual Mars phase inspection at high quality on a capable renderer',()=>{expect(shouldLoadMarsSurfaceDetail(eligible)).toBe(true);expect(shouldLoadMarsSurfaceDetail({...eligible,maxTextureSize:4096})).toBe(true);});
 it('rejects every non-qualifying state including phase previews and unsupported hardware',()=>{
  const changes:Partial<MarsSurfaceEligibility>[]=[{hasSolution:false},{inspectionEnabled:false},{phase:'earth-escape'},{phase:'heliocentric'},{phase:null},{view:'solar'},{view:'earth'},{phasePreview:true},{contextLost:true},{quality:'medium'},{quality:'low'},{maxTextureSize:2048}];
  for(const change of changes)expect(shouldLoadMarsSurfaceDetail({...eligible,...change}),JSON.stringify(change)).toBe(false);
 });
});
