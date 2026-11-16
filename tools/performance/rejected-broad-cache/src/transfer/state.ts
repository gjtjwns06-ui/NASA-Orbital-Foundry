import {add,dot,magnitude,normalize,propagateKepler,scale,sub} from '../sim/physics';
import type {Vec3} from '../sim/types';
import {DAY_S,hyperbolicLocalStateAt,SUN_MU_KM3_S2} from './math';
import {transferPlanetState} from './ephemeris';
import {freezeTransferInput,isTransferInputFrozen} from './immutable';
import type {FullTransferSolution,TransferEnvironment,TransferPhase,TransferStateVector} from './types';
export const TRANSFER_EARTH_MU=398600.435507,TRANSFER_MARS_MU=42828.375214,TRANSFER_EARTH_RADIUS_KM=6378.137,TRANSFER_MARS_RADIUS_KM=3389.5,AU_KM=149597870.7,C_KM_S=299792.458;
export function transferStateAt(solution:FullTransferSolution,elapsedSeconds:number):TransferStateVector {
 if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||elapsedSeconds>solution.durationSeconds+1e-6)throw new Error('전이 임무의 유효한 경과 시간이 필요합니다.');
 const elapsed=Math.min(elapsedSeconds,solution.durationSeconds),jdTdb=solution.plan.departurePeriapsisJdTdb+elapsed/DAY_S,earth=transferPlanetState('earth',jdTdb),mars=transferPlanetState('mars',jdTdb),t=solution.trajectory;
 const phase:TransferPhase=elapsed<solution.earthExitSeconds?'earth-escape':elapsed<solution.marsEntrySeconds?'solar-coast':'mars-flyby';
 const local=phase==='earth-escape'?hyperbolicLocalStateAt(t.earthLocalPeriapsis,TRANSFER_EARTH_MU,elapsed):phase==='solar-coast'?propagateKepler({positionKm:t.coastInitialPositionKm,velocityKmS:t.coast.departureVelocityKmS},elapsed-solution.earthExitSeconds,SUN_MU_KM3_S2):hyperbolicLocalStateAt(t.marsLocal.periapsis,TRANSFER_MARS_MU,elapsed-solution.periapsisSeconds);
 const center=phase==='earth-escape'?earth:phase==='mars-flyby'?mars:{positionKm:[0,0,0] as Vec3,velocityKmS:[0,0,0] as Vec3},radius=phase==='earth-escape'?TRANSFER_EARTH_RADIUS_KM:phase==='mars-flyby'?TRANSFER_MARS_RADIUS_KM:695700;
 return {elapsedSeconds:elapsed,jdTdb,phase,frame:'ICRF',heliocentricPositionKm:add(center.positionKm,local.positionKm),heliocentricVelocityKmS:add(center.velocityKmS,local.velocityKmS),relativePositionKm:local.positionKm,relativeVelocityKmS:local.velocityKmS,centerPositionKm:center.positionKm,centerVelocityKmS:center.velocityKmS,centerBody:phase==='earth-escape'?'Earth':phase==='solar-coast'?'Sun':'Mars',altitudeKm:magnitude(local.positionKm)-radius,earth,mars};
}
const GROUND_STATIONS=[{id:'G1',lat:35,lon:75},{id:'G2',lat:-35,lon:-60},{id:'G3',lat:35,lon:-140},{id:'G4',lat:-25,lon:130},{id:'G5',lat:30,lon:-15}] as const;
/** Educational ground network. Approximate Earth rotation; no real DSN scheduling/UT1/EOP claim. */
function groundStationAt(station:typeof GROUND_STATIONS[number],jdTdb:number){
 const utApprox=jdTdb-69.184/DAY_S,T=(utApprox-2451545)/36525,gmst=(280.46061837+360.98564736629*(utApprox-2451545)+.000387933*T*T-T*T*T/38710000)*Math.PI/180,lat=station.lat*Math.PI/180,lon=station.lon*Math.PI/180+gmst;
 const normal:Vec3=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)],earth=transferPlanetState('earth',jdTdb);
 return {position:add(earth.positionKm,scale(normal,TRANSFER_EARTH_RADIUS_KM)),normal};
}
export function segmentOcculted(a:Vec3,b:Vec3,center:Vec3,radius:number):boolean {const ab=sub(b,a),den=dot(ab,ab);if(den<=0)return false;const t=dot(sub(center,a),ab)/den;if(t<=0||t>=1)return false;return magnitude(sub(add(a,scale(ab,t)),center))<radius;}
function environmentFromState(state:TransferStateVector,includeGroundNetwork:boolean):TransferEnvironment {
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
/** Public samples retain independent mutable output, including nested vectors. */
export function transferEnvironmentAt(solution:FullTransferSolution,elapsedSeconds:number,includeGroundNetwork=true):TransferEnvironment {
 return environmentFromState(transferStateAt(solution,elapsedSeconds),includeGroundNetwork);
}

type TimeKey=number|'negative-zero';
type EnvironmentContext={states:Map<TimeKey,TransferStateVector>;withoutNetwork:Map<TimeKey,TransferEnvironment>;withNetwork:Map<TimeKey,TransferEnvironment>};
const environmentContexts=new WeakMap<FullTransferSolution,EnvironmentContext>();
const CACHE_CAPACITY=32;
function touch<T>(map:Map<TimeKey,T>,key:TimeKey):T|undefined {const found=map.get(key);if(found!==undefined){map.delete(key);map.set(key,found);}return found;}
function insert<T>(map:Map<TimeKey,T>,key:TimeKey,value:T):T {map.set(key,value);if(map.size>CACHE_CAPACITY)map.delete(map.keys().next().value!);return value;}
/** Integration/audit helper returning SHARED DEEPLY FROZEN samples. This exported
 * helper is read-only; existing public environment/telemetry APIs return isolated
 * values. Full/centre-only environments remain distinct. Misses use exactly the
 * original arithmetic, without time bins or changed propagation steps. */
export function transferRuntimeEnvironmentAt(solution:FullTransferSolution,elapsedSeconds:number,includeGroundNetwork=true):TransferEnvironment {
 // Only runtime-owned recursively frozen solutions qualify. Mutable planner
 // solutions use the uncached public path; never freeze the caller's draft.
 if(!isTransferInputFrozen(solution))return transferEnvironmentAt(solution,elapsedSeconds,includeGroundNetwork);
 if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0||elapsedSeconds>solution.durationSeconds+1e-6)throw new Error('전이 임무의 유효한 경과 시간이 필요합니다.');
 const elapsed=Math.min(elapsedSeconds,solution.durationSeconds),key:TimeKey=Object.is(elapsed,-0)?'negative-zero':elapsed;
 let context=environmentContexts.get(solution);if(!context){context={states:new Map(),withoutNetwork:new Map(),withNetwork:new Map()};environmentContexts.set(solution,context);}
 const environments=includeGroundNetwork?context.withNetwork:context.withoutNetwork,cached=touch(environments,key);if(cached)return cached;
 const state=touch(context.states,key)??insert(context.states,key,freezeTransferInput(transferStateAt(solution,elapsed)));
 return insert(environments,key,freezeTransferInput(environmentFromState(state,includeGroundNetwork)));
}
/** Prototype audit hook: counts only, never references to private cache values. */
export function transferEnvironmentCacheSize(solution:FullTransferSolution){const c=environmentContexts.get(solution);return c?{states:c.states.size,withoutNetwork:c.withoutNetwork.size,withNetwork:c.withNetwork.size}:{states:0,withoutNetwork:0,withNetwork:0};}
export function transferTrajectory(solution:FullTransferSolution,phase:TransferPhase,count=160):TransferStateVector[]{
 const start=phase==='earth-escape'?0:phase==='solar-coast'?solution.earthExitSeconds:solution.marsEntrySeconds,end=phase==='earth-escape'?solution.earthExitSeconds:phase==='solar-coast'?solution.marsEntrySeconds:solution.durationSeconds,n=Math.max(2,Math.min(2000,Math.floor(count)));
 return Array.from({length:n},(_,i)=>{const state=transferStateAt(solution,start+(end-start)*i/(n-1)),center=phase==='earth-escape'?state.earth:phase==='mars-flyby'?state.mars:{positionKm:[0,0,0] as Vec3,velocityKmS:[0,0,0] as Vec3},relativePositionKm=sub(state.heliocentricPositionKm,center.positionKm),relativeVelocityKmS=sub(state.heliocentricVelocityKmS,center.velocityKmS),centerBody=phase==='earth-escape'?'Earth':phase==='mars-flyby'?'Mars':'Sun';return {...state,phase,centerBody,centerPositionKm:center.positionKm,centerVelocityKmS:center.velocityKmS,relativePositionKm,relativeVelocityKmS,altitudeKm:magnitude(relativePositionKm)-(centerBody==='Earth'?TRANSFER_EARTH_RADIUS_KM:centerBody==='Mars'?TRANSFER_MARS_RADIUS_KM:695700)};});
}
