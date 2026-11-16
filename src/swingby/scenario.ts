import {normalize} from '../sim/physics';
import type {Vec3} from '../sim/types';
import {TRANSFER_DATASET_ID,TRANSFER_DATA_SOURCES} from '../transfer/ephemeris';
import {canonicalOperationsJson,operationsSha256} from '../transfer/operations-codec';
import {freezeTransferInput} from '../transfer/immutable';
import {localArcFromCartesian,localArcRadiusTime,localArcStateAt} from './conic';
import {SWINGBY_MODEL_VERSION} from './types';
import type {PropulsionProfile,SwingbyScenario} from './types';
export const swingbyHash=(value:unknown)=>operationsSha256(canonicalOperationsJson(value));
const propulsion:Omit<PropulsionProfile,'hash'>={id:'cg-trim-impulse-v1',provenance:'game-assumption',engineModelId:'chemical230-v2',carrierMassKg:.4,carrierCost:12,maximumGimbalDeg:10,prepareLeadSeconds:1800,valveLeadSeconds:60,pointingToleranceDeg:.1,angularRateToleranceDegS:.01,
 geometry:{envelope:{center:[0,0,.30],half:[.19,.19,.30]},annulus:{center:[0,0,.07],outerRadiusM:.18,innerRadiusM:.07,thicknessM:.04},pivot:[0,0,.12],nominalThrust:[0,0,-1],bell:{lengthM:.46,mouthRadiusM:.10,neckRadiusM:.025}}};
export const SWINGBY_PROPULSION:Readonly<PropulsionProfile>=freezeTransferInput({...propulsion,hash:swingbyHash(propulsion)});
const initial={positionKm:[440153.29982437415,-37808.39413296271,-68263.51721821795] as Vec3,velocityKmS:[-3.00918327149763,.30687738020424615,.4886458295047531] as Vec3};
const inbound=localArcFromCartesian(initial),controlX:Vec3=[.1562129374280655,.9062145631889668,.39290289340284285],controlY:Vec3=[-.10517112631692882,.4107856306096325,-.9056457364079372],normal:Vec3=[-.9821082182577061,.1001515409211235,.15947763630615536];
const definition:Omit<SwingbyScenario,'hash'>={id:'mars-exit-corridor-2027-v1',modelVersion:SWINGBY_MODEL_VERSION,status:'candidate',epochJdTdb:2461617.8583186734,frame:'ICRF',timeScale:'TDB',initial,initialFuelKg:.25,correctionSeconds:3600,controlX,controlY,
 aimPlane:{centerKm:localArcStateAt(inbound,localArcRadiusTime(inbound,30000,'inbound')).positionKm,normal,xAxis:controlX,yAxis:controlY},
 control:{maxAxisMps:7,maxMagnitudeMps:8,solverVersion:'bounded-aim-newton-1',aimResidualKm:.01},
 exit:{radiusKm:100000,targetDirection:normalize([16.0771950773341,-15.997929860769286,-7.476894084426893]),toleranceDeg:.12,energyRangeKm2S2:[-284.5,-279.5]},safetyAltitudeKm:250,patchRadiusKm:577000,deadlineSeconds:96*3600,
 science:{targetPackets:3,minimumQuality:.4,captureIntervalS:120,uniqueBinS:300},ephemeris:{datasetId:TRANSFER_DATASET_ID,earthHash:TRANSFER_DATA_SOURCES.earth.sha256,marsHash:TRANSFER_DATA_SOURCES.mars.sha256},propulsionProfileId:propulsion.id,propulsionHash:SWINGBY_PROPULSION.hash};
const scenario:Readonly<SwingbyScenario>=freezeTransferInput({...definition,hash:swingbyHash(definition)});
export function getSwingbyScenario(){return scenario;}
export const SWINGBY_MISSION_BUDGET=760;
