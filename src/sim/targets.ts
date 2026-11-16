import {clamp,DEG,dot,EARTH_RADIUS_KM,groundPosition,magnitude,normalize,scale,sub,SUN_DIRECTION} from './physics';
import type {Vec3} from './types';

export type ScienceProfile='precision'|'survey';
export interface ScienceTarget {profile:ScienceProfile;latDeg:number;lonDeg:number}
export interface TargetRequirements {
  readonly id:ScienceProfile|'legacy';
  readonly name:string;
  readonly question:string;
  readonly targetPackets:number;
  readonly minimumQuality:number;
  readonly regionRadiusKm:number;
  readonly maximumGroundSampleM:number|null;
  readonly cellSizeDeg:number;
  readonly packetBits:number;
}
export interface GeographicPoint {latDeg:number;lonDeg:number}
export interface EarthTargetEvaluation {
  withinFootprint:boolean;
  illuminated:boolean;
  quality:number;
  resolutionAcceptable:boolean;
  meetsQuality:boolean;
  eligible:boolean;
  cellId:string;
  requirements:TargetRequirements;
  subpoint:GeographicPoint;
  observedPoint:GeographicPoint;
  groundFootprintRadiusKm:number;
  groundSamplingDistanceM:number;
  offNadirDeg:number;
  targetDistanceKm:number;
  detectorWindowPixelsAcross?:number;
  detectorWindowCoverageKm?:number;
  windowCoverageAcceptable?:boolean;
  reason:'ready'|'outside-region'|'outside-footprint'|'night'|'resolution'|'occluded';
}

export const EARTH_ROTATION_RAD_S=7.2921159e-5;
export const CAMERA_HALF_FOV_DEG=28;
// This camera IFOV and compressed packet sizes are explicit educational design
// assumptions, not a specification of a NASA/manufacturer camera. Local ground
// sampling distance = slant range * IFOV / surface viewing cosine (worst axis).
export const CAMERA_PIXEL_IFOV_RAD=50e-6;
export const TARGET_PROFILES:Readonly<Record<ScienceProfile,TargetRequirements>>=Object.freeze({
  precision:Object.freeze({id:'precision',name:'지역 정밀 관측',question:'선택한 작은 지역 전체를 요구 공간 해상도로 한 번 관측할 수 있는가?',targetPackets:1,minimumQuality:.8,regionRadiusKm:70,maximumGroundSampleM:35,cellSizeDeg:0,packetBits:48e6}),
  survey:Object.freeze({id:'survey',name:'광역 지표 조사',question:'선택한 넓은 지역에서 서로 다른 지표 구획 네 곳의 자료를 받을 수 있는가?',targetPackets:4,minimumQuality:.45,regionRadiusKm:1400,maximumGroundSampleM:90,cellSizeDeg:4,packetBits:16e6}),
});
export const LEGACY_TARGET_REQUIREMENTS:TargetRequirements=Object.freeze({id:'legacy',name:'북반구 관측 회랑',question:'북반구 육지와 해안의 고유 관측 자료를 지상으로 전달할 수 있는가?',targetPackets:4,minimumQuality:.45,regionRadiusKm:0,maximumGroundSampleM:null,cellSizeDeg:6,packetBits:24e6});

/** Canonical geographic selection. Longitude wraps; latitude is never silently moved. */
export function normalizeScienceTarget(target:ScienceTarget):ScienceTarget {
  if(!target||!['precision','survey'].includes(target.profile))throw new Error('지원하지 않는 과학 목표 유형입니다.');
  if(!Number.isFinite(target.latDeg)||target.latDeg< -90||target.latDeg>90||!Number.isFinite(target.lonDeg))throw new Error('목표 위도·경도 범위를 확인하세요.');
  const round=(n:number)=>Math.round(n*1e6)/1e6;
  return {profile:target.profile,latDeg:round(target.latDeg),lonDeg:round(((target.lonDeg+180)%360+360)%360-180)};
}
export function scienceTargetKey(target?:ScienceTarget):string {
  if(!target)return 'legacy';const t=normalizeScienceTarget(target);return `${t.profile}:${t.latDeg.toFixed(6)}:${t.lonDeg.toFixed(6)}`;
}
export const HARDWARE_TARGET_PROFILES:Readonly<Record<ScienceProfile,TargetRequirements>>=Object.freeze({...TARGET_PROFILES,precision:Object.freeze({...TARGET_PROFILES.precision,regionRadiusKm:10,question:'선택한 반경 10 km 지역 전체를 요구 공간 해상도로 관측하고 검출기 창의 원본 자료를 수신할 수 있는가?',packetBits:1024**2*12}),survey:Object.freeze({...TARGET_PROFILES.survey,packetBits:512**2*12})});
export function getTargetRequirements(target?:ScienceTarget,hardwareProfile=false):TargetRequirements {
  return target?(hardwareProfile?HARDWARE_TARGET_PROFILES:TARGET_PROFILES)[normalizeScienceTarget(target).profile]:LEGACY_TARGET_REQUIREMENTS;
}
export function earthSubpoint(positionKm:Vec3,timeS:number):GeographicPoint {
  const r=magnitude(positionKm);
  if(!positionKm.every(Number.isFinite)||r<=0||!Number.isFinite(timeS))throw new Error('유효한 지구 중심 위치·시각이 필요합니다.');
  const latDeg=Math.asin(clamp(positionKm[2]/r,-1,1))/DEG;
  const inertialLon=Math.atan2(positionKm[1],positionKm[0])/DEG-timeS*EARTH_ROTATION_RAD_S/DEG;
  return {latDeg,lonDeg:((inertialLon+180)%360+360)%360-180};
}
function surfaceUnit(point:GeographicPoint):Vec3 {
  const lat=point.latDeg*DEG,lon=point.lonDeg*DEG;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
}
export function surfaceDistanceKm(a:GeographicPoint,b:GeographicPoint):number {
  return EARTH_RADIUS_KM*Math.acos(clamp(dot(surfaceUnit(a),surfaceUnit(b)),-1,1));
}
/** Exact spherical-Earth nadir footprint radius; half-FOV is clipped at the limb. */
export function groundFootprintRadiusKm(altitudeKm:number,halfFovDeg=CAMERA_HALF_FOV_DEG):number {
  if(!Number.isFinite(altitudeKm)||altitudeKm<=0)return 0;
  if(!Number.isFinite(halfFovDeg)||halfFovDeg<=0||halfFovDeg>=90)throw new Error('센서 반각은 0도 초과 90도 미만이어야 합니다.');
  const distance=EARTH_RADIUS_KM+altitudeKm,limb=Math.asin(EARTH_RADIUS_KM/distance),alpha=Math.min(halfFovDeg*DEG,limb);
  const beta=Math.asin(clamp(distance/EARTH_RADIUS_KM*Math.sin(alpha),-1,1))-alpha;
  return Math.max(0,beta*EARTH_RADIUS_KM);
}

/**
 * Shared science predicate for previews, execution and ground overlays.
 * Coordinates: Earth-centred inertial X/Y equatorial, Z north, km and elapsed s.
 * Epoch rotation is the same simplified rotation convention as groundPosition.
 * Omitted target reproduces the existing corridor/quality/cell rule exactly.
 * Precision covers the entire selected 70-km-radius region; survey accepts the
 * centre of a global 4-degree cell inside the selected 1,400-km region. These are
 * disclosed sampling rules, not a rendered image/atmospheric sensor simulator.
 * A cell ID is stable in time: repeat frames/retransmissions never create science.
 */
export function evaluateEarthTarget(
  target:ScienceTarget|undefined,
  positionKm:Vec3,
  timeS:number,
  altitudeKm:number,
  apertureVisibility:number,
  optics?:{halfAngleDeg:number;ifovRad:number;windowPixelsAcross?:number},
  hardwareProfile=false,
):EarthTargetEvaluation {
  if(!Number.isFinite(altitudeKm)||!Number.isFinite(apertureVisibility))throw new Error('고도와 개구 가시율은 유한한 값이어야 합니다.');
  const subpoint=earthSubpoint(positionKm,timeS),visibility=clamp(apertureVisibility,0,1);
  const footprint=groundFootprintRadiusKm(altitudeKm,optics?.halfAngleDeg??CAMERA_HALF_FOV_DEG),requirements=getTargetRequirements(target,hardwareProfile);
  if(!target){
    const illuminated=dot(normalize(positionKm),SUN_DIRECTION)>.05;
    const withinFootprint=subpoint.latDeg>=15&&subpoint.latDeg<=65&&subpoint.lonDeg>=15&&subpoint.lonDeg<=150;
    const quality=clamp(Math.min(1,700/Math.max(altitudeKm,1))*visibility,0,1),meetsQuality=quality>=requirements.minimumQuality;
    return {withinFootprint,illuminated,quality,resolutionAcceptable:true,meetsQuality,eligible:withinFootprint&&illuminated&&meetsQuality,cellId:`${Math.round(subpoint.latDeg/6)}:${Math.round(subpoint.lonDeg/6)}`,requirements,subpoint,observedPoint:subpoint,groundFootprintRadiusKm:footprint,groundSamplingDistanceM:Math.max(0,altitudeKm)*1000*(optics?.ifovRad??CAMERA_PIXEL_IFOV_RAD),offNadirDeg:0,targetDistanceKm:0,reason:!withinFootprint?'outside-region':!illuminated?'night':!meetsQuality?'occluded':'ready'};
  }
  const t=normalizeScienceTarget(target),key=scienceTargetKey(t);
  const observedPoint:GeographicPoint=t.profile==='precision'?{latDeg:t.latDeg,lonDeg:t.lonDeg}:{
    latDeg:clamp(Math.round(subpoint.latDeg/requirements.cellSizeDeg)*requirements.cellSizeDeg,-88,88),
    lonDeg:((Math.round(subpoint.lonDeg/requirements.cellSizeDeg)*requirements.cellSizeDeg+180)%360+360)%360-180,
  };
  const targetDistanceKm=surfaceDistanceKm(subpoint,t),distanceToSampleKm=surfaceDistanceKm(subpoint,observedPoint);
  const insideRegion=t.profile==='precision'||surfaceDistanceKm(t,observedPoint)<=requirements.regionRadiusKm+1e-7;
  const point=groundPosition(observedPoint.latDeg,observedPoint.lonDeg,timeS),toGround=sub(point,positionKm),toCraft=scale(toGround,-1);
  const surfaceCosine=dot(normalize(point),normalize(toCraft));
  const offNadirDeg=Math.acos(clamp(dot(scale(normalize(positionKm),-1),normalize(toGround)),-1,1))/DEG;
  const visible=surfaceCosine>0&&offNadirDeg<=(optics?.halfAngleDeg??CAMERA_HALF_FOV_DEG)+1e-8;
  const minimumGroundPixelM=magnitude(toGround)*1000*(optics?.ifovRad??CAMERA_PIXEL_IFOV_RAD),detectorWindowCoverageKm=optics?.windowPixelsAcross?optics.windowPixelsAcross*minimumGroundPixelM/1000:undefined,windowCoverageAcceptable=t.profile!=='precision'||detectorWindowCoverageKm===undefined||detectorWindowCoverageKm>=requirements.regionRadiusKm*2;
  const withinFootprint=windowCoverageAcceptable&&altitudeKm>0&&insideRegion&&visible&&(t.profile==='precision'?distanceToSampleKm+requirements.regionRadiusKm<=footprint+1e-7:distanceToSampleKm<=footprint+1e-7);
  const illuminated=dot(normalize(point),SUN_DIRECTION)>.05;
  const groundSamplingDistanceM=surfaceCosine>0?magnitude(toGround)*1000*(optics?.ifovRad??CAMERA_PIXEL_IFOV_RAD)/surfaceCosine:Infinity;
  const resolutionAcceptable=groundSamplingDistanceM<=(requirements.maximumGroundSampleM??Infinity)+1e-7;
  // A required GSD is a hard science criterion. It must not be averaged away by
  // good power/visibility; quality zero exposes a coarse image as unusable.
  const quality=resolutionAcceptable?visibility:0,meetsQuality=resolutionAcceptable&&quality>=requirements.minimumQuality;
  const cellId=t.profile==='precision'?`${key}:region`:`${key}:cell:${observedPoint.latDeg}:${observedPoint.lonDeg}`;
  const reason:EarthTargetEvaluation['reason']=!insideRegion?'outside-region':!withinFootprint?'outside-footprint':!illuminated?'night':!resolutionAcceptable?'resolution':!meetsQuality?'occluded':'ready';
  return {...(optics?.windowPixelsAcross?{detectorWindowPixelsAcross:optics.windowPixelsAcross,detectorWindowCoverageKm,windowCoverageAcceptable}:{}),withinFootprint,illuminated,quality,resolutionAcceptable,meetsQuality,eligible:withinFootprint&&illuminated&&meetsQuality,cellId,requirements,subpoint,observedPoint,groundFootprintRadiusKm:footprint,groundSamplingDistanceM,offNadirDeg,targetDistanceKm,reason};
}
