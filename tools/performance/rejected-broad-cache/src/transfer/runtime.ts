import {advanceAcquisition,connectedInstruments,getBusDefinition,getPartDefinition,hardwareLink,hardwareLoadPower,hardwareSafePower,hardwareSlew,HARDWARE_TRANSFER_MODEL_VERSION,isHardwareDesign,resolveHardware} from '../hardware';
import {BUS,PARTS} from '../sim/catalog';
import {bodyBasis,evaluateDesign,partVisibility,solarGeneration} from '../sim/assembly';
import {ATTITUDE_RATE_DEG_S,quaternionAngleDeg,quaternionFromBasis,quaternionToBasis,slewQuaternion} from '../sim/attitude';
import {cross,dot,magnitude,normalize,scale,sub} from '../sim/physics';
import type {Design,Quaternion,Vec3} from '../sim/types';
import {TRANSFER_MODEL_VERSION,evaluateEscapeStage,transferCraftDesign} from './planning';
import {transferRuntimeEnvironmentAt as transferEnvironmentAt} from './state';
import type {FullTransferSolution,TransferEnvironment,TransferOperationKind,TransferRuntimeState} from './types';
import {freezeTransferInput} from './immutable';
import {compiledTransferCraft} from './compiled-craft';
import {hardwareLinkFromConfiguration} from '../hardware/resolve';
import {hardwareSlewFromLimits} from '../hardware/attitude';
export const TRANSFER_SCIENCE_REQUIREMENTS=Object.freeze({targetPackets:3,minimumQuality:.4,packetBits:24e6,maximumAltitudeKm:12000,minimumCaptureIntervalSeconds:120,uniqueBinSeconds:300});
type Axes={x:Vec3;y:Vec3;z:Vec3};
export interface TransferTelemetry {
 time:number;requestedTime:number;duration:number;environment:TransferEnvironment;operation:TransferOperationKind;
 bodyAxes:Axes;requestedBodyAxes:Axes;slewAngleDeg:number;slewing:boolean;
 solarPowerW:number;panelVisibility:number;loadPowerW:number;energyWh:number;batteryWh:number;chargeLimitW:number;dischargeLimitW:number;
 storedBits:number;storageBits:number;transmittedBits:number;receivedBits:number;scienceReceived:number;targetPackets:number;
 cameraVisibility:number;antennaVisibility:number;targetVisible:boolean;observationQuality:number;observing:boolean;
 linkReady:boolean;linkRateBps:number;linkMarginDb:number;lightTimeS:number;safeMode:boolean;status:string;reason:string;
}
export interface TransferResult {status:'success'|'partial'|'failed';score:number;received:number;required:number;reasons:string[];elapsedSeconds:number;energyMinimumWh:number;fuelRemainingKg:number;totalCost:number;budgetRemaining:number;packets:TransferRuntimeState['packets'];events:TransferRuntimeState['events']}
const activeMode=(state:TransferRuntimeState,time=state.time):TransferOperationKind=>state.safeMode?'charge':state.solution.plan.operations.find(op=>time>=op.start&&time<op.end)?.kind??'charge';
const resourceCache=new WeakMap<Design,ReturnType<typeof evaluateDesign>>();
const solarCache=new WeakMap<Design,{key:string;powerW:number;visibility:number}>();
function resources(craft:Design){let cached=resourceCache.get(craft);if(!cached){cached=evaluateDesign(craft);resourceCache.set(craft,cached);}return cached;}
function actualSolar(craft:Design,direction:Vec3,eclipse:boolean,distanceAU:number){if(eclipse)return {powerW:0,visibility:0};const canonical=direction.map(v=>Math.round(v*1e12)/1e12) as Vec3,key=canonical.join(',');let cached=solarCache.get(craft);if(!cached||cached.key!==key){const result=solarGeneration(craft,canonical,false,1);cached={key,...result};solarCache.set(craft,cached);}return {powerW:cached.powerW/(distanceAU*distanceAU),visibility:cached.visibility};}
function requestedAxes(env:TransferEnvironment,operation:TransferOperationKind):Axes{return bodyBasis(env.targetDirection,env.sunDirection,operation==='charge'?'sun':operation==='observe'?'target':'earth',env.earthDirection);}
function bodyDirection(vector:Vec3,axes:Axes):Vec3{return [dot(vector,axes.x),dot(vector,axes.y),dot(vector,axes.z)];}
function event(state:TransferRuntimeState,code:string,message:string,severity:'info'|'warning'|'error'='info'){state.events.push({time:state.time,code,message,severity});}
function usedStorage(state:TransferRuntimeState){return state.packets.reduce((sum,p)=>sum+Math.max(0,p.bits-p.receivedBits),0)+(state.hardwareData?.acquisition?.bits??0);}
function rawLink(distanceKm:number){
 // Same explicit educational X-band assumptions as M02, now with actual range.
 const loss=20*Math.log10(Math.max(1,distanceKm))+20*Math.log10(8.4)+92.45;
 const cn0=10*Math.log10(5)+35+66-loss-3+228.6-10*Math.log10(100);
 const modes=[512,2048,8192,32768,131072,524288];let rate=0,margin=-Infinity;for(const candidate of modes){const m=cn0-10*Math.log10(candidate)-4.5;if(m>=0){rate=candidate;margin=m;}}
 return {rate,margin:Number.isFinite(margin)?margin:cn0-10*Math.log10(modes[0])-4.5};
}
function telemetry(state:TransferRuntimeState,time:number,q:Quaternion,environment?:TransferEnvironment,full=false):TransferTelemetry {
 const ev=resources(state.craft),compiled=compiledTransferCraft(state.craft),hardware=!!compiled,operation=activeMode(state,time),env=environment??transferEnvironmentAt(state.solution,time,full||operation==='downlink'),bodyAxes=quaternionToBasis(q),requestedBodyAxes=requestedAxes(env,operation),slewAngleDeg=quaternionAngleDeg(q,quaternionFromBasis(requestedBodyAxes)),sun=bodyDirection(env.sunDirection,bodyAxes),target=bodyDirection(env.targetDirection,bodyAxes),earth=bodyDirection(env.earthDirection,bodyAxes);
 const solar=actualSolar(state.craft,sun,env.eclipse,env.sunDistanceAU),cameraVisibility=full||operation==='observe'?Math.max(0,...(compiled?compiled.instruments.map(p=>p.part):state.craft.parts.filter(p=>p.kind==='spectrometer')).map(p=>partVisibility(state.craft,p,target,Math.cos((hardware?getPartDefinition(state.craft,p).optics?.halfAngleDeg??28:28)*Math.PI/180)))):0,hardwareRadio=compiled?hardwareLinkFromConfiguration(compiled.link,env.contactDistanceKm,earth,true):null,antennaVisibility=hardware?hardwareRadio?.antennaPart?partVisibility(state.craft,hardwareRadio.antennaPart,earth,-1):0:full||operation==='downlink'?Math.max(0,...state.craft.parts.filter(p=>p.kind==='antenna').map(p=>partVisibility(state.craft,p,earth,Math.cos(10*Math.PI/180)))):0;
 let loadPowerW=state.safeMode?(compiled?compiled.safeLoads[slewAngleDeg>.25?1:0]:7):compiled?compiled.loads[operation][slewAngleDeg>.25?1:0]:BUS.basePowerW+state.craft.parts.reduce((sum,p)=>{const d=PARTS[p.kind],active=operation==='observe'&&p.kind==='spectrometer'||operation==='downlink'&&p.kind==='antenna';return sum+(active?d.activePowerW:d.idlePowerW);},0);
 if(hardware&&state.hardwareData?.acquisition&&operation!=='observe'&&!state.safeMode){const instrument=compiled?.instruments[0];if(instrument)loadPowerW+=(instrument.definition.activePowerW-instrument.definition.idlePowerW)/compiled!.conversionEfficiency;}
 const targetVisible=env.state.phase==='mars-flyby'&&env.state.altitudeKm<=TRANSFER_SCIENCE_REQUIREMENTS.maximumAltitudeKm&&env.targetIlluminated;
 const frameBits=compiled?compiled.instruments[0]?.definition.optics?.bitsPerFrame??TRANSFER_SCIENCE_REQUIREMENTS.packetBits:TRANSFER_SCIENCE_REQUIREMENTS.packetBits;
 const observationQuality=targetVisible?Math.min(1,4000/Math.max(1,env.state.altitudeKm))*cameraVisibility:0,observing=operation==='observe'&&!state.safeMode&&observationQuality>=TRANSFER_SCIENCE_REQUIREMENTS.minimumQuality&&usedStorage(state)+(state.hardwareData?.acquisition?0:frameBits)<=ev.storageBits;
 const link=hardwareRadio?{rate:hardwareRadio.rateBps,margin:hardwareRadio.marginDb}:rawLink(env.contactDistanceKm),linkReady=operation==='downlink'&&!state.safeMode&&env.groundVisible&&!env.earthLinkOcculted&&!env.solarConjunction&&antennaVisibility>=.6&&link.rate>0;
 const reason=state.status==='failed'?(state.failureReason||'임무 중단'):state.safeMode?'전력 안전 모드':env.eclipse?'행성 그림자':operation==='observe'&&!targetVisible?'조명 또는 관측 거리 조건을 기다립니다.':operation==='observe'&&cameraVisibility<.4?'관측기 지향·가림을 확인하세요.':operation==='downlink'&&!linkReady?'교신 가시성·태양 간섭·안테나 지향 조건을 기다립니다.':operation==='downlink'?'지구 수신까지 광속 지연이 적용됩니다.':'탑재 일정에 따라 자율 운용합니다.';
 return {time,requestedTime:state.requestedTime,duration:state.solution.durationSeconds,environment:env,operation,bodyAxes,requestedBodyAxes,slewAngleDeg,slewing:slewAngleDeg>.25,solarPowerW:solar.powerW,panelVisibility:solar.visibility,loadPowerW,energyWh:state.energyWh,batteryWh:ev.batteryWh,chargeLimitW:ev.chargeLimitW,dischargeLimitW:ev.dischargeLimitW,storedBits:usedStorage(state),storageBits:ev.storageBits,transmittedBits:state.packets.reduce((s,p)=>s+p.transmittedBits,0),receivedBits:state.packets.reduce((s,p)=>s+p.receivedBits,0),scienceReceived:state.scienceReceived,targetPackets:TRANSFER_SCIENCE_REQUIREMENTS.targetPackets,cameraVisibility,antennaVisibility,targetVisible,observationQuality,observing,linkReady,linkRateBps:linkReady?link.rate:0,linkMarginDb:link.margin,lightTimeS:env.lightTimeSeconds,safeMode:state.safeMode,status:state.status,reason};
}
export function getTransferTelemetry(state:TransferRuntimeState):TransferTelemetry{const value=telemetry(state,state.time,state.attitudeQuaternion,undefined,true);return {...value,environment:structuredClone(value.environment)};}
export function createTransferRuntime(solution:FullTransferSolution,craft:Design,integrationStepSeconds:300|600=600):TransferRuntimeState {
 if(solution.modelVersion!==TRANSFER_MODEL_VERSION)throw new Error('지원하지 않는 전이 모델입니다.');if(integrationStepSeconds!==300&&integrationStepSeconds!==600)throw new Error('순항 적분 간격은 300 또는 600초입니다.');
 const normalized=transferCraftDesign(craft),ev=evaluateDesign(normalized),launch=evaluateEscapeStage(solution,normalized),env=transferEnvironmentAt(solution,0),y=normalize(solution.trajectory.earthLocalPeriapsis.velocityKmS);
 let x=normalize(sub(env.sunDirection,scale(y,dot(env.sunDirection,y))));if(magnitude(x)<.1)x=normalize(cross(y,[0,0,1]));const z=normalize(cross(x,y));
 const state:TransferRuntimeState={version:1,modelVersion:isHardwareDesign(normalized)?HARDWARE_TRANSFER_MODEL_VERSION:TRANSFER_MODEL_VERSION,...(isHardwareDesign(normalized)?{hardwareData:{angularRateDegS:0,acquisition:null}}:{}),solution:structuredClone(solution),craft:normalized,time:0,requestedTime:0,energyWh:ev.batteryWh*.85,energyMinimumWh:ev.batteryWh*.85,fuelKg:getBusDefinition(normalized).fuelKg,safeMode:false,status:launch.launchable?'running':'failed',failureReason:launch.launchable?null:launch.warnings.filter(w=>w.severity==='error').map(w=>w.message).join(' '),attitudeQuaternion:quaternionFromBasis({x,y,z}),packets:[],signals:[],pendingFrames:[],events:[],processedEventIds:['departure'],lastCapture:-86400,scienceReceived:0,tick:0,integrationStepSeconds};
 freezeTransferInput(state.craft);freezeTransferInput(state.solution);
 if(launch.launchable)event(state,'ESCAPE_BURN',`정렬된 발사 단계가 ${launch.requiredDeltaVMps.toFixed(0)} m/s 순간 탈출 기동을 수행하고 분리되었습니다. 단계 추진제 ${launch.fuelUsedKg.toFixed(1)} kg · 탐사선 추진제는 유지됩니다.`);
 else event(state,'LAUNCH_BLOCKED',state.failureReason!,'error');return state;
}
function processArrivalsAndEvents(state:TransferRuntimeState){
 for(const signal of state.signals.filter(s=>s.arrivesAt<=state.time+1e-6)){const packet=state.packets.find(p=>p.id===signal.packetId);if(packet){packet.receivedBits=Math.min(packet.bits,packet.receivedBits+signal.bits);if(packet.receivedBits>=packet.bits-1e-6&&packet.receivedAt===null){packet.receivedAt=signal.arrivesAt;event(state,'DATA_RECEIVED','고유 분광 자료가 지구에 완전히 수신되었습니다.');}}}
 state.signals=state.signals.filter(s=>s.arrivesAt>state.time+1e-6);state.scienceReceived=state.packets.filter(p=>p.receivedAt!==null&&p.quality>=TRANSFER_SCIENCE_REQUIREMENTS.minimumQuality).length;
 for(const e of state.solution.phaseEvents){if(e.elapsedSeconds<=state.time+1e-6&&!state.processedEventIds.includes(e.id)){state.processedEventIds.push(e.id);event(state,e.id.toUpperCase().replaceAll('-','_'),e.id==='earth-exit'?'지구 중력 구간을 떠나 태양 중심 순항으로 전환했습니다.':e.id==='mars-entry'?'같은 위치·속도로 화성 조우 구간에 진입했습니다.':e.id==='periapsis'?'계획한 실제 최근접점을 통과했습니다.':'화성 영향권 경계에 도착했습니다.');}}
 if(state.time>=state.solution.durationSeconds-1e-6){state.time=state.solution.durationSeconds;if(state.status==='running')state.status='complete';}
}
function energyRate(t:TransferTelemetry):number {const net=t.solarPowerW-t.loadPowerW;return net>=0?Math.min(net,t.chargeLimitW)*.92:-Math.min(-net,t.dischargeLimitW)/.95;}
function updatePowerMode(state:TransferRuntimeState,t:TransferTelemetry){
 const ev=resources(state.craft);
 if(!state.safeMode&&(state.energyWh<=ev.batteryWh*.04+1e-8||t.loadPowerW-t.solarPowerW>ev.dischargeLimitW)){state.safeMode=true;event(state,'SAFE_MODE','배터리 잔량 또는 EPS 방전 한도로 안전 모드에 진입했습니다.','warning');}
 else if(state.safeMode&&state.energyWh>=ev.batteryWh*.16-1e-8){const prospective={...state,safeMode:false},next=telemetry(prospective,state.time,state.attitudeQuaternion,t.environment);if(next.loadPowerW-next.solarPowerW<=ev.dischargeLimitW){state.safeMode=false;event(state,'RECOVERED','충전 후 탑재 일정으로 복귀했습니다.');}}
}
function runtimeSlew(state:TransferRuntimeState,from:Quaternion,target:Quaternion,dt:number,rate=state.hardwareData?.angularRateDegS??0){return state.hardwareData?hardwareSlewFromLimits(compiledTransferCraft(state.craft)!.attitude,from,target,dt,rate):{quaternion:slewQuaternion(from,target,ATTITUDE_RATE_DEG_S*dt),rateDegS:0};}
function canonicalNextTime(state:TransferRuntimeState):number {
 const env=transferEnvironmentAt(state.solution,state.time,false),nearEncounter=Math.abs(state.time-state.solution.periapsisSeconds)<9000,nearDeparture=state.time<3600;
 const step=nearEncounter||nearDeparture?5:env.state.phase==='earth-escape'?60:state.integrationStepSeconds;
 let next=Math.min(state.solution.durationSeconds,(Math.floor((state.time+1e-7)/step)+1)*step);
 if(activeMode(state)==='downlink'||state.pendingFrames.length)next=Math.min(next,(Math.floor((state.time+1e-7)/60)+1)*60);
 for(const e of state.solution.phaseEvents)if(e.elapsedSeconds>state.time+1e-7)next=Math.min(next,e.elapsedSeconds);
 for(const op of state.solution.plan.operations)for(const boundary of [op.start,op.end])if(boundary>state.time+1e-7)next=Math.min(next,boundary);
 for(const signal of state.signals)if(signal.arrivesAt>state.time+1e-7)next=Math.min(next,signal.arrivesAt);
 for(const boundary of [state.solution.periapsisSeconds-9000,state.solution.periapsisSeconds+9000,3600])if(boundary>state.time+1e-7)next=Math.min(next,boundary);
 const target=quaternionFromBasis(requestedAxes(env,activeMode(state))),angle=quaternionAngleDeg(state.attitudeQuaternion,target);if(angle>.25)next=Math.min(next,state.time+Math.max(.01,Math.min(1,angle/ATTITUDE_RATE_DEG_S)));
 // Detect physical shadow crossings before integrating energy through a whole coarse interval.
 if(next-state.time>5&&transferEnvironmentAt(state.solution,next,false).eclipse!==env.eclipse){let lo=state.time,hi=next;for(let i=0;i<24&&hi-lo>.01;i++){const mid=(lo+hi)/2;if(transferEnvironmentAt(state.solution,mid,false).eclipse===env.eclipse)lo=mid;else hi=mid;}next=hi;}
 // Split at EPS hysteresis/depletion events, so a large cruise step cannot
 // silently run payloads through the low-energy threshold.
 const ev=resources(state.craft),initial=telemetry(state,state.time,state.attitudeQuaternion,env),rate=energyRate(initial),threshold=state.safeMode?(rate>=0?ev.batteryWh*.16:0):ev.batteryWh*.04,rising=state.safeMode&&rate>=0,possible=Math.max(ev.chargeLimitW*.92,ev.dischargeLimitW/.95)*(next-state.time)/3600;
 if(Math.abs(state.energyWh-threshold)>1e-8&&Math.abs(state.energyWh-threshold)<=possible+1e-6){
  const energyAt=(time:number)=>{const dt=time-state.time,mid=state.time+dt/2,environment=transferEnvironmentAt(state.solution,mid,false),q=runtimeSlew(state,state.attitudeQuaternion,quaternionFromBasis(requestedAxes(environment,activeMode(state))),dt/2).quaternion;return state.energyWh+energyRate(telemetry(state,mid,q,environment))*dt/3600;};
  const endEnergy=energyAt(next),crossed=rising?state.energyWh<threshold&&endEnergy>=threshold:state.energyWh>threshold&&endEnergy<=threshold;
  if(crossed){let lo=state.time,hi=next;for(let i=0;i<35&&hi-lo>1e-5;i++){const mid=(lo+hi)/2,value=energyAt(mid);if(rising?value<threshold:value>threshold)lo=mid;else hi=mid;}next=hi;}
 }
 return next;
}
function stepRuntime(state:TransferRuntimeState,end:number){
 const compiled=compiledTransferCraft(state.craft),start=state.time,dt=end-start,mid=start+dt/2,operation=activeMode(state,start),env=transferEnvironmentAt(state.solution,mid,operation==='downlink'),midTurn=runtimeSlew(state,state.attitudeQuaternion,quaternionFromBasis(requestedAxes(env,operation)),dt/2),midQ=midTurn.quaternion,t=telemetry(state,mid,midQ,env),ev=resources(state.craft);
 // Stored battery energy is integrated in Wh; surplus charge above EPS limit is curtailed.
 state.energyWh=Math.max(0,Math.min(ev.batteryWh,state.energyWh+energyRate(t)*dt/3600));state.energyMinimumWh=Math.min(state.energyMinimumWh,state.energyWh);
 const endEnv=transferEnvironmentAt(state.solution,end,operation==='downlink');const endTurn=runtimeSlew(state,midQ,quaternionFromBasis(requestedAxes(endEnv,operation)),dt/2,midTurn.rateDegS);state.attitudeQuaternion=endTurn.quaternion;if(state.hardwareData)state.hardwareData.angularRateDegS=endTurn.rateDegS;state.time=end;state.tick++;
 updatePowerMode(state,telemetry(state,end,state.attitudeQuaternion,endEnv));
 if(state.energyWh<=1e-8&&t.solarPowerW<(compiled?compiled.safeLoads[1]:7)){state.status='failed';state.failureReason='배터리가 소진되어 버스 최소 생존 전력도 유지하지 못했습니다.';event(state,'POWER_LOSS',state.failureReason,'error');}
 const current=telemetry(state,end,state.attitudeQuaternion,endEnv);
 if(state.hardwareData&&state.status==='running'){
  const id=`mars-spectrum:${Math.floor((end-state.solution.periapsisSeconds)/TRANSFER_SCIENCE_REQUIREMENTS.uniqueBinSeconds)}`,instrument=compiled?.instruments[0],eligible=t.observing&&current.observing&&!state.packets.some(p=>p.id===id)&&(!!state.hardwareData.acquisition||end-state.lastCapture>=TRANSFER_SCIENCE_REQUIREMENTS.minimumCaptureIntervalSeconds);
  const acquired=advanceAcquisition(state.hardwareData,instrument,dt,end,eligible,{id,target:id,quality:Math.min(t.observationQuality,current.observationQuality)},compiled!.dataWriteRateBps,ev.storageBits-usedStorage(state),!state.safeMode);
  if(acquired.completed){const a=acquired.completed;state.packets.push({id:a.id,capturedAt:a.startedAt,readyAt:end,bits:a.bits,quality:a.quality,transmittedBits:0,receivedBits:0,receivedAt:null});state.lastCapture=end;event(state,'SCIENCE_CAPTURED','노출 및 데이터 버스 기록을 마친 화성 분광 자료를 저장했습니다.');}
 }else if(!state.hardwareData&&state.status==='running'&&current.observing&&end-state.lastCapture>=TRANSFER_SCIENCE_REQUIREMENTS.minimumCaptureIntervalSeconds){const id=`mars-spectrum:${Math.floor((end-state.solution.periapsisSeconds)/TRANSFER_SCIENCE_REQUIREMENTS.uniqueBinSeconds)}`;if(!state.packets.some(p=>p.id===id)){state.packets.push({id,capturedAt:end,bits:TRANSFER_SCIENCE_REQUIREMENTS.packetBits,quality:current.observationQuality,transmittedBits:0,receivedBits:0,receivedAt:null});state.lastCapture=end;event(state,'SCIENCE_CAPTURED','새 화성 분광 구간을 기록했습니다.');}}
 // Use the actual midpoint link during this interval; new packets at its endpoint cannot travel backwards in time.
 if(state.status==='running'&&t.linkReady){let bits=t.linkRateBps*dt;for(const packet of state.packets){if((packet.readyAt??packet.capturedAt)>start+1e-7)continue;const amount=Math.min(bits,packet.bits-packet.transmittedBits);if(amount<=0)continue;packet.transmittedBits+=amount;bits-=amount;const frame=state.pendingFrames.find(f=>f.packetId===packet.id);if(frame)frame.bits+=amount;else state.pendingFrames.push({packetId:packet.id,bits:amount});if(bits<=0)break;}}
 // Fixed 60 s RF packetization prevents arrival events from recursively creating
 // finer transmission frames. Batching conservatively delays receipt by ≤60 s.
 if(state.pendingFrames.length&&(Math.abs(end/60-Math.round(end/60))<1e-8||activeMode(state,end)!==operation||end>=state.solution.durationSeconds-1e-6)){const network=endEnv.groundStationId?endEnv:transferEnvironmentAt(state.solution,end);for(const frame of state.pendingFrames)state.signals.push({id:`signal-${state.tick}-${frame.packetId}`,packetId:frame.packetId,bits:frame.bits,sentAt:end,arrivesAt:end+network.lightTimeSeconds,stationId:network.groundStationId||'network'});state.pendingFrames=[];}
 processArrivalsAndEvents(state);
}
/** Accumulates requested time; only complete canonical/event intervals are committed.
 * Small frame requests cannot change the physical integration partition. maxSteps
 * lets a worker yield; call again with zero elapsed to drain remaining requested time.
 */
export function advanceTransfer(state:TransferRuntimeState,elapsedSeconds:number,maxSteps=Infinity):TransferRuntimeState {
 if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw new Error('경과 시간은 음수가 아닌 유한값이어야 합니다.');
 if(maxSteps!==Infinity&&(!Number.isInteger(maxSteps)||maxSteps<0))throw new Error('작업 청크는 0 이상의 정수여야 합니다.');
 state.requestedTime=Math.min(state.solution.durationSeconds,state.requestedTime+elapsedSeconds);let steps=0;
 while(state.status==='running'&&state.time<state.requestedTime-1e-7&&steps<maxSteps){updatePowerMode(state,telemetry(state,state.time,state.attitudeQuaternion));const next=canonicalNextTime(state);if(next>state.requestedTime+1e-7)break;stepRuntime(state,next);steps++;}
 return state;
}
export function getTransferResult(state:TransferRuntimeState):TransferResult {
 const launch=evaluateEscapeStage(state.solution,state.craft),required=TRANSFER_SCIENCE_REQUIREMENTS.targetPackets,received=state.scienceReceived,status=state.status==='complete'&&received>=required?'success':received>0&&state.status!=='failed'?'partial':'failed',reasons:string[]=[];
 if(state.failureReason)reasons.push(state.failureReason);if(received<required)reasons.push(`지구에 완전히 수신된 고유 분광 자료 ${received}/${required}개`);if(state.status!=='complete')reasons.push('화성 영향권 이탈까지 임무가 아직 완료되지 않았습니다.');if(state.packets.length===0)reasons.push('조명·거리·장비 방향·운영 일정의 관측 조건을 확인하세요.');if(state.packets.length>received)reasons.push('선상 기록과 송신 중 자료는 완전 수신 전까지 과학 성과에 포함되지 않습니다.');
 const science=Math.min(1,received/required)*70,completion=state.status==='complete'?20:0,efficiency=Math.max(0,Math.min(1,(launch.budget-launch.totalCost)/launch.budget))*10;
 return {status,score:Math.round(science+completion+efficiency),received,required,reasons,elapsedSeconds:state.time,energyMinimumWh:state.energyMinimumWh,fuelRemainingKg:state.fuelKg,totalCost:launch.totalCost,budgetRemaining:launch.budget-launch.totalCost,packets:structuredClone(state.packets),events:structuredClone(state.events)};
}
export function previewTransfer(solution:FullTransferSolution,craft:Design,integrationStepSeconds:300|600=600){const state=createTransferRuntime(solution,craft,integrationStepSeconds);advanceTransfer(state,solution.durationSeconds);return {state,result:getTransferResult(state)};}
