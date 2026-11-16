import type {Design,Vec3} from '../sim/types';
import type {FullTransferPlan,FullTransferSolution,TransferOperation,TransferRuntimeState} from './types';

/** All protocol times are elapsed TDB seconds from the immutable departure. */
export const OPERATIONS_MODEL_VERSION='transfer-3.0.0' as const;
export type ActiveStepSeconds=1|.5|.25;
export interface OperationsNumerics {cruiseStepSeconds:300|600;activeStepSeconds:ActiveStepSeconds}
export interface ScheduleReplacement {kind:'replace-schedule';baseRevision:number;replaceFromSeconds:number;operations:TransferOperation[]}
export type GroundAction=
 |{sequence:number;actionId:string;commandId:string;issuedAtSeconds:number;kind:'queue';expiresAtSeconds:number;payload:ScheduleReplacement}
 |{sequence:number;actionId:string;commandId:string;issuedAtSeconds:number;kind:'cancel-unsent'|'retry'};
export interface QueueCommandOptions {actionId:string;commandId:string;expiresAtSeconds?:number}
export type GroundCommandStatus='queued'|'transmitting'|'awaiting-confirmation'|'confirmed'|'rejected'|'unconfirmed'|'cancelled'|'expired';
export interface CommandEnvelope {commandId:string;expiresAtSeconds:number;payload:ScheduleReplacement}
export interface SignalBitEndpoint {emittedAtSeconds:number;arrivesAtSeconds:number;emitterPositionKm:Vec3;receiverPositionKm:Vec3}
/** Renderer geometry is actual ICRF km. A future last endpoint is explicitly
 * marked planned until emitted; signal progress never implies Earth knowledge. */
export interface CommandSignalView {
 id:string;commandId:string;attempt:number;kind:'command'|'ack';stationId:string;
 firstBit:SignalBitEndpoint;lastBit:SignalBitEndpoint;lastBitIsPlanned:boolean;
 emittedBits:number;totalBits:number;
 status:'emitting'|'propagating'|'receiving'|'delivered'|'lost';
}
export interface CommandInstallation {commandId:string;attempt:number;payloadHash:string;revision:number;installedAtSeconds:number;replaceFromSeconds:number;scheduleHash:string}
export interface CommandDecision {commandId:string;attempt:number;payloadHash:string;status:'installed'|'rejected';revision:number;decidedAtSeconds:number;installedAtSeconds:number|null;duplicate:boolean;scheduleHash:string;reasonCode:string|null}
export interface CommandAttempt {
 id:string;attempt:number;queuedSequence:number;queuedAtSeconds:number;queueDeadlineSeconds:number;
 status:'queued'|'emitting'|'propagating'|'receiving'|'delivered'|'lost'|'cancelled'|'expired';
 stationId:string|null;eirpDbW:number|null;firstBit:SignalBitEndpoint|null;lastBit:SignalBitEndpoint|null;
 plannedTransmitEndSeconds:number|null;emittedBits:number;arrivedBits:number;totalBits:number;
 emissionValid:boolean;receptionValid:boolean;truthFailureCode:string|null;
 attentionAtSeconds:number|null;groundAttentionExpired:boolean;
}
export interface AckFrame {
 id:string;commandId:string;attempt:number;decision:CommandDecision;
 status:'queued'|'emitting'|'propagating'|'delivered'|'lost';stationId:string|null;
 firstBit:SignalBitEndpoint|null;lastBit:SignalBitEndpoint|null;plannedTransmitEndSeconds:number|null;
 payloadRateBps:number;emittedBits:number;totalBits:number;receivedAtSeconds:number|null;failureCode:string|null;
}
export interface CommandRecord {
 id:string;queueSequence:number;issuedAtSeconds:number;envelope:CommandEnvelope;canonicalBytes:string;payloadHash:string;payloadBytes:number;frameBits:number;
 attempts:CommandAttempt[];acknowledgements:AckFrame[];
}
export interface GroundCommandView {
 id:string;sequence:number;issuedAtSeconds:number;expiresAtSeconds:number;payload:ScheduleReplacement;status:GroundCommandStatus;
 transmissionFraction:number|null;transmittedBits:number;frameBits:number;
 estimatedReceiveAtSeconds:number|null;acknowledgedAtSeconds:number|null;acknowledgedRevision:number|null;
 reasonCode:string|null;canCancel:boolean;canRetry:boolean;
}
export interface OperationsSnapshot {
 ground:{confirmedRevision:number;confirmedOperations:TransferOperation[];latestAcknowledgedRevision:number;confirmationChainComplete:boolean;commands:GroundCommandView[]};
 onboardTruth:{revision:number;operations:TransferOperation[];installations:CommandInstallation[];decisions:CommandDecision[]};
 signals:CommandSignalView[];
}
export interface OperationsProtocolState {
 journal:GroundAction[];commands:CommandRecord[];onboardRevision:number;onboardOperations:TransferOperation[];
 installations:CommandInstallation[];decisions:CommandDecision[];
 groundConfirmedRevision:number;groundConfirmedOperations:TransferOperation[];groundLatestAcknowledgedRevision:number;
 groundKnownSchedules:{revision:number;operations:TransferOperation[];scheduleHash:string}[];
 groundReceivedAcks:{ackId:string;decision:CommandDecision;receivedAtSeconds:number}[];
 emittedCommandBits:number;emittedAckBits:number;receivedAckBits:number;
}
export interface OperationsRuntimeState extends Omit<TransferRuntimeState,'modelVersion'> {
 modelVersion:typeof OPERATIONS_MODEL_VERSION;scenarioId:string;commandNetworkId:string;commandNetworkHash:string;
 numerics:OperationsNumerics;operations:OperationsProtocolState;
}
export interface OperationsIssue {code:string;message:string;severity:'error'|'warning'}
export interface CommandPreview {
 baseTime:number;validation:OperationsIssue[];valid:boolean;estimatedTransmitStart:number|null;
 estimatedTransmitEnd:number|null;estimatedReceiveAt:number|null;estimatedAckAt:number|null;assumptions:string[];
}
export interface OperationsLesson {
 id:string;name:string;nameEn:string;description:string;craft:Design;plan:FullTransferPlan;
 listeningWindow:{start:number;end:number};suggestedCommandAtSeconds:number;
 suggestedPayload:ScheduleReplacement;suggestedExpirySeconds:number;
}
export interface OperationsRuntimeOptions {scenarioId?:string;integrationStepSeconds?:300|600;activeStepSeconds?:ActiveStepSeconds}
export interface TransferEngineOptions extends OperationsRuntimeOptions {modelVersion?:'transfer-1.0.0'|'transfer-2.0.0'|'transfer-3.0.0'}
export type AnyTransferRuntimeState=TransferRuntimeState|OperationsRuntimeState;
export interface ReplayProgress {status:'running'|'complete'|'cancelled';fraction:number;committedTime:number;targetTime:number}
export interface TransferReplayTask<T> {readonly progress:ReplayProgress;step(maxSteps?:number):ReplayProgress;cancel():void;result():T}
export interface OperationsSaveFile {
 format:'orbital-foundry-journey';version:2;modelVersion:typeof OPERATIONS_MODEL_VERSION;savedAt:string;
 datasetId:string;sourceHashes:{earth:string;mars:string};hardwareCatalogHash:string;commandNetworkId:string;commandNetworkHash:string;
 scenarioId:string;numerics:OperationsNumerics;plan:FullTransferPlan;craft:Design;journal:GroundAction[];
 checkpoint?:Record<string,unknown>;editorDraft?:ScheduleReplacement;
}
// Stable facade signatures, implemented in engine.ts after the domain modules.
export interface TransferEngineContract {
 create(solution:FullTransferSolution,craft:Design,options?:TransferEngineOptions):AnyTransferRuntimeState;
 advance(state:AnyTransferRuntimeState,elapsedSeconds:number,maxSteps?:number):AnyTransferRuntimeState;
}
