import * as THREE from 'three';
import {EARTH_RADIUS_KM,magnitude} from '../sim/physics';
import {earthSubpoint,getTargetRequirements,groundFootprintRadiusKm,normalizeScienceTarget,scienceTargetKey,type GeographicPoint,type ScienceTarget} from '../sim/targets';
import type {Vec3} from '../sim/types';

export interface TargetRegionLayers {
  group:THREE.Group;
  marker:THREE.Mesh;
  boundary:THREE.LineLoop;
  cap:THREE.Mesh;
}
const UP=new THREE.Vector3(0,1,0),SEGMENTS=72,RADIAL_RINGS=16;
interface RegionBuffers extends TargetRegionLayers {
  radius:number;
  angle:number;
  boundaryPositions:THREE.BufferAttribute;
  capPositions:THREE.BufferAttribute;
  lineDistances?:THREE.BufferAttribute;
  footprint:boolean;
}
const buffers=new WeakMap<THREE.Group,RegionBuffers>();

/** Earth-fixed latitude/longitude -> renderer [X,Z,-Y], at the given scene radius. */
export function geographicToRender(point:GeographicPoint,radius=3.02):THREE.Vector3 {
  if(!Number.isFinite(point.latDeg)||Math.abs(point.latDeg)>90||!Number.isFinite(point.lonDeg)||!Number.isFinite(radius)||radius<=0)throw new Error('유효한 위도·경도와 표시 반지름이 필요합니다.');
  const lat=point.latDeg*Math.PI/180,lon=point.lonDeg*Math.PI/180;
  return new THREE.Vector3(radius*Math.cos(lat)*Math.cos(lon),radius*Math.sin(lat),-radius*Math.cos(lat)*Math.sin(lon));
}
/** Input must already be in Earth-fixed local coordinates, not the rotated scene. */
export function renderToGeographic(position:THREE.Vector3):GeographicPoint {
  const radius=position.length();if(radius<=0||![position.x,position.y,position.z].every(Number.isFinite))throw new Error('지구 표면의 유효한 좌표가 필요합니다.');
  return {latDeg:Math.asin(THREE.MathUtils.clamp(position.y/radius,-1,1))*180/Math.PI,lonDeg:((Math.atan2(-position.z,position.x)*180/Math.PI+180)%360+360)%360-180};
}

// Topology is allocated once. A dynamic footprint changes only existing position
// buffers and its quaternion, never creates per-frame geometry/material/texture.
function writeShape(record:RegionBuffers,angle:number):void {
  const {radius,boundaryPositions,capPositions}=record;
  for(let i=0;i<SEGMENTS;i++){
    const a=i/SEGMENTS*Math.PI*2;
    boundaryPositions.setXYZ(i,radius*Math.sin(angle)*Math.cos(a),radius*Math.cos(angle),radius*Math.sin(angle)*Math.sin(a));
  }
  for(let row=0;row<=RADIAL_RINGS;row++)for(let col=0;col<=SEGMENTS;col++){
    const polar=angle*row/RADIAL_RINGS,azimuth=col/SEGMENTS*Math.PI*2,index=row*(SEGMENTS+1)+col;
    capPositions.setXYZ(index,radius*Math.sin(polar)*Math.cos(azimuth),radius*Math.cos(polar),radius*Math.sin(polar)*Math.sin(azimuth));
  }
  boundaryPositions.needsUpdate=true;capPositions.needsUpdate=true;
  record.boundary.geometry.computeBoundingSphere();record.cap.geometry.computeBoundingSphere();record.angle=angle;
  if(record.lineDistances){const segmentLength=2*radius*Math.sin(angle)*Math.sin(Math.PI/SEGMENTS);for(let i=0;i<SEGMENTS;i++)record.lineDistances.setX(i,i*segmentLength);record.lineDistances.needsUpdate=true;}
}
function orient(record:RegionBuffers,center:GeographicPoint):void {
  record.group.quaternion.setFromUnitVectors(UP,geographicToRender(center,1));
  record.group.userData.center={...center};
}
function createRegion(center:GeographicPoint,regionRadiusKm:number,radius:number,hex:number,footprint:boolean):TargetRegionLayers {
  if(!Number.isFinite(radius)||radius<=0)throw new Error('표시 반지름은 양수여야 합니다.');
  const group=new THREE.Group();group.name=footprint?'observation-footprint':'science-target-region';
  const boundaryPositions=new THREE.BufferAttribute(new Float32Array(SEGMENTS*3),3).setUsage(THREE.DynamicDrawUsage);
  const boundaryGeometry=new THREE.BufferGeometry();boundaryGeometry.setAttribute('position',boundaryPositions);
  const lineDistances=footprint?new THREE.BufferAttribute(new Float32Array(SEGMENTS),1).setUsage(THREE.DynamicDrawUsage):undefined;
  if(lineDistances)boundaryGeometry.setAttribute('lineDistance',lineDistances);
  const boundary=new THREE.LineLoop(boundaryGeometry,footprint?new THREE.LineDashedMaterial({color:hex,dashSize:.045,gapSize:.025,transparent:true,opacity:.9,depthWrite:false}):new THREE.LineBasicMaterial({color:hex,transparent:true,opacity:.95,depthWrite:false}));
  boundary.name=footprint?'footprint-boundary-dashed':'target-boundary-solid';boundary.renderOrder=5;
  const capPositions=new THREE.BufferAttribute(new Float32Array((RADIAL_RINGS+1)*(SEGMENTS+1)*3),3).setUsage(THREE.DynamicDrawUsage);
  const capGeometry=new THREE.BufferGeometry();capGeometry.setAttribute('position',capPositions);
  const indices:number[]=[];
  for(let row=0;row<RADIAL_RINGS;row++)for(let col=0;col<SEGMENTS;col++){
    const a=row*(SEGMENTS+1)+col,b=a+SEGMENTS+1,c=b+1,d=a+1;
    if(row>0)indices.push(a,d,c);indices.push(a,c,b);
  }
  capGeometry.setIndex(indices);
  const cap=new THREE.Mesh(capGeometry,new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:footprint?.1:.13,side:THREE.DoubleSide,depthWrite:false}));
  cap.name=footprint?'sensor-footprint-cap':'target-region-cap';cap.renderOrder=4;
  const marker=new THREE.Mesh(new THREE.SphereGeometry(footprint?.018:.033,12,8),new THREE.MeshBasicMaterial({color:hex,depthWrite:false}));
  marker.name=footprint?'nadir-footprint-centre':'selected-geographic-target';marker.position.set(0,radius+.018,0);marker.renderOrder=6;
  // Root raycasts its Earth sphere for choosing a region. Overlay fills must not
  // steal that interaction, and the transparent far-side cap stays depth-occluded.
  cap.raycast=()=>{};boundary.raycast=()=>{};marker.raycast=()=>{};
  group.add(cap,boundary,marker);
  group.userData={kind:footprint?'observation-footprint':'science-target',coordinateFrame:'Earth-fixed geographic, renderer [X,Z,-Y]',renderRadius:radius,regionRadiusKm,angularRadiusRad:regionRadiusKm/EARTH_RADIUS_KM,units:'region/footprint radius km; render radius scene units',center:{...center}};
  const record:RegionBuffers={group,marker,boundary,cap,radius,angle:-1,boundaryPositions,capPositions,lineDistances,footprint};buffers.set(group,record);
  writeShape(record,regionRadiusKm/EARTH_RADIUS_KM);orient(record,center);
  return {group,marker,boundary,cap};
}

/**
 * True spherical target region. Attach to the Earth-fixed groundFeatures group
 * that rotates Y by time*EARTH_ROTATION_RAD_S alongside the Earth mesh. Do not
 * rotate this helper a second time. Marker/cap/boundary all share local geometry.
 */
export function createTargetRegion(target:ScienceTarget,radius=3.02,hardwareProfile=false):TargetRegionLayers {
  const t=normalizeScienceTarget(target),requirements=getTargetRequirements(t,hardwareProfile);
  const layers=createRegion(t,requirements.regionRadiusKm,radius,t.profile==='precision'?0xffc675:0x6ce5c9,false);
  Object.assign(layers.group.userData,{targetKey:scienceTargetKey(t),profile:t.profile,label:requirements.name});
  return layers;
}

/** Nadir reference FOV footprint, not the actual sensor projection during slew. */
export function createObservationFootprint(positionKm:Vec3,timeS:number,radius=3.025,halfFovDeg=28):TargetRegionLayers {
  if(!Number.isFinite(halfFovDeg)||halfFovDeg<=0||halfFovDeg>=90)throw new Error('A physical camera half-FOV between 0 and 90 degrees is required.');
  const altitudeKm=magnitude(positionKm)-EARTH_RADIUS_KM;
  const layers=createRegion(earthSubpoint(positionKm,timeS),groundFootprintRadiusKm(altitudeKm,halfFovDeg),radius,0x91ceff,true);
  Object.assign(layers.group.userData,{
    halfFovDeg,
    label:'Nadir reference footprint',
    labelKo:'천저 기준 관측 범위',
    tooltip:`Geometric ${halfFovDeg}° half-FOV at the current altitude, assuming the camera points straight down. It does not project the actual slewing attitude or certify a valid observation.`,
    tooltipKo:`현재 고도에서 카메라가 바로 아래를 볼 때의 반시야각 ${halfFovDeg}° 기하 범위입니다. 자세 전환 중 실제 시야나 유효 관측을 뜻하지 않습니다.`
  });
  updateObservationFootprint(layers.group,positionKm,timeS);return layers;
}

/** Reuses all objects/buffers; safe to call with every telemetry update. */
export function updateObservationFootprint(group:THREE.Group,positionKm:Vec3,timeS:number,halfFovOverride?:number):void {
  const record=buffers.get(group);if(!record?.footprint)throw new Error('createObservationFootprint로 만든 그룹이 필요합니다.');
  const center=earthSubpoint(positionKm,timeS),altitudeKm=magnitude(positionKm)-EARTH_RADIUS_KM;
  const halfFovDeg=halfFovOverride??group.userData.halfFovDeg??28,footprintKm=groundFootprintRadiusKm(altitudeKm,halfFovDeg),angle=footprintKm/EARTH_RADIUS_KM;
  if(!Number.isFinite(halfFovDeg)||halfFovDeg<=0||halfFovDeg>=90)throw new Error('A physical camera half-FOV between 0 and 90 degrees is required.');
  Object.assign(group.userData,{halfFovDeg,tooltip:`Geometric ${halfFovDeg}° half-FOV at the current altitude, assuming the camera points straight down. It does not project the actual slewing attitude or certify a valid observation.`,tooltipKo:`현재 고도에서 카메라가 바로 아래를 볼 때의 반시야각 ${halfFovDeg}° 기하 범위입니다. 자세 전환 중 실제 시야나 유효 관측을 뜻하지 않습니다.`});
  orient(record,center);
  if(Math.abs(angle-record.angle)>1e-10)writeShape(record,angle);
  group.visible=altitudeKm>0;
  Object.assign(group.userData,{timeS,altitudeKm,regionRadiusKm:footprintKm,angularRadiusRad:angle,assumptions:`Nadir, ${halfFovDeg} degree half-FOV, spherical Earth. Visibility and pointing must be supplied by the scene; this geometric footprint alone does not mean a valid observation.`});
}

/** These objects own their resources. No shared game material is disposed. */
export function disposeTargetRegion(group:THREE.Group):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material);}});
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();buffers.delete(group);group.removeFromParent();group.clear();
}
