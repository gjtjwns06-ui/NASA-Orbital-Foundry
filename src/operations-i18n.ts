import { getLanguage } from "./i18n";
import {
  OPERATIONS_REASONS,
  type OperationsReasonCode,
} from "./transfer/operations-codes";

const korean: Record<OperationsReasonCode, string> = {
  INVALID_INPUT: "명령 형식이나 값이 올바르지 않습니다.",
  MODEL_UNSUPPORTED: "이 비행 모델에서는 원격 명령을 사용할 수 없습니다.",
  COMMAND_PROFILE_REQUIRED: "원격 운용에는 새 하드웨어 프로필이 필요합니다.",
  COMMAND_RADIO_REQUIRED: "연결된 Iris X 대역 무선기를 선택하세요.",
  COMMAND_ANTENNA_REQUIRED:
    "선택한 Iris 무선기에 호환되는 X 대역 반사판을 연결하세요.",
  COMMAND_CONNECTION: "명령 수신 장비의 연결이 맞지 않습니다.",
  COMMAND_SIZE: "인코딩한 명령이 전송 크기 한도를 초과합니다.",
  COMMAND_LIMIT: "이 비행의 고유 명령 수 한도에 도달했습니다.",
  ACTION_LIMIT: "이 비행의 명령 조작 수 한도에 도달했습니다.",
  ATTEMPT_LIMIT: "이 명령의 재전송 한도에 도달했습니다.",
  ACTION_ID_CONFLICT: "같은 조작 ID에 다른 내용이 등록돼 있습니다.",
  COMMAND_ID_CONFLICT: "같은 명령 ID의 내용을 바꿀 수 없습니다.",
  COMMAND_NOT_FOUND: "해당 명령을 찾을 수 없습니다.",
  COMMAND_ALREADY_EMITTED: "이미 발신한 신호는 회수할 수 없습니다.",
  COMMAND_ALREADY_QUEUED: "이 명령은 이미 송신을 기다리고 있습니다.",
  QUEUE_EXPIRED: "아직 발신하지 않은 시도가 지상에서 만료됐습니다.",
  TX_NO_STATION: "현재 송신할 수 있는 지상국이 없습니다.",
  RX_LEVEL_OUTSIDE_MODEL:
    "예상 입력 신호가 이 수신기 모델의 지원 범위를 벗어납니다.",
  UPLINK_MARGIN: "명령 통신 여유가 부족합니다.",
  UPLINK_OCCULTED: "천체가 신호 경로를 가립니다.",
  SOLAR_EXCLUSION: "신호 경로가 설정된 태양 회피각 안에 있습니다.",
  RECEIVER_OFF: "탐사선 수신기에 동작 전력이 없습니다.",
  HALF_DUPLEX: "이 무선기는 송신 중에 수신할 수 없습니다.",
  ANTENNA_BLOCKED: "안테나 개구가 가려져 있습니다.",
  POINTING_LOSS: "실제 안테나 방향으로는 신호를 수신할 수 없습니다.",
  INTERVAL_UNCERTAIN:
    "전체 수신 구간의 경로가 열려 있는지 확인하지 못했습니다.",
  TRANSMISSION_INTERRUPTED: "명령 송신이 도중에 끊겼습니다.",
  RECEPTION_INTERRUPTED: "명령 전체를 수신하지 못했습니다.",
  LIGHT_TIME_FAILED: "움직이는 송수신점의 광행시간 계산이 수렴하지 않았습니다.",
  OUTSIDE_MISSION: "신호 도착이 이 임무의 계산 기간 밖에 있습니다.",
  REVISION_MISMATCH: "탐사선에 설치된 일정 버전이 달라졌습니다.",
  REPLACEMENT_LATE: "명령 전체가 일정 교체 시각까지 도착하지 못했습니다.",
  COMMAND_EXPIRED: "새 명령이 만료 시각까지 도착하지 못했습니다.",
  REPLACEMENT_CUTS_OPERATION: "교체 시작점이 기존 작업의 중간을 자릅니다.",
  OPERATION_ID_CONFLICT: "새 작업 ID가 유지되는 일정과 겹칩니다.",
  SCHEDULE_OVERLAP: "작업 시간이 서로 겹칩니다.",
  SCHEDULE_RANGE: "작업 시간이 허용 구간을 벗어납니다.",
  ACK_LOST: "발신한 확인 응답을 온전히 수신하지 못했습니다.",
  ACK_TOO_LARGE: "확인 응답이 정해진 크기를 초과합니다.",
  ACK_WAITING_DOWNLINK: "확인 응답이 지구 송신 기회를 기다립니다.",
  UNCONFIRMED: "확인 응답이 아직 지구에 도착하지 않았습니다.",
  CANCELLED_UNSENT: "미송신 시도를 지상에서 취소했습니다.",
  UNSENT_RETRY_CANCELLED:
    "아직 발신하지 않은 재시도만 취소했습니다. 이전에 발신한 신호는 계속 이동합니다.",
  COMMAND_INSTALLED:
    "미래 일정이 설치됐습니다. 그 작업들이 완료된 것은 아닙니다.",
  DUPLICATE_ACKNOWLEDGED:
    "이미 설치한 명령의 응답을 다시 보냈습니다. 일정을 중복 설치하지 않았습니다.",
  CONFIRMATION_CHAIN_INCOMPLETE:
    "이 일정 버전을 복원하는 데 필요한 앞선 확인 응답이 없습니다.",
  BAD_CHECKPOINT: "저장 상태가 명령 기록을 재생한 결과와 다릅니다.",
  SAVE_TOO_LARGE: "원격 운용 저장 파일이 크기 한도를 초과합니다.",
  REPLAY_CANCELLED: "저장 기록 재생을 취소했습니다.",
};

/** Ground displays must receive only ground reason codes, never truth failures. */
export function operationsText(code: string, fallback = ""): string {
  const known = code as OperationsReasonCode;
  return Object.hasOwn(OPERATIONS_REASONS, code)
    ? getLanguage() === "ko"
      ? korean[known]
      : OPERATIONS_REASONS[known]
    : fallback || code;
}
