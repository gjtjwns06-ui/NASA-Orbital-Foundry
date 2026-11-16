import type {ReviewCursor} from '../redesign/schema';
import type {SwingbyReviewRenderDto,SwingbyReviewTelemetry} from '../redesign/render-types';
import type {SwingbySceneSnapshot} from './swingby-scene';
import type {SwingbyAimPlane,SwingbyObjectiveSnapshot} from './swingby-objective';
import type {SwingbyCarrierProfile} from './swingby-carrier';
import type {Design,Vec3} from '../sim/types';

export type ReviewSide='A'|'B';
export interface ReviewSceneSample {cursor:ReviewCursor;renderDto:SwingbyReviewRenderDto;telemetry:SwingbyReviewTelemetry}
export interface ReviewSceneContext {scenarioId:string;initialEpochJdTdb:number;aimPlane:SwingbyAimPlane;goal:SwingbyObjectiveSnapshot['goal'];carrierProfile:SwingbyCarrierProfile}
export interface PreparedReviewFrame {cursor:ReviewCursor;craft:Design;snapshot:SwingbySceneSnapshot;enginePartId:string|null;sourceSignature:string;history:{certified:boolean;pointCount:number;maxChordErrorKm:number};unknownFields:string[]}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
function vector(v:unknown):v is Vec3{return Array.isArray(v)&&v.length===3&&v.every(finite);}
const close=(a:number,b:number,tolerance=1e-6)=>Math.abs(a-b)<=tolerance;
function require(value:unknown,code:string):asserts value {if(!value)throw new Error(code);}

/** Detached replay -> display DTO only. No solver, environment lookup,
 * simulation step, plan reconstruction or synthetic received event. */
export function prepareReviewFrame(sample:ReviewSceneSample,context:ReviewSceneContext):PreparedReviewFrame {
 const {cursor:c,renderDto:d,telemetry}=sample,t=c.committedTimeSeconds;
 require(c.stateOrigin==='replayed-actual'&&c.phase==='mars-flyby'&&typeof c.runId==='string'&&c.runId.length>0&&/^[a-f0-9]{64}$/.test(c.sourceSha256),'REVIEW_IDENTITY');
 require([t,c.requestedTimeSeconds,c.epochJdTdb,context.initialEpochJdTdb].every(finite)&&t>=0&&c.requestedTimeSeconds>=t-1e-6,'REVIEW_TIME');
 const p=d.physical;require(p.frame==='ICRF'&&p.centerBody==='Mars'&&p.phase==='mars-flyby'&&close(p.elapsedSeconds,t)&&close(p.jdTdb,c.epochJdTdb,1e-9)&&close(p.jdTdb,context.initialEpochJdTdb+t/86400,1e-8),'REVIEW_FRAME_TIME');
 require(vector(p.relativePositionKm)&&vector(p.relativeVelocityKmS)&&Array.isArray(d.attitudeQuaternion)&&d.attitudeQuaternion.length===4&&d.attitudeQuaternion.every(finite)&&Math.abs(Math.hypot(...d.attitudeQuaternion)-1)<1e-6,'REVIEW_UNKNOWN_PHYSICAL_POSE');
 const env=telemetry.values.environment;require(finite(telemetry.values.time)&&close(telemetry.values.time,t)&&env&&finite(env.state.elapsedSeconds)&&close(env.state.elapsedSeconds,t)&&finite(env.state.jdTdb)&&close(env.state.jdTdb,c.epochJdTdb,1e-9)&&vector(env.state.relativePositionKm)&&env.state.relativePositionKm.every((x,i)=>close(x,p.relativePositionKm[i])),'REVIEW_TELEMETRY_TIME');
 require(vector(env.sunDirection)&&Math.abs(Math.hypot(...env.sunDirection)-1)<1e-6,'REVIEW_UNKNOWN_SUN');
 const thrust=telemetry.values.thrust,enginePartId=thrust.enginePartId;require(enginePartId===null||typeof enginePartId==='string'&&d.craft.parts.some(p=>p.id===enginePartId&&p.kind==='engine'),'REVIEW_ENGINE_ID');
 if(enginePartId)require(vector(thrust.thrustDirectionBody)&&Math.abs(Math.hypot(...thrust.thrustDirectionBody)-1)<1e-6,'REVIEW_UNKNOWN_THRUST');
 require(d.trajectory.kind==='actual-history'&&typeof d.trajectory.certified==='boolean'&&Number.isInteger(d.trajectory.sampleLimit)&&d.trajectory.sampleLimit>=0&&d.trajectory.sampleLimit<=16384&&d.trajectory.points.length<=d.trajectory.sampleLimit,'REVIEW_HISTORY_LIMIT');
 let previous=-Infinity;for(const point of d.trajectory.points){require(finite(point.elapsedSeconds)&&point.elapsedSeconds>=previous&&point.elapsedSeconds<=t+1e-7&&point.frame==='ICRF'&&point.centerBody==='Mars'&&vector(point.relativePositionKm)&&finite(point.jdTdb)&&close(point.jdTdb,context.initialEpochJdTdb+point.elapsedSeconds/86400,1e-8),'REVIEW_FUTURE_OR_MIXED_HISTORY');previous=point.elapsedSeconds;}
 if(d.achievedExit)require(finite(d.achievedExit.time)&&d.achievedExit.time<=t+1e-7,'REVIEW_FUTURE_EXIT');
 if(d.burn)require(finite(d.burn.time)&&d.burn.time<=t+1e-7&&vector(d.burn.before.positionKm)&&vector(d.burn.actualDeltaVMps),'REVIEW_FUTURE_OR_UNKNOWN_BURN');
 const snapshot:SwingbySceneSnapshot={timeSeconds:t,positionKm:[...p.relativePositionKm],attitudeQuaternion:[...d.attitudeQuaternion],sunDirectionICRF:[...env.sunDirection],
  // Same declared display convention as live M02; not a certified body-fixed model.
  marsSurfaceRotationRad:t/88642.6848*Math.PI*2,
  objective:{scenarioId:context.scenarioId,revision:0,elapsedSeconds:t,aimPlane:structuredClone(context.aimPlane),aim:{xKm:0,yKm:0},referencePathKm:[],predictedPathKm:[],actualPathKm:d.trajectory.certified?d.trajectory.points.map(p=>[...p.relativePositionKm]):[],
   correction:d.burn?{time:d.burn.time,positionKm:[...d.burn.before.positionKm],vectorMps:[0,0,0],actualVectorMps:[...d.burn.actualDeltaVMps]}:null,predictedExit:null,achievedExit:d.achievedExit?structuredClone(d.achievedExit):null,goal:structuredClone(context.goal),previewStatus:'accepted'},
  ...(enginePartId?{engine:{partId:enginePartId,thrustDirectionBody:[...thrust.thrustDirectionBody] as Vec3}}:{})};
 // Aim/goal schema plumbing is hidden in history-only presentation. In
 // particular the zero aim is never displayed as the player's flight plan.
 return {cursor:structuredClone(c),craft:structuredClone(d.craft),snapshot,enginePartId,sourceSignature:JSON.stringify(d.craft),history:{certified:d.trajectory.certified,pointCount:snapshot.objective.actualPathKm.length,maxChordErrorKm:d.trajectory.maxChordErrorKm},unknownFields:[...telemetry.unknownFields]};
}

/** Two bounded frames. Requested selection and displayed identity are always
 * separate, so missing B never relabels the retained A geometry. */
export class ReviewFrameSelection {
 commonRequestedTimeSeconds=0;requestedSide:ReviewSide='A';
 private frames:Partial<Record<ReviewSide,PreparedReviewFrame>>={};private displayed:{side:ReviewSide;frame:PreparedReviewFrame}|null=null;
 setCommonCursor(seconds:number){if(!finite(seconds)||seconds<0)throw new Error('REVIEW_CURSOR');this.commonRequestedTimeSeconds=seconds;}
 setSide(side:ReviewSide){if(side!=='A'&&side!=='B')throw new Error('REVIEW_SIDE');this.requestedSide=side;}
 put(side:ReviewSide,frame:PreparedReviewFrame){if(!close(frame.cursor.requestedTimeSeconds,this.commonRequestedTimeSeconds,1e-7))return false;this.frames[side]=frame;return true;}
 candidate(){const frame=this.frames[this.requestedSide];return frame&&close(frame.cursor.requestedTimeSeconds,this.commonRequestedTimeSeconds,1e-7)?{side:this.requestedSide,frame}:null;}
 commit(candidate:{side:ReviewSide;frame:PreparedReviewFrame}){this.displayed=candidate;}
 get displayedFrame(){return this.displayed;}
 getState(){const shown=this.displayed;return {requestedSide:this.requestedSide,commonRequestedTimeSeconds:this.commonRequestedTimeSeconds,displayedSide:shown?.side??null,displayedRunId:shown?.frame.cursor.runId??null,displayedSourceSha256:shown?.frame.cursor.sourceSha256??null,displayedRequestedTimeSeconds:shown?.frame.cursor.requestedTimeSeconds??null,committedTimeSeconds:shown?.frame.cursor.committedTimeSeconds??null,epochJdTdb:shown?.frame.cursor.epochJdTdb??null,stateOrigin:shown?'replayed-actual':null,pendingSelection:!shown||shown.side!==this.requestedSide||!close(shown.frame.cursor.requestedTimeSeconds,this.commonRequestedTimeSeconds,1e-7),history:shown?{...shown.frame.history}:null,unknownFields:shown?[...shown.frame.unknownFields]:[]};}
}
