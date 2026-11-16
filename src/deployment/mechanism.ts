import type {ActuatorProfile,JointStates,MechanismAction,MechanismState} from './types';
import type {ArticulatedDevice} from './devices';
import type {CompiledTopology} from './kinematics';
import type {ClearanceReport} from './types';
import {ACTUATOR_PROFILES} from './devices';
import {initialJointStates} from './kinematics';
import {DeploymentError} from './math';
import {evaluateJointSweep} from './clearance';
import {planPassiveBrake,planPoweredMove,sampleJointMotion,type JointMotion} from './motion';
export interface DeviceMechanismState extends MechanismState {
 timeSeconds:number;action:MechanismAction|null;motion:JointMotion|null;motionElapsedSeconds:number;driveProfileId:string|null;
 remainingReleaseSeconds:number;resumePhase:'releasing'|'moving'|'verifying-latch'|null;
 stopReason:'POWER_LOSS'|'ATTITUDE_HOLD'|'ACTION_EXPIRED'|'RETARGETED'|null;
 clearance:ClearanceReport|null;blockedAtEnd:boolean;
}
export interface MechanismEvent {timeSeconds:number;partId:string;code:'ACTION_STARTED'|'RELEASED'|'MOTION_STARTED'|'BRAKE_STARTED'|'BRAKE_STOPPED'|'WAITING_POWER'|'WAITING_ATTITUDE'|'LATCH_VERIFYING'|'LATCH_VERIFIED'|'CLEARANCE_STOP'|'ACTION_EXPIRED';jointId?:string}
export interface MechanismStepEnvironment {
 /** EPS headroom available to this one physical actuator channel. */
 powerAvailableW:number;energyAvailableJ:number;attitudeAllowed:boolean;
 /** Formal launches must already reject known unsafe paths. A labelled ground
  * test may advance to the certified safe prefix and brake before contact. */
 allowClearanceStop:boolean;
 /** Required when the compiled craft contains other articulated devices. Their
  * actual poses remain fixed during this one-channel interval. */
 otherJointStates?:JointStates;
}
export interface MechanismStep {state:DeviceMechanismState;consumedEnergyJ:number;events:MechanismEvent[]}
const closeContacts=(s:DeviceMechanismState,d:ArticulatedDevice)=>{s.powerContactClosed=s.mechanicalLatch&&s.desired==='deployed'&&d.kind==='solar';s.rfContactClosed=s.mechanicalLatch&&s.desired==='deployed'&&d.kind==='rf';};
export function initialMechanismState(device:ArticulatedDevice,compiled:CompiledTopology,timeSeconds=0):DeviceMechanismState {if(!Number.isFinite(timeSeconds)||timeSeconds<0)throw new DeploymentError('INVALID_MECHANISM_TIME');const all=initialJointStates(compiled),own=Object.fromEntries(compiled.definition.joints.filter(j=>j.partId===device.id).map(j=>[j.id,all[j.id]])),fixed=Object.keys(own).length===0;return {partId:device.id,phase:fixed?'deployed-latched':'stowed-latched',desired:fixed?'deployed':'stowed',jointStates:own,actionId:null,activeJointId:null,remainingVerificationSeconds:0,mechanicalLatch:true,powerContactClosed:fixed&&device.kind==='solar',rfContactClosed:fixed&&device.kind==='rf',motorEnergyJ:0,phaseStartedAt:timeSeconds,reasonCode:null,timeSeconds,action:null,motion:null,motionElapsedSeconds:0,driveProfileId:null,remainingReleaseSeconds:0,resumePhase:null,stopReason:null,clearance:null,blockedAtEnd:false};}
function validateAction(action:MechanismAction,state:DeviceMechanismState){if(!action||typeof action.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,63}$/.test(action.id)||action.partId!==state.partId||!['stowed','deployed'].includes(action.desired)||![action.earliestSeconds,action.deadlineSeconds].every(Number.isFinite)||action.earliestSeconds<0||action.deadlineSeconds<=action.earliestSeconds||!Object.hasOwn(ACTUATOR_PROFILES,action.rateProfileId))throw new DeploymentError('INVALID_MECHANISM_ACTION');}
/** An authoritative preloaded command boundary. It does not move the hinge or
 * spend time/energy; finite release/braking begins on a committed interval. */
export function beginMechanismAction(state:DeviceMechanismState,action:MechanismAction):DeviceMechanismState {validateAction(action,state);if(state.actionId===action.id){if(JSON.stringify(state.action)!==JSON.stringify(action))throw new DeploymentError('ACTION_ID_CONFLICT');return structuredClone(state);}if(state.timeSeconds<action.earliestSeconds||state.timeSeconds>=action.deadlineSeconds)throw new DeploymentError('ACTION_TIME_RANGE');const s=structuredClone(state);s.action=structuredClone(action);s.actionId=action.id;s.desired=action.desired;s.reasonCode=null;s.clearance=null;s.blockedAtEnd=false;s.stopReason=s.activeJointId&&Math.abs(s.jointStates[s.activeJointId].rateRadS)>1e-14?'RETARGETED':null;if(['expired','blocked-clearance','waiting-power','waiting-attitude'].includes(s.phase)){s.phase='paused';s.resumePhase=null;s.motion=null;}if(s.mechanicalLatch&&s.phase!==(s.desired==='deployed'?'deployed-latched':'stowed-latched')){s.phase='releasing';s.phaseStartedAt=s.timeSeconds;s.remainingReleaseSeconds=ACTUATOR_PROFILES[action.rateProfileId].releaseSeconds;s.powerContactClosed=false;s.rfContactClosed=false;}return s;}
function profile(s:DeviceMechanismState):ActuatorProfile {return ACTUATOR_PROFILES[s.action?.rateProfileId??'normal'];}
export function mechanismPowerDemandW(s:DeviceMechanismState):number {if(!s.action)return 0;const p=profile(s),phase=s.phase==='waiting-power'||s.phase==='waiting-attitude'?s.resumePhase:s.phase;return phase==='releasing'?p.releasePowerW:phase==='moving'?p.activePowerW:phase==='verifying-latch'?p.latchPowerW:0;}
/** Pure local transition kernel. Environment is held over the supplied interval;
 * the mission runtime must cut intervals at external EPS/operation/eclipse
 * boundaries. It subdivides all intrinsic acceleration/latch/energy events. */
export function advanceMechanism(input:DeviceMechanismState,device:ArticulatedDevice,compiled:CompiledTopology,dt:number,environment:MechanismStepEnvironment):MechanismStep {
 if(!Number.isFinite(dt)||dt<0||dt>3600||!Number.isFinite(environment.powerAvailableW)||environment.powerAvailableW<0||!Number.isFinite(environment.energyAvailableJ)||environment.energyAvailableJ<0)throw new DeploymentError('INVALID_MECHANISM_STEP');
 if(compiled.definition.joints.some(j=>j.partId!==device.id)&&!environment.otherJointStates)throw new DeploymentError('MISSING_ACTUAL_JOINT_CONTEXT');
 const s=structuredClone(input),events:MechanismEvent[]=[],end=s.timeSeconds+dt;let energyLeft=environment.energyAvailableJ,transitions=0;const event=(code:MechanismEvent['code'])=>events.push({timeSeconds:s.timeSeconds,partId:s.partId,code,...(s.activeJointId?{jointId:s.activeJointId}:{})}),phase=(next:DeviceMechanismState['phase'])=>{s.phase=next;s.phaseStartedAt=s.timeSeconds;},powered=(watts:number)=>watts<=environment.powerAvailableW+1e-12&&(watts===0||energyLeft>1e-12);
 const brake=(reason:DeviceMechanismState['stopReason'])=>{if(!s.activeJointId)throw new DeploymentError('INVALID_MECHANISM_STATE');const joint=s.jointStates[s.activeJointId],motion=planPassiveBrake(joint.angleRad,joint.rateRadS,ACTUATOR_PROFILES[s.driveProfileId??profile(s).id]),definition=compiled.definition.joints.find(j=>j.id===s.activeJointId)!;if(motion.targetAngleRad<definition.minimumRad-1e-10||motion.targetAngleRad>definition.maximumRad+1e-10)throw new DeploymentError('BRAKE_OUTSIDE_JOINT_RANGE');s.motion=motion;s.motionElapsedSeconds=0;s.stopReason=reason;s.mechanicalLatch=false;s.powerContactClosed=false;s.rfContactClosed=false;phase('braking');event('BRAKE_STARTED');};
 const wait=(reason:'POWER_LOSS'|'ATTITUDE_HOLD',resume:'releasing'|'moving'|'verifying-latch')=>{s.resumePhase=resume;s.reasonCode=reason;if(resume==='verifying-latch')s.remainingVerificationSeconds=profile(s).latchSeconds;phase(reason==='POWER_LOSS'?'waiting-power':'waiting-attitude');event(reason==='POWER_LOSS'?'WAITING_POWER':'WAITING_ATTITUDE');};
 while(s.timeSeconds<end-1e-12){if(++transitions>256)throw new DeploymentError('MECHANISM_TRANSITION_LIMIT');const p=profile(s);if(!s.action||s.mechanicalLatch&&s.phase===(s.desired==='deployed'?'deployed-latched':'stowed-latched')||s.phase==='blocked-clearance'){s.timeSeconds=end;break;}
  if(s.timeSeconds>=s.action.deadlineSeconds&&s.phase!=='expired'&&s.phase!=='braking'){if(s.activeJointId&&Math.abs(s.jointStates[s.activeJointId].rateRadS)>1e-14)brake('ACTION_EXPIRED');else{phase('expired');s.reasonCode='ACTION_EXPIRED';event('ACTION_EXPIRED');}}
  if(s.stopReason==='RETARGETED'&&s.phase!=='braking'){if(s.activeJointId&&Math.abs(s.jointStates[s.activeJointId].rateRadS)>1e-14)brake('RETARGETED');else s.stopReason=null;}
  if(s.phase==='expired'){s.timeSeconds=end;break;}
  if(s.phase==='braking'){
   const remaining=s.motion!.durationSeconds-s.motionElapsedSeconds,step=Math.min(end-s.timeSeconds,remaining);s.motionElapsedSeconds+=step;s.timeSeconds+=step;const sample=sampleJointMotion(s.motion!,s.motionElapsedSeconds);s.jointStates[s.activeJointId!]={angleRad:sample.angleRad,rateRadS:sample.rateRadS};if(sample.complete){event('BRAKE_STOPPED');s.motion=null;s.motionElapsedSeconds=0;const reason=s.stopReason;s.stopReason=null;if(reason==='ACTION_EXPIRED'){phase('expired');s.reasonCode=reason;event('ACTION_EXPIRED');}else if(reason==='POWER_LOSS'||reason==='ATTITUDE_HOLD')wait(reason,'moving');else phase('paused');}continue;
  }
  if(s.phase==='waiting-power'||s.phase==='waiting-attitude'){const demand=mechanismPowerDemandW(s);if(!powered(demand)||!environment.attitudeAllowed){s.timeSeconds=Math.min(end,s.action.deadlineSeconds);continue;}const resume=s.resumePhase;phase(resume??'paused');s.resumePhase=null;s.reasonCode=null;if(resume==='moving')s.motion=null;}
  if(s.phase==='stowed-latched'||s.phase==='deployed-latched'||s.phase==='paused'){
   const order=s.desired==='deployed'?device.deployJointOrder:device.stowJointOrder,next=order.find(id=>{const j=compiled.definition.joints.find(j=>j.id===id)!;return Math.abs(s.jointStates[id].angleRad-(s.desired==='deployed'?j.deployedRad:j.stowedRad))>1e-12;});
   if(!next&&s.mechanicalLatch){closeContacts(s,device);phase(s.desired==='deployed'?'deployed-latched':'stowed-latched');s.timeSeconds=end;break;}
   if(s.mechanicalLatch){s.remainingReleaseSeconds=p.releaseSeconds;s.powerContactClosed=false;s.rfContactClosed=false;phase('releasing');event('ACTION_STARTED');}else if(next){s.activeJointId=next;s.motion=null;phase('moving');}else{s.activeJointId=null;s.remainingVerificationSeconds=p.latchSeconds;phase('verifying-latch');event('LATCH_VERIFYING');}
  }
  if(s.phase==='moving'&&!s.motion){const joint=compiled.definition.joints.find(j=>j.id===s.activeJointId)!,target=s.desired==='deployed'?joint.deployedRad:joint.stowedRad,report=evaluateJointSweep(compiled,{...environment.otherJointStates,...s.jointStates},joint.id,target);s.clearance=report;s.blockedAtEnd=report.status!=='clear';if(s.blockedAtEnd&&!environment.allowClearanceStop)throw new DeploymentError('UNCERTIFIED_DEPLOYMENT_PATH');const stop=s.blockedAtEnd?report.safeThroughAngleRad:target;s.motion=planPoweredMove(s.jointStates[joint.id].angleRad,stop,p);s.motionElapsedSeconds=0;s.driveProfileId=p.id;if(s.motion.durationSeconds===0&&s.blockedAtEnd){phase('blocked-clearance');s.reasonCode='CLEARANCE_STOP';event('CLEARANCE_STOP');s.timeSeconds=end;break;}event('MOTION_STARTED');}
  const demand=mechanismPowerDemandW(s);if(!powered(demand)||!environment.attitudeAllowed){const reason=!powered(demand)?'POWER_LOSS':'ATTITUDE_HOLD',resume=s.phase as 'releasing'|'moving'|'verifying-latch';if(resume==='moving'&&s.activeJointId&&Math.abs(s.jointStates[s.activeJointId].rateRadS)>1e-14)brake(reason);else wait(reason,resume);continue;}
  const ownRemaining=s.phase==='releasing'?s.remainingReleaseSeconds:s.phase==='verifying-latch'?s.remainingVerificationSeconds:s.motion!.durationSeconds-s.motionElapsedSeconds,untilDeadline=s.action.deadlineSeconds-s.timeSeconds,step=Math.min(end-s.timeSeconds,ownRemaining,untilDeadline,demand>0?energyLeft/demand:Infinity),used=demand*step;
  energyLeft=Math.max(0,energyLeft-used);s.motorEnergyJ+=used;s.timeSeconds+=step;
  if(s.phase==='releasing'){s.remainingReleaseSeconds=Math.max(0,s.remainingReleaseSeconds-step);if(s.remainingReleaseSeconds<=1e-12){s.mechanicalLatch=false;phase('paused');event('RELEASED');}}
  else if(s.phase==='verifying-latch'){s.remainingVerificationSeconds=Math.max(0,s.remainingVerificationSeconds-step);if(s.remainingVerificationSeconds<=1e-12){s.mechanicalLatch=true;s.activeJointId=null;s.motion=null;closeContacts(s,device);phase(s.desired==='deployed'?'deployed-latched':'stowed-latched');event('LATCH_VERIFIED');}}
  else if(s.phase==='moving'){s.motionElapsedSeconds+=step;const sample=sampleJointMotion(s.motion!,s.motionElapsedSeconds);s.jointStates[s.activeJointId!]={angleRad:sample.angleRad,rateRadS:sample.rateRadS};if(sample.complete){s.motion=null;s.motionElapsedSeconds=0;if(s.blockedAtEnd){phase('blocked-clearance');s.reasonCode='CLEARANCE_STOP';event('CLEARANCE_STOP');s.timeSeconds=end;break;}phase('paused');}}
 }
 return {state:s,consumedEnergyJ:environment.energyAvailableJ-energyLeft,events};
}
