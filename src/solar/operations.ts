import {evaluateDesign,type Design,type Vec3} from '../sim';
import {getPartDefinition} from '../hardware';
import {CARRIER,observationProfile} from './campaign';
import {createEncounter,localEncounterFrame,type EncounterDefinition,type EncounterFrame} from './encounter';
import {solarBody,type SolarBodyId} from './model';

export type ScienceBand='visible'|'nir';
export type OnboardCommand='stabilize'|'safe-mode'|'resume'|'downlink';
export interface ObservationInput {
 aimDirection:Vec3;fovDeg:number;shutterHeld:boolean;band:ScienceBand;
 /** Actual rendered instrument position, if different from the flyby carrier. */
 positionKm?:Vec3;
}
export interface ExposureEvaluation {
 hit:boolean;featureId:string|null;context:boolean;incidenceCos:number;emissionCos:number;
 slantRangeKm:number;footprintKm:number;gsdM:number;signalRate:number;
 pointingErrorDeg:number;targetDirection:Vec3;reason:'ready'|'space'|'dark'|'limb'|'no-instrument'|'window-closed';
 radiometricRate:number;
}
export interface ExposureAccumulator {
 wallSeconds:number;integrationSeconds:number;signalElectrons:number;noiseVariance:number;
 smearWeighted:number;signalWeight:number;featureId:string|null;context:boolean;
 band:ScienceBand;gsdM:number;footprintKm:number;previousAim:Vec3;previousTarget:Vec3;
 radiometricScale:number;
}
export interface ScienceRecord {
 id:string;kind:'context'|'detail'|'spectrum';featureId:string|null;band:ScienceBand;
 quality:number;snr:number;smearPixels:number;gsdM:number;footprintKm:number;
 exposureSeconds:number;dataBits:number;transmittedBits:number;valid:boolean;
 reason:'accepted'|'short'|'low-signal'|'blurred'|'bad-geometry'|'storage-full';
 reflectanceEstimate:number|null;reflectanceUncertainty:number|null;
}
export interface CruiseEvent {
 id:'star-reference';forecastProgress:number;activeProgress:number;
 titleKo:string;titleEn:string;detailKo:string;detailEn:string;
}
export interface OperationsState {
 version:1;target:SolarBodyId;encounter:EncounterDefinition;playSeconds:number;
 mode:'science'|'safe'|'downlink';batteryWh:number;batteryCapacityWh:number;
 storageBits:number;storedBits:number;temperatureC:number;instrumentPowerW:number;
 idlePowerW:number;pixelCount:number;nominalIfovRad:number;bitsPerFrame:number;
 sensor:'camera'|'spectrometer';hasInstrument:boolean;oneWayLightSeconds:number;
 jitterDegS:number;stabilized:boolean;recoverySeconds:number;
 pendingCommand:{command:OnboardCommand;remainingSeconds:number}|null;
 exposure:ExposureAccumulator|null;records:ScienceRecord[];nextRecordId:number;
 lastCapture:ScienceRecord|null;lastIssue:string;downlinkRateBps:number;
 cruiseResponse:'none'|'safe-mode'|'continue';
 thermalConductanceWPerK:number;
}
export interface OperationsSummary {
 ready:boolean;context:ScienceRecord|null;detail:ScienceRecord|null;
 spectralPair:[ScienceRecord,ScienceRecord]|null;validRecords:number;
 exposureSnr:number;exposureSmear:number;exposureProgress:number;
 batteryFraction:number;storageFraction:number;thermalWarning:boolean;
 canCapture:boolean;issue:string;
 transmittedReady:boolean;transmittedRecords:number;spectralRatio:number|null;spectralRatioUncertainty:number|null;
}

const DEG=Math.PI/180;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const dot=(a:Vec3,b:Vec3)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const sub=(a:Vec3,b:Vec3):Vec3=>a.map((v,i)=>v-b[i]) as Vec3;
const norm=(a:Vec3)=>Math.hypot(...a);
const unit=(a:Vec3):Vec3=>{const n=norm(a);return n>1e-12&&Number.isFinite(n)?a.map(v=>v/n) as Vec3:[0,0,-1];};
const angle=(a:Vec3,b:Vec3)=>Math.acos(clamp(dot(unit(a),unit(b)),-1,1));
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const finiteVector=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&v.every(x=>typeof x==='number'&&Number.isFinite(x));
const immutable=(s:OperationsState):OperationsState=>({...s,records:s.records.map(r=>({...r})),pendingCommand:s.pendingCommand?{...s.pendingCommand}:null,exposure:s.exposure?{...s.exposure,previousAim:[...s.exposure.previousAim],previousTarget:[...s.exposure.previousTarget]}:null});
/** Authored observation calibration. Signal electrons are illustrative, not a
 * flight detector's calibrated radiometry. Wh and data accounting retain units.
 * Digital framing never beats a device's native IFOV: zoom cannot create detail.
 * Capture time slows the local flyby to at most 1 physical second/play second. */
export function createOperations(design:Design,target:SolarBodyId,arrivalVInfinityKmS:number,options:{oneWayLightSeconds?:number}={}):OperationsState {
 const ev=evaluateDesign(design),sensor=observationProfile(target).sensor;
 const mounted=design.parts.find(p=>p.kind===sensor),instrument=mounted?getPartDefinition(design,mounted):null;
 const optics=instrument&&'optics' in instrument?instrument.optics:undefined;
 return {version:1,target,encounter:createEncounter(target,arrivalVInfinityKmS),playSeconds:0,mode:'science',batteryWh:ev.batteryWh,batteryCapacityWh:ev.batteryWh,storageBits:ev.storageBits,storedBits:0,temperatureC:28,instrumentPowerW:instrument?.activePowerW??0,idlePowerW:Math.max(8,ev.activePowerW-(instrument?.activePowerW??0)),pixelCount:optics?.pixelsAcross??1024,nominalIfovRad:optics?.ifovRad??60*DEG/1024,bitsPerFrame:optics?.bitsPerFrame??1024*1024*12,sensor,hasInstrument:!!mounted,oneWayLightSeconds:Number.isFinite(options.oneWayLightSeconds)?Math.max(0,options.oneWayLightSeconds!):0,jitterDegS:.003,stabilized:false,recoverySeconds:0,pendingCommand:null,exposure:null,records:[],nextRecordId:1,lastCapture:null,lastIssue:'',downlinkRateBps:256000,cruiseResponse:'none',thermalConductanceWPerK:1.8+.8*design.parts.filter(p=>p.kind==='radiator').length};
}
export function encounterFrame(state:OperationsState):EncounterFrame {
 return localEncounterFrame(state.encounter,(state.playSeconds/state.encounter.playbackDurationSeconds*2-1)*state.encounter.halfWindowSeconds);
}
/** Ray hits are computed from the rendered instrument aperture. A real surface
 * feature must be visible and within the frame; HUD target locations confer no
 * scientific credit. The sphere is a declared shape approximation for ASTER. */
export function evaluateExposure(state:OperationsState,input:ObservationInput):ExposureEvaluation {
 const frame=encounterFrame(state),position=finiteVector(input.positionKm)?input.positionKm:frame.positionKm;
 const aim=finiteVector(input.aimDirection)?unit(input.aimDirection):[0,0,-1] as Vec3;
 const radius=state.encounter.radiusKm,fov=clamp(Number.isFinite(input.fovDeg)?input.fovDeg:60,1,90)*DEG;
 const centre=unit(position.map(v=>-v) as Vec3),range=norm(position),alpha=Math.asin(clamp(radius/Math.max(radius,range),0,1));
 const centreError=angle(aim,centre),context=centreError+alpha<fov/2&&2*alpha/fov>=.22;
 const b=dot(position,aim),c=dot(position,position)-radius*radius,disc=b*b-c;
 const fallback:ExposureEvaluation={hit:false,featureId:null,context:false,incidenceCos:0,emissionCos:0,slantRangeKm:range,footprintKm:0,gsdM:0,signalRate:0,radiometricRate:0,pointingErrorDeg:centreError/DEG,targetDirection:centre,reason:state.hasInstrument?'space':'no-instrument'};
 if(state.playSeconds>=state.encounter.playbackDurationSeconds)return {...fallback,reason:'window-closed'};
 if(!state.hasInstrument||range<=radius||disc<0)return fallback;
 const near=-b-Math.sqrt(disc);if(near<=0)return fallback;
 const point=position.map((v,i)=>v+aim[i]*near) as Vec3,normal=unit(point);
 const incidence=dot(normal,state.encounter.sunDirectionBody),emission=dot(normal,unit(sub(position,point)));
 const region=context?null:state.encounter.features.map(feature=>({feature,distance:angle(normal,unit(feature.positionBodyKm))*radius})).filter(x=>x.distance<=x.feature.radiusKm).sort((a,b)=>a.distance-b.distance)[0]?.feature??null;
 const footprint=2*near*Math.tan(fov/2)/Math.max(.15,emission);
 const ifov=Math.max(state.nominalIfovRad,fov/state.pixelCount),gsd=near*1000*ifov/Math.max(.15,emission);
 const reflectance=region?.reflectance[input.band]??.28,light=Math.max(0,incidence);
 // Reflected radiance scales with solar illumination, not inverse range squared
 // for a resolved extended surface. Range instead changes footprint and GSD.
 const radiometricRate=2e6*light/Math.pow(solarBody(state.target).aAu,2)*(input.band==='nir'?.62:1),signalRate=radiometricRate*reflectance;
 return {hit:true,featureId:region?.id??null,context,incidenceCos:incidence,emissionCos:emission,slantRangeKm:near,footprintKm:footprint,gsdM:gsd,signalRate,radiometricRate,pointingErrorDeg:region?angle(aim,unit(sub(region.positionBodyKm,position)))/DEG:centreError/DEG,targetDirection:region?unit(sub(region.positionBodyKm,position)):centre,reason:incidence<=.04?'dark':emission<.18?'limb':'ready'};
}
export function scheduledCruiseEvent(progress:number):CruiseEvent|null {
 return Number.isFinite(progress)&&progress>=.24&&progress<=.8?{id:'star-reference',forecastProgress:.24,activeProgress:.46,titleKo:'별 추적기 기준이 흔들립니다',titleEn:'Star-reference quality is falling',detailKo:'가상의 운용 연습: 안전 자세로 기준을 다시 잡거나, 관측 기회를 유지하고 조우 중 자세를 안정화하세요.',detailEn:'Authored exercise: recover the reference in safe hold, or preserve the observing window and stabilize during encounter.'}:null;
}
/** Authored scenario, not a claimed NASA fault frequency. Safe recovery costs
 * twelve play seconds of the incoming window. Continuing retains that window,
 * but adds measurable image smear until a later stabilization command finishes. */
export function resolveCruiseEvent(state:OperationsState,response:'safe-mode'|'continue'):OperationsState {
 const s=immutable(state);if(s.cruiseResponse!=='none')return s;
 s.cruiseResponse=response;
 if(response==='safe-mode'){s.playSeconds=Math.min(s.encounter.playbackDurationSeconds,s.playSeconds+12);s.jitterDegS=.003;s.stabilized=true;s.lastIssue='cruise-safe';}
 else{s.jitterDegS=.8;s.stabilized=false;s.lastIssue='reference-drift';}
 return s;
}
/** One-second onboard execution/rehearsal acknowledgement. This is explicitly
 * NOT the Earth-to-spacecraft light-time, which remains separately displayed. */
export function executeCommand(state:OperationsState,command:OnboardCommand):OperationsState {
 const s=immutable(state);if(s.pendingCommand)return s;
 if(!['stabilize','safe-mode','resume','downlink'].includes(command))return s;
 s.pendingCommand={command,remainingSeconds:1};return s;
}
function applyCommand(s:OperationsState,command:OnboardCommand){
 s.exposure=null;
 if(command==='safe-mode'){s.mode='safe';s.recoverySeconds=8;s.lastIssue='safe-hold';}
 if(command==='stabilize'){s.recoverySeconds=5;s.lastIssue='stabilizing';}
 if(command==='resume'){if(s.temperatureC>=55||s.recoverySeconds>0){s.lastIssue='cooling';return;}s.mode='science';s.lastIssue='';}
 if(command==='downlink'){s.mode='downlink';s.lastIssue='';}
}
function advanceStep(s:OperationsState,wallDt:number,input:ObservationInput){
 const ratio=2*s.encounter.halfWindowSeconds/s.encounter.playbackDurationSeconds;
 const physicalDt=wallDt*(input.shutterHeld&&s.mode==='science'?Math.min(1,ratio):ratio);
 s.playSeconds=Math.min(s.encounter.playbackDurationSeconds,s.playSeconds+physicalDt/ratio);
 if(s.pendingCommand){s.pendingCommand.remainingSeconds-=wallDt;if(s.pendingCommand.remainingSeconds<=0){const command=s.pendingCommand.command;s.pendingCommand=null;applyCommand(s,command);}}
 if(s.recoverySeconds>0){s.recoverySeconds=Math.max(0,s.recoverySeconds-wallDt);if(s.recoverySeconds===0){s.jitterDegS=.003;s.stabilized=true;if(s.mode==='science')s.lastIssue='';}}
 const windowClosed=s.playSeconds>=s.encounter.playbackDurationSeconds;
 if(windowClosed&&s.mode==='science')s.lastIssue='window-closed';
 const capture=input.shutterHeld&&!windowClosed&&s.mode==='science'&&s.recoverySeconds===0&&s.hasInstrument&&s.batteryWh>0&&s.temperatureC<70;
 const load=s.mode==='safe'?12:s.idlePowerW+(capture?s.instrumentPowerW:0)+(s.recoverySeconds>0?120:0)+(s.mode==='downlink'?35:0);
 s.batteryWh=clamp(s.batteryWh+(CARRIER.powerW-load)*physicalDt/3600,0,s.batteryCapacityWh);
 // Lumped thermal training model: loaded detector dissipates into a local
 // instrument radiator. C=5 kJ/K, passive conductance 1.8 W/K, sink 12 C.
 // This is an authored scenario model, not spacecraft thermal certification.
 const heat=(capture?s.instrumentPowerW*.9:2)+(s.mode==='safe'?.05:1)*25/Math.pow(solarBody(s.target).aAu,2);
 s.temperatureC=clamp(s.temperatureC+(heat-s.thermalConductanceWPerK*(s.temperatureC-12))*physicalDt/5000,12,90);
 if(s.temperatureC>=70){s.mode='safe';s.exposure=null;s.lastIssue='thermal-safe';}
 else if(s.temperatureC>=55)s.lastIssue='thermal-warning';
 if(s.mode==='downlink'){
  let capacity=s.downlinkRateBps*physicalDt;
  for(const record of s.records){const sent=Math.min(capacity,record.dataBits-record.transmittedBits);record.transmittedBits+=sent;capacity-=sent;s.storedBits=Math.max(0,s.storedBits-sent);if(capacity<=0)break;}
 }
 if(!capture){if(input.shutterHeld)s.exposure=null;if(input.shutterHeld&&s.lastIssue==='')s.lastIssue=s.mode!=='science'?'not-science':s.recoverySeconds>0?'stabilizing':'power';return;}
 const sample=evaluateExposure(s,input);
 // The renderer captures the current instrument frame on release. Do not
 // award an earlier bright exposure alongside a later empty-space image.
 // Reacquiring a region starts a new exposure rather than joining two scenes.
 if(sample.reason!=='ready'){s.exposure=null;s.lastIssue=sample.reason;return;}
 const aim=unit(input.aimDirection);
 if(!s.exposure){s.exposure={wallSeconds:0,integrationSeconds:0,signalElectrons:0,noiseVariance:144,smearWeighted:0,signalWeight:0,featureId:sample.featureId,context:sample.context,band:input.band,gsdM:sample.gsdM,footprintKm:sample.footprintKm,previousAim:aim,previousTarget:sample.targetDirection,radiometricScale:0};}
 const e=s.exposure;
 if(e.band!==input.band||e.featureId!==sample.featureId||e.context!==sample.context){s.exposure=null;s.lastIssue='framing-changed';return;}
 const ifov=Math.max(s.nominalIfovRad,clamp(input.fovDeg,1,90)*DEG/s.pixelCount);
 const aimRotation=cross(e.previousAim,aim),targetRotation=cross(e.previousTarget,sample.targetDirection);
 const residual=norm(sub(aimRotation,targetRotation));
 // Unregistered exposure smear accumulates with tracking error. The bounded
 // instrument jitter term makes the cruise response observable in the image.
 const smear=(residual+s.jitterDegS*DEG*physicalDt)/ifov;
 const photons=sample.signalRate*physicalDt;
 e.wallSeconds+=wallDt;e.integrationSeconds+=physicalDt;e.signalElectrons+=photons;e.noiseVariance+=photons+6*physicalDt;e.radiometricScale+=sample.radiometricRate*physicalDt;
 e.smearWeighted+=smear;e.signalWeight+=physicalDt;e.gsdM=Math.max(e.gsdM,sample.gsdM);e.footprintKm=Math.max(e.footprintKm,sample.footprintKm);
 e.previousAim=aim;e.previousTarget=sample.targetDirection;s.lastIssue='';
}
export function advanceOperations(state:OperationsState,wallDtSeconds:number,input:ObservationInput):OperationsState {
 const s=immutable(state);if(!Number.isFinite(wallDtSeconds)||wallDtSeconds<=0||!finiteVector(input.aimDirection)||!Number.isFinite(input.fovDeg)||!['visible','nir'].includes(input.band))return s;
 // Bounded substeps keep resource/cooling integration stable after a stall.
 let remaining=Math.min(30,wallDtSeconds);
 while(remaining>1e-9){const dt=Math.min(.1,remaining);advanceStep(s,dt,input);remaining-=dt;}
 return s;
}
/** Transmit in physical seconds independently of the local flyby playback.
 * transmittedBits means sent from the spacecraft, NOT yet received on Earth.
 * The controller must wait the separately computed one-way light delay before
 * issuing a journal receipt. Position and exposure are not advanced here. */
export function advanceDownlink(state:OperationsState,physicalSeconds:number):OperationsState {
 const s=immutable(state);if(s.mode!=='downlink'||!Number.isFinite(physicalSeconds)||physicalSeconds<=0)return s;
 let dt=Math.min(86400,physicalSeconds);
 const load=s.idlePowerW+35,heat=2+25/Math.pow(solarBody(s.target).aAu,2),tau=5000/s.thermalConductanceWPerK,equilibrium=12+heat/s.thermalConductanceWPerK;
 if(s.temperatureC>=70){s.mode='safe';s.lastIssue='thermal-safe';return s;}
 // Stop precisely at an autonomous thermal hold instead of transmitting
 // through an unsafe excursion or charging arbitrary lost-data penalties.
 if(equilibrium>70){const until=-tau*Math.log((70-equilibrium)/(s.temperatureC-equilibrium));if(Number.isFinite(until)&&until>=0&&until<dt){dt=until;s.mode='safe';s.lastIssue='thermal-safe';}}
 s.temperatureC=clamp(equilibrium+(s.temperatureC-equilibrium)*Math.exp(-dt/tau),12,90);
 s.batteryWh=clamp(s.batteryWh+(CARRIER.powerW-load)*dt/3600,0,s.batteryCapacityWh);
 let capacity=s.downlinkRateBps*dt;
 for(const record of s.records){const sent=Math.min(capacity,record.dataBits-record.transmittedBits);record.transmittedBits+=sent;capacity-=sent;s.storedBits=Math.max(0,s.storedBits-sent);if(capacity<=0)break;}
 return s;
}
export function releaseExposure(state:OperationsState):{state:OperationsState;record:ScienceRecord|null} {
 const s=immutable(state),e=s.exposure;s.exposure=null;if(!e)return {state:s,record:null};
 const snr=e.signalElectrons/Math.sqrt(Math.max(1,e.noiseVariance)),smear=e.smearWeighted;
 const region=s.encounter.features.find(f=>f.id===e.featureId);
 const detail=!!region&&e.footprintKm<=region.radiusKm*2.6&&e.gsdM<=region.radiusKm*1000/10;
 const geometry=s.sensor==='camera'?(e.context||detail):!!region&&e.footprintKm<=region.radiusKm*3;
 const quality=clamp(snr/18,0,1)*Math.exp(-Math.pow(smear/2.5,2));
 const dataBits=Math.max(1024,Math.round(s.bitsPerFrame*(s.sensor==='spectrometer'?.18:1)));
 const reason:ScienceRecord['reason']=e.wallSeconds<.45?'short':!geometry?'bad-geometry':snr<10?'low-signal':smear>2.5?'blurred':s.storedBits+dataBits>s.storageBits||s.records.length>=32?'storage-full':'accepted';
 const uncertainty=e.radiometricScale>0?Math.sqrt(e.noiseVariance)/e.radiometricScale:null;
 // Repeatable synthetic detector noise, not an observation of real chemistry.
 const noise=Math.sin(s.nextRecordId*78.233+(e.band==='nir'?51.7:0)+e.signalElectrons*.00001);
 const estimate=e.radiometricScale>0?clamp(e.signalElectrons/e.radiometricScale+noise*(uncertainty??0),0,1):null;
 const record:ScienceRecord={id:`obs-${s.nextRecordId++}`,kind:s.sensor==='spectrometer'?'spectrum':e.context?'context':'detail',featureId:e.featureId,band:e.band,quality,snr,smearPixels:smear,gsdM:e.gsdM,footprintKm:e.footprintKm,exposureSeconds:e.integrationSeconds,dataBits,transmittedBits:0,valid:reason==='accepted',reason,reflectanceEstimate:s.sensor==='spectrometer'?estimate:null,reflectanceUncertainty:s.sensor==='spectrometer'?uncertainty:null};
 s.lastCapture=record;s.lastIssue=reason==='accepted'?'':reason;
 // Bad exposures are previews only. Never silently fill memory with failed
 // attempts or erase already acquired science to manufacture an emergency.
 if(record.valid){s.records.push(record);s.storedBits+=dataBits;}
 return {state:s,record};
}
export function operationsSummary(state:OperationsState):OperationsSummary {
 const records=state.records.filter(r=>r.valid),context=records.filter(r=>r.kind==='context').sort((a,b)=>b.quality-a.quality)[0]??null,detail=records.filter(r=>r.kind==='detail').sort((a,b)=>b.quality-a.quality)[0]??null;
 let spectralPair:[ScienceRecord,ScienceRecord]|null=null;
 for(const record of records){if(record.kind!=='spectrum'||record.band!=='visible')continue;const pair=records.find(r=>r.kind==='spectrum'&&r.band==='nir'&&r.featureId===record.featureId);if(pair){spectralPair=[record,pair];break;}}
 const e=state.exposure,snr=e?e.signalElectrons/Math.sqrt(Math.max(1,e.noiseVariance)):0,smear=e?.smearWeighted??0;
 const transmittedRecords=records.filter(r=>r.transmittedBits>=r.dataBits),received=(r:ScienceRecord|null)=>!!r&&r.transmittedBits>=r.dataBits;
 const v=spectralPair?.[0].reflectanceEstimate??0,n=spectralPair?.[1].reflectanceEstimate??0;
 const spectralRatio=spectralPair&&v>0?n/v:null;
 const spectralRatioUncertainty=spectralPair&&v>0&&n>0?spectralRatio!*Math.hypot((spectralPair[0].reflectanceUncertainty??0)/v,(spectralPair[1].reflectanceUncertainty??0)/n):null;
 return {ready:state.sensor==='camera'?!!context&&!!detail:!!spectralPair,context,detail,spectralPair,validRecords:records.length,exposureSnr:snr,exposureSmear:smear,exposureProgress:Math.min(1,(e?.wallSeconds??0)/.8),batteryFraction:state.batteryCapacityWh>0?state.batteryWh/state.batteryCapacityWh:0,storageFraction:state.storageBits>0?state.storedBits/state.storageBits:0,thermalWarning:state.temperatureC>=55,canCapture:state.playSeconds<state.encounter.playbackDurationSeconds&&state.mode==='science'&&state.recoverySeconds===0&&state.hasInstrument&&state.batteryWh>0&&state.temperatureC<70,issue:state.lastIssue,transmittedReady:state.sensor==='camera'?received(context)&&received(detail):!!spectralPair&&spectralPair.every(received),transmittedRecords:transmittedRecords.length,spectralRatio,spectralRatioUncertainty};
}

/** Rebuild immutable physics/instrument calibration from the current design;
 * never trust saved orbital constants, hardware power, capacity or geometry.
 * A held mouse exposure cannot resume after reload. Queued explicit commands
 * and already acquired science may resume after bounded validation. */
export function restoreOperations(raw:unknown,design:Design,target:SolarBodyId,arrivalVInfinityKmS:number):OperationsState|null {
 try{
  if(!raw||typeof raw!=='object')return null;
  const r=raw as Record<string,unknown>,s=createOperations(design,target,arrivalVInfinityKmS);
  const bounded=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  if(r.version!==1||r.target!==target||!['science','safe','downlink'].includes(String(r.mode))||!bounded(r.playSeconds,0,s.encounter.playbackDurationSeconds)||!bounded(r.batteryWh,0,s.batteryCapacityWh)||!bounded(r.temperatureC,12,90)||!bounded(r.jitterDegS,0,5)||!bounded(r.recoverySeconds,0,30)||typeof r.stabilized!=='boolean'||!['none','safe-mode','continue'].includes(String(r.cruiseResponse))||!Array.isArray(r.records)||r.records.length>32)return null;
  const ids=new Set<string>();
  for(const item of r.records){
   if(!item||typeof item!=='object')return null;
   const a=item as Record<string,unknown>;
   if(typeof a.id!=='string'||!/^obs-\d{1,8}$/.test(a.id)||ids.has(a.id)||!['context','detail','spectrum'].includes(String(a.kind))||!['visible','nir'].includes(String(a.band))||a.valid!==true||a.reason!=='accepted')return null;
   if(a.featureId!==null&&!s.encounter.features.some(f=>f.id===a.featureId))return null;
   if((a.kind!=='context'&&a.featureId===null)||(s.sensor==='camera'&&a.kind==='spectrum')||(s.sensor==='spectrometer'&&a.kind!=='spectrum'))return null;
   if(!bounded(a.quality,0,1)||!bounded(a.snr,0,1e12)||!bounded(a.smearPixels,0,2.5)||!bounded(a.gsdM,0,1e12)||!bounded(a.footprintKm,0,1e12)||!bounded(a.exposureSeconds,0,1e8)||!bounded(a.dataBits,1,s.storageBits)||!bounded(a.transmittedBits,0,a.dataBits))return null;
   if(a.kind==='spectrum'&&(!bounded(a.reflectanceEstimate,0,1)||!bounded(a.reflectanceUncertainty,0,10)))return null;
   ids.add(a.id);
   s.records.push({id:a.id,kind:a.kind as ScienceRecord['kind'],featureId:a.featureId as string|null,band:a.band as ScienceBand,quality:a.quality,snr:a.snr,smearPixels:a.smearPixels,gsdM:a.gsdM,footprintKm:a.footprintKm,exposureSeconds:a.exposureSeconds,dataBits:a.dataBits,transmittedBits:a.transmittedBits,valid:true,reason:'accepted',reflectanceEstimate:a.kind==='spectrum'?a.reflectanceEstimate as number:null,reflectanceUncertainty:a.kind==='spectrum'?a.reflectanceUncertainty as number:null});
  }
  s.storedBits=s.records.reduce((total,record)=>total+record.dataBits-record.transmittedBits,0);if(s.storedBits>s.storageBits)return null;
  s.playSeconds=r.playSeconds;s.mode=r.mode as OperationsState['mode'];s.batteryWh=r.batteryWh;s.temperatureC=r.temperatureC;s.jitterDegS=r.jitterDegS;s.recoverySeconds=r.recoverySeconds;s.stabilized=r.stabilized;s.cruiseResponse=r.cruiseResponse as OperationsState['cruiseResponse'];
  s.oneWayLightSeconds=bounded(r.oneWayLightSeconds,0,1e7)?r.oneWayLightSeconds:0;
  s.nextRecordId=Math.max(0,...s.records.map(record=>Number(record.id.slice(4))))+1;s.lastCapture=s.records.at(-1)??null;s.exposure=null;
  s.lastIssue=typeof r.lastIssue==='string'?r.lastIssue.slice(0,64):'';
  if(r.pendingCommand!==null&&r.pendingCommand!==undefined){
   if(typeof r.pendingCommand!=='object')return null;
   const pending=r.pendingCommand as Record<string,unknown>;
   if(!['stabilize','safe-mode','resume','downlink'].includes(String(pending.command))||!bounded(pending.remainingSeconds,0,1))return null;
   s.pendingCommand={command:pending.command as OnboardCommand,remainingSeconds:pending.remainingSeconds};
  }
  return s;
 }catch{return null;}
}
