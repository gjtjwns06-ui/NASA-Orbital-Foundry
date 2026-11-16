import {beforeAll,describe,expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {assertEngineIntegrity} from './review-integrity';
import {createSwingbyDesign,createSwingbyPlan,solveSwingbyPlan} from '../src/swingby/planning';
import {advanceSwingby,createSwingbyRuntime,getSwingbyResult,getSwingbyTelemetry} from '../src/swingby/runtime';
import {makeSwingbySave,serializeSwingbySave,swingbyCheckpoint} from '../src/swingby/persistence';
import {getSwingbyScenario} from '../src/swingby/scenario';
import {swingbyStateAt} from '../src/swingby/orbit';
import type {Design} from '../src/sim/types';
import type {SwingbyRuntime} from '../src/swingby/types';
import {pinSwingbyRun,verifySwingbySource,seekSwingbyRun,createSwingbyAttempt,reviewCacheStats} from '../src/redesign/adapters/swingby';
import {compareRuns,comparisonCompatibility} from '../src/redesign/compare';
import {semanticCraft,semanticOperations,resolvePartTarget,partTarget} from '../src/redesign/semantics';
import {hashText,validateSource,ReviewError} from '../src/redesign/validation';
import {makeReviewPair,importReviewPair,ReviewArchive,type AtomicReviewStore,type ArchiveSnapshot} from '../src/redesign/archive';
import type {VerifiedRun,ReviewPair,RunId} from '../src/redesign/schema';
const integrity=assertEngineIntegrity(),scenario=getSwingbyScenario(),fast={yieldControl:async()=>{}};
function start(weak=false){const craft=createSwingbyDesign();if(weak)craft.parts.find(p=>p.kind==='adcs')!.modelId='xact15-carrier-v1';const solved=solveSwingbyPlan(createSwingbyPlan(),craft);if(solved.status!=='solved'||!solved.evaluation.launchable)throw Error('Fixture must really launch');return createSwingbyRuntime(solved.solution,craft);}
const save=(s:SwingbyRuntime)=>serializeSwingbySave(makeSwingbySave(s.solution.plan,s.craft,s));
let a:SwingbyRuntime,b:SwingbyRuntime,A:VerifiedRun,B:VerifiedRun,partial:VerifiedRun,zero:VerifiedRun,partialText:string,zeroText:string;
beforeAll(async()=>{
 mkdirSync('docs/qa/milestone-7/domain/actual-sources',{recursive:true});const timings:Record<string,number>={};let clock=performance.now();const timing=(name:string)=>{timings[name]=performance.now()-clock;clock=performance.now();writeFileSync('docs/qa/milestone-7/domain/actual-pin-timings.json',JSON.stringify({timings,scope:'Observed actual fixture and strict replay wall time; concurrent functional QA, not an isolated benchmark'},null,2));};const stage=(name:string,s:SwingbyRuntime)=>{const text=save(s);writeFileSync('docs/qa/milestone-7/domain/actual-sources/'+name+'.json',text);console.log(name,{time:s.time,tick:s.tick,status:s.status});return text;};
 a=start(true);zeroText=save(a);advanceSwingby(a,3600,Infinity);partialText=save(a);advanceSwingby(a,scenario.deadlineSeconds,Infinity);const aText=stage('A-actual-complete',a);timing('actualWeakFlightMs');
 b=start(false);advanceSwingby(b,scenario.deadlineSeconds,Infinity);const bText=stage('B-actual-complete',b);timing('actualRepairedFlightMs');
 console.log('strict A replay');A=await pinSwingbyRun(aText,{runId:'A-weak-adcs',displayName:'Actual weak-ADCS flight'},fast);timing('strictWeakPinMs');console.log('strict B replay');B=await pinSwingbyRun(bText,{runId:'B-adcs-replaced',displayName:'Actual changed-ADCS flight'},fast);timing('strictRepairedPinMs');
 partial=await pinSwingbyRun(partialText,{runId:'partial',displayName:'Actual3600s'},fast);zero=await pinSwingbyRun(zeroText,{runId:'zero',displayName:'Actual initial state'},fast);
 mkdirSync('docs/qa',{recursive:true});writeFileSync('docs/qa/milestone-7/domain/actual-ab-evidence.json',JSON.stringify({integrity,A:{sourceHash:A.source.engineSaveSha256,result:A.result,evaluation:A.evaluation,burn:a.burn},B:{sourceHash:B.source.engineSaveSha256,result:B.result,evaluation:B.evaluation,burn:b.burn},comparison:compareRuns(A,B)},null,2));
},600000);
describe('actual M02B A/B adapter',()=>{
 it('replays two actual complete flights and keeps the missed burn causal evidence explicit',()=>{
  expect(a.status).toBe('complete');expect(b.status).toBe('complete');expect(a.burn?.status).toBe('skipped');expect(a.burn?.reasons).toContain('BURN_ATTITUDE');expect(b.burn?.status).toBe('fired');expect(B.result.status).toBe('success');
  expect(A.result.score).toBe(getSwingbyResult(a).score);expect(B.result.received).toBe(getSwingbyResult(b).received);const card=A.diagnostics.find(d=>d.code==='BURN_SKIPPED')!;expect(card.strength).toBe('recorded-rejection');expect(card.evidence[0].values.pointingError.value).toBe(a.burn!.pointingErrorDeg);expect(card.targets.some(t=>t.kind==='part'&&t.signature.kind==='adcs')).toBe(true);
  const c=compareRuns(A,B);expect(c.compatibility.mode).toBe('controlled');expect(c.changes.filter(c=>c.kind==='hardware')).toHaveLength(2);expect(c.changes.some(c=>c.targets.some(t=>t.kind==='part'&&t.signature.modelId==='xact50-carrier-v1'))).toBe(true);expect(c.deltas!.score).toBe(B.result.score!-A.result.score!);expect(c.warning.en).toContain('does not establish');
 });
 it('preserves exact source bytes and deeply immutable A while B edits a fresh initial craft/plan',()=>{
  const hash=A.source.engineSaveSha256,draft=createSwingbyAttempt(A);expect(Object.keys(draft).sort()).toEqual(['craft','numerics','parentRunId','plan']);expect(draft.craft).toEqual(a.craft);expect(draft.plan).toEqual(a.solution.plan);draft.craft.parts.splice(0,1);draft.plan.aim.xKm+=100;draft.plan.operations.length=0;
  expect(A.source.engineSaveSha256).toBe(hash);expect(hashText(A.source.engineSaveText)).toBe(hash);expect(Object.isFrozen(A.diagnostics)).toBe(true);expect(()=>{(A.result as any).score=100;}).toThrow();expect(createSwingbyAttempt(A).craft.parts).toHaveLength(a.craft.parts.length);
 });
 it('does not compare fabricated imported results as verified engine runs',()=>{expect(()=>compareRuns(structuredClone(A),B)).toThrowError('UNVERIFIED_RUN');});
 it('guards each incompatible identity, score, final/partial and unequal actual partial time',()=>{
  const keys=['modelVersion','engineManifestSha256','hardwareCatalogSha256','scenarioSha256','propulsionProfileSha256','ephemerisDatasetId','requirementsSha256','numericalPolicySha256'] as const;
  for(const key of keys){const other=structuredClone(B);(other.identity as any)[key]='different';expect(comparisonCompatibility(A,other).mode,key).toBe('blocked');}
  const missing=structuredClone(B);(missing.identity as any).score=null;expect(comparisonCompatibility(A,missing).blockers.some(b=>b.code==='SCORE_DEFINITION')).toBe(true);
  expect(compareRuns(A,partial).compatibility.blockers.some(b=>b.code==='FINAL_PARTIAL_MISMATCH')).toBe(true);expect(compareRuns(zero,partial).deltas).toBeNull();expect(compareRuns(zero,partial).compatibility.blockers.some(b=>b.code==='PARTIAL_TIME')).toBe(true);
 });
 it('semantic inputs ignore names/IDs/order, preserve duplicate counts, tiny moves and selected radio',()=>{
  const craft=structuredClone(a.craft),renamed=structuredClone(craft);renamed.name='cosmetic';renamed.parts.reverse();const ids=new Map(renamed.parts.map((p,i)=>[p.id,'new-'+i]));for(const p of renamed.parts)p.id=ids.get(p.id)!;if(renamed.activeRadioId)renamed.activeRadioId=ids.get(renamed.activeRadioId);
  expect(semanticCraft(renamed)).toEqual(semanticCraft(craft));const shifted=structuredClone(craft);shifted.parts[0].u+=1e-12;expect(semanticCraft(shifted)).not.toEqual(semanticCraft(craft));const duplicate=structuredClone(craft);duplicate.parts.push({...duplicate.parts[0],id:'extra'});expect((semanticCraft(duplicate) as any).parts).toHaveLength(craft.parts.length+1);
  const two=structuredClone(craft),radio=two.parts.find(p=>p.kind==='radio')!;two.parts.push({...radio,id:'radio-second',u:.1,v:0});two.activeRadioId=radio.id;const first=(semanticCraft(two) as any).activeRadio;two.activeRadioId='radio-second';expect((semanticCraft(two) as any).activeRadio).not.toEqual(first);
  const plan=structuredClone(a.solution.plan),renamedPlan=structuredClone(plan);renamedPlan.operations.reverse();renamedPlan.operations.forEach((o,i)=>o.id='operation-'+i);expect(semanticOperations(renamedPlan)).toEqual(semanticOperations(plan));
 });
 it('resolves historical targets without selecting an ID reused for another model',()=>{
  const craft=structuredClone(a.craft),part=craft.parts.find(p=>p.kind==='adcs')!,target=partTarget(part);if(target.kind!=='part')throw Error();expect(resolvePartTarget(target,craft).status).toBe('exact');part.id='renamed';expect(resolvePartTarget(target,craft).status).toBe('semantic');craft.parts.push({...part,id:'duplicate'});expect(resolvePartTarget(target,craft).status).toBe('ambiguous');craft.parts=craft.parts.filter(p=>p.kind!=='adcs');craft.parts.push({...part,id:target.partId,modelId:'xact50-carrier-v1'});expect(resolvePartTarget(target,craft).status).toBe('stale');
 });
 it('replays the actual skipped-burn arc and emits only history at one committed time',async()=>{
  const sample=await seekSwingbyRun(A,4000,fast),independent=start(true);advanceSwingby(independent,4000,Infinity);const dto=sample.renderDto as any,t=sample.telemetry as any;
  expect(sample.cursor.committedTimeSeconds).toBe(independent.time);expect(dto.physical).toEqual(swingbyStateAt(independent.actualArcs,independent.time));expect(dto.attitudeQuaternion).toEqual(independent.attitudeQuaternion);expect(t.values.energyWh).toBe(getSwingbyTelemetry(independent).energyWh);expect(dto.burn.status).toBe('skipped');expect(dto.trajectory.points.every((p:any)=>p.elapsedSeconds<=sample.cursor.committedTimeSeconds)).toBe(true);expect(JSON.parse(A.source.engineSaveText).checkpoint).toEqual(swingbyCheckpoint(a));
 },30000);
 it('reuses exact verified source and private actual checkpoints without exposing mutable cache state',async()=>{
  const first=await seekSwingbyRun(A,4200,fast),warm=await seekSwingbyRun(A,4200,fast);expect(warm.work.replayedSteps).toBe(0);expect(warm.renderDto).toEqual(first.renderDto);expect(warm.telemetry).toEqual(first.telemetry);const client=structuredClone(warm);(client.renderDto as any).physical.relativePositionKm[0]=12345;expect((await seekSwingbyRun(A,4200,fast)).renderDto).toEqual(first.renderDto);
  const stats=reviewCacheStats(),started=performance.now(),again=await verifySwingbySource(A.source,fast),pinMs=performance.now()-started;expect(reviewCacheStats().strictVerifications).toBe(stats.strictVerifications);expect(again.result).toEqual(A.result);expect(reviewCacheStats().verifiedCacheHits).toBe(stats.verifiedCacheHits+1);
  expect(reviewCacheStats().histories.length).toBeLessThanOrEqual(3);expect(reviewCacheStats().histories.every(h=>h.checkpointCount<=48)).toBe(true);writeFileSync('docs/qa/cache-observations.json',JSON.stringify({first:first.work,warm:warm.work,exactSourceWarmPinMs:pinMs,stats:reviewCacheStats(),scope:'Observed candidate workload; no general performance guarantee'},null,2));
 },30000);
 it('reports substep cursor commitment rather than pretending the requested time was advanced',async()=>{const x=await seekSwingbyRun(partial,.125,fast);expect(x.cursor.requestedTimeSeconds).toBe(.125);expect(x.cursor.committedTimeSeconds).toBe(0);expect((x.renderDto as any).physical.elapsedSeconds).toBe(0);});
 it('rejects hash changes, unknown fields, oversized UTF8, drafts and fake checkpoints before replacing anything',async()=>{
  expect(()=>validateSource({...zero.source,extra:true})).toThrow();expect(()=>validateSource({...zero.source,engineSaveText:zeroText+' '})).toThrowError('SOURCE_HASH_MISMATCH');expect(()=>validateSource({...zero.source,engineSaveText:'가'.repeat(800000)})).toThrow();
  const bad=JSON.parse(zeroText);bad.checkpoint.energyWh+=1;const text=JSON.stringify(bad);await expect(verifySwingbySource({...zero.source,engineSaveText:text,engineSaveSha256:hashText(text),engineSaveUtf8Bytes:new TextEncoder().encode(text).length},fast)).rejects.toThrow();
  const draft=serializeSwingbySave(makeSwingbySave(createSwingbyPlan(),createSwingbyDesign()));await expect(pinSwingbyRun(draft,{runId:'draft',displayName:'draft'},fast)).rejects.toThrowError('ACTUAL_RUN_REQUIRED');
  await expect(verifySwingbySource({...zero.source,capture:{...zero.source.capture,committedTimeSeconds:1,requestedTimeSeconds:1}},fast)).rejects.toThrowError('CAPTURE_TIME_MISMATCH');
 });
 it('cancels strict replay before any verified run can be adopted',async()=>{let cancelled=false;await expect(verifySwingbySource({...A.source,engineSaveText:A.source.engineSaveText+' ',engineSaveSha256:hashText(A.source.engineSaveText+' '),engineSaveUtf8Bytes:A.source.engineSaveUtf8Bytes+1},{batchSteps:1,progress:()=>{cancelled=true;},cancelled:()=>cancelled,yieldControl:async()=>{}})).rejects.toThrowError('REVIEW_CANCELLED');});
});
class MemoryAtomicStore implements AtomicReviewStore {
 snapshot:ArchiveSnapshot={revision:0,text:null};fail=false;
 async read(){return structuredClone(this.snapshot);}
 async replace(expected:number,pair:ReviewPair){if(this.fail)throw new ReviewError('QUOTA');if(this.snapshot.revision!==expected)throw new ReviewError('ARCHIVE_CONFLICT');this.snapshot={revision:expected+1,text:JSON.stringify(pair)};return structuredClone(this.snapshot);}
}
describe('isolated archive transactions',()=>{
 it('strictly imports actual pair source bytes; invalid imports and transaction abort preserve previous A',async()=>{
  const store=new MemoryAtomicStore(),archive=new ReviewArchive(store),pair=makeReviewPair(zero),first=await archive.importAndPersist(pair.text,fast);expect(first.persisted).toBe(true);const before=store.snapshot.text;
  const bad=JSON.parse(pair.text);bad.baseline.engineSaveText+=' ';await expect(archive.importAndPersist(JSON.stringify(bad),fast)).rejects.toThrow();expect(store.snapshot.text).toBe(before);
  store.fail=true;const failed=await archive.importAndPersist(pair.text,fast);expect(failed.persisted).toBe(false);expect(failed.error).toBe('QUOTA');expect(store.snapshot.text).toBe(before);expect(failed.prepared.text).toBe(pair.text);
 });
 it('blocked storage still leaves a verified downloadable candidate without claiming storage success',async()=>{
  const store:AtomicReviewStore={read:async()=>{throw new ReviewError('STORAGE_UNAVAILABLE');},replace:async()=>{throw Error('must not write');}};const result=await new ReviewArchive(store).importAndPersist(makeReviewPair(zero).text,fast);expect(result.persisted).toBe(false);expect(result.error).toBe('STORAGE_UNAVAILABLE');expect(result.prepared.baseline.result).toEqual(zero.result);
 });
 it('newer import/cancel supersedes older detached replay, keeping the prior index',async()=>{
  const store=new MemoryAtomicStore(),archive=new ReviewArchive(store);await archive.importAndPersist(makeReviewPair(zero).text,fast);const before=store.snapshot.text;let entered!:()=>void;const gate=new Promise<void>(r=>entered=r);const pending=archive.importAndPersist(JSON.stringify({...makeReviewPair(A).pair,baseline:{...A.source,engineSaveText:A.source.engineSaveText+'  ',engineSaveSha256:hashText(A.source.engineSaveText+'  '),engineSaveUtf8Bytes:A.source.engineSaveUtf8Bytes+2}}),{batchSteps:1,progress:()=>entered()});await gate;archive.cancel();await expect(pending).rejects.toThrowError('REVIEW_CANCELLED');expect(store.snapshot.text).toBe(before);
 });
 it('rejects archive parent/duplicate IDs and unsupported family instead of guessing an adapter',async()=>{const raw=JSON.parse(makeReviewPair(zero).text);raw.parentRunId='elsewhere';await expect(importReviewPair(JSON.stringify(raw),fast)).rejects.toThrowError('ARCHIVE_PARENT');raw.parentRunId=zero.source.runId;raw.baseline.missionFamily='m03-transfer';await expect(importReviewPair(JSON.stringify(raw),fast)).rejects.toThrowError('MODEL_UNSUPPORTED');});
});
