import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createTargetRegion,createObservationFootprint,updateObservationFootprint,disposeTargetRegion,geographicToRender,renderToGeographic} from '../src/render/targets';
import {earthSubpoint,getTargetRequirements,groundFootprintRadiusKm} from '../src/sim/targets';
import {EARTH_RADIUS_KM,groundPosition,magnitude,scale} from '../src/sim/physics';

describe('Earth-fixed science target rendering',()=>{
  it('uses the hardware precision region without changing the legacy radius',()=>{
    const target={profile:'precision' as const,latDeg:0,lonDeg:0},legacy=createTargetRegion(target),hardware=createTargetRegion(target,3.02,true);
    expect(legacy.group.userData.regionRadiusKm).toBe(70);expect(hardware.group.userData.regionRadiusKm).toBe(10);
    disposeTargetRegion(legacy.group);disposeTargetRegion(hardware.group);
  });
  it('keeps the actual optical half-FOV through updates and permits changing the reference camera',()=>{
    const p:[number,number,number]=[EARTH_RADIUS_KM+600,0,0],layers=createObservationFootprint(p,0,3.025,4);
    expect(layers.group.userData.regionRadiusKm).toBeCloseTo(groundFootprintRadiusKm(600,4),8);
    updateObservationFootprint(layers.group,[EARTH_RADIUS_KM+900,0,0],1);
    expect(layers.group.userData.halfFovDeg).toBe(4);expect(layers.group.userData.regionRadiusKm).toBeCloseTo(groundFootprintRadiusKm(900,4),8);
    updateObservationFootprint(layers.group,p,2,12);
    expect(layers.group.userData.regionRadiusKm).toBeCloseTo(groundFootprintRadiusKm(600,12),8);expect(layers.group.userData.tooltip).toContain('12°');
    disposeTargetRegion(layers.group);
  });
  it('uses the physical [X,Z,-Y] coordinate mapping and reversible geographic picking',()=>{
    expect(geographicToRender({latDeg:0,lonDeg:0},3).toArray()).toEqual([3,0,-0]);
    const east=geographicToRender({latDeg:0,lonDeg:90},3);expect(east.x).toBeCloseTo(0);expect(east.z).toBeCloseTo(-3);
    expect(geographicToRender({latDeg:90,lonDeg:0},3).y).toBeCloseTo(3);
    const p={latDeg:38.25,lonDeg:-122.75},roundtrip=renderToGeographic(geographicToRender(p));expect(roundtrip.latDeg).toBeCloseTo(p.latDeg,10);expect(roundtrip.lonDeg).toBeCloseTo(p.lonDeg,10);
  });
  it.each(['precision','survey'] as const)('%s region preserves its physical angular radius at every boundary vertex',profile=>{
    const target={profile,latDeg:36,lonDeg:179},layers=createTargetRegion(target),normal=geographicToRender(target,1),expected=getTargetRequirements(target).regionRadiusKm/EARTH_RADIUS_KM;
    const position=layers.boundary.geometry.getAttribute('position');
    for(let i=0;i<position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(position,i).applyQuaternion(layers.group.quaternion);expect(p.length()).toBeCloseTo(3.02,5);expect(p.angleTo(normal)).toBeCloseTo(expected,5);}
    const capPosition=layers.cap.geometry.getAttribute('position');for(let i=0;i<capPosition.count;i++)expect(new THREE.Vector3().fromBufferAttribute(capPosition,i).length()).toBeCloseTo(3.02,5);
    disposeTargetRegion(layers.group);
  });
  it('updates a footprint without allocating new geometry or materials, and removes Earth rotation exactly once',()=>{
    const first=scale(groundPosition(10,30,0),(EARTH_RADIUS_KM+600)/EARTH_RADIUS_KM),layers=createObservationFootprint(first,0);
    const capGeometry=layers.cap.geometry,boundaryGeometry=layers.boundary.geometry,capMaterial=layers.cap.material,position=capGeometry.getAttribute('position');
    const later=scale(groundPosition(42,-70,3600),(EARTH_RADIUS_KM+900)/EARTH_RADIUS_KM);updateObservationFootprint(layers.group,later,3600);
    expect(layers.cap.geometry).toBe(capGeometry);expect(layers.boundary.geometry).toBe(boundaryGeometry);expect(layers.cap.material).toBe(capMaterial);expect(layers.cap.geometry.getAttribute('position')).toBe(position);
    const center=new THREE.Vector3(0,1,0).applyQuaternion(layers.group.quaternion),point=renderToGeographic(center),expected=earthSubpoint(later,3600);
    expect(point.latDeg).toBeCloseTo(expected.latDeg,8);expect(point.lonDeg).toBeCloseTo(expected.lonDeg,8);expect(point.lonDeg).toBeCloseTo(-70,8);
    expect(layers.group.userData.regionRadiusKm).toBeCloseTo(groundFootprintRadiusKm(magnitude(later)-EARTH_RADIUS_KM),8);
    disposeTargetRegion(layers.group);
  });
  it('uses separate solid target and dashed footprint boundaries without capturing Earth picks',()=>{
    const target=createTargetRegion({profile:'precision',latDeg:0,lonDeg:0}),footprint=createObservationFootprint([EARTH_RADIUS_KM+600,0,0],0);
    expect(target.boundary.material).toBeInstanceOf(THREE.LineBasicMaterial);expect(footprint.boundary.material).toBeInstanceOf(THREE.LineDashedMaterial);
    const hits:THREE.Intersection[]=[];target.cap.raycast(new THREE.Raycaster(),hits);target.marker.raycast(new THREE.Raycaster(),hits);expect(hits).toHaveLength(0);
    disposeTargetRegion(target.group);disposeTargetRegion(footprint.group);
  });
  it('hides physically invalid ground-level footprints and disposes every owned resource',()=>{
    const layers=createObservationFootprint([EARTH_RADIUS_KM+600,0,0],0);let disposed=0;
    for(const object of [layers.marker,layers.boundary,layers.cap]){object.geometry.addEventListener('dispose',()=>disposed++);const materials=Array.isArray(object.material)?object.material:[object.material];for(const m of materials)m.addEventListener('dispose',()=>disposed++);}
    updateObservationFootprint(layers.group,[EARTH_RADIUS_KM,0,0],0);expect(layers.group.visible).toBe(false);
    disposeTargetRegion(layers.group);expect(disposed).toBe(6);expect(layers.group.children).toHaveLength(0);
  });
});
