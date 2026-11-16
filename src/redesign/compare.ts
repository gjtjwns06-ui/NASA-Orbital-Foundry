import type {Compatibility,Comparison,Json,VerifiedRun} from './schema';
import {canonical,freeze,ReviewError} from './validation';
import {semanticChanges} from './semantics';
const trusted=new WeakSet<object>();
/** Adapter-internal authority: consumers cannot turn imported result fields into a run. */
export function markVerified(run:VerifiedRun):VerifiedRun{const immutable=freeze(run);trusted.add(immutable);return immutable;}
export function requireVerified(run:VerifiedRun){if(!trusted.has(run))throw new ReviewError('UNVERIFIED_RUN');}
/** Pure condition audit; comparison itself additionally requires actual replay authority. */
export function comparisonCompatibility(a:VerifiedRun,b:VerifiedRun):Compatibility{
 const blockers:Compatibility['blockers'][number][]=[],changedContext:Compatibility['changedContext'][number][]=[];
 const block=(code:string,before:unknown,after:unknown)=>blockers.push({code,before:(before??null) as Json,after:(after??null) as Json,detail:{ko:'검증된 비교 조건이 같지 않습니다.',en:'The verified comparison conditions differ.'}});
 for(const key of ['modelVersion','adapterId','adapterVersion','engineManifestSha256','hardwareCatalogSha256','scenarioId','scenarioSha256','propulsionProfileSha256','networkModelSha256','ephemerisDatasetId','ephemerisSourceHashes','frame','timeScale','requirementsSha256','numericalPolicySha256'] as const){const x=a.identity[key],y=b.identity[key];if(x===undefined||y===undefined||canonical(x)!==canonical(y))block('IDENTITY_'+key.toUpperCase(),x,y);}
 if(a.source.missionFamily!==b.source.missionFamily)block('MISSION_FAMILY',a.source.missionFamily,b.source.missionFamily);
 if(!a.identity.score||!b.identity.score||canonical(a.identity.score)!==canonical(b.identity.score))block('SCORE_DEFINITION',a.identity.score,b.identity.score);
 for(const key of ['initialEpochJdTdb','initialPhysicalConditionsSha256'] as const)if(canonical(a.identity[key])!==canonical(b.identity[key])){
  if(a.source.missionFamily==='m03-transfer'&&b.source.missionFamily==='m03-transfer')changedContext.push({field:key,before:a.identity[key],after:b.identity[key]});else block('CONTEXT_'+key.toUpperCase(),a.identity[key],b.identity[key]);
 }
 if(a.evaluation.final!==b.evaluation.final)block('FINAL_PARTIAL_MISMATCH',a.evaluation.final,b.evaluation.final);
 if(a.evaluation.completionPolicyId!==b.evaluation.completionPolicyId)block('COMPLETION_POLICY',a.evaluation.completionPolicyId,b.evaluation.completionPolicyId);
 if(!a.evaluation.final&&!b.evaluation.final&&a.evaluation.committedTimeSeconds!==b.evaluation.committedTimeSeconds)block('PARTIAL_TIME',a.evaluation.committedTimeSeconds,b.evaluation.committedTimeSeconds);
 const mode=blockers.length?'blocked':changedContext.length?'contextual-trade-study':'controlled';
 return freeze({mode,evaluationBasis:mode==='blocked'?'incompatible':a.evaluation.final?'same-terminal-policy':'same-committed-time',blockers,changedContext,allowScoreDelta:mode==='controlled',allowMetricDelta:mode==='controlled',allowCommonFrameOverlay:mode!=='blocked'&&a.identity.frame==='ICRF'&&b.identity.frame==='ICRF'});
}
export function compareRuns(a:VerifiedRun,b:VerifiedRun):Comparison{
 requireVerified(a);requireVerified(b);const compatibility=comparisonCompatibility(a,b),deltas:Record<string,number>={};
 if(compatibility.allowMetricDelta){for(const k of ['received','energyMinimumWh','fuelRemainingKg','totalCost','budgetRemaining'] as const)deltas[k]=b.result[k]-a.result[k];if(a.result.score!==null&&b.result.score!==null)deltas.score=b.result.score-a.result.score;deltas.observedDurationSeconds=b.evaluation.committedTimeSeconds-a.evaluation.committedTimeSeconds;}
 return freeze({beforeRunId:a.source.runId,afterRunId:b.source.runId,compatibility,changes:semanticChanges(a,b),deltas:compatibility.allowMetricDelta?deltas:null,warning:{ko:'관찰 기간과 변경된 모든 조건을 함께 보세요. 결과 차이만으로 한 부품이 유일한 원인임을 입증하지 않습니다.',en:'Read the observation durations and all changed conditions together. A result difference alone does not establish one component as the sole cause.'}});
}
