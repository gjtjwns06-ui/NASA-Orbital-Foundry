import {beforeAll,describe,it,expect} from 'vitest';
import {BUS,createDesign} from '../src/sim/catalog';
import {dot,magnitude,normalize,scale,sub} from '../src/sim/physics';
import {createTransferPlan,evaluateEscapeStage,solveTransferPlan} from '../src/transfer/planning';
import {advanceTransfer,createTransferRuntime,getTransferResult,getTransferTelemetry,previewTransfer,TRANSFER_SCIENCE_REQUIREMENTS} from '../src/transfer/runtime';
import {transferEnvironmentAt} from '../src/transfer/state';
import {transferPlanetState} from '../src/transfer/ephemeris';
import type {TransferRuntimeState} from '../src/transfer/types';

const solution=solveTransferPlan(createTransferPlan()),craft=createDesign('mars');
let coarse:ReturnType<typeof previewTransfer>,fine:ReturnType<typeof previewTransfer>;
beforeAll(()=>{coarse=previewTransfer(solution,craft,600);fine=previewTransfer(solution,craft,300);},60000);
const stateRecord=(s:TransferRuntimeState)=>({time:s.time,energy:s.energyWh,min:s.energyMinimumWh,fuel:s.fuelKg,mode:s.safeMode,status:s.status,q:s.attitudeQuaternion,packets:s.packets,signals:s.signals,pending:s.pendingFrames,events:s.events,phases:s.processedEventIds,science:s.scienceReceived,tick:s.tick});

describe('independent full-transfer resource and signal audit',()=>{
  it('converges in300/600s cruise without changing receipts, outcome or fuel bookkeeping',()=>{
    expect(coarse.result.status).toBe('success');expect(fine.result.status).toBe('success');
    expect(coarse.result.score).toBe(fine.result.score);expect(coarse.state.scienceReceived).toBe(fine.state.scienceReceived);
    expect(Math.abs(coarse.state.energyMinimumWh-fine.state.energyMinimumWh)).toBeLessThan(.05);
    expect(Math.abs(coarse.state.energyWh-fine.state.energyWh)).toBeLessThan(.05);
    expect(coarse.state.packets.map(p=>[p.id,p.capturedAt,p.receivedAt,p.receivedBits])).toEqual(fine.state.packets.map(p=>[p.id,p.capturedAt,p.receivedAt,p.receivedBits]));
    const stage=evaluateEscapeStage(solution,craft);expect(stage.fuelUsedKg).toBeGreaterThan(100);expect(coarse.state.fuelKg).toBe(BUS.fuelKg);expect(fine.state.fuelKg).toBe(BUS.fuelKg);
    expect(coarse.state.events.filter(e=>e.code==='ESCAPE_BURN')).toHaveLength(1);
  });

  it('commits the same physical history for tiny render requests and a long warp',()=>{
    const single=createTransferRuntime(solution,craft),frames=createTransferRuntime(solution,craft);
    advanceTransfer(single,900);for(let i=0;i<9000;i++)advanceTransfer(frames,.1);
    expect(Math.abs(single.requestedTime-frames.requestedTime)).toBeLessThan(1e-6);expect(stateRecord(frames)).toEqual(stateRecord(single));
    const irregular=[1.3,57.2,601.7,.016,3599.2,40000,86400,125000],goal=solution.periapsisSeconds+8000;
    let i=0;while(frames.requestedTime<goal){const delta=Math.min(irregular[i++%irregular.length],goal-frames.requestedTime);advanceTransfer(frames,delta,137);while(frames.status==='running'){const t=frames.time;advanceTransfer(frames,0,137);if(frames.time===t)break;}}
    advanceTransfer(single,goal-single.requestedTime);
    expect(stateRecord(frames)).toEqual(stateRecord(single));expect(frames.requestedTime).toBe(goal);
  },60000);

  it('commits every physical patch event exactly once at its solved time',()=>{
    const codes={'earth-exit':'EARTH_EXIT','mars-entry':'MARS_ENTRY',periapsis:'PERIAPSIS','mars-exit':'MARS_EXIT'};
    for(const e of solution.phaseEvents){if(e.id==='departure')continue;const code=codes[e.id],rows=coarse.state.events.filter(x=>x.code===code);expect(rows).toHaveLength(1);expect(Math.abs(rows[0].time-e.elapsedSeconds)).toBeLessThan(1e-6);}
    expect(coarse.state.time).toBe(solution.durationSeconds);expect(coarse.state.processedEventIds).toEqual(['departure','earth-exit','mars-entry','periapsis','mars-exit']);
    expect(coarse.state.packets.every(p=>p.capturedAt>=solution.marsEntrySeconds&&p.capturedAt<=solution.durationSeconds)).toBe(true);
  });

  it('holds received science at zero until actual emitted frames finish their moving-ground light travel',()=>{
    const s=createTransferRuntime(solution,craft);advanceTransfer(s,solution.periapsisSeconds+5400);
    expect(s.packets.length).toBeGreaterThanOrEqual(TRANSFER_SCIENCE_REQUIREMENTS.targetPackets);expect(s.scienceReceived).toBe(0);
    const firstCapture=Math.min(...s.packets.map(p=>p.capturedAt));let firstSignal:TransferRuntimeState['signals'][number]|undefined;
    advanceTransfer(s,1800,0);
    while(s.status==='running'&&s.time<s.requestedTime){const before=s.time;advanceTransfer(s,0,1);firstSignal=s.signals[0];if(firstSignal||s.time===before)break;}
    expect(firstSignal).toBeTruthy();const signal=firstSignal!;expect(signal.sentAt).toBeGreaterThan(firstCapture);expect(signal.arrivesAt).toBeGreaterThan(signal.sentAt+60);
    const env=transferEnvironmentAt(solution,signal.sentAt);
    expect(signal.arrivesAt-signal.sentAt).toBeCloseTo(env.lightTimeSeconds,7);
    expect(env.contactDistanceKm/299792.458).toBeCloseTo(env.lightTimeSeconds,8);
    expect(magnitude(sub(env.contactTargetPositionKm,env.state.earth.positionKm))).toBeGreaterThan(1000);
    const receivingEarth=transferPlanetState('earth',env.state.jdTdb+env.lightTimeSeconds/86400),receiverOffset=sub(env.contactTargetPositionKm,receivingEarth.positionKm);
    expect(magnitude(receiverOffset)).toBeCloseTo(6378.137,5);
    expect(dot(normalize(receiverOffset),normalize(sub(env.state.heliocentricPositionKm,env.contactTargetPositionKm)))).toBeGreaterThanOrEqual(Math.sin(5*Math.PI/180));
    expect(signal.stationId).not.toBe('network');expect(env.groundVisible).toBe(true);expect(env.earthLinkOcculted).toBe(false);expect(env.solarConjunction).toBe(false);
    expect(signal.sentAt%60).toBeCloseTo(0,6);expect(signal.bits).toBeGreaterThan(0);
    const initialReceived=s.packets.reduce((n,p)=>n+p.receivedBits,0),beforeArrival=structuredClone(s);beforeArrival.requestedTime=beforeArrival.time;
    advanceTransfer(beforeArrival,signal.arrivesAt-beforeArrival.time-.001);
    expect(beforeArrival.packets.reduce((n,p)=>n+p.receivedBits,0)).toBe(initialReceived);
    advanceTransfer(beforeArrival,.001);
    expect(beforeArrival.time).toBeCloseTo(signal.arrivesAt,6);expect(beforeArrival.packets.reduce((n,p)=>n+p.receivedBits,0)).toBeGreaterThan(initialReceived);
    // A frame is only part of a24Mbit science packet; it cannot itself award a dataset.
    if(signal.bits<TRANSFER_SCIENCE_REQUIREMENTS.packetBits)expect(beforeArrival.scienceReceived).toBe(0);
    expect(beforeArrival.packets.every(p=>p.receivedBits<=p.transmittedBits&&p.transmittedBits<=p.bits)).toBe(true);
  },60000);

  it('bounds weak-solar energy convergence at common intermediate dates, not only at saturated endpoints',()=>{
    const weak=createDesign('mars');weak.parts[0].kind='solar';const a=createTransferRuntime(solution,weak,600),b=createTransferRuntime(solution,weak,300);
    for(const day of [100,150,180,200,230,259]){const at=day*86400;advanceTransfer(a,at-a.requestedTime);advanceTransfer(b,at-b.requestedTime);expect(a.time).toBe(b.time);expect(Math.abs(a.energyWh-b.energyWh)).toBeLessThan(.1);expect(a.status).toBe(b.status);}
    expect(a.events.some(e=>e.code==='SAFE_MODE')).toBe(true);expect(a.events.some(e=>e.code==='RECOVERED')).toBe(true);
  },60000);

  it('does not turn missing hardware, weak generation or missing downlinks into free science',()=>{
    const deadCraft=createDesign('mars');deadCraft.parts=deadCraft.parts.filter(p=>p.kind!=='solarLarge');
    const dead=previewTransfer(solution,deadCraft);expect(dead.state.status).toBe('failed');expect(dead.state.time).toBeLessThan(solution.marsEntrySeconds);expect(dead.state.events.some(e=>e.code==='SAFE_MODE')).toBe(true);expect(dead.state.events.some(e=>e.code==='POWER_LOSS')).toBe(true);expect(dead.state.energyWh).toBe(0);expect(dead.state.scienceReceived).toBe(0);expect(dead.state.fuelKg).toBe(6);
    const weak=createDesign('mars');weak.parts[0].kind='solar';const w=previewTransfer(solution,weak);expect(w.state.events.some(e=>e.code==='SAFE_MODE')).toBe(true);expect(w.result.status).not.toBe('success');
    const plan=createTransferPlan();plan.operations=plan.operations.filter(op=>op.kind!=='downlink');const noTx=previewTransfer(solveTransferPlan(plan),craft);expect(noTx.state.packets.length).toBeGreaterThan(0);expect(noTx.state.scienceReceived).toBe(0);expect(noTx.state.packets.every(p=>p.receivedAt===null&&p.receivedBits===0)).toBe(true);expect(noTx.result.status).toBe('failed');
  },60000);

  it('blocks an insufficient launch before claiming a performed escape or changing payload state',()=>{
    const plan=createTransferPlan();plan.departurePeriapsisJdTdb-=92;plan.arrivalPeriapsisJdTdb-=92;const s=createTransferRuntime(solveTransferPlan(plan),craft),before=stateRecord(s);
    expect(s.status).toBe('failed');expect(s.events.some(e=>e.code==='LAUNCH_BLOCKED')).toBe(true);expect(s.events.some(e=>e.code==='ESCAPE_BURN')).toBe(false);advanceTransfer(s,1000000);expect(stateRecord(s)).toEqual(before);expect(s.fuelKg).toBe(6);expect(getTransferResult(s).status).toBe('failed');
  });

  it('uses actual shadow and slew state rather than applying a perfect requested attitude instantly',()=>{
    const s=createTransferRuntime(solution,craft),initial=getTransferTelemetry(s);expect(initial.slewAngleDeg).toBeGreaterThan(1);advanceTransfer(s,1);const moved=getTransferTelemetry(s);
    expect(moved.slewAngleDeg).toBeLessThan(initial.slewAngleDeg);expect(s.time).toBeLessThanOrEqual(1);
    for(const t of [0,300,3600,solution.earthExitSeconds,solution.periapsisSeconds-1000,solution.periapsisSeconds]){
      const snapshot=structuredClone(s);snapshot.time=t;const tele=getTransferTelemetry(snapshot);expect(tele.environment.eclipse).toBe(transferEnvironmentAt(solution,t).eclipse);if(tele.environment.eclipse)expect(tele.solarPowerW).toBe(0);
    }
  });

  it('actually traverses a nightside eclipse and produces zero solar power inside the independent sphere-ray shadow',()=>{
    const plan=createTransferPlan();plan.marsBPlaneAngleRad=Math.PI;const shadowSolution=solveTransferPlan(plan),s=createTransferRuntime(shadowSolution,craft);
    advanceTransfer(s,shadowSolution.periapsisSeconds-1000);const initialEnergy=s.energyWh;let darkSamples=0,litSamples=0,crossings=0,previous:boolean|null=null;
    const intersects=(origin:[number,number,number],center:[number,number,number],radius:number)=>{const ray=scale(origin,-1),offset=sub(origin,center),a=dot(ray,ray),b=2*dot(offset,ray),c=dot(offset,offset)-radius*radius,disc=b*b-4*a*c;if(disc<0)return false;const root=Math.sqrt(disc),t0=(-b-root)/(2*a),t1=(-b+root)/(2*a);return (t0>0&&t0<1)||(t1>0&&t1<1);};
    advanceTransfer(s,2000,0);
    while(s.time<s.requestedTime-1e-6){const before=s.time;advanceTransfer(s,0,1);if(s.time===before)break;const t=getTransferTelemetry(s),v=t.environment.state,expected=intersects(v.heliocentricPositionKm,v.earth.positionKm,6378.137)||intersects(v.heliocentricPositionKm,v.mars.positionKm,3389.5);
      expect(t.environment.eclipse).toBe(expected);if(previous!==null&&previous!==expected)crossings++;previous=expected;if(expected){darkSamples++;expect(t.solarPowerW).toBe(0);}else litSamples++;
    }
    expect(darkSamples).toBeGreaterThan(100);expect(litSamples).toBeGreaterThan(30);expect(crossings).toBe(2);expect(s.energyWh).toBeLessThan(initialEnergy);
  },60000);
});
