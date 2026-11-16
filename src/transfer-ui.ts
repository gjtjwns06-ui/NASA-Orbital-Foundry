import "./transfer-ui.css";
import "./ui-transfer-operations.css";
import {
  operationsPanelHTML,
  liveOperationsTimelineHTML,
} from "./ui-transfer-operations";
import { operationsText } from "./operations-i18n";
import { editOperationOnGrid } from "./operations-editor";
import {
  loadTransferEngineLocalText,
  createOperationsLesson,
} from "./transfer/engine";
import type { TransferOperation } from "./transfer/types";
import type {
  AnyTransferRuntimeState,
  TransferEngineOptions,
  OperationsLesson,
  OperationsSnapshot,
  ScheduleReplacement,
  CommandPreview,
} from "./transfer/operations-types";
import { transferText } from "./transfer-i18n";
import { getLanguage, t as translate } from "./i18n";
import { createDesign } from "./sim/catalog";
import { createHardwareTransferDesign, getPartDefinition } from "./hardware";
import type { Design } from "./sim/types";
import {
  createTransferPlan,
  createHardwareTransferPlan,
  ESCAPE_STAGES,
  jdToTdbCalendar,
  tdbCalendarToJd,
} from "./transfer";
import type {
  FullTransferPlan,
  FullTransferSolution,
  EscapeStageEvaluation,
  TransferResult,
  TransferTelemetry,
  EscapeStageId,
} from "./transfer";
import { TransferScene } from "./render/transfer-scene";
import { TransferPlanComparison } from "./transfer-plan-comparison";
import {
  calendarDateDiagnostic,
  repairTransferDates,
  transferDateBounds,
  transferDateIssue,
  transferDateIssueText,
  type TransferDateIssue,
} from "./transfer/date-window";

const word = (ko: string, en: string) => (getLanguage() === "ko" ? ko : en);
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const fmt = (n: number | null | undefined, d = 0) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: d })
    : "—";
const clock = (seconds: number) =>
  `${Math.floor(seconds / 86400)}d ${String(Math.floor(seconds / 3600) % 24).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}`;
const commandClock = (seconds: number) =>
  `${clock(seconds)}:${String(Math.floor(seconds) % 60).padStart(2, "0")}`;
const stamp = (jd: number) => jdToTdbCalendar(jd);
const phaseName = (phase: string) =>
  ({
    "earth-escape": word("지구 탈출", "Earth escape"),
    "solar-coast": word("행성 간 순항", "Interplanetary cruise"),
    "mars-flyby": word("화성 근접비행", "Mars flyby"),
  })[phase] || phase;
const eventMessage = (event: {
  code: string;
  message: string;
  reasonCode?: string;
}) => {
  const message = event.reasonCode
    ? operationsText(event.reasonCode, event.message)
    : transferText(event.message);
  return event.code === "COMMAND_ACK_RECEIVED"
    ? `${word("지구에 확인 응답 도착", "Acknowledgement reached Earth")} · ${message}`
    : message;
};
type Callbacks = {
  exit: () => void;
  edit: (craft: Design, plan: FullTransferPlan) => void;
};

export class TransferExperience {
  readonly element = document.createElement("div");
  readonly scene: TransferScene;
  craft: Design;
  plan: FullTransferPlan;
  solution: FullTransferSolution | null = null;
  evaluation: EscapeStageEvaluation | null = null;
  preview: TransferResult | null = null;
  runtime: AnyTransferRuntimeState | null = null;
  telemetry: TransferTelemetry | null = null;
  result: TransferResult | null = null;
  playing = false;
  speed = 86400;
  view: "solar" | "earth" | "mars" = "solar";
  pending = true;
  progress = 0;
  error = "";
  private dateIssue: TransferDateIssue | null = null;
  private recoverRejectedRestore = false;
  private worker: Worker;
  private requestId = 0;
  private planComparison = new TransferPlanComparison();
  private comparisonRoute: {requestId: number; solution: FullTransferSolution} | null = null;
  private revealComparison = false;
  private controlEpoch = 0;
  private engineOptions: TransferEngineOptions = {};
  private lesson: OperationsLesson | null = null;
  private operations: OperationsSnapshot | null = null;
  private operationsDraft: ScheduleReplacement | null = null;
  private draftInitial: ScheduleReplacement | null = null;
  private draftRevision = 0;
  private draftCommandId: string | null = null;
  private commandPreview: CommandPreview | null = null;
  private commandPreviewPending = false;
  private commandAction: string | null = null;
  private editAfterPause = false;
  private operationsDrag: {
    id: string;
    edge: boolean;
    x: number;
    start: number;
    end: number;
    secondsPerPixel: number;
  } | null = null;
  private busy = false;
  private dirty = true;
  private raf = 0;
  private last = performance.now();
  private lastUI = 0;
  private accumulated = 0;
  private warpTarget: number | null = null;
  private nextRequested = false;
  private closed = false;
  private pointerDown = false;
  private timer = 0;
  private saveStatus = "";
  private lastSave = 0;
  private changed = false;
  private localSaveDisabled = false;
  private saveSequence = 0;
  private closing: { saveId: number; done: () => void } | null = null;
  private afterCommand: (() => void) | null = null;
  private inspectionLayoutKey = "";
  private inspectionResizeObserver: ResizeObserver;
  private timelineRange: "approach" | "delivery" = "approach";
  private drag: {
    id: string;
    edge: boolean;
    x: number;
    start: number;
    end: number;
    secondsPerPixel: number;
  } | null = null;
  private onVisibility = () => {
    if (document.hidden) {
      this.playing = false;
      this.nextRequested = false;
      this.warpTarget = null;
      this.control("pause");
      this.dirty = true;
    }
  };
  private onPointerUp = () => {
    this.pointerDown = false;
    this.dirty = true;
    if (this.operationsDrag) {
      this.operationsDrag = null;
      this.previewOperations();
    } else if (this.drag) {
      this.drag = null;
      this.recalculate();
    }
  };
  private onPointerCancel = () => {
    this.pointerDown = false;
    if (this.operationsDrag && this.operationsDraft) {
      const op = this.operationsDraft.operations.find(
        (o) => o.id === this.operationsDrag!.id,
      );
      if (op) {
        op.start = this.operationsDrag.start;
        op.end = this.operationsDrag.end;
      }
      this.operationsDrag = null;
      this.previewOperations();
    }
    if (this.drag) {
      const operation = this.plan.operations.find(
        (o) => o.id === this.drag!.id,
      );
      if (operation) {
        operation.start = this.drag.start;
        operation.end = this.drag.end;
      }
      this.drag = null;
    }
    this.dirty = true;
  };
  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      const editing = !!(this.operationsDrag || this.drag);
      this.onPointerCancel();
      if (editing) return;
      if (this.scene.getCraftInspectionState().enabled) {
        event.preventDefault();
        this.setInspection(false);
        return;
      }
    }
    if (
      event.key.toLowerCase() === "f" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !(event.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable=true]",
      )
    ) {
      event.preventDefault();
      if (this.scene.getCraftInspectionState().enabled)
        this.scene.focusInspectionPart(
          this.scene.getCraftInspectionState().selectedPartId,
        );
      else this.setInspection(true);
      this.dirty = true;
      return;
    }
    const block = (event.target as HTMLElement).closest?.<HTMLElement>(
      "[data-operations-op].editable",
    );
    if (
      block &&
      this.operationsDraft &&
      !this.commandAction &&
      !this.busy &&
      !this.pending &&
      ["ArrowLeft", "ArrowRight"].includes(event.key)
    ) {
      const op = this.operationsDraft.operations.find(
        (o) => o.id === block.dataset.operationsOp,
      );
      if (op) {
        event.preventDefault();
        this.adjustDraftOperation(
          op,
          event.key === "ArrowLeft" ? -1 : 1,
          event.shiftKey ? 600 : 60,
          event.altKey,
        );
        this.previewOperations();
        this.dirty = true;
      }
    }
  };
  constructor(
    craft: Design,
    plan: FullTransferPlan | undefined,
    private callbacks: Callbacks,
    initialSave?: string,
    experienceOptions: {
      engine?: TransferEngineOptions;
      lesson?: OperationsLesson;
    } = {},
  ) {
    this.engineOptions = structuredClone(experienceOptions.engine ?? {});
    if (this.engineOptions.modelVersion === "transfer-3.0.0") this.speed = 60;
    this.lesson = experienceOptions.lesson
      ? structuredClone(experienceOptions.lesson)
      : null;
    this.craft = structuredClone(craft);
    // A newly handed-off assembly draft may still have a debounced save pending.
    // Persist this exact craft/plan even if no control is changed in this view.
    // A verified restore already has a saved snapshot and must not save the
    // constructor's temporary default craft before that restore completes.
    this.changed = !initialSave;
    this.plan = structuredClone(
      plan ||
        (craft.hardwareVersion
          ? createHardwareTransferPlan()
          : createTransferPlan()),
    );
    this.element.id = "transfer-experience";
    this.element.innerHTML =
      '<div class="transfer-viewport"></div><div class="transfer-ui"></div><input class="transfer-import hidden" type="file" accept="application/json,.json">';
    document.body.append(this.element);
    this.scene = new TransferScene(
      this.element.querySelector(".transfer-viewport")!,
      {
        inspectionPartSelected: () => {
          this.dirty = true;
        },
        contextLost: () => {
          this.playing = false;
          this.nextRequested = false;
          this.warpTarget = null;
          if (this.worker) this.control("pause");
          this.saveStatus = word(
            "그래픽 복구 중 임무를 일시정지했습니다.",
            "Mission paused while graphics recover.",
          );
          this.dirty = true;
        },
        dateChange: (kind, jd, commit) => {
          if (this.runtime || this.lesson) return;
          if (commit) this.changeDate(kind, jd);
          else {
            const hint = this.element.querySelector(".transfer-hint");
            if (hint)
              hint.textContent = `${word("선택 날짜", "Selected date")} · ${stamp(jd)} TDB`;
          }
        },
        encounterChange: (altitudeKm, angleRad, commit) => {
          if (this.runtime || this.lesson) return;
          if (commit) {
            this.changed = true;
            this.plan.marsPeriapsisAltitudeKm = altitudeKm;
            this.plan.marsBPlaneAngleRad = angleRad;
            this.recalculate();
          } else {
            const hint = this.element.querySelector(".transfer-hint");
            if (hint)
              hint.textContent = `${word("접근점 미리 보기", "Encounter preview")} · ${fmt(altitudeKm)} km · ${fmt((angleRad * 180) / Math.PI, 1)}° · ${word("놓으면 전체 경로 재계산", "Release to recompute the full trajectory")}`;
          }
        },
        encounterCancel: () => {
          this.dirty = true;
        },
      },
    );
    this.scene.setCraft(this.craft);
    this.scene.clearSolution();
    this.inspectionResizeObserver = new ResizeObserver(() => {
      this.inspectionLayoutKey = "";
      this.dirty = true;
    });
    this.inspectionResizeObserver.observe(this.element);
    this.worker = new Worker(new URL("./transfer.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (e) => this.receive(e.data);
    this.worker.onerror = () => {
      this.error = word(
        "전이 계산이 중단되었습니다. 계획을 다시 계산해 주세요.",
        "Transfer calculation stopped. Recalculate your plan.",
      );
      this.pending = false;
      if (!this.runtime) {
        this.solution = null;
        this.evaluation = null;
        this.preview = null;
        this.scene.clearSolution();
        this.planComparison.reject(this.requestId);
        this.syncPlanComparison();
      }
      this.busy = false;
      this.playing = false;
      this.dirty = true;
    };
    this.element.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-transfer-action]",
      );
      if (button)
        this.action(button.dataset.transferAction!, button.dataset.commandId);
    });
    this.element.addEventListener("change", (e) => this.change(e));
    this.element
      .querySelector<HTMLInputElement>(".transfer-import")!
      .addEventListener("change", async (e) => {
        const input = e.target as HTMLInputElement,
          file = input.files?.[0];
        if (file) {
          if (file.size > 8388608) {
            this.error = word(
              "JSON 파일은 8 MiB 이하여야 합니다. 기존 임무 파일에는 기존 한도가 적용됩니다.",
              "JSON must be at most 8 MiB. Classic mission files retain their original limit.",
            );
            this.dirty = true;
          } else this.restoreText(await file.text());
          input.value = "";
        }
      });
    this.element.addEventListener("pointerdown", (e) => this.pointerStart(e));
    window.addEventListener("pointermove", this.pointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("visibilitychange", this.onVisibility);
    if (initialSave) this.restoreText(initialSave);
    else this.recalculate();
    this.raf = requestAnimationFrame(this.frame);
  }
  private recalculate() {
    if (this.runtime) return;
    this.recoverRejectedRestore = false;
    clearTimeout(this.timer);
    this.requestId++;
    if (this.canComparePlans()) {
      this.planComparison.begin(this.requestId, this.plan, this.craft);
      this.revealComparison = this.planComparison.inspect().canRestore;
    }
    else this.resetPlanComparison();
    this.controlEpoch = 0;
    this.pending = true;
    this.progress = 0;
    this.preview = null;
    this.evaluation = null;
    this.error = "";
    this.dateIssue = transferDateIssue(this.plan);
    if (this.dateIssue) {
      // Invalid input is an editing problem: rerunning the same Worker job cannot fix it.
      this.pending = false;
      this.solution = null;
      this.error = transferDateIssueText(this.dateIssue, getLanguage());
      this.scene.setPlanningPending(false);
      this.scene.clearSolution();
      this.planComparison.reject(this.requestId);
      this.syncPlanComparison();
      this.syncDateFeedback();
      this.dirty = true;
      return;
    }
    this.syncDateFeedback();
    this.scene.setPlanningPending(true);
    this.syncPlanComparison();
    this.dirty = true;
    this.worker.postMessage({
      type: "solve",
      requestId: this.requestId,
      plan: this.plan,
      craft: this.craft,
      options: this.engineOptions,
    });
  }
  private receive(m: any) {
    if (m.requestId !== this.requestId || this.closed) return;
    if (
      (m.type === "runtime" ||
        m.type === "operations-state" ||
        m.type === "operations-preview" ||
        (m.type === "error" &&
          m.operation !== "save" &&
          m.operation !== "solve" &&
          m.operation !== "restore")) &&
      m.controlEpoch !== this.controlEpoch
    )
      return;
    if (m.type === "operations-preview") {
      if (!this.operationsDraft || m.draftRevision !== this.draftRevision)
        return;
      this.commandPreviewPending = false;
      this.commandPreview =
        this.runtime && m.baseTime === this.runtime.time ? m : null;
      this.dirty = true;
      return;
    }
    if (m.type === "restore-progress") {
      this.progress = m.fraction;
      this.saveStatus = word(
        `비행 기록을 검증하고 있습니다 · ${Math.floor(m.fraction * 100)}%`,
        `Verifying flight history · ${Math.floor(m.fraction * 100)}%`,
      );
      this.dirty = true;
      return;
    }
    if (m.type === "solved") {
      this.scene.setPlanningPending(false);
      if (m.status === "infeasible") {
        this.planComparison.reject(this.requestId);
        this.solution = null;
        this.scene.clearSolution();
        this.error = m.errors.join(" ");
        this.pending = false;
      } else {
        if (this.canComparePlans()) this.planComparison.solved(this.requestId, m.solution, m.evaluation);
        this.solution = m.solution;
        this.evaluation = m.evaluation;
        this.scene.setSolution(m.solution);
        this.scene.setDateEditing(!this.lesson);
        this.scene.setEpoch(0);
      }
      this.syncPlanComparison();
    } else if (m.type === "progress") {
      this.progress = m.fraction;
    } else if (m.type === "preview") {
      this.pending = false;
      this.progress = 1;
      this.preview = m.result;
      if (this.canComparePlans()) this.planComparison.finish(this.requestId, m.result);
      this.syncPlanComparison();
      if (this.changed) this.save();
    } else if (m.type === "restored") {
      this.resetPlanComparison();
      this.controlEpoch = m.controlEpoch;
      this.editAfterPause = false;
      this.pending = false;
      this.playing = false;
      this.busy = false;
      this.warpTarget = null;
      this.plan = m.plan;
      this.craft = m.craft;
      this.solution = m.solution;
      this.evaluation = m.evaluation;
      this.runtime = m.state;
      this.telemetry = m.telemetry;
      this.result = m.result;
      this.engineOptions = m.options ?? {};
      if (this.engineOptions.modelVersion === "transfer-3.0.0") this.speed = 60;
      this.lesson =
        this.engineOptions.scenarioId === "iris-schedule-rescue-v1"
          ? createOperationsLesson()
          : null;
      this.operations = m.operations ?? null;
      this.operationsDraft = m.editorDraft ?? null;
      this.draftInitial = this.operationsDraft
        ? {
            ...structuredClone(this.operationsDraft),
            operations: structuredClone(
              this.operations?.ground.confirmedOperations.filter(
                (op) => op.start >= this.operationsDraft!.replaceFromSeconds,
              ) ?? [],
            ),
          }
        : null;
      this.draftCommandId = this.operationsDraft ? crypto.randomUUID() : null;
      this.commandAction = null;
      this.scene.setCraft(this.craft);
      if (m.solution) this.scene.setSolution(m.solution);
      else this.scene.clearSolution();
      this.scene.setDateEditing(!m.state && !this.lesson);
      this.scene.setEpoch(m.state?.time ?? 0);
      this.scene.setAttitude(m.state ? m.state.attitudeQuaternion : null);
      this.scene.setCommandSignals(this.operations?.signals ?? []);
      if (m.state && m.state.status !== "running") {
        this.view = "solar";
        this.scene.setView(this.view);
      }
      this.saveStatus = word(
        "저장된 임무를 검증해 불러왔습니다.",
        "Saved mission verified and restored.",
      );
      if (!m.state) this.recalculate();
      else if (this.operationsDraft) this.previewOperations();
    } else if (m.type === "saved") {
      this.saveStatus = word("이 브라우저에 저장됨", "Saved in this browser");
      if (this.closing && this.closing.saveId === m.saveId) {
        const done = this.closing.done;
        this.closing = null;
        done();
        return;
      }
    } else if (m.type === "export") {
      const url = URL.createObjectURL(
          new Blob([m.text], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "orbital-foundry-earth-mars.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.saveStatus = word(
        "JSON 백업을 내려받았습니다.",
        "JSON backup downloaded.",
      );
    } else if (m.type === "runtime" || m.type === "operations-state") {
      const before = this.runtime;
      if (!before) this.resetPlanComparison();
      this.busy = false;
      this.runtime = m.state;
      this.telemetry = m.telemetry;
      this.result = m.result;
      this.operations = m.operations ?? null;
      if (m.type === "operations-state" && m.actionId === this.commandAction) {
        this.commandAction = null;
        if (m.action?.kind === "queue") this.clearOperationsDraft();
      }
      this.scene.setDateEditing(false);
      this.scene.setEpoch(m.state.time);
      this.scene.setAttitude(m.state.attitudeQuaternion);
      this.scene.setCommandSignals(this.operations?.signals ?? []);
      if (this.warpTarget !== null && m.state.time >= this.warpTarget - 1e-5) {
        this.playing = false;
        this.warpTarget = null;
      }
      if (m.state.status !== "running") {
        this.playing = false;
        this.warpTarget = null;
        if (
          before?.status === "running" &&
          !this.scene.getCraftInspectionState().enabled
        ) {
          this.view = "solar";
          this.scene.setView(this.view);
        }
      }
      if (this.nextRequested && m.state.status === "running")
        this.beginMilestoneWarp();
      if (this.editAfterPause) {
        this.editAfterPause = false;
        this.openOperationsDraft();
      } else if (
        this.operationsDraft &&
        this.commandPreview?.baseTime !== m.state.time &&
        !this.commandPreviewPending
      )
        this.previewOperations();
      if (
        !this.localSaveDisabled &&
        !this.closing &&
        !this.afterCommand &&
        (!before ||
          m.type === "operations-state" ||
          before.processedEventIds.length !==
            m.state.processedEventIds.length ||
          before.status !== m.state.status)
      )
        this.save();
    } else if (m.type === "error") {
      if (m.operation === "restore") {
        this.controlEpoch = m.controlEpoch;
        this.editAfterPause = false;
        this.pending = false;
        this.recoverRejectedRestore = !m.retained && !m.state;
      }
      if (m.operation === "preview-operations") {
        if (m.draftRevision !== this.draftRevision) return;
        this.commandPreviewPending = false;
        this.commandPreview = null;
      }
      if (m.actionId === this.commandAction) this.commandAction = null;
      if (m.state) {
        this.runtime = m.state;
        this.telemetry = m.telemetry;
        this.operations = m.operations ?? null;
        this.scene.setEpoch(m.state.time);
        this.scene.setAttitude(m.state.attitudeQuaternion);
        this.scene.setCommandSignals(this.operations?.signals ?? []);
      }
      if (m.operation === "restore" && m.retained) {
        this.plan = m.plan;
        this.craft = m.craft;
        this.solution = m.solution;
        this.engineOptions = m.options ?? {};
        this.scene.setCraft(this.craft);
        if (this.solution) this.scene.setSolution(this.solution);
        else this.scene.clearSolution();
        this.scene.setEpoch(this.runtime?.time ?? 0);
        this.scene.setAttitude(this.runtime?.attitudeQuaternion ?? null);
        this.scene.setDateEditing(!this.runtime && !this.lesson);
        this.scene.setCommandSignals(this.operations?.signals ?? []);
        if (this.operationsDraft) this.previewOperations();
      }
      if (m.operation === "save") {
        this.saveStatus = word(
          "브라우저 저장을 사용할 수 없습니다. JSON 백업을 내려받으세요.",
          "Browser storage is unavailable. Download a JSON backup.",
        );
        this.localSaveDisabled = true;
        if (this.closing && this.closing.saveId === m.saveId) {
          const done = this.closing.done;
          this.closing = null;
          done();
          return;
        }
      } else {
        this.error = m.code ? operationsText(m.code, m.error) : m.error;
        this.pending = false;
        if (m.operation === "solve") {
          this.planComparison.reject(this.requestId);
          this.solution = null;
          this.evaluation = null;
          this.preview = null;
          this.scene.clearSolution();
          this.syncPlanComparison();
        }
        this.busy = false;
        this.playing = false;
      }
    }
    this.dirty = true;
    if (!this.commandAction && this.afterCommand) {
      const next = this.afterCommand;
      this.afterCommand = null;
      next();
    }
  }
  private canComparePlans() {
    return !this.runtime && !this.lesson && this.engineOptions.modelVersion !== 'transfer-3.0.0';
  }
  private resetPlanComparison() {
    this.planComparison.reset();
    this.comparisonRoute = null;
    this.revealComparison = false;
    this.scene.setPreviousPlan(null);
  }
  private syncPlanComparison() {
    const previous = this.canComparePlans() ? this.planComparison.previous : null;
    if (!previous) this.comparisonRoute = null;
    else if (this.comparisonRoute?.requestId !== previous.requestId)
      this.comparisonRoute = {requestId: previous.requestId, solution: previous.solution};
    this.scene.setPreviousPlan(this.comparisonRoute?.solution ?? null, !!this.planComparison.inspect().current);
  }
  private changeDate(kind: "departure" | "arrival", jd: number) {
    this.changed = true;
    const oldPeri =
      (this.plan.arrivalPeriapsisJdTdb - this.plan.departurePeriapsisJdTdb) *
      86400;
    if (kind === "departure")
      this.plan.departurePeriapsisJdTdb = Math.round(jd - 0.5) + 0.5;
    else this.plan.arrivalPeriapsisJdTdb = Math.round(jd - 0.5) + 0.5;
    const shift =
      (this.plan.arrivalPeriapsisJdTdb - this.plan.departurePeriapsisJdTdb) *
        86400 -
      oldPeri;
    this.plan.operations = this.plan.operations.map((op) => ({
      ...op,
      start: op.start + shift,
      end: op.end + shift,
    }));
    this.recalculate();
  }
  private change(e: Event) {
    const el = e.target as HTMLInputElement;
    if (this.runtime || this.lesson) return;
    this.changed = true;
    try {
      if (el.dataset.transferDate)
        this.changeDate(
          el.dataset.transferDate as "departure" | "arrival",
          tdbCalendarToJd(el.value),
        );
      else if (el.dataset.transferField === "altitude") {
        this.plan.marsPeriapsisAltitudeKm = Number(el.value);
        this.recalculate();
      } else if (el.dataset.transferField === "angle") {
        this.plan.marsBPlaneAngleRad = (Number(el.value) * Math.PI) / 180;
        this.recalculate();
      } else if (el.dataset.transferField === "stage") {
        this.plan.launchStageId = el.value as EscapeStageId;
        this.recalculate();
      }
    } catch (error) {
      this.error = String(error);
      this.dirty = true;
    }
  }
  private control(type: string, extra: Record<string, unknown> = {}) {
    // A staged restore already paused the retained flight. Advancing the UI's
    // epoch while its worker is replaying would strand the restored session.
    if (this.pending) return;
    if (
      this.commandAction &&
      !["queue-operations", "cancel-operations", "retry-operations"].includes(
        type,
      )
    )
      return;
    if (type !== "launch" && !this.runtime) return;
    this.controlEpoch++;
    if (this.operationsDraft) {
      this.draftRevision++;
      this.commandPreview = null;
      this.commandPreviewPending = false;
    }
    this.busy = true;
    this.accumulated = 0;
    this.worker.postMessage({
      type,
      requestId: this.requestId,
      controlEpoch: this.controlEpoch,
      ...extra,
    });
  }
  private clearOperationsDraft() {
    this.operationsDraft = null;
    this.draftInitial = null;
    this.draftCommandId = null;
    this.operationsDrag = null;
    this.commandPreview = null;
    this.commandPreviewPending = false;
    this.draftRevision++;
    this.dirty = true;
  }
  private openOperationsDraft() {
    if (this.pending) return;
    const ground = this.operations?.ground,
      now = this.runtime?.time;
    if (
      !ground ||
      now === undefined ||
      !ground.confirmationChainComplete ||
      this.runtime?.status !== "running"
    )
      return;
    let boundary =
      this.lesson && this.lesson.suggestedPayload.replaceFromSeconds > now
        ? this.lesson.suggestedPayload.replaceFromSeconds
        : Math.ceil(
            now + Math.max(120, (this.telemetry?.lightTimeS ?? 0) + 300),
          );
    // Keep an activity already crossing the chosen boundary intact. Drafts
    // are constructed exclusively from the last schedule Earth has confirmed.
    for (const op of [...ground.confirmedOperations].sort(
      (a, b) => a.start - b.start,
    ))
      if (op.start < boundary && op.end > boundary) boundary = op.end;
    this.operationsDraft = {
      kind: "replace-schedule",
      baseRevision: ground.confirmedRevision,
      replaceFromSeconds: boundary,
      operations: structuredClone(
        ground.confirmedOperations.filter((op) => op.start >= boundary),
      ),
    };
    this.draftInitial = structuredClone(this.operationsDraft);
    this.draftCommandId = crypto.randomUUID();
    this.timelineRange = "approach";
    this.previewOperations();
    this.dirty = true;
  }
  private previewOperations() {
    if (
      this.pending ||
      !this.operationsDraft ||
      !this.runtime ||
      !this.operations
    )
      return;
    this.commandPreview = null;
    this.commandPreviewPending = true;
    this.draftRevision++;
    this.worker.postMessage({
      type: "preview-operations",
      requestId: this.requestId,
      controlEpoch: this.controlEpoch,
      draftRevision: this.draftRevision,
      payload: this.operationsDraft,
      commandId: this.draftCommandId,
    });
    this.dirty = true;
  }
  private changedOperations() {
    if (!this.operationsDraft || !this.draftInitial) return 0;
    const changed = this.operationsDraft.operations.filter((op) => {
      const old = this.draftInitial!.operations.find((o) => o.id === op.id);
      return (
        !old ||
        old.start !== op.start ||
        old.end !== op.end ||
        old.kind !== op.kind
      );
    }).length;
    return (
      changed +
      this.draftInitial.operations.filter(
        (op) =>
          !this.operationsDraft!.operations.some((next) => next.id === op.id),
      ).length
    );
  }
  private adjustDraftOperation(
    op: TransferOperation,
    direction: number,
    step: number,
    edge: boolean,
  ) {
    if (!this.operationsDraft || !this.solution) return;
    const minimum = Math.max(
        this.runtime?.time ?? 0,
        this.operationsDraft.replaceFromSeconds,
      ),
      maximum = this.solution.durationSeconds;
    const edited = editOperationOnGrid(op, direction * step, edge, {
      minimumStart: minimum,
      maximumEnd: maximum,
      gridOrigin: this.solution.periapsisSeconds,
    });
    op.start = edited.start;
    op.end = edited.end;
  }
  private commandPanelHTML() {
    const ground = this.operations?.ground;
    if (!ground || !this.runtime) return "";
    return operationsPanelHTML({
      confirmedRevision: ground.confirmedRevision,
      latestAcknowledgedRevision: ground.latestAcknowledgedRevision,
      confirmationChainComplete: ground.confirmationChainComplete,
      commands: ground.commands.map((command, index) => ({
        id: command.id,
        label: word(`일정 변경 ${index + 1}`, `Schedule revision ${index + 1}`),
        status: command.status,
        issuedLabel: `${word("지상 요청", "Requested on Earth")} · T+${commandClock(command.issuedAtSeconds)}`,
        transmissionFraction: command.transmissionFraction,
        estimateLabel:
          command.estimatedReceiveAtSeconds === null
            ? undefined
            : `T+${commandClock(command.estimatedReceiveAtSeconds)}`,
        acknowledgedLabel:
          command.acknowledgedAtSeconds === null
            ? undefined
            : `T+${commandClock(command.acknowledgedAtSeconds)}`,
        reason: command.reasonCode
          ? operationsText(command.reasonCode)
          : undefined,
        canCancel:
          command.canCancel &&
          !this.commandAction &&
          !this.busy &&
          !this.pending,
        canRetry:
          command.canRetry &&
          !this.commandAction &&
          !this.busy &&
          !this.pending,
      })),
      editing: !!this.operationsDraft,
      locked: this.pending || !!this.commandAction,
      canEdit:
        this.runtime.status === "running" &&
        ground.confirmationChainComplete &&
        !this.pending &&
        !this.busy &&
        !this.commandAction,
      canSend:
        !!this.commandPreview?.valid &&
        this.commandPreview.baseTime === this.runtime.time &&
        this.changedOperations() > 0 &&
        !this.commandAction &&
        !this.pending &&
        !this.busy &&
        ground.confirmationChainComplete,
      previewPending: this.commandPreviewPending,
      changedBlocks: this.changedOperations(),
      validation:
        this.commandPreview?.validation.map((issue) =>
          operationsText(issue.code, issue.message),
        ) ?? [],
      estimateLabel:
        this.commandPreview?.estimatedReceiveAt != null
          ? `T+${commandClock(this.commandPreview.estimatedReceiveAt)}${this.commandPreview.estimatedAckAt !== null ? ` · ${word("지구 응답 예상", "estimated Earth ACK")} T+${commandClock(this.commandPreview.estimatedAckAt)}` : ""}`
          : undefined,
    });
  }
  private action(name: string, commandId?: string) {
    if (this.closing || this.afterCommand) return;
    if (name === 'restore-previous-plan') {
      if (!this.canComparePlans() || this.busy) return;
      const plan = this.planComparison.restorePlan();
      if (!plan) return;
      // Restore the submitted plan verbatim. changeDate would shift its operations again.
      this.plan = plan;
      this.changed = true;
      this.recalculate();
      return;
    }
    if (
      this.commandAction &&
      ["exit", "save", "export", "load", "import"].includes(name)
    ) {
      this.afterCommand = () => this.action(name, commandId);
      this.dirty = true;
      return;
    }
    if (name === "dismiss-error") {
      this.error = "";
      this.dirty = true;
      return;
    }
    if (name === "repair-dates") {
      if (this.runtime || this.lesson || this.pending) return;
      const repaired = repairTransferDates(this.plan);
      if (!repaired) return;
      this.plan = repaired;
      this.changed = true;
      this.recalculate();
      return;
    }
    if (name === "open-valid-plan") {
      if (!this.runtime && !this.pending && this.recoverRejectedRestore) this.recalculate();
      return;
    }
    if (name === "edit-dates") {
      this.error = "";
      this.renderUI();
      this.dirty = false;
      const input = this.element.querySelector<HTMLInputElement>(
        `[data-transfer-date="${this.dateIssue?.kind ?? 'arrival'}"]`,
      );
      input?.focus();
      return;
    }
    if (name.startsWith("operations-")) {
      if (
        this.pending ||
        !this.operations ||
        !this.runtime ||
        this.commandAction
      )
        return;
      if (name === "operations-edit") {
        if (
          this.busy ||
          !this.operations.ground.confirmationChainComplete ||
          this.runtime.status !== "running"
        )
          return;
        this.playing = false;
        this.nextRequested = false;
        this.warpTarget = null;
        this.editAfterPause = true;
        this.control("pause");
      } else if (name === "operations-discard") {
        this.clearOperationsDraft();
        this.save();
      } else if (name === "operations-send") {
        if (
          !this.operationsDraft ||
          this.busy ||
          !this.changedOperations() ||
          !this.operations.ground.confirmationChainComplete
        )
          return;
        if (
          !this.commandPreview?.valid ||
          this.commandPreview.baseTime !== this.runtime.time
        ) {
          this.previewOperations();
          return;
        }
        this.commandAction = crypto.randomUUID();
        this.playing = false;
        this.nextRequested = false;
        this.warpTarget = null;
        this.control("queue-operations", {
          actionId: this.commandAction,
          commandId: this.draftCommandId ?? crypto.randomUUID(),
          payload: structuredClone(this.operationsDraft),
        });
      } else if (
        commandId &&
        (name === "operations-cancel" || name === "operations-retry")
      ) {
        const command = this.operations.ground.commands.find(
          (c) => c.id === commandId,
        );
        if (
          this.busy ||
          !command ||
          (name === "operations-cancel"
            ? !command.canCancel
            : !command.canRetry)
        )
          return;
        this.commandAction = crypto.randomUUID();
        this.playing = false;
        this.nextRequested = false;
        this.warpTarget = null;
        this.control(
          name === "operations-cancel"
            ? "cancel-operations"
            : "retry-operations",
          { commandId, actionId: this.commandAction },
        );
      }
      this.dirty = true;
      return;
    }
    if (
      (this.operationsDraft || this.commandAction) &&
      (name === "play" ||
        name === "next" ||
        name === "listening-window" ||
        name.startsWith("speed-"))
    )
      return;
    if (
      name === "listening-window" &&
      !this.pending &&
      this.lesson &&
      this.runtime &&
      this.runtime.status === "running" &&
      !this.busy
    ) {
      const target = this.lesson.suggestedCommandAtSeconds;
      if (target > this.runtime.time) {
        this.nextRequested = false;
        this.playing = true;
        this.warpTarget = target;
        this.control("warp", { target });
        this.dirty = true;
      }
      return;
    }
    if (
      this.pending &&
      this.runtime &&
      (name === "play" || name === "next" || name.startsWith("speed-"))
    )
      return;
    if (name === "save") {
      this.save();
      return;
    }
    if (name === "export") {
      this.worker.postMessage({
        type: "save",
        requestId: this.requestId,
        plan: this.plan,
        export: true,
        editorDraft: this.operationsDraft,
      });
      return;
    }
    if (name === "load") {
      void loadTransferEngineLocalText(
        this.engineOptions.modelVersion === "transfer-3.0.0"
          ? "operations"
          : this.craft.hardwareVersion
            ? "hardware"
            : "legacy",
      )
        .then((text) => {
          if (text) this.restoreText(text);
          else {
            this.saveStatus = word(
              "저장된 전이 임무가 없습니다.",
              "No saved transfer mission.",
            );
            this.dirty = true;
          }
        })
        .catch((error) => {
          this.error = String(error);
          this.dirty = true;
        });
      return;
    }
    if (name === "import") {
      this.element.querySelector<HTMLInputElement>(".transfer-import")!.click();
      return;
    }
    if (name === "exit") {
      this.closeAfterSave(() => {
        this.dispose();
        this.callbacks.exit();
      });
      return;
    }
    if (name === "edit") {
      if (this.runtime || this.busy || this.lesson) return;
      const craft = structuredClone(this.craft),
        plan = structuredClone(this.plan);
      this.closeAfterSave(() => {
        this.dispose();
        this.callbacks.edit(craft, plan);
      });
      return;
    }
    if (name.startsWith("view-")) {
      if (name === "view-craft") {
        this.setInspection(!this.scene.getCraftInspectionState().enabled);
        return;
      }
      this.view = name.slice(5) as typeof this.view;
      this.scene.setView(this.view);
      this.dirty = true;
      return;
    }
    if (name === "inspection-whole") {
      this.scene.focusInspectionPart(null);
      this.dirty = true;
      return;
    }
    if (
      name === "launch" &&
      !this.runtime &&
      !this.busy &&
      !this.pending &&
      this.preview &&
      this.solution &&
      this.evaluation?.launchable
    ) {
      this.changed = true;
      this.playing = false;
      this.busy = true;
      this.control("launch");
      return;
    }
    if (name === "play") {
      this.playing = !this.playing;
      this.accumulated = 0;
      if (!this.playing) {
        this.nextRequested = false;
        this.warpTarget = null;
        this.control("pause");
      }
      this.dirty = true;
      return;
    }
    if (name.startsWith("speed-")) {
      this.speed = Number(name.slice(6));
      this.nextRequested = false;
      this.warpTarget = null;
      this.accumulated = 0;
      this.control("pause");
      this.dirty = true;
      return;
    }
    if (name === "next" && this.runtime && this.solution) {
      this.nextRequested = true;
      this.playing = false;
      this.accumulated = 0;
      this.warpTarget = null;
      if (!this.busy) this.beginMilestoneWarp();
      else this.control("pause");
      this.dirty = true;
      return;
    }
    if (name === "retry") {
      if (this.pending) return;
      this.nextRequested = false;
      this.accumulated = 0;
      this.drag = null;
      this.busy = false;
      this.runtime = null;
      this.operations = null;
      this.commandAction = null;
      this.editAfterPause = false;
      this.clearOperationsDraft();
      this.telemetry = null;
      this.result = null;
      this.playing = false;
      this.warpTarget = null;
      this.scene.setDateEditing(!this.lesson);
      this.scene.setAttitude(null);
      this.recalculate();
      return;
    }
    if (name === "recalculate") {
      this.recalculate();
      return;
    }
    if (name === "timeline-approach" || name === "timeline-delivery") {
      this.timelineRange = name.slice(9) as typeof this.timelineRange;
      this.dirty = true;
      return;
    }
    if (name === "balanced" || name === "science") {
      if (this.runtime || this.busy || this.lesson) return;
      this.resetPlanComparison();
      this.changed = true;
      this.craft = this.craft.hardwareVersion
        ? createHardwareTransferDesign(name)
        : createDesign("mars", name);
      this.plan = this.craft.hardwareVersion
        ? createHardwareTransferPlan(name)
        : createTransferPlan(name);
      this.scene.setCraft(this.craft);
      this.recalculate();
      return;
    }
  }
  private save() {
    this.lastSave = performance.now();
    const saveId = ++this.saveSequence;
    this.worker.postMessage({
      type: "save",
      saveId,
      requestId: this.requestId,
      plan: this.plan,
      editorDraft: this.operationsDraft,
    });
    return saveId;
  }
  private closeAfterSave(done: () => void) {
    if ((this.runtime || this.changed) && !this.localSaveDisabled) {
      this.playing = false;
      this.nextRequested = false;
      this.warpTarget = null;
      if (this.runtime) this.control("pause");
      this.closing = { saveId: this.save(), done };
      this.saveStatus = word(
        "마지막 상태를 저장하고 있습니다.",
        "Saving the latest checkpoint.",
      );
      this.dirty = true;
    } else done();
  }
  private beginMilestoneWarp() {
    if (!this.runtime || !this.solution) return;
    this.nextRequested = false;
    const next = this.solution.phaseEvents.find(
      (e) => e.elapsedSeconds > this.runtime!.time + 1,
    );
    this.warpTarget = next?.elapsedSeconds ?? this.solution.durationSeconds;
    if (
      this.lesson &&
      this.lesson.suggestedCommandAtSeconds > this.runtime.time + 1
    )
      this.warpTarget = Math.min(
        this.warpTarget,
        this.lesson.suggestedCommandAtSeconds,
      );
    this.playing = true;
    this.busy = true;
    this.control("warp", { target: this.warpTarget });
  }
  private restoreText(text: string) {
    if (this.closed || this.closing) return;
    if (this.commandAction) {
      this.afterCommand = () => this.restoreText(text);
      this.dirty = true;
      return;
    }
    this.nextRequested = false;
    this.warpTarget = null;
    this.accumulated = 0;
    this.drag = null;
    this.playing = false;
    this.pending = true;
    this.progress = 0;
    this.error = "";
    this.dateIssue = null;
    this.recoverRejectedRestore = false;
    this.requestId++;
    this.controlEpoch = 0;
    this.busy = false;
    this.editAfterPause = false;
    this.commandAction = null;
    this.operationsDrag = null;
    this.draftRevision++;
    this.commandPreview = null;
    this.commandPreviewPending = false;
    this.worker.postMessage({
      type: "restore",
      requestId: this.requestId,
      text,
    });
    this.dirty = true;
  }
  private timelineBounds() {
    const peri =
      (this.plan.arrivalPeriapsisJdTdb - this.plan.departurePeriapsisJdTdb) *
      86400;
    return this.timelineRange === "approach"
      ? { from: peri - 10800, to: peri + 10800 }
      : { from: peri, to: peri + 172800 };
  }
  private navigationHint() {
    if (this.afterCommand)
      return word(
        "지상 명령 요청을 처리하고 있습니다. 완료 후 선택한 동작을 이어갑니다.",
        "Processing the ground request. Your selected action will follow its completion.",
      );
    if (this.pending && this.runtime)
      return word(
        `저장된 비행을 검증하고 있습니다 · ${Math.floor(this.progress * 100)}% · 잠시 조작을 기다려 주세요.`,
        `Verifying saved flight · ${Math.floor(this.progress * 100)}% · Controls resume after verification.`,
      );
    if (this.scene.getCraftInspectionState().enabled)
      return word(
        "현재 탐사선 · 오른쪽 드래그: 회전 · 휠: 확대 · 클릭: 부품 선택 · 더블클릭/F: 초점 · Esc: 전체 경로",
        "Current spacecraft · right-drag: orbit · wheel: zoom · click: select · double-click/F: focus · Esc: route overview",
      );
    if (this.lesson || this.runtime)
      return word(
        "오른쪽 드래그: 시점 회전 · 휠: 확대 · 단계 밖의 상세 화면은 경로 미리 보기입니다.",
        "Right-drag to orbit · wheel to zoom · views outside the active phase preview that part of the route.",
      );
    return this.view === "solar"
      ? word(
          "날짜 손잡이 드래그 · 오른쪽 드래그로 회전 · 휠로 확대",
          "Drag date handles · right-drag to orbit · wheel to zoom",
        )
      : this.view === "mars"
        ? word(
            "접근점 손잡이: 최근접 고도 · 원형 손잡이: 조우면 회전",
            "Drag the approach handle for altitude · ring handle for encounter-plane angle",
          )
        : word(
            "오른쪽 드래그: 시점 회전 · 휠: 확대",
            "Right-drag to orbit · wheel to zoom",
          );
  }
  private missionTitle() {
    return this.lesson
      ? `M03B · ${word("화성 원격 관제", "MARS REMOTE OPERATIONS")}`
      : `M03 · ${word("지구에서 화성까지", "EARTH TO MARS")}`;
  }
  private operationsSourcesHTML() {
    return this.engineOptions.modelVersion === "transfer-3.0.0"
      ? `<p>${word("원격 명령은 Iris의 공개 사양과 별도로 정의한 교육용 지상국·전송률·수신 조건을 사용합니다. 실제 DSN 배정이나 임무 운용 인증을 뜻하지 않습니다.", "Remote commands combine published Iris specifications with authored educational stations, rates and receiving conditions. This is not a real DSN allocation or flight certification.")}</p><a href="/data/command-network.json" target="_blank" rel="noopener">${word("명령 모델 · 수치와 출처", "Command model · values and sources")} ↗</a>`
      : "";
  }
  private setInspection(enabled: boolean) {
    if (enabled && (!this.runtime || this.pending)) return;
    this.syncInspectionViewport();
    this.scene.setCraftInspection(enabled);
    this.dirty = true;
  }
  private syncInspectionViewport() {
    const canvas = this.scene.canvas.getBoundingClientRect();
    if (canvas.width < 64 || canvas.height < 64) return;
    const bounds = (selector: string) =>
      this.element.querySelector(selector)?.getBoundingClientRect();
    const left = bounds(".transfer-left"),
      right = bounds(".transfer-right"),
      top = bounds(".transfer-hint"),
      timeline = bounds(".transfer-timeline");
    const insets = {
      left: Math.max(0, (left?.right ?? canvas.left) - canvas.left + 16),
      right: Math.max(0, canvas.right - (right?.left ?? canvas.right) + 16),
      top: Math.max(80, (top?.bottom ?? canvas.top) - canvas.top + 18),
      bottom: Math.max(
        20,
        canvas.bottom - (timeline?.top ?? canvas.bottom) + 18,
      ),
    };
    const x = Math.min(1, (canvas.width - 64) / (insets.left + insets.right));
    const y = Math.min(1, (canvas.height - 64) / (insets.top + insets.bottom));
    insets.left *= x;
    insets.right *= x;
    insets.top *= y;
    insets.bottom *= y;
    const key = JSON.stringify([canvas.width, canvas.height, insets]);
    if (key !== this.inspectionLayoutKey) {
      this.inspectionLayoutKey = key;
      this.scene.setInspectionViewport(insets);
    }
  }
  private inspectionControlsHTML() {
    const inspection = this.scene.getCraftInspectionState();
    if (!inspection.enabled) return "";
    const part = this.craft.parts.find(
      (p) => p.id === inspection.selectedPartId,
    );
    const definition = part ? getPartDefinition(this.craft, part) : null;
    const label = definition
      ? getLanguage() === "en" && "nameEn" in definition
        ? definition.nameEn
        : translate(definition.name)
      : word("장착된 기체 전체", "Complete mounted spacecraft");
    return `<div class="transfer-inspection-controls"><span data-inspection-part-name="${esc(inspection.selectedPartId ?? "")}">${esc(label)}</span><button data-transfer-action="inspection-whole">${word("기체 전체", "Fit spacecraft")}</button></div>`;
  }
  private resultHTML() {
    const result = this.result;
    if (!result) return "";
    return `<section class="transfer-result ${result.status}" aria-label="${word("임무 결과", "Mission result")}"><div class="transfer-eyebrow">MISSION RESULT</div><h2>${result.status === "success" ? word("임무 성공", "Mission success") : result.status === "partial" ? word("부분 성과", "Partial return") : word("임무 종료", "Mission ended")}</h2><div class="transfer-science-count">${result.received}<span>/ ${result.required}</span></div><p>${word("지구에 완전히 도착한 고유 자료", "Unique science packets fully received on Earth")} · ${result.score} POINTS</p><button class="transfer-primary" data-transfer-action="retry">${this.lesson ? word("다시 관제하기", "Fly the lesson again") : word("설계 개선 후 재도전", "Improve and retry")}</button>${result.reasons.length ? `<details><summary>${word("결과의 근거", "Why this outcome")}</summary>${result.reasons.map((reason) => `<p class="transfer-warning">${esc(transferText(reason))}</p>`).join("")}</details>` : ""}</section>`;
  }
  private rightPanelHTML(review: string) {
    const note = this.operations
      ? `<p class="simulation-truth-note">${word("선상 자료와 사건은 실제 시뮬레이션 상태입니다. 지구가 아직 확인하지 못한 상태도 포함합니다.", "Onboard packets and events show actual simulation state, including events not yet confirmed on Earth.")}</p>`
      : "";
    return this.result
      ? `${note}${review}${this.operations ? `<details class="completed-command-history"><summary>${word("지상 명령 기록", "Ground command history")}</summary>${this.commandPanelHTML()}</details>` : ""}`
      : `${this.planComparisonHTML()}${this.commandPanelHTML()}${note}${review}`;
  }
  private planComparisonHTML() {
    if (!this.canComparePlans()) return '';
    const comparison = this.planComparison.inspect(), previous = comparison.previous, current = comparison.current;
    if (!previous) return '';
    const date = (jd: number | null | undefined) => jd == null ? "—" : stamp(jd);
    const difference = (now: number | null | undefined, old: number | null, divisor = 1, digits = 2) =>
      now == null || old == null ? '—' : `${now - old > 0 ? '+' : ''}${fmt((now - old) / divisor, digits)}`;
    const status = {
      empty: '', pending: word('새 경로 계산 중 · 이전 계획은 보존됩니다.', 'Solving the new route · previous plan retained.'),
      forecasting: word('경로 계산 완료 · 과학 수신을 예측 중입니다.', 'Trajectory solved · forecasting science delivery.'),
      ready: word('계산된 결과를 비교하고 경로를 선택하세요.', 'Compare computed outcomes and choose your route.'),
      infeasible: word('새 경로를 계산하지 못했습니다. 이전 계획으로 돌아갈 수 있습니다.', 'The new route could not be solved. You can return to the previous plan.'),
      unlaunchable: word('새 계획은 발사 제약을 충족하지 못합니다.', 'The new plan does not meet launch constraints.'),
      'flight-failed': word('예측에서 임무가 조기에 끝났습니다. 이전 계획은 유지됩니다.', 'The forecast ended early. The previous plan is retained.'),
    }[comparison.status];
    const row = (id: string, label: string, oldValue: number | null, newValue: number | null | undefined, oldText: string, newText: string, delta: string) =>
      `<div class="transfer-comparison-row" data-comparison="${id}" ${oldValue == null ? '' : `data-previous-value="${oldValue}"`} ${newValue == null ? '' : `data-current-value="${newValue}"`}><div><span>${esc(label)}</span><b>${esc(delta)}</b></div><div class="transfer-comparison-values"><span>${esc(oldText)}</span><i aria-hidden="true">→</i><strong>${esc(newText)}</strong></div></div>`;
    return `<section class="transfer-plan-comparison" aria-labelledby="transfer-comparison-title" data-comparison-status="${comparison.status}"><div class="transfer-eyebrow">ROUTE COMPARISON</div><h2 id="transfer-comparison-title">${word('경로를 바꾼 결과','Your route change')}</h2><p class="transfer-comparison-key">${word('금색 점선: 이전 · 실선: 변경','Gold dashed: previous · solid: changed')}</p><button data-transfer-action="restore-previous-plan" class="transfer-secondary" ${this.busy ? 'disabled' : ''}>${word('이전 계획으로 돌아가기','Return to previous plan')}</button><p class="transfer-comparison-status" role="status">${esc(status)}</p>
      ${row('arrival',word('화성 최근접 · TDB','Mars arrival · TDB'),previous.arrivalJdTdb,current?.arrivalJdTdb,date(previous.arrivalJdTdb),current ? date(current.arrivalJdTdb) : '—',`${difference(current?.arrivalJdTdb,previous.arrivalJdTdb,1,1)} d`)}
      ${row('duration',word('화성까지 비행 기간','Time to Mars'),previous.timeOfFlightSeconds,current?.timeOfFlightSeconds,`${fmt(previous.timeOfFlightSeconds == null ? null : previous.timeOfFlightSeconds/86400,1)} d`,current ? `${fmt(current.timeOfFlightSeconds == null ? null : current.timeOfFlightSeconds/86400,1)} d` : '—',`${difference(current?.timeOfFlightSeconds,previous.timeOfFlightSeconds,86400,1)} d`)}
      ${row('c3',word('출발 에너지 C3','Departure energy C3'),previous.c3Km2S2,current?.c3Km2S2,`${fmt(previous.c3Km2S2,2)}`,current ? fmt(current.c3Km2S2,2) : '—',`${difference(current?.c3Km2S2,previous.c3Km2S2)} km²/s²`)}
      ${row('fuel',word('탈출단 추진제 소비','Stage fuel used'),previous.stageFuelUsedKg,current?.stageFuelUsedKg,`${fmt(previous.stageFuelUsedKg,1)} kg`,current ? `${fmt(current.stageFuelUsedKg,1)} kg` : '—',`${difference(current?.stageFuelUsedKg,previous.stageFuelUsedKg,1,1)} kg`)}
      ${row('science',word('지구 수신 자료','Science received on Earth'),previous.received,current?.received,`${previous.received ?? '—'} / ${previous.required ?? '—'}`,current?.received == null ? '—' : `${current.received} / ${current.required ?? '—'}`,current?.fullDurationForecast ? difference(current.received,previous.received,1,0) : '—')}
      <p class="transfer-comparison-deadline">${word('계획된 수신 마감: 각 경로의 화성 영향권 이탈','Planned receipt deadline: each route’s Mars sphere-of-influence exit')}<br>${date(previous.receiptDeadlineJdTdb)} → ${current ? date(current.receiptDeadlineJdTdb) : '—'} TDB</p></section>`;
  }
  private pointerStart(e: PointerEvent) {
    if (this.pending) return;
    this.pointerDown = true;
    const liveBlock = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-operations-op].editable",
    );
    if (
      liveBlock &&
      e.button === 0 &&
      this.operationsDraft &&
      !this.commandAction &&
      !this.busy
    ) {
      const op = this.operationsDraft.operations.find(
          (o) => o.id === liveBlock.dataset.operationsOp,
        ),
        track = liveBlock
          .closest(".live-operation-track")
          ?.getBoundingClientRect(),
        bounds = this.timelineBounds();
      if (op && track) {
        this.operationsDrag = {
          id: op.id,
          edge: !!(e.target as HTMLElement).closest("[data-operations-edge]"),
          x: e.clientX,
          start: op.start,
          end: op.end,
          secondsPerPixel: (bounds.to - bounds.from) / track.width,
        };
        this.commandPreview = null;
        this.commandPreviewPending = false;
        this.draftRevision++;
        e.preventDefault();
      }
      return;
    }
    const block = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-transfer-op]",
    );
    if (!block || this.runtime || this.lesson) return;
    this.changed = true;
    const op = this.plan.operations.find(
      (o) => o.id === block.dataset.transferOp,
    );
    if (!op) return;
    const bounds = this.timelineBounds(),
      track = this.element
        .querySelector(".transfer-op-track")!
        .getBoundingClientRect();
    this.drag = {
      id: op.id,
      edge: (e.target as HTMLElement).classList.contains("transfer-op-edge"),
      x: e.clientX,
      start: op.start,
      end: op.end,
      secondsPerPixel: (bounds.to - bounds.from) / track.width,
    };
    e.preventDefault();
  }
  private pointerMove = (e: PointerEvent) => {
    if (this.operationsDrag && this.operationsDraft) {
      const d = this.operationsDrag,
        op = this.operationsDraft.operations.find((o) => o.id === d.id);
      if (!op) return;
      const delta = (e.clientX - d.x) * d.secondsPerPixel;
      op.start = d.start;
      op.end = d.end;
      this.adjustDraftOperation(op, 1, delta, d.edge);
      const block = this.element.querySelector<HTMLElement>(
          `[data-operations-op="${CSS.escape(d.id)}"]`,
        ),
        bounds = this.timelineBounds();
      if (block) {
        block.style.left = `${((op.start - bounds.from) / (bounds.to - bounds.from)) * 100}%`;
        block.style.width = `${((op.end - op.start) / (bounds.to - bounds.from)) * 100}%`;
      }
      return;
    }
    if (!this.drag) return;
    const d = this.drag,
      op = this.plan.operations.find((o) => o.id === d.id);
    if (!op) return;
    const delta = Math.round(((e.clientX - d.x) * d.secondsPerPixel) / 60) * 60;
    if (d.edge) op.end = Math.max(op.start + 60, d.end + delta);
    else {
      op.start = Math.max(0, d.start + delta);
      op.end = op.start + d.end - d.start;
    }
    const block = this.element.querySelector<HTMLElement>(
        `[data-transfer-op="${d.id}"]`,
      ),
      b = this.timelineBounds();
    if (block) {
      block.style.left = `${((op.start - b.from) / (b.to - b.from)) * 100}%`;
      block.style.width = `${((op.end - op.start) / (b.to - b.from)) * 100}%`;
    }
  };
  private timelineHTML() {
    const b = this.timelineBounds(),
      peri =
        (this.plan.arrivalPeriapsisJdTdb - this.plan.departurePeriapsisJdTdb) *
        86400;
    if (this.operations && this.runtime) {
      const submitted = [...this.operations.ground.commands]
        .reverse()
        .find((command) =>
          [
            "queued",
            "transmitting",
            "awaiting-confirmation",
            "unconfirmed",
          ].includes(command.status),
        );
      return `<section class="transfer-timeline operations-timeline"><div class="transfer-timeline-title"><strong>${word("화성 조우 · 원격 일정", "MARS ENCOUNTER · REMOTE SCHEDULE")}</strong><div><button data-transfer-action="timeline-approach" class="${this.timelineRange === "approach" ? "active" : ""}">${word("접근 6시간", "Approach · 6h")}</button><button data-transfer-action="timeline-delivery" class="${this.timelineRange === "delivery" ? "active" : ""}">${word("수신 48시간", "Delivery · 48h")}</button></div></div>${liveOperationsTimelineHTML({ from: b.from, to: b.to, now: this.runtime.time, periapsis: peri, confirmed: this.operations.ground.confirmedOperations, submitted: submitted?.payload.operations ?? null, draft: this.operationsDraft?.operations ?? null, editableAfter: this.operationsDraft?.replaceFromSeconds ?? Infinity, canEdit: !this.pending && !this.commandAction && !this.busy })}<div class="transfer-time-labels">${[0, 0.25, 0.5, 0.75, 1].map((x) => `<span>${fmt((b.from + (b.to - b.from) * x - peri) / 3600, 1)}h</span>`).join("")}</div><small>${this.operationsDraft ? word("초안 편집 중에는 일시정지 · 드래그: 이동 · 오른쪽 끝: 길이 · ←/→: 분 눈금 · Shift: 10분 · Alt: 길이", "Paused while editing · drag to move · right edge to resize · arrows: minute grid · Shift: 10min · Alt: resize") : word("0h = 화성 최근접 · 위 세 줄은 지상에서 아는 일정과 전송한 내용입니다.", "0h = Mars periapsis · these layers show Earth-known schedules and submitted changes.")}</small></section>`;
    }
    return `<section class="transfer-timeline"><div class="transfer-timeline-title"><strong>${word("화성 조우 일정", "MARS ENCOUNTER SEQUENCE")}</strong><div><button data-transfer-action="timeline-approach" class="${this.timelineRange === "approach" ? "active" : ""}">${word("접근 6시간", "Approach · 6h")}</button><button data-transfer-action="timeline-delivery" class="${this.timelineRange === "delivery" ? "active" : ""}">${word("수신 48시간", "Delivery · 48h")}</button></div><small>${this.lesson ? word("고정된 초기 일정 · 출발 후 원격 수정", "Fixed initial schedule · revise remotely after departure") : this.runtime ? word("탑재 일정 실행 중", "Onboard sequence") : word("블록을 끌어 이동 · 오른쪽 끝으로 길이 조절", "Drag blocks to move · right edge to resize")}</small></div><div class="transfer-op-track">${this.plan.operations.map((op) => `<div class="transfer-op ${op.kind}" data-transfer-op="${esc(op.id)}" style="left:${((op.start - b.from) / (b.to - b.from)) * 100}%;width:${((op.end - op.start) / (b.to - b.from)) * 100}%"><span>${op.kind === "observe" ? word("분광 관측", "Spectra") : op.kind === "downlink" ? word("지구 송신", "Downlink") : word("충전", "Charge")}</span>${this.runtime || this.lesson ? "" : '<i class="transfer-op-edge"></i>'}</div>`).join("")}<i class="transfer-peri-line" style="left:${((peri - b.from) / (b.to - b.from)) * 100}%"></i>${this.runtime ? `<i class="transfer-time-line" style="left:${((this.runtime.time - b.from) / (b.to - b.from)) * 100}%"></i>` : ""}</div><div class="transfer-time-labels">${[0, 0.25, 0.5, 0.75, 1].map((x) => `<span>${fmt((b.from + (b.to - b.from) * x - peri) / 3600, 1)}h</span>`).join("")}</div><small>${word("0h = 화성 최근접 · 빈 구간은 태양 지향 충전 · 날짜 변경 시 조우 기준 일정 유지", "0h = Mars periapsis · empty periods charge toward the Sun · date changes preserve encounter-relative timing")}</small></section>`;
  }
  /** Date inputs retain keyboard focus while their error and launch state update.
   * The regular full-panel render intentionally waits until input editing ends. */
  private syncDateFeedback() {
    const ui = this.element.querySelector('.transfer-ui');
    if (!ui) return;
    ui.querySelector('.transfer-error')?.remove();
    ui.insertAdjacentHTML('beforeend', this.errorHTML());
    const bounds = transferDateBounds(this.plan.departurePeriapsisJdTdb);
    for (const kind of ['departure', 'arrival'] as const) {
      const input = ui.querySelector<HTMLInputElement>(`[data-transfer-date="${kind}"]`);
      if (input) {
        input.min = stamp(bounds[kind].min);
        input.max = stamp(bounds[kind].max);
        input.setAttribute('aria-invalid', String(this.dateIssue?.kind === kind));
      }
    }
    const launch = ui.querySelector<HTMLButtonElement>('[data-transfer-action="launch"]');
    if (launch) launch.disabled = true;
    const duration = Array.from(ui.querySelectorAll<HTMLElement>('.transfer-left .transfer-metric'))
      .find(row => row.querySelector('span')?.textContent === word('행성 간 비행', 'Time of flight'));
    const durationValue = duration?.querySelector('strong');
    if (durationValue) durationValue.textContent = `${fmt(this.plan.arrivalPeriapsisJdTdb - this.plan.departurePeriapsisJdTdb)} d`;
    // A focused date control must never leave the previous route's launchable numbers on screen.
    for (const value of Array.from(ui.querySelectorAll<HTMLElement>('.transfer-right .transfer-metric strong'))) value.textContent = '—';
    const science = ui.querySelector<HTMLElement>('.transfer-right .transfer-science-count');
    if (science) {
      science.innerHTML = '—<span>/ 3</span>';
      const status = science.nextElementSibling;
      if (status) status.textContent = this.dateIssue
        ? word('날짜를 조정하면 새 경로를 계산합니다.', 'Adjust the dates to calculate a new route.')
        : word('새 경로 계산 중', 'Calculating the new route');
    }
    ui.querySelector('.transfer-right .transfer-bar')?.remove();
  }
  private errorHTML() {
    if (!this.error) return "";
    const issue = !this.runtime ? this.dateIssue : null;
    const repair = issue ? repairTransferDates(this.plan) : null;
    const message = issue
      ? transferDateIssueText(issue, getLanguage())
      : transferText(calendarDateDiagnostic(this.error, getLanguage()));
    let action = `<button data-transfer-action="dismiss-error">${word("닫기", "Dismiss")}</button>`;
    if (this.recoverRejectedRestore && !this.runtime)
      action = `<button data-transfer-action="open-valid-plan">${word('현재 날짜로 새 경로 열기', 'Open a route with the current dates')}</button>`;
    if (issue) {
      const proposed = repair && (issue.kind === 'departure'
        ? `${stamp(repair.departurePeriapsisJdTdb)} → ${stamp(repair.arrivalPeriapsisJdTdb)}`
        : stamp(repair.arrivalPeriapsisJdTdb));
      action = repair
        ? `<button data-transfer-action="repair-dates">${issue.kind === 'arrival' ? word('도착을', 'Move arrival to') : word('날짜를', 'Use dates')} ${proposed}${word('로 이동', '')}</button>`
        : `<button data-transfer-action="edit-dates">${word('날짜 수정', 'Edit dates')}</button>`;
    }
    if (!this.runtime && this.planComparison.inspect().canRestore)
      action += `<button data-transfer-action="restore-previous-plan">${word('이전 경로로 돌아가기', 'Return to previous route')}</button>`;
    return `<div class="transfer-error" role="alert">${esc(message)}${action}</div>`;
  }
  private renderUI() {
    this.element.classList.toggle(
      "operations-live",
      !!this.operations && !!this.runtime,
    );
    const dateBounds = transferDateBounds(this.plan.departurePeriapsisJdTdb);
    const activeDraftId = (document.activeElement as HTMLElement)?.dataset
      .operationsOp;
    const openDetails = new Set(
      Array.from(
        this.element.querySelectorAll<HTMLDetailsElement>("details[open]"),
      ).map((d) => d.querySelector("summary")?.textContent),
    );
    const leftScroll =
        this.element.querySelector(".transfer-left")?.scrollTop ?? 0,
      rightScroll = this.revealComparison ? 0 :
        this.element.querySelector(".transfer-right")?.scrollTop ?? 0;
    this.revealComparison = false;
    const e = this.evaluation,
      s = this.solution,
      r = this.runtime,
      t = this.telemetry,
      p = this.preview,
      live = Boolean(r),
      en = getLanguage() === "en";
    const metric = (label: string, value: string) =>
      `<div class="transfer-metric"><span>${label}</span><strong>${value}</strong></div>`;
    const sidebar = !live
      ? this.lesson
        ? `<div class="transfer-eyebrow">REMOTE OPERATIONS / TRAINING</div><h2>${esc(en ? this.lesson.nameEn : this.lesson.name)}</h2><p>${word("화성에 다가가는 탐사선의 일정을 바꿔 과학 자료를 지구로 보내세요. 제한된 교신 기회 안에 명령 전체가 도착해야 합니다.", "Revise the approaching spacecraft’s schedule and return its science to Earth. The entire command must arrive during a usable listening opportunity.")}</p><p>${word("출발 후 관측 블록의 오른쪽 끝을 끌어 관측 시간을 조정하세요. 송신·충전 일정과 겹치지 않게 해야 합니다. 초안은 전송하기 전까지 탐사선에 영향을 주지 않습니다.", "After departure, drag the observation block’s right edge to adjust its duration while preserving downlink and charging opportunities. An unsent draft has no effect on the spacecraft.")}</p>${metric(word("지구 출발", "Earth departure"), stamp(this.plan.departurePeriapsisJdTdb) + " TDB")}${metric(word("화성 최근접", "Mars periapsis"), stamp(this.plan.arrivalPeriapsisJdTdb) + " TDB")}${metric(word("명령 판단 시점", "Command decision time"), "T+" + clock(this.lesson.suggestedCommandAtSeconds))}<p class="transfer-model-note">${word("이 연습은 같은 초기 기체와 경로로 시작합니다. 명령 없는 결과와 직접 바꾼 결과를 비교해 보세요.", "This lesson starts with a fixed craft and trajectory. Compare the unchanged flight with the outcome of your own schedule revision.")}</p>`
        : `<div class="transfer-eyebrow">FLIGHT WINDOW</div><h2>${word("두 행성을 잇는 궤적", "Connect two moving worlds")}</h2><p>${word("지구와 화성 날짜 손잡이를 궤도 위로 끌어 보세요. 달라진 만남에 필요한 추진제와 전력을 다시 계산합니다.", "Drag the Earth and Mars date handles along their orbits. Recalculate the fuel and power needed for a different encounter.")}</p><label>${word("지구 출발", "Earth departure")} · TDB<input type="date" data-transfer-date="departure" min="${stamp(dateBounds.departure.min)}" max="${stamp(dateBounds.departure.max)}" aria-invalid="${this.dateIssue?.kind === 'departure'}" value="${stamp(this.plan.departurePeriapsisJdTdb)}"></label><label>${word("화성 최근접", "Mars periapsis")} · TDB<input type="date" data-transfer-date="arrival" min="${stamp(dateBounds.arrival.min)}" max="${stamp(dateBounds.arrival.max)}" aria-invalid="${this.dateIssue?.kind === 'arrival'}" value="${stamp(this.plan.arrivalPeriapsisJdTdb)}"></label>${metric(word("행성 간 비행", "Time of flight"), `${fmt(this.plan.arrivalPeriapsisJdTdb - this.plan.departurePeriapsisJdTdb)} d`)}<label>${word("화성 최근접 고도", "Mars periapsis altitude")} <b>${fmt(this.plan.marsPeriapsisAltitudeKm)} km</b><input type="range" min="250" max="10000" step="50" data-transfer-field="altitude" value="${this.plan.marsPeriapsisAltitudeKm}"></label><label>${word("조우 평면 각도", "Encounter plane angle")} <b>${fmt((this.plan.marsBPlaneAngleRad * 180) / Math.PI)}°</b><input type="range" min="-180" max="180" step="5" data-transfer-field="angle" value="${(this.plan.marsBPlaneAngleRad * 180) / Math.PI}"></label><button class="transfer-secondary" data-transfer-action="edit">${word("장비 배치 수정", "Edit spacecraft layout")}</button><details><summary>${word("예시 계획 불러오기", "Load example plan")}</summary><div class="transfer-row"><button data-transfer-action="balanced">PATHFINDER</button><button data-transfer-action="science">EXPLORER</button></div></details>`
      : `<div class="transfer-eyebrow">LIVE MISSION</div><h2>${phaseName(t?.environment.state.phase || "earth-escape")}</h2><div class="transfer-clock">T+${clock(r!.time)}</div><p>${stamp(this.plan.departurePeriapsisJdTdb + r!.time / 86400)} TDB</p>${metric(word("태양 거리", "Solar range"), `${fmt(t?.environment.sunDistanceAU ?? 0, 3)} AU`)}${metric(word("지구 거리", "Earth range"), `${fmt((t?.environment.earthDistanceKm ?? 0) / 1e6, 2)} M km`)}${metric(word("빛의 편도 시간", "One-way light time"), `${fmt((t?.lightTimeS ?? 0) / 60, 1)} min`)}${metric(word("태양광 / 소비", "Solar / load"), `${fmt(t?.solarPowerW ?? 0, 1)} / ${fmt(t?.loadPowerW ?? 0, 1)} W`)}${metric(word("배터리", "Battery"), `${fmt(r!.energyWh, 1)} / ${fmt(t?.batteryWh ?? 0)} Wh`)}<div class="transfer-bar"><i style="width:${Math.max(0, Math.min(100, (r!.energyWh / (t?.batteryWh || 1)) * 100))}%"></i></div><p class="transfer-reason">${esc(transferText(t?.reason || ""))}</p><div class="transfer-row"><button class="transfer-primary" data-transfer-action="play" ${r!.status !== "running" ? "disabled" : ""}>${this.playing ? word("일시정지", "Pause") : word("계속 비행", "Continue")}</button><button data-transfer-action="next" ${r!.status !== "running" ? "disabled" : ""}>${word("다음 주요 지점", "Next milestone")}</button></div><div class="transfer-speed">${(this.operations ? [1, 10, 60, 600, 86400] : [1, 600, 86400, 864000]).map((v) => `<button class="${this.speed === v ? "active" : ""}" data-transfer-action="speed-${v}">${v === 86400 ? "1d/s" : v === 864000 ? "10d/s" : v + "×"}</button>`).join("")}</div><small>${word("시간 가속 중에도 배터리·그림자·통신·자세 전환을 계산합니다.", "Time warp still integrates energy, eclipses, radio delivery and attitude slews.")}</small>`;
    const review = !live
      ? `<div class="transfer-eyebrow">DEPARTURE REVIEW</div><h2>${word("출발 준비", "Ready to depart")}</h2><label>${word("탈출 추진 단계", "Escape stage")}<select data-transfer-field="stage" ${this.lesson ? "disabled" : ""}>${Object.values(
          ESCAPE_STAGES,
        )
          .map(
            (stage) =>
              `<option value="${stage.id}" ${this.plan.launchStageId === stage.id ? "selected" : ""}>${en ? stage.id.toUpperCase() : stage.name} · ${stage.cost} C</option>`,
          )
          .join(
            "",
          )}</select></label>${metric(word("탈출 기동", "Escape burn"), `${fmt(s?.escapeBurnMps ?? NaN)} m/s`)}${metric("C3", `${fmt(s?.c3Km2S2 ?? NaN, 2)} km²/s²`)}${metric(word("단계 추진제 여유", "Stage fuel margin"), `${fmt(e?.stageFuelRemainingKg ?? NaN, 1)} kg`)}${metric(word("총 예산", "Mission cost"), `${fmt(e?.totalCost ?? NaN)} / ${fmt(e?.budget ?? NaN)} C`)}<div class="transfer-divider"></div><div class="transfer-eyebrow">SCIENCE RETURN FORECAST</div><div class="transfer-science-count">${this.pending ? "—" : (p?.received ?? 0)}<span>/ 3</span></div><p>${this.pending ? word(`전체 임무 검토 중 ${Math.floor(this.progress * 100)}%`, `Reviewing full mission ${Math.floor(this.progress * 100)}%`) : p?.status === "success" ? word("과학 목표를 충족하는 계획입니다.", "This plan meets the science objective.") : word("관측과 지구 수신 조건을 다시 확인하세요.", "Review observation and Earth delivery conditions.")}</p>${this.pending ? `<div class="transfer-bar"><i style="width:${this.progress * 100}%"></i></div>` : ""}${
          e?.warnings
            .slice(0, 3)
            .map(
              (w) =>
                `<p class="transfer-warning ${w.severity}">${esc(transferText(w.message))}</p>`,
            )
            .join("") || ""
        }<button class="transfer-primary" data-transfer-action="launch" ${this.pending || !p || !e?.launchable || !s ? "disabled" : ""}>${word("지구 탈출 기동 실행", "Execute Earth departure")}</button><p class="transfer-model-note">${word("추진 단계와 가격은 게임 설정입니다. 궤도는 JPL 천체력과 구간별 중력 모델을 사용합니다.", "Stages and prices are authored game settings. Trajectories use JPL ephemerides and patched central-body gravity.")}</p>`
      : `${this.result ? this.resultHTML() : `<div class="transfer-eyebrow">SCIENCE DELIVERY</div><h2>${word("화성의 발견을 지구로", "Bring Mars discoveries home")}</h2><div class="transfer-science-count">${r!.scienceReceived}<span>/ 3</span></div><p>${word("완전히 수신한 고유 분광 자료", "Unique spectra fully received on Earth")}</p>`}<div class="transfer-packet-list">${r!.packets.length ? r!.packets.map((packet, i) => `<div class="transfer-packet ${packet.receivedAt !== null ? "received" : ""}"><strong>${String(i + 1).padStart(2, "0")}</strong><span>${packet.receivedAt !== null ? word("지구 수신", "Received") : packet.transmittedBits >= packet.bits ? word("전파 이동 중", "In transit") : packet.transmittedBits > 0 ? word("송신 중", "Sending") : word("선상 기록", "Onboard")}<small>${word("품질", "Quality")} ${fmt(packet.quality * 100)}%</small></span><i style="--received:${(packet.receivedBits / packet.bits) * 100}%;--sent:${(packet.transmittedBits / packet.bits) * 100}%"></i></div>`).join("") : `<p>${word("화성에 접근하면 탑재 일정에 따라 분광 관측을 시작합니다.", "The onboard sequence starts spectral observations during the Mars encounter.")}</p>`}</div><details><summary>${word("임무 기록", "Mission log")}</summary>${r!.events
          .slice(-12)
          .reverse()
          .map(
            (event) =>
              `<p class="transfer-event"><b>${clock(event.time)}</b>${esc(eventMessage(event))}</p>`,
          )
          .join("")}</details>`;
    this.element.querySelector(".transfer-ui")!.innerHTML =
      `<header class="transfer-topbar"><button data-transfer-action="exit" class="transfer-brand">ORBITAL <small>MISSION FOUNDRY</small></button><span>${this.missionTitle()}</span><div><button data-transfer-action="view-solar" class="${!this.scene.getCraftInspectionState().enabled && this.view === "solar" ? "active" : ""}">${word("태양계", "Solar system")}</button><button data-transfer-action="view-earth" class="${!this.scene.getCraftInspectionState().enabled && this.view === "earth" ? "active" : ""}">${word("지구 탈출", "Earth escape")}</button><button data-transfer-action="view-mars" class="${!this.scene.getCraftInspectionState().enabled && this.view === "mars" ? "active" : ""}">${word("화성 조우", "Mars encounter")}</button><button data-transfer-action="view-craft" class="${this.scene.getCraftInspectionState().enabled ? "active" : ""}" ${!this.runtime || this.pending ? "disabled" : ""}>${word("탐사선", "Spacecraft")}</button></div></header><aside class="transfer-left">${this.operations ? `<p class="simulation-truth-note">${word("실제 시뮬레이션 상태 · 지구가 확인한 원격측정이 아닙니다.", "Actual simulation state · not Earth-confirmed telemetry.")}</p>` : ""}${sidebar}<details class="transfer-save-tools"><summary>${word("저장과 백업", "Save & backup")}</summary><div class="transfer-row"><button data-transfer-action="save">${word("저장", "Save")}</button><button data-transfer-action="load">${word("불러오기", "Load")}</button></div><div class="transfer-row"><button data-transfer-action="export">JSON ↓</button><button data-transfer-action="import">JSON ↑</button></div><small>${esc(this.saveStatus)}</small></details><details><summary>${word("과학 모델과 출처", "Scientific model & sources")}</summary><p>${word("JPL Horizons · ICRF · TDB. 지구·태양·화성의 구간별 중심중력으로 경로를 계산합니다. 발사 단계는 정렬된 순간 기동이며, 통신·자세·과학 품질에는 공개된 게임 가정이 있습니다.", "JPL Horizons · ICRF · TDB. Patched Earth/Sun/Mars central gravity. Departure assumes an aligned impulsive stage. Radio, attitude and science quality use disclosed educational assumptions.")}</p><a href="/data/transfer/sources.json" target="_blank" rel="noopener">${word("출처 · 해시 · 검증 범위", "Sources · hashes · validation scope")} ↗</a>${this.canComparePlans() ? `<p>${word('경로 비교는 같은 기체의 계산 결과를 사용합니다. 각 경로의 화성 영향권 이탈 날짜가 수신 마감이며, 누적 식 시간과 교신 가능 시간은 이 비교에 포함하지 않습니다.','Route comparison uses computed outcomes for the same spacecraft. Each route’s Mars sphere-of-influence exit is its receipt deadline. Cumulative eclipse and contact-window durations are not part of this comparison.')}</p>` : ''}${this.operationsSourcesHTML()}</details></aside><aside class="transfer-right">${this.rightPanelHTML(review)}</aside><div class="transfer-hint">${this.navigationHint()}${this.inspectionControlsHTML()}<small>${word("행성·탐사선 크기 확대 표시 · 거리와 시간은 계산값", "Planet and spacecraft display sizes exaggerated · computed distances and times")}</small></div>${this.errorHTML()}${this.timelineHTML()}`;
    for (const detail of Array.from(
      this.element.querySelectorAll<HTMLDetailsElement>("details"),
    ))
      if (openDetails.has(detail.querySelector("summary")?.textContent))
        detail.open = true;
    if (
      this.operationsDraft ||
      this.commandAction ||
      (this.pending && this.runtime)
    ) {
      this.element
        .querySelectorAll<HTMLButtonElement>(
          '[data-transfer-action="play"],[data-transfer-action="next"],[data-transfer-action^="speed-"]',
        )
        .forEach((button) => (button.disabled = true));
    }
    if (this.lesson) {
      this.element
        .querySelectorAll<
          HTMLInputElement | HTMLSelectElement
        >("[data-transfer-field],[data-transfer-date]")
        .forEach((input) => (input.disabled = true));
      if (
        this.runtime &&
        this.runtime.status === "running" &&
        this.runtime.time < this.lesson.suggestedCommandAtSeconds
      ) {
        const left = this.element.querySelector(".transfer-left");
        left?.insertAdjacentHTML(
          "afterbegin",
          `<button class="transfer-primary" data-transfer-action="listening-window" ${this.pending || this.busy || this.operationsDraft || this.commandAction ? "disabled" : ""}>${word("명령 판단 시점까지 비행", "Fly to command decision")}</button><small>${word("지나가는 모든 구간의 전력·자세·사건을 계산합니다.", "Every intervening power, attitude and event step is simulated.")}</small>`,
        );
      }
    }
    const left = this.element.querySelector(".transfer-left"),
      right = this.element.querySelector(".transfer-right");
    if (left) left.scrollTop = leftScroll;
    if (right) right.scrollTop = rightScroll;
    if (activeDraftId)
      this.element
        .querySelector<HTMLElement>(
          `[data-operations-op="${CSS.escape(activeDraftId)}"].editable`,
        )
        ?.focus({ preventScroll: true });
    this.syncInspectionViewport();
  }
  private frame = (now: number) => {
    if (this.closed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (
      this.playing &&
      !this.pending &&
      !this.commandAction &&
      this.runtime?.status === "running" &&
      !document.hidden
    ) {
      this.accumulated += dt * this.speed;
      if (!this.busy) {
        const delta =
          this.warpTarget !== null
            ? Math.max(0, this.warpTarget - this.runtime.requestedTime)
            : this.accumulated;
        this.accumulated = 0;
        this.busy = true;
        this.worker.postMessage({
          type: "advance",
          requestId: this.requestId,
          controlEpoch: this.controlEpoch,
          delta,
        });
      }
    }
    if (
      this.runtime &&
      !this.pending &&
      !this.commandAction &&
      !this.localSaveDisabled &&
      now - this.lastSave > 5000
    )
      this.save();
    if (
      this.dirty &&
      !this.pointerDown &&
      !this.element.contains(
        document.activeElement?.matches("input,select")
          ? document.activeElement
          : null,
      ) &&
      now - this.lastUI > 180
    ) {
      this.renderUI();
      this.dirty = false;
      this.lastUI = now;
    }
    this.scene.render(dt);
  };
  dispose() {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.raf);
    this.worker.terminate();
    this.inspectionResizeObserver.disconnect();
    this.scene.dispose();
    window.removeEventListener("pointermove", this.pointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.element.remove();
  }
  getState() {
    return {
      plan: structuredClone(this.plan),
      craft: structuredClone(this.craft),
      solution: this.solution,
      evaluation: this.evaluation,
      preview: this.preview,
      runtime: this.runtime,
      telemetry: this.telemetry,
      result: this.result,
      pending: this.pending,
      playing: this.playing,
      error: this.error,
      view: this.view,
      warpTarget: this.warpTarget,
      controlEpoch: this.controlEpoch,
      operations: this.operations,
      operationsDraft: this.operationsDraft
        ? structuredClone(this.operationsDraft)
        : null,
      commandPreview: this.commandPreview,
      commandAction: this.commandAction,
      inspection: this.scene.getCraftInspectionState(),
      comparison: this.planComparison.inspect(),
    };
  }
}
