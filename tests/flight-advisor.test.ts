import {describe,it,expect} from 'vitest';
import {createDesign,MISSIONS} from '../src/sim/catalog';
import {advanceSimulation,createSimulation,getTelemetry,queueCommand} from '../src/sim/simulation';
import {evaluateDesign} from '../src/sim/assembly';
import {forecastFlight,MAX_FLIGHT_FORECAST_SECONDS} from '../src/flight-advisor';

describe('read-only actual-state flight forecast',()=>{
  it('matches an actual tick-by-tick continuation without modifying the live checkpoint or queues',()=>{
    const actual=createSimulation(createDesign('earth'));advanceSimulation(actual,800);queueCommand(actual,'charge',120);actual.remainder=2.25;
    const frozen=JSON.stringify(actual),copy=structuredClone(actual);let minimum=copy.energyWh;
    for(let i=0;i<360&&copy.status==='running';i++){advanceSimulation(copy,5);minimum=Math.min(minimum,copy.energyWh);}
    const result=forecastFlight(actual);
    expect(JSON.stringify(actual)).toBe(frozen);expect(result.baseTime).toBe(800);expect(result.horizon).toBe(1800);expect(result.ticks).toBe(360);
    expect(result.minEnergyWh).toBe(minimum);expect(result.energyCapacity).toBe(evaluateDesign(actual.design).batteryWh);
    expect(result.scienceAtHorizon).toBe(copy.scienceReceived);expect(result.endingStatus).toBe(copy.status);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);expect(result.reasons.length).toBeLessThanOrEqual(3);
  });

  it('prioritizes a real later power danger over an earlier ordinary operation change',()=>{
    const d=createDesign('earth');d.parts=d.parts.filter(p=>p.kind!=='solar');d.plan.operations=[{id:'observe',kind:'observe',start:5,end:600}];
    const s=createSimulation(d);s.energyWh=evaluateDesign(d).batteryWh*.045;s.energyMinimumWh=0;
    const result=forecastFlight(s,300);
    expect(result.nextEvent?.kind).toBe('safe-mode-enter');expect(result.nextEvent!.time).toBeGreaterThan(5);
    expect(result.minEnergyWh).toBeGreaterThan(0);expect(result.minEnergyWh).toBeLessThan(s.energyWh);
    expect(result.reasons[0].code).toBe('safe-mode-enter');expect(s.safeMode).toBe(false);
  });

  it('preserves pending Mars light time, arrival conditions and delayed command execution',()=>{
    const s=createSimulation(createDesign('mars'));advanceSimulation(s,11000);const c=queueCommand(s,'charge',120);expect(c.status).toBe('inflight');
    const early=forecastFlight(s,595);expect(early.commandChanges).toHaveLength(0);expect(early.pendingCommandsAtHorizon).toBe(1);
    const later=forecastFlight(s,610);expect(later.commandChanges).toHaveLength(1);
    expect(later.commandChanges[0].status).toBe('executed');expect(later.commandChanges[0].executedAt).toBeGreaterThanOrEqual(c.arrivesAt!);
    expect(later.commandChanges[0].executedAt!-c.arrivesAt!).toBeLessThan(5);
    expect(c.status).toBe('inflight');expect(c.executedAt).toBeNull();
    expect(later.reasons.some(r=>r.code==='commands'&&r.en.includes('Light time'))).toBe(true);
  });

  it('forecasts an in-flight command failing after the scheduled antenna turns away',()=>{
    const d=createDesign('mars');d.plan.operations=[{id:'tx',kind:'downlink',start:10000,end:11200}];
    const s=createSimulation(d);advanceSimulation(s,11000);queueCommand(s,'observe',600);
    const result=forecastFlight(s,650);
    expect(result.nextEvent?.kind).toBe('command-failed');expect(result.commandChanges[0].status).toBe('failed');
    expect(s.commands[0].status).toBe('inflight');
  });

  it('caps its horizon, stops exactly at the mission deadline, and does not advance terminal states',()=>{
    const s=createSimulation(createDesign('earth'));expect(forecastFlight(s,1e9).horizon).toBe(MAX_FLIGHT_FORECAST_SECONDS);
    advanceSimulation(s,MISSIONS.earth.duration-10);const last=forecastFlight(s);
    expect(last.horizon).toBe(10);expect(last.ticks).toBe(2);expect(last.endingStatus).toBe('complete');
    expect(last.nextEvent?.kind).toBe('deadline');expect(last.nextEvent?.time).toBe(MISSIONS.earth.duration);
    advanceSimulation(s,10);const terminal=forecastFlight(s);expect(terminal.horizon).toBe(0);expect(terminal.ticks).toBe(0);expect(terminal.nextEvent).toBeNull();
    expect(forecastFlight(createSimulation(createDesign('earth')),7).horizon).toBe(5);
    expect(()=>forecastFlight(s,NaN)).toThrow();expect(()=>forecastFlight(s,-1)).toThrow();
  });

  it('returns deterministic model results and measured cost without claiming future reception is certain',()=>{
    const s=createSimulation(createDesign('mars'));advanceSimulation(s,10900);expect(getTelemetry(s).linkReady).toBe(true);
    const a=forecastFlight(s),b=forecastFlight(s);const {computeMs:ac,...av}=a,{computeMs:bc,...bv}=b;
    expect(av).toEqual(bv);expect(ac).toBeGreaterThanOrEqual(0);expect(bc).toBeGreaterThanOrEqual(0);expect(a.assumesNoNewCommands).toBe(true);
    expect(a.scienceAtHorizon).toBeGreaterThanOrEqual(s.scienceReceived);
    const costs=[];for(const mission of ['earth','mars'] as const){const current=createSimulation(createDesign(mission));for(let i=0;i<3;i++)costs.push({mission,ms:Number(forecastFlight(current).computeMs.toFixed(2))});}
    console.info('flight-advisor 1800s / 360-tick local cost samples:',JSON.stringify(costs));
  });
});
