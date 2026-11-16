/** Body coordinates: metres, kilograms, radians; quaternion maps local to body.
 * The eventual orbital adapter declares its inertial frame separately. */
export type Vec3=[number,number,number];
export type Quaternion=[number,number,number,number];
/** Row-major symmetric matrices still retain off-diagonal products of inertia. */
export type Matrix3=[number,number,number,number,number,number,number,number,number];
export interface Pose {positionM:Vec3;quaternion:Quaternion}
export interface LocalBox {id:string;centerM:Vec3;halfM:Vec3;quaternion?:Quaternion;contactRole?:'hinge-bearing'|'mount-pad';renderRole?:'panel-substrate'|'parent-bearing'|'child-bearing'|'pin'|'support'|'electronics'|'bus';jointId?:string}
export interface MassElement {id:string;massKg:number;centerM:Vec3;inertiaKgM2:Matrix3}
export interface ApertureDefinition {
 id:string;centerM:Vec3;normal:Vec3;tangentU:Vec3;tangentV:Vec3;widthM:number;heightM:number;
 kind:'solar'|'rf'|'optical';peakPowerW?:number;
 /** Only this face is excluded from its own emitted rays; siblings still block. */
 emittingBoxId:string;
}
export interface RigidLinkDefinition {
 id:string;partId:string;boxes:LocalBox[];massElements:MassElement[];apertures:ApertureDefinition[];
 /** Exactly one root pose or incoming hinge owns a link. */
 rootPose?:Pose;
 render:{family:'panel'|'frame'|'feed'|'electronics'|'bus';variant:string};
}
export interface JointDefinition {
 id:string;partId:string;parentLinkId:string;childLinkId:string;
 pivotParentM:Vec3;axisParent:Vec3;pivotChildM:Vec3;restQuaternion:Quaternion;
 minimumRad:number;maximumRad:number;stowedRad:number;deployedRad:number;
}
export interface ContactExemption {
 a:{linkId:string;boxId:string};b:{linkId:string;boxId:string};
 /** Explicit contacting hinge solids only, never an entire part or bus. */
 reason:'hinge-bearing'|'mount-contact';
}
export interface MechanismTopology {
 version:'deployment-geometry-1';links:RigidLinkDefinition[];joints:JointDefinition[];
 contactExemptions:ContactExemption[];
}
export interface JointState {angleRad:number;rateRadS:number}
export type JointStates=Record<string,JointState>;
export interface RigidBodyView {
 linkId:string;partId:string;pose:Pose;relativeLinearVelocityMps:Vec3;relativeAngularVelocityRadS:Vec3;
}
export interface OrientedBoxView {
 id:string;linkId:string;partId:string;centerM:Vec3;halfM:Vec3;axes:[Vec3,Vec3,Vec3];
}
export interface ApertureView extends Omit<ApertureDefinition,'centerM'|'normal'|'tangentU'|'tangentV'> {
 linkId:string;partId:string;centerM:Vec3;normal:Vec3;tangentU:Vec3;tangentV:Vec3;
}
export interface MassProperties {
 massKg:number;centerOfMassM:Vec3;centerOfMassVelocityMps:Vec3;
 lockedInertiaKgM2:Matrix3;shapeMomentumNms:Vec3;
 /** Relative-link kinetic energy with the structural body held fixed, about the whole COM. */
 shapeKineticEnergyJ:number;
}
export interface DeploymentGeometryView {
 revision:number;links:RigidBodyView[];boxes:OrientedBoxView[];apertures:ApertureView[];
 joints:Record<string,{angleRad:number;rateRadS:number;pivotBodyM:Vec3;axisBody:Vec3}>;
 mass:MassProperties;
}
export interface ClearanceWitness {
 a:{partId:string;linkId:string;boxId:string};b:{partId:string;linkId:string;boxId:string};
 jointId:string;angleIntervalRad:[number,number];sampleAngleRad:number;clearanceM:number;
}
export interface ClearanceReport {
 status:'clear'|'blocked'|'uncertain';clearanceM:number;
 angleRangeRad:[number,number];checkedIntervals:number;maximumUnresolvedDisplacementM:number;
 firstWitness:ClearanceWitness|null;firstUncertainWitness:ClearanceWitness|null;
 /** End of the certified prefix in motion order; never a penetration angle. */
 safeThroughAngleRad:number;
}
export interface AngularState {
 /** Body -> declared orbital inertial frame. */
 quaternion:Quaternion;
 totalInertialMomentumNms:Vec3;
 /** Wheel spin angular momentum components in the current body axes. */
 wheelMomentumBodyNms:Vec3;
 angularVelocityBodyRadS:Vec3;
}
export interface ControllerLimits {torqueNm:Vec3;momentumNms:Vec3}
export interface ActuatorProfile {
 id:string;maximumRateRadS:number;accelerationRadS2:number;brakeDecelerationRadS2:number;
 activePowerW:number;releaseSeconds:number;releasePowerW:number;latchSeconds:number;latchPowerW:number;
 provenance:'game-assumption';
}
export type MechanicalPhase='stowed-latched'|'releasing'|'moving'|'braking'|'paused'|'verifying-latch'|'deployed-latched'|'blocked-clearance'|'waiting-power'|'waiting-attitude'|'expired';
export interface MechanismState {
 partId:string;phase:MechanicalPhase;desired:'stowed'|'deployed';jointStates:JointStates;
 actionId:string|null;activeJointId:string|null;remainingVerificationSeconds:number;
 mechanicalLatch:boolean;powerContactClosed:boolean;rfContactClosed:boolean;
 motorEnergyJ:number;phaseStartedAt:number;reasonCode:string|null;
}
export interface MechanismAction {
 id:string;partId:string;desired:'stowed'|'deployed';earliestSeconds:number;deadlineSeconds:number;
 rateProfileId:string;
}
export const DEPLOYMENT_MODEL_VERSION='deployment-1.0.0' as const;
