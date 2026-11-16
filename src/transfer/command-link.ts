import {add,dot,magnitude,normalize,scale,sub} from '../sim/physics';
import type {Vec3} from '../sim/types';
import {COMMAND_NETWORK as N} from './command-network';
import {OperationsError} from './operations-codes';
import type {OperationsReasonCode} from './operations-codes';
import type {SignalBitEndpoint} from './operations-types';
import type {FullTransferSolution} from './types';
import {C_KM_S,TRANSFER_MARS_RADIUS_KM,transferGroundStationAt,transferGroundStations,transferStateAt} from './state';
import {transferEphemerides,transferPlanetState} from './ephemeris';
import {DAY_S} from './math';

const C_M_S=299792458;
export const UPLINK_PEAK_GAIN_DBI=10*Math.log10(N.receiveApertureEfficiency*(Math.PI*N.receiveDishDiameterM*N.uplinkFrequencyHz/C_M_S)**2);
export const UPLINK_HALF_POWER_DEG=N.downlinkHalfPowerAngleDeg*N.referenceDownlinkFrequencyHz/N.uplinkFrequencyHz;
const noiseFactor=10**(N.receiverNoiseFigureDb/10),feedFactor=10**(N.receiverFeedLossDb/10);
export const UPLINK_SYSTEM_TEMPERATURE_K=N.antennaNoiseTemperatureK+(feedFactor-1)*N.receiverFeedPhysicalTemperatureK+feedFactor*N.noiseFigureReferenceTemperatureK*(noiseFactor-1);
export function uplinkBudget(rangeKm:number,offAxisDeg=0,clearFraction=1,fixedEirpDbW?:number){
 if(!Number.isFinite(rangeKm)||rangeKm<=0||!Number.isFinite(offAxisDeg)||offAxisDeg<0||!Number.isFinite(clearFraction)||clearFraction<0||clearFraction>1)throw new OperationsError('INVALID_INPUT','Invalid link geometry.');
 const fsplDb=20*Math.log10(4*Math.PI*rangeKm*1000*N.uplinkFrequencyHz/C_M_S),requestedEirp=N.targetReceiverPowerDbm-30+fsplDb+N.propagationAndPolarizationLossDb+N.receiverFeedLossDb-UPLINK_PEAK_GAIN_DBI;
 const eirpDbW=fixedEirpDbW??Math.max(N.minimumGroundEirpDbW,Math.min(N.maximumGroundEirpDbW,requestedEirp));if(!Number.isFinite(eirpDbW)||eirpDbW<N.minimumGroundEirpDbW||eirpDbW>N.maximumGroundEirpDbW)throw new OperationsError('INVALID_INPUT','Invalid fixed EIRP.');
 const pointingLossDb=Math.min(120,3*(offAxisDeg/UPLINK_HALF_POWER_DEG)**2),apertureLossDb=10*Math.log10(Math.max(1e-12,clearFraction)),antennaPowerDbW=eirpDbW+UPLINK_PEAK_GAIN_DBI-pointingLossDb+apertureLossDb-fsplDb-N.propagationAndPolarizationLossDb;
 const receiverPowerDbm=antennaPowerDbW-N.receiverFeedLossDb+30,cn0DbHz=antennaPowerDbW+N.negativeBoltzmannDb-10*Math.log10(UPLINK_SYSTEM_TEMPERATURE_K),marginDb=cn0DbHz-10*Math.log10(N.uplinkInformationRateBps)-N.requiredInformationEbNoDb;
 const tracking=receiverPowerDbm>=N.receiveTrackingMinimumDbm&&receiverPowerDbm<=N.receiveTrackingMaximumDbm,clear=clearFraction>=N.minimumClearFraction,decoded=marginDb>=N.requiredMarginDb;
 return {rangeKm,eirpDbW,fsplDb,pointingLossDb,receiverPowerDbm,cn0DbHz,marginDb,tracking,clear,decoded,valid:tracking&&clear&&decoded};
}

/** Fixed emitter, moving receiver. No clamping an out-of-flight arrival. */
export function solveMovingReceiver(emittedAtSeconds:number,emitterPositionKm:Vec3,receiverAt:(seconds:number)=>Vec3,latestArrival=Infinity):SignalBitEndpoint {
 if(!Number.isFinite(emittedAtSeconds)||emittedAtSeconds<0||!emitterPositionKm.every(Number.isFinite)||latestArrival!==Infinity&&!Number.isFinite(latestArrival))throw new OperationsError('INVALID_INPUT');if(latestArrival<emittedAtSeconds)throw new OperationsError('OUTSIDE_MISSION');
 let arrival=emittedAtSeconds+magnitude(sub(receiverAt(emittedAtSeconds),emitterPositionKm))/C_KM_S;
 const boundedEstimate=(estimate:number)=>{if(estimate<=latestArrival)return estimate;const boundaryResidual=latestArrival-emittedAtSeconds-magnitude(sub(receiverAt(latestArrival),emitterPositionKm))/C_KM_S;if(boundaryResidual<0)throw new OperationsError('OUTSIDE_MISSION');return latestArrival;};
 // Bounding an iteration is not clamping the physical answer. A receiver moving
 // toward us may have an initial D/c estimate outside a valid final-time bound.
 for(let i=0;i<N.lightTimeIterations;i++){arrival=boundedEstimate(arrival);const receiver=receiverAt(arrival);arrival=boundedEstimate(emittedAtSeconds+magnitude(sub(receiver,emitterPositionKm))/C_KM_S);const point=receiverAt(arrival),residual=Math.abs(arrival-emittedAtSeconds-magnitude(sub(point,emitterPositionKm))/C_KM_S);if(residual<=N.lightTimeResidualSeconds)return {emittedAtSeconds,arrivesAtSeconds:arrival,emitterPositionKm:[...emitterPositionKm],receiverPositionKm:[...point]};}
 throw new OperationsError('LIGHT_TIME_FAILED');
}
export function solveRetardedEmission(arrivesAtSeconds:number,receiverPositionKm:Vec3,emitterAt:(seconds:number)=>Vec3,earliestEmission=0):SignalBitEndpoint {
 if(!Number.isFinite(arrivesAtSeconds)||arrivesAtSeconds<0||!receiverPositionKm.every(Number.isFinite)||!Number.isFinite(earliestEmission)||earliestEmission<0)throw new OperationsError('INVALID_INPUT');if(earliestEmission>arrivesAtSeconds)throw new OperationsError('OUTSIDE_MISSION');
 let emitted=arrivesAtSeconds-magnitude(sub(receiverPositionKm,emitterAt(arrivesAtSeconds)))/C_KM_S;
 const boundedEstimate=(estimate:number)=>{if(estimate>=earliestEmission)return estimate;const boundaryResidual=arrivesAtSeconds-earliestEmission-magnitude(sub(receiverPositionKm,emitterAt(earliestEmission)))/C_KM_S;if(boundaryResidual<0)throw new OperationsError('OUTSIDE_MISSION');return earliestEmission;};
 for(let i=0;i<N.lightTimeIterations;i++){emitted=boundedEstimate(emitted);const emitter=emitterAt(emitted);emitted=boundedEstimate(arrivesAtSeconds-magnitude(sub(receiverPositionKm,emitter))/C_KM_S);const point=emitterAt(emitted),residual=Math.abs(arrivesAtSeconds-emitted-magnitude(sub(receiverPositionKm,point))/C_KM_S);if(residual<=N.lightTimeResidualSeconds)return {emittedAtSeconds:emitted,arrivesAtSeconds,emitterPositionKm:[...point],receiverPositionKm:[...receiverPositionKm]};}
 throw new OperationsError('LIGHT_TIME_FAILED');
}
export const stationStateAt=(solution:FullTransferSolution,id:string,time:number)=>transferGroundStationAt(id,solution.plan.departurePeriapsisJdTdb+time/DAY_S);
function emissionInScope(solution:FullTransferSolution,time:number){if(!Number.isFinite(time)||time<0||time>solution.durationSeconds)throw new OperationsError('OUTSIDE_MISSION');}
export const commandBitAt=(solution:FullTransferSolution,stationId:string,time:number)=>{emissionInScope(solution,time);return solveMovingReceiver(time,stationStateAt(solution,stationId,time).positionKm,t=>transferStateAt(solution,t).heliocentricPositionKm,solution.durationSeconds);};
export const ackBitAt=(solution:FullTransferSolution,stationId:string,time:number)=>{emissionInScope(solution,time);return solveMovingReceiver(time,transferStateAt(solution,time).heliocentricPositionKm,t=>stationStateAt(solution,stationId,t).positionKm,solution.durationSeconds);};

const planetBounds:Partial<Record<'earth'|'mars',Readonly<{speedKmS:number;accelerationKmS2:number}>>>={};
/** Exact-polynomial bounds for the bundled cubic Hermite interpolation, inflated
 * for floating-point cancellation. Velocity is quadratic; acceleration linear. */
export function planetInterpolationBounds(planet:'earth'|'mars'){if(planetBounds[planet])return planetBounds[planet]!;const rows=transferEphemerides()[planet].states;let speed=0,acceleration=0;
 for(let i=0;i<rows.length-1;i++){const p=rows[i],q=rows[i+1],dt=(q[0]-p[0])*DAY_S,vmax:Vec3=[0,0,0],a0:Vec3=[0,0,0],a1:Vec3=[0,0,0];for(let k=0;k<3;k++){const A=(6*p[k+1]+3*dt*p[k+4]-6*q[k+1]+3*dt*q[k+4])/dt,B=(-6*p[k+1]-4*dt*p[k+4]+6*q[k+1]-2*dt*q[k+4])/dt,C=p[k+4],stationary=A?-B/(2*A):-1;vmax[k]=Math.max(Math.abs(C),Math.abs(A+B+C),stationary>0&&stationary<1?Math.abs(A*stationary*stationary+B*stationary+C):0);a0[k]=B/dt;a1[k]=(2*A+B)/dt;}speed=Math.max(speed,magnitude(vmax));acceleration=Math.max(acceleration,magnitude(a0),magnitude(a1));}
 const bounds=Object.freeze({speedKmS:speed+.00001,accelerationKmS2:acceleration+.00000001});planetBounds[planet]=bounds;return bounds;}
export const marsInterpolationBounds=()=>planetInterpolationBounds('mars');
/** Photon segment against moving Mars, not Mars at TX epoch. A verified bound
 * on d²(|photon−Mars|²)/dt² establishes convexity before the golden bracket is
 * used; an uncertifiable path is invalid rather than assuming unimodality. */
export function movingMarsClearance(solution:FullTransferSolution,bit:SignalBitEndpoint){
 const duration=bit.arrivesAtSeconds-bit.emittedAtSeconds;if(duration<=0)return {clearanceKm:0,uncertaintyKm:Number.MAX_VALUE,certified:false};
 const bounds=marsInterpolationBounds(),photonSpeed=magnitude(sub(bit.receiverPositionKm,bit.emitterPositionKm))/duration,middleMars=transferPlanetState('mars',solution.plan.departurePeriapsisJdTdb+(bit.emittedAtSeconds+duration/2)/DAY_S).positionKm,distanceBound=Math.max(magnitude(sub(bit.emitterPositionKm,middleMars)),magnitude(sub(bit.receiverPositionKm,middleMars)))+bounds.speedKmS*duration/2;
 if(photonSpeed<=bounds.speedKmS||(photonSpeed-bounds.speedKmS)**2<=distanceBound*bounds.accelerationKmS2)return {clearanceKm:0,uncertaintyKm:Number.MAX_VALUE,certified:false};
 const separation=(t:number)=>{const fraction=(t-bit.emittedAtSeconds)/duration,photon=add(bit.emitterPositionKm,scale(sub(bit.receiverPositionKm,bit.emitterPositionKm),fraction)),mars=transferPlanetState('mars',solution.plan.departurePeriapsisJdTdb+t/DAY_S).positionKm;return magnitude(sub(photon,mars));};
 let lo=bit.emittedAtSeconds,hi=bit.arrivesAtSeconds;const ratio=(Math.sqrt(5)-1)/2;let x1=hi-ratio*(hi-lo),x2=lo+ratio*(hi-lo),f1=separation(x1),f2=separation(x2);
 for(let i=0;i<48;i++){if(f1<f2){hi=x2;x2=x1;f2=f1;x1=hi-ratio*(hi-lo);f1=separation(x1);}else{lo=x1;x1=x2;f1=f2;x2=lo+ratio*(hi-lo);f2=separation(x2);}}
 const uncertaintyKm=(hi-lo)*(photonSpeed+bounds.speedKmS),minimum=Math.min(f1,f2,separation(bit.emittedAtSeconds),separation(bit.arrivesAtSeconds));return {clearanceKm:minimum-TRANSFER_MARS_RADIUS_KM,uncertaintyKm,certified:true};
}
function fixedSphereClearance(a:Vec3,b:Vec3,radius:number){const ab=sub(b,a),n=dot(ab,ab),f=n?Math.max(0,Math.min(1,-dot(a,ab)/n)):0;return magnitude(add(a,scale(ab,f)))-radius;}
export function signalGeometry(solution:FullTransferSolution,stationId:string,bit:SignalBitEndpoint,direction:'uplink'|'ack'){
 const station=stationStateAt(solution,stationId,direction==='uplink'?bit.emittedAtSeconds:bit.arrivesAtSeconds),remote=direction==='uplink'?bit.receiverPositionKm:bit.emitterPositionKm,ray=normalize(sub(remote,station.positionKm)),elevationDeg=Math.asin(Math.max(-1,Math.min(1,dot(station.normal,ray))))*180/Math.PI,solarSeparationDeg=Math.acos(Math.max(-1,Math.min(1,dot(ray,scale(normalize(station.positionKm),-1)))))*180/Math.PI;
 const sunClearanceKm=fixedSphereClearance(bit.emitterPositionKm,bit.receiverPositionKm,695700),mars=movingMarsClearance(solution,bit),valid=elevationDeg>=N.minimumElevationDeg&&solarSeparationDeg>=N.solarExclusionDeg&&sunClearanceKm>0&&mars.clearanceKm>mars.uncertaintyKm;
 const reasonCode:OperationsReasonCode|null=elevationDeg<N.minimumElevationDeg?'TX_NO_STATION':solarSeparationDeg<N.solarExclusionDeg?'SOLAR_EXCLUSION':sunClearanceKm<=0||mars.clearanceKm<=mars.uncertaintyKm?'UPLINK_OCCULTED':null;
 return {valid,reasonCode,elevationDeg,solarSeparationDeg,sunClearanceKm,marsClearanceKm:mars.clearanceKm,marsUncertaintyKm:mars.uncertaintyKm,rangeKm:magnitude(sub(bit.receiverPositionKm,bit.emitterPositionKm))};
}
export function selectGroundEmission(solution:FullTransferSolution,time:number){
 let failure:OperationsReasonCode='TX_NO_STATION';const options=[];
 for(const station of transferGroundStations()){try{const bit=commandBitAt(solution,station.id,time),geometry=signalGeometry(solution,station.id,bit,'uplink');if(!geometry.valid)continue;const budget=uplinkBudget(geometry.rangeKm);if(!budget.valid){failure=budget.tracking?'UPLINK_MARGIN':'RX_LEVEL_OUTSIDE_MODEL';continue;}options.push({stationId:station.id,bit,geometry,budget});}catch(error){if(error instanceof OperationsError)failure=error.code;else throw error;}}
 options.sort((a,b)=>b.geometry.elevationDeg-a.geometry.elevationDeg||a.stationId.localeCompare(b.stationId));return {selection:options[0]??null,reasonCode:options.length?null:failure};
}
