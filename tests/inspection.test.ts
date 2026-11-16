import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createInspectionOverlay,disposeInspectionOverlay,type PartInspection} from '../src/render/inspection';
import {createDesign} from '../src/sim/catalog';
import {partVisibility,solarGeneration} from '../src/sim/assembly';
import type {Vec3} from '../src/sim/types';

describe('workshop inspection overlay',()=>{
  it('uses the actual power model and exposes a body-local draggable sun at radius 2.4 m',()=>{
    const d=createDesign('earth'),sun:Vec3=[1,.25,.2],overlay=createInspectionOverlay(d,'power',sun);
    expect(overlay.summary.value).toBeCloseTo(solarGeneration(d,sun,false,1).powerW,12);
    const handle=overlay.group.getObjectByName('inspection-sun-handle')!;
    expect(handle.userData.inspectionHandle).toBe('sun');expect(handle.position.length()).toBeCloseTo(2.4,12);
    expect(overlay.group.children.length).toBeLessThanOrEqual(4);disposeInspectionOverlay(overlay.group);
  });
  it('changes both shown watts and exact sampled visibility when an adjacent array moves',()=>{
    const d=createDesign('earth','starter');d.parts=[{id:'a',kind:'solar',face:'px',u:0,v:0,rotation:0},{id:'b',kind:'solarLarge',face:'pz',u:.45,v:0,rotation:0}];
    const sun:Vec3=[.025,0,1],before=createInspectionOverlay(d,'power',sun);
    d.parts[1].u=-.45;const after=createInspectionOverlay(d,'power',sun);
    const records=(g:THREE.Group)=>g.userData.parts as PartInspection[];
    expect(records(before.group)[0].visibility).toBeLessThan(records(after.group)[0].visibility);
    expect(before.summary.value).toBeLessThan(after.summary.value);
    for(const record of records(after.group))expect(record.visibility).toBe(record.samples.filter(s=>s.clear&&s.pointing).length/5);
    disposeInspectionOverlay(before.group);disposeInspectionOverlay(after.group);
  });
  it('shows the same camera pointing failure as simulation and recovers when its mounting face is corrected',()=>{
    const d=createDesign('earth','starter');d.parts=[{id:'camera',kind:'camera',face:'pz',u:0,v:0,rotation:0}];
    const bad=createInspectionOverlay(d,'camera');expect(bad.summary.value).toBe(0);
    d.parts[0].face='nz';const good=createInspectionOverlay(d,'camera');
    expect(good.summary.value).toBe(partVisibility(d,d.parts[0],[0,0,-1],Math.cos(28*Math.PI/180))*100);
    expect(good.summary.value).toBe(100);expect(good.group.userData.halfAngleDegrees).toBe(28);
    disposeInspectionOverlay(bad.group);disposeInspectionOverlay(good.group);
  });
  it('uses the antenna 12 degree +Z reference and Mars inverse-square power condition',()=>{
    const d=createDesign('mars'),antenna=createInspectionOverlay(d,'antenna'),power=createInspectionOverlay(d,'power',[1,0,0]);
    expect(antenna.summary.value).toBe(100);expect(antenna.group.userData.halfAngleDegrees).toBe(12);
    expect(power.summary.value).toBeCloseTo(solarGeneration(d,[1,0,0],false,1.524).powerW,12);
    disposeInspectionOverlay(antenna.group);disposeInspectionOverlay(power.group);
  });
  it('does not modify the design and disposes every owned geometry and material',()=>{
    const d=createDesign('earth'),before=JSON.stringify(d),overlay=createInspectionOverlay(d,'camera');
    let geometryCount=0,materialCount=0,geometriesDisposed=0,materialsDisposed=0;
    overlay.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){geometryCount++;o.geometry.addEventListener('dispose',()=>geometriesDisposed++);for(const material of Array.isArray(o.material)?o.material:[o.material]){materialCount++;material.addEventListener('dispose',()=>materialsDisposed++);}}});
    disposeInspectionOverlay(overlay.group);expect(geometriesDisposed).toBe(geometryCount);expect(materialsDisposed).toBe(materialCount);expect(overlay.group.children).toHaveLength(0);expect(JSON.stringify(d)).toBe(before);
  });
  it('handles an empty design and a degenerate direction without NaN geometry',()=>{
    const d=createDesign('earth','starter'),overlay=createInspectionOverlay(d,'power',[0,0,0]);expect(overlay.summary.value).toBe(0);
    overlay.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){const values=o.geometry.getAttribute('position').array;expect(Array.from(values).every(Number.isFinite)).toBe(true);}});
    disposeInspectionOverlay(overlay.group);
  });
});
