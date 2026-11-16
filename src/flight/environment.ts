import {add,dot,magnitude,normalize,scale,sub} from '../sim/physics';
import type {Vec3} from '../sim/types';
import {DAY_S} from '../transfer/math';
import {transferPlanetState} from '../transfer/ephemeris';
import type {TransferEnvironment,TransferStateVector} from '../transfer/types';
const TRANSFER_EARTH_RADIUS_KM=6378.137,TRANSFER_MARS_RADIUS_KM=3389.5,AU_KM=149597870.7,C_KM_S=299792.458;
const GROUND_STATIONS=[{id:'G1',lat:35,lon:75},{id:'G2',lat:-35,lon:-60},{id:'G3',lat:35,lon:-140},{id:'G4',lat:-25,lon:130},{id:'G5',lat:30,lon:-15}] as const;
/** Educational ground network. Approximate Earth rotation; no real DSN scheduling/UT1/EOP claim. */
function groundStationAt(station:typeof GROUND_STATIONS[number],jdTdb:number){
 const utApprox=jdTdb-69.184/DAY_S,T=(utApprox-2451545)/36525,gmst=(280.46061837+360.98564736629*(utApprox-2451545)+.000387933*T*T-T*T*T/38710000)*Math.PI/180,lat=station.lat*Math.PI/180,lon=station.lon*Math.PI/180+gmst;
 const normal:Vec3=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)],earth=transferPlanetState('earth',jdTdb);
 return {position:add(earth.positionKm,scale(normal,TRANSFER_EARTH_RADIUS_KM)),normal};
}
/** Fresh values only: exposing these helpers does not expose/mutate the released
 * station table or change the original environment calculation. */
export function transferGroundStations(){return GROUND_STATIONS.map(station=>({...station}));}
export function transferGroundStationAt(stationId:string,jdTdb:number){const station=GROUND_STATIONS.find(s=>s.id===stationId);if(!station||!Number.isFinite(jdTdb))throw new Error('Invalid educational station or epoch');const value=groundStationAt(station,jdTdb);return {id:station.id,positionKm:value.position,normal:value.normal};}
export function segmentOcculted(a:Vec3,b:Vec3,center:Vec3,radius:number):boolean {const ab=sub(b,a),den=dot(ab,ab);if(den<=0)return false;const t=dot(sub(center,a),ab)/den;if(t<=0||t>=1)return false;return magnitude(sub(add(a,scale(ab,t)),center))<radius;}
export function flightEnvironmentAt(state:TransferStateVector,includeGroundNetwork=true):TransferEnvironment {
 const r=state.heliocentricPositionKm,sunDirection=scale(normalize(r),-1),sunDistanceAU=magnitude(r)/AU_KM,earthDistanceKm=magnitude(sub(state.earth.positionKm,r));
 const eclipse=segmentOcculted(r,[0,0,0],state.earth.positionKm,TRANSFER_EARTH_RADIUS_KM)||segmentOcculted(r,[0,0,0],state.mars.positionKm,TRANSFER_MARS_RADIUS_KM);
 let selected:{id:string;position:Vec3;normal:Vec3;lightTime:number;visible:boolean;elevation:number}|null=includeGroundNetwork?null:{id:'earth-center-only',position:state.earth.positionKm,normal:[0,0,1],lightTime:earthDistanceKm/C_KM_S,visible:false,elevation:-1};
 if(includeGroundNetwork)for(const station of GROUND_STATIONS){let lightTime=earthDistanceKm/C_KM_S,g=groundStationAt(station,state.jdTdb);for(let i=0;i<5;i++){g=groundStationAt(station,state.jdTdb+lightTime/DAY_S);lightTime=magnitude(sub(g.position,r))/C_KM_S;}const elevation=dot(g.normal,normalize(sub(r,g.position))),visible=elevation>=Math.sin(5*Math.PI/180);if(!selected||elevation>selected.elevation)selected={id:station.id,...g,lightTime,visible,elevation};}
 const ground=selected!,contactTargetPositionKm=ground.position,earthDirection=normalize(sub(contactTargetPositionKm,r)),contactDistanceKm=magnitude(sub(contactTargetPositionKm,r));
 const solarConjunction=dot(normalize(sub(r,ground.position)),scale(normalize(ground.position),-1))>Math.cos(3*Math.PI/180);
 const earthLinkOcculted=segmentOcculted(r,ground.position,state.mars.positionKm,TRANSFER_MARS_RADIUS_KM)||segmentOcculted(r,ground.position,[0,0,0],695700);
 const marsRelative=sub(r,state.mars.positionKm),outward=normalize(marsRelative),targetPositionKm=add(state.mars.positionKm,scale(outward,TRANSFER_MARS_RADIUS_KM)),targetDirection=normalize(sub(targetPositionKm,r)),targetIlluminated=dot(outward,sunDirection)>.05;
 return {state,sunDirection,sunDistanceAU,eclipse,earthDirection,earthDistanceKm,contactDistanceKm,contactTargetPositionKm,groundStationId:ground.visible?ground.id:null,groundVisible:ground.visible,earthLinkOcculted,solarConjunction,lightTimeSeconds:ground.lightTime,targetDirection,targetPositionKm,targetIlluminated};
}
