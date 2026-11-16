import {beforeAll,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {createBus,createPart,isSharedPartTexture} from '../src/render/parts';
import {HARDWARE_MODELS,HARDWARE_VERSION,getPartGeometry} from '../src/hardware';
import type {Design,Part} from '../src/sim/types';

const canvases:Array<{width:number;height:number}>=[];
beforeAll(()=>{
  const context={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},createLinearGradient(){return {addColorStop(){}};}};
  vi.stubGlobal('document',{createElement:()=>{const canvas={width:1,height:1,getContext:()=>context};canvases.push(canvas);return canvas;}});
});
const design:Design={version:1,hardwareVersion:HARDWARE_VERSION,busId:'pathfinder-d35-v1',missionId:'earth',name:'Art contract',parts:[],seed:1,plan:{altitudeKm:500,inclinationDeg:51,burnTime:0,progradeMps:0,normalMps:0,radialMps:0,periapsisAltitudeKm:1000,bPlaneAngleDeg:0,operations:[]}};
const part=(modelId:string):Part=>({id:'art',modelId,kind:HARDWARE_MODELS[modelId].kind,face:'py',u:0,v:0,rotation:0});
function maps(object:THREE.Object3D){const values=new Set<THREE.Texture>();object.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const key of ['map','roughnessMap','bumpMap'] as const){const texture=(m as THREE.MeshStandardMaterial)[key];if(texture?.name.startsWith('original-hardware-'))values.add(texture);}});return [...values];}

describe('Hardware art resource and optical contracts',()=>{
  it('does not allocate hardware surface atlases for legacy-only factories',()=>{
    createBus();createPart('camera');createPart('battery');
    expect(canvases.some(c=>c.width===1024)).toBe(false);
  });
  it('reuses two protected atlas sources across radios and bus surfaces',()=>{
    const a=maps(createPart(part('ax100u-carrier-v1'),design)),b=maps(createPart(part('iris22-carrier-v1'),design)),bus=maps(createBus(design));
    expect(a).toHaveLength(2);expect(new Set([...a,...b,...bus]).size).toBe(2);
    for(const texture of a)expect(isSharedPartTexture(texture)).toBe(true);
    expect(isSharedPartTexture(new THREE.Texture())).toBe(false);
    const sizes=a.map(t=>{const image=t.image as HTMLCanvasElement;return [image.width,image.height];});expect(sizes).toContainEqual([1024,1024]);expect(sizes).toContainEqual([512,512]);
  });
  it.each(['wide-mono-v2','narrow-mono-v2','mars-spectra-v2'])('%s recesses the visible glass without changing the shared aperture',modelId=>{
    const p=part(modelId),before=structuredClone(getPartGeometry(design,p)),model=createPart(p,design),glass=model.getObjectByName('recessed-optical-glass') as THREE.Mesh;
    expect(glass).toBeTruthy();expect(glass.position.z).toBeLessThan(before.apertures[0].center[2]);
    model.updateMatrixWorld(true);const aperture=before.apertures[0],ray=new THREE.Raycaster(new THREE.Vector3(...aperture.center).add(new THREE.Vector3(0,0,.1)),new THREE.Vector3(0,0,-1));
    expect(ray.intersectObject(model,true)[0]?.object.name).toBe('recessed-optical-glass');
    const material=glass.material as THREE.MeshPhysicalMaterial;expect(material.transmission).toBe(0);expect(material.transparent).toBe(false);
    expect(getPartGeometry(design,p)).toEqual(before);
    let triangles=0;model.traverse(o=>{if(o instanceof THREE.Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
    expect(triangles-2104).toBeLessThanOrEqual(300);
  });
});
