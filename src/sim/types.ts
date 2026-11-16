export type Vec3 = [number, number, number];
export type Quaternion=[number,number,number,number];
export type MissionId = 'earth' | 'mars';
export type LegacyPartKind = 'solar' | 'solarLarge' | 'camera' | 'spectrometer' | 'antenna' | 'battery' | 'engine' | 'storage' | 'radiator';
export type PartKind = LegacyPartKind | 'radio' | 'adcs';
export type Face = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
export interface Part { id:string; kind:PartKind; face:Face; u:number; v:number; rotation:number; modelId?:string }
export type OperationKind = 'charge' | 'observe' | 'downlink';
export interface Operation { id:string; kind:OperationKind; start:number; end:number }
export interface Maneuver {id:string;time:number;progradeMps:number;radialMps:number;normalMps:number}
export interface Plan {
  altitudeKm:number; inclinationDeg:number; burnTime:number;
  progradeMps:number; normalMps:number; radialMps:number;
  periapsisAltitudeKm:number; bPlaneAngleDeg:number; operations:Operation[];
  maneuvers?:Maneuver[];
  /** Opt-in Earth initial ellipse and orthogonal RTN impulses. altitudeKm is
   * the single initial/periapsis altitude; omission preserves legacy circular. */
  earthOrbit?:{version:'earth-ellipse-rtn-1';apoapsisAltitudeKm:number};
}
export interface Design { version:1; missionId:MissionId; name:string; parts:Part[]; plan:Plan; seed:number;hazard?:'none'|'debris';scienceTarget?:import('./targets').ScienceTarget;launchPackageId?:import('./launch').LaunchPackageId;hardwareVersion?:'hardware-2.0.0';busId?:'surveyor-l18-v1'|'pathfinder-d35-v1';activeRadioId?:string }
export interface PartDefinition {
  kind:PartKind; name:string; nameEn:string; category:string; description:string;
  massKg:number; cost:number; idlePowerW:number; activePowerW:number;
  outputW?:number; capacityWh?:number; capacityBits?:number; ispS?:number;
  nominalCapacityWh?:number;chargeLimitW?:number;dischargeLimitW?:number;
  footprint:[number,number]; depth:number; internal?:boolean; maxCount:number;
  color:string; source:string; provenance:'manufacturer-published'|'derived-assembly'|'game-assumption';
  sourceId?:string;sourceFields?:string[];conditions?:string[];assumedMountMassKg?:number;
}
export interface MissionDefinition {
  id:MissionId; title:string; subtitle:string; description:string; budget:number;
  massLimitKg:number; duration:number; targetPackets:number; minimumQuality:number;
  target:string; targetLatDeg:number; targetLonDeg:number; epoch:string;
  constraints:string[]; briefing:string[];
}
export interface Warning { code:string; severity:'error'|'warning'|'info'; message:string; partId?:string }
export interface DesignEvaluation {
  massKg:number; dryMassKg:number; cost:number; batteryWh:number; storageBits:number;
  solarPowerW:number; basePowerW:number; activePowerW:number; deltaVMps:number;
  requiredDeltaVMps:number; fuelKg:number; propellantUsedKg:number; centerOfMass:Vec3;
  warnings:Warning[]; launchable:boolean; cameraCount:number; antennaCount:number;
  chargeLimitW:number;dischargeLimitW:number;
  componentCost:number;launchCost:number;massLimitKg:number;stowedSizeM:Vec3;stowedDiameterM:number;stowedHeightM:number;
}
export interface OrbitalState { positionKm:Vec3; velocityKmS:Vec3 }
export interface TrajectoryPoint extends OrbitalState { t:number; eclipse:boolean; altitudeKm:number }
export interface FlybyMetrics {
  periapsisKm:number; altitudeKm:number; eccentricity:number; turnAngleDeg:number;
  incomingSpeedKmS:number; outgoingSpeedKmS:number; heliocentricInKmS:number;
  heliocentricOutKmS:number; speedGainKmS:number; incomingVelocity:Vec3; outgoingVelocity:Vec3;
  safe:boolean; correctionDeltaVMps:number;
  closestTime:number; correctionVectorMps:Vec3;
}
export interface ConjunctionMetrics {
 enabled:boolean;time:number;minDistanceKm:number;relativeSpeedKmS:number;safe:boolean;contact:boolean;
 thresholdKm:number;contactThresholdKm:number;spacecraftPositionKm:Vec3;debrisPositionKm:Vec3;
}
export interface DataPacket {
  readyAt?:number;
  id:string; target:string; capturedAt:number; quality:number; bits:number;
  transmittedBits:number; receivedBits:number; receivedAt:number|null; kind:'image'|'spectrum';
  observedPoint?:import('./targets').GeographicPoint;
}
export interface Transmission { packetId:string; bits:number; arrivesAt:number }
export interface SimEvent { time:number; code:string; message:string; severity:'info'|'warning'|'error' }
export type CommandKind=OperationKind|'resume';
export interface GroundCommand {
  id:string;kind:CommandKind;requestedAt:number;durationSeconds:number;
  status:'queued'|'inflight'|'executed'|'failed';sentAt:number|null;arrivesAt:number|null;executedAt:number|null;reason:string;
}
export interface SimulationState {
  version:1; modelVersion:string; design:Design; time:number; tick:number; remainder:number;
  energyWh:number; fuelKg:number; dataPackets:DataPacket[]; inFlight:Transmission[];
  events:SimEvent[]; status:'running'|'complete'|'failed'; safeMode:boolean;
  lastCapture:number; burnExecuted:boolean; scienceReceived:number; energyMinimumWh:number;
  blockedReason:string|null; lastEventCode:string|null;
  commands:GroundCommand[];
  commandOverride:{kind:OperationKind;endsAt:number;commandId:string}|null;
  executedBurnIds:string[];
  hazardForecastIssued:boolean;hazardPassageRecorded:boolean;
  attitudeQuaternion:Quaternion|null;
  hardwareData?:import('../hardware/types').HardwareRuntimeData;
}
export interface Telemetry {
  time:number; duration:number; positionKm:Vec3; velocityKmS:Vec3; altitudeKm:number;
  speedKmS:number; eclipse:boolean; groundVisible:boolean; linkReady:boolean;
  linkRateBps:number; lightTimeS:number; linkMarginDb:number; solarPowerW:number;
  loadPowerW:number; energyWh:number; batteryWh:number; storedBits:number; storageBits:number;
  receivedBits:number; transmittedBits:number; scienceReceived:number; targetPackets:number;
  operation:OperationKind; observing:boolean; observationQuality:number; targetVisible:boolean;
  panelVisibility:number; cameraVisibility:number; antennaVisibility:number;
  safeMode:boolean; fuelKg:number; status:string; reason:string; attitude:'sun'|'target'|'earth';
  bodyAxes:{x:Vec3;y:Vec3;z:Vec3};
  commandLinkReady:boolean;pendingCommands:number;commandStatus:string;
  chargeLimitW:number;dischargeLimitW:number;curtailedPowerW:number;
  debrisDistanceKm:number|null;hazardStatus:string|null;
  requestedBodyAxes:{x:Vec3;y:Vec3;z:Vec3};slewing:boolean;slewAngleDeg:number;slewRemainingS:number;
  targetEvaluation:import('./targets').EarthTargetEvaluation|null;
  surfaceTargetPositionKm:Vec3|null;contactTargetPositionKm:Vec3|null;contactDirection:Vec3;
}
export interface MissionResult {
  modelVersion?:string;scoreDefinitionId?:string;simulationStatus?:'running'|'complete'|'failed';
  requirements?:{targetPackets:number;minimumQuality:number;deadlineSeconds:number};eventLogCoverage?:'complete'|'truncated'|'unknown';
  evaluatedAt:number;
  status:'success'|'partial'|'failed'; title:string; scienceScore:number; missionScore:number;
  resourceScore:number; score:number; received:number; required:number; reasons:string[];
  recommendations:string[]; budgetRemaining:number; energyMinimumWh:number; fuelRemainingKg:number;
  timeline:SimEvent[]; packets:DataPacket[]; design:Design;
  commandHistory?:GroundCommand[];
  hazard?:ConjunctionMetrics;
}
export interface MissionPreview { finalState:SimulationState; result:MissionResult; samples:Telemetry[] }
export interface SaveFile { format:'orbital-foundry'; version:1; modelVersion:string; savedAt:string; design:Design; simulation?:SimulationState; previousResult?:MissionResult;migrationNotice?:string;hardwareCatalogHash?:string }
