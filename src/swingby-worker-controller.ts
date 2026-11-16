import {
  solveSwingbyPlan, createSwingbyRuntime, advanceSwingby,
  getSwingbyTelemetry, getSwingbyResult, getSwingbyTrajectory, getSwingbyVisualTrajectory,
  makeSwingbySave, serializeSwingbySave, createSwingbyReplay, getSwingbyNextEventTime, getSwingbyScenario, localArcStateAt,
} from './swingby';
import type {SwingbyPlan,SwingbySolution,SwingbyRuntime,SwingbyNumerics,SwingbyEvaluation} from './swingby/types';
import type {Design} from './sim/types';
import {TransferControlClock as FlightControlClock} from './transfer-control';

// One authoritative flight. Forecast and restore are detached, bounded jobs;
// camera/render requests have no path into this controller.
const clock=new FlightControlClock();
let plan:SwingbyPlan|null=null,craft:Design|null=null,solution:SwingbySolution|null=null;
let evaluation:SwingbyEvaluation|null=null,runtime:SwingbyRuntime|null=null;
let numerics:SwingbyNumerics={cruiseStepSeconds:300,activeStepSeconds:1};
let generation=0,forecastGeneration=0,taskKind:'advance'|'warp'|'restore'|null=null;
let replay:ReturnType<typeof createSwingbyReplay>|null=null;
let lastBarrier:{epoch:number;key:string;responseType:string}|null=null;
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
const post=(message:Record<string,unknown>)=>self.postMessage({requestId:clock.requestId,controlEpoch:clock.controlEpoch,...message});
const result=()=>runtime&&runtime.status!=='running'?getSwingbyResult(runtime):null;
function snapshot(type='runtime',extra:Record<string,unknown>={}){
  const visual=runtime?getSwingbyVisualTrajectory(runtime):null;
  post({type,state:runtime,telemetry:runtime?getSwingbyTelemetry(runtime):null,result:result(),
    trajectory:visual?.points??null,visualPath:visual?{certified:visual.certified,maxChordErrorKm:visual.maxChordErrorKm,toleranceKm:visual.toleranceKm,anchors:visual.anchors}:null,committedTime:runtime?.time??null,...extra});
}
function interrupt(){
  generation++;forecastGeneration++;replay?.cancel();replay=null;taskKind=null;
  if(runtime)runtime.requestedTime=runtime.time;
}
function begin(requestId:number){
  if(!clock.begin(requestId))return false;
  interrupt();lastBarrier=null;return true;
}
function barrier(m:{requestId:number;controlEpoch:number;type:string;inputHash?:string;targetTime?:number}){
  const key=JSON.stringify([m.type,m.inputHash??null,m.targetTime??null]);
  if(!clock.acceptBarrier(m.requestId,m.controlEpoch,key))return 'rejected';
  if(lastBarrier?.epoch===m.controlEpoch&&lastBarrier.key===key){snapshot(lastBarrier.responseType,{duplicate:true});return 'duplicate';}
  interrupt();lastBarrier={epoch:m.controlEpoch,key,responseType:'runtime'};return 'new';
}
async function drain(targetTime:number,kind:'advance'|'warp'){
  const state=runtime;if(!state||state.status!=='running')return snapshot();
  if(!Number.isFinite(targetTime)||targetTime<state.time)throw new Error('INVALID_ADVANCE_TARGET');
  const token=++generation,id=clock.requestId,epoch=clock.controlEpoch;
  const target=Math.min(targetTime,state.actualPatchExitSeconds);
  taskKind=kind;
  // Demand is absolute, so a repeated UI message cannot add flight time twice.
  advanceSwingby(state,Math.max(0,target-state.requestedTime),500);
  while(state.status==='running'&&state.time<target-1e-8){
    if(token!==generation||!clock.acceptAdvance(id,epoch)||runtime!==state)return;
    snapshot('runtime-progress',{targetTime:target,task:kind});
    await yieldTask();
    if(token!==generation||!clock.acceptAdvance(id,epoch)||runtime!==state)return;
    const before=state.time;
    advanceSwingby(state,0,500);
    // A target between canonical instants may legitimately remain uncommitted.
    // Returning that honest state avoids an endless attempt to force a step.
    if(state.time===before)break;
  }
  if(token===generation&&clock.acceptAdvance(id,epoch)&&runtime===state){taskKind=null;snapshot('runtime',{targetTime:target,task:kind});}
}

self.onmessage=async event=>{
  const m=event.data;if(!m||typeof m!=='object')return;
  try{
    if(m.type==='solve'){
      if(!begin(m.requestId))return;
      const candidatePlan=structuredClone(m.plan) as SwingbyPlan,candidateCraft=structuredClone(m.craft) as Design;
      const answer=solveSwingbyPlan(candidatePlan,candidateCraft);
      // Editing starts a new draft. It cannot alter a launched flight in place.
      plan=candidatePlan;craft=candidateCraft;runtime=null;
      solution=answer.status==='solved'?answer.solution:null;
      evaluation=answer.status==='solved'?answer.evaluation:null;
      if(m.numerics)numerics=structuredClone(m.numerics);
      const initial=solution?createSwingbyRuntime(solution,craft!,numerics):null;
      const visual=solution?getSwingbyVisualTrajectory(solution):null;
      let draftSaveable=false;try{makeSwingbySave(plan,craft!,undefined,numerics);draftSaveable=true;}catch{/* Unvalidated editor input is never represented as a strict save. */}
      post({type:'solved',revision:m.revision,...answer,draftSaveable,
        initial:initial?{attitudeQuaternion:initial.attitudeQuaternion,telemetry:getSwingbyTelemetry(initial)}:null,
        correctionPositionKm:solution?localArcStateAt(solution.arcs[0],solution.correction.time).positionKm:null,
        visualPath:visual?{certified:visual.certified,maxChordErrorKm:visual.maxChordErrorKm,toleranceKm:visual.toleranceKm,anchors:visual.anchors}:null,
        trajectory:visual?.points??null});return;
    }
    if(m.type==='restore'){
      if(!begin(m.requestId))return;
      const id=clock.requestId,token=generation;
      // Retain the paused previous flight until every replay check passes.
      const candidate=createSwingbyReplay(m.text);replay=candidate;taskKind='restore';
      while(candidate.progress.status==='running'){
        if(!clock.sameSession(id)||token!==generation){candidate.cancel();return;}
        candidate.step(500);
        if(candidate.progress.status==='running'){post({type:'restore-progress',...candidate.progress});await yieldTask();}
      }
      if(!clock.sameSession(id)||token!==generation||candidate.progress.status!=='complete')return;
      const restored=candidate.result();
      const answer=solveSwingbyPlan(restored.plan,restored.craft);
      plan=restored.plan;craft=restored.craft;runtime=restored.runtime??null;
      solution=runtime?.solution??(answer.status==='solved'?answer.solution:null);
      evaluation=answer.status==='solved'?answer.evaluation:null;
      numerics=restored.numerics;
      replay=null;taskKind=null;
      const initial=solution?createSwingbyRuntime(solution,craft,numerics):null;
      const predictedVisual=solution?getSwingbyVisualTrajectory(solution):null;
      const actualVisual=runtime?getSwingbyVisualTrajectory(runtime):predictedVisual;
      snapshot('restored',{plan,craft,solution,evaluation,numerics,draftSaveable:true,issues:answer.status==='infeasible'?answer.issues:answer.evaluation.issues,
        initial:initial?{attitudeQuaternion:initial.attitudeQuaternion,telemetry:getSwingbyTelemetry(initial)}:null,
        correctionPositionKm:solution?localArcStateAt(solution.arcs[0],solution.correction.time).positionKm:null,
        predictedTrajectory:predictedVisual?.points??null,
        visualPath:actualVisual?{certified:actualVisual.certified,maxChordErrorKm:actualVisual.maxChordErrorKm,toleranceKm:actualVisual.toleranceKm,anchors:actualVisual.anchors}:null,
        trajectory:actualVisual?.points??null});return;
    }
    if(!clock.sameSession(m.requestId))return;
    if(m.type==='cancel-restore'){
      if(barrier(m)!=='new')return;
      lastBarrier!.responseType='restore-cancelled';snapshot('restore-cancelled',{plan,craft,solution,evaluation,numerics});return;
    }
    if(taskKind==='restore')return;
    if(m.type==='save'){
      if(!plan||!craft)throw Error('NO_DRAFT');
      // Snapshot synchronously; asynchronous browser storage is owned by the UI.
      const save=makeSwingbySave(plan,craft,runtime??undefined,numerics);
      post({type:'save-snapshot',saveId:m.saveId,save,text:serializeSwingbySave(save),committedTime:runtime?.time??null});return;
    }
    if(m.type==='forecast'){
      if(!solution||!craft||runtime||!evaluation?.launchable)throw Error('FORECAST_UNAVAILABLE');
      const id=clock.requestId,token=++forecastGeneration,accepted=solution;
      const preview=createSwingbyRuntime(accepted,craft,numerics);
      // A later burn can move the actual patch time. Demand the immutable
      // scenario deadline and let the domain stop at its actual physical end.
      advanceSwingby(preview,getSwingbyScenario().deadlineSeconds,500);
      while(preview.status==='running'){
        if(!clock.sameSession(id)||token!==forecastGeneration||runtime||solution!==accepted)return;
        post({type:'forecast-progress',inputHash:accepted.inputHash,time:preview.time,endTime:preview.actualPatchExitSeconds});
        await yieldTask();
        if(!clock.sameSession(id)||token!==forecastGeneration||runtime||solution!==accepted)return;
        const before=preview.time;advanceSwingby(preview,0,500);
        if(preview.time===before&&preview.status==='running')throw Error('FORECAST_NO_PROGRESS');
      }
      if(clock.sameSession(id)&&token===forecastGeneration&&!runtime&&solution===accepted)
        post({type:'forecast',inputHash:accepted.inputHash,result:getSwingbyResult(preview)});
      return;
    }
    if(m.type==='cancel-forecast'){forecastGeneration++;post({type:'forecast-cancelled'});return;}
    if(m.type==='launch'){
      if(!solution||!craft||!evaluation?.launchable||m.inputHash!==solution.inputHash)throw Error('LAUNCH_NOT_ACCEPTED');
      const accepted=barrier(m);if(accepted!=='new')return;
      if(runtime)throw Error('FLIGHT_ALREADY_STARTED');
      runtime=createSwingbyRuntime(solution,craft,numerics);lastBarrier!.responseType='launched';snapshot('launched');return;
    }
    if(m.type==='pause'){
      if(barrier(m)!=='new')return;
      lastBarrier!.responseType='paused';snapshot('paused');return;
    }
    if(m.type==='warp'){
      if(!runtime)throw Error('NO_FLIGHT');
      if(barrier(m)!=='new')return;
      const next=getSwingbyNextEventTime(runtime);
      const desired=m.targetTime===undefined?next:m.targetTime;
      if(!Number.isFinite(desired)||desired<runtime.time)throw Error('INVALID_ADVANCE_TARGET');
      // Domain chooses the next physical boundary; a UI target cannot skip it.
      await drain(Math.min(desired,next),'warp');return;
    }
    if(m.type==='advance'){
      if(!runtime||taskKind||!clock.acceptAdvance(m.requestId,m.controlEpoch))return;
      await drain(m.targetTime,'advance');return;
    }
  }catch(error){
    if(!clock.sameSession(m.requestId))return;
    const restoring=m.type==='restore'||taskKind==='restore';
    if(restoring){replay?.cancel();replay=null;taskKind=null;}
    if((m.type==='advance'||m.type==='warp')&&clock.acceptAdvance(m.requestId,m.controlEpoch)){
      generation++;taskKind=null;if(runtime)runtime.requestedTime=runtime.time;
    }
    post({type:'error',operation:m.type,error:error instanceof Error?error.message:String(error),
      ...(m.type==='save'?{saveId:m.saveId}:{}),
      retainedFlight:!!runtime,state:restoring?runtime:undefined,plan:restoring?plan:undefined,
      craft:restoring?craft:undefined,solution:restoring?solution:undefined,
      telemetry:restoring&&runtime?getSwingbyTelemetry(runtime):undefined,
      result:restoring?result():undefined});
  }
};
