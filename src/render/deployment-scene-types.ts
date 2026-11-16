import type {Face} from '../sim/types';
import type {ClearanceReport,DeploymentGeometryView,MechanismState,MechanismTopology,Quaternion,Vec3} from '../deployment/types';
import type {HingePreviewRequest} from './hinge-manipulator';

export type DeploymentSceneMode='workshop'|'orbit'|'craft';
export type DeploymentSceneQuality='high'|'medium'|'low';
export interface DeploymentViewport {left:number;right:number;top:number;bottom:number}
/** Supplied by the host from the authoritative catalogue/mount resolver.
 * Orthonormal body-frame axes, metres. The renderer does no catalogue lookup. */
export interface DeploymentMountPlane {
 /** Exact part + face key: internal py bay and exterior py hull differ. */
 partId:string;face:Face;originBodyM:Vec3;normalBody:Vec3;axisUBody:Vec3;axisVBody:Vec3;
 minimumU:number;maximumU:number;minimumV:number;maximumV:number;
}
export interface DeploymentPartMount {
 partId:string;face:Face;u:number;v:number;rotation:number;allowedFaces:Face[];
}
export interface DeploymentCraftView {
 sourceId:string;topology:MechanismTopology;geometry:DeploymentGeometryView;
 mountPlanes:DeploymentMountPlane[];partMounts:DeploymentPartMount[];
}
export interface DeploymentGroundView {
 id:string;positionKm:Vec3;visible:boolean;
}
/** One committed physical instant. positionKm is the whole-craft COM.
 * SI seconds from the explicit TAI epoch; no ICRF/TDB relabelling. */
export interface DeploymentSceneSnapshot {
 sourceId:string;timeSeconds:number;epochTai:string;frame:'EarthMJ2000Eq';
 geometry:DeploymentGeometryView;mechanisms:MechanismState[];
 attitudeQuaternion:Quaternion;
 environment:{positionKm:Vec3;sunDirection:Vec3;eclipse:boolean;ground:DeploymentGroundView[];earthRotationRad:number};
 actualHistory?:Array<{timeSeconds:number;positionKm:Vec3}>;
}
export interface DeploymentPreviewView {
 /** sourceId is the current actual/base source; requestId identifies the candidate. */
 sourceId:string;requestId:string;geometry:DeploymentGeometryView;
 /** Required when placement changes local boxes (including bus mount pads). */
 topology?:MechanismTopology;
 candidateSourceId?:string;
 /** Optional explicit changed-part mask; a placement host normally supplies one part. */
 changedPartIds?:string[];
 kind:'editor'|'clearance-witness';report?:ClearanceReport;
}
export interface DeploymentPreviewPending {sourceId:string;requestId:string}
export interface DeploymentPlacementRequest extends Omit<DeploymentPartMount,'allowedFaces'> {
 stage:'preview'|'commit'|'cancel';sourceId:string;
 original:Pick<DeploymentPartMount,'face'|'u'|'v'|'rotation'>;
 authority:'editor-candidate-only';
}
export interface DeploymentSceneCallbacks {
 partSelected?:(partId:string|null)=>void;
 placementCandidate?:(request:DeploymentPlacementRequest)=>void;
 hingePreview?:(request:HingePreviewRequest)=>void;
 contextLost?:()=>void;contextRestored?:()=>void;
 visibilityChanged?:(visible:boolean)=>void;
}
export interface DeploymentSceneOptions {
 quality?:DeploymentSceneQuality;reducedMotion?:boolean;
 /** Preserve the player's craft view relative to the changing real orbital radial. */
 orbitalInspectionFollow?:boolean;
 /** Optional high-quality compressed Earth day-map ceiling; 0 keeps the 4K map. */
 earthDetailMaximumSize?:0|8192|16384;
 /** Original surface shading only; no change to geometry or physical state. */
 surfaceFinish?:'flat'|'textured';
 /** Host supplies the same Earth radius used by its physical model. */
 earthRadiusKm:number;
}
export interface DeploymentSceneState {
 mode:DeploymentSceneMode;sourceId:string|null;timeSeconds:number|null;
 frame:'EarthMJ2000Eq'|null;epochTai:string|null;
 geometryRevision:number|null;selectedPartId:string|null;selectedJointId:string|null;
 preview:{acceptedRequestId:string|null;acceptedSourceId:string|null;pending:DeploymentPreviewPending|null;kind:DeploymentPreviewView['kind']|null;visible:boolean};
 placementActive:boolean;contextLost:boolean;visible:boolean;workshopEditable:boolean;
 display:{metresToWorld:number;kilometresToWorld:number;craftExaggerated:boolean;physicalStructuralOriginKm:Vec3|null};
}
