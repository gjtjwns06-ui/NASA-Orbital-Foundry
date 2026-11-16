import type {PartDefinition,Vec3,Part,Design,OperationKind,Warning} from '../sim/types';
export type BusId='surveyor-l18-v1'|'pathfinder-d35-v1';
export type DataInterface='CAN'|'SPI'|'SpaceWire'|'RS422';
export interface LocalBox {center:Vec3;half:Vec3}
export interface Aperture {center:Vec3;width:number;height:number;normal:Vec3;powerFraction?:number}
export interface GeometryProfile {
 id:string;mountFootprint:[number,number];deployedBoxes:LocalBox[];stowedBoxes:LocalBox[];apertures:Aperture[];
 render:{family:string;size:Vec3;variant:string};
}
export interface Rail {id:string;voltageV:number;minimumV:number;maximumV:number;maxPowerW:number}
export interface DataPort {id:string;interface:DataInterface;rateBps:number;drivers:string[]}
export interface BusDefinition {
 id:string;name:string;nameEn:string;description:string;massKg:number;cost:number;fuelKg:number;ispS:number;
 batteryWh:number;storageBits:number;basePowerW:number;chargeLimitW:number;dischargeLimitW:number;
 halfSize:readonly[number,number,number];bay:{min:Vec3;max:Vec3;mountY:number};
 rails:Rail[];dataPorts:DataPort[];totalPowerW:number;mpptGroups:number;solarLimitW:number;conversionEfficiency:number;
}
export interface HardwareModel extends PartDefinition {
 modelId:string;geometry:GeometryProfile;
 electrical?:{minimumV:number;maximumV:number;peakW:number};
 data?:{interfaces:DataInterface[];driver:string;maxRateBps:number};
 solar?:{mpptGroups:number};
 radio?:{band:'UHF'|'X';frequencyHz:number;rfPowerW:number;signalModesBps:number[];payloadFraction:number;ebNoDb:number};
 antenna?:{band:'UHF'|'X';peakGainDbi:number;pattern:'crossed-dipole'|'reflector';halfPowerAngleDeg:number};
 optics?:{halfAngleDeg:number;pixelsAcross:number;bitsPerFrame:number;exposureSeconds:number;kind:'image'|'spectrum';ifovRad:number;regionReadout?:{precision:number;survey:number};windowPixelsAcross?:number};
 adcs?:{torqueNm:number;momentumNms:number;slewPowerW:number};
 recorder?:{writeRateBps:number;readRateBps:number};
 evidence:{sourceId:string;fields:string[];condition:string}[];
}
export interface HardwareIssue extends Warning {required?:number|string;available?:number|string;relatedPartIds?:string[]}
export interface Connection {partId:string;type:'power'|'data'|'solar'|'rf';endpoint:string;rateBps?:number;voltageV?:number}
export interface ResolvedPart {part:Part;definition:HardwareModel;powered:boolean;dataConnected:boolean;dataRateBps:number}
export interface ResolvedHardware {version:string;catalogHash:string;bus:BusDefinition;parts:ResolvedPart[];connections:Connection[];issues:HardwareIssue[];radioId:string|null;antennaId:string|null;adcsId:string|null;inertiaKgM2:Vec3;centerOfMassM:Vec3;modeLoadW:Record<OperationKind,number>;dataWriteRateBps:number;dataReadRateBps:number}
export interface HardwareRuntimeData {angularRateDegS:number;acquisition:{id:string;target:string;startedAt:number;quality:number;bits:number;remainingBits:number;exposureRemainingS:number;kind:'image'|'spectrum';observedPoint?:{latDeg:number;lonDeg:number}}|null}
export type HardwareDesign=Design&{hardwareVersion:'hardware-2.0.0';busId:BusId};
