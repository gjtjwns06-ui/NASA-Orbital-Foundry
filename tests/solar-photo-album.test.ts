import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const jpeg='data:image/jpeg;base64,/9j/AA==';
let stored:Map<string,string>;
let storage:{getItem:ReturnType<typeof vi.fn>;setItem:ReturnType<typeof vi.fn>};
beforeEach(()=>{vi.resetModules();stored=new Map();storage={getItem:vi.fn((key:string)=>stored.get(key)??null),setItem:vi.fn((key:string,value:string)=>stored.set(key,value))};vi.stubGlobal('localStorage',storage);});
afterEach(()=>vi.unstubAllGlobals());
describe('expedition photographs independent of science credit',()=>{
 it('preserves an unscored photograph across a fresh module session',async()=>{
  const album=await import('../src/solar/photo-album');
  const saved=album.savePhoto({imageDataUrl:jpeg,target:'aster',label:'A personal view',scientific:false});
  expect(saved.persisted).toBe(true);expect(saved.photo.scientific).toBe(false);
  vi.resetModules();const restored=await import('../src/solar/photo-album');
  expect(restored.loadPhotos()).toEqual([saved.photo]);
 });
 it('keeps a quota-rejected photo in session without destroying the previous durable album',async()=>{
  const album=await import('../src/solar/photo-album');
  const first=album.savePhoto({imageDataUrl:jpeg,target:'aster',label:'First',scientific:true});
  const durable=stored.get(album.PHOTO_ALBUM_KEY);
  storage.setItem.mockImplementation(()=>{throw new Error('QuotaExceededError');});
  const second=album.savePhoto({imageDataUrl:jpeg,target:'jupiter',label:'Second',scientific:false});
  expect(second.persisted).toBe(false);expect(stored.get(album.PHOTO_ALBUM_KEY)).toBe(durable);
  expect(album.loadPhotos().map(photo=>photo.id)).toContain(second.photo.id);
  vi.resetModules();const restored=await import('../src/solar/photo-album');expect(restored.loadPhotos()).toEqual([first.photo]);
 });
 it('bounds recent storage by both photo count and image size while keeping newest',async()=>{
  const album=await import('../src/solar/photo-album');let newest='';
  for(let i=0;i<18;i++)newest=album.savePhoto({imageDataUrl:jpeg,target:'aster',label:`Frame ${i}`,scientific:false}).photo.id;
  expect(album.loadPhotos()).toHaveLength(12);expect(album.loadPhotos().some(photo=>photo.id===newest)).toBe(true);
  const large='data:image/jpeg;base64,'+'A'.repeat(390000);
  for(let i=0;i<8;i++)newest=album.savePhoto({imageDataUrl:large,target:'mars',label:`Large ${i}`,scientific:false}).photo.id;
  expect(album.loadPhotos().reduce((sum,photo)=>sum+photo.imageDataUrl.length,0)).toBeLessThanOrEqual(1600000);
  expect(album.loadPhotos().some(photo=>photo.id===newest)).toBe(true);
 });
 it('rejects external image URLs and safely ignores corrupt persistent data',async()=>{
  const album=await import('../src/solar/photo-album');
  expect(()=>album.savePhoto({imageDataUrl:'https://example.org/photo.jpg',target:'aster',label:'External',scientific:false})).toThrow();
  stored.set(album.PHOTO_ALBUM_KEY,'{broken');expect(album.loadPhotos()).toEqual([]);
  stored.set(album.PHOTO_ALBUM_KEY,JSON.stringify({version:1,photos:[{id:'bad',imageDataUrl:jpeg,capturedAt:'not a date'}]}));expect(album.loadPhotos()).toEqual([]);
 });
});
