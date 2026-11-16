import { describe, expect, it } from 'vitest';
import { magnitude, sub } from '../src/sim/physics';
import { AU_KM, findDefaultSolarRoute, planSolarRoute, SOLAR_BODIES, SOLAR_EPOCH_JD, SOLAR_MAX_JD, solarPosition, solarPositionAu, solarRouteInvariants, solarRouteState, solarState, type SolvedSolarRoute } from '../src/solar/model';

describe('solar exploration navigation model',()=>{
  it('provides all eight planets and one explicitly fictional asteroid, in consistent units',()=>{
    expect(SOLAR_BODIES.filter(body=>!body.fictional)).toHaveLength(8);
    expect(SOLAR_BODIES.filter(body=>body.fictional).map(body=>body.id)).toEqual(['aster']);
    for(const body of SOLAR_BODIES){
      const r=magnitude(solarPosition(body.id,SOLAR_EPOCH_JD))/AU_KM;
      expect(r).toBeGreaterThan(body.aAu*(1-body.elements[1])*.999);
      expect(r).toBeLessThan(body.aAu*(1+body.elements[1])*1.001);
      expect(magnitude(solarPositionAu(body.id,SOLAR_EPOCH_JD))).toBeCloseTo(r,12);
    }
    // Independent J2000 heliocentric JPL approximate Earth/Moon barycenter
    // coordinates (AU), ecliptic rotated into equatorial J2000.
    const p=solarPositionAu('earth',2451545);
    expect(p[0]).toBeCloseTo(-.177171,4);
    expect(p[1]).toBeCloseTo(.887402,4);
    expect(p[2]).toBeCloseTo(.384736,4);
    expect(magnitude(solarState('earth',SOLAR_EPOCH_JD).velocityKmS)).toBeGreaterThan(29);
    expect(magnitude(solarState('earth',SOLAR_EPOCH_JD).velocityKmS)).toBeLessThan(31);
  });

  it('finds actual two-body intercepts for every destination including the outer planets',()=>{
    for(const body of SOLAR_BODIES.filter(body=>body.id!=='earth')){
      const result=findDefaultSolarRoute('earth',body.id,SOLAR_EPOCH_JD);
      expect(result.status,`${body.id}: ${result.error}`).toBe('solved');
      if(result.status!=='solved')continue;
      expect(result.pointsAu).toHaveLength(161);
      const start=solarRouteState(result,0),end=solarRouteState(result,result.flightDays);
      expect(magnitude(sub(start.positionKm,solarPosition('earth',result.departureJdTdb)))).toBeLessThan(1e-6);
      expect(magnitude(sub(end.positionKm,solarPosition(body.id,result.arrivalJdTdb)))).toBeLessThan(.1);
      expect(result.departureDeltaVMps).toBeGreaterThan(0);
      expect(result.arrivalVInfinityKmS).toBeGreaterThan(0);
      expect(result.arrivalJdTdb).toBeLessThanOrEqual(SOLAR_MAX_JD);
    }
  });

  it('preserves solar orbital energy and angular momentum throughout a real coast',()=>{
    const route=findDefaultSolarRoute('earth','mars') as SolvedSolarRoute;
    expect(route.status).toBe('solved');
    const initial=solarRouteInvariants(route,0);
    for(const fraction of [.17,.5,.83,1]){
      const at=solarRouteInvariants(route,route.flightDays*fraction);
      expect(Math.abs((at.energyKm2S2-initial.energyKm2S2)/initial.energyKm2S2)).toBeLessThan(1e-9);
      expect(magnitude(sub(at.angularMomentumKm2S,initial.angularMomentumKm2S))/magnitude(initial.angularMomentumKm2S)).toBeLessThan(1e-9);
    }
  });

  it('changes physical trajectory and energy when arrival time or destination changes',()=>{
    const a=planSolarRoute('earth','mars',SOLAR_EPOCH_JD,240);
    const b=planSolarRoute('earth','mars',SOLAR_EPOCH_JD,300);
    const c=planSolarRoute('earth','venus',SOLAR_EPOCH_JD,240);
    expect([a,b,c].map(route=>route.status)).toEqual(['solved','solved','solved']);
    if(a.status!=='solved'||b.status!=='solved'||c.status!=='solved')return;
    expect(Math.abs(a.c3Km2S2-b.c3Km2S2)).toBeGreaterThan(.1);
    expect(magnitude(sub(a.pointsAu[80],b.pointsAu[80]))).toBeGreaterThan(.01);
    expect(magnitude(sub(a.arrivalPositionKm,c.arrivalPositionKm))).toBeGreaterThan(AU_KM*.1);
  });

  it('rejects impossible inputs without returning a decorative route or extrapolating dates',()=>{
    for(const days of [0,-1,NaN,Infinity,7301]){
      const result=planSolarRoute('earth','mars',SOLAR_EPOCH_JD,days);
      expect(result.status).toBe('infeasible');expect(result.pointsAu).toEqual([]);expect(result.error).toBeTruthy();
    }
    expect(planSolarRoute('earth','mars',SOLAR_MAX_JD-10,20).status).toBe('infeasible');
    expect(planSolarRoute('earth','earth',SOLAR_EPOCH_JD,300).status).toBe('infeasible');
    expect(()=>solarPosition('earth',SOLAR_MAX_JD+1)).toThrow();
  });
});
