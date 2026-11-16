import { evaluateEscapeStage } from "./transfer/planning";
import {
  trySolveTransferEnginePlan,
  createTransferEngineRuntime,
  advanceTransferEngine,
  getTransferEngineTelemetry,
  getTransferEngineResult,
  makeTransferEngineSave,
  serializeTransferEngineSave,
  saveTransferEngineLocal,
  createTransferEngineReplay,
  isOperationsRuntime,
  queueTransferCommand,
  cancelUnsentTransferCommand,
  retryTransferCommand,
  getTransferOperationsSnapshot,
  previewTransferCommand,
  OperationsError,
} from "./transfer/engine";
import type {
  AnyTransferRuntimeState,
  TransferEngineOptions,
  TransferReplayTask,
} from "./transfer/operations-types";
import type { LoadedTransferEngineSave } from "./transfer/engine";
import type { Design } from "./sim/types";
import type { FullTransferSolution, FullTransferPlan } from "./transfer/types";
import { TransferControlClock } from "./transfer-control";

const controls = new TransferControlClock();
let solution: FullTransferSolution | null = null,
  craft: Design | null = null,
  runtime: AnyTransferRuntimeState | null = null;
let options: TransferEngineOptions = {},
  replay: TransferReplayTask<LoadedTransferEngineSave> | null = null;
let flightPlan: FullTransferPlan | null = null;
type TransactionOutcome = {
  type: string;
  committedTime?: number;
  action?: unknown;
  operation?: string;
  code?: string;
  error?: string;
  actionId?: string;
};
let lastBarrier: {
  epoch: number;
  fingerprint: string;
  outcome: TransactionOutcome | null;
} | null = null;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
function controlFingerprint(m: any) {
  return JSON.stringify(
    canonical({
      type: m.type,
      target: m.target,
      actionId: m.actionId,
      commandId: m.commandId,
      payload: m.payload,
      expiresAtSeconds: m.expiresAtSeconds,
    }),
  );
}
let saveQueue: Promise<void> = Promise.resolve();
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const post = (message: Record<string, unknown>) =>
  self.postMessage({
    requestId: controls.requestId,
    controlEpoch: controls.controlEpoch,
    ...message,
  });
function runtimeMessage(type = "runtime", extra: Record<string, unknown> = {}) {
  if (!runtime) return;
  post({
    type,
    state: runtime,
    telemetry: getTransferEngineTelemetry(runtime),
    result:
      runtime.status !== "running" ? getTransferEngineResult(runtime) : null,
    operations: isOperationsRuntime(runtime)
      ? getTransferOperationsSnapshot(runtime)
      : null,
    committedTime: runtime.time,
    ...extra,
  });
}
function begin(requestId: number, clear = true) {
  if (!controls.begin(requestId)) return false;
  replay?.cancel();
  replay = null;
  lastBarrier = null;
  if (clear) {
    runtime = null;
    solution = null;
    craft = null;
    flightPlan = null;
    options = {};
  } else if (runtime) runtime.requestedTime = runtime.time;
  return true;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (!m || typeof m !== "object") return;
  try {
    if (m.type === "restore") {
      // Keep the current flight paused until the candidate has passed its entire
      // replay. A malformed/forged import must not destroy a playable mission.
      if (!begin(m.requestId, false)) return;
      const id = controls.requestId,
        task = createTransferEngineReplay(m.text);
      replay = task;
      while (task.progress.status === "running") {
        if (!controls.sameSession(id)) {
          task.cancel();
          return;
        }
        task.step(500);
        if (task.progress.status === "running") {
          post({ type: "restore-progress", ...task.progress });
          await yieldTask();
        }
      }
      if (!controls.sameSession(id) || task.progress.status !== "complete")
        return;
      const save = task.result();
      replay = null;
      solution = save.runtime?.solution ?? null;
      craft = save.craft;
      runtime = save.runtime ?? null;
      flightPlan = save.plan;
      options = {
        modelVersion:
          save.modelVersion as TransferEngineOptions["modelVersion"],
        scenarioId: save.scenarioId,
        ...(save.save.version === 2
          ? {
              integrationStepSeconds: save.save.numerics.cruiseStepSeconds,
              activeStepSeconds: save.save.numerics.activeStepSeconds,
            }
          : {}),
      };
      post({
        type: "restored",
        plan: save.plan,
        craft,
        solution,
        options,
        editorDraft: save.editorDraft ?? null,
        evaluation: solution ? evaluateEscapeStage(solution, craft) : null,
        state: runtime,
        telemetry: runtime ? getTransferEngineTelemetry(runtime) : null,
        operations:
          runtime && isOperationsRuntime(runtime)
            ? getTransferOperationsSnapshot(runtime)
            : null,
        result:
          runtime && runtime.status !== "running"
            ? getTransferEngineResult(runtime)
            : null,
      });
      return;
    }
    if (m.type === "solve") {
      if (!begin(m.requestId)) return;
      const id = controls.requestId;
      craft = structuredClone(m.craft);
      flightPlan = structuredClone(m.plan);
      options = structuredClone(m.options ?? {});
      const answer = trySolveTransferEnginePlan(m.plan, craft!, options);
      post({ type: "solved", ...answer });
      if (answer.status !== "solved") return;
      solution = answer.solution;
      const preview = createTransferEngineRuntime(solution, craft!, options);
      advanceTransferEngine(preview, solution.durationSeconds, 500);
      while (
        preview.status === "running" &&
        preview.time < preview.solution.durationSeconds - 1e-6
      ) {
        if (!controls.sameSession(id)) return;
        post({
          type: "progress",
          fraction: preview.time / preview.solution.durationSeconds,
        });
        await yieldTask();
        if (!controls.sameSession(id)) return;
        advanceTransferEngine(preview, 0, 500);
      }
      if (controls.sameSession(id))
        post({ type: "preview", result: getTransferEngineResult(preview) });
      return;
    }
    if (!controls.sameSession(m.requestId)) return;
    if (m.type === "save" && craft) {
      const id = controls.requestId,
        epoch = controls.controlEpoch;
      const plan = m.plan ?? flightPlan;
      if (!plan) throw new OperationsError("INVALID_INPUT");
      // Snapshot before IDB: later controls cannot change this saved checkpoint.
      const save = makeTransferEngineSave(plan, craft, runtime ?? undefined, {
        ...options,
        editorDraft: m.editorDraft ?? undefined,
      });
      if (m.export)
        post({
          type: "export",
          text: serializeTransferEngineSave(save),
          controlEpoch: epoch,
        });
      else {
        saveQueue = saveQueue
          .catch(() => {})
          .then(() => saveTransferEngineLocal(save));
        await saveQueue;
        if (controls.sameSession(id))
          post({ type: "saved", saveId: m.saveId, controlEpoch: epoch });
      }
      return;
    }
    if (replay) return;
    if (m.type === "preview-operations") {
      if (
        !controls.acceptAdvance(m.requestId, m.controlEpoch) ||
        !runtime ||
        !isOperationsRuntime(runtime)
      )
        return;
      // A detached estimate cannot mutate the journal, live resources or route.
      const preview = previewTransferCommand(
        structuredClone(runtime),
        m.payload,
        { expiresAtSeconds: m.expiresAtSeconds, commandId: m.commandId },
      );
      post({
        type: "operations-preview",
        draftRevision: m.draftRevision,
        ...preview,
      });
      return;
    }
    if (m.type === "advance") {
      if (!runtime || !controls.acceptAdvance(m.requestId, m.controlEpoch))
        return;
      if (!Number.isFinite(m.delta) || m.delta < 0)
        throw new OperationsError("INVALID_INPUT");
      advanceTransferEngine(runtime, m.delta, 500);
      runtimeMessage();
      return;
    }
    const isCommand = [
      "queue-operations",
      "cancel-operations",
      "retry-operations",
    ].includes(m.type);
    if (!["launch", "warp", "pause"].includes(m.type) && !isCommand) return;
    const key = isCommand ? `${m.type}:${m.actionId}` : m.type;
    const fingerprint = controlFingerprint(m),
      previousEpoch = controls.controlEpoch;
    if (!controls.acceptBarrier(m.requestId, m.controlEpoch, key)) return;
    if (previousEpoch === m.controlEpoch && lastBarrier) {
      if (lastBarrier.fingerprint !== fingerprint)
        throw new OperationsError("ACTION_ID_CONFLICT");
      const outcome = lastBarrier.outcome;
      if (outcome) {
        if (outcome.type === "error")
          post({
            ...outcome,
            state: runtime,
            telemetry: runtime ? getTransferEngineTelemetry(runtime) : null,
            operations:
              runtime && isOperationsRuntime(runtime)
                ? getTransferOperationsSnapshot(runtime)
                : null,
          });
        else runtimeMessage(outcome.type, outcome);
      }
      return;
    }
    lastBarrier = { epoch: m.controlEpoch, fingerprint, outcome: null };
    if (m.type === "launch") {
      if (solution && craft && !runtime)
        runtime = createTransferEngineRuntime(solution, craft, options);
    } else if (runtime) {
      // Cancel old warp demand at committed time before assigning command time.
      const alreadyRecorded =
        isCommand &&
        isOperationsRuntime(runtime) &&
        runtime.operations.journal.some(
          (action) => action.actionId === m.actionId,
        );
      if (!alreadyRecorded) runtime.requestedTime = runtime.time;
      if (m.type === "warp") {
        if (!Number.isFinite(m.target))
          throw new OperationsError("INVALID_INPUT");
        const target = Math.max(
          runtime.time,
          Math.min(runtime.solution.durationSeconds, m.target),
        );
        advanceTransferEngine(runtime, target - runtime.time, 500);
      } else if (isCommand) {
        if (!isOperationsRuntime(runtime))
          throw new OperationsError("MODEL_UNSUPPORTED");
        const action =
          m.type === "queue-operations"
            ? queueTransferCommand(runtime, m.payload, {
                actionId: m.actionId,
                commandId: m.commandId,
                expiresAtSeconds: m.expiresAtSeconds,
              })
            : m.type === "cancel-operations"
              ? cancelUnsentTransferCommand(runtime, m.commandId, m.actionId)
              : retryTransferCommand(runtime, m.commandId, m.actionId);
        const outcome = {
          type: "operations-state",
          actionId: m.actionId,
          action,
          committedTime: action.issuedAtSeconds,
        };
        lastBarrier.outcome = outcome;
        runtimeMessage("operations-state", outcome);
        return;
      }
    }
    lastBarrier.outcome = { type: "runtime", committedTime: runtime?.time };
    runtimeMessage();
  } catch (error) {
    if (!controls.sameSession(m.requestId)) return;
    if (m.type === "restore") {
      replay?.cancel();
      replay = null;
    }
    const outcome = {
      type: "error",
      operation: m.type,
      actionId: m.actionId,
      committedTime: runtime?.time,
      code: error instanceof OperationsError ? error.code : undefined,
      error: error instanceof Error ? error.message : String(error),
    };
    const barrier = lastBarrier;
    if (
      barrier &&
      barrier.epoch === m.controlEpoch &&
      barrier.fingerprint === controlFingerprint(m) &&
      !barrier.outcome
    )
      barrier.outcome = outcome;
    const extra =
      runtime &&
      [
        "queue-operations",
        "cancel-operations",
        "retry-operations",
        "warp",
        "pause",
        "advance",
        "restore",
      ].includes(m.type)
        ? {
            state: runtime,
            telemetry: getTransferEngineTelemetry(runtime),
            operations: isOperationsRuntime(runtime)
              ? getTransferOperationsSnapshot(runtime)
              : null,
          }
        : {};
    post({
      ...outcome,
      saveId: m.saveId,
      draftRevision: m.draftRevision,
      ...extra,
      ...(m.type === "restore"
        ? { retained: !!craft, plan: flightPlan, craft, solution, options }
        : {}),
    });
  }
};
