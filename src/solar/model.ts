/**
 * Solar exploration planning model v1.
 * Planet positions: JPL's approximate Kepler elements, Table 1 (1800–2050),
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html . Earth denotes EM barycenter.
 * This is NOT a Horizons ephemeris or a GMAT-validated multi-body trajectory.
 * Coasts are genuine Sun-only, zero-revolution Lambert solutions. Planet-centre
 * endpoints are planning boundaries, not simulated surface impacts or landings.
 * Ideal 300 km parking escape/capture estimates exclude atmosphere, plane
 * matching, finite thrust, SOI transitions and a spacecraft's resource limits.
 */
import { cross, dot, magnitude, propagateKepler, scale, sub } from '../sim/physics';
import type { OrbitalState, Vec3 } from '../sim/types';
import { DAY_S, solveLambert, SUN_MU_KM3_S2 } from '../transfer/math';

export const AU_KM = 149597870.7;
export const SOLAR_EPOCH_JD = 2461359.5; // 2026-11-15 00:00 TDB calendar label.
export const SOLAR_MIN_JD = Date.UTC(1800, 0, 1) / 86400000 + 2440587.5;
export const SOLAR_MAX_JD = Date.UTC(2050, 0, 1) / 86400000 + 2440587.5;
export const SOLAR_MODEL_ID = 'jpl-approx-1800-2050-sun-lambert-v1';
export const SOLAR_MODEL_SOURCES = [
  'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
  'https://ssd.jpl.nasa.gov/planets/phys_par.html',
  'https://ssd.jpl.nasa.gov/astro_par.html',
] as const;
export type SolarBodyId = 'mercury' | 'venus' | 'earth' | 'mars' | 'aster' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
/** a(AU), e, I(deg), L(deg), longitude of perihelion(deg), node(deg). */
type Elements = readonly [number, number, number, number, number, number];
export interface SolarBody {
  id: SolarBodyId;
  nameKo: string;
  nameEn: string;
  color: string;
  aAu: number;
  radiusKm: number;
  muKm3S2: number;
  descriptionKo: string;
  fictional?: boolean;
  elements: Elements;
  rates: Elements;
}
// Radii are JPL mean radii; outer GM values represent planetary systems.
// Those GM values only support the explicitly ideal planning estimates below.
export const SOLAR_BODIES: readonly SolarBody[] = Object.freeze([
  { id: 'mercury', nameKo: '수성', nameEn: 'Mercury', color: '#c1b7a4', aAu: .38709927, radiusKm: 2439.4, muKm3S2: 22031.868551, descriptionKo: '태양 가까이 남은 오래된 흔적', elements: [.38709927,.20563593,7.00497902,252.25032350,77.45779628,48.33076593], rates: [.00000037,.00001906,-.00594749,149472.67411175,.16047689,-.12534081] },
  { id: 'venus', nameKo: '금성', nameEn: 'Venus', color: '#e6be76', aAu: .72333566, radiusKm: 6051.8, muKm3S2: 324858.592, descriptionKo: '구름 너머를 보는 새로운 관측점', elements: [.72333566,.00677672,3.39467605,181.97909950,131.60246718,76.67984255], rates: [.00000390,-.00004107,-.00078890,58517.81538729,.00268329,-.27769418] },
  { id: 'earth', nameKo: '지구', nameEn: 'Earth', color: '#6fbce5', aAu: 1.00000261, radiusKm: 6371.0084, muKm3S2: 398600.435507, descriptionKo: '모든 탐사가 시작된 곳', elements: [1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0], rates: [.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0] },
  { id: 'mars', nameKo: '화성', nameEn: 'Mars', color: '#e48b65', aAu: 1.52371034, radiusKm: 3389.5, muKm3S2: 42828.375816, descriptionKo: '붉은 세계에서 돌아올 첫 신호', elements: [1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891], rates: [.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343] },
  // Authored fictional object. Its Sun-only orbit is internally physical, but
  // there is no real discovered asteroid, impact probability or JPL solution.
  { id: 'aster', nameKo: '아스터-7', nameEn: 'ASTER-7', color: '#f8b492', aAu: 1.6, radiusKm: .45, muKm3S2: 5.095e-8, fictional: true, descriptionKo: '확인되지 않은 궤적 · 가상 이야기 천체', elements: [1.6,.38,3.5,65,74,74], rates: [0,0,0,36000/Math.pow(1.6,1.5),0,0] },
  { id: 'jupiter', nameKo: '목성', nameEn: 'Jupiter', color: '#d5b28e', aAu: 5.202887, radiusKm: 69911, muKm3S2: 126712764.1, descriptionKo: '거대한 중력이 만드는 먼 길', elements: [5.202887,.04838624,1.30439695,34.39644051,14.72847983,100.47390909], rates: [-.00011607,-.00013253,-.00183714,3034.74612775,.21252668,.20469106] },
  { id: 'saturn', nameKo: '토성', nameEn: 'Saturn', color: '#e2cc95', aAu: 9.53667594, radiusKm: 58232, muKm3S2: 37940584.8418, descriptionKo: '고리와 얼음의 기원을 찾아서', elements: [9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448], rates: [-.00125060,-.00050991,.00193609,1222.49362201,-.41897216,-.28867794] },
  { id: 'uranus', nameKo: '천왕성', nameEn: 'Uranus', color: '#8bd2d9', aAu: 19.18916464, radiusKm: 25362, muKm3S2: 5794556.4, descriptionKo: '옆으로 누운 얼음 거인의 계절', elements: [19.18916464,.04725744,.77263783,313.23810451,170.9542763,74.01692503], rates: [-.00196176,-.00004397,-.00242939,428.48202785,.40805281,.04240589] },
  { id: 'neptune', nameKo: '해왕성', nameEn: 'Neptune', color: '#688ee5', aAu: 30.06992276, radiusKm: 24622, muKm3S2: 6836527.10058, descriptionKo: '희미한 햇빛 끝에서 보내는 소식', elements: [30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574], rates: [.00026291,.00005105,.00035372,218.45945325,-.32241464,-.00508664] },
].map(body => Object.freeze({ ...body, elements: Object.freeze(body.elements), rates: Object.freeze(body.rates) })) as SolarBody[]);

export function solarBody(id: SolarBodyId): SolarBody {
  const body = SOLAR_BODIES.find(candidate => candidate.id === id);
  if (!body) throw new Error('알 수 없는 탐사 목적지입니다.');
  return body;
}
function validateEpoch(jd: number): void {
  if (!Number.isFinite(jd) || jd < SOLAR_MIN_JD || jd > SOLAR_MAX_JD) throw new Error('탐사 날짜는 1800년부터 2050년 1월 1일 사이여야 합니다.');
}
const RAD = Math.PI / 180;
const OBLIQUITY = 23.43928 * RAD;
function eclipticToIcrf(v: Vec3): Vec3 {
  return [v[0], Math.cos(OBLIQUITY)*v[1]-Math.sin(OBLIQUITY)*v[2], Math.sin(OBLIQUITY)*v[1]+Math.cos(OBLIQUITY)*v[2]];
}
/** Display ellipse at one epoch, not an extrapolated ephemeris time series. */
export function solarOrbitAu(id:SolarBodyId,jdTdb:number,samples=256):Vec3[] {
  validateEpoch(jdTdb);
  const body=solarBody(id),T=(jdTdb-2451545)/36525;
  const [a,e,inclination,,perihelion,node]=body.elements.map((value,i)=>value+body.rates[i]*T);
  const I=inclination*RAD,N=node*RAD,w=(perihelion-node)*RAD;
  return Array.from({length:samples+1},(_,i)=>{
    const E=i/samples*Math.PI*2,x=a*(Math.cos(E)-e),y=a*Math.sqrt(1-e*e)*Math.sin(E);
    return eclipticToIcrf([
      (Math.cos(w)*Math.cos(N)-Math.sin(w)*Math.sin(N)*Math.cos(I))*x+(-Math.sin(w)*Math.cos(N)-Math.cos(w)*Math.sin(N)*Math.cos(I))*y,
      (Math.cos(w)*Math.sin(N)+Math.sin(w)*Math.cos(N)*Math.cos(I))*x+(-Math.sin(w)*Math.sin(N)+Math.cos(w)*Math.cos(N)*Math.cos(I))*y,
      Math.sin(w)*Math.sin(I)*x+Math.cos(w)*Math.sin(I)*y,
    ]);
  });
}
/** JPL approximate planet position in heliocentric ICRF-oriented km. */
export function solarPosition(id: SolarBodyId, jdTdb: number): Vec3 {
  validateEpoch(jdTdb);
  const body = solarBody(id), T = (jdTdb - 2451545) / 36525;
  const [a,e,inclination,L,perihelion,node] = body.elements.map((value,i) => value + body.rates[i]*T);
  const I = inclination*RAD, N = node*RAD, w = (perihelion-node)*RAD;
  const M = ((((L-perihelion)+180)%360+360)%360-180)*RAD;
  let E = M + e*Math.sin(M);
  for(let i=0;i<30;i++) { const d = (E-e*Math.sin(E)-M)/(1-e*Math.cos(E)); E-=d; if(Math.abs(d)<1e-13)break; }
  const x = a*(Math.cos(E)-e)*AU_KM, y = a*Math.sqrt(1-e*e)*Math.sin(E)*AU_KM;
  return eclipticToIcrf([
    (Math.cos(w)*Math.cos(N)-Math.sin(w)*Math.sin(N)*Math.cos(I))*x + (-Math.sin(w)*Math.cos(N)-Math.cos(w)*Math.sin(N)*Math.cos(I))*y,
    (Math.cos(w)*Math.sin(N)+Math.sin(w)*Math.cos(N)*Math.cos(I))*x + (-Math.sin(w)*Math.sin(N)+Math.cos(w)*Math.cos(N)*Math.cos(I))*y,
    Math.sin(w)*Math.sin(I)*x + Math.cos(w)*Math.sin(I)*y,
  ]);
}
export const solarPositionAu = (id: SolarBodyId, jdTdb: number): Vec3 => scale(solarPosition(id,jdTdb),1/AU_KM);
/** Derivative of the same approximate position model, including element rates. */
export function solarState(id: SolarBodyId, jdTdb: number): OrbitalState {
  validateEpoch(jdTdb);
  const before = Math.max(SOLAR_MIN_JD,jdTdb-60/DAY_S), after = Math.min(SOLAR_MAX_JD,jdTdb+60/DAY_S);
  return { positionKm: solarPosition(id,jdTdb), velocityKmS: scale(sub(solarPosition(id,after),solarPosition(id,before)),1/((after-before)*DAY_S)) };
}
export interface SolarRouteBase {
  modelId: typeof SOLAR_MODEL_ID;
  originId: SolarBodyId;
  targetId: SolarBodyId;
  departureJdTdb: number;
  arrivalJdTdb: number;
  flightDays: number;
}
export interface SolvedSolarRoute extends SolarRouteBase {
  status: 'solved';
  pointsAu: Vec3[];
  departurePositionKm: Vec3;
  arrivalPositionKm: Vec3;
  departureVelocityKmS: Vec3;
  arrivalVelocityKmS: Vec3;
  departureVInfinityKmS: number;
  arrivalVInfinityKmS: number;
  c3Km2S2: number;
  /** Ideal impulse from a 300 km circular orbit; not a launch-site solution. */
  departureDeltaVMps: number;
  /** Ideal capture into a 300 km circular orbit; flyby requires no capture. */
  arrivalDeltaVMps: number;
  endpointErrorKm: number;
  minimumSolarDistanceAu: number;
  error?: undefined;
}
export interface InfeasibleSolarRoute extends SolarRouteBase {
  status: 'infeasible';
  pointsAu: Vec3[];
  error: string;
}
export type SolarRoute = SolvedSolarRoute | InfeasibleSolarRoute;

/** Adaptive editing range; not an engine/fuel feasibility claim. */
export function solarFlightDayBounds(origin: SolarBodyId,target: SolarBodyId,departureJdTdb=SOLAR_EPOCH_JD): {min:number;max:number;recommended:number} {
  const a=(solarBody(origin).aAu+solarBody(target).aAu)*AU_KM/2;
  const hohmann=Math.PI*Math.sqrt(a*a*a/SUN_MU_KM3_S2)/DAY_S;
  const available=Math.max(0,SOLAR_MAX_JD-departureJdTdb);
  const min=Math.min(Math.max(20,Math.floor(hohmann*.2)),Math.floor(available));
  const max=Math.min(Math.max(min+1,Math.ceil(hohmann*1.8)),Math.floor(available),7300);
  return {min,max,recommended:Math.max(min,Math.min(max,Math.round(hohmann)))};
}
const idealParkingImpulse = (body: SolarBody, vInfinity: number): number => {
  if(body.fictional) return vInfinity*1000; // negligible asteroid gravity; rendezvous speed.
  const r = body.radiusKm+300;
  return (Math.sqrt(vInfinity*vInfinity+2*body.muKm3S2/r)-Math.sqrt(body.muKm3S2/r))*1000;
};
/** Sun-only transfer, with real endpoint interception at target's ARRIVAL time. */
export function planSolarRoute(originId:SolarBodyId,targetId:SolarBodyId,departureJdTdb:number,flightDays:number):SolarRoute {
  const base:SolarRouteBase={modelId:SOLAR_MODEL_ID,originId,targetId,departureJdTdb,arrivalJdTdb:departureJdTdb+flightDays,flightDays};
  try {
    if(originId===targetId)throw new Error('다른 천체를 목적지로 골라 주세요.');
    if(!Number.isFinite(flightDays)||flightDays<1||flightDays>7300)throw new Error('비행 기간은 1일에서 20년 사이여야 합니다.');
    validateEpoch(base.departureJdTdb);validateEpoch(base.arrivalJdTdb);
    const origin=solarBody(originId), target=solarBody(targetId), from=solarState(originId,departureJdTdb), to=solarState(targetId,base.arrivalJdTdb);
    const lambert=solveLambert(from.positionKm,to.positionKm,flightDays*DAY_S);
    const initial={positionKm:from.positionKm,velocityKmS:lambert.departureVelocityKmS};
    const momentum=cross(initial.positionKm,initial.velocityKmS);
    const eccentricity=magnitude(sub(scale(cross(initial.velocityKmS,momentum),1/SUN_MU_KM3_S2),scale(initial.positionKm,1/magnitude(initial.positionKm))));
    const solarPerihelionAu=dot(momentum,momentum)/(SUN_MU_KM3_S2*(1+eccentricity))/AU_KM;
    // Conservative whole-conic clearance, including perihelion even when it is
    // outside this coast segment. Sampling alone can miss a solar collision.
    if(solarPerihelionAu<.005)throw new Error('이 궤도의 근일점이 태양 표면에 너무 가깝습니다. 도착 시점을 옮겨 주세요.');
    const pointsAu:Vec3[]=[];let minimumSolarDistanceAu=Infinity;
    for(let i=0;i<=160;i++){
      const state=propagateKepler(initial,flightDays*DAY_S*i/160,SUN_MU_KM3_S2);
      if(!state.positionKm.every(Number.isFinite)||!state.velocityKmS.every(Number.isFinite))throw new Error('이 경로는 안정적으로 계산할 수 없습니다. 도착점을 조금 옮겨 주세요.');
      const r=magnitude(state.positionKm)/AU_KM;minimumSolarDistanceAu=Math.min(minimumSolarDistanceAu,r);
      pointsAu.push(scale(state.positionKm,1/AU_KM));
    }
    // Reject routes through the Sun. A small conservative photosphere clearance
    // also keeps the sampled display from presenting a stellar collision as travel.
    if(minimumSolarDistanceAu<.005)throw new Error('이 경로는 태양 표면을 통과합니다. 도착 시점을 옮겨 주세요.');
    const departureVInfinityKmS=magnitude(sub(lambert.departureVelocityKmS,from.velocityKmS));
    const arrivalVInfinityKmS=magnitude(sub(lambert.arrivalVelocityKmS,to.velocityKmS));
    return {...base,status:'solved',pointsAu,departurePositionKm:from.positionKm,arrivalPositionKm:to.positionKm,departureVelocityKmS:lambert.departureVelocityKmS,arrivalVelocityKmS:lambert.arrivalVelocityKmS,departureVInfinityKmS,arrivalVInfinityKmS,c3Km2S2:departureVInfinityKmS**2,departureDeltaVMps:idealParkingImpulse(origin,departureVInfinityKmS),arrivalDeltaVMps:idealParkingImpulse(target,arrivalVInfinityKmS),endpointErrorKm:lambert.endpointErrorKm,minimumSolarDistanceAu};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    return {...base,status:'infeasible',pointsAu:[],error:/[가-힣]/.test(message)?message:'이 출발·도착 조합은 계산할 수 없습니다. 도착점을 옮겨 다른 경로를 만드세요.'};
  }
}
/** A small deterministic search over travel time, not an optimal-route claim. */
export function findDefaultSolarRoute(origin:SolarBodyId,target:SolarBodyId,departureJdTdb=SOLAR_EPOCH_JD):SolarRoute {
  const bounds=solarFlightDayBounds(origin,target,departureJdTdb);
  const days=Array.from(new Set([bounds.recommended,...Array.from({length:13},(_,i)=>Math.round(bounds.min+(bounds.max-bounds.min)*i/12))]));
  let best:SolvedSolarRoute|undefined,last:SolarRoute|undefined;
  for(const day of days){
    const route=planSolarRoute(origin,target,departureJdTdb,day);last=route;
    // Exploration is a flyby. Arrival capture cost is not charged silently.
    if(route.status==='solved'&&(!best||route.departureDeltaVMps<best.departureDeltaVMps))best=route;
  }
  return best??last??planSolarRoute(origin,target,departureJdTdb,bounds.recommended);
}
/** Re-evaluate the exact coast at an elapsed duration; no following a spline. */
export function solarRouteState(route:SolvedSolarRoute,elapsedDays:number):OrbitalState {
  if(!Number.isFinite(elapsedDays)||elapsedDays<0||elapsedDays>route.flightDays)throw new Error('비행 재생 시간이 경로 밖입니다.');
  return propagateKepler({positionKm:route.departurePositionKm,velocityKmS:route.departureVelocityKmS},elapsedDays*DAY_S,SUN_MU_KM3_S2);
}
export function solarRouteInvariants(route:SolvedSolarRoute,elapsedDays:number):{energyKm2S2:number;angularMomentumKm2S:Vec3} {
  const state=solarRouteState(route,elapsedDays);
  return {energyKm2S2:dot(state.velocityKmS,state.velocityKmS)/2-SUN_MU_KM3_S2/magnitude(state.positionKm),angularMomentumKm2S:cross(state.positionKm,state.velocityKmS)};
}
// Short aliases for consumers that keep the domain namespace in their import.
export const position=solarPosition;
export const planRoute=planSolarRoute;
