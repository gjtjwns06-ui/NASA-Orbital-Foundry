import { getLanguage } from "./i18n";
import thumbnails from "../public/data/hardware-thumbnails-v3.json";
import "./ui-hardware.css";

const word = (ko: string, en: string) => (getLanguage() === "ko" ? ko : en);
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** View records contain formatted domain facts. They never calculate capability. */
export interface HardwareBusView {
  id: string;
  name: string;
  description: string;
  facts: Array<{ label: string; value: string }>;
  selected: boolean;
}
export interface HardwareConnectionView {
  partId: string;
  partName: string;
  connected: boolean;
  channels: Array<{ label: string; value: string }>;
  issues: string[];
}
export interface HardwareEvidenceView {
  title: string;
  subtitle: string;
  facts: Array<{ label: string; value: string; basis: string }>;
  notes: string[];
  sources: Array<{ title: string; url: string }>;
}

/** The atlas is rendered from the installed models; catalogue order is not assumed. */
export function hardwareThumbnailHTML(modelId: string): string {
  const tile = thumbnails.models.indexOf(modelId);
  if (tile < 0) return "";
  const x = ((tile % thumbnails.columns) / (thumbnails.columns - 1)) * 100;
  const y =
    (Math.floor(tile / thumbnails.columns) / (thumbnails.rows - 1)) * 100;
  return `<span class="hardware-thumbnail" data-model-thumb="${esc(modelId)}" aria-hidden="true" style="background-image:url('${esc(thumbnails.image)}');background-size:${thumbnails.columns * 100}% ${thumbnails.rows * 100}%;background-position:${x}% ${y}%"></span>`;
}

export function hardwareBusStrip(name: string, problems: number): string {
  return `<div class="hardware-strip"><button data-action="hardware-buses" class="hardware-bus-button"><span>${word("우주선 버스", "SPACECRAFT BUS")}</span><strong>${esc(name)}</strong><i aria-hidden="true">↗</i></button><button data-action="hardware-connections" class="hardware-link-button ${problems ? "has-issues" : ""}"><span>${word("전력 · 데이터 · RF", "POWER · DATA · RF")}</span><strong>${problems ? word(`${problems}개 연결 확인`, `${problems} connection issues`) : word("자동 연결 보기", "Inspect connections")}</strong></button></div>`;
}

export function hardwareBusPickerHTML(buses: HardwareBusView[]): string {
  return `<p class="hardware-intro">${word("같은 외형 안에서 전원 장치와 내부 공간이 달라집니다. 버스를 바꿔도 붙여 둔 장비는 그대로 남으며, 맞지 않는 연결은 설계 검토에 표시됩니다.", "The buses share an outer envelope but have different power systems and internal capacity. Changing the bus keeps your installed equipment and reports incompatible connections in the design review.")}</p><div class="hardware-bus-options">${buses.map((bus) => `<article class="hardware-bus-option ${bus.selected ? "is-selected" : ""}"><div class="hardware-bus-silhouette ${bus.id.startsWith("pathfinder") ? "expedition" : "surveyor"}" aria-hidden="true"><i></i><b></b><span></span></div><div class="eyebrow">${bus.selected ? word("현재 선택", "CURRENT BUS") : "SPACECRAFT PLATFORM"}</div><h3>${esc(bus.name)}</h3><p>${esc(bus.description)}</p><dl>${bus.facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("")}</dl><button class="${bus.selected ? "secondary" : "primary"}" data-hardware-bus="${esc(bus.id)}" ${bus.selected ? "disabled" : ""}>${bus.selected ? word("장착됨", "Installed") : word("이 버스로 변경", "Use this bus")}</button></article>`).join("")}</div><p class="small-note">${word("버스와 통합 인터페이스는 게임 설계입니다. 제조사 제품의 인증된 우주선 구성이 아닙니다. 변경은 되돌리기로 취소할 수 있습니다.", "Bus and integration interfaces are authored game designs, not qualified manufacturer spacecraft. Undo restores the previous configuration.")}</p>`;
}

export function hardwareConnectionsHTML(
  rows: HardwareConnectionView[],
  summary: Array<{ label: string; value: string }>,
): string {
  return `<div class="hardware-connection-summary">${summary.map((s) => `<div><span>${esc(s.label)}</span><strong>${esc(s.value)}</strong></div>`).join("")}</div><p class="small-note">${word("호환되는 포트를 자동으로 연결합니다. 장비를 선택해 실제 조립 위치와 연결 조건을 확인하세요.", "Compatible ports connect automatically. Select equipment to inspect its physical position and connection requirements.")}</p><div class="hardware-connections">${rows.map((row) => `<article class="hardware-connection ${row.connected ? "connected" : "disconnected"}"><header><span aria-hidden="true">${row.connected ? "✓" : "!"}</span><button data-hardware-focus="${esc(row.partId)}">${esc(row.partName)} <i aria-hidden="true">↗</i></button><small>${row.connected ? word("연결됨", "CONNECTED") : word("확인 필요", "CHECK CONNECTION")}</small></header><dl>${row.channels.map((c) => `<div><dt>${esc(c.label)}</dt><dd>${esc(c.value)}</dd></div>`).join("")}</dl>${row.issues.map((issue) => `<p class="hardware-connection-issue">${esc(issue)}</p>`).join("")}</article>`).join("") || `<p>${word("장비를 기체에 놓으면 연결 경로가 나타납니다.", "Install equipment to see its connections.")}</p>`}</div>`;
}

export function hardwareEvidenceHTML(view: HardwareEvidenceView): string {
  return `<article class="hardware-evidence"><div class="eyebrow">${esc(view.subtitle)}</div><h3>${esc(view.title)}</h3><table><thead><tr><th>${word("항목", "Field")}</th><th>${word("적용 값", "Value used")}</th><th>${word("근거", "Basis")}</th></tr></thead><tbody>${view.facts.map((f) => `<tr><td>${esc(f.label)}</td><td>${esc(f.value)}</td><td>${esc(f.basis)}</td></tr>`).join("")}</tbody></table>${view.notes.map((n) => `<p>${esc(n)}</p>`).join("")}<div class="hardware-source-links">${view.sources
    .filter((s) => /^https:\/\//i.test(s.url))
    .map(
      (s) =>
        `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`,
    )
    .join(
      "",
    )}</div><p class="small-note">${word("게임 크레딧은 실제 구매 가격이 아닙니다. 3D 형상은 장착과 가림을 보여주기 위한 자체 제작 모델입니다.", "Game credits are not purchase prices. The original 3D geometry illustrates mounting and obstruction.")}</p></article>`;
}
