import type {Design,OrbitalState,Quaternion,Vec3,Warning} from '../sim/types';
import type {solvePatchedTransfer} from './math';
export type {Vec3,OrbitalState};
export type TransferPhase='earth-escape'|'solar-coast'|'mars-flyby';
export type EscapeStageId='pathfinder'|'explorer'|'heavy';
export type TransferOperationKind='charge'|'observe'|'downlink';
export interface TransferOperation {id:string;kind:TransferOperationKind;start:number;end:number}
export interface FullTransferPlan {
 version:1;ephemerisDatasetId:string;departurePeriapsisJdTdb:number;arrivalPeriapsisJdTdb:number;
 earthParkingAltitudeKm:number;marsPeriapsisAltitudeKm:number;departurePlaneAngleRad:number;marsBPlaneAngleRad:number;
 launchStageId:EscapeStageId;operations:TransferOperation[];
}
export interface TransferPhaseEvent {id:'departure'|'earth-exit'|'mars-entry'|'periapsis'|'mars-exit';elapsedSeconds:number;jdTdb:number}
export interface FullTransferSolution {
 version:1;modelVersion:string;status:'solved';plan:FullTransferPlan;datasetId:string;sourceHashes:{earth:string;mars:string};
 durationSeconds:number;periapsisSeconds:number;earthExitSeconds:number;marsEntrySeconds:number;phaseEvents:TransferPhaseEvent[];
 trajectory:ReturnType<typeof solvePatchedTransfer>;
 c3Km2S2:number;arrivalVInfinityKmS:Vec3;departureVInfinityKmS:Vec3;escapeBurnMps:number;
 boundaryPositionResidualKm:number;boundaryVelocityResidualKmS:number;
 scheduleWarnings:string[];
}
export interface TransferStateVector {
 elapsedSeconds:number;jdTdb:number;phase:TransferPhase;frame:'ICRF';
 heliocentricPositionKm:Vec3;heliocentricVelocityKmS:Vec3;relativePositionKm:Vec3;relativeVelocityKmS:Vec3;
 centerPositionKm:Vec3;centerVelocityKmS:Vec3;centerBody:'Earth'|'Sun'|'Mars';altitudeKm:number;
 earth:OrbitalState;mars:OrbitalState;
}
export interface TransferEnvironment {
 state:TransferStateVector;sunDirection:Vec3;sunDistanceAU:number;eclipse:boolean;
 earthDirection:Vec3;earthDistanceKm:number;contactDistanceKm:number;contactTargetPositionKm:Vec3;
 groundStationId:string|null;groundVisible:boolean;earthLinkOcculted:boolean;solarConjunction:boolean;lightTimeSeconds:number;
 targetDirection:Vec3;targetPositionKm:Vec3;targetIlluminated:boolean;
}
export interface EscapeStage {
 id:EscapeStageId;name:string;description:string;dryMassKg:number;fuelKg:number;ispS:number;
 maxPayloadKg:number;payloadFairingDiameterM:number;payloadFairingHeightM:number;cost:number;provenance:'game-assumption';
}
export interface EscapeStageEvaluation {
 stage:EscapeStage;payloadMassKg:number;stageInitialMassKg:number;stageAfterBurnMassKg:number;
 availableDeltaVMps:number;requiredDeltaVMps:number;fuelUsedKg:number;stageFuelRemainingKg:number;
 payloadFuelUnchangedKg:number;componentCost:number;stageCost:number;totalCost:number;budget:number;
 launchable:boolean;warnings:Warning[];
}
export type TransferSolveResult={status:'solved';solution:FullTransferSolution;evaluation:EscapeStageEvaluation}|{status:'infeasible';errors:string[]};
export interface TransferPacket {id:string;capturedAt:number;readyAt?:number;bits:number;quality:number;transmittedBits:number;receivedBits:number;receivedAt:number|null}
export interface TransferSignal {id:string;packetId:string;bits:number;sentAt:number;arrivesAt:number;stationId:string}
export interface TransferEvent {time:number;code:string;message:string;severity:'info'|'warning'|'error';reasonCode?:string}
export interface TransferRuntimeState {
 hardwareData?:import('../hardware/types').HardwareRuntimeData;
 version:1;modelVersion:string;solution:FullTransferSolution;craft:Design;time:number;requestedTime:number;
 energyWh:number;energyMinimumWh:number;fuelKg:number;safeMode:boolean;status:'running'|'complete'|'failed';failureReason:string|null;
 attitudeQuaternion:Quaternion;packets:TransferPacket[];signals:TransferSignal[];events:TransferEvent[];
 pendingFrames:{packetId:string;bits:number}[];
 processedEventIds:string[];lastCapture:number;scienceReceived:number;tick:number;
 integrationStepSeconds:300|600;
}
