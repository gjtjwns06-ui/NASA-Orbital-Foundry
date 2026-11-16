import type { Design, MissionPreview, MissionResult } from "./sim/types";
import { MISSIONS, evaluateDesign, flybyMetrics } from "./sim";
import { getTargetRequirements } from "./sim/targets";
import { getLanguage } from "./i18n";

const word = (ko: string, en: string) => (getLanguage() === "ko" ? ko : en);
const number = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });

/** Each vertex and window comes from the same fixed-step mission preview used for launch review. */
export function resourceGraph(
  preview: MissionPreview | null,
  at: number,
): string {
  if (!preview?.samples.length) return "";
  const samples = preview.samples,
    duration = samples.at(-1)!.duration;
  const nearest = samples.reduce((a, b) =>
    Math.abs(a.time - at) < Math.abs(b.time - at) ? a : b,
  );
  const path = (fn: (s: typeof nearest) => number) =>
    samples
      .map(
        (s, i) =>
          `${i ? "L" : "M"}${((s.time / duration) * 1000).toFixed(2)},${(68 - Math.min(1, Math.max(0, fn(s))) * 54).toFixed(2)}`,
      )
      .join(" ");
  const bands = samples
    .slice(0, -1)
    .map((s, i) => {
      const x = (s.time / duration) * 1000,
        w = ((samples[i + 1].time - s.time) / duration) * 1000 + 0.1;
      return `${s.eclipse ? `<rect x="${x}" y="5" width="${w}" height="63" fill="#93a4be" opacity=".12"/>` : ""}${s.groundVisible ? `<rect x="${x}" y="75" width="${w}" height="5" fill="#b2a0ed" opacity=".8"/>` : ""}`;
    })
    .join("");
  return `<section class="resource-chart"><div class="resource-title"><strong>${word("예측 자원 곡선", "Predicted resources")}</strong><span><i class="curve-dot energy"></i>${word("배터리", "Battery")} ${number(nearest.energyWh, 1)} Wh</span><span><i class="curve-dot storage"></i>${word("저장", "Stored")} ${number(nearest.storedBits / 8e6, 1)} MB</span><small>T+ ${number(nearest.time / 60, 1)} min</small></div><svg id="resource-graph" viewBox="0 0 1000 86" preserveAspectRatio="none" role="img" aria-label="${word("드래그하여 시각별 배터리와 저장량 확인", "Drag to inspect battery and storage over time")}">${bands}<path d="M0 68H1000M0 14H1000" stroke="#75959c" stroke-opacity=".25" fill="none"/><path d="${path((s) => (s.batteryWh > 0 ? s.energyWh / s.batteryWh : 0))}" stroke="#93dec7" stroke-width="2.2" fill="none" vector-effect="non-scaling-stroke"/><path d="${path((s) => s.storedBits / s.storageBits)}" stroke="#efbe70" stroke-width="1.8" fill="none" vector-effect="non-scaling-stroke"/><path d="M${(at / duration) * 1000} 0V83" stroke="#e8e2cb" stroke-width="1.2" fill="none" vector-effect="non-scaling-stroke"/></svg><div class="resource-caption">${word("드래그로 시간 탐색 · 회색: 일식 · 보라색: 기하학적 교신창 · 세로축: 각 용량의 0–100%", "Drag through time · Grey: eclipse · Purple: geometric contact · Y: 0–100% of each capacity")}</div></section>`;
}

/** Readable requirements, not an invented success probability. */
export function requirementTable(
  design: Design,
  result?: MissionResult,
): string {
  const mission = {
      ...MISSIONS[design.missionId],
      ...(design.missionId === "earth"
        ? getTargetRequirements(
            design.scienceTarget,
            Boolean(design.hardwareVersion),
          )
        : {}),
    },
    ev = evaluateDesign(design);
  const rows: Array<[string, string, boolean | null]> = [
    [
      word("사용 예산", "Budget"),
      `${ev.cost} / ${mission.budget} C`,
      ev.cost <= mission.budget,
    ],
    [
      word("발사 질량", "Launch mass"),
      `${number(ev.massKg, 2)} / ${ev.massLimitKg} kg`,
      ev.massKg <= ev.massLimitKg,
    ],
    [
      word("유효 수신 자료", "Valid data received"),
      `${result?.received ?? "—"} / ${mission.targetPackets}`,
      result ? result.received >= mission.targetPackets : null,
    ],
    [
      word("최소 관측 품질", "Minimum data quality"),
      `${mission.minimumQuality * 100}%`,
      result
        ? result.packets.filter(
            (p) => p.receivedAt !== null && p.quality >= mission.minimumQuality,
          ).length >= mission.targetPackets
        : null,
    ],
    [
      word("임무 기간", "Mission duration"),
      `${mission.duration / 3600} h`,
      null,
    ],
  ];
  if (design.missionId === "mars") {
    const f = flybyMetrics(design.plan);
    rows.push([
      word("최근접 고도", "Closest altitude"),
      `${number(f.altitudeKm)} / ≥250 km`,
      f.safe,
    ]);
    rows.push([
      word("태양 기준 속력 증가", "Heliocentric speed gain"),
      `${number(f.speedGainKmS, 2)} / ≥1 km/s`,
      f.speedGainKmS >= 1,
    ]);
  }
  if (result?.hazard)
    rows.push([
      word("잔해 최소 분리", "Minimum debris separation"),
      `${number(result.hazard.minDistanceKm, 3)} / ≥2 km`,
      result.hazard.safe,
    ]);
  return `<div class="requirements-table">${rows.map(([label, value, pass]) => `<div class="requirement-row"><span class="requirement-mark ${pass === false ? "miss" : ""}">${pass === null ? "·" : pass ? "✓" : "!"}</span><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;
}
