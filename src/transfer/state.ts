import {flightEnvironmentAt} from '../flight/environment';
export {transferGroundStations,transferGroundStationAt,segmentOcculted} from '../flight/environment';
import {add,dot,magnitude,normalize,propagateKepler,scale,sub} from '../sim/physics';
import type {Vec3} from '../sim/types';
import {DAY_S,hyperbolicLocalStateAt,SUN_MU_KM3_S2} from './math';
import {transferPlanetState} from './ephemeris';
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
export function transferEnvironmentAt(solution:FullTransferSolution,elapsedSeconds:number,includeGroundNetwork=true):TransferEnvironment {return flightEnvironmentAt(transferStateAt(solution,elapsedSeconds),includeGroundNetwork);}
export function transferTrajectory(solution:FullTransferSolution,phase:TransferPhase,count=160):TransferStateVector[]{
 const start=phase==='earth-escape'?0:phase==='solar-coast'?solution.earthExitSeconds:solution.marsEntrySeconds,end=phase==='earth-escape'?solution.earthExitSeconds:phase==='solar-coast'?solution.marsEntrySeconds:solution.durationSeconds,n=Math.max(2,Math.min(2000,Math.floor(count)));
 return Array.from({length:n},(_,i)=>{const state=transferStateAt(solution,start+(end-start)*i/(n-1)),center=phase==='earth-escape'?state.earth:phase==='mars-flyby'?state.mars:{positionKm:[0,0,0] as Vec3,velocityKmS:[0,0,0] as Vec3},relativePositionKm=sub(state.heliocentricPositionKm,center.positionKm),relativeVelocityKmS=sub(state.heliocentricVelocityKmS,center.velocityKmS),centerBody=phase==='earth-escape'?'Earth':phase==='mars-flyby'?'Mars':'Sun';return {...state,phase,centerBody,centerPositionKm:center.positionKm,centerVelocityKmS:center.velocityKmS,relativePositionKm,relativeVelocityKmS,altitudeKm:magnitude(relativePositionKm)-(centerBody==='Earth'?TRANSFER_EARTH_RADIUS_KM:centerBody==='Mars'?TRANSFER_MARS_RADIUS_KM:695700)};});
}
