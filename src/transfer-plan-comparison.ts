import type { Design } from './sim/types';
import type { FullTransferPlan, FullTransferSolution, EscapeStageEvaluation } from './transfer/types';
import type { TransferResult } from './transfer/runtime';

export type TransferComparisonStatus = 'empty'|'pending'|'forecasting'|'ready'|'infeasible'|'unlaunchable'|'flight-failed';
export interface TransferComparisonCandidate {
  requestId:number;
  /** Exact submitted editor input, including operations clipped from solution.plan. */
  plan:FullTransferPlan;
  solution:FullTransferSolution;
  evaluation:EscapeStageEvaluation;
  result:TransferResult|null;
}
export interface TransferComparisonFacts {
  arrivalJdTdb:number|null;
  timeOfFlightSeconds:number|null;
  receiptDeadlineJdTdb:number|null;
  receiptDeadlineSeconds:number|null;
  c3Km2S2:number|null;
  stageId:string;
  stageFuelUsedKg:number|null;
  stageFuelRemainingKg:number|null;
  received:number|null;
  required:number|null;
  forecastElapsedSeconds:number|null;
  fullDurationForecast:boolean;
}
export interface TransferComparisonDelta {
  /** Each route retains its own arrival/deadline; these are not equal-time outcomes. */
  arrivalShiftSeconds:number|null;
  timeOfFlightSeconds:number|null;
  receiptDeadlineShiftSeconds:number|null;
  c3Km2S2:number|null;
  stageFuelUsedKg:number|null;
  stageFuelRemainingKg:number|null;
  received:number|null;
}
export interface TransferComparisonInspection {
  status:TransferComparisonStatus;
  requestId:number|null;
  submittedPlan:FullTransferPlan|null;
  currentPlan:FullTransferPlan|null;
  previousPlan:FullTransferPlan|null;
  current:TransferComparisonFacts|null;
  previous:TransferComparisonFacts|null;
  delta:TransferComparisonDelta|null;
  canRestore:boolean;
}

const clone=<T>(value:T):T=>structuredClone(value);
const finite=(value:number|undefined):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
// Canonical keys make plain-object property insertion order irrelevant. Arrays
// retain their order, including operation ordering and exact submitted values.
function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  return value;
}
const key=(value:unknown)=>JSON.stringify(canonical(value));
function fullDuration(candidate:TransferComparisonCandidate):boolean {
  const duration=candidate.solution.durationSeconds,elapsed=candidate.result?.elapsedSeconds;
  return Number.isFinite(duration)&&duration>0&&typeof elapsed==='number'&&Number.isFinite(elapsed)&&elapsed===duration;
}
function facts(candidate:TransferComparisonCandidate):TransferComparisonFacts {
  const {solution:s,evaluation:e,result:r}=candidate,complete=fullDuration(candidate);
  return {
    arrivalJdTdb:finite(s.plan.arrivalPeriapsisJdTdb),timeOfFlightSeconds:finite(s.periapsisSeconds),
    receiptDeadlineJdTdb:finite(s.phaseEvents.find(event=>event.id==='mars-exit')?.jdTdb),receiptDeadlineSeconds:finite(s.durationSeconds),
    c3Km2S2:finite(s.c3Km2S2),stageId:e.stage.id,stageFuelUsedKg:finite(e.fuelUsedKg),stageFuelRemainingKg:finite(e.stageFuelRemainingKg),
    received:complete?finite(r?.received):null,required:finite(r?.required),forecastElapsedSeconds:finite(r?.elapsedSeconds),fullDurationForecast:complete,
  };
}
const difference=(current:number|null,previous:number|null,scale=1)=>current!==null&&previous!==null?(current-previous)*scale:null;
function delta(current:TransferComparisonFacts,previous:TransferComparisonFacts):TransferComparisonDelta {
  return {arrivalShiftSeconds:difference(current.arrivalJdTdb,previous.arrivalJdTdb,86400),timeOfFlightSeconds:difference(current.timeOfFlightSeconds,previous.timeOfFlightSeconds),receiptDeadlineShiftSeconds:difference(current.receiptDeadlineJdTdb,previous.receiptDeadlineJdTdb,86400),c3Km2S2:difference(current.c3Km2S2,previous.c3Km2S2),stageFuelUsedKg:difference(current.stageFuelUsedKg,previous.stageFuelUsedKg),stageFuelRemainingKg:difference(current.stageFuelRemainingKg,previous.stageFuelRemainingKg),received:difference(current.received,previous.received)};
}

/** Session-local editor comparison. Never advances physics, alters a Worker
 * result, restores runtime, or treats a partial solver response as a forecast.
 * Inputs and every outward snapshot are detached; no caller owns stored state. */
export class TransferPlanComparison {
  private state:TransferComparisonStatus='empty';
  private request=-1;
  private craftKey:string|null=null;
  private submitted:FullTransferPlan|null=null;
  private candidate:TransferComparisonCandidate|null=null;
  private accepted:TransferComparisonCandidate|null=null;
  private prior:TransferComparisonCandidate|null=null;

  get status():TransferComparisonStatus{return this.state;}
  get previous():Readonly<TransferComparisonCandidate>|null{return this.prior?clone(this.prior):null;}
  get current():Readonly<TransferComparisonCandidate>|null{return this.candidate?clone(this.candidate):null;}

  begin(requestId:number,plan:FullTransferPlan,craft:Design):void {
    if(!Number.isSafeInteger(requestId)||requestId<0)throw new Error('Comparison request id must be a nonnegative safe integer.');
    if(requestId<=this.request)return;
    const nextCraftKey=key(craft);
    if(this.craftKey!==null&&this.craftKey!==nextCraftKey)this.reset();
    const next=clone(plan),nextKey=key(next);
    // Keep the recoverable original throughout a restore's pending/error
    // states. Only a matching complete forecast removes previous=self.
    const exactRestore=!!this.prior&&key(this.prior.plan)===nextKey;
    if(!exactRestore&&this.accepted&&key(this.accepted.plan)!==nextKey)this.prior=clone(this.accepted);
    this.request=requestId;this.craftKey=nextCraftKey;this.submitted=next;this.candidate=null;this.state='pending';
  }

  solved(requestId:number,solution:FullTransferSolution,evaluation:EscapeStageEvaluation):void {
    if(requestId!==this.request||this.state!=='pending'||!this.submitted)return;
    this.candidate={requestId,plan:clone(this.submitted),solution:clone(solution),evaluation:clone(evaluation),result:null};
    this.state=evaluation.launchable?'forecasting':'unlaunchable';
  }

  finish(requestId:number,result:TransferResult):void {
    if(requestId!==this.request||!this.candidate||this.candidate.result!==null||!['forecasting','unlaunchable'].includes(this.state))return;
    this.candidate.result=clone(result);
    if(!this.candidate.evaluation.launchable){this.state='unlaunchable';return;}
    if(!fullDuration(this.candidate)){this.state='flight-failed';return;}
    // Zero-science at the true end has result.status='failed' in this model;
    // it remains a complete, launchable forecast rather than an early failure.
    this.state='ready';this.accepted=clone(this.candidate);
    if(this.prior&&key(this.prior.plan)===key(this.candidate.plan))this.prior=null;
  }

  reject(requestId:number):void {
    if(requestId!==this.request||!['pending','forecasting','unlaunchable'].includes(this.state))return;
    this.candidate=null;this.state='infeasible';
  }

  reset():void {
    this.state='empty';this.request=-1;this.craftKey=null;this.submitted=null;this.candidate=null;this.accepted=null;this.prior=null;
  }

  restorePlan():FullTransferPlan|null{return this.prior?clone(this.prior.plan):null;}

  inspect():TransferComparisonInspection {
    const current=this.candidate?facts(this.candidate):null,previous=this.prior?facts(this.prior):null;
    return {status:this.state,requestId:this.request<0?null:this.request,submittedPlan:this.submitted?clone(this.submitted):null,currentPlan:this.candidate?clone(this.candidate.plan):null,previousPlan:this.prior?clone(this.prior.plan):null,current,previous,delta:current&&previous?delta(current,previous):null,canRestore:!!this.prior};
  }
}
