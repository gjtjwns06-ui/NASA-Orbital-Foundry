import {COMMAND_NETWORK as N} from './command-network';
import {ackBitAt,commandBitAt,selectGroundEmission,solveRetardedEmission,stationStateAt} from './command-link';
import {guardAckEmission,guardCommandReception,guardGroundEmission} from './command-guards';
import type {AttitudeInterval} from './command-guards';
import {transferStateAt} from './state';
import {installReceivedCommand,receiveAcknowledgement} from './operations';
import {OperationsError} from './operations-codes';
import type {OperationsRuntimeState} from './operations-types';
export interface TransportTelemetry {linkReady:boolean;linkRateBps:number;stationId:string|null;receiverPowered:boolean;transmitterPowered:boolean}
const EPS=1e-7;
export function pendingAcknowledgement(state:OperationsRuntimeState){return state.operations.commands.flatMap(c=>c.acknowledgements).find(a=>a.status==='queued'||a.status==='emitting');}
export function emittingAcknowledgement(state:OperationsRuntimeState){return state.operations.commands.flatMap(c=>c.acknowledgements).find(a=>a.status==='emitting');}
export function transportActive(state:OperationsRuntimeState){return state.operations.commands.some(c=>c.attempts.some(a=>a.status==='emitting'||a.firstBit&&a.lastBit&&state.time>=a.firstBit.arrivesAtSeconds-EPS&&state.time<a.lastBit.arrivesAtSeconds-EPS)||c.acknowledgements.some(a=>a.status==='emitting'));}
/** Pure prospective event check. A zero/sub-step render demand must not emit a
 * signal or alter a paused checkpoint at the same committed timestamp. */
export function groundEmissionReady(state:OperationsRuntimeState){const attempts=state.operations.commands.flatMap(c=>c.attempts);if(!attempts.some(a=>a.status==='queued'&&a.queueDeadlineSeconds>state.time)||attempts.some(a=>a.status==='emitting'))return false;const last=Math.max(-Infinity,...attempts.filter(a=>a.firstBit&&a.status!=='emitting').map(a=>a.lastBit!.emittedAtSeconds));return state.time>=last+N.uplinkInterframeGapSeconds-EPS&&!!selectGroundEmission(state.solution,state.time).selection;}
/** Physical events only. Queue deadlines are local ground facts; propagation
 * failure and onboard rejection remain unavailable to the ground projection. */
export function processTransportBoundaries(state:OperationsRuntimeState,t:TransportTelemetry,phase:'all'|'receive'|'emit'='all'){
 if(phase!=='emit')for(const command of state.operations.commands){for(const a of command.attempts){
  if(a.attentionAtSeconds!==null&&state.time>=a.attentionAtSeconds)a.groundAttentionExpired=true;
  if(a.status==='queued'&&state.time>=a.queueDeadlineSeconds){a.status='expired';continue;}
  if(!a.firstBit||!a.lastBit||!a.stationId)continue;
  if(a.status!=='delivered'&&a.status!=='lost'&&state.time>=a.firstBit.arrivesAtSeconds-EPS&&state.time<=a.lastBit.arrivesAtSeconds+EPS&&!t.receiverPowered){a.receptionValid=false;a.truthFailureCode='RECEIVER_OFF';}
  if(state.time>=a.firstBit.arrivesAtSeconds-EPS){let emittedTime=a.firstBit.emittedAtSeconds;if(state.time>=a.lastBit.arrivesAtSeconds-EPS)emittedTime=a.lastBit.emittedAtSeconds;else emittedTime=solveRetardedEmission(state.time,transferStateAt(state.solution,state.time).heliocentricPositionKm,s=>stationStateAt(state.solution,a.stationId!,s).positionKm).emittedAtSeconds;a.arrivedBits=Math.min(a.emittedBits,Math.max(0,(emittedTime-a.firstBit.emittedAtSeconds)*N.uplinkInformationRateBps));if(a.status==='propagating')a.status='receiving';}
  if(state.time>=a.lastBit.arrivesAtSeconds-EPS&&a.status!=='delivered'&&a.status!=='lost'){a.arrivedBits=a.emittedBits;if(a.emissionValid&&a.receptionValid&&a.emittedBits>=a.totalBits-EPS){a.status='delivered';installReceivedCommand(state,command,a);}else a.status='lost';}
 }
 for(const ack of command.acknowledgements){if(ack.status==='emitting'&&!t.transmitterPowered&&ack.stationId){ack.failureCode='TRANSMISSION_INTERRUPTED';ack.lastBit=ackBitAt(state.solution,ack.stationId,state.time);ack.plannedTransmitEndSeconds=state.time;ack.status='lost';}if(ack.status==='propagating'&&ack.lastBit&&state.time>=ack.lastBit.arrivesAtSeconds-EPS){ack.status='delivered';ack.receivedAtSeconds=ack.lastBit.arrivesAtSeconds;receiveAcknowledgement(state,ack);}}}
 // Safety can turn the transmitter off after a newly received command creates
 // its ACK load. This check also runs in the emit phase, before any first bit.
 for(const command of state.operations.commands)for(const ack of command.acknowledgements)if(ack.status==='emitting'&&!t.transmitterPowered&&ack.stationId){ack.failureCode='TRANSMISSION_INTERRUPTED';ack.lastBit=ackBitAt(state.solution,ack.stationId,state.time);ack.plannedTransmitEndSeconds=state.time;ack.status='lost';}
 if(state.status!=='running'||phase==='receive')return;
 // One finite uplink at a time. Different stations cannot be spliced into a frame.
 const attempts=state.operations.commands.flatMap(c=>c.attempts),busy=attempts.some(a=>a.status==='emitting'),lastEmission=Math.max(-Infinity,...attempts.filter(a=>a.firstBit&&a.status!=='emitting').map(a=>a.lastBit!.emittedAtSeconds));
 if(!busy&&state.time>=lastEmission+N.uplinkInterframeGapSeconds-EPS){const next=attempts.filter(a=>a.status==='queued').sort((a,b)=>a.queuedSequence-b.queuedSequence)[0];if(next){const opportunity=selectGroundEmission(state.solution,state.time);if(opportunity.selection){const selection=opportunity.selection,end=state.time+next.totalBits/N.uplinkInformationRateBps;try{next.lastBit=commandBitAt(state.solution,selection.stationId,end);next.firstBit=selection.bit;next.stationId=selection.stationId;next.eirpDbW=selection.budget.eirpDbW;next.plannedTransmitEndSeconds=end;next.attentionAtSeconds=next.lastBit.arrivesAtSeconds+(next.lastBit.arrivesAtSeconds-end)+N.attentionGraceSeconds;next.status='emitting';}catch(error){if(!(error instanceof OperationsError))throw error;/* Queue may expire locally; no false onboard conclusion. */}}}}
 const ack=pendingAcknowledgement(state);if(ack?.status==='queued'&&t.receiverPowered&&t.linkReady&&t.linkRateBps>0&&t.stationId){try{const end=state.time+ack.totalBits/t.linkRateBps;ack.firstBit=ackBitAt(state.solution,t.stationId,state.time);ack.lastBit=ackBitAt(state.solution,t.stationId,end);ack.stationId=t.stationId;ack.plannedTransmitEndSeconds=end;ack.payloadRateBps=t.linkRateBps;ack.status='emitting';}catch(error){if(!(error instanceof OperationsError))throw error;}}
}
export function transportNextBoundary(state:OperationsRuntimeState,next:number):number {
 const boundary=(t:number|null)=>{if(t!==null&&t>state.time+EPS)next=Math.min(next,t);};
 for(const command of state.operations.commands){for(const a of command.attempts){if(a.status==='queued')boundary(a.queueDeadlineSeconds);if(a.status==='emitting')boundary(a.plannedTransmitEndSeconds);if(a.firstBit&&a.lastBit&&a.status!=='delivered'){boundary(a.firstBit.arrivesAtSeconds);boundary(a.lastBit.arrivesAtSeconds);}if(!a.groundAttentionExpired)boundary(a.attentionAtSeconds);}for(const ack of command.acknowledgements){if(ack.status==='emitting')boundary(ack.plannedTransmitEndSeconds);if(ack.status==='propagating')boundary(ack.lastBit?.arrivesAtSeconds??null);}}
 // Local ground queue acquisition has a declared 60 s scheduling tick; queued
 // commands do not force 1 s spacecraft integration throughout a long coast.
 if(state.operations.commands.some(c=>c.attempts.some(a=>a.status==='queued'))){boundary((Math.floor((state.time+EPS)/60)+1)*60);for(const command of state.operations.commands)for(const a of command.attempts)if(a.firstBit&&a.lastBit&&a.status!=='emitting')boundary(a.lastBit.emittedAtSeconds+N.uplinkInterframeGapSeconds);}
 return next;
}
/** Integrate preceding interval before install/ACK events. Returns ACK airtime
 * reserved from this interval, even if an interrupted frame is discarded. */
export function integrateCommandTransport(state:OperationsRuntimeState,interval:AttitudeInterval):number {
 const {start,end}=interval;let reservedAckSeconds=0;
 for(const command of state.operations.commands){for(const a of command.attempts){
  if(a.status==='emitting'&&a.firstBit&&a.lastBit&&a.stationId&&a.eirpDbW!==null){const stop=Math.min(end,a.plannedTransmitEndSeconds!),guard=guardGroundEmission(state,a.stationId,start,stop,a.eirpDbW);if(guard.valid){const before=a.emittedBits;a.emittedBits=Math.min(a.totalBits,(stop-a.firstBit.emittedAtSeconds)*N.uplinkInformationRateBps);state.operations.emittedCommandBits+=a.emittedBits-before;if(stop>=a.plannedTransmitEndSeconds!-EPS){a.emittedBits=a.totalBits;a.status='propagating';}}else {a.emissionValid=false;a.truthFailureCode=guard.reasonCode;a.lastBit=commandBitAt(state.solution,a.stationId,start);a.plannedTransmitEndSeconds=start;a.status='lost';}}
  if(a.firstBit&&a.lastBit&&a.stationId&&a.eirpDbW!==null&&a.receptionValid){const receiveStart=Math.max(start,a.firstBit.arrivesAtSeconds),receiveEnd=Math.min(end,a.lastBit.arrivesAtSeconds);if(receiveEnd>receiveStart+EPS){const guard=guardCommandReception(state,a.stationId,receiveStart,receiveEnd,a.eirpDbW,interval);if(!guard.valid){a.receptionValid=false;a.truthFailureCode=guard.reasonCode;}}}
 }
 for(const ack of command.acknowledgements)if(ack.status==='emitting'&&ack.firstBit&&ack.stationId){const stop=Math.min(end,ack.plannedTransmitEndSeconds!),guard=guardAckEmission(state,ack.stationId,start,stop,ack.payloadRateBps,interval);reservedAckSeconds+=stop-start;if(guard.valid){const before=ack.emittedBits;ack.emittedBits=Math.min(ack.totalBits,(stop-ack.firstBit.emittedAtSeconds)*ack.payloadRateBps);state.operations.emittedAckBits+=ack.emittedBits-before;if(stop>=ack.plannedTransmitEndSeconds!-EPS){ack.emittedBits=ack.totalBits;ack.status='propagating';}}else{ack.failureCode=guard.reasonCode;ack.lastBit=ackBitAt(state.solution,ack.stationId,start);ack.plannedTransmitEndSeconds=start;ack.status='lost';}}
 }
 return reservedAckSeconds;
}
