import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {BUS,PARTS,createDesign} from '../src/sim/catalog';
import {add,dot,magnitude,propagateKepler,sub} from '../src/sim/physics';
import {DAY_S,hyperbolicLocalStateAt,SUN_MU_KM3_S2,solveLambert} from '../src/transfer/math';
import {createTransferPlan,evaluateEscapeStage,solveTransferPlan,trySolveTransferPlan} from '../src/transfer/planning';
import {EPHEMERIS_START_JD_TDB,EPHEMERIS_END_JD_TDB,jdToTdbCalendar,transferEphemerides,transferPlanetState} from '../src/transfer/ephemeris';
import {TRANSFER_EARTH_MU,TRANSFER_MARS_MU,TRANSFER_EARTH_RADIUS_KM,transferStateAt,transferTrajectory} from '../src/transfer/state';
import type {Vec3} from '../src/sim/types';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const json=(path:string)=>JSON.parse(read(path));
const cases=(['balanced','science'] as const).map(preset=>({preset,solution:solveTransferPlan(createTransferPlan(preset))}));

describe('independent M03 numerical and evidence audit',()=>{
  it('preserves raw Horizons identity and reproduces independently queried off-grid states',()=>{
    for(const body of ['earth','mars'] as const){
      const bundled=json(`src/transfer/data/${body}.json`),research=json(`tools/transfer/data/${body}.json`),raw=read(`tools/transfer/data/${body}-raw.json`);
      expect(bundled).toEqual(research);expect(hash(raw)).toBe(bundled.sourceSha256);
      expect(bundled.timeScale).toBe('TDB');expect(bundled.frame).toContain('ICRF');expect(bundled.origin).toBe('Sun (10)');expect(bundled.aberration).toBe('NONE (geometric)');
      const offgrid=json(`tools/transfer/data/${body}-offgrid-raw.json`).result.split('$$SOE')[1].split('$$EOE')[0].trim().split(/\r?\n/);
      expect(offgrid).toHaveLength(13);
      for(const line of offgrid){const cells=line.split(',').map((s:string)=>s.trim()),at=transferPlanetState(body,Number(cells[0])),r=cells.slice(2,5).map(Number) as Vec3,v=cells.slice(5,8).map(Number) as Vec3;
        expect(magnitude(sub(at.positionKm,r))).toBeLessThan(.001);expect(magnitude(sub(at.velocityKmS,v))).toBeLessThan(1e-6);
      }
    }
    expect(()=>transferPlanetState('earth',EPHEMERIS_START_JD_TDB-1e-6)).toThrow();expect(()=>transferPlanetState('mars',EPHEMERIS_END_JD_TDB+1e-6)).toThrow();
  });

  it.each(cases)('$preset aligns future planet states, elapsed TDB events and exact finite patch surfaces',({solution:s})=>{
    expect(s.phaseEvents.map(e=>e.elapsedSeconds)).toEqual([...s.phaseEvents.map(e=>e.elapsedSeconds)].sort((a,b)=>a-b));
    for(const event of s.phaseEvents){expect(event.jdTdb).toBe(s.plan.departurePeriapsisJdTdb+event.elapsedSeconds/DAY_S);const state=transferStateAt(s,event.elapsedSeconds);expect(state.jdTdb).toBe(event.jdTdb);expect(state.frame).toBe('ICRF');}
    expect(s.plan.arrivalPeriapsisJdTdb-s.plan.departurePeriapsisJdTdb).toBe(s.periapsisSeconds/DAY_S);
    const actualArrival=transferStateAt(s,s.periapsisSeconds),marsNow=transferPlanetState('mars',s.plan.departurePeriapsisJdTdb),marsFuture=transferPlanetState('mars',s.plan.arrivalPeriapsisJdTdb);
    expect(actualArrival.mars).toEqual(marsFuture);expect(magnitude(sub(marsFuture.positionKm,marsNow.positionKm))).toBeGreaterThan(1e8);
    expect(actualArrival.altitudeKm).toBeCloseTo(s.plan.marsPeriapsisAltitudeKm,6);
    const t=s.trajectory,earthLocal=hyperbolicLocalStateAt(t.earthLocalPeriapsis,TRANSFER_EARTH_MU,s.earthExitSeconds),earthCenter=transferPlanetState('earth',t.exitJdTdb);
    expect(magnitude(earthLocal.positionKm)).toBeCloseTo(t.earthBoundaryRadiusKm,3);
    expect(magnitude(sub(add(earthCenter.positionKm,earthLocal.positionKm),t.coastInitialPositionKm))).toBeLessThan(.001);
    expect(magnitude(sub(add(earthCenter.velocityKmS,earthLocal.velocityKmS),t.coast.departureVelocityKmS))).toBeLessThan(1e-7);
    const coastEnd=propagateKepler({positionKm:t.coastInitialPositionKm,velocityKmS:t.coast.departureVelocityKmS},s.marsEntrySeconds-s.earthExitSeconds,SUN_MU_KM3_S2),marsAtEntry=transferStateAt(s,s.marsEntrySeconds);
    expect(magnitude(marsAtEntry.relativePositionKm)).toBeCloseTo(t.marsBoundaryRadiusKm,3);
    expect(magnitude(sub(coastEnd.positionKm,marsAtEntry.heliocentricPositionKm))).toBeLessThan(.001);
    expect(magnitude(sub(coastEnd.velocityKmS,marsAtEntry.heliocentricVelocityKmS))).toBeLessThan(1e-7);
    const out=transferStateAt(s,s.durationSeconds);expect(magnitude(out.relativePositionKm)).toBeCloseTo(t.marsBoundaryRadiusKm,5);expect(dot(out.relativePositionKm,out.relativeVelocityKmS)).toBeGreaterThan(0);
  });

  it.each(cases)('$preset accounts for C3, the aligned escape impulse and a separate discarded propulsion stage',({preset,solution:s})=>{
    const craft=createDesign('mars',preset),before=JSON.stringify(craft),evaluation=evaluateEscapeStage(s,craft),stage=evaluation.stage;
    const payload=BUS.massKg+BUS.fuelKg+craft.parts.reduce((m,p)=>m+PARTS[p.kind].massKg,0),initial=stage.dryMassKg+stage.fuelKg+payload;
    const c3=dot(s.departureVInfinityKmS,s.departureVInfinityKmS),r=TRANSFER_EARTH_RADIUS_KM+s.plan.earthParkingAltitudeKm,expectedBurn=(Math.sqrt(c3+2*TRANSFER_EARTH_MU/r)-Math.sqrt(TRANSFER_EARTH_MU/r))*1000;
    expect(s.c3Km2S2).toBeCloseTo(c3,10);expect(s.escapeBurnMps).toBeCloseTo(expectedBurn,7);
    const remainingTotal=initial*Math.exp(-expectedBurn/(9.80665*stage.ispS));
    expect(evaluation.stageInitialMassKg).toBeCloseTo(initial,10);expect(evaluation.stageAfterBurnMassKg).toBeCloseTo(remainingTotal,8);
    expect(evaluation.fuelUsedKg).toBeCloseTo(initial-remainingTotal,8);expect(evaluation.stageFuelRemainingKg).toBeCloseTo(remainingTotal-stage.dryMassKg-payload,8);
    expect(evaluation.payloadFuelUnchangedKg).toBe(BUS.fuelKg);expect(evaluation.launchable).toBe(true);expect(JSON.stringify(craft)).toBe(before);
    expect(evaluation.totalCost).toBe(BUS.cost+craft.parts.reduce((n,p)=>n+PARTS[p.kind].cost,0)+stage.cost);
  });

  it('reuses the actual matched GMAT states without treating arbitrary TAI frame numbers as a tested TDB conversion',()=>{
    const s=cases[0].solution,reference=json('tools/transfer/patched-reference.json'),summary=json('tools/transfer/gmat-evidence/summary.json');
    expect(jdToTdbCalendar(s.plan.departurePeriapsisJdTdb)).toBe('2026-11-15');expect(jdToTdbCalendar(s.plan.arrivalPeriapsisJdTdb)).toBe('2027-08-02');
    expect(s.c3Km2S2).toBeCloseTo(reference.c3Km2S2,8);expect(summary.epochNote).toContain('No ephemeris or TDB-to-TAI conversion is tested');
    for(const [id,phase] of [['matched-earth-escape','earth'],['matched-solar-coast','sun'],['matched-mars-encounter','mars']] as const){
      const record=summary.results.find((r:{id:string})=>r.id===id),csv=read(`tools/transfer/gmat-evidence/${id}.csv`),script=read(`tools/transfer/gmat-evidence/${id}.script`);
      expect(hash(csv)).toBe(record.csvSha256);expect(hash(script)).toBe(record.scriptSha256);
      const rows=csv.trim().split(/\r?\n/).map(line=>line.split(',').map(Number));expect(rows.length).toBe(record.sampleCount);
      for(const row of rows){const absolute=phase==='earth'?row[0]:phase==='sun'?s.earthExitSeconds+row[0]:s.periapsisSeconds-reference.marsLocal.secondsToPeriapsis+row[0],state=transferStateAt(s,Math.min(absolute,s.durationSeconds));
        const center=phase==='earth'?state.earth:phase==='mars'?state.mars:{positionKm:[0,0,0] as Vec3,velocityKmS:[0,0,0] as Vec3};
        const r=sub(state.heliocentricPositionKm,center.positionKm),v=sub(state.heliocentricVelocityKmS,center.velocityKmS);
        expect(magnitude(sub(r,row.slice(1,4) as Vec3))).toBeLessThan(.02);expect(magnitude(sub(v,row.slice(4,7) as Vec3))).toBeLessThan(1e-6);
      }
    }
  });

  it('rejects genuinely unsupported geometry and exposes bad-window stage insufficiency as infeasible launch',()=>{
    expect(()=>solveLambert([1e8,0,0],[-1.5e8,0,0],200*DAY_S)).toThrow(/Collinear/);
    const p=createTransferPlan();p.departurePeriapsisJdTdb-=92;p.arrivalPeriapsisJdTdb-=92;
    const result=trySolveTransferPlan(p,createDesign('mars'));expect(result.status).toBe('solved');
    if(result.status==='solved'){expect(result.evaluation.launchable).toBe(false);expect(result.evaluation.warnings.some(w=>w.code==='STAGE_FUEL')).toBe(true);expect(result.evaluation.stageFuelRemainingKg).toBeLessThan(0);}
    p.ephemerisDatasetId='unverified';expect(trySolveTransferPlan(p,createDesign('mars')).status).toBe('infeasible');
  });

  it('keeps every local trajectory sample in the requested phase frame, including patch endpoints',()=>{
    const s=cases[0].solution;
    for(const [phase,body] of [['earth-escape','Earth'],['solar-coast','Sun'],['mars-flyby','Mars']] as const){
      const points=transferTrajectory(s,phase,20);expect(points).toHaveLength(20);
      expect(points.every(p=>p.phase===phase&&p.centerBody===body)).toBe(true);
      if(phase==='earth-escape')expect(Math.max(...points.map(p=>magnitude(p.relativePositionKm)))).toBeLessThanOrEqual(s.trajectory.earthBoundaryRadiusKm+.001);
    }
  });

  it('actually freezes published ephemeris samples so their advertised source identity cannot be silently mutated',()=>{
    const {earth,mars}=transferEphemerides();for(const table of [earth,mars]){expect(Object.isFrozen(table)).toBe(true);expect(Object.isFrozen(table.states)).toBe(true);expect(table.states.every(row=>Object.isFrozen(row))).toBe(true);}
  });
});
