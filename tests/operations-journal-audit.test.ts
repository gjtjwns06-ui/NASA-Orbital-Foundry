import {describe,expect,it} from 'vitest';
import {createDesign} from '../src/sim/catalog';
import {createTransferPlan,solveTransferPlan} from '../src/transfer/planning';
import {createTransferRuntime} from '../src/transfer/runtime';
import {COMMAND_NETWORK as N,COMMAND_NETWORK_HASH} from '../src/transfer/command-network';
import {canonicalOperationsJson,utf8Length} from '../src/transfer/operations-codec';
import {initialOperationsState,queueTransferCommand,retryTransferCommand,cancelUnsentTransferCommand,
 installReceivedCommand,receiveAcknowledgement,getTransferOperationsSnapshot,normalizeScheduleReplacement,previewTransferCommand} from '../src/transfer/operations';
import type {CommandRecord,CommandAttempt,OperationsRuntimeState,ScheduleReplacement} from '../src/transfer/operations-types';
import type {TransferOperation} from '../src/transfer/types';
import {processTransportBoundaries,integrateCommandTransport,groundEmissionReady} from '../src/transfer/command-transport';
import {guardAckEmission} from '../src/transfer/command-guards';
import {ackBitAt} from '../src/transfer/command-link';
import {createOperationsLesson} from '../src/transfer/operations-lesson';
import {createOperationsRuntime,advanceOperations,getOperationsTelemetry} from '../src/transfer/runtime-v3';
import {operationsCheckpoint,makeOperationsSave,serializeOperationsSave,createOperationsReplay} from '../src/transfer/persistence-v2';
import {quaternionFromBasis} from '../src/sim/attitude';
import {freezeTransferInput} from '../src/transfer/immutable';
import {createHardwarePart} from '../src/hardware';
import {bodyBasis} from '../src/sim/assembly';
import {scale} from '../src/sim/physics';

// Independent PROTOCOL tests only. The released runtime supplies complete typed
// bookkeeping; time and RF delivery preconditions are set explicitly below.
// Calling installation/ACK handlers here proves neither transport nor energy,
// pointing, light-time, decoding, or full-mission success.
const solution=solveTransferPlan(createTransferPlan());
const initial:TransferOperation[]=[{id:'past',kind:'charge',start:0,end:100},{id:'original',kind:'observe',start:5000,end:6000}];
function fixture():OperationsRuntimeState {
 const base=createTransferRuntime(solution,createDesign('mars'));
 return {...base,modelVersion:'transfer-3.0.0',scenarioId:'protocol-audit-only',commandNetworkId:N.id,commandNetworkHash:COMMAND_NETWORK_HASH,
  time:1000,requestedTime:1000,numerics:{cruiseStepSeconds:600,activeStepSeconds:1},operations:initialOperationsState(initial)};
}
function payload(baseRevision=0,replaceFromSeconds=5000,id='replacement'):ScheduleReplacement {
 return {kind:'replace-schedule',baseRevision,replaceFromSeconds,operations:[{id,kind:'downlink',start:replaceFromSeconds+500,end:replaceFromSeconds+1000}]};
}
function queued(state:OperationsRuntimeState,id='cmd-1',p=payload(),expiry=4000){
 queueTransferCommand(state,p,{actionId:`queue-${id}`,commandId:id,expiresAtSeconds:expiry});
 return state.operations.commands.find(c=>c.id===id)!;
}
function emitted(a:CommandAttempt){
 a.status='propagating';a.stationId='G1';a.emittedBits=a.totalBits;
 a.firstBit={emittedAtSeconds:1010,arrivesAtSeconds:1510,emitterPositionKm:[0,0,0],receiverPositionKm:[149896229,0,0]};
 a.lastBit={emittedAtSeconds:1020,arrivesAtSeconds:1520,emitterPositionKm:[0,0,0],receiverPositionKm:[149896229,0,0]};
}
function install(state:OperationsRuntimeState,c:CommandRecord,time=2000,a=c.attempts.at(-1)!){
 state.time=time;emitted(a);a.arrivedBits=a.totalBits;a.status='delivered';return installReceivedCommand(state,c,a);
}
function ack(state:OperationsRuntimeState,c:CommandRecord,time:number,index=c.acknowledgements.length-1){
 state.time=time;const a=c.acknowledgements[index];a.status='delivered';a.emittedBits=a.totalBits;a.receivedAtSeconds=time;receiveAcknowledgement(state,a);return a;
}
function errorCode(fn:()=>unknown){try{fn();return null;}catch(error){return (error as {code?:string}).code;}}

describe('independent runtime3 journal and ground-knowledge audit (not transport)',()=>{
 it('returns an original action at the 256-action limit without changing demand or duplicating records',()=>{
  const s=fixture();let original:ReturnType<typeof queueTransferCommand>|undefined;
  for(let i=0;i<N.maximumCommands;i++){
   const action=queueTransferCommand(s,payload(),{actionId:`queue-${i}`,commandId:`command-${i}`,expiresAtSeconds:4000});
   if(i===0)original=action;
   cancelUnsentTransferCommand(s,`command-${i}`,`cancel-${i}`);
  }
  expect(s.operations.journal).toHaveLength(N.maximumActions);expect(s.operations.commands).toHaveLength(N.maximumCommands);
  s.time=1800;s.requestedTime=12000;const before=structuredClone(s);
  const again=queueTransferCommand(s,payload(),{actionId:'queue-0',commandId:'command-0',expiresAtSeconds:4000});
  expect(again).toEqual(original);expect(s).toEqual(before);
  if(again.kind==='queue')again.payload.operations[0].end+=100;
  expect(s).toEqual(before);
  expect(errorCode(()=>queueTransferCommand(s,payload(),{actionId:'new-action',commandId:'new-command'}))).toBe('ACTION_LIMIT');
  expect(s).toEqual(before);
 });
 it('isolates submitted bytes and rejects conflicting action or command reuse without partial mutation',()=>{
  const s=fixture(),input=payload();queued(s,'one',input);const bytes=s.operations.commands[0].canonicalBytes;
  input.operations[0].start+=20;expect(s.operations.commands[0].canonicalBytes).toBe(bytes);expect(s.operations.commands[0].envelope.payload.operations[0].start).toBe(5500);
  const before=structuredClone(s),different=payload();different.operations[0].end+=20;
  expect(errorCode(()=>queueTransferCommand(s,different,{actionId:'queue-one',commandId:'one',expiresAtSeconds:4000}))).toBe('ACTION_ID_CONFLICT');
  expect(errorCode(()=>queueTransferCommand(s,different,{actionId:'different-action',commandId:'one',expiresAtSeconds:4000}))).toBe('COMMAND_ID_CONFLICT');
  expect(errorCode(()=>cancelUnsentTransferCommand(s,'one','queue-one'))).toBe('ACTION_ID_CONFLICT');expect(s).toEqual(before);
 });
 it('uses bounded UTF-8 envelope bytes and strict finite unique schedule inputs',()=>{
  const s=fixture(),large=payload();large.operations=Array.from({length:40},(_,i)=>({id:`${i}-${'관'.repeat(70)}`,kind:'observe' as const,start:5000+i*10,end:5005+i*10}));
  const envelope={commandId:'large',expiresAtSeconds:4000,payload:large};
  expect(canonicalOperationsJson(envelope).length).toBeLessThan(N.maximumPayloadBytes);
  expect(utf8Length(canonicalOperationsJson(envelope))).toBeGreaterThan(N.maximumPayloadBytes);
  const before=structuredClone(s);expect(errorCode(()=>queueTransferCommand(s,large,{commandId:'large',actionId:'large-action',expiresAtSeconds:4000}))).toBe('COMMAND_SIZE');expect(s).toEqual(before);
  expect(errorCode(()=>normalizeScheduleReplacement({...payload(),unexpected:true},solution.durationSeconds))).toBe('INVALID_INPUT');
  expect(errorCode(()=>normalizeScheduleReplacement({...payload(),replaceFromSeconds:NaN},solution.durationSeconds))).toBe('INVALID_INPUT');
  expect(errorCode(()=>normalizeScheduleReplacement({...payload(),operations:[...payload().operations,...payload().operations]},solution.durationSeconds))).toBe('OPERATION_ID_CONFLICT');
 });
 it('preserves the prefix atomically and rejects operation cuts or retained-ID conflicts without changing prior history',()=>{
  for(const [p,expected] of [[payload(0,5500),'REPLACEMENT_CUTS_OPERATION'],[payload(0,6000,'original'),'OPERATION_ID_CONFLICT']] as const){
   const s=fixture(),c=queued(s,'bad',p,7000),before=structuredClone(s.operations.onboardOperations),pastEvents=structuredClone(s.events);
   const decision=install(s,c);expect(decision.status).toBe('rejected');expect(decision.reasonCode).toBe(expected);expect(s.operations.onboardRevision).toBe(0);expect(s.operations.onboardOperations).toEqual(before);expect(s.operations.installations).toHaveLength(0);expect(s.events.slice(0,pastEvents.length)).toEqual(pastEvents);
  }
  const s=fixture(),c=queued(s,'good',payload(0,6000),7000);install(s,c);
  expect(s.operations.onboardOperations.slice(0,2)).toEqual(initial);expect(s.operations.onboardRevision).toBe(1);
  expect(getTransferOperationsSnapshot(s).ground.confirmedOperations).toEqual(initial);
 });
 it('rejects new installations exactly at expiry or the replacement boundary',()=>{
  for(const [time,expiry,expected] of [[4000,4000,'COMMAND_EXPIRED'],[5000,7000,'REPLACEMENT_LATE']] as const){
   const s=fixture(),c=queued(s,'edge',payload(),expiry),decision=install(s,c,time);
   expect(decision.status).toBe('rejected');expect(decision.reasonCode).toBe(expected);expect(s.operations.onboardRevision).toBe(0);expect(s.operations.onboardOperations).toEqual(initial);
  }
  const s=fixture(),c=queued(s,'early',payload(),7000);expect(install(s,c,4999.999).status).toBe('installed');
 });
 it('retries an installed command after immutable expiry to return its original installation ACK without applying twice',()=>{
  const s=fixture(),c=queued(s),first=install(s,c),installed=structuredClone(s.operations.onboardOperations);
  expect(first.installedAtSeconds).toBe(2000);expect(getTransferOperationsSnapshot(s).ground.confirmedRevision).toBe(0);
  s.time=6000;retryTransferCommand(s,c.id,'retry-after-expiry');expect(c.envelope.expiresAtSeconds).toBe(4000);expect(c.attempts[1].queueDeadlineSeconds).toBeGreaterThan(s.time);
  const repeated=install(s,c,7000);expect(repeated.status).toBe('installed');expect(repeated.duplicate).toBe(true);expect(repeated.installedAtSeconds).toBe(2000);expect(repeated.decidedAtSeconds).toBe(7000);
  expect(s.operations.onboardRevision).toBe(1);expect(s.operations.installations).toHaveLength(1);expect(s.operations.onboardOperations).toEqual(installed);
  const received=ack(s,c,8000);expect(getTransferOperationsSnapshot(s).ground.confirmedRevision).toBe(1);
  const count=s.operations.receivedAckBits,events=s.events.length;receiveAcknowledgement(s,received);expect(s.operations.receivedAckBits).toBe(count);expect(s.events).toHaveLength(events);
  c.attempts.forEach(a=>a.groundAttentionExpired=true);expect(getTransferOperationsSnapshot(s).ground.commands[0].status).toBe('confirmed');
 });
 it('never executes an expired never-installed command even if its earlier attempt was emitted',()=>{
  const s=fixture(),c=queued(s);emitted(c.attempts[0]);c.attempts[0].status='lost';
  s.time=6000;retryTransferCommand(s,c.id,'retry-unknown');const decision=install(s,c,7000);
  expect(decision.status).toBe('rejected');expect(decision.reasonCode).toBe('COMMAND_EXPIRED');expect(s.operations.installations).toHaveLength(0);expect(s.operations.onboardRevision).toBe(0);
 });
 it('waits for a missing predecessor ACK before reconstructing a later confirmed schedule',()=>{
  const s=fixture(),a=queued(s,'a');install(s,a,2000);
  // A caller can speculate on revision 1. This does not grant Earth knowledge;
  // the normal UI must select its base only from ground-confirmed schedules.
  const b=queued(s,'b',payload(1,7000,'second'),6000);install(s,b,3000);ack(s,b,4000);
  const missing=getTransferOperationsSnapshot(s);expect(missing.onboardTruth.revision).toBe(2);expect(missing.ground.latestAcknowledgedRevision).toBe(2);expect(missing.ground.confirmedRevision).toBe(0);expect(missing.ground.confirmationChainComplete).toBe(false);expect(missing.ground.confirmedOperations).toEqual(initial);
  ack(s,a,4500);const joined=getTransferOperationsSnapshot(s);expect(joined.ground.confirmedRevision).toBe(2);expect(joined.ground.confirmationChainComplete).toBe(true);expect(joined.ground.confirmedOperations).toEqual(joined.onboardTruth.operations);
  const before=structuredClone(s.operations);receiveAcknowledgement(s,a.acknowledgements[0]);expect(s.operations).toEqual(before);
 });
 it('does not infer an unknown schedule from a rejection ACK reporting a newer onboard revision',()=>{
  const s=fixture(),a=queued(s,'a');install(s,a,2000);
  const b=queued(s,'b',payload(0,7000,'stale'),6000);expect(install(s,b,3000).reasonCode).toBe('REVISION_MISMATCH');ack(s,b,4000);
  const view=getTransferOperationsSnapshot(s);expect(view.ground.commands[1].status).toBe('rejected');expect(view.ground.latestAcknowledgedRevision).toBe(1);expect(view.ground.confirmedRevision).toBe(0);expect(view.ground.confirmationChainComplete).toBe(false);expect(view.ground.confirmedOperations).toEqual(initial);expect(s.operations.groundKnownSchedules).toHaveLength(1);
 });
 it('cancels only an unsent retry and does not leak receiver loss or revoke an earlier signal',()=>{
  const s=fixture(),c=queued(s),first=c.attempts[0];emitted(first);first.receptionValid=false;first.truthFailureCode='POINTING_LOSS';first.status='lost';
  let view=getTransferOperationsSnapshot(s).ground.commands[0];expect(view.status).toBe('awaiting-confirmation');expect(view.reasonCode).toBeNull();
  retryTransferCommand(s,c.id,'retry');cancelUnsentTransferCommand(s,c.id,'cancel-retry');
  view=getTransferOperationsSnapshot(s).ground.commands[0];expect(view.status).toBe('awaiting-confirmation');expect(view.reasonCode).toBe('UNSENT_RETRY_CANCELLED');expect(first.status).toBe('lost');expect(first.firstBit).not.toBeNull();expect(c.attempts[1].status).toBe('cancelled');
  first.groundAttentionExpired=true;expect(getTransferOperationsSnapshot(s).ground.commands[0].status).toBe('unconfirmed');expect(getTransferOperationsSnapshot(s).ground.commands[0].acknowledgedRevision).toBeNull();
 });
 it('returns isolated public snapshots rather than aliases to the immutable schedule or mutable protocol ledgers',()=>{
  const s=fixture(),c=queued(s);install(s,c);const before=structuredClone(s),view=getTransferOperationsSnapshot(s);
  view.ground.confirmedOperations[0].end=900;view.ground.commands[0].payload.operations[0].start=42;view.onboardTruth.operations.splice(0);view.onboardTruth.decisions[0].revision=99;if(view.signals.length)view.signals[0].firstBit.receiverPositionKm[0]=0;
  expect(s).toEqual(before);
 });
 it('rejects invalid preview identity and expiry with the same input rules as queueing',()=>{
  for(const options of [{expiresAtSeconds:-1},{expiresAtSeconds:NaN},{expiresAtSeconds:Infinity},{commandId:'bad command id'}]){
   const s=fixture(),before=structuredClone(s),preview=previewTransferCommand(s,payload(),options);
   expect(preview.valid).toBe(false);expect(preview.validation.some(issue=>issue.severity==='error'&&issue.code==='INVALID_INPUT')).toBe(true);expect(s).toEqual(before);
  }
 });
 it('rejects new actions on a failed flight while retaining original action redelivery and local unsent cancellation',()=>{
  const s=fixture(),c=queued(s);emitted(c.attempts[0]);s.status='failed';s.failureReason='protocol test power loss';s.requestedTime=9000;
  const before=structuredClone(s);expect(s.time).toBeLessThan(s.solution.durationSeconds);
  expect(getTransferOperationsSnapshot(s).ground.commands[0].canRetry).toBe(false);
  expect(errorCode(()=>retryTransferCommand(s,c.id,'cannot-retry'))).toBe('OUTSIDE_MISSION');
  expect(errorCode(()=>queueTransferCommand(s,payload(),{actionId:'cannot-queue',commandId:'new'}))).toBe('OUTSIDE_MISSION');
  expect(queueTransferCommand(s,payload(),{actionId:'queue-cmd-1',commandId:'cmd-1',expiresAtSeconds:4000})).toEqual(s.operations.journal[0]);expect(s).toEqual(before);
  const unsent=fixture(),u=queued(unsent);unsent.status='failed';cancelUnsentTransferCommand(unsent,u.id,'local-cancel');expect(u.attempts[0].status).toBe('cancelled');expect(unsent.operations.installations).toHaveLength(0);
 });
 it('aborts a partial ACK exactly at TX-off while preserving emitted bits and withholding Earth confirmation',()=>{
  const s=fixture(),c=queued(s);install(s,c);const a=c.acknowledgements[0],start=2000,off=start+.25;
  // Explicit partial-frame precondition; this does not claim that the fixture
  // propagated valid RF before this point. The production boundary/guard and
  // tail light-time solver themselves are used below, without mocks.
  a.status='emitting';a.stationId='G1';a.payloadRateBps=409.6;a.firstBit=ackBitAt(s.solution,'G1',start);a.lastBit=ackBitAt(s.solution,'G1',start+10);a.plannedTransmitEndSeconds=start+10;a.emittedBits=102.4;s.operations.emittedAckBits=102.4;s.time=off;
  const q=s.attitudeQuaternion,interval={start:off,end:off+.5,startQ:q,midQ:q,endQ:q,receiverPowered:true,transmitterPowered:false};
  expect(guardAckEmission(s,'G1',interval.start,interval.end,a.payloadRateBps,interval)).toMatchObject({valid:false,reasonCode:'TRANSMISSION_INTERRUPTED'});
  const offTelemetry={linkReady:false,linkRateBps:0,stationId:'G1',receiverPowered:true,transmitterPowered:false};processTransportBoundaries(s,offTelemetry);
  expect(a.status).toBe('lost');expect(a.failureCode).toBe('TRANSMISSION_INTERRUPTED');expect(a.lastBit?.emittedAtSeconds).toBe(off);expect(a.plannedTransmitEndSeconds).toBe(off);expect(a.emittedBits).toBe(102.4);expect(s.operations.emittedAckBits).toBe(102.4);
  expect(integrateCommandTransport(s,interval)).toBe(0);expect(a.emittedBits).toBe(102.4);
  s.time=off+1000;processTransportBoundaries(s,offTelemetry);expect(s.operations.receivedAckBits).toBe(0);expect(s.operations.groundReceivedAcks).toHaveLength(0);expect(getTransferOperationsSnapshot(s).ground.confirmedRevision).toBe(0);
  // A later usable downlink does not automatically revive the discarded frame.
  processTransportBoundaries(s,{...offTelemetry,linkReady:true,linkRateBps:409.6,transmitterPowered:true});expect(a.status).toBe('lost');
 });
 it('does not begin an eligible transmission on zero/sub-step demand and commits identical eventual intervals',()=>{
  const lesson=createOperationsLesson(),s=createOperationsRuntime(solveTransferPlan(lesson.plan),lesson.craft,{scenarioId:lesson.id});
  // Explicit local numerical precondition, not an actual departure-to-Mars run:
  // place the genuine runtime at the authored listening time and desired attitude.
  // The independent full-flight suite owns proof of reaching this state physically.
  s.time=s.requestedTime=lesson.suggestedCommandAtSeconds;s.attitudeQuaternion=quaternionFromBasis(getOperationsTelemetry(s).requestedBodyAxes);
  queueTransferCommand(s,lesson.suggestedPayload,{actionId:'phase-action',commandId:'phase-command',expiresAtSeconds:lesson.suggestedExpirySeconds});
  expect(groundEmissionReady(s)).toBe(true);const before=operationsCheckpoint(s);
  advanceOperations(s,0);expect(operationsCheckpoint(s)).toEqual(before);
  advanceOperations(s,.125);expect(operationsCheckpoint(s)).toEqual({...before,requestedTime:lesson.suggestedCommandAtSeconds+.125});
  expect(s.operations.commands[0].attempts[0].firstBit).toBeNull();expect(s.operations.emittedCommandBits).toBe(0);
  const whole=structuredClone(s),split=structuredClone(s);for(const state of [whole,split]){freezeTransferInput(state.craft);freezeTransferInput(state.solution);}
  advanceOperations(whole,3.875);for(const delta of [.125,.25,.5,1,2])advanceOperations(split,delta);
  expect(operationsCheckpoint(split)).toEqual(operationsCheckpoint(whole));expect(whole.time).toBeGreaterThan(lesson.suggestedCommandAtSeconds);
  expect(whole.operations.commands[0].attempts[0].firstBit?.emittedAtSeconds).toBe(lesson.suggestedCommandAtSeconds);expect(whole.operations.emittedCommandBits).toBeGreaterThan(0);
 });
 it('keeps an editor draft separate from the original schedule, journal and replayed runtime',()=>{
  const lesson=createOperationsLesson(),s=createOperationsRuntime(solveTransferPlan(lesson.plan),lesson.craft,{scenarioId:lesson.id}),before=operationsCheckpoint(s);
  const saved=makeOperationsSave(lesson.plan,lesson.craft,s,{editorDraft:lesson.suggestedPayload});
  expect(saved.plan.operations.find(op=>op.id==='encounter-science')?.end).toBe(s.solution.periapsisSeconds-3500);expect(saved.journal).toEqual([]);
  expect(saved.editorDraft?.operations.find(op=>op.id==='encounter-science')?.end).toBe(s.solution.periapsisSeconds+1800);
  const task=createOperationsReplay(serializeOperationsSave(saved));expect(task.step(0).status).toBe('running');expect(task.step(1).status).toBe('complete');
  const loaded=task.result();expect(operationsCheckpoint(loaded.runtime!)).toEqual(before);expect(loaded.editorDraft).toEqual(lesson.suggestedPayload);
  loaded.editorDraft!.operations[0].end-=60;expect(loaded.runtime!.operations.onboardOperations).toEqual(s.operations.onboardOperations);expect(operationsCheckpoint(s)).toEqual(before);
 });
 it('rejects unknown save fields, unsupported model/network/numerics and byte-oversized UTF-8 before replay',()=>{
  const lesson=createOperationsLesson(),s=createOperationsRuntime(solveTransferPlan(lesson.plan),lesson.craft,{scenarioId:lesson.id}),saved=makeOperationsSave(lesson.plan,lesson.craft,s);
  const variants:unknown[]=[{...saved,unknown:true},{...saved,modelVersion:'transfer-3.1.0'},{...saved,commandNetworkHash:'0'.repeat(64)},{...saved,numerics:{...saved.numerics,activeStepSeconds:.75}},{...saved,numerics:{...saved.numerics,unknown:true}},{...saved,checkpoint:{...saved.checkpoint,unknown:true}},{...saved,plan:{...saved.plan,unknown:true}},{...saved,editorDraft:{...lesson.suggestedPayload,unknown:true}}];
  for(const input of variants)expect(()=>createOperationsReplay(JSON.stringify(input))).toThrow();
  const large=JSON.stringify({...saved,scenarioId:'관'.repeat(Math.ceil(N.maximumSaveBytes/3))});expect(large.length).toBeLessThan(N.maximumSaveBytes);expect(utf8Length(large)).toBeGreaterThan(N.maximumSaveBytes);expect(errorCode(()=>createOperationsReplay(large))).toBe('SAVE_TOO_LARGE');
  expect(()=>makeOperationsSave(lesson.plan,lesson.craft,s,{numerics:{cruiseStepSeconds:300,activeStepSeconds:1}})).toThrow();
  const inconsistent=structuredClone(s);inconsistent.integrationStepSeconds=300;expect(()=>makeOperationsSave(lesson.plan,lesson.craft,inconsistent)).toThrow();
 });
 it('bounds replay work by committed steps, supports cancellation, and detects forged numerical identity',()=>{
  const lesson=createOperationsLesson(),s=createOperationsRuntime(solveTransferPlan(lesson.plan),lesson.craft,{scenarioId:lesson.id});advanceOperations(s,30);
  const saved=makeOperationsSave(lesson.plan,lesson.craft,s),task=createOperationsReplay(serializeOperationsSave(saved));
  expect(task.step(1).status).toBe('running');expect(task.progress.committedTime).toBeGreaterThan(0);expect(task.progress.committedTime).toBeLessThan(s.time);
  task.cancel();const stopped=task.progress;expect(task.step(1000)).toEqual(stopped);expect(errorCode(()=>task.result())).toBe('REPLAY_CANCELLED');
  const forged=createOperationsReplay(JSON.stringify({...saved,numerics:{...saved.numerics,cruiseStepSeconds:300}}));
  expect(()=>{while(forged.progress.status==='running')forged.step(10);}).toThrow();
 });
 it('does not mutate a constrained EPS checkpoint on sub-step demand after a new ACK raises radio load',async()=>{
  const {settleOperationsBoundary}=await import('../src/transfer/runtime-v3');
  const lesson=createOperationsLesson(),craft=structuredClone(lesson.craft);
  craft.parts=craft.parts.map(p=>p.kind==='battery'?createHardwarePart('bpx100-4s2p-v2',p.id,p.face,p.u,p.v,p.rotation):p.kind==='storage'?createHardwarePart('recorder-8-v2',p.id,p.face,p.u,p.v,p.rotation):p);
  craft.parts.push(createHardwarePart('recorder-8-v2','storage-2','py',0,-.22));
  const s=createOperationsRuntime(solveTransferPlan(lesson.plan),craft,{scenarioId:'eps-ack-boundary-audit'});expect(s.status).toBe('running');
  // Local endpoint fixture: real catalog/EPS/attitude/radio math, with an
  // explicit decoded-frame precondition. This does not assert that an actual
  // complete flight brought this craft into this attitude and RF state.
  s.time=s.requestedTime=lesson.suggestedCommandAtSeconds;const env=getOperationsTelemetry(s).environment;
  s.attitudeQuaternion=quaternionFromBasis(bodyBasis(env.targetDirection,scale(env.sunDirection,-1),'sun',env.earthDirection));
  const beforeAck=getOperationsTelemetry(s);expect(beforeAck.dischargeLimitW).toBe(60);expect(beforeAck.slewing).toBe(true);expect(beforeAck.loadPowerW-beforeAck.solarPowerW).toBeLessThan(60);
  queueTransferCommand(s,lesson.suggestedPayload,{actionId:'eps-send',commandId:'eps-command',expiresAtSeconds:lesson.suggestedExpirySeconds});
  const c=s.operations.commands[0],a=c.attempts[0];emitted(a);a.status='delivered';a.arrivedBits=a.totalBits;
  installReceivedCommand(s,c,a);const afterAck=getOperationsTelemetry(s);expect(afterAck.radioMode).toBe('rx-tx');expect(afterAck.loadPowerW-afterAck.solarPowerW).toBeGreaterThan(60);
  const before=operationsCheckpoint(s);advanceOperations(s,0);expect(operationsCheckpoint(s)).toEqual(before);advanceOperations(s,.125);expect(operationsCheckpoint(s)).toEqual({...before,requestedTime:lesson.suggestedCommandAtSeconds+.125});
  settleOperationsBoundary(s);expect(s.time).toBe(lesson.suggestedCommandAtSeconds);expect(s.safeMode).toBe(true);expect(getOperationsTelemetry(s).receiverPowered).toBe(false);
  expect(s.operations.emittedAckBits).toBe(0);expect(c.acknowledgements[0].status).toBe('queued');expect(c.acknowledgements[0].firstBit).toBeNull();expect(s.operations.groundConfirmedRevision).toBe(0);
  const settled=operationsCheckpoint(s);settleOperationsBoundary(s);expect(operationsCheckpoint(s)).toEqual(settled);expect(s.events.filter(e=>e.code==='SAFE_MODE')).toHaveLength(1);
 });
});
