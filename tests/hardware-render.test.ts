import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BUSES, HARDWARE_MODELS, HARDWARE_VERSION, getPartGeometry } from '../src/hardware';
import { createBus, createPart, mats } from '../src/render/parts';
import {createInspectionOverlay,disposeInspectionOverlay} from '../src/render/inspection';
import type { Design, Part } from '../src/sim/types';

// Geometry audits do not require a GPU. Canvas is only a source for owned texture pixels.
beforeAll(()=>{
  const context={fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},createLinearGradient(){return {addColorStop(){}};}};
  vi.stubGlobal('document',{createElement:()=>({width:1,height:1,getContext:()=>context})});
});

function design(busId:'surveyor-l18-v1'|'pathfinder-d35-v1'='pathfinder-d35-v1'):Design {
  return {version:1,hardwareVersion:HARDWARE_VERSION,busId,missionId:'earth',name:'Geometry audit',parts:[],seed:1,plan:{altitudeKm:500,inclinationDeg:51,burnTime:0,progradeMps:0,normalMps:0,radialMps:0,periapsisAltitudeKm:1000,bPlaneAngleDeg:0,operations:[]}};
}
function part(modelId:string):Part {return {id:'audit',modelId,kind:HARDWARE_MODELS[modelId].kind,face:'py',u:0,v:0,rotation:0};}
function positions(group:THREE.Object3D):THREE.Vector3[] {
  const points:THREE.Vector3[]=[];group.updateMatrixWorld(true);
  group.traverse(o=>{if(o instanceof THREE.Mesh){const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld));}});
  return points;
}
describe('Original hardware meshes agree with physical descriptors',()=>{
  for(const modelId of Object.keys(HARDWARE_MODELS))it(`${modelId}: every rendered vertex lies in a declared mechanical box`,()=>{
    const d=design(),p=part(modelId),model=createPart(p,d),boxes=getPartGeometry(d,p).deployedBoxes;
    const outside=positions(model).filter(v=>!boxes.some(b=>[v.x,v.y,v.z].every((value,i)=>Math.abs(value-b.center[i])<=b.half[i]+.00005)));
    expect(outside.slice(0,5).map(v=>v.toArray()),`${outside.length} vertices outside shared physical boxes`).toEqual([]);
    expect(model.userData.hardwareModelId).toBe(modelId);
  });
  for(const busId of Object.keys(BUSES) as Array<'surveyor-l18-v1'|'pathfinder-d35-v1'>)it(`${busId}: shell and service bay preserve exact outer dimensions`,()=>{
    const d=design(busId),model=createBus(d),bounds=new THREE.Box3().setFromObject(model),half=BUSES[busId].halfSize;
    expect(bounds.min.toArray().every((n,i)=>n>=-half[i]-.00005)).toBe(true);
    expect(bounds.max.toArray().every((n,i)=>n<=half[i]+.00005)).toBe(true);
    expect(model.userData.bayBounds).toEqual(BUSES[busId].bay);
  });
  for(const busId of Object.keys(BUSES) as Array<'surveyor-l18-v1'|'pathfinder-d35-v1'>)it(`${busId}: closed lid surfaces are separated and exterior details remain visible`,()=>{
    const model=createBus(design(busId));model.updateMatrixWorld(true);
    const top=new THREE.Raycaster(new THREE.Vector3(.1,1.2,.1),new THREE.Vector3(0,-1,0)).intersectObject(model,true);
    const white=top.find(h=>(h.object as THREE.Mesh).material===mats.white),dark=top.find(h=>(h.object as THREE.Mesh).material===mats.dark);
    expect(white).toBeTruthy();expect(dark).toBeTruthy();expect(dark!.distance-white!.distance).toBeGreaterThan(.001);
    const front=new THREE.Raycaster(new THREE.Vector3(0,-.32,1),new THREE.Vector3(0,0,-1)).intersectObject(model,true);
    expect((front[0].object as THREE.Mesh).material).toBeInstanceOf(THREE.MeshBasicMaterial);
    const vent=new THREE.Raycaster(new THREE.Vector3(0,.12,1),new THREE.Vector3(0,0,-1)).intersectObject(model,true);
    expect((vent[0].object as THREE.Mesh).material).toBe(mats.dark);
  });
  it('uses three distinct photovoltaic surfaces per wing and eighteen for the six-wing assembly',()=>{
    for(const [id,count] of [['tsp45-fixed-v2',3],['tsp45-sixwing-v2',18]] as const){
      const model=createPart(part(id),design());let surfaces=0;
      model.traverse(o=>{if(o.name.startsWith('photovoltaic-patch-'))surfaces++;});
      expect(surfaces).toBe(count);
    }
  });
  it('retains the old mesh when a model-free legacy design uses the expanded factory',()=>{
    const d=design();delete d.hardwareVersion;delete d.busId;
    const p:Part={id:'old',kind:'camera',face:'nz',u:0,v:0,rotation:0};
    const before=positions(createPart('camera')).map(v=>v.toArray());
    expect(positions(createPart(p,d)).map(v=>v.toArray())).toEqual(before);
  });
  it('shows actual model optical half angles and a crossed-dipole pattern rather than the legacy cone',()=>{
    for(const [id,angle] of [['wide-mono-v2',12],['narrow-mono-v2',4]] as const){const d=design(),p=part(id);p.face='nz';d.parts=[p];const overlay=createInspectionOverlay(d,'camera');expect(overlay.group.userData.parts[0].halfAngleDegrees).toBe(angle);expect(overlay.group.userData.halfAngleDegrees).toBeNull();disposeInspectionOverlay(overlay.group);}
    const d=design();d.parts=[part('uhf-dipole-pair-v1')];d.parts[0].face='pz';const overlay=createInspectionOverlay(d,'antenna');expect(overlay.group.getObjectByName('inspection-fov-volume')).toBeUndefined();expect(overlay.group.getObjectByName('inspection-rays-normals')).toBeTruthy();disposeInspectionOverlay(overlay.group);
  });
  it('six-wing inspection samples all18 physical patches and reports EPS-limited actual power',()=>{
    const d=design(),p=part('tsp45-sixwing-v2');p.face='px';d.parts=[p];const overlay=createInspectionOverlay(d,'power',[1,0,0]);
    expect(overlay.group.userData.parts[0].samples).toHaveLength(90);expect(overlay.summary.value).toBeCloseTo(270,8);disposeInspectionOverlay(overlay.group);
    d.busId='surveyor-l18-v1';const capped=createInspectionOverlay(d,'power',[1,0,0]);expect(capped.summary.value).toBeLessThanOrEqual(120);disposeInspectionOverlay(capped.group);
  });
});
