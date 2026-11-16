import { getLanguage } from "./i18n";
import type { TransferOperation } from "./transfer/types";

// Every outcome supplied to this view comes from the authoritative worker.
const word = (ko: string, en: string) => (getLanguage() === "ko" ? ko : en);
const esc = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export type GroundCommandStatus =
  | "queued"
  | "transmitting"
  | "awaiting-confirmation"
  | "confirmed"
  | "rejected"
  | "unconfirmed"
  | "cancelled"
  | "expired";

/** Only Earth-known facts belong here. Receiver truth is a different view. */
export interface GroundCommandCard {
  id: string;
  label: string;
  status: GroundCommandStatus;
  issuedLabel: string;
  transmissionFraction: number | null;
  estimateLabel?: string;
  acknowledgedLabel?: string;
  reason?: string;
  canCancel: boolean;
  canRetry: boolean;
}
export interface OperationsPanelView {
  confirmedRevision: number;
  latestAcknowledgedRevision: number;
  confirmationChainComplete: boolean;
  commands: GroundCommandCard[];
  editing: boolean;
  locked?: boolean;
  canEdit: boolean;
  canSend: boolean;
  previewPending: boolean;
  changedBlocks: number;
  validation: string[];
  estimateLabel?: string;
}

function commandStatus(status: GroundCommandStatus): string {
  switch (status) {
    case "queued":
      return word("송신 대기", "Queued on Earth");
    case "transmitting":
      return word("명령 송신 중", "Transmitting command");
    case "awaiting-confirmation":
      return word("응답 대기", "Awaiting acknowledgement");
    case "confirmed":
      return word("일정 설치 확인", "Schedule installation confirmed");
    case "rejected":
      return word("거부 응답 수신", "Rejection received");
    case "unconfirmed":
      return word("응답 미확인", "No acknowledgement received");
    case "cancelled":
      return word("대기 중인 시도 취소", "Unsent attempt cancelled");
    case "expired":
      return word("지상 송신 대기 만료", "Unsent attempt expired on Earth");
  }
}
function commandCard(command: GroundCommandCard): string {
  const fraction = command.transmissionFraction;
  return `<article class="command-card ${command.status}" data-ground-command="${esc(command.id)}">
    <header><strong>${esc(command.label)}</strong><span>${commandStatus(command.status)}</span></header>
    <small>${esc(command.issuedLabel)}</small>
    ${fraction !== null && Number.isFinite(fraction) ? `<progress max="1" value="${Math.max(0, Math.min(1, fraction))}" aria-label="${word("지상 명령 송신 진행", "Ground command transmission progress")}"></progress>` : ""}
    ${command.estimateLabel && !command.acknowledgedLabel ? `<p class="command-estimate">${word("도착 예상", "Estimated arrival")} · ${esc(command.estimateLabel)}</p>` : ""}
    ${command.acknowledgedLabel ? `<p class="command-ack-time">${word("지구 확인", "Earth confirmation")} · ${esc(command.acknowledgedLabel)}</p>` : ""}
    ${command.reason ? `<p>${esc(command.reason)}</p>` : ""}
    ${command.status === "cancelled" || command.status === "expired" ? `<p>${word("이전에 발신한 신호가 있다면 계속 이동합니다. 이 상태는 그 신호를 회수했다는 뜻이 아닙니다.", "Any previously emitted signal continues in flight. This status does not recall that transmission.")}</p>` : ""}
    ${command.canCancel || command.canRetry ? `<div class="command-actions">${command.canCancel ? `<button data-transfer-action="operations-cancel" data-command-id="${esc(command.id)}">${word("미송신 시도 취소", "Cancel unsent attempt")}</button>` : ""}${command.canRetry ? `<button data-transfer-action="operations-retry" data-command-id="${esc(command.id)}">${word("같은 명령 재전송", "Retry this command")}</button>` : ""}</div>` : ""}
  </article>`;
}

export function operationsPanelHTML(view: OperationsPanelView): string {
  const recent = view.commands.slice(-3).reverse();
  return `<section class="command-console" aria-label="${word("지상 명령 관제", "Ground command console")}">
    <header class="command-console-heading"><div><span class="transfer-eyebrow">GROUND COMMAND</span><h3>${word("멀리서 바꾸는 임무", "A mission, commanded from afar")}</h3></div><span class="command-revision">${word("확인 일정", "Confirmed")} R${view.confirmedRevision}</span></header>
    <p class="command-boundary-note">${word("응답이 돌아와야 일정 설치를 확인할 수 있습니다. 미래 작업의 완료와는 다릅니다.", "An acknowledgement confirms installation of the schedule, not completion of its future activities.")}</p>
    ${!view.confirmationChainComplete ? `<p class="command-validation">${word(`최근 응답은 R${view.latestAcknowledgedRevision}을 가리키지만 중간 일정의 확인이 없습니다. 알려진 R${view.confirmedRevision}을 유지합니다. 누락된 명령의 응답을 재요청하세요.`, `The latest acknowledgement refers to R${view.latestAcknowledgedRevision}, but an earlier schedule is unconfirmed. Keeping known R${view.confirmedRevision}. Retry the missing command to request its acknowledgement.`)}</p>` : ""}
    ${
      view.editing
        ? `<div class="command-draft-summary"><strong>${word("전송하지 않은 초안", "Unsent draft")}</strong><span>${word(`${view.changedBlocks}개 블록 변경`, `${view.changedBlocks} blocks changed`)}</span></div>
      ${view.validation.length ? `<ul class="command-validation">${view.validation.map((message) => `<li>${esc(message)}</li>`).join("")}</ul>` : ""}
      ${view.previewPending ? `<p>${word("도착 가능 시간을 계산하고 있습니다…", "Estimating the delivery window…")}</p>` : view.estimateLabel ? `<p class="command-estimate">${word("현재 조건의 도착 예상", "Estimated arrival under current conditions")} · ${esc(view.estimateLabel)}</p>` : ""}
      <p class="command-boundary-note">${word("도착 예상은 보장이 아닙니다. 실제 수신 자세·전력·가림과 이후 응답 송신 기회에 따라 달라집니다.", "Delivery estimates are conditional on actual receiving attitude, power, visibility and a later acknowledgement downlink opportunity.")}</p>
      <div class="command-actions"><button class="transfer-primary" data-transfer-action="operations-send" ${view.canSend && !view.previewPending ? "" : "disabled"}>${word("일정 변경 전송", "Send schedule revision")}</button><button data-transfer-action="operations-discard" ${view.locked ? "disabled" : ""}>${word("초안 취소", "Discard draft")}</button></div>`
        : `<button class="transfer-primary" data-transfer-action="operations-edit" ${view.canEdit ? "" : "disabled"}>${word("미래 일정 직접 수정", "Edit future activities")}</button>`
    }
    <div class="command-list">${recent.map(commandCard).join("") || `<p class="command-empty">${word("탐사선은 현재 탑재 일정으로 비행합니다. 새 명령은 교신 가능한 자세와 전력이 필요합니다.", "The spacecraft follows its onboard schedule. A new command needs a powered receiver and a suitable listening attitude.")}</p>`}</div>
    ${view.commands.length > 3 ? `<details class="command-history"><summary>${word("이전 지상 명령", "Earlier ground commands")} · ${view.commands.length - 3}</summary>${view.commands.slice(0, -3).reverse().map(commandCard).join("")}</details>` : ""}
  </section>`;
}

export interface LiveOperationsTimelineView {
  from: number;
  to: number;
  now: number;
  periapsis: number;
  confirmed: TransferOperation[];
  submitted: TransferOperation[] | null;
  draft: TransferOperation[] | null;
  editableAfter: number;
  canEdit: boolean;
}
function operationName(kind: TransferOperation["kind"]): string {
  return kind === "observe"
    ? word("분광 관측", "Spectra")
    : kind === "downlink"
      ? word("지구 교신", "Earth contact")
      : word("충전", "Charge");
}

/** Three distinct layers; no edit in this HTML can mutate the executing plan. */
export function liveOperationsTimelineHTML(
  view: LiveOperationsTimelineView,
): string {
  const span = view.to - view.from;
  if (!Number.isFinite(span) || span <= 0) return "";
  const position = (time: number) => ((time - view.from) / span) * 100;
  const layers = [
    {
      id: "confirmed",
      name: word("지구 확인", "Confirmed on Earth"),
      operations: view.confirmed,
    },
    {
      id: "submitted",
      name: word("전송한 변경", "Submitted revision"),
      operations: view.submitted,
    },
    {
      id: "draft",
      name: word("수정 초안", "Unsent draft"),
      operations: view.draft,
    },
  ] as const;
  return `<div class="live-operations-layers">${layers
    .map(
      (layer) =>
        `<div class="live-operations-row ${layer.id}"><span class="live-layer-label">${layer.name}</span><div class="live-operation-track" data-live-layer="${layer.id}">${
          layer.operations
            ?.filter((op) => op.end > view.from && op.start < view.to)
            .map((op) => {
              const editable =
                layer.id === "draft" &&
                view.canEdit &&
                op.start >= Math.max(view.now, view.editableAfter);
              const title = `${operationName(op.kind)} · ${((op.start - view.periapsis) / 3600).toFixed(2)}h – ${((op.end - view.periapsis) / 3600).toFixed(2)}h`;
              return `<div class="live-operation ${op.kind} ${editable ? "editable" : "locked"}" ${layer.id === "draft" ? `data-operations-op="${esc(op.id)}"` : ""} style="left:${position(op.start)}%;width:${((op.end - op.start) / span) * 100}%" title="${esc(title)}" ${editable ? `tabindex="0" role="button" aria-label="${esc(title)} · ${word("드래그하여 이동, 끝을 잡아 길이 조절", "Drag to move, drag the edge to resize")}"` : ""}><span>${operationName(op.kind)}</span>${editable ? '<i data-operations-edge="true" aria-hidden="true"></i>' : ""}</div>`;
            })
            .join("") ||
          `<small class="live-layer-empty">${layer.id === "submitted" ? word("전송 대기 중인 변경 없음", "No submitted revision") : layer.id === "draft" ? word("미래 일정을 선택해 수정하세요", "Choose Edit future activities") : word("빈 구간은 태양 지향 충전", "Empty periods charge toward the Sun")}</small>`
        }<i class="live-now-line" style="left:${position(view.now)}%" aria-hidden="true"></i><i class="live-peri-line" style="left:${position(view.periapsis)}%" aria-hidden="true"></i></div></div>`,
    )
    .join("")}</div>`;
}
