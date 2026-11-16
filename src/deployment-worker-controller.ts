import {
 compileDeploymentCraft,validateDeploymentCraft,createDeploymentRuntime,advanceDeployment,
 getDeploymentGeometry,getDeploymentTelemetry,getDeploymentResult,validateDeploymentPlan,
 validateDeploymentNumerics,DEFAULT_DEPLOYMENT_NUMERICS,initialJointStates,resolveDeploymentGeometry,
 evaluateJointSweep,makeDeploymentSave,serializeDeploymentSave,createDeploymentReplay,
 DEPLOYMENT_IDENTITY,COMMISSIONING_ENVIRONMENT,
 commissioningMount,hasDeploymentPendingDrain,getDeploymentAdvanceLimit,
} from './deployment';
import type {DeploymentCraft,CompiledDeploymentCraft,DeploymentPlan,DeploymentNumerics,DeploymentRuntime,JointStates} from './deployment';
import {canonicalOperationsJson,operationsSha256} from './transfer/operations-codec';
import {BUSES,HARDWARE_MODELS} from './hardware/catalog';
import {rotate} from './deployment/math';
import type {Face} from './sim/types';
import type {DeploymentCraftView,DeploymentMountPlane} from './render/deployment-scene-types';

type Post=(message:Record<string,unknown>)=>void;
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
/** Candidate browser controller. Domain owns every mechanism/energy/orbit step;
 * this module owns cancellation, immutable draft identities and UI snapshots. */
export function createDeploymentController(send:Post){
 let requestId=-1,controlEpoch=0,generation=0,forecastGeneration=0;
 let craft:DeploymentCraft|null=null,plan:DeploymentPlan|null=null,compiled:CompiledDeploymentCraft|null=null;
 let numerics:DeploymentNumerics=structuredClone(DEFAULT_DEPLOYMENT_NUMERICS),runtime:DeploymentRuntime|null=null;
 let acceptedHash:string|null=null,revision=-1,activeTask:'advance'|'restore'|null=null;
 let initialPreview:DeploymentRuntime|null=null;
 let replay:ReturnType<typeof createDeploymentReplay>|null=null;
 let previewId=-1;
 let forecastId=-1;
 let lastBarrier:{epoch:number;key:string;response:string}|null=null;
 const post=(message:Record<string,unknown>)=>send({requestId,controlEpoch,...message});
 const identity=()=>craft&&plan?operationsSha256(canonicalOperationsJson({identity:DEPLOYMENT_IDENTITY,craft,plan,numerics})):null;
 function interrupt(){generation++;forecastGeneration++;replay?.cancel();replay=null;activeTask=null;if(runtime)runtime.requestedTime=runtime.time;}
 function begin(id:number){if(id<=requestId)return false;interrupt();requestId=id;controlEpoch=0;previewId=forecastId=-1;lastBarrier=null;return true;}
 function barrier(m:any,response:string){
  if(m.controlEpoch<1||m.controlEpoch<controlEpoch)return false;
  const key=JSON.stringify([m.type,m.inputHash??null,m.targetTime??null]);
  if(m.controlEpoch===controlEpoch){
   if(lastBarrier?.key===key)snapshot(lastBarrier.response,{duplicate:true});
   else snapshot('error',{operation:m.type,error:'CONTROL_EPOCH_CONFLICT',retainedFlight:!!runtime});
   return false;
  }
  interrupt();controlEpoch=m.controlEpoch;lastBarrier={epoch:controlEpoch,key,response};return true;
 }
 const viewOf=(state:DeploymentRuntime)=>({state,geometry:getDeploymentGeometry(state),telemetry:getDeploymentTelemetry(state),result:state.status==='running'?null:getDeploymentResult(state)});
 const snapshot=(type:string,extra:Record<string,unknown>={})=>post({type,...(runtime?viewOf(runtime):{state:null,geometry:null,telemetry:null,result:null}),...extra});
 function draftView(){
  if(!craft||!plan||!compiled||!initialPreview)return null;
  return {craft,plan,numerics,revision,inputHash:acceptedHash,identity:DEPLOYMENT_IDENTITY,topology:compiled.topology.definition,
   craftView:craftView(compiled,acceptedHash??'unaccepted'),
   devices:compiled.devices.map(d=>({id:d.id,kind:d.kind,deployJointOrder:d.deployJointOrder})),
   initial:viewOf(initialPreview),launchable:!!acceptedHash&&initialPreview.status==='running',issues:initialPreview.events,
   metrics:{massKg:compiled.massKg,cost:compiled.cost,budget:560,batteryWh:compiled.batteryWh,stowedDiameterM:compiled.stowedDiameterM,stowedHeightM:compiled.stowedHeightM,connections:compiled.connections,driveCertificates:compiled.driveCertificates}};
 }
 function craftView(c:CompiledDeploymentCraft,sourceId:string):DeploymentCraftView{
  const bus=BUSES['pathfinder-d35-v1'],mountPlanes:DeploymentMountPlane[]=[];
  const partMounts=c.craft.parts.map(part=>{
   const internal=part.definition.catalog==='hardware-2.0.0'?HARDWARE_MODELS[part.definition.modelId].internal===true:part.definition.modelId==='mechanism-controller-v1';
   const allowedFaces:Face[]=internal?['py']:['px','nx','py','ny','pz','nz'];
   for(const face of allowedFaces){
    const pose=commissioningMount({...part,face,u:0,v:0,rotation:0}),axisUBody=rotate(pose.quaternion,[1,0,0]),axisVBody=rotate(pose.quaternion,[0,1,0]);
    const extent=(axis:number[])=>axis.reduce((sum,n,i)=>sum+Math.abs(n)*bus.halfSize[i],0);
    const u=internal?Math.min(.6,bus.bay.max[0],-bus.bay.min[0]):Math.min(.6,extent(axisUBody));
    const v=internal?Math.min(.75,bus.bay.max[2],-bus.bay.min[2]):Math.min(.75,extent(axisVBody));
    mountPlanes.push({partId:part.id,face,originBodyM:pose.positionM,normalBody:rotate(pose.quaternion,[0,0,1]),axisUBody,axisVBody,minimumU:-u,maximumU:u,minimumV:-v,maximumV:v});
   }
   return {partId:part.id,face:part.face,u:part.u,v:part.v,rotation:part.rotation,allowedFaces};
  });
  return {sourceId,topology:c.topology.definition,geometry:resolveDeploymentGeometry(c.topology,initialJointStates(c.topology),Math.max(0,revision)),mountPlanes,partMounts};
 }
 const canAdvance=(s:DeploymentRuntime)=>s.status==='running'||hasDeploymentPendingDrain(s);
 const risks=(s:DeploymentRuntime)=>({fatal:s.fatalAtSeconds,safe:s.safeMode,phases:Object.fromEntries(Object.entries(s.mechanisms).map(([id,m])=>[id,m.phase]))});
 function newRisk(before:ReturnType<typeof risks>,s:DeploymentRuntime){
  if(before.fatal===null&&s.fatalAtSeconds!==null)return 'POWER_LOSS';
  if(before.fatal!==null)return null;
  if(!before.safe&&s.safeMode)return 'SAFE_MODE';
  for(const [id,m] of Object.entries(s.mechanisms))if(before.phases[id]!==m.phase&&['waiting-power','blocked-clearance'].includes(m.phase))return `${m.phase}:${id}`;
  return null;
 }
 async function drain(target:number){
  const state=runtime;if(!state||!canAdvance(state)){snapshot('runtime');return;}
  if(!Number.isFinite(target)||target<state.time||target>getDeploymentAdvanceLimit(state))throw Error('INVALID_ADVANCE_TARGET');
  const token=++generation,session=requestId,epoch=controlEpoch;activeTask='advance';let interruptedBy:string|null=null;
  const current=()=>token===generation&&session===requestId&&epoch===controlEpoch&&runtime===state;
  while(current()&&canAdvance(state)&&state.time<target-1e-10){
   let moved=false;
   for(let n=0;n<64&&canAdvance(state)&&state.time<target-1e-10;n++){
    const before=risks(state),tick=state.tick;
    advanceDeployment(state,Math.max(0,target-state.requestedTime),1);
    moved ||= state.tick!==tick;interruptedBy=newRisk(before,state);
    if(interruptedBy||state.tick===tick)break;
   }
   if(interruptedBy||!moved)break;
   if(canAdvance(state)&&state.time<target-1e-10){snapshot('runtime-progress',{targetTime:target});await yieldTask();}
  }
  if(current()){activeTask=null;if(interruptedBy)state.requestedTime=state.time;snapshot('runtime',{targetTime:target,automaticPause:interruptedBy});}
 }
 async function handle(m:any){
  if(!m||!Number.isSafeInteger(m.requestId)||m.requestId<0||!Number.isSafeInteger(m.controlEpoch)||m.controlEpoch<0||typeof m.type!=='string')return;
  try{
   if(m.type==='evaluate'){
    if(!begin(m.requestId))return;acceptedHash=null;
    const nextCraft=validateDeploymentCraft(m.craft),nextPlan=validateDeploymentPlan(m.plan),nextNumerics=validateDeploymentNumerics(m.numerics??DEFAULT_DEPLOYMENT_NUMERICS),nextCompiled=compileDeploymentCraft(nextCraft);
    if(!Number.isSafeInteger(m.revision)||m.revision<0)throw Error('INVALID_DRAFT_REVISION');
    const initial=createDeploymentRuntime(nextCraft,nextPlan,nextNumerics);
    craft=nextCraft;plan=nextPlan;numerics=nextNumerics;compiled=nextCompiled;runtime=null;initialPreview=initial;revision=m.revision;
    acceptedHash=identity();post({type:'evaluated',draft:draftView()});return;
   }
   if(m.type==='restore'){
    if(!begin(m.requestId))return;const candidate=createDeploymentReplay(m.text);replay=candidate;activeTask='restore';const token=generation,session=requestId;
    while(candidate.progress.status==='running'){
     if(token!==generation||session!==requestId){candidate.cancel();return;}
     candidate.step(64);
     if(candidate.progress.status==='running'){post({type:'restore-progress',...candidate.progress});await yieldTask();}
    }
    if(token!==generation||session!==requestId||candidate.progress.status!=='complete')return;
    const loaded=candidate.result(),nextCompiled=compileDeploymentCraft(loaded.craft);
    craft=loaded.craft;plan=loaded.plan;numerics=loaded.numerics;runtime=loaded.runtime??null;compiled=nextCompiled;initialPreview=createDeploymentRuntime(craft,plan,numerics);acceptedHash=identity();revision++;
    replay=null;activeTask=null;snapshot('restored',{draft:draftView()});return;
   }
   if(m.requestId!==requestId)return;
   if(!['pause','cancel-restore','launch','step'].includes(m.type)&&m.controlEpoch!==controlEpoch)return;
   if(m.type==='save'){
    if(m.controlEpoch!==controlEpoch||activeTask)throw Error('SAVE_REQUIRES_PAUSE');
    if(!craft||!plan)throw Error('NO_DRAFT');if(!acceptedHash)throw Error('DRAFT_NOT_ACCEPTED');const save=makeDeploymentSave(craft,plan,runtime??undefined,numerics);
    post({type:'save-snapshot',saveId:m.saveId,save,text:serializeDeploymentSave(save)});return;
   }
   if(m.type==='pause'||m.type==='cancel-restore'){
    const response=m.type==='pause'?'paused':'restore-cancelled';if(!barrier(m,response))return;snapshot(response,{draft:draftView()});return;
   }
   if(activeTask==='restore')return;
   if(m.type==='preview-sequence'){
    if(runtime||!compiled||!plan||!acceptedHash||m.sourceId!==acceptedHash||!Number.isSafeInteger(m.previewId))throw Error('PREVIEW_UNAVAILABLE');
    if(m.previewId<=previewId)return;previewId=m.previewId;
    const states=initialJointStates(compiled.topology),steps:Record<string,unknown>[]=[];
    // Static commanded order only: deadlines, power, attitude and latch timing
    // remain the separate authoritative flight/forecast calculation.
    for(const action of plan.actions){const device=compiled.devices.find(d=>d.id===action.partId);if(!device)continue;
     const order=action.desired==='deployed'?device.deployJointOrder:device.deployJointOrder.slice().reverse();
     for(const id of order){const joint=compiled.topology.definition.joints.find(j=>j.id===id)!,target=action.desired==='deployed'?joint.deployedRad:joint.stowedRad;
      const report=evaluateJointSweep(compiled.topology,states,id,target);steps.push({actionId:action.id,partId:action.partId,jointId:id,fromAngleRad:states[id].angleRad,targetAngleRad:target,status:report.status});
      if(report.status!=='clear'){const witness=report.firstWitness??report.firstUncertainWitness,at=structuredClone(states);if(witness)at[witness.jointId].angleRad=witness.sampleAngleRad;
       post({type:'sequence-preview',previewId:m.previewId,sourceId:acceptedHash,authority:'editor-preview-only',steps,clearance:report,geometry:resolveDeploymentGeometry(compiled.topology,at,m.previewId),witness:!!witness});return;
      }
      states[id].angleRad=target;
     }
    }
    post({type:'sequence-preview',previewId:m.previewId,sourceId:acceptedHash,authority:'editor-preview-only',steps,clearance:null,geometry:resolveDeploymentGeometry(compiled.topology,states,m.previewId),witness:false});return;
   }
   if(m.type==='preview-placement'){
    if(runtime||!craft||!compiled||!acceptedHash||m.sourceId!==acceptedHash||!Number.isSafeInteger(m.previewId))throw Error('PREVIEW_UNAVAILABLE');
    if(m.previewId<=previewId)return;previewId=m.previewId;
    const candidate=structuredClone(craft),part=candidate.parts.find(p=>p.id===m.partId);if(!part)throw Error('UNKNOWN_PREVIEW_PART');
    part.face=m.face;part.u=m.u;part.v=m.v;part.rotation=m.rotation;
    const next=compileDeploymentCraft(candidate),candidateSourceId=operationsSha256(canonicalOperationsJson({identity:DEPLOYMENT_IDENTITY,craft:next.craft,plan,numerics}));
    post({type:'placement-preview',previewId:m.previewId,sourceId:acceptedHash,candidateSourceId,changedPartIds:[part.id],authority:'editor-candidate-only',topology:next.topology.definition,geometry:resolveDeploymentGeometry(next.topology,initialJointStates(next.topology),m.previewId),issues:next.issues});return;
   }
   if(m.type==='preview-hinge'){
    if(runtime||!compiled||!acceptedHash||m.sourceId!==acceptedHash||!Number.isSafeInteger(m.previewId))throw Error('PREVIEW_UNAVAILABLE');if(m.previewId<=previewId)return;previewId=m.previewId;
    const states=initialJointStates(compiled.topology),angles=m.angles;
    if(!angles||typeof angles!=='object'||Array.isArray(angles)||Object.keys(angles).some(id=>!Object.hasOwn(states,id)))throw Error('INVALID_PREVIEW_JOINTS');
    for(const joint of compiled.topology.definition.joints){const angle=angles[joint.id]??states[joint.id].angleRad;if(!Number.isFinite(angle)||angle<joint.minimumRad||angle>joint.maximumRad)throw Error('INVALID_PREVIEW_ANGLE');states[joint.id]={angleRad:angle,rateRadS:0};}
    const joint=compiled.topology.definition.joints.find(j=>j.id===m.jointId);if(!joint||!Number.isFinite(m.targetAngleRad)||m.targetAngleRad<joint.minimumRad||m.targetAngleRad>joint.maximumRad)throw Error('INVALID_PREVIEW_ANGLE');
    const report=evaluateJointSweep(compiled.topology,states,joint.id,m.targetAngleRad);
    const destination:JointStates=structuredClone(states);destination[joint.id].angleRad=m.targetAngleRad;
    const witness=report.firstWitness??report.firstUncertainWitness;let witnessGeometry=null;
    if(witness){const at:JointStates=structuredClone(states);at[witness.jointId].angleRad=witness.sampleAngleRad;witnessGeometry=resolveDeploymentGeometry(compiled.topology,at,m.previewId);}
    post({type:'hinge-preview',previewId:m.previewId,sourceId:acceptedHash,authority:'editor-preview-only',angles:Object.fromEntries(Object.entries(destination).map(([id,s])=>[id,s.angleRad])),geometry:resolveDeploymentGeometry(compiled.topology,destination,m.previewId),clearance:report,witnessGeometry});return;
   }
   if(m.type==='launch'){
    if(m.controlEpoch<=controlEpoch){barrier(m,'launched');return;}
    if(runtime||!craft||!plan||!acceptedHash||m.inputHash!==acceptedHash)throw Error('LAUNCH_NOT_ACCEPTED');
    const candidate=createDeploymentRuntime(craft,plan,numerics);if(candidate.status!=='running')throw Error('LAUNCH_BLOCKED');if(!barrier(m,'launched'))return;runtime=candidate;snapshot('launched');return;
   }
   if(m.type==='advance'){
    if(m.controlEpoch!==controlEpoch||activeTask||!runtime)return;await drain(m.targetTime);return;
   }
   if(m.type==='step'){
    if(!runtime||!barrier(m,'runtime'))return;await drain(Math.min(getDeploymentAdvanceLimit(runtime),runtime.time+60));return;
   }
   if(m.type==='forecast'){
    if(runtime||!craft||!plan||!acceptedHash)throw Error('FORECAST_UNAVAILABLE');
    if(!Number.isSafeInteger(m.forecastId)||m.forecastId<=forecastId||m.inputHash!==acceptedHash)throw Error('INVALID_FORECAST_REQUEST');forecastId=m.forecastId;
    const state=createDeploymentRuntime(craft,plan,numerics),hash=acceptedHash,token=++forecastGeneration,session=requestId;
    while(canAdvance(state)){
     if(token!==forecastGeneration||session!==requestId||runtime||acceptedHash!==hash)return;
     const tick=state.tick,status=state.status;advanceDeployment(state,Math.max(0,getDeploymentAdvanceLimit(state)-state.requestedTime),64);
     if(canAdvance(state)){if(state.tick===tick&&state.status===status)throw Error('FORECAST_NO_PROGRESS');post({type:'forecast-progress',forecastId:m.forecastId,inputHash:hash,timeSeconds:state.time});await yieldTask();}
    }
    if(token===forecastGeneration&&session===requestId&&!runtime&&acceptedHash===hash)post({type:'forecast',forecastId:m.forecastId,inputHash:hash,result:getDeploymentResult(state)});return;
   }
   if(m.type==='cancel-forecast'){if(m.forecastId!==forecastId)return;forecastGeneration++;post({type:'forecast-cancelled',forecastId:m.forecastId});return;}
  }catch(error){
   if(m.requestId!==requestId)return;const restoring=m.type==='restore';if(restoring){replay?.cancel();replay=null;activeTask=null;}
   if(m.type==='advance'||m.type==='step'){generation++;activeTask=null;if(runtime)runtime.requestedTime=runtime.time;}
   post({type:'error',operation:m.type,requestedControlEpoch:m.controlEpoch,error:error instanceof Error?error.message:String(error),...(m.type==='save'?{saveId:m.saveId}:{}),...(m.type.startsWith('preview-')?{previewId:m.previewId}:{}),...(m.type==='forecast'?{forecastId:m.forecastId}:{}),retainedFlight:!!runtime,...(restoring?{draft:draftView(),...(runtime?viewOf(runtime):{})}:{})});
  }
 }
 return {handle,dispose(){interrupt();runtime=craft=plan=compiled=initialPreview=null;acceptedHash=null;},getState(){return {requestId,controlEpoch,revision,acceptedHash,activeTask,hasFlight:!!runtime};}};
}
