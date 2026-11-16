import type {
  GroundCommand,
  OperationKind,
  SimulationState,
} from "./sim/types";
import {
  advanceSimulation,
  FIXED_STEP_S,
  getDesignRequirements,
  getTelemetry,
} from "./sim/simulation";
import { evaluateDesign } from "./sim/assembly";
import { MISSIONS } from "./sim/catalog";

export const MAX_FLIGHT_FORECAST_SECONDS = 1800;
export type FlightEventKind =
  | "eclipse-enter"
  | "eclipse-exit"
  | "contact-open"
  | "contact-close"
  | "downlink-ready"
  | "operation-change"
  | "science-received"
  | "safe-mode-enter"
  | "safe-mode-exit"
  | "command-failed"
  | "deadline"
  | "mission-failed";
export interface FlightForecastEvent {
  time: number;
  kind: FlightEventKind;
  priority: number;
  ko: string;
  en: string;
  operation?: OperationKind;
  count?: number;
}
export interface FlightReason {
  code: string;
  ko: string;
  en: string;
}
export interface FlightForecast {
  baseTime: number;
  horizon: number;
  requestedHorizonSeconds: number;
  minEnergyWh: number;
  energyCapacity: number;
  scienceAtHorizon: number;
  nextEvent: FlightForecastEvent | null;
  reasons: FlightReason[];
  endingStatus: SimulationState["status"];
  pendingCommandsAtHorizon: number;
  commandChanges: {
    id: string;
    status: GroundCommand["status"];
    executedAt: number | null;
    arrivesAt: number | null;
  }[];
  ticks: number;
  computeMs: number;
  assumesNoNewCommands: true;
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const unsent = (state: SimulationState) =>
  state.dataPackets.reduce(
    (sum, p) => sum + Math.max(0, p.bits - p.transmittedBits),
    0,
  );
const pending = (state: SimulationState) =>
  state.commands.filter(
    (c) => c.status === "queued" || c.status === "inflight",
  );
const operationName = (op: OperationKind) =>
  ({
    observe: { ko: "관측", en: "observation" },
    downlink: { ko: "송신", en: "downlink" },
    charge: { ko: "충전", en: "charging" },
  })[op];
const now = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();

/**
 * A deterministic continuation of this exact checkpoint, including already
 * queued/in-flight commands, finite slew and received-signal checks. No new
 * command is invented and the caller's state/design/queues are never advanced.
 * `horizon` is the actual simulated span, at most 1800 s, rounded down to whole
 * existing 5 s engine ticks and stopped on terminal state. This is the same
 * educational model's prediction, not a probability or high-fidelity solution.
 *
 * `nextEvent` is the most useful upcoming decision within that horizon: real
 * power/failure/deadline dangers outrank a nearer generic operation change.
 * Equal priority uses the earlier event. Warp UI must stop BEFORE its timestamp,
 * not assume every preceding event can be silently skipped.
 * Only computeMs is nondeterministic wall-clock profiling metadata.
 */
export function forecastFlight(
  actual: SimulationState,
  horizonSeconds = MAX_FLIGHT_FORECAST_SECONDS,
): FlightForecast {
  const started = now();
  if (!Number.isFinite(horizonSeconds) || horizonSeconds < 0)
    throw new Error("예측 시간은 유한한 0 이상의 초여야 합니다.");
  const requestedHorizonSeconds =
    Math.floor(
      Math.min(horizonSeconds, MAX_FLIGHT_FORECAST_SECONDS) / FIXED_STEP_S,
    ) * FIXED_STEP_S;
  const state = structuredClone(actual),
    baseTime = state.time,
    capacity = evaluateDesign(state.design).batteryWh;
  const requirement = getDesignRequirements(state.design),
    duration = MISSIONS[state.design.missionId].duration;
  const end = Math.min(baseTime + requestedHorizonSeconds, duration),
    events: FlightForecastEvent[] = [];
  const originalCommands = new Map(state.commands.map((c) => [c.id, c.status]));
  let before = getTelemetry(state),
    minEnergyWh = state.energyWh,
    ticks = 0;
  const emit = (
    kind: FlightEventKind,
    priority: number,
    ko: string,
    en: string,
    extra: Partial<FlightForecastEvent> = {},
  ) => events.push({ time: state.time, kind, priority, ko, en, ...extra });
  while (state.status === "running" && state.time + FIXED_STEP_S <= end) {
    const previousUnsent = unsent(state),
      previousPending = pending(state).length,
      previousScience = state.scienceReceived;
    const statuses = new Map(state.commands.map((c) => [c.id, c.status]));
    advanceSimulation(state, FIXED_STEP_S);
    ticks++;
    minEnergyWh = Math.min(minEnergyWh, state.energyWh);
    const after = getTelemetry(state);
    if (!before.safeMode && after.safeMode)
      emit(
        "safe-mode-enter",
        90,
        "전력 조건으로 안전 모드 진입",
        "Power conditions trigger safe mode",
      );
    if (before.safeMode && !after.safeMode)
      emit(
        "safe-mode-exit",
        55,
        "전력 회복 후 탑재 일정 재개",
        "Power recovery resumes the onboard schedule",
      );
    if (before.eclipse !== after.eclipse)
      emit(
        after.eclipse ? "eclipse-enter" : "eclipse-exit",
        after.eclipse ? 35 : 30,
        after.eclipse
          ? "행성 그림자 진입 · 발전 중단"
          : "그림자 이탈 · 태양광 회복",
        after.eclipse
          ? "Enter planetary shadow · solar generation stops"
          : "Leave planetary shadow · sunlight returns",
      );
    if (before.groundVisible !== after.groundVisible) {
      const relevant = previousUnsent > 0 || previousPending > 0;
      emit(
        after.groundVisible ? "contact-open" : "contact-close",
        after.groundVisible
          ? relevant
            ? 60
            : 25
          : relevant && before.operation === "downlink"
            ? 70
            : 25,
        after.groundVisible ? "지상국 가시 구간 시작" : "지상국 가시 구간 종료",
        after.groundVisible
          ? "Ground station becomes geometrically visible"
          : "Ground station leaves geometric visibility",
      );
    }
    if (!before.linkReady && after.linkReady && unsent(state) > 0)
      emit(
        "downlink-ready",
        65,
        "실제 송신 조건 충족 · 미송신 자료 있음",
        "Downlink conditions acquired · unsent data remains",
      );
    if (before.operation !== after.operation) {
      const op = operationName(after.operation);
      emit(
        "operation-change",
        20,
        `${op.ko} 운용 구간으로 전환`,
        `Switch to ${op.en}`,
        { operation: after.operation },
      );
    }
    if (state.scienceReceived > previousScience) {
      const count = state.scienceReceived - previousScience;
      emit(
        "science-received",
        50,
        `유효 과학 자료 ${count}개 추가 수신`,
        `${count} additional valid science dataset${count === 1 ? "" : "s"} received`,
        { count },
      );
    }
    const failed = state.commands.filter(
      (c) => c.status === "failed" && statuses.get(c.id) !== "failed",
    );
    if (failed.length)
      emit(
        "command-failed",
        85,
        `도착 조건을 잃어 지상 명령 ${failed.length}개 수신 실패`,
        `${failed.length} ground command${failed.length === 1 ? "" : "s"} fail the arrival conditions`,
        { count: failed.length },
      );
    if (after.status === "failed")
      emit(
        "mission-failed",
        100,
        "현재 계획에서 임무 중단 조건 발생",
        "The current plan reaches a mission-stopping condition",
      );
    if (after.status === "complete")
      emit(
        "deadline",
        state.scienceReceived < requirement.targetPackets ? 80 : 40,
        "임무 기한 도달 · 추가 수신 종료",
        "Mission deadline · no further reception",
      );
    before = after;
  }
  // Eclipse itself is normal. Raise it only when this actual continuation also
  // forecasts less than the model's 16% safety-recovery reserve, never by chance.
  if (minEnergyWh < capacity * 0.16) {
    for (const event of events)
      if (event.kind === "eclipse-enter") event.priority = 75;
  }
  const nextEvent =
    [...events].sort((a, b) => b.priority - a.priority || a.time - b.time)[0] ||
    null;
  const commandChanges = state.commands
    .filter((c) => originalCommands.get(c.id) !== c.status)
    .map((c) => ({
      id: c.id,
      status: c.status,
      executedAt: c.executedAt,
      arrivesAt: c.arrivesAt,
    }));
  const horizon = state.time - baseTime,
    reasons: FlightReason[] = [];
  const danger =
    events.find((e) => e.kind === "mission-failed") ||
    events.find((e) => e.kind === "safe-mode-enter") ||
    events.find((e) => e.kind === "command-failed");
  if (danger)
    reasons.push({
      code: danger.kind,
      ko: `현재 계획을 유지하면 T+${clock(danger.time)}에 ${danger.ko}.`,
      en: `With the current plan, T+${clock(danger.time)}: ${danger.en}.`,
    });
  else if (actual.safeMode)
    reasons.push({
      code: "already-safe",
      ko: "현재 안전 모드입니다. 새 지상 명령보다 탑재 자율 충전과 회복 조건을 먼저 확인하세요.",
      en: "Safe mode is already active. Check autonomous charging and recovery before relying on a new ground command.",
    });
  else if (nextEvent)
    reasons.push({
      code: nextEvent.kind,
      ko: `다음 판단 지점 T+${clock(nextEvent.time)} · ${nextEvent.ko}.`,
      en: `Next decision point T+${clock(nextEvent.time)} · ${nextEvent.en}.`,
    });
  reasons.push({
    code: "energy",
    ko: `예측 ${Math.round(horizon)}초 동안 배터리 최저 ${minEnergyWh.toFixed(1)} / ${capacity.toFixed(1)} Wh.`,
    en: `Over the ${Math.round(horizon)}s forecast, minimum battery is ${minEnergyWh.toFixed(1)} / ${capacity.toFixed(1)} Wh.`,
  });
  const pendingAtStart = pending(actual).length;
  if (pendingAtStart) {
    const executed = commandChanges.filter((c) => c.status === "executed"),
      failed = commandChanges.filter((c) => c.status === "failed");
    const first = executed.length
      ? Math.min(...executed.map((c) => c.executedAt!))
      : null;
    reasons.push({
      code: "commands",
      ko: `기존 대기·전파 명령 ${pendingAtStart}개: 예측 중 ${executed.length}개 실행${first === null ? "" : `(첫 실행 T+${clock(first)})`}, ${failed.length}개 실패. 광행시간과 도착 조건을 그대로 계산했습니다.`,
      en: `${pendingAtStart} existing queued/in-flight command${pendingAtStart === 1 ? "" : "s"}: ${executed.length} execute${first === null ? "" : ` (first T+${clock(first)})`}, ${failed.length} fail in the forecast. Light time and arrival conditions are simulated unchanged.`,
    });
  } else {
    const gained = state.scienceReceived - actual.scienceReceived;
    reasons.push({
      code: "science",
      ko: `이 구간의 추가 유효 수신 ${gained}개 · 예측 끝 ${state.scienceReceived}/${requirement.targetPackets}개. 새 명령 없이 현재 일정만 실행한 결과입니다.`,
      en: `${gained} additional valid dataset${gained === 1 ? "" : "s"} in this interval · ${state.scienceReceived}/${requirement.targetPackets} at forecast end. This continues the current schedule without new commands.`,
    });
  }
  return {
    baseTime,
    horizon,
    requestedHorizonSeconds,
    minEnergyWh,
    energyCapacity: capacity,
    scienceAtHorizon: state.scienceReceived,
    nextEvent,
    reasons: reasons.slice(0, 3),
    endingStatus: state.status,
    pendingCommandsAtHorizon: pending(state).length,
    commandChanges,
    ticks,
    computeMs: Math.max(0, now() - started),
    assumesNoNewCommands: true,
  };
}
