import data from "../public/data/component-sources.json";
import type { PartKind } from "./sim";
export function componentEvidenceLinks(sourceIds: readonly string[]) {
  const links = data.records
    .filter((r) => sourceIds.includes(r.id))
    .flatMap((r) =>
      r.sources
        .filter((s) =>
          /manufacturer|technical brochure|NASA|NASA\/JPL/.test(s.type),
        )
        .map((s) => ({ title: `${r.product} · ${s.type}`, url: s.url })),
    );
  return [...new Map(links.map((s) => [s.url, s])).values()];
}
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const labels: Record<string, string> = {
  massTotalKg: "전체 질량",
  powerPerWingW: "날개 최대 출력",
  massKg: "질량",
  nominalEnergyWh: "정격 저장 에너지",
  recommendedRangeEnergyWh: "권장 범위 에너지",
  txDcPowerTypicalW: "송신 DC 소비전력",
  rfOutputTypicalW: "RF 출력",
  signalRateMaxBps: "최대 신호 전송률",
  gainDbi: "안테나 이득",
  gainDbic: "안테나 이득",
  maxInputPowerW: "RF 입력 허용",
  massUpperBoundKg: "질량 상한",
  halfPowerBeamwidthDeg: "반전력 빔 폭",
};
export function componentSourceHTML(kind?: PartKind) {
  const records = data.records.filter(
    (r) => !kind || r.relatedGameKinds.includes(kind),
  );
  return `<div class="sources-list"><p>실제 하드웨어의 공개 사양과 게임 모듈을 비교합니다. 제조사가 공개한 값이며 독립 성능 시험이나 NASA 인증을 뜻하지 않습니다. 크레딧은 실제 구매 가격이 아닙니다.</p>${
    records.length
      ? records
          .map(
            (r) =>
              `<article class="component-record"><div class="eyebrow">${escape(r.manufacturer)}</div><h3>${escape(r.product)}</h3><table>${r.specifications
                .filter((s) => Object.keys(labels).includes(s.key))
                .map(
                  (s) =>
                    `<tr><td>${labels[s.key]}</td><td>${escape(Array.isArray(s.value) ? s.value.join(" × ") : s.value)} ${escape(s.unit)}</td></tr>`,
                )
                .join("")}</table><p>${escape(r.limitations[0])}</p>${r.sources
                .filter(
                  (s) =>
                    s.type === "manufacturer datasheet" ||
                    s.type === "manufacturer product page" ||
                    s.type === "NASA table",
                )
                .map(
                  (s) =>
                    `<a href="${escape(s.url)}" target="_blank" rel="noopener">${escape(s.type)} · ${escape("locator" in s ? s.locator : "제품 설명")}</a><br>`,
                )
                .join("")}</article>`,
          )
          .join("")
      : "<p>이 부품의 개별 제조사 수치는 아직 데이터베이스에 연결되지 않았습니다. 게임에 표시된 대표 사양을 실물 제품의 보증 성능으로 해석하지 않습니다.</p>"
  }<p>원문 조건·단위·차이·계산식: <a href="/data/component-sources.json" target="_blank" rel="noopener">전체 출처 데이터</a></p></div>`;
}
