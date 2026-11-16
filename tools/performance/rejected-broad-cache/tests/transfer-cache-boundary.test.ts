import {beforeAll,it,expect} from 'vitest';
import * as original from '../baseline/src/transfer';
import * as optimized from '../src/transfer';
import {createDesign as oldDesign} from '../baseline/src/sim/catalog';
import {createDesign as newDesign} from '../src/sim/catalog';
import {createHardwareTransferDesign as oldHardware} from '../baseline/src/hardware';
import {createHardwareTransferDesign as newHardware} from '../src/hardware';
import {canonicalExact,exactDigest,verifyBaselineManifest} from '../tools/performance/integrity';
beforeAll(async()=>{expect((await verifyBaselineManifest(process.cwd())).files).toBe(57);});

it('independent released factories exactly match the candidate inputs for both profiles/presets',()=>{
 for(const preset of ['balanced','science'] as const){expect(exactDigest(oldDesign('mars',preset))).toBe(exactDigest(newDesign('mars',preset)));expect(exactDigest(oldHardware(preset))).toBe(exactDigest(newHardware(preset)));expect(exactDigest(original.createTransferPlan(preset))).toBe(exactDigest(optimized.createTransferPlan(preset)));expect(exactDigest(original.createHardwareTransferPlan(preset))).toBe(exactDigest(optimized.createHardwareTransferPlan(preset)));}
});

it('exact evidence never aliases nonfinite/null, typed strings, numbers or signed zero',()=>{
 for(const value of [NaN,Infinity,-Infinity])expect(()=>canonicalExact({nested:[value]})).toThrow('Nonfinite');
 const values=[null,undefined,0,-0,'0','-0','__NEGATIVE_ZERO__',false,[],{},['number','-0']];expect(new Set(values.map(exactDigest)).size).toBe(values.length);
 expect(exactDigest({b:2,a:1})).toBe(exactDigest({a:1,b:2}));expect(exactDigest([1,2])).not.toBe(exactDigest([2,1]));
});

it('a launchable weak-solar hardware craft crosses real safe-mode hysteresis identically with smaller requests',()=>{
 const oldCraft=oldHardware(),newCraft=newHardware();for(const craft of [oldCraft,newCraft]){const solar=craft.parts.find(p=>p.kind==='solarLarge')!;solar.kind='solar';solar.modelId='tsp45-fixed-v2';}
 const oldPlan=original.createHardwareTransferPlan(),newPlan=optimized.createHardwareTransferPlan(),oldSolution=original.solveTransferPlan(oldPlan),newSolution=optimized.solveTransferPlan(newPlan);
 expect(original.evaluateEscapeStage(oldSolution,oldCraft).launchable).toBe(true);expect(optimized.evaluateEscapeStage(newSolution,newCraft).launchable).toBe(true);
 const a=original.createTransferRuntime(oldSolution,oldCraft),b=optimized.createTransferRuntime(newSolution,newCraft);original.advanceTransfer(a,oldSolution.durationSeconds,500);
 while(a.status==='running'&&!a.events.some(e=>e.code==='RECOVERED')){const previous=a.time;original.advanceTransfer(a,0,500);if(a.time===previous)break;}
 expect(a.events.some(e=>e.code==='SAFE_MODE')).toBe(true);expect(a.events.some(e=>e.code==='RECOVERED')).toBe(true);expect(a.energyMinimumWh).toBeLessThan(172*.05);
 const target=a.time,requests=[900,12031,600003,864017];let i=0;
 while(b.requestedTime<target){optimized.advanceTransfer(b,Math.min(requests[i++%requests.length],target-b.requestedTime),137);while(b.status==='running'){const previous=b.time;optimized.advanceTransfer(b,0,137);if(b.time===previous)break;}const view=optimized.getTransferTelemetry(b);view.environment.state.earth.positionKm[0]=1e30;view.environment.sunDirection[1]=0;}
 expect(b.time).toBe(target);optimized.advanceTransfer(b,oldSolution.durationSeconds-b.requestedTime,0);
 expect(exactDigest(b)).toBe(exactDigest(a));expect(b.events).toStrictEqual(a.events);expect(b.packets).toStrictEqual(a.packets);expect(optimized.getTransferTelemetry(b)).toStrictEqual(original.getTransferTelemetry(a));
},240000);
