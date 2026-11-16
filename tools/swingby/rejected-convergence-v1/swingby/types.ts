import type {Design,OrbitalState,Quaternion,Vec3} from '../sim/types';
import type {TransferEnvironment,TransferOperation,TransferPacket,TransferSignal} from '../transfer/types';
import type {HardwareRuntimeData} from '../hardware/types';

export const SWINGBY_MODEL_VERSION='swingby-1.0.0' as const;
export interface LocalArc {
 version:1;muKm3S2:number;epochSeconds:number;elapsedAtEpochSeconds:number;
 periapsis:OrbitalState;eccentricity:number;semiMajorMagnitudeKm:number;periapsisRadiusKm:number;
}
export interface AimPlane {centerKm:Vec3;normal:Vec3;xAxis:Vec3;yAxis:Vec3}
export interface PropulsionProfile {
 id:string;hash:string;provenance:'game-assumption';engineModelId:'chemical230-v2';
 carrierMassKg:number;carrierCost:number;maximumGimbalDeg:number;prepareLeadSeconds:number;
 valveLeadSeconds:number;pointingToleranceDeg:number;angularRateToleranceDegS:number;
 geometry:{envelope:{center:Vec3;half:Vec3};annulus:{center:Vec3;outerRadiusM:number;innerRadiusM:number;thicknessM:number};
  pivot:Vec3;nominalThrust:Vec3;bell:{lengthM:number;mouthRadiusM:number;neckRadiusM:number}};
}
export interface SwingbyScenario {
 id:string;hash:string;modelVersion:typeof SWINGBY_MODEL_VERSION;status:'candidate'|'validated';
 epochJdTdb:number;frame:'ICRF';timeScale:'TDB';initial:OrbitalState;initialFuelKg:number;
 correctionSeconds:number;controlX:Vec3;controlY:Vec3;aimPlane:AimPlane;
 control:{maxAxisMps:number;maxMagnitudeMps:number;solverVersion:string;aimResidualKm:number};
 exit:{radiusKm:number;targetDirection:Vec3;toleranceDeg:number;energyRangeKm2S2:[number,number]};
 safetyAltitudeKm:number;patchRadiusKm:number;deadlineSeconds:number;
 science:{targetPackets:number;minimumQuality:number;captureIntervalS:number;uniqueBinS:number};
 ephemeris:{datasetId:string;earthHash:string;marsHash:string};propulsionProfileId:string;propulsionHash:string;
}
export interface SwingbyPlan {version:1;scenarioId:string;scenarioHash:string;aim:{xKm:number;yKm:number};operations:TransferOperation[]}
export interface ExitMeasurement {
 time:number;jdTdb:number;localPositionKm:Vec3;localVelocityKmS:Vec3;
 heliocentricPositionKm:Vec3;heliocentricVelocityKmS:Vec3;outwardRadialSpeedKmS:number;
 energyKm2S2:number;directionErrorDeg:number;directionPassed:boolean;energyPassed:boolean;
}
export interface SwingbyOrbitSolution {
 correction:{time:number;xMps:number;yMps:number;vectorMps:Vec3;residualKm:number};
 arcs:LocalArc[];periapsisSeconds:number;periapsisAltitudeKm:number;exit:ExitMeasurement;patchExitSeconds:number;
}
export interface SwingbySolution extends SwingbyOrbitSolution {
 modelVersion:typeof SWINGBY_MODEL_VERSION;scenarioHash:string;inputHash:string;plan:SwingbyPlan;
 predictedFuelUsedKg:number;
}
export interface SwingbyIssue {code:string;severity:'error'|'warning';message:string;partId?:string}
export interface SwingbyEvaluation {
 launchable:boolean;issues:SwingbyIssue[];loadedMassKg:number;initialFuelKg:number;requiredFuelKg:number;
 availableDeltaVMps:number;carrierMassKg:number;carrierCost:number;totalCost:number;budget:number;
 gimbalAngleDeg:number;enginePartId:string|null;
}
export interface BurnExecutionRecord {
 id:'correction';time:number;status:'fired'|'skipped'|'no-op';reasons:string[];
 before:OrbitalState;after:OrbitalState;attitudeQuaternion:Quaternion;
 requestedDeltaVMps:Vec3;actualDeltaVMps:Vec3;fuelBeforeKg:number;fuelUsedKg:number;fuelAfterKg:number;
 centerOfMassM:Vec3;thrustDirectionBody:Vec3;gimbalAngleDeg:number;pointingErrorDeg:number;angularRateDegS:number;
}
export interface SwingbyNumerics {cruiseStepSeconds:60|300;activeStepSeconds:1|.5|.25}
export interface SwingbyRuntime {
 version:1;modelVersion:typeof SWINGBY_MODEL_VERSION;scenarioHash:string;propulsionHash:string;
 craft:Design;solution:SwingbySolution;time:number;requestedTime:number;numerics:SwingbyNumerics;
 energyWh:number;energyMinimumWh:number;fuelKg:number;safeMode:boolean;status:'running'|'complete'|'failed';failureReason:string|null;
 attitudeQuaternion:Quaternion;hardwareData?:HardwareRuntimeData;packets:TransferPacket[];signals:TransferSignal[];
 events:{time:number;code:string;message:string;severity:'info'|'warning'|'error';reasonCode?:string}[];
 pendingFrames:{packetId:string;bits:number}[];processedEventIds:string[];lastCapture:number;scienceReceived:number;tick:number;
 burn:BurnExecutionRecord|null;actualArcs:LocalArc[];actualPeriapsisSeconds:number;actualPatchExitSeconds:number;achievedExit:ExitMeasurement|null;
 burnPreparationSeconds:number;minimumAltitudeKm:number;
}
export type SwingbyEnvironment=TransferEnvironment;
export interface SwingbyRequirement {id:'direction'|'energy'|'safety'|'science';status:'pending'|'passed'|'failed'|'unreached';actual:number|null;limit?:number;range?:number[]}
export interface SwingbySave {
 format:'orbital-foundry-swingby';version:1;modelVersion:typeof SWINGBY_MODEL_VERSION;savedAt:string;
 scenarioId:string;scenarioHash:string;propulsionHash:string;hardwareCatalogHash:string;
 datasetId:string;sourceHashes:{earth:string;mars:string};numerics:SwingbyNumerics;
 plan:SwingbyPlan;craft:Design;checkpoint?:Record<string,unknown>;
}
