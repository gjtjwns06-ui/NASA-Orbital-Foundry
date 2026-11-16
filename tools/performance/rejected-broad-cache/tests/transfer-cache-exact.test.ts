import {beforeAll,describe,it,expect} from 'vitest';
import * as original from '../baseline/src/transfer';
import * as optimized from '../src/transfer';
import {createDesign} from '../src/sim/catalog';
import {createHardwareTransferDesign} from '../src/hardware';
import {freezeTransferInput} from '../src/transfer/immutable';
import {transferRuntimeEnvironmentAt,transferEnvironmentCacheSize} from '../src/transfer/state';
import {compiledTransferCraft} from '../src/transfer/compiled-craft';
import {resolveHardware} from '../src/hardware/resolve';
import {verifyBaselineManifest} from '../tools/performance/integrity';
beforeAll(async()=>{await verifyBaselineManifest(process.cwd());});

/** Deliberately stricter than save-parser tolerances and convergence tests. */
function exact(a:unknown,b:unknown,path='$'):void {
 if(typeof a==='number'){expect(typeof b,path).toBe('number');expect(Object.is(a,b),`${path}: ${a} versus ${b}`).toBe(true);return;}
 if(Array.isArray(a)){expect(Array.isArray(b),path).toBe(true);expect((b as unknown[]).length,path).toBe(a.length);a.forEach((v,i)=>exact(v,(b as unknown[])[i],`${path}[${i}]`));return;}
 if(a!==null&&typeof a==='object'){expect(b!==null&&typeof b==='object'&&!Array.isArray(b),path).toBe(true);expect(Object.keys(b as object).sort(),path).toEqual(Object.keys(a).sort());for(const [k,v] of Object.entries(a))exact(v,(b as Record<string,unknown>)[k],`${path}.${k}`);return;}
 expect(b,path).toBe(a);
}

describe('isolated exact-preserving environment/compiled-craft prototype',()=>{
 const cases=[{profile:'legacy',preset:'balanced',step:600},{profile:'legacy',preset:'science',step:600},{profile:'hardware',preset:'balanced',step:600},{profile:'hardware',preset:'science',step:600},{profile:'legacy',preset:'balanced',step:300},{profile:'hardware',preset:'balanced',step:300}] as const;
 it.each(cases)('$profile $preset $step: original and prototype have identical full-mission checkpoints',({profile,preset,step})=>{
  const craft=profile==='hardware'?createHardwareTransferDesign(preset):createDesign('mars',preset),plan=profile==='hardware'?optimized.createHardwareTransferPlan(preset):optimized.createTransferPlan(preset),beforeSolution=original.solveTransferPlan(plan),afterSolution=optimized.solveTransferPlan(plan);
  exact(beforeSolution,afterSolution,'solution');
  const before=original.createTransferRuntime(beforeSolution,craft,step),after=optimized.createTransferRuntime(afterSolution,craft,step);
  const checkpoints=[0,900,3600,beforeSolution.earthExitSeconds,beforeSolution.durationSeconds*.4,beforeSolution.marsEntrySeconds,beforeSolution.periapsisSeconds-8000,beforeSolution.periapsisSeconds,beforeSolution.periapsisSeconds+6500,beforeSolution.durationSeconds].filter(t=>t>=0&&t<=beforeSolution.durationSeconds).sort((a,b)=>a-b);
  for(const t of checkpoints){original.advanceTransfer(before,t-before.requestedTime);optimized.advanceTransfer(after,t-after.requestedTime);exact(before,after,`state@${t}`);exact(original.getTransferTelemetry(before),optimized.getTransferTelemetry(after),`telemetry@${t}`);}
  exact(original.getTransferResult(before),optimized.getTransferResult(after),'result');
  const oldSave=original.serializeTransferSave(original.makeTransferSave(plan,craft,before)),newSave=optimized.serializeTransferSave(optimized.makeTransferSave(plan,craft,after)),oldJson=JSON.parse(oldSave),newJson=JSON.parse(newSave);delete oldJson.savedAt;delete newJson.savedAt;exact(oldJson,newJson,'serialized checkpoint');
 },240000);

 it('private samples are bounded/frozen; network modes, signed zero and public aliases remain separate',()=>{
  const solution=freezeTransferInput(optimized.solveTransferPlan(optimized.createTransferPlan()));
  for(const t of [-0,0,100,solution.earthExitSeconds,solution.marsEntrySeconds,solution.durationSeconds])for(const network of [false,true]){const expected=original.transferEnvironmentAt(solution,t,network),sample=transferRuntimeEnvironmentAt(solution,t,network);exact(expected,sample);expect(Object.isFrozen(sample)).toBe(true);expect(Object.isFrozen(sample.state.earth.positionKm)).toBe(true);}
  const zero=transferRuntimeEnvironmentAt(solution,0,false),negative=transferRuntimeEnvironmentAt(solution,-0,false);expect(Object.is(zero.state.elapsedSeconds,0)).toBe(true);expect(Object.is(negative.state.elapsedSeconds,-0)).toBe(true);
  const privateValue=transferRuntimeEnvironmentAt(solution,100,true),publicValue=optimized.transferEnvironmentAt(solution,100,true);publicValue.state.earth.positionKm[0]+=1e8;publicValue.contactTargetPositionKm[1]=0;exact(privateValue,original.transferEnvironmentAt(solution,100,true));
  for(let i=0;i<70;i++)for(const network of [false,true])transferRuntimeEnvironmentAt(solution,200+i,network);
  const size=transferEnvironmentCacheSize(solution);expect(size.states).toBeLessThanOrEqual(32);expect(size.withNetwork).toBeLessThanOrEqual(32);expect(size.withoutNetwork).toBeLessThanOrEqual(32);exact(original.transferEnvironmentAt(solution,100,true),transferRuntimeEnvironmentAt(solution,100,true));
 });

 it('shallow-frozen and edited caller inputs never qualify as certified cache keys',()=>{
  const solution=structuredClone(optimized.solveTransferPlan(optimized.createTransferPlan()));Object.freeze(solution);Object.freeze(solution.plan);Object.freeze(solution.trajectory);
  const time=solution.earthExitSeconds+30,first=transferRuntimeEnvironmentAt(solution,time,false);solution.trajectory.coastInitialPositionKm[0]+=20;
  const second=transferRuntimeEnvironmentAt(solution,time,false);expect(first.state.heliocentricPositionKm).not.toEqual(second.state.heliocentricPositionKm);exact(second,original.transferEnvironmentAt(solution,time,false));expect(transferEnvironmentCacheSize(solution).states).toBe(0);
 });

 it('telemetry vector mutations and request chunking cannot poison integration',()=>{
  const plan=optimized.createHardwareTransferPlan(),craft=createHardwareTransferDesign(),solution=optimized.solveTransferPlan(plan),a=original.createTransferRuntime(solution,craft),b=optimized.createTransferRuntime(solution,craft);
  original.advanceTransfer(a,900);
  for(let i=0;i<45;i++){const view=optimized.getTransferTelemetry(b);view.environment.state.earth.positionKm[0]=1e20;view.environment.state.centerPositionKm[1]=-1e20;view.environment.sunDirection[2]=1;view.environment.contactTargetPositionKm[0]=0;optimized.advanceTransfer(b,20,11);while(b.time<b.requestedTime-1e-7){const t=b.time;optimized.advanceTransfer(b,0,11);if(t===b.time)break;}}
  exact(a,b);exact(original.getTransferTelemetry(a),optimized.getTransferTelemetry(b));
 },60000);

 it('compiled constants have private immutable ownership and edited drafts compile independently',()=>{
  const craft=freezeTransferInput(createHardwareTransferDesign()),publicResolved=resolveHardware(craft);publicResolved.inertiaKgM2[0]=1e30;publicResolved.modeLoadW.observe=1e20;
  const compiled=compiledTransferCraft(craft)!,fresh=compiledTransferCraft(freezeTransferInput(structuredClone(craft)))!;exact(compiled,fresh);expect(Object.isFrozen(compiled)).toBe(true);expect(Object.isFrozen(compiled.loads.observe)).toBe(true);expect(Object.isFrozen(compiled.link?.transform.normal)).toBe(true);expect(compiledTransferCraft(craft)).toBe(compiled);
  const draft=createHardwareTransferDesign(),first=compiledTransferCraft(draft)!;draft.parts.find(p=>p.kind==='antenna')!.rotation=45;const second=compiledTransferCraft(draft)!;expect(second).not.toBe(first);expect(second.link?.transform.tangentU).not.toEqual(first.link?.transform.tangentU);
 });
});
