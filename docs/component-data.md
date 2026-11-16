# 실제 부품 참고 데이터

2026-11-15에 NASA Small Spacecraft State-of-the-Art의 전력·통신 표에서 부품을 찾고, 연결된 제조사의 현재 제품 페이지와 원본 데이터시트까지 확인했다. **참고 하드웨어 4종의 실제 사양**을 `public/data/component-sources.json`에 구조화했다. 모델1.1은 아래의 태양전지·배터리 일부 값을 명시적으로 사용한다. 무전기·패치 안테나는 실제 부품과 게임 통신 모델의 차이를 설명하는 비교 참고용이다.

## 확인한 값

| 실제 하드웨어 | 질량 | 전력·에너지·성능 | 적용 조건 |
|---|---:|---|---|
| GomSpace NanoPower TSP-45W | 총 질량 885 g | 날개당 최대 45 W | BOL, 제조사 제시 태양복사 1367 W/m². 일식 중 발전량이나 궤도 평균이 아님 |
| GomSpace NanoPower BPX 100 Wh | 500 g | 명목 100 Wh, 4S-2P 14.4 V·7 Ah, 가열기 6 W | 100 Wh와 실제 사용 가능 에너지 구별. 가열기 전력은 작동할 때만 발생 |
| GomSpace NanoCom AX100U | 24.5 g | 송신 DC 소비 약 2.64 W, 수신 약 0.1815 W, RF 출력 전형값 30 dBm = 1 W | DC 값은 3.3 V × 데이터시트 전형 전류로 계산. 송신은 최대 PCL·25°C 조건 |
| ISISPACE S-Band Patch Antenna | **60 g 미만** | 중심 주파수 boresight 이득 6.5 dBic, 반전력 빔폭 100°, RF 취급 전력 2 W | 2200–2290 MHz, RHCP 수동 안테나. 2 W는 DC 소비 전력이 아님 |

### 태양전지 날개

NASA 2026 **Table 3-2**의 GomSpace TSP 행은 날개당 45 W와 비출력 60 W/kg을 기재한다. 현재 제조사는 총 질량 885 g과 전개 구조 질량 650 g을 별도 항목으로 제공한다. 서로 다른 질량 범위를 섞어 비출력에서 질량을 역산하지 않았다. 전개한다고 질량 235 g이 사라지는 것으로 계산해서도 안 된다. 추적 구동기 소비전력과 부착 부품 포함 범위는 이 기록에서 확정하지 않았다. [NASA 전력 표](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/), [제조사 TSP-45W 제품 정보의 Technical insights](https://gomspace.com/product/nanopower-tsp-45w/)

### 배터리

BPX의 제조사 **DS 1076870, revision 1.1.0, 2026-04-21**을 우선했다. 질량은 PDF 17쪽/인쇄 13쪽 Table 7.1, 명목 에너지는 PDF 5–6쪽/인쇄 1–2쪽, 가열기는 PDF 13쪽/인쇄 9쪽 Table 6.1이다. 명목 100 Wh를 출력 100 W로 해석하지 않는다. [원본 BPX 데이터시트](https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanopower-BPX-100-Wh-1076870-1.1.0.pdf)

NASA Table 3-5의 BPX 3000 mAh 셀 구성은 4S-2P에서 6 Ah이다. 현재 100 Wh 제품 데이터시트는 3500 mAh 명목 셀 구성으로 7 Ah를 제시한다. 제조사 랜딩 페이지 일부 문구에는 예전 6 Ah가 남아 있어 데이터시트의 명시된 구성을 우선했다. 또한 데이터시트 소개의 권장 범위 86 Wh와 전압 조건별 표의 87/89 Wh가 다르므로, 이를 평균하거나 하나의 확정 가용 용량으로 합치지 않았다. [NASA 배터리 표](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/), [BPX 제품 페이지](https://gomspace.com/product/nanopower-bpx/)

### 무전기

AX100U는 작은 UHF 무전기 보드이다. 제조사 **DS 1013823, revision 3.7, 2019-11-29**의 PDF 11쪽 §7에서 3.3 V, 수신 전형 전류 55 mA, 최대 PCL·25°C에서 송신 전형 전류 800 mA를 확인했다. 전력은 각각 `3.3 × 0.055 = 0.1815 W`, `3.3 × 0.800 = 2.64 W`로 **유도값** 표시했다. PDF 12쪽 §8.1의 RF 출력 전형값 30 dBm은 1 W이며 전기 소비전력과 다르다. 최대 38,400 bit/s는 무선 신호율 능력이고, 25 kHz 대역폭 안에서의 표상 최대값은 19,200 bit/s이다. 수신 과학 데이터율은 프로토콜·코딩·링크 여유에 따라 더 작아진다. [AX100 원본 데이터시트](https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanocom-ax100.pdf)

NASA 2026 Table 9-3의 AX100 행도 질량 24.5 g과 RF 출력 30 dBm을 제시한다. 치수는 NASA 표와 제조사 표기 사이에 차이가 있어, 제조사가 명시한 65×40×6.5 mm를 저장했다. 이 보드를 게임의 화성용 고이득 통신 모듈과 같은 하드웨어라고 표시하면 안 된다. [NASA 통신 표](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/), [AX100 제품 페이지](https://gomspace.com/product/nanocom-ax100/)

### 안테나

ISISPACE 현재 Product Specification 표는 질량 **<60 g**, 직경 80 mm, 커넥터 제외 높이 5 mm를 제공한다. NASA Table 9-2의 50 g과는 별도 출처 진술로 유지했다. 제조사 이득 단위는 **dBic**이므로 NASA 표의 공통 dBi 열 제목에 맞춰 임의 변경하지 않았다. 수동 패치만으로 통신이 되는 것은 아니며 송수신기·케이블·지향·거리·잡음·주파수 조건이 추가로 필요하다. [ISISPACE S-Band Patch Antenna의 Product Specification](https://isispace.nl/product/s-band-patch-antenna/)

## 게임에 표시할 방법

제작 화면의 “실제 부품 사양 · 원문 비교” 카드에서 실제 제품명, 출처, 조건과 **게임 모듈 수치**를 함께 표시한다. [catalog.ts](../src/sim/catalog.ts)의 `sourceId`, `sourceFields`, `conditions`, `provenance`로 적용 범위를 명시한다.

| 게임 모듈 | 모델1.1에 적용한 값 | 여전히 게임 가정인 부분 |
|---|---|---|
| `solar` | TSP-45W 총질량0.885kg, BOL정면최대45W | 3D형상·장착범위·가격. 추적장치를 모사하지 않는 고정패널/기체자세 모델 |
| `solarLarge` | 출처 날개6개 합산270W·5.31kg에 가정 장착구0.40kg 추가 | 제조사 단일제품이 아닌 유도된 설계, 전체형상·장착구·가격 |
| `battery` | BPX 질량0.500kg, 명목100Wh, 소개의 권장범위86Wh를 게임 가용에너지로 선택 | 충전25W·방전60W·효율·대기전력·온도/노화생략·형상·가격. 다른 조건의87/89Wh와 동일한 실측치라고 하지 않음 |

RF 송수신/DC소비·35dBi 접시·화성링크 등은 현재 게임의 교육용 가정이다. AX100U나 ISISPACE 패치의 검증값을 실제로 적용한 통신 장비라고 표시하지 않는다.

- `specifications[].sourceId`와 `locator`는 수치마다 원문 위치를 제공한다.
- `provenance: derived`인 수치는 공식 기재값으로 표시하지 않고 공식을 함께 제공한다.
- `comparison: lt`를 `<`로 렌더링한다. 상한을 정확한 질량으로 보여주지 않는다.
- 가격은 네 제품 모두 `null`이다. 게임 예산 포인트를 달러나 실제 견적이라고 표시하지 않는다.
- 발전 W, 저장 Wh, DC 소비 W, RF 출력 W, RF 취급 한계 W를 서로 다른 필드로 유지한다.
- 관측 카메라·추진기 등 아직 검증한 실물 데이터가 없는 게임 부품에는 실제 제품 출처를 꾸며 넣지 않는다.

NASA 표는 관련 제품을 찾는 유용한 출발점이다. 표에 포함되었다는 사실이 제조사 수치를 NASA가 독립 시험·인증했다는 뜻은 아니다. 실제 가격, 현재 조달 가능성, 임무 적합성이나 비행 인증 여부도 이 참고 데이터로 확정하지 않는다.
