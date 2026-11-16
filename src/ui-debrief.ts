import { getLanguage, t } from "./i18n";
import type { Debrief, DesignChange, LocalizedText } from "./debrief";
import "./ui-debrief.css";

const word = (ko: string, en: string) => (getLanguage() === "ko" ? ko : en);
const local = (s: LocalizedText) => s[getLanguage()];
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const number = (n: number, d = 1) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });
const elapsed = (s: number) =>
  `${Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
export interface DebriefLabels {
  part: (kind: string, modelId?: string) => string;
  bus: (id: string) => string;
}

function summary(
  value: unknown,
  change: DesignChange,
  labels: DebriefLabels,
): string {
  if (value === null || value === undefined) return word("없음", "None");
  if (Array.isArray(value))
    return value.length
      ? `${value.length}${word("개 장비", " components")}`
      : word("없음", "None");
  if (change.kind === "bus") return labels.bus(String(value));
  if (typeof value !== "object") return String(value);
  const v = value as Record<string, unknown>;
  if (typeof v.kind === "string" && typeof v.face === "string") {
    const face: { [key: string]: string } = {
      px: "+X",
      nx: "−X",
      py: "+Y",
      ny: "−Y",
      pz: "+Z",
      nz: "−Z",
    };
    return `${labels.part(v.kind, typeof v.modelId === "string" ? v.modelId : undefined)} · ${face[v.face] ?? v.face} · ${number(Number(v.u), 2)}, ${number(Number(v.v), 2)} m · ${number(Number(v.rotation))}°`;
  }
  if (typeof v.start === "number" && typeof v.end === "number")
    return `${v.kind === "observe" ? word("관측", "Observe") : v.kind === "downlink" ? word("송신", "Downlink") : word("충전", "Charge")} ${elapsed(v.start)}–${elapsed(v.end)}`;
  if (typeof v.altitudeKm === "number")
    return `${number(v.altitudeKm)} km · ${number(Number(v.inclinationDeg))}° · ${Array.isArray(v.maneuvers) ? v.maneuvers.length : 0}${word("개 기동", " maneuvers")}`;
  if (typeof v.periapsisAltitudeKm === "number")
    return `${number(v.periapsisAltitudeKm)} km · ${number(Number(v.bPlaneAngleDeg))}°`;
  return word("설계 조건 변경", "Design conditions changed");
}

function changeName(change: DesignChange): string {
  const names: Record<DesignChange["kind"], [string, string]> = {
    hardware: ["장비 구성", "Equipment"],
    layout: ["장비 위치와 회전", "Placement and rotation"],
    operation: ["운영 일정", "Operations"],
    trajectory: ["비행 경로", "Trajectory"],
    bus: ["우주선 버스", "Spacecraft bus"],
    radio: ["통신 체인", "Radio chain"],
    launch: ["발사 패키지", "Launch package"],
    "hardware-profile": ["하드웨어 규칙", "Hardware rules"],
    conditions: ["임무 조건", "Mission conditions"],
  };
  return word(...names[change.kind]);
}

export function debriefHTML(debrief: Debrief, labels: DebriefLabels): string {
  const tr = debrief.transport,
    c = debrief.comparison;
  return `<section class="mission-debrief"><div class="debrief-heading"><div><div class="eyebrow">DESIGN REVIEW</div><h3>${word("기록을 따라, 다음 설계로", "Follow the evidence into your next design")}</h3></div><span>T+${elapsed(debrief.evaluatedAt)} · ${debrief.isFinal ? word("종료 기록", "FINAL RECORD") : word("중간 기록", "INTERIM RECORD")}</span></div><div class="debrief-transport"><div><span>${word("기록한 자료", "Captured")}</span><strong>${tr.captured}</strong></div><div><span>${word("송신하지 못함", "Never emitted")}</span><strong>${tr.neverEmitted}</strong></div><div><span>${word("수신 미확인", "Reception unconfirmed")}</span><strong>${tr.partlyEmitted + tr.fullyEmittedUnconfirmed}</strong></div><div><span>${word("완전 수신", "Fully received")}</span><strong>${tr.fullyReceived}</strong></div></div><div class="debrief-diagnostics">${
    debrief.diagnostics
      .map(
        (d, i) =>
          `<article class="debrief-diagnostic ${d.severity}" data-diagnostic="${esc(d.code)}"><div class="debrief-diagnostic-top"><h4>${esc(local(d.title))}</h4><span>${d.confidence === "observed" ? word("기록에서 확인", "RECORDED") : d.confidence === "supported" ? word("근거 있음", "SUPPORTED") : word("점검 필요", "INSPECT")}</span></div><p>${esc(local(d.detail))}</p>${d.evidence
            .filter(
              (e) =>
                e.kind === "warning" && typeof e.values?.message === "string",
            )
            .map(
              (e) =>
                `<p class="debrief-warning-evidence">${esc(t(String(e.values!.message)))}${e.values!.required !== undefined && e.values!.available !== undefined ? `<br><small>${word("요구", "Required")} ${esc(e.values!.required)} · ${word("가용", "Available")} ${esc(e.values!.available)}</small>` : ""}</p>`,
            )
            .join("")}${
            d.evidence.some((e) => e.time !== undefined)
              ? `<div class="debrief-evidence">${word("기록 시각", "Recorded at")} · ${d.evidence
                  .filter((e) => e.time !== undefined)
                  .slice(0, 3)
                  .map((e) => `T+${elapsed(e.time!)}`)
                  .join(
                    " · ",
                  )}${d.evidence.filter((e) => e.time !== undefined).length > 3 ? " …" : ""}</div>`
              : ""
          }<div class="debrief-actions">${d.actions.map((a, j) => `<button class="secondary" data-debrief-action="${i}:${j}">${esc(local(a.label))} <span aria-hidden="true">↗</span></button>`).join("")}</div></article>`,
      )
      .join("") ||
    `<p class="small-note">${word("이 기록에서 별도의 점검 사건이 발견되지 않았습니다. 다른 설계와 비교하거나 더 까다로운 목표에 도전할 수 있습니다.", "No additional diagnostic event was found in this record. Compare another design or try a more demanding objective.")}</p>`
  }</div>${
    c.available
      ? `<details class="debrief-comparison" open><summary>${word("이전 설계와 비교", "Compare with the previous design")} ${c.comparable && c.scoreDelta ? `<b>${c.scoreDelta.total >= 0 ? "+" : ""}${number(c.scoreDelta.total, 0)} ${word("점", "points")}</b>` : ""}</summary>${
          c.comparable
            ? `<p class="small-note">${word("같은 모델·목표·환경·평가 시각입니다. 여러 선택을 바꿨다면 점수 차이를 특정 부품 하나의 효과로 단정할 수 없습니다.", "Model, objectives, environment and evaluation time match. A score difference does not isolate the effect of one component when several choices changed.")}</p><div class="debrief-delta-metrics">${
                c.metricDeltas
                  ? [
                      [
                        word("유효 수신", "Valid received"),
                        c.metricDeltas.received,
                        "",
                      ],
                      [
                        word("남은 예산", "Budget left"),
                        c.metricDeltas.budgetRemaining,
                        " C",
                      ],
                      [
                        word("최소 배터리", "Minimum battery"),
                        c.metricDeltas.energyMinimumWh,
                        " Wh",
                      ],
                      [
                        word("남은 추진제", "Fuel left"),
                        c.metricDeltas.fuelRemainingKg,
                        " kg",
                      ],
                    ]
                      .map(
                        ([label, v, unit]) =>
                          `<span>${label}<b>${Number(v) >= 0 ? "+" : ""}${number(Number(v), 2)}${unit}</b></span>`,
                      )
                      .join("")
                  : ""
              }</div>`
            : `<div class="debrief-comparison-blocked"><strong>${word("점수 차이를 비교하지 않습니다", "Score differences are not compared")}</strong>${[...new Set(c.blockers.map((b) => local(b.label)))].map((s) => `<p>${esc(s)}</p>`).join("")}</div>`
        }<div class="debrief-changes">${c.designChanges.map((ch, i) => `<article><div class="debrief-change-title"><strong>${changeName(ch)}</strong>${ch.target ? `<button data-debrief-change="${i}" class="text-btn">${word("변경 위치 보기", "Inspect change")} ↗</button>` : ""}</div><div class="debrief-change-values"><span><small>${word("이전", "BEFORE")}</small>${esc(summary(ch.before, ch, labels))}</span><i aria-hidden="true">→</i><span><small>${word("이번", "AFTER")}</small>${esc(summary(ch.after, ch, labels))}</span></div>${ch.ambiguous ? `<p class="small-note">${word("동일 종류가 여러 개여서 개별 장비의 이동으로 특정하지 않았습니다.", "Several matching parts exist; this change is shown as a group rather than an assumed individual move.")}</p>` : ""}</article>`).join("") || `<p class="small-note">${word("물리적으로 다른 설계 변경이 없습니다.", "No physical design changes were found.")}</p>`}</div>${c.commandStrategyChanged ? `<p class="small-note">${word("지상 명령의 종류·요청 시각 또는 길이도 달라졌습니다.", "Ground-command kinds, request times or durations also changed.")}</p>` : ""}</details>`
      : ""
  }<details class="debrief-limits"><summary>${word("이 기록을 읽는 방법", "How to read this record")}</summary>${debrief.limitations.map((l) => `<p>${esc(local(l))}</p>`).join("")}</details></section>`;
}
