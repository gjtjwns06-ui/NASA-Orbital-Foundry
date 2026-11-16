/** Candidate domain contract. Only M02B adapter is implemented; no product UI yet.
 * All numeric fields must be finite and all hashes verified by runtime validators.
 * Readonly types do not replace clone/freeze at the trusted runtime boundary. */
export type Sha256 = string & {readonly __sha256: unique symbol};
import type {SwingbyReviewRenderDto,SwingbyReviewTelemetry} from './render-types';
export type RunId = string & {readonly __runId: unique symbol};
export type Json = null | boolean | number | string | readonly Json[] | {readonly [key: string]: Json};
export type MissionFamily = 'm02b-swingby' | 'm03-transfer' | 'm03b-remote-operations';
export type LanguagePair = Readonly<{ko: string; en: string}>;

/** Byte identity and semantic comparison identity are deliberately separate. */
export interface ExactRunSource {
  readonly format: 'orbital-foundry-review-run';
  readonly version: 1;
  readonly runId: RunId;
  readonly missionFamily: MissionFamily;
  readonly engineSaveText: string;
  readonly engineSaveSha256: Sha256;
  readonly engineSaveUtf8Bytes: number;
  readonly pinnedAtUtc: string;
  readonly capture: Readonly<{
    origin: 'authoritative-worker' | 'strict-engine-import';
    requestedTimeSeconds: number;
    committedTimeSeconds: number;
  }>;
  /** Informational only; it never supplies physical conditions or a result. */
  readonly displayName: string;
}

/** Obtained from the supported engine adapter after strict replay, never trusted
 * from a review JSON's precomputed score, events, coordinates, or metadata. */
export interface VerifiedRunIdentity {
  readonly modelVersion: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly engineManifestSha256: Sha256;
  readonly hardwareCatalogSha256: Sha256 | null;
  readonly scenarioId: string | null;
  readonly scenarioSha256: Sha256 | null;
  readonly propulsionProfileSha256: Sha256 | null;
  readonly networkModelSha256: Sha256 | null;
  readonly ephemerisDatasetId: string;
  readonly ephemerisSourceHashes: Readonly<Record<string, Sha256>>;
  readonly frame: 'ICRF';
  readonly timeScale: 'TDB';
  readonly initialEpochJdTdb: number;
  readonly initialPhysicalConditionsSha256: Sha256;
  readonly requirementsSha256: Sha256;
  readonly numericalPolicySha256: Sha256;
  readonly score: Readonly<{
    id: string;
    definitionSha256: Sha256;
    origin: 'engine-definition' | 'pinned-version-adapter';
    implementationSha256: Sha256;
  }> | null;
  readonly logCoverage: 'complete' | 'truncated' | 'unknown';
}

export interface VerifiedRun {
  readonly source: ExactRunSource;
  readonly identity: VerifiedRunIdentity;
  readonly simulationStatus: 'running' | 'complete' | 'failed';
  readonly evaluation: Readonly<{
    committedTimeSeconds: number;
    final: boolean;
    completionPolicyId: string;
    stopReason: string | null;
  }>;
  readonly result: Readonly<{
    status: 'success' | 'partial' | 'failed';
    score: number | null;
    received: number;
    required: number;
    energyMinimumWh: number;
    fuelRemainingKg: number;
    totalCost: number;
    budgetRemaining: number;
    navigation: Readonly<Record<string, number | boolean | null>>;
  }>;
  /** Semantic inputs include stable hardware and operational relationships.
   * Names, IDs and array order alone cannot create a physical change. */
  readonly semanticInputs: Readonly<{
    craft: Json;
    trajectoryPlan: Json;
    initialOperations: Json;
    groundActions: Json;
    installedRevisions: Json;
  }>;
  readonly diagnostics: readonly Diagnostic[];
}

export type Target =
  | Readonly<{kind: 'part'; partId: string; signature: PartSignature}>
  | Readonly<{kind: 'part-family'; partKind: string}>
  | Readonly<{kind: 'operation'; operationId: string; revision: number | null;
      signature: Readonly<{kind: string; startSeconds: number; endSeconds: number}>}>
  | Readonly<{kind: 'maneuver'; maneuverId: string; timeSeconds: number}>
  | Readonly<{kind: 'command'; commandId: string; attemptId: string | null}>
  | Readonly<{kind: 'packet'; packetId: string}>
  | Readonly<{kind: 'time'; timeSeconds: number; panel: 'trajectory' | 'resources' | 'timeline'}>;

export interface PartSignature {
  readonly kind: string;
  readonly modelId: string;
  readonly face: string;
  readonly uMeters: number;
  readonly vMeters: number;
  readonly rotationDeg: number;
}
export interface EvidenceReference {
  readonly runId: RunId;
  readonly kind: 'event' | 'burn-record' | 'packet' | 'signal' | 'command' | 'requirement' | 'replay-sample';
  readonly recordId: string;
  readonly recordIndex: number | null;
  readonly timeSeconds: number | null;
  readonly phase: 'pre-event' | 'post-event' | 'interval' | 'result';
  readonly origin: 'recorded' | 'deterministically-replayed';
  readonly values: Readonly<Record<string, Readonly<{
    value: number | string | boolean | null;
    unit: string | null;
  }>>>;
}
export interface Diagnostic {
  readonly id: string;
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly strength: 'recorded-rejection' | 'observed-condition' | 'inspection-suggestion';
  readonly title: LanguagePair;
  readonly explanation: LanguagePair;
  readonly evidence: readonly EvidenceReference[];
  readonly targets: readonly Target[];
  /** Never an automatically applied edit or a predicted score gain. */
  readonly suggestedInvestigation: LanguagePair | null;
  readonly knowledge: 'actual-postflight-record' | 'ground-confirmed' | 'ground-unconfirmed';
}

export interface Compatibility {
  readonly mode: 'controlled' | 'contextual-trade-study' | 'blocked';
  readonly evaluationBasis: 'same-terminal-policy' | 'same-committed-time' | 'incompatible';
  readonly blockers: readonly Readonly<{code: string; before: Json; after: Json; detail: LanguagePair}>[];
  readonly changedContext: readonly Readonly<{field: string; before: Json; after: Json}>[];
  readonly allowScoreDelta: boolean;
  readonly allowMetricDelta: boolean;
  readonly allowCommonFrameOverlay: boolean;
}
export interface SemanticChange {
  readonly kind: 'bus' | 'hardware' | 'placement' | 'active-radio' | 'launch-stage'
    | 'aim' | 'trajectory' | 'operation' | 'ground-action' | 'context';
  readonly before: Json;
  readonly after: Json;
  readonly mapping: 'exact' | 'semantic' | 'ambiguous';
  readonly targets: readonly Target[];
}
export interface Comparison {
  readonly beforeRunId: RunId;
  readonly afterRunId: RunId;
  readonly compatibility: Compatibility;
  readonly changes: readonly SemanticChange[];
  readonly deltas: Readonly<Record<string, number>> | null;
  readonly warning: LanguagePair;
}
export interface ReviewPair {
  readonly format: 'orbital-foundry-review-pair';
  readonly version: 1;
  readonly baseline: ExactRunSource;
  readonly attempt: ExactRunSource | null;
  readonly parentRunId: RunId;
}

/** Review is detached from the current live mission. A scene displays only the
 * committed state reported here, not the cursor's uncommitted requested time. */
export interface ReviewCursor {
  readonly runId: RunId;
  readonly sourceSha256: Sha256;
  readonly requestedTimeSeconds: number;
  readonly committedTimeSeconds: number;
  readonly phase: string;
  readonly epochJdTdb: number;
  readonly stateOrigin: 'replayed-actual';
}
export type ReviewRequest =
  | Readonly<{type:'load-archive';sessionId:number;requestId:number}>
  | Readonly<{type:'release-run';sessionId:number;requestId:number;runId:RunId}>
  | Readonly<{type:'import-archive';sessionId:number;requestId:number;text:string;persist:boolean}>
  | Readonly<{type:'save-pair'|'export-pair';sessionId:number;requestId:number;beforeRunId:RunId;afterRunId:RunId|null}>
  | Readonly<{type: 'pin'; sessionId:number; requestId:number; engineSaveText:string;runId:string;displayName:string}>
  | Readonly<{type:'fork';sessionId:number;requestId:number;runId:RunId}>
  | Readonly<{type: 'verify'; sessionId: number; requestId: number; source: ExactRunSource}>
  | Readonly<{type: 'seek'; sessionId: number; requestId: number; runId: RunId; timeSeconds: number}>
  | Readonly<{type: 'inspect'; sessionId: number; requestId: number; runId: RunId; target: Target}>
  | Readonly<{type: 'compare'; sessionId: number; requestId: number; beforeRunId: RunId; afterRunId: RunId}>
  | Readonly<{type: 'cancel'; sessionId: number; requestId: number; cancelledRequestId: number}>;
export type ReviewResponse =
  | Readonly<{type:'archive';sessionId:number;requestId:number;baseline:VerifiedRun|null;attempt:VerifiedRun|null;text:string|null;revision:number|null;persisted:boolean;storageError:string|null;retainedRunIds:readonly RunId[]}>
  | Readonly<{type:'released';sessionId:number;requestId:number;runId:RunId;retainedRunIds:readonly RunId[]}>
  | Readonly<{type:'archive-export';sessionId:number;requestId:number;pair:ReviewPair;text:string}>
  | Readonly<{type:'archive-commit';sessionId:number;requestId:number;revision:number;baselineRunId:RunId;attemptRunId:RunId|null;stale:boolean}>
  | Readonly<{type:'draft';sessionId:number;requestId:number;parentRunId:RunId;draft:Json}>
  | Readonly<{type: 'verified'; sessionId: number; requestId: number; run: VerifiedRun}>
  | Readonly<{type: 'progress'; sessionId: number; requestId: number; fraction: number; committedTimeSeconds: number;runId?:RunId}>
  | Readonly<{type: 'sample'; sessionId: number; requestId: number; cursor: ReviewCursor; renderDto: SwingbyReviewRenderDto; telemetry: SwingbyReviewTelemetry;work:{elapsedMs:number;replayedSteps:number;fromCheckpointSeconds:number}}>
  | Readonly<{type: 'comparison'; sessionId: number; requestId: number; comparison: Comparison}>
  | Readonly<{type: 'cancelled'; sessionId: number; requestId: number;committedRevision?:number}>
  | Readonly<{type: 'error'; sessionId: number; requestId: number; code: string; detail: LanguagePair; preservesPrevious: true}>;
