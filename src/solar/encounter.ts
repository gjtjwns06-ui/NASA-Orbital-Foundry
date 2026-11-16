import {solarBody,type SolarBodyId} from './model';
import type {Vec3} from '../sim';

export interface EncounterFeature {
 id:string;labelKo:string;labelEn:string;latitudeDeg:number;longitudeDeg:number;
 radiusKm:number;positionBodyKm:Vec3;reflectance:{visible:number;nir:number};
}
export interface EncounterDefinition {
 bodyId:SolarBodyId;radiusKm:number;muKm3S2:number;periapsisKm:number;
 vInfinityKmS:number;semiMajorAbsKm:number;eccentricity:number;
 halfWindowSeconds:number;playbackDurationSeconds:number;
 sunDirectionBody:Vec3;features:EncounterFeature[];
}
export interface EncounterFrame {
 positionKm:Vec3;velocityKmS:Vec3;rangeKm:number;altitudeKm:number;
 elapsedSeconds:number;progress:number;sunDirectionBody:Vec3;
}
const RAD=Math.PI/180;
/** Authored sample regions, not identified real surface geology. Y is north,
 * longitude zero is +X and positive longitude runs toward -Z. The frozen local
 * body frame is a short encounter approximation, not a rotation ephemeris. */
export function surfacePosition(radiusKm:number,latitudeDeg:number,longitudeDeg:number):Vec3 {
 const lat=latitudeDeg*RAD,lon=longitudeDeg*RAD;
 return [radiusKm*Math.cos(lat)*Math.cos(lon),radiusKm*Math.sin(lat),-radiusKm*Math.cos(lat)*Math.sin(lon)];
}
/** An independent local hyperbola with the cruise arrival's v-infinity.
 * Its authored B-plane/orientation is not a continuous patched-conic solution.
 * Planet system GM is reused from the planning model; moons, rings, atmosphere,
 * body rotation, shape and perturbations are not propagated here. */
export function createEncounter(target:SolarBodyId,arrivalVInfinityKmS:number):EncounterDefinition {
 if(!Number.isFinite(arrivalVInfinityKmS)||arrivalVInfinityKmS<=0||arrivalVInfinityKmS>1000)throw new RangeError('Local arrival speed must be positive and at most 1,000 km/s.');
 const body=solarBody(target),vinf=arrivalVInfinityKmS;
 const rp=body.radiusKm*3,axis=body.muKm3S2/(vinf*vinf),e=1+rp/axis;
 // Window reaches six body radii. Its real duration is stretched/compressed
 // to 150 play seconds, including slow motion for a tiny fast asteroid flyby.
 const H=Math.acosh((6*body.radiusKm/axis+1)/e);
 const half=(e*Math.sinh(H)-H)/Math.sqrt(body.muKm3S2/(axis*axis*axis));
 const kinds:{ko:string;en:string;lat:number;lon:number;v:number;n:number}[]=[
  {ko:'밝은 영역',en:'Bright region',lat:13,lon:-105,v:.46,n:.43},
  {ko:'어두운 영역',en:'Dark region',lat:-11,lon:-72,v:.17,n:.26},
  {ko:'경계 지형',en:'Boundary region',lat:0,lon:-90,v:.3,n:.24},
 ];
 if(['venus','jupiter','saturn','uranus','neptune'].includes(target)){
  kinds[0].ko='밝은 구름';kinds[0].en='Bright clouds';kinds[1].ko='어두운 띠';kinds[1].en='Dark band';kinds[2].ko='구름 경계';kinds[2].en='Cloud boundary';
 }
 const norm=Math.hypot(.35,.25,1);
 return {bodyId:target,radiusKm:body.radiusKm,muKm3S2:body.muKm3S2,periapsisKm:rp,vInfinityKmS:vinf,semiMajorAbsKm:axis,eccentricity:e,halfWindowSeconds:half,playbackDurationSeconds:150,sunDirectionBody:[.35/norm,.25/norm,1/norm],features:kinds.map((k,i)=>({id:`${target}-region-${i+1}`,labelKo:k.ko,labelEn:k.en,latitudeDeg:k.lat,longitudeDeg:k.lon,radiusKm:body.radiusKm*.13,positionBodyKm:surfacePosition(body.radiusKm,k.lat,k.lon),reflectance:{visible:k.v,nir:k.n}}))};
}
/** Physical position and velocity, with zero elapsedSeconds at periapsis. */
export function localEncounterFrame(encounter:EncounterDefinition,elapsedSeconds:number):EncounterFrame {
 const {semiMajorAbsKm:a,eccentricity:e,muKm3S2:mu}=encounter;
 if(!Number.isFinite(elapsedSeconds)||Math.abs(elapsedSeconds)>1e10)throw new RangeError('Local encounter time must be finite and bounded.');
 const t=elapsedSeconds,n=Math.sqrt(mu/(a*a*a)),M=n*t;
 let H=Math.asinh(M/e);
 for(let i=0;i<25;i++){const delta=(e*Math.sinh(H)-H-M)/(e*Math.cosh(H)-1);H-=delta;if(Math.abs(delta)<1e-13)break;}
 const sh=Math.sinh(H),ch=Math.cosh(H),b=a*Math.sqrt((e-1)*(e+1)),rate=n/(e*ch-1);
 const positionKm:Vec3=[b*sh,0,a*(e-ch)],velocityKmS:Vec3=[b*ch*rate,0,-a*sh*rate],rangeKm=Math.hypot(...positionKm);
 return {positionKm,velocityKmS,rangeKm,altitudeKm:rangeKm-encounter.radiusKm,elapsedSeconds:t,progress:Math.max(0,Math.min(1,(t/encounter.halfWindowSeconds+1)/2)),sunDirectionBody:[...encounter.sunDirectionBody]};
}
