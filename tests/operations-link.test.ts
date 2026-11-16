import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {canonicalOperationsJson,operationsSha256,utf8Length} from '../src/transfer/operations-codec';
import {COMMAND_NETWORK,COMMAND_NETWORK_HASH} from '../src/transfer/command-network';
import {UPLINK_PEAK_GAIN_DBI,UPLINK_SYSTEM_TEMPERATURE_K,UPLINK_HALF_POWER_DEG,uplinkBudget,solveMovingReceiver,solveRetardedEmission,movingMarsClearance,marsInterpolationBounds,commandBitAt,ackBitAt} from '../src/transfer/command-link';
import {createTransferPlan,solveTransferPlan} from '../src/transfer/planning';
import {transferPlanetState} from '../src/transfer/ephemeris';
import {DAY_S} from '../src/transfer/math';
import {magnitude,sub} from '../src/sim/physics';
import type {Vec3} from '../src/sim/types';
import {transferGroundStationAt} from '../src/transfer/state';

describe('runtime3 independent codec and command-link oracles',()=>{
 it('pins actual station coordinates, sphere radius and released approximate rotation in the network hash',()=>{const g=COMMAND_NETWORK.groundGeometry,r=g.rotation;expect(g.stations).toEqual([{id:'G1',lat:35,lon:75},{id:'G2',lat:-35,lon:-60},{id:'G3',lat:35,lon:-140},{id:'G4',lat:-25,lon:130},{id:'G5',lat:30,lon:-15}]);expect(g.altitudeKm).toBe(0);for(const jd of [2461359.5,2461559.5]){const ut=jd-r.tdbToApproxUtOffsetSeconds/86400,T=(ut-r.referenceJd)/r.centuryDays,gmst=(r.referenceGmstDegrees+r.degreesPerDay*(ut-r.referenceJd)+r.squareTermDegrees*T*T-T*T*T/r.cubicTermDivisor)*Math.PI/180,earth=transferPlanetState('earth',jd);for(const station of g.stations){const lat=station.lat*Math.PI/180,lon=station.lon*Math.PI/180+gmst,normal=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)],actual=transferGroundStationAt(station.id,jd);expect(actual.normal).toEqual(normal);expect(magnitude(sub(actual.positionKm,earth.positionKm))).toBeCloseTo(g.sphericalEarthRadiusKm,5);}}});
 it('uses SHA-256/UTF-8/canonical byte identities without vendor protocol claims',()=>{
  for(const text of ['', 'abc','관측','a'.repeat(10000)])expect(operationsSha256(text)).toBe(createHash('sha256').update(text,'utf8').digest('hex'));
  expect(utf8Length('관측')).toBe(6);expect(canonicalOperationsJson({b:-0,a:[2,1]})).toBe('{"a":[2,1],"b":0}');expect(()=>canonicalOperationsJson({x:Infinity})).toThrow();
  expect(COMMAND_NETWORK_HASH).toBe(createHash('sha256').update(canonicalOperationsJson(COMMAND_NETWORK)).digest('hex'));expect(Object.isFrozen(COMMAND_NETWORK.sources)).toBe(true);
  expect(8*(1024+COMMAND_NETWORK.commandFramingBytes)/COMMAND_NETWORK.uplinkInformationRateBps).toBe(34);expect(8*(8192+64)/256).toBe(258);
 });
 it('matches the independently documented gain/noise/link table and bounded power',()=>{
  expect(Math.abs(UPLINK_PEAK_GAIN_DBI-34.917564322637)).toBeLessThan(1e-9);expect(Math.abs(UPLINK_SYSTEM_TEMPERATURE_K-459.229130184819)).toBeLessThan(1e-9);expect(Math.abs(UPLINK_HALF_POWER_DEG-1.464945936519)).toBeLessThan(1e-9);
  for(const [range,eirp,power,cn0,margin,valid] of [[300000,89.4,-68.7799980260,104.1997076862,74.1173080331,0],[1000000,89.4,-79.2375729316,93.7421327806,63.6597331275,1],[55000000,103.4448267215,-100,72.9797057123,42.8973060591,1],[150000000,109.4,-102.7593981127,70.2203075995,40.1379079464,1],[300000000,109.4,-108.7799980260,64.1997076862,34.1173080331,1],[400000000,109.4,-111.2787727582,61.7009329541,31.6185333010,1]]){
   const r=uplinkBudget(range);for(const [actual,expected] of [[r.eirpDbW,eirp],[r.receiverPowerDbm,power],[r.cn0DbHz,cn0],[r.marginDb,margin]])expect(Math.abs(actual-expected)).toBeLessThan(1e-9);expect(r.valid).toBe(!!valid);
  }
  const centered=uplinkBudget(300000000),half=uplinkBudget(300000000,UPLINK_HALF_POWER_DEG,1,centered.eirpDbW);expect(centered.marginDb-half.marginDb).toBeCloseTo(3,12);expect(uplinkBudget(300000000,0,.4).valid).toBe(false);
 });
 it('solves closed-form stationary/approaching/receding receivers and finite first/last bits',()=>{
  const D=300000000,c=299792.458;
  for(const velocity of [-30,0,30]){const bit=solveMovingReceiver(0,[0,0,0],t=>[D+velocity*t,0,0]);expect(Math.abs(bit.arrivesAtSeconds-D/(c-velocity))).toBeLessThan(1e-6);expect(Math.abs(bit.arrivesAtSeconds-magnitude(bit.receiverPositionKm)/c)).toBeLessThanOrEqual(1e-6);}
  const first=solveMovingReceiver(0,[0,0,0],t=>[D+30*t,0,0]),last=solveMovingReceiver(34,[0,0,0],t=>[D+30*t,0,0]);expect(Math.abs(last.arrivesAtSeconds-first.arrivesAtSeconds-34.003402694276)).toBeLessThan(1e-6);
 });
 it('does not reject a valid physical root because its initial estimate crosses the model boundary',()=>{
  const limit=1000.65,forward=solveMovingReceiver(0,[0,0,0],t=>{if(t>limit)throw new Error('outside callback range');return [300000000-30*t,0,0];},limit);expect(Math.abs(forward.arrivesAtSeconds-1000.592157109192)).toBeLessThan(1e-6);
  const arrival=1000.7,reverse=solveRetardedEmission(arrival,[300000000,0,0],t=>{if(t<0)throw new Error('outside callback range');return [-30*t,0,0];},0),expected=(arrival-300000000/299792.458)/(1+30/299792.458);expect(reverse.emittedAtSeconds).toBeGreaterThan(0);expect(Math.abs(reverse.emittedAtSeconds-expected)).toBeLessThan(1e-6);
  expect(()=>solveMovingReceiver(0,[0,0,0],()=>[300000000,0,0],999)).toThrow();expect(()=>solveRetardedEmission(999,[300000000,0,0],()=>[0,0,0],0)).toThrow();
  const solution=solveTransferPlan(createTransferPlan());for(const solve of [commandBitAt,ackBitAt]){try{solve(solution,'G1',solution.durationSeconds+1);throw new Error('unexpected success');}catch(error){expect(error).toHaveProperty('code','OUTSIDE_MISSION');}}expect(()=>solveRetardedEmission(NaN,[0,0,0],()=>[0,0,0])).toThrow();
 });
 it('bounds actual Hermite velocities/accelerations and checks moving-body closest approach',()=>{
  const solution=solveTransferPlan(createTransferPlan()),mid=solution.periapsisSeconds,bounds=marsInterpolationBounds();
  for(const offset of [-86400,-1000,0,1000,86400]){const jd=solution.plan.departurePeriapsisJdTdb+(mid+offset)/DAY_S,s=transferPlanetState('mars',jd),before=transferPlanetState('mars',jd-1/DAY_S),after=transferPlanetState('mars',jd+1/DAY_S);expect(magnitude(s.velocityKmS)).toBeLessThan(bounds.speedKmS);expect(magnitude(sub(after.velocityKmS,before.velocityKmS))/2).toBeLessThan(bounds.accelerationKmS2);}
  const center=transferPlanetState('mars',solution.plan.departurePeriapsisJdTdb+mid/DAY_S).positionKm,d=500000,half=d/299792.458;
  for(const offset of [-500,500]){const bit={emittedAtSeconds:mid-half,arrivesAtSeconds:mid+half,emitterPositionKm:[center[0]-d,center[1]+3389.5+offset,center[2]] as Vec3,receiverPositionKm:[center[0]+d,center[1]+3389.5+offset,center[2]] as Vec3},clearance=movingMarsClearance(solution,bit);expect(clearance.certified).toBe(true);expect(Math.abs(clearance.clearanceKm-offset)).toBeLessThan(1);expect(clearance.uncertaintyKm).toBeLessThan(.1);expect(clearance.clearanceKm>clearance.uncertaintyKm).toBe(offset>0);}
  const slow=movingMarsClearance(solution,{emittedAtSeconds:mid-500,arrivesAtSeconds:mid+500,emitterPositionKm:center,receiverPositionKm:[center[0]+10,center[1],center[2]]});expect(slow.certified).toBe(false);expect(slow.clearanceKm>slow.uncertaintyKm).toBe(false);
 });
});
