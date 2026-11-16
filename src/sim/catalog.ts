import type { Design, MissionDefinition, MissionId, PartDefinition, LegacyPartKind, PartKind, Plan } from './types';
export const MODEL_VERSION='1.3.0';
export const BUS={massKg:35,cost:120,batteryWh:90,storageBits:256e6,basePowerW:18,fuelKg:6,ispS:230,chargeLimitW:45,dischargeLimitW:60,halfSize:[.65,.8,.65] as const};
const source='https://www.nasa.gov/smallsat-institute/sst-soa/';
function part(kind:PartKind,name:string,nameEn:string,category:string,massKg:number,cost:number,idlePowerW:number,activePowerW:number,footprint:[number,number],depth:number,color:string,extra:Partial<PartDefinition>={}):PartDefinition{return {kind,name,nameEn,category,massKg,cost,idlePowerW,activePowerW,footprint,depth,color,maxCount:4,description:'학습용 대표 부품. 아래 수치는 게임 설계값이며 특정 제조사 제품의 인증 사양이 아닙니다.',source,provenance:'game-assumption',...extra};}
// Legacy public dictionary remains source-compatible; new hardware must use
// getPartDefinition(design,part), never index this table with new model kinds.
export const PARTS:Record<LegacyPartKind,PartDefinition>&Record<string,PartDefinition>={
 solar:part('solar','TSP-45W 태양전지','TSP-45W solar wing','전력',.885,34,0,0,[.3,.5],1.05,'#183d75',{outputW:45,description:'GomSpace 공개값: 총질량 0.885 kg, 수명초기 정면 최대 45 W. 장착 형상과 크레딧은 게임 설정입니다.',source:'https://gomspace.com/product/nanopower-tsp-45w/',sourceId:'gomspace-tsp45w',provenance:'manufacturer-published',sourceFields:['massKg','outputW'],conditions:['제조사 조건: BOL, 태양 플럭스 1367 W/m²에서 약 45 W/wing.','자세·온도·열화에 따라 실제 출력이 달라집니다. 게임은 입사각·그림자·거리만 계산합니다.','추적 구동기 소비전력은 공개 단일값 미확인. 게임은 고정 패널과 전체 기체 자세를 모델링합니다.','3D 형상·장착 크기·가격은 실물 CAD 또는 제조사 가격이 아닙니다.']}),
 solarLarge:part('solarLarge','6날개 전력 어레이','Six-wing power array','전력',6*.885+.4,52,0,0,[.32,.56],1.7,'#315a99',{outputW:270,description:'45 W 날개 6개의 합산 설계: 최대 270 W, 날개 5.31 kg + 가정 장착구 0.40 kg. 실재 단일 상품이 아닙니다.',source:'https://gomspace.com/product/nanopower-tsp-45w/',sourceId:'gomspace-tsp45w',provenance:'derived-assembly',sourceFields:['massKg','outputW'],assumedMountMassKg:.4,conditions:['출력 = 6 × 45 W, 날개 질량 = 6 × 0.885 kg.','장착구 질량 0.40 kg, 전체 형상·크레딧은 게임 가정입니다.','제조사가 검증한 6날개 통합 시스템이나 실물 제품으로 표시하지 않습니다.']}),
 camera:part('camera','광학 카메라','Optical camera','과학',3.2,70,2,42,[.36,.36],.48,'#66c8ca',{maxCount:2,description:'선명한 지표 관측을 위한 카메라. 본체 -Z 방향에 배치하면 관측 자세에서 목표를 봅니다.'}),
 spectrometer:part('spectrometer','분광 관측기','Spectrometer','과학',4.6,92,3,56,[.38,.4],.42,'#af92dc',{maxCount:2,description:'화성 표면의 분광 자료를 수집합니다. 본체 -Z 방향으로 장착하세요.'}),
 antenna:part('antenna','지향성 안테나','High-gain antenna','통신',2.1,44,1,35,[.38,.38],.68,'#f1e8d5',{maxCount:2,description:'수집한 자료를 지구로 전송합니다. 송신 자세에서는 본체 +Z 방향이 지구를 향합니다.'}),
 battery:part('battery','BPX 100 Wh 배터리','BPX 100 Wh battery','전력',.5,28,.1,.1,[.33,.42],.24,'#e9b54b',{capacityWh:86,nominalCapacityWh:100,chargeLimitW:25,dischargeLimitW:60,internal:true,maxCount:3,description:'4S-2P 제조사 공개 질량 0.500 kg, 정격 100 Wh. 게임은 권장 운용 범위의 86 Wh를 사용합니다.',source:'https://gomspace.com/wp-content/uploads/2025/09/gs-ds-nanopower-BPX-100-Wh-1076870-1.1.0.pdf',sourceId:'gomspace-bpx100',provenance:'manufacturer-published',sourceFields:['massKg','nominalCapacityWh','capacityWh'],conditions:['DS1076870 rev1.1.0 (2026-04-21), 4S-2P 구성.','§1.2의 권장 범위 86 Wh를 보수적으로 사용. 전압 조건별 표의 87/89 Wh와 혼합하지 않습니다.','충전 한도 25 W, 방전 한도 60 W, 효율·대기 전력·크레딧·장착 형상은 게임의 EPS 정책입니다.','히터가 켜졌을 때의 6 W는 상시 소비로 합산하지 않습니다.']}),
 engine:part('engine','궤도 보정 엔진','Maneuver thruster','추진',2.8,48,0,4,[.38,.38],.62,'#dd9673',{ispS:230,maxCount:1,description:'비추력 230 s인 학습용 화학추진기. 본체 -Y 중앙에 장착하며 한정된 추진제를 사용합니다.'}),
 storage:part('storage','기록장치','Data recorder','통신',.9,20,.7,.7,[.28,.34],.16,'#6ec8ac',{capacityBits:1.6e9,internal:true,maxCount:3,description:'1.6 Gbit 저장 공간. 교신이 끊겨도 기존 관측 자료를 보관합니다.'}),
 radiator:part('radiator','방열판','Radiator','구조',1.7,22,0,0,[.42,.54],.08,'#d7e2e7',{maxCount:2,description:'열 설계를 위한 외장 부품. 현재 버전은 기하학적 간섭과 질량만 계산하고 상세 열전달은 다루지 않습니다.'})
};
export const MISSIONS:Record<MissionId,MissionDefinition>={
 earth:{id:'earth',title:'푸른 행성의 기록',subtitle:'EARTH OBSERVATION · M01',description:'지구의 북반구 육지와 해안선을 관측하고, 유효한 사진 네 장을 지상국으로 돌려보내세요.',budget:550,massLimitKg:85,duration:10800,targetPackets:4,minimumQuality:.45,target:'북반구 관측 회랑',targetLatDeg:35,targetLonDeg:75,epoch:'2026-11-15 00:00:00 TAI',constraints:['예산 550 크레딧','발사 질량 85 kg 이하','3시간 이내 고유 사진 4장 수신','안전 고도 180 km 이상'],briefing:['광학 카메라를 -Z 면에, 안테나를 +Z 면에 부착하세요.','태양전지 패널은 +X 방향에서 햇빛을 잘 받습니다.','궤도 경사각과 기동으로 관측 기회를 조정하세요.','관측 후 교신창에 송신을 예약하세요.']},
 mars:{id:'mars',title:'붉은 행성의 도움닫기',subtitle:'MARS GRAVITY ASSIST · M02',description:'화성에 접근 중인 탐사선을 완성하고, 중력 도움으로 출구 궤적을 바꾸며 화성의 분광 자료를 지구로 전송하세요.',budget:640,massLimitKg:95,duration:18000,targetPackets:3,minimumQuality:.4,target:'화성 근접 분광 관측',targetLatDeg:0,targetLonDeg:0,epoch:'2026-11-15 00:00:00 TAI',constraints:['예산 640 크레딧','발사 질량 95 kg 이하','최근접 고도 250 km 이상','태양 기준 속력 증가 1 km/s 이상','분광 자료 3개를 기한 내 지구 수신'],briefing:['화성 접근 상태에서 시작하는 교육용 조우 임무입니다.','접근 고도와 B-plane 각도를 드래그해 출구 방향을 조정하세요.','분광 관측기를 -Z 면에 장착하세요.','최근접 약 2시간 30분 전후에 관측하고, 광속 지연을 고려해 송신하세요.']}
};
export function defaultPlan(missionId:MissionId):Plan{return {altitudeKm:600,inclinationDeg:51.6,burnTime:1200,progradeMps:0,normalMps:0,radialMps:0,periapsisAltitudeKm:1000,bPlaneAngleDeg:0,operations:missionId==='earth'?[
 {id:'obs-1',kind:'observe',start:300,end:2300},{id:'down-1',kind:'downlink',start:2300,end:5300},{id:'obs-2',kind:'observe',start:6000,end:7800},{id:'down-2',kind:'downlink',start:7800,end:10800}
]:[{id:'obs-1',kind:'observe',start:7200,end:10400},{id:'down-1',kind:'downlink',start:10600,end:17100}]};}
export function createDesign(missionId:MissionId='earth',preset:'starter'|'balanced'|'science'='balanced'):Design{
 const parts:Design['parts']=preset==='starter'?[]:[
  {id:'solar-1',kind:missionId==='mars'?'solarLarge':'solar',face:'px',u:0,v:0,rotation:0},
  {id:'science-1',kind:missionId==='earth'?'camera':'spectrometer',face:'nz',u:0,v:0,rotation:0},
  {id:'antenna-1',kind:'antenna',face:'pz',u:0,v:0,rotation:0},
  {id:'battery-1',kind:'battery',face:'py',u:-.28,v:0,rotation:0},
  {id:'storage-1',kind:'storage',face:'py',u:.28,v:0,rotation:0},
  {id:'engine-1',kind:'engine',face:'ny',u:0,v:0,rotation:0}
 ];
 if(preset==='science'){parts[0].kind='solarLarge';parts.find(p=>p.kind==='battery')!.v=-.24;parts.push({id:'battery-2',kind:'battery',face:'py',u:-.28,v:.24,rotation:0});}
 return {version:1,missionId,name:missionId==='earth'?'AURORA-01':'RED SHIFT-01',parts,plan:defaultPlan(missionId),seed:20261115};
}
