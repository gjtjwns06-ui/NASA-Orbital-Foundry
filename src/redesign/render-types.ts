import type {Design,Quaternion} from '../sim/types';
import type {TransferPacket,TransferSignal,TransferStateVector} from '../transfer/types';
import type {BurnExecutionRecord,ExitMeasurement,SwingbyRuntime} from '../swingby/types';
import type {getSwingbyTelemetry} from '../swingby/runtime';
/** The existing sanitizer maps absent/nonfinite observations to null. Preserve
 * that uncertainty in the public type instead of silently promising a number. */
export type Observed<T>=T extends number?number|null:T extends undefined?null:T extends readonly unknown[]?{[K in keyof T]:Observed<T[K]>}:T extends object?{[K in keyof T]:Observed<T[K]>}:T;
export interface SwingbyReviewTelemetry {readonly values:Observed<ReturnType<typeof getSwingbyTelemetry>>;readonly unknownFields:readonly string[]}
export type ReviewFocus=
 | {kind:'part';partIds:string[];mapping:'exact'|'semantic'}
 | {kind:'part-family';partKind:string;partIds?:string[]}
 | {kind:'operation';operationId:string;mapping:'exact'|'semantic'}
 | {kind:'maneuver';maneuverId:string}
 | {kind:'packet';packetId:string}
 | {kind:'time';panel:'trajectory'|'resources'|'timeline'};
/** Detached display DTO. It is never an input checkpoint for the physical engine. */
export interface SwingbyReviewRenderDto {
 readonly craft:Design;
 readonly physical:TransferStateVector;
 readonly attitudeQuaternion:Quaternion;
 readonly burn:BurnExecutionRecord|null;
 readonly achievedExit:ExitMeasurement|null;
 readonly packets:readonly TransferPacket[];
 readonly signals:readonly TransferSignal[];
 readonly events:Readonly<SwingbyRuntime['events']>;
 readonly trajectory:{readonly kind:'actual-history';readonly certified:boolean;readonly maxChordErrorKm:number;readonly points:readonly TransferStateVector[];readonly sampleLimit:number};
 readonly status:SwingbyRuntime['status'];
 readonly reviewFocus?:ReviewFocus;
}
