import {createDesign, evaluateDesign, validateDesign, type Design, type Part, type Vec3} from '../sim';
import {partVisibility} from '../sim/assembly';
import {getPartDefinition,partTransformFor} from '../hardware';
import {SOLAR_BODIES, SOLAR_EPOCH_JD, SOLAR_MAX_JD, type SolarBodyId, type SolarRoute} from './model';

export const CAMPAIGN_KEY='orbital-solar-expedition-v1';
export interface ReceivedScienceSample {id:string;kind:'context'|'detail'|'spectrum';featureId:string|null;band:'visible'|'nir';quality:number;snr:number;smearPixels:number;gsdM:number;exposureSeconds:number;reflectanceEstimate?:number|null;reflectanceUncertainty?:number|null;image?:string}
export interface ReceivedScience {instrument:'camera'|'spectrometer';samples:ReceivedScienceSample[];model:'local-hyperbola-synthetic-response-v1'}
export interface Discovery {body:SolarBodyId;receivedJd:number;observations:number;craftName:string;image?:string;science?:ReceivedScience}
export interface Campaign {version:1;introSeen:boolean;design:Design;departureJd:number;target:SolarBodyId;flightDays:number;discoveries:Discovery[]}
export const OBJECTIVES:Record<string,{title:string;question:string;discovery:string;enTitle:string;enQuestion:string;enDiscovery:string}>={
 aster:{title:'이 점은 어디로 향할까',question:'지상 관측에서 사라진 아스터-7. 가까이 다가가 표면의 흔적을 기록하세요.',discovery:'불규칙한 윤곽과 크고 작은 분지. 보는 방향에 따라 밝기가 달랐습니다. 한 점이던 신호가 이제 하나의 세계가 되었습니다.',enTitle:'Where is this point going?',enQuestion:'ASTER-7 vanished from ground observations. Meet it and record its surface.',enDiscovery:'An irregular outline and scattered basins. Brightness changes with the viewing direction. A point of light becomes a place.'},
 mercury:{title:'태양 곁의 마지막 그림자',question:'뜨거운 낮과 긴 그림자의 경계. 작은 행성의 오래된 충돌 흔적을 찾으세요.',discovery:'어두운 분지와 밝은 분출물. 같은 충돌도 햇빛과 지형에 따라 전혀 다르게 보입니다.',enTitle:'The last shadow near the Sun',enQuestion:'Find ancient impact marks at the boundary of sunlight and shadow.',enDiscovery:'Dark basins and bright ejecta: the same impact looks different with terrain and illumination.'},
 venus:{title:'눈부심 너머에서',question:'지구에서는 태양빛에 가렸던 방향. 금성 부근에서 관측망의 두 번째 시선을 확보하세요.',discovery:'금성의 두꺼운 구름 위에서 새로운 관측 방향을 얻었습니다. 하나의 관측소로 보지 못하던 공간이 열립니다.',enTitle:'Beyond the glare',enQuestion:'Open a second observing direction near Venus, beyond the glare seen from Earth.',enDiscovery:'Above the thick clouds, a second viewpoint opens a region hidden from the first observatory.'},
 mars:{title:'붉은 땅에 남은 기록',question:'아스터-7의 표면과 비교할 단서. 화성의 밝은 고원과 어두운 지형을 조사하세요.',discovery:'색과 밝기만으로 같은 기원을 단정할 수는 없습니다. 화성 자료가 새로운 비교 기준이 되었습니다.',enTitle:'A record in red',enQuestion:'Survey bright highlands and dark terrain to compare with ASTER-7.',enDiscovery:'Colour alone cannot establish a common origin. Mars now provides a new comparison.'},
 jupiter:{title:'거대한 문지기',question:'소천체의 길을 바꾸는 거대 행성. 구름 띠와 폭풍을 관측하고 바깥 태양계에 첫 기록을 남기세요.',discovery:'빠르게 바뀌는 구름과 오래 버티는 폭풍. 목성은 작은 천체의 궤도까지 바꿀 만큼 강한 중력의 세계입니다.',enTitle:'The great gatekeeper',enQuestion:'Record the cloud bands and storms at the gateway to the outer Solar System.',enDiscovery:'Changing clouds and persistent storms. Jupiter also reshapes the paths of small bodies through gravity.'},
 saturn:{title:'고리 너머의 빛',question:'고리로 둘러싸인 세계에 도착했습니다. 같은 구름 지역을 두 파장으로 살펴 빛의 차이를 비교하세요.',discovery:'한 장의 사진에 담긴 색을 두 파장으로 나누어 보았습니다. 이번 자료는 가상 표면 반응의 비교이며, 고리의 성분을 확인한 결과는 아닙니다.',enTitle:'Light beyond the rings',enQuestion:'At the ringed world, compare the same cloud region in two wavelength bands.',enDiscovery:'A colour image became a two-band comparison. These are synthetic surface responses, not a measurement of ring composition.'},
 uranus:{title:'옆으로 누운 계절',question:'멀어진 태양, 기울어진 세계. 청록빛 행성의 밝기 차이를 기록하세요.',discovery:'기울어진 자전축이 매우 긴 계절을 만듭니다. 지구의 하루와 계절은 우주의 기본값이 아니었습니다.',enTitle:'Seasons on their side',enQuestion:'Record brightness differences on a tilted, cyan world.',enDiscovery:'An extreme axial tilt makes long seasons. Earth’s day and year are not universal defaults.'},
 neptune:{title:'가장 먼 푸른 편지',question:'햇빛이 희미해진 곳. 긴 통신 시간을 견디고 마지막 행성의 관측 자료를 돌려보내세요.',discovery:'지구를 떠난 빛도 오랜 시간이 필요한 거리. 작은 탐사선이 태양계 끝에서 편지를 보냈습니다.',enTitle:'The farthest blue letter',enQuestion:'Return observations from the last planet, across a long communication delay.',enDiscovery:'Even light takes hours to travel home. A small probe sent a letter from the edge of the planetary system.'},
 earth:{title:'돌아올 곳',question:'모든 탐사는 여기서 시작합니다.',discovery:'우리의 첫 번째 세계.',enTitle:'A place to return to',enQuestion:'Every expedition begins here.',enDiscovery:'Our first world.'},
};
export interface ObservationProfile {
 sensor:'camera'|'spectrometer';labelsKo:string[];labelsEn:string[];
 reasonKo:string;reasonEn:string;energyWh:number;next:SolarBodyId;
}
/** Authored comparative-science tasks and battery-reserve targets. These numbers
 * are game operation budgets, not measured exposures or instrument specifications.
 * The carrier supplies continuous 300 W independently of solar-panel pointing. */
const OBSERVATION_PROFILES:Record<SolarBodyId,ObservationProfile>={
 aster:{sensor:'camera',labelsKo:['윤곽','밝은 면','어두운 면'],labelsEn:['SILHOUETTE','BRIGHT SIDE','DARK SIDE'],reasonKo:'형태와 밝기를 기록할 광학 카메라가 필요합니다.',reasonEn:'A camera records shape and brightness.',energyWh:12,next:'venus'},
 venus:{sensor:'spectrometer',labelsKo:['밝은 구름','구름 경계','다른 파장'],labelsEn:['BRIGHT CLOUDS','CLOUD EDGE','ANOTHER BAND'],reasonKo:'구름의 파장별 차이를 비교할 분광 관측기가 필요합니다.',reasonEn:'A spectrometer compares the clouds at different wavelengths.',energyWh:24,next:'mars'},
 mars:{sensor:'spectrometer',labelsKo:['밝은 고원','어두운 지형','비교 스펙트럼'],labelsEn:['BRIGHT HIGHLANDS','DARK TERRAIN','COMPARISON SPECTRUM'],reasonKo:'지형의 색을 파장별로 비교할 분광 관측기가 필요합니다.',reasonEn:'A spectrometer separates terrain colour into wavelength bands.',energyWh:30,next:'jupiter'},
 jupiter:{sensor:'camera',labelsKo:['구름 띠','폭풍','폭풍 경계'],labelsEn:['CLOUD BELT','STORM','STORM EDGE'],reasonKo:'구름 띠와 폭풍의 모양을 담을 광학 카메라가 필요합니다.',reasonEn:'A camera resolves the shapes of cloud belts and storms.',energyWh:18,next:'saturn'},
 saturn:{sensor:'spectrometer',labelsKo:['밝은 구름','구름 경계','두 파장 비교'],labelsEn:['BRIGHT CLOUDS','CLOUD EDGE','TWO-BAND COMPARISON'],reasonKo:'같은 구름 지역을 두 파장으로 비교할 분광 관측기가 필요합니다.',reasonEn:'A spectrometer compares one cloud region in two wavelength bands.',energyWh:36,next:'uranus'},
 uranus:{sensor:'camera',labelsKo:['밝은 가장자리','청록빛 원반','밝기 비교'],labelsEn:['BRIGHT LIMB','CYAN DISC','BRIGHTNESS COMPARISON'],reasonKo:'원반의 밝기 차이를 담을 광학 카메라가 필요합니다.',reasonEn:'A camera records brightness across the visible disc.',energyWh:21,next:'neptune'},
 neptune:{sensor:'camera',labelsKo:['푸른 원반','밝은 구름','먼 시선'],labelsEn:['BLUE DISC','BRIGHT CLOUDS','DISTANT VIEW'],reasonKo:'먼 행성의 구름과 원반을 기록할 광학 카메라가 필요합니다.',reasonEn:'A camera records the distant planet and its clouds.',energyWh:24,next:'mercury'},
 mercury:{sensor:'camera',labelsKo:['충돌 분지','밝은 분출물','그림자 경계'],labelsEn:['IMPACT BASIN','BRIGHT EJECTA','SHADOW EDGE'],reasonKo:'충돌 흔적과 그림자를 구분할 광학 카메라가 필요합니다.',reasonEn:'A camera distinguishes impact features from shadows.',energyWh:15,next:'aster'},
 earth:{sensor:'camera',labelsKo:['대륙','바다','구름'],labelsEn:['LAND','OCEAN','CLOUDS'],reasonKo:'지구의 모습을 담을 광학 카메라가 필요합니다.',reasonEn:'A camera records our home world.',energyWh:12,next:'aster'},
};
export function observationProfile(target:SolarBodyId):ObservationProfile {
 const profile=OBSERVATION_PROFILES[target];
 return {...profile,labelsKo:[...profile.labelsKo],labelsEn:[...profile.labelsEn]};
}
export function freshCampaign():Campaign {
 const design=createDesign('mars','balanced');design.name='AURORA / 01';
 // The first mission asks for shape, so the initial payload is an optical camera.
 const sensor=design.parts.find(part=>part.kind==='spectrometer');if(sensor)sensor.kind='camera';
 return {version:1,introSeen:false,design,departureJd:SOLAR_EPOCH_JD,target:'aster',flightDays:0,discoveries:[]};
}
function boundedImage(image:unknown):string|undefined {
 return typeof image==='string'&&image.length<=400000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)?image:undefined;
}
/** Received measurements only. Synthetic response is identified explicitly;
 * pictures are bounded captures, never external image URLs. */
export function boundedReceivedScience(value:unknown):ReceivedScience|undefined {
 const s=value as Partial<ReceivedScience>|null;
 if(!s||s.model!=='local-hyperbola-synthetic-response-v1'||!['camera','spectrometer'].includes(s.instrument as string)||!Array.isArray(s.samples))return;
 const samples:ReceivedScienceSample[]=[];
 for(const raw of s.samples.slice(0,8)){
  if(!raw||typeof raw.id!=='string'||!['context','detail','spectrum'].includes(raw.kind)||!['visible','nir'].includes(raw.band)||!(raw.featureId===null||typeof raw.featureId==='string'))continue;
  if(samples.some(sample=>sample.id===raw.id.slice(0,80))||(s.instrument==='camera'&&raw.kind==='spectrum')||(s.instrument==='spectrometer'&&raw.kind!=='spectrum'))continue;
  if(![raw.quality,raw.snr,raw.smearPixels,raw.gsdM,raw.exposureSeconds].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)||raw.quality>1||raw.exposureSeconds>86400||raw.snr>1e9||raw.gsdM>1e10||raw.smearPixels>1e9)continue;
  const image=boundedImage(raw.image);
  const reflectance=typeof raw.reflectanceEstimate==='number'&&Number.isFinite(raw.reflectanceEstimate)&&raw.reflectanceEstimate>=0&&raw.reflectanceEstimate<=1?raw.reflectanceEstimate:null;
  const uncertainty=typeof raw.reflectanceUncertainty==='number'&&Number.isFinite(raw.reflectanceUncertainty)&&raw.reflectanceUncertainty>=0&&raw.reflectanceUncertainty<=1?raw.reflectanceUncertainty:null;
  samples.push({id:raw.id.slice(0,80),kind:raw.kind,featureId:raw.featureId?.slice(0,80)??null,band:raw.band,quality:raw.quality,snr:raw.snr,smearPixels:raw.smearPixels,gsdM:raw.gsdM,exposureSeconds:raw.exposureSeconds,reflectanceEstimate:reflectance,reflectanceUncertainty:uncertainty,...(image&&samples.length<2?{image}:{})});
 }
 return samples.length?{instrument:s.instrument!,samples,model:'local-hyperbola-synthetic-response-v1'}:undefined;
}
function knownDestination(value:unknown):value is SolarBodyId {
 return typeof value==='string'&&value!=='earth'&&SOLAR_BODIES.some(body=>body.id===value);
}
function validReceiptEpoch(value:unknown):value is number {
 return typeof value==='number'&&Number.isFinite(value)&&value>=SOLAR_EPOCH_JD&&value<=SOLAR_MAX_JD+1;
}
export function parseCampaign(value:string|null):Campaign {
 if(!value)return freshCampaign();
 try{
  const raw=JSON.parse(value);
  if(raw.version!==1||typeof raw.introSeen!=='boolean'||!knownDestination(raw.target)||!Number.isFinite(raw.departureJd)||raw.departureJd<SOLAR_EPOCH_JD||raw.departureJd>2469000||!Number.isFinite(raw.flightDays)||raw.flightDays<0||raw.flightDays>8400||!Array.isArray(raw.discoveries))throw Error('campaign');
  const byBody=new Map<SolarBodyId,Discovery>();
  for(const d of raw.discoveries){
   if(!d||!knownDestination(d.body)||!validReceiptEpoch(d.receivedJd)||!Number.isInteger(d.observations)||d.observations<1||d.observations>12||typeof d.craftName!=='string')continue;
   const image=boundedImage(d.image),science=boundedReceivedScience(d.science);
   byBody.set(d.body,{body:d.body,receivedJd:d.receivedJd,observations:d.observations,craftName:d.craftName.slice(0,160),...(image?{image}:{}),...(science?{science}:{})});
  }
  return {version:1,introSeen:raw.introSeen,design:validateDesign(raw.design),target:raw.target,departureJd:raw.departureJd,flightDays:raw.flightDays,discoveries:[...byBody.values()].slice(0,8)};
 }catch{return freshCampaign();}
}
/** Authored expedition carrier, not a commercial launch vehicle or a NASA spec.
 * It supplies escape propulsion and 300 W continuous bus power to the payload.
 * Payload mass changes required propellant via Tsiolkovsky. A task's energyWh is
 * an authored battery reserve at commissioning, not an integrated power forecast.
 * Aperture clearance below uses the existing geometry but assumes each device
 * can be aimed at its subject. Attitude, thermal, eclipse and link dynamics remain
 * laboratory features. No legacy mission success or GMAT validity is inherited. */
export const CARRIER={dryMassKg:400,propellantKg:6500,ispSeconds:450,powerW:300,payloadBudget:900,payloadMassKg:180};
export const MINIMUM_CAMPAIGN_VISIBILITY=.6;
/** Five equal-weight directions in a device's own field of view; each direction
 * uses the existing five aperture samples and obstruction proxy boxes. A hardware
 * camera's narrower FOV is honoured. This field-scan is an authored commissioning
 * check, not a reconstructed image or the laboratory's attitude simulation. */
export function campaignSensorVisibility(design:Design,part:Part):number {
 const tr=partTransformFor(design,part),halfAngle=getPartDefinition(design,part).optics?.halfAngleDeg??28;
 const angle=Math.min(20,halfAngle*.7)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const directions:Vec3[]=[tr.normal,...[tr.tangentU,tr.tangentV].flatMap(axis=>[-1,1].map(sign=>tr.normal.map((value,i)=>c*value+sign*s*axis[i]) as Vec3))];
 return directions.reduce((total,direction)=>total+partVisibility(design,part,direction,Math.cos(halfAngle*Math.PI/180)),0)/directions.length;
}
export function campaignReadiness(design:Design,route:SolarRoute|null) {
 const ev=evaluateDesign(design),dry=CARRIER.dryMassKg+ev.massKg,profile=observationProfile(route?.targetId??'aster');
 const dv=route?.status==='solved'?route.departureDeltaVMps:Infinity;
 const fuelKg=dry*Math.expm1(dv/(9.80665*CARRIER.ispSeconds));
 const sensors=design.parts.filter(p=>p.kind===profile.sensor),antennas=design.parts.filter(p=>p.kind==='antenna');
 const sensorChecks=sensors.map(p=>({field:campaignSensorVisibility(design,p),boresight:partVisibility(design,p,partTransformFor(design,p).normal)}));
 const bestSensor=sensorChecks.sort((a,b)=>Math.min(b.field,b.boresight)-Math.min(a.field,a.boresight))[0];
 const sensorVisibility=bestSensor?.field??0,sensorBoresightVisibility=bestSensor?.boresight??0;
 const antennaVisibility=Math.max(0,...antennas.map(p=>partVisibility(design,p,partTransformFor(design,p).normal)));
 const issues:string[]=[];
 if(!sensors.length)issues.push(profile.sensor);
 else if(sensorVisibility+1e-9<MINIMUM_CAMPAIGN_VISIBILITY||sensorBoresightVisibility+1e-9<MINIMUM_CAMPAIGN_VISIBILITY)issues.push('sensor-blocked');
 if(!antennas.length)issues.push('antenna');else if(antennaVisibility+1e-9<MINIMUM_CAMPAIGN_VISIBILITY)issues.push('antenna-blocked');
 if(ev.batteryWh<profile.energyWh)issues.push('battery');if(ev.storageBits<=0)issues.push('storage');
 if(ev.activePowerW>CARRIER.powerW)issues.push('power');if(ev.massKg>CARRIER.payloadMassKg)issues.push('mass');if(ev.componentCost>CARRIER.payloadBudget)issues.push('cost');
 if(!Number.isFinite(fuelKg)||fuelKg>CARRIER.propellantKg)issues.push('fuel');
 return {ready:issues.length===0,issues,fuelKg,fuelFraction:fuelKg/CARRIER.propellantKg,massKg:ev.massKg,powerW:ev.activePowerW,cost:ev.componentCost,sensorVisibility,sensorBoresightVisibility,antennaVisibility,energyWh:profile.energyWh,availableBatteryWh:ev.batteryWh};
}
export function recordDiscovery(campaign:Campaign,body:SolarBodyId,receivedJd:number,image?:string,measurements?:ReceivedScience):Campaign {
 if(!knownDestination(body)||!validReceiptEpoch(receivedJd))return campaign;
 const thumbnail=boundedImage(image),science=boundedReceivedScience(measurements);
 if(measurements!==undefined&&!science)return campaign;
 const discovery:Discovery={body,receivedJd,observations:science?.samples.length??3,craftName:campaign.design.name,...(thumbnail?{image:thumbnail}:{}),...(science?{science}:{})};
 return {...campaign,discoveries:[...campaign.discoveries.filter(d=>d.body!==body),discovery]};
}
