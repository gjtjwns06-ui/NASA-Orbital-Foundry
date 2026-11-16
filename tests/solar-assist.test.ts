import { beforeAll, describe, expect, it } from 'vitest';
import { add, cross, dot, magnitude, normalize, scale, sub } from '../src/sim/physics';
import { assistLocalState, assistRouteState, ASSIST_MIN_ALTITUDE_KM, ASSIST_SPEED_TOLERANCE_KM_S, evaluateAssistGeometry, recommendedAssistBodies, searchAssistRoute, searchAssistRouteSync, solveAssistRoute } from '../src/solar/assist';
import type { AssistSearchResult, SolvedAssistRoute } from '../src/solar/assist';
import { findDefaultSolarRoute, SOLAR_EPOCH_JD, SOLAR_MAX_JD, solarBody, solarPosition, solarState } from '../src/solar/model';
import { DAY_S, hyperbolicLocalStateAt } from '../src/transfer/math';

describe('single gravity assist with actual velocity matching',()=>{
  let search:AssistSearchResult,route:SolvedAssistRoute;
  beforeAll(()=>{
    search=searchAssistRouteSync({assist:'jupiter',target:'saturn',requireSavings:true});
    expect(search.status,search.error).toBe('solved');route=search.route!;
  },20000);
  it('discovers an unpowered Jupiter assist that reaches Saturn within the model and saves propulsive delta-v',()=>{
    expect(route.request.departureJdTdb).toBeGreaterThanOrEqual(SOLAR_EPOCH_JD);
    expect(route.request.arrivalJdTdb).toBeLessThanOrEqual(SOLAR_MAX_JD);
    expect(route.unpowered).toBe(true);
    expect(Math.abs(route.speedMismatchKmS)).toBeLessThan(ASSIST_SPEED_TOLERANCE_KM_S);
    expect(route.requiredPeriapsisKm).toBeGreaterThan(route.minPeriapsisKm);
    expect(route.periapsisAltitudeKm).toBeGreaterThan(ASSIST_MIN_ALTITUDE_KM.jupiter);
    expect(route.turnAngleRad).toBeLessThan(route.maxTurnAngleRad);
    expect(route.requiredPeriapsisKm).toBeLessThan(route.maxPeriapsisKm);
    expect(route.totalPropulsiveDeltaVMps).toBeCloseTo(route.departureDeltaVMps+route.correctionDeltaVMps,9);
    expect(route.directComparison.status).toBe('solved');
    expect(route.directComparison.departureJdTdb).toBe(route.request.departureJdTdb);
    expect(route.directComparison.arrivalJdTdb).toBe(route.request.arrivalJdTdb);
    expect(route.deltaVSavedMps).toBeGreaterThan(0);
    expect(search.evaluations).toBeLessThan(12000);expect(search.feasibleCandidates).toBeGreaterThan(0);
    console.log('Solar assist proof',JSON.stringify({request:route.request,flightDays:route.flightDays,departureMps:route.departureDeltaVMps,correctionMps:route.correctionDeltaVMps,periapsisAltitudeKm:route.periapsisAltitudeKm,turnDeg:route.turnAngleRad*180/Math.PI,matchKmS:route.speedMismatchKmS,sameDatesSavingMps:route.deltaVSavedMps,sampledDirectWindowSavingMps:search.deltaVSavedVsDirectWindowMps,directWindow:search.sampledDirectWindowRoute ? {departureJdTdb:search.sampledDirectWindowRoute.departureJdTdb,flightDays:search.sampledDirectWindowRoute.flightDays,departureDeltaVMps:search.sampledDirectWindowRoute.departureDeltaVMps}:null}));
  });
  it('also beats the bounded direct launch-window scan without disguising the longer flight time',()=>{
    // Independent use of the existing direct search at identical launch dates.
    // Reproducible sampled comparison, not a global-optimality assertion.
    let best=Infinity;
    for(let offset=0;offset<=720;offset+=60){const direct=findDefaultSolarRoute('earth','saturn',SOLAR_EPOCH_JD+offset);if(direct.status==='solved')best=Math.min(best,direct.departureDeltaVMps);}
    expect(search.sampledDirectWindowRoute?.departureDeltaVMps).toBeCloseTo(best,8);
    expect(search.deltaVSavedVsDirectWindowMps).toBeGreaterThan(50);
    expect(route.flightDays).toBeGreaterThan(search.sampledDirectWindowRoute!.flightDays);
    const requiredFuel=(dv:number)=>500*Math.expm1(dv/(9.80665*450));
    expect(requiredFuel(route.totalPropulsiveDeltaVMps)).toBeLessThan(requiredFuel(best));
    expect(requiredFuel(route.totalPropulsiveDeltaVMps)).toBeLessThan(6500);
  });
  it('intercepts both moving planets and samples the proper Kepler leg',()=>{
    const start=assistRouteState(route,0),patch=assistRouteState(route,route.encounterElapsedDays),end=assistRouteState(route,route.flightDays);
    expect(magnitude(sub(start.positionKm,solarPosition('earth',route.request.departureJdTdb)))).toBeLessThan(.1);
    expect(magnitude(sub(patch.positionKm,solarPosition('jupiter',route.request.encounterJdTdb)))).toBeLessThan(.1);
    expect(magnitude(sub(end.positionKm,solarPosition('saturn',route.request.arrivalJdTdb)))).toBeLessThan(.1);
    expect(route.legs.every(leg=>leg.endpointErrorKm<.1)).toBe(true);expect(route.pointsAu).toHaveLength(321);
    expect(()=>assistRouteState(route,-1)).toThrow();expect(()=>assistRouteState(route,route.flightDays+.001)).toThrow();
  });
  it('conserves the planet-frame hyperbola energy and angular momentum through the close pass',()=>{
    const mu=solarBody('jupiter').muKm3S2,speed=magnitude(route.incomingVInfinityKmS);
    const initial=assistLocalState(route,0),h=cross(initial.positionKm,initial.velocityKmS);
    expect(dot(initial.positionKm,initial.velocityKmS)/(magnitude(initial.positionKm)*magnitude(initial.velocityKmS))).toBeCloseTo(0,12);
    for(const time of [-5*DAY_S,-DAY_S,0,DAY_S,5*DAY_S]){
      const at=assistLocalState(route,time),energy=dot(at.velocityKmS,at.velocityKmS)/2-mu/magnitude(at.positionKm);
      expect(energy).toBeCloseTo(speed*speed/2,9);
      expect(magnitude(sub(cross(at.positionKm,at.velocityKmS),h))/magnitude(h)).toBeLessThan(1e-10);
    }
    // Independent large-time propagation catches wrong or mirrored bisector axes.
    const farIn=hyperbolicLocalStateAt(route.periapsisState,mu,-1e10),farOut=hyperbolicLocalStateAt(route.periapsisState,mu,1e10);
    expect(magnitude(sub(normalize(farIn.velocityKmS),normalize(route.incomingVInfinityKmS)))).toBeLessThan(1e-6);
    expect(magnitude(sub(normalize(farOut.velocityKmS),normalize(route.naturalOutgoingVInfinityKmS)))).toBeLessThan(1e-6);
  });
  it('accounts for energy exchange with the moving planet instead of creating planet-frame speed',()=>{
    const vp=solarState('jupiter',route.request.encounterJdTdb).velocityKmS;
    const before=add(vp,route.incomingVInfinityKmS),after=add(vp,route.naturalOutgoingVInfinityKmS);
    const energyChange=(dot(after,after)-dot(before,before))/2;
    expect(energyChange).toBeCloseTo(dot(vp,sub(route.naturalOutgoingVInfinityKmS,route.incomingVInfinityKmS)),10);
    expect(Math.abs(energyChange)).toBeGreaterThan(1);
    expect(magnitude(route.naturalOutgoingVInfinityKmS)).toBeCloseTo(magnitude(route.incomingVInfinityKmS),12);
  });
  it('rejects unmatched speeds as free gravity assist and fully charges an explicit asymptotic burn',()=>{
    const changed=scale(route.naturalOutgoingVInfinityKmS,1.1);
    expect(()=>evaluateAssistGeometry('jupiter',route.incomingVInfinityKmS,changed)).toThrow(/상대 속도/);
    const powered=evaluateAssistGeometry('jupiter',route.incomingVInfinityKmS,changed,'asymptotic-correction');
    expect(powered.unpowered).toBe(false);
    expect(powered.correctionDeltaVMps).toBeCloseTo(.1*magnitude(route.incomingVInfinityKmS)*1000,8);
    expect(magnitude(sub(add(powered.naturalOutgoingVInfinityKmS,scale(powered.correctionVectorMps,.001)),changed))).toBeLessThan(1e-12);
    expect(powered.requiredPeriapsisKm).toBeCloseTo(route.requiredPeriapsisKm,6);
  });
  it('rejects excessive turns, distant encounters, malformed vectors and invalid date order',()=>{
    const radians=170*Math.PI/180;
    expect(()=>evaluateAssistGeometry('jupiter',[8,0,0],[8*Math.cos(radians),8*Math.sin(radians),0])).toThrow(/너무 가까이/);
    expect(()=>evaluateAssistGeometry('jupiter',[8,0,0],[8,0,0])).toThrow(/범위 밖/);
    expect(()=>evaluateAssistGeometry('jupiter',[NaN,0,0],[8,0,0])).toThrow();expect(()=>evaluateAssistGeometry('aster',[1,0,0],[0,1,0])).toThrow();
    expect(solveAssistRoute({...route.request,encounterJdTdb:route.request.departureJdTdb}).status).toBe('infeasible');
    expect(solveAssistRoute({...route.request,arrivalJdTdb:SOLAR_MAX_JD+1}).status).toBe('infeasible');
    expect(solveAssistRoute({...route.request,assist:'earth'}).status).toBe('infeasible');
    // Dates must affect vector matching; success must not be a planet-name bonus.
    expect(solveAssistRoute({...route.request,encounterJdTdb:route.request.encounterJdTdb+1}).status).toBe('infeasible');
  });
  it('bounds search work, yields progress and honors cancellation',async()=>{
    const rejected=searchAssistRouteSync({assist:'jupiter',target:'saturn',departureWindowDays:3650,departureStepDays:1});
    expect(rejected.status).toBe('infeasible');expect(rejected.evaluations).toBe(0);
    const updates:number[]=[];
    const one=await searchAssistRoute({assist:'jupiter',target:'saturn',departureJdTdb:route.request.departureJdTdb,departureWindowDays:0,flightDays:[route.flightDays]},{onProgress:p=>updates.push(p.completed)});
    expect(one.status).toBe('solved');expect(updates).toEqual([1]);
    const controller=new AbortController();controller.abort();
    await expect(searchAssistRoute({assist:'jupiter',target:'saturn'},{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
    expect(recommendedAssistBodies('saturn')).toContain('jupiter');expect(recommendedAssistBodies('mercury')).toContain('venus');
  });
});
