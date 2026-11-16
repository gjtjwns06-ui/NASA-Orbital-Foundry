import type { Maneuver, OrbitalState, Plan, Vec3, FlybyMetrics } from './types';
import {circularEarthState,initialEarthOrbit,EARTH_ORBIT_MU,EARTH_ORBIT_RADIUS_KM,type EarthManeuverFrame} from './earth-orbit.ts';
export const EARTH_MU=EARTH_ORBIT_MU;
export const EARTH_RADIUS_KM=EARTH_ORBIT_RADIUS_KM;
export const MARS_MU=42828.375214;
export const MARS_RADIUS_KM=3389.5;
export const C_KM_S=299792.458;
export const DEG=Math.PI/180;
export const MARS_CLOSEST_TIME=9000;
export const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const magnitude=(a:Vec3)=>Math.hypot(...a);
export const normalize=(a:Vec3):Vec3=>scale(a,1/(magnitude(a)||1));
export const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));

// Standard right-handed inertial axes: X/Y equatorial plane, Z north. Renderer must transform only display data.
export function circularState(altitudeKm:number,inclinationDeg:number,t:number):OrbitalState {
  return circularEarthState(altitudeKm,inclinationDeg,t);
}
export function rk4Step(s:OrbitalState,dt:number,mu:number):OrbitalState {
  const acc=(r:Vec3)=>scale(r,-mu/Math.pow(magnitude(r),3));
  const k1r=s.velocityKmS,k1v=acc(s.positionKm);
  const k2r=add(s.velocityKmS,scale(k1v,dt/2)), k2v=acc(add(s.positionKm,scale(k1r,dt/2)));
  const k3r=add(s.velocityKmS,scale(k2v,dt/2)), k3v=acc(add(s.positionKm,scale(k2r,dt/2)));
  const k4r=add(s.velocityKmS,scale(k3v,dt)), k4v=acc(add(s.positionKm,scale(k3r,dt)));
  const sum=(a:Vec3,b:Vec3,c:Vec3,d:Vec3)=>scale(add(add(a,scale(b,2)),add(scale(c,2),d)),dt/6);
  return {positionKm:add(s.positionKm,sum(k1r,k2r,k3r,k4r)),velocityKmS:add(s.velocityKmS,sum(k1v,k2v,k3v,k4v))};
}
// Universal-variable Kepler propagation is exact to iteration tolerance for any conic (no perturbations).
export function propagateKepler(initial:OrbitalState,dt:number,mu:number):OrbitalState {
  if(Math.abs(dt)<1e-12) return {positionKm:[...initial.positionKm],velocityKmS:[...initial.velocityKmS]};
  const r0=magnitude(initial.positionKm),v2=dot(initial.velocityKmS,initial.velocityKmS),rv=dot(initial.positionKm,initial.velocityKmS);
  const alpha=2/r0-v2/mu,sqrtMu=Math.sqrt(mu);
  const stump=(z:number):[number,number]=>Math.abs(z)<1e-7?[.5-z/24+z*z/720,1/6-z/120+z*z/5040]:z>0?[(1-Math.cos(Math.sqrt(z)))/z,(Math.sqrt(z)-Math.sin(Math.sqrt(z)))/Math.pow(z,1.5)]:[(Math.cosh(Math.sqrt(-z))-1)/(-z),(Math.sinh(Math.sqrt(-z))-Math.sqrt(-z))/Math.pow(-z,1.5)];
  let chi=sqrtMu*Math.abs(alpha)*dt;
  if(Math.abs(alpha)<1e-8)chi=sqrtMu*dt/r0;
  for(let k=0;k<80;k++){
    const z=alpha*chi*chi,[C,S]=stump(z);
    const f=rv/sqrtMu*chi*chi*C+(1-alpha*r0)*chi*chi*chi*S+r0*chi-sqrtMu*dt;
    const df=rv/sqrtMu*chi*(1-z*S)+(1-alpha*r0)*chi*chi*C+r0;
    const d=f/df;chi-=d;if(Math.abs(d)<1e-10)break;
  }
  const [C,S]=stump(alpha*chi*chi),f=1-chi*chi/r0*C,g=dt-chi*chi*chi/sqrtMu*S;
  const r=add(scale(initial.positionKm,f),scale(initial.velocityKmS,g)),rn=magnitude(r);
  const fd=sqrtMu/(rn*r0)*(alpha*chi*chi*chi*S-chi),gd=1-chi*chi/rn*C;
  return {positionKm:r,velocityKmS:add(scale(initial.positionKm,fd),scale(initial.velocityKmS,gd))};
}
export function getManeuvers(plan:Plan):Maneuver[]{return (plan.maneuvers??[{id:'legacy',time:plan.burnTime,progradeMps:plan.progradeMps,radialMps:plan.radialMps,normalMps:plan.normalMps}]).map(n=>({...n})).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));}
export function maneuverMagnitude(node:Maneuver):number{return Math.hypot(node.progradeMps,node.radialMps,node.normalMps);}
export interface EarthManeuverBasis {radial:Vec3;prograde:Vec3;normal:Vec3;frame:EarthManeuverFrame}
function impulseBasis(s:OrbitalState,versioned:boolean):EarthManeuverBasis {
 const radial=normalize(s.positionKm),velocity=normalize(s.velocityKmS),normal=normalize(cross(radial,velocity));
 return {radial,prograde:versioned?normalize(cross(normal,radial)):velocity,normal,frame:versioned?'RTN':'velocity-radial-normal-legacy'};
}
export function earthManeuverBasisAt(plan:Plan,t:number,maneuverId?:string):EarthManeuverBasis {
 const selected=maneuverId===undefined?undefined:earthSegments(plan).find(segment=>segment.id===maneuverId&&segment.time===t);
 return impulseBasis(selected?.preState??earthStateAt(plan,t),plan.earthOrbit!==undefined);
}
function applyImpulse(s:OrbitalState,node:Maneuver,versioned=false):OrbitalState {
 const {radial,prograde,normal}=impulseBasis(s,versioned);
 const delta=scale(add(add(scale(prograde,node.progradeMps),scale(radial,node.radialMps)),scale(normal,node.normalMps)),.001);
 return {positionKm:[...s.positionKm],velocityKmS:add(s.velocityKmS,delta)};
}
interface EarthSegment {id:string;time:number;state:OrbitalState;preState:OrbitalState}
const earthSegmentCache=new WeakMap<Plan,{key:string;segments:EarthSegment[]}>();
function earthSegments(plan:Plan){
 const nodes=getManeuvers(plan),versioned=plan.earthOrbit!==undefined,key=JSON.stringify(versioned?[plan.altitudeKm,plan.inclinationDeg,nodes,plan.earthOrbit]:[plan.altitudeKm,plan.inclinationDeg,nodes]),cached=earthSegmentCache.get(plan);if(cached?.key===key)return cached.segments;
 let s=versioned?initialEarthOrbit(plan).initialState:circularState(plan.altitudeKm,plan.inclinationDeg,0),time=0;const segments:EarthSegment[]=[];
 for(const node of nodes){s=propagateKepler(s,node.time-time,EARTH_MU);const preState=s;s=applyImpulse(s,node,versioned);time=node.time;segments.push({id:node.id,time,state:s,preState});}
 earthSegmentCache.set(plan,{key,segments});return segments;
}
export function earthStateAt(plan:Plan,t:number):OrbitalState {
 const segments=earthSegments(plan);let active:{time:number;state:OrbitalState}|undefined;
 // The event timestamp itself denotes the pre-burn state, matching the GMAT reference reports.
 for(const segment of segments){if(segment.time>=t)break;active=segment;}
 return active?propagateKepler(active.state,t-active.time,EARTH_MU):plan.earthOrbit!==undefined?propagateKepler(initialEarthOrbit(plan).initialState,t,EARTH_MU):circularState(plan.altitudeKm,plan.inclinationDeg,t);
}
export function minimumEarthPeriapsisKm(plan:Plan):number{
 let minimum=EARTH_RADIUS_KM+plan.altitudeKm;
 for(const {state:s}of earthSegments(plan)){const h=cross(s.positionKm,s.velocityKmS),evec=sub(scale(cross(s.velocityKmS,h),1/EARTH_MU),normalize(s.positionKm)),rp=dot(h,h)/(EARTH_MU*(1+magnitude(evec)));minimum=Math.min(minimum,rp);}
 return minimum;
}
function hyperbolicState(a:number,e:number,p:Vec3,q:Vec3,closestTime:number,t:number):OrbitalState {
  const s=Math.sqrt(e*e-1),factor=Math.sqrt(a*a*a/MARS_MU),target=(t-closestTime)/factor;
  let H=Math.asinh(target/e);
  for(let j=0;j<30;j++){const d=(e*Math.sinh(H)-H-target)/(e*Math.cosh(H)-1);H-=d;if(Math.abs(d)<1e-12)break;}
  const ch=Math.cosh(H),sh=Math.sinh(H),dtdh=factor*(e*ch-1);
  return {positionKm:add(scale(p,a*(e-ch)),scale(q,a*s*sh)),velocityKmS:scale(add(scale(p,-a*sh),scale(q,a*s*ch)),1/dtdh)};
}
function baselineMarsState():OrbitalState {
 const a=MARS_MU/16,e=1+(MARS_RADIUS_KM+1000)/a,s=Math.sqrt(e*e-1);
 return hyperbolicState(a,e,[1/e,s/e,0],[s/e,-1/e,0],MARS_CLOSEST_TIME,0);
}
const MARS_APPROACH_REFERENCE=baselineMarsState();
export function marsApproachReference():OrbitalState{return {positionKm:[...MARS_APPROACH_REFERENCE.positionKm],velocityKmS:[...MARS_APPROACH_REFERENCE.velocityKmS]};}
const marsElementCache=new WeakMap<Plan,{key:string;value:ReturnType<typeof deriveMarsOrbit>}>();
function deriveMarsOrbit(plan:Plan){
 const r=MARS_APPROACH_REFERENCE.positionKm,referenceVelocity=MARS_APPROACH_REFERENCE.velocityKmS,rmag=magnitude(r),radial=normalize(r);
 const referenceTransverse=normalize(sub(referenceVelocity,scale(radial,dot(referenceVelocity,radial)))),normal=normalize(cross(radial,referenceTransverse)),beta=plan.bPlaneAngleDeg*DEG;
 const transverse=add(scale(referenceTransverse,Math.cos(beta)),scale(normal,Math.sin(beta)));
 const rpRequested=MARS_RADIUS_KM+plan.periapsisAltitudeKm,totalSpeed=Math.sqrt(16+2*MARS_MU/rmag),tangentSpeed=rpRequested*Math.sqrt(16+2*MARS_MU/rpRequested)/rmag;
 const baseline=add(scale(radial,-Math.sqrt(Math.max(0,totalSpeed**2-tangentSpeed**2))),scale(transverse,tangentSpeed));
 const extra=scale(add(add(scale(normalize(referenceVelocity),plan.progradeMps),scale(radial,plan.radialMps)),scale(normal,plan.normalMps)),.001),velocity=add(baseline,extra);
 const h=cross(r,velocity),pVector=sub(scale(cross(velocity,h),1/MARS_MU),radial),e=magnitude(pVector),p=normalize(pVector),q=normalize(cross(normalize(h),p)),vinf2=dot(velocity,velocity)-2*MARS_MU/rmag,a=MARS_MU/vinf2;
 const H0=Math.asinh(dot(r,q)/(a*Math.sqrt(e*e-1))),closestTime=-Math.sqrt(a*a*a/MARS_MU)*(e*Math.sinh(H0)-H0);
 return {a,e,p,q,closestTime,vinf:Math.sqrt(vinf2),rp:a*(e-1),velocity,correction:scale(sub(velocity,referenceVelocity),1000)};
}
function marsOrbit(plan:Plan){const key=[plan.periapsisAltitudeKm,plan.bPlaneAngleDeg,plan.progradeMps,plan.normalMps,plan.radialMps].join(','),cached=marsElementCache.get(plan);if(cached?.key===key)return cached.value;const value=deriveMarsOrbit(plan);marsElementCache.set(plan,{key,value});return value;}
export function flybyMetrics(plan:Plan):FlybyMetrics {
 const o=marsOrbit(plan),s=Math.sqrt(o.e*o.e-1),incoming=scale(add(scale(o.p,1/o.e),scale(o.q,s/o.e)),o.vinf),outgoing=scale(add(scale(o.p,-1/o.e),scale(o.q,s/o.e)),o.vinf);
 // Prescribed planet velocity illustrates frame changes; this is not actual planetary ephemeris.
 const planetVelocity:Vec3=[0,-24,0],hin=magnitude(add(incoming,planetVelocity)),hout=magnitude(add(outgoing,planetVelocity));
 return {periapsisKm:o.rp,altitudeKm:o.rp-MARS_RADIUS_KM,eccentricity:o.e,turnAngleDeg:2*Math.asin(1/o.e)/DEG,incomingSpeedKmS:o.vinf,outgoingSpeedKmS:magnitude(outgoing),heliocentricInKmS:hin,heliocentricOutKmS:hout,speedGainKmS:hout-hin,incomingVelocity:incoming,outgoingVelocity:outgoing,safe:o.rp>=MARS_RADIUS_KM+250,correctionDeltaVMps:magnitude(o.correction),closestTime:o.closestTime,correctionVectorMps:o.correction};
}
export function marsStateAt(plan:Plan,t:number):OrbitalState {const o=marsOrbit(plan);return hyperbolicState(o.a,o.e,o.p,o.q,o.closestTime,t);}
export const SUN_DIRECTION:Vec3=normalize([1,.3,.18]);
export function isEclipsed(r:Vec3,radiusKm:number,sun:Vec3=SUN_DIRECTION):boolean {
  return dot(r,sun)<0 && magnitude(cross(r,sun))<radiusKm;
}
export function groundPosition(latDeg:number,lonDeg:number,t:number):Vec3 {
  const lat=latDeg*DEG,lon=lonDeg*DEG+t*7.2921159e-5;
  return [EARTH_RADIUS_KM*Math.cos(lat)*Math.cos(lon),EARTH_RADIUS_KM*Math.cos(lat)*Math.sin(lon),EARTH_RADIUS_KM*Math.sin(lat)];
}
export function surfaceVisible(spacecraft:Vec3,ground:Vec3,minElevationDeg=5):boolean {
  return dot(normalize(sub(spacecraft,ground)),normalize(ground))>Math.sin(minElevationDeg*DEG);
}
export function fuelForDeltaV(wetMassKg:number,deltaVMps:number,ispS=230):number{return wetMassKg*(1-Math.exp(-Math.abs(deltaVMps)/(9.80665*ispS)));}
export function availableDeltaV(dryMassKg:number,fuelKg:number,ispS=230):number{return fuelKg>0?9.80665*ispS*Math.log((dryMassKg+fuelKg)/dryMassKg):0;}
