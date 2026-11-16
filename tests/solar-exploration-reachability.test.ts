import {describe,expect,it} from 'vitest';
import {CARRIER,campaignReadiness,freshCampaign,observationProfile} from '../src/solar/campaign';
import {findDefaultSolarRoute,SOLAR_BODIES,SOLAR_EPOCH_JD,SOLAR_MAX_JD,type SolvedSolarRoute} from '../src/solar/model';

/** Tests the SAME bounded search exposed by the game, with the unchanged
 * authored carrier. A merely solvable Lambert curve is not a playable mission.
 * This establishes resource reachability, not a global optimum or GMAT accuracy. */
describe('all solar destinations remain reachable with the declared carrier',()=>{
  for(const body of SOLAR_BODIES.filter(body=>body.id!=='earth')){
    it(`${body.nameEn} has a fuel-feasible launch opportunity in the in-game search window`,()=>{
      const craft=freshCampaign().design;
      const sensor=craft.parts.find(part=>part.kind==='camera')!;
      sensor.kind=observationProfile(body.id).sensor;
      let best:{route:SolvedSolarRoute;fuelKg:number;issues:string[]}|undefined;
      for(let offset=0;offset<=720;offset+=60){
        const route=findDefaultSolarRoute('earth',body.id,SOLAR_EPOCH_JD+offset);
        if(route.status!=='solved')continue;
        const check=campaignReadiness(craft,route);
        if(!best||check.fuelKg<best.fuelKg)best={route,fuelKg:check.fuelKg,issues:check.issues};
      }
      expect(best,`No numerical route found to ${body.nameEn}`).toBeDefined();
      if(!best)return;
      const description=`${body.nameEn}: departure offset ${best.route.departureJdTdb-SOLAR_EPOCH_JD} d, coast ${best.route.flightDays} d, departure burn ${best.route.departureDeltaVMps.toFixed(1)} m/s, propellant ${best.fuelKg.toFixed(1)} / ${CARRIER.propellantKg} kg, issues ${best.issues.join(',')}`;
      console.info(description);
      expect(best.route.arrivalJdTdb).toBeLessThanOrEqual(SOLAR_MAX_JD);
      expect(best.fuelKg,description).toBeLessThanOrEqual(CARRIER.propellantKg);
      expect(best.issues,description).toEqual([]);
    });
  }
});
