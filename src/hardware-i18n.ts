import { HARDWARE_MODELS, BUSES } from "./hardware/catalog";

/** Display-only translation of the pinned hardware model's diagnostics. */
const phrases: Record<string, string> = {
  "하드웨어 계산 모델 또는 카탈로그 해시가 다릅니다.":
    "The hardware calculation model or catalog hash does not match.",
  "기존 설계와 새 하드웨어 모델이 혼합되었습니다.":
    "The original design and new hardware model cannot be mixed.",
  "알 수 없는 하드웨어 버스입니다.": "Unknown spacecraft bus.",
  "기존 모델에 없는 부품입니다.":
    "This component is unavailable in the original model.",
  "장비 모델 ID와 종류가 일치하지 않습니다.":
    "The equipment model ID and kind do not match.",
  "이 하드웨어 프로필은 과학 관측기를 하나만 지원합니다. 여러 센서의 성능을 합칠 수 없습니다.":
    "This spacecraft uses one science instrument. Capabilities from different sensors cannot be combined.",
  "하드웨어 설계는 최대 20개 부품을 지원합니다.":
    "A systems design supports at most 20 components.",
  "호환 전압 또는 최대 전력의 출력 포트가 없습니다.":
    "No power output provides the required operating voltage and peak power.",
  "호환 데이터 인터페이스 또는 사용 가능한 포트가 없습니다.":
    "The required data interface, driver or available port is missing.",
  "태양전지 날개 수가 독립 MPPT 입력 수를 초과합니다.":
    "Solar wings exceed the available independent MPPT inputs.",
  "버스에 배터리가 포함되지 않습니다. 배터리 팩을 장착하세요.":
    "This bus requires an installed battery pack.",
  "선택한 무전기가 없거나 연결되지 않았습니다.":
    "The selected radio is absent or disconnected.",
  "전력과 데이터가 연결된 무전기를 장착하세요.":
    "Install a radio with power and data connections.",
  "선택한 무전기에 맞는 주파수 대역의 안테나가 없습니다.":
    "The selected radio has no antenna in the matching frequency band.",
  "전력과 데이터가 연결된 자세제어 장치가 필요합니다.":
    "An attitude-control unit with power and data connections is required.",
  "이 버스는 자세제어 장치를 하나만 사용합니다.":
    "This bus uses one attitude-control unit.",
  "출력의 동시 소비전력이 한도를 초과합니다.":
    "rail load exceeds the simultaneous power limit.",
  "전체 전력 분배 한도를 초과합니다.":
    "The total power-distribution limit is exceeded.",
  "지원하지 않는 하드웨어 버전 또는 버스입니다.":
    "Unsupported hardware version or spacecraft bus.",
  "기존 설계에는 새 하드웨어 필드를 사용할 수 없습니다.":
    "New hardware fields are not valid in an original-model design.",
  "장비 모델과 종류가 일치하지 않습니다.":
    "The equipment model and kind do not match.",
  "노출 및 데이터 버스 기록을 마친 새 과학 자료를 저장했습니다.":
    "Stored a new observation after exposure and data-bus transfer completed.",
  "노출 및 데이터 버스 기록을 마친 화성 분광 자료를 저장했습니다.":
    "Stored a Mars spectrum after exposure and data-bus transfer completed.",
  "내부 베이의 실제 수납 공간을 벗어났습니다.":
    "The component extends outside the internal service bay.",
};

export function translateHardwareMessage(source: string): string {
  let text = source;
  for (const [ko, en] of Object.entries(phrases))
    text = text.split(ko).join(en);
  for (const model of Object.values(HARDWARE_MODELS))
    text = text.split(model.name).join(model.nameEn);
  for (const bus of Object.values(BUSES))
    text = text.split(bus.name).join(bus.nameEn);
  return text;
}
