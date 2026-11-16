import {advanceAcquisition,connectedInstruments,getBusDefinition,getPartDefinition,hardwareLink,hardwareLoadPower,hardwareSafePower,hardwareSlew,HARDWARE_TRANSFER_MODEL_VERSION,isHardwareDesign,resolveHardware} from '../hardware';
import {BUS,PARTS} from '../sim/catalog';
import {bodyBasis,evaluateDesign,partVisibility,solarGeneration} from '../sim/assembly';
import {ATTITUDE_RATE_DEG_S,quaternionAngleDeg,quaternionFromBasis,quaternionToBasis,slewQuaternion} from '../sim/attitude';
import {cross,dot,magnitude,normalize,scale,sub} from '../sim/physics';
import type {Design,Quaternion,Vec3} from '../sim/types';
import {TRANSFER_MODEL_VERSION,evaluateEscapeStage,transferCraftDesign} from '../transfer/planning';
import {transferEnvironmentAt} from '../transfer/state';
import type {FullTransferSolution,TransferEnvironment,TransferOperationKind} from '../transfer/types';
import {freezeTransferInput} from '../transfer/immutable';
import type {TransferRuntimeState} from '../transfer/types';
export type FlightResourceState=Omit<TransferRuntimeState,'modelVersion'|'solution'|'integrationStepSeconds'>;
export interface FlightPolicy {operation:TransferOperationKind;duration:number;requestedAxes?:Axes;extraLoadW?:number;radio:{receiverPowered:boolean;mode:'off'|'rx'|'tx'|'rx-tx';powerW:number}}
export const TRANSFER_SCIENCE_REQUIREMENTS=Object.freeze({targetPackets:3,minimumQuality:.4,packetBits:24e6,maximumAltitudeKm:12000,minimumCaptureIntervalSeconds:120,uniqueBinSeconds:300});
type Axes={x:Vec3;y:Vec3;z:Vec3};
export interface TransferTelemetry {
 radioMode:'off'|'rx'|'tx'|'rx-tx';receiverPowered:boolean;
 time:number;requestedTime:number;duration:number;environment:TransferEnvironment;operation:TransferOperationKind;
 bodyAxes:Axes;requestedBodyAxes:Axes;slewAngleDeg:number;slewing:boolean;
 solarPowerW:number;panelVisibility:number;loadPowerW:number;energyWh:number;batteryWh:number;chargeLimitW:number;dischargeLimitW:number;
 storedBits:number;storageBits:number;transmittedBits:number;receivedBits:number;scienceReceived:number;targetPackets:number;
 cameraVisibility:number;antennaVisibility:number;targetVisible:boolean;observationQuality:number;observing:boolean;
 linkReady:boolean;linkRateBps:number;linkMarginDb:number;lightTimeS:number;safeMode:boolean;status:string;reason:string;
}
const resourceCache=new WeakMap<Design,ReturnType<typeof evaluateDesign>>();
const solarCache=new WeakMap<Design,{key:string;powerW:number;visibility:number}>();
export function resources(craft:Design){let cached=resourceCache.get(craft);if(!cached){cached=evaluateDesign(craft);resourceCache.set(craft,cached);}return cached;}
function actualSolar(craft:Design,direction:Vec3,eclipse:boolean,distanceAU:number){if(eclipse)return {powerW:0,visibility:0};const canonical=direction.map(v=>Math.round(v*1e12)/1e12) as Vec3,key=canonical.join(',');let cached=solarCache.get(craft);if(!cached||cached.key!==key){const result=solarGeneration(craft,canonical,false,1);cached={key,...result};solarCache.set(craft,cached);}return {powerW:cached.powerW/(distanceAU*distanceAU),visibility:cached.visibility};}
export function requestedAxes(env:TransferEnvironment,operation:TransferOperationKind):Axes{return bodyBasis(env.targetDirection,env.sunDirection,operation==='charge'?'sun':operation==='observe'?'target':'earth',env.earthDirection);}
function bodyDirection(vector:Vec3,axes:Axes):Vec3{return [dot(vector,axes.x),dot(vector,axes.y),dot(vector,axes.z)];}
function event(state:FlightResourceState,code:string,message:string,severity:'info'|'warning'|'error'='info'){state.events.push({time:state.time,code,message,severity});}
export function usedStorage(state:FlightResourceState){return state.packets.reduce((sum,p)=>sum+Math.max(0,p.bits-p.receivedBits),0)+(state.hardwareData?.acquisition?.bits??0);}
function rawLink(distanceKm:number){
 // Same explicit educational X-band assumptions as M02, now with actual range.
 const loss=20*Math.log10(Math.max(1,distanceKm))+20*Math.log10(8.4)+92.45;
 const cn0=10*Math.log10(5)+35+66-loss-3+228.6-10*Math.log10(100);
 const modes=[512,2048,8192,32768,131072,524288];let rate=0,margin=-Infinity;for(const candidate of modes){const m=cn0-10*Math.log10(candidate)-4.5;if(m>=0){rate=candidate;margin=m;}}
 return {rate,margin:Number.isFinite(margin)?margin:cn0-10*Math.log10(modes[0])-4.5};
}
export function flightTelemetry(state:FlightResourceState,time:number,q:Quaternion,env:TransferEnvironment,policy:FlightPolicy,full=false):TransferTelemetry {
 const ev=resources(state.craft),hardware=isHardwareDesign(state.craft),operation=policy.operation,bodyAxes=quaternionToBasis(q),requestedBodyAxes=policy.requestedAxes??requestedAxes(env,operation),slewAngleDeg=quaternionAngleDeg(q,quaternionFromBasis(requestedBodyAxes)),sun=bodyDirection(env.sunDirection,bodyAxes),target=bodyDirection(env.targetDirection,bodyAxes),earth=bodyDirection(env.earthDirection,bodyAxes);
 const solar=actualSolar(state.craft,sun,env.eclipse,env.sunDistanceAU),cameraVisibility=full||operation==='observe'?Math.max(0,...(hardware?connectedInstruments(state.craft,'spectrometer').map(p=>p.part):state.craft.parts.filter(p=>p.kind==='spectrometer')).map(p=>partVisibility(state.craft,p,target,Math.cos((hardware?getPartDefinition(state.craft,p).optics?.halfAngleDeg??28:28)*Math.PI/180)))):0,hardwareRadio=hardware?hardwareLink(state.craft,env.contactDistanceKm,earth,true):null,antennaVisibility=hardware?hardwareRadio?.antennaPart?partVisibility(state.craft,hardwareRadio.antennaPart,earth,-1):0:full||operation==='downlink'?Math.max(0,...state.craft.parts.filter(p=>p.kind==='antenna').map(p=>partVisibility(state.craft,p,earth,Math.cos(10*Math.PI/180)))):0;
 let loadPowerW=state.safeMode?(hardware?hardwareSafePower(state.craft,slewAngleDeg>.25):7):hardware?hardwareLoadPower(state.craft,operation,slewAngleDeg>.25):BUS.basePowerW+state.craft.parts.reduce((sum,p)=>{const d=PARTS[p.kind],active=operation==='observe'&&p.kind==='spectrometer'||operation==='downlink'&&p.kind==='antenna';return sum+(active?d.activePowerW:d.idlePowerW);},0);
 if(hardware&&state.hardwareData?.acquisition&&operation!=='observe'&&!state.safeMode){const instrument=connectedInstruments(state.craft,'spectrometer')[0];if(instrument)loadPowerW+=(instrument.definition.activePowerW-instrument.definition.idlePowerW)/getBusDefinition(state.craft).conversionEfficiency;}
 const targetVisible=env.state.phase==='mars-flyby'&&env.state.altitudeKm<=TRANSFER_SCIENCE_REQUIREMENTS.maximumAltitudeKm&&env.targetIlluminated;
 const frameBits=hardware?connectedInstruments(state.craft,'spectrometer')[0]?.definition.optics?.bitsPerFrame??TRANSFER_SCIENCE_REQUIREMENTS.packetBits:TRANSFER_SCIENCE_REQUIREMENTS.packetBits;
 const observationQuality=targetVisible?Math.min(1,4000/Math.max(1,env.state.altitudeKm))*cameraVisibility:0,observing=operation==='observe'&&!state.safeMode&&observationQuality>=TRANSFER_SCIENCE_REQUIREMENTS.minimumQuality&&usedStorage(state)+(state.hardwareData?.acquisition?0:frameBits)<=ev.storageBits;
 const link=hardwareRadio?{rate:hardwareRadio.rateBps,margin:hardwareRadio.marginDb}:rawLink(env.contactDistanceKm),linkReady=operation==='downlink'&&!state.safeMode&&env.groundVisible&&!env.earthLinkOcculted&&!env.solarConjunction&&antennaVisibility>=.6&&link.rate>0;
 const radio=policy.radio;
 if(hardware&&!state.safeMode){const h=resolveHardware(state.craft),selected=h.parts.find(p=>p.part.id===h.radioId);if(selected)loadPowerW+=(radio.powerW-(operation==='downlink'?selected.definition.activePowerW:selected.definition.idlePowerW))/h.bus.conversionEfficiency;}
 if(policy.extraLoadW)loadPowerW+=policy.extraLoadW;
 const reason=state.status==='failed'?(state.failureReason||'임무 중단'):state.safeMode?'전력 안전 모드':env.eclipse?'행성 그림자':operation==='observe'&&!targetVisible?'조명 또는 관측 거리 조건을 기다립니다.':operation==='observe'&&cameraVisibility<.4?'관측기 지향·가림을 확인하세요.':operation==='downlink'&&!linkReady?'교신 가시성·태양 간섭·안테나 지향 조건을 기다립니다.':operation==='downlink'?'지구 수신까지 광속 지연이 적용됩니다.':'탑재 일정에 따라 자율 운용합니다.';
 return {radioMode:radio.mode,receiverPowered:radio.receiverPowered,time,requestedTime:state.requestedTime,duration:policy.duration,environment:env,operation,bodyAxes,requestedBodyAxes,slewAngleDeg,slewing:slewAngleDeg>.25,solarPowerW:solar.powerW,panelVisibility:solar.visibility,loadPowerW,energyWh:state.energyWh,batteryWh:ev.batteryWh,chargeLimitW:ev.chargeLimitW,dischargeLimitW:ev.dischargeLimitW,storedBits:usedStorage(state),storageBits:ev.storageBits,transmittedBits:state.packets.reduce((s,p)=>s+p.transmittedBits,0),receivedBits:state.packets.reduce((s,p)=>s+p.receivedBits,0),scienceReceived:state.scienceReceived,targetPackets:TRANSFER_SCIENCE_REQUIREMENTS.targetPackets,cameraVisibility,antennaVisibility,targetVisible,observationQuality,observing,linkReady,linkRateBps:linkReady?link.rate:0,linkMarginDb:link.margin,lightTimeS:env.lightTimeSeconds,safeMode:state.safeMode,status:state.status,reason};
}
export function energyRate(t:TransferTelemetry):number {const net=t.solarPowerW-t.loadPowerW;return net>=0?Math.min(net,t.chargeLimitW)*.92:-Math.min(-net,t.dischargeLimitW)/.95;}
export function runtimeSlew(state:FlightResourceState,from:Quaternion,target:Quaternion,dt:number,rate=state.hardwareData?.angularRateDegS??0){return state.hardwareData?hardwareSlew(state.craft,from,target,dt,rate):{quaternion:slewQuaternion(from,target,ATTITUDE_RATE_DEG_S*dt),rateDegS:0};}
