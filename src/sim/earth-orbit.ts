import type {OrbitalState,Plan} from './types';

export const EARTH_ORBIT_VERSION='earth-ellipse-rtn-1' as const;
export const EARTH_ORBIT_MU=398600.4418;
export const EARTH_ORBIT_RADIUS_KM=6378.137;
export const EARTH_APSIS_RANGE_KM=Object.freeze([180,2000] as const);
export type EarthOrbitMode='legacy-circular'|typeof EARTH_ORBIT_VERSION;
export type EarthManeuverFrame='velocity-radial-normal-legacy'|'RTN';
/** The score formula is unchanged; dynamics identity must still distinguish RTN. */
export function earthOrbitModelVersion(plan:Plan,baseVersion:string):string {
 return plan.earthOrbit===undefined?baseVersion:`${baseVersion}+${EARTH_ORBIT_VERSION}`;
}
export class EarthOrbitError extends Error {
 readonly code:'INVALID_EARTH_ORBIT'|'UNSUPPORTED_EARTH_ORBIT'|'INVALID_EARTH_APSIS'|'REVERSED_EARTH_APSIDES'|'INVALID_EARTH_INCLINATION';
 constructor(code:EarthOrbitError['code']) {super(code);this.code=code;this.name='EarthOrbitError';}
}
export interface EarthInitialOrbit {
 mode:EarthOrbitMode;maneuverFrame:EarthManeuverFrame;
 periapsisAltitudeKm:number;apoapsisAltitudeKm:number;semiMajorAxisKm:number;
 eccentricity:number;inclinationDeg:number;periodSeconds:number;initialState:OrbitalState;
}
// The absent-mode circular arithmetic is copied unchanged from the released
// circularState function, including signed zero and multiplication order.
export function circularEarthState(altitudeKm:number,inclinationDeg:number,t:number):OrbitalState {
 const r=EARTH_ORBIT_RADIUS_KM+altitudeKm,n=Math.sqrt(EARTH_ORBIT_MU/(r*r*r)),a=n*t,i=inclinationDeg*(Math.PI/180);
 return {positionKm:[r*Math.cos(a),r*Math.sin(a)*Math.cos(i),r*Math.sin(a)*Math.sin(i)],velocityKmS:[-r*n*Math.sin(a),r*n*Math.cos(a)*Math.cos(i),r*n*Math.cos(a)*Math.sin(i)]};
}
function altitude(value:unknown):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value<EARTH_APSIS_RANGE_KM[0]||value>EARTH_APSIS_RANGE_KM[1])throw new EarthOrbitError('INVALID_EARTH_APSIS');
 return value;
}
export function initialEarthOrbit(plan:Plan):EarthInitialOrbit {
 const periapsisAltitudeKm=altitude(plan.altitudeKm),inclinationDeg=plan.inclinationDeg;
 if(!Number.isFinite(inclinationDeg)||inclinationDeg<0||inclinationDeg>180)throw new EarthOrbitError('INVALID_EARTH_INCLINATION');
 const config=plan.earthOrbit;let apoapsisAltitudeKm=periapsisAltitudeKm;
 if(config!==undefined){
  if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['version','apoapsisAltitudeKm'].includes(k)))throw new EarthOrbitError('INVALID_EARTH_ORBIT');
  if(config.version!==EARTH_ORBIT_VERSION)throw new EarthOrbitError('UNSUPPORTED_EARTH_ORBIT');
  apoapsisAltitudeKm=altitude(config.apoapsisAltitudeKm);
  if(apoapsisAltitudeKm<periapsisAltitudeKm)throw new EarthOrbitError('REVERSED_EARTH_APSIDES');
 }
 const rp=EARTH_ORBIT_RADIUS_KM+periapsisAltitudeKm,ra=EARTH_ORBIT_RADIUS_KM+apoapsisAltitudeKm,a=(rp+ra)/2,e=(ra-rp)/(ra+rp),i=inclinationDeg*Math.PI/180;
 // Start at periapsis on +X, with RAAN=argument of periapsis=true anomaly=0.
 // Inclination rotates the whole orbital plane about X; no new free epoch/RAAN.
 const speed=Math.sqrt(EARTH_ORBIT_MU*(2/rp-1/a));
 return {mode:config?EARTH_ORBIT_VERSION:'legacy-circular',maneuverFrame:config?'RTN':'velocity-radial-normal-legacy',periapsisAltitudeKm,apoapsisAltitudeKm,semiMajorAxisKm:a,eccentricity:e,inclinationDeg,periodSeconds:2*Math.PI*Math.sqrt(a*a*a/EARTH_ORBIT_MU),initialState:config?{positionKm:[rp,0,0],velocityKmS:[0,speed*Math.cos(i),speed*Math.sin(i)]}:circularEarthState(periapsisAltitudeKm,inclinationDeg,0)};
}
/** Pure edit. Crossing the other apsis is rejected, never swapped or hidden. */
export function updateEarthApsis(plan:Plan,apsis:'periapsis'|'apoapsis',altitudeKm:number):Plan {
 if(apsis!=='periapsis'&&apsis!=='apoapsis')throw new EarthOrbitError('INVALID_EARTH_APSIS');
 const previous=initialEarthOrbit(plan),next=altitude(altitudeKm);
 const candidate:Plan={...plan,altitudeKm:apsis==='periapsis'?next:previous.periapsisAltitudeKm,earthOrbit:{version:EARTH_ORBIT_VERSION,apoapsisAltitudeKm:apsis==='apoapsis'?next:previous.apoapsisAltitudeKm}};
 initialEarthOrbit(candidate);return candidate;
}
