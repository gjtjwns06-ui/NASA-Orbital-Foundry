import {earthOrbitModelVersion} from './earth-orbit';
import {advanceAcquisition,connectedInstruments,getBusDefinition,getPartDefinition,hardwareLink,hardwareLoadPower,hardwareSafePower,hardwareSlew,hardwareSlewDuration,HARDWARE_SIM_MODEL_VERSION,isHardwareDesign,resolveHardware} from '../hardware';
import { BUS, MODEL_VERSION, MISSIONS, PARTS } from './catalog';
import {CONJUNCTION_FORECAST_TIME,conjunctionMetrics,debrisStateAt} from './hazards';
import { bodyBasis, evaluateDesign, partVisibility, solarGeneration } from './assembly';
import {ATTITUDE_RATE_DEG_S,quaternionAngleDeg,quaternionFromBasis,quaternionToBasis,slewQuaternion} from './attitude';
import {evaluateEarthTarget,getTargetRequirements,normalizeScienceTarget} from './targets';
import { add,C_KM_S, clamp, DEG, dot, EARTH_RADIUS_KM, earthStateAt, flybyMetrics, fuelForDeltaV, getManeuvers, groundPosition, isEclipsed, magnitude, maneuverMagnitude, MARS_RADIUS_KM, marsStateAt, normalize, scale, sub, SUN_DIRECTION, surfaceVisible } from './physics';
import type { CommandKind, Design, GroundCommand, MissionPreview, MissionResult, OperationKind, SimulationState, Telemetry, TrajectoryPoint, Vec3 } from './types';
export const FIXED_STEP_S=5;
export const M01_M02_SCORE_DEFINITION=Object.freeze({id:'science60-navigation25-resources15-v1',weights:Object.freeze({science:60,navigation:25,resources:15}),resourceWeights:Object.freeze({budget:.4,fuel:.3,energy:.3})});
const MARS_EARTH_DISTANCE_KM=180e6;
const MARS_EARTH_DIRECTION:Vec3=normalize([-1,-.5,.2]);
export function getDesignRequirements(design:Design):{targetPackets:number;minimumQuality:number;targetLabel:string;packetBits:number}{
 if(design.missionId==='earth'){const r=getTargetRequirements(design.scienceTarget,isHardwareDesign(design));return {targetPackets:r.targetPackets,minimumQuality:r.minimumQuality,targetLabel:r.name,packetBits:isHardwareDesign(design)?connectedInstruments(design,'camera')[0]?.definition.optics?.bitsPerFrame??r.packetBits:r.packetBits};}
 const m=MISSIONS[design.missionId];return {targetPackets:m.targetPackets,minimumQuality:m.minimumQuality,targetLabel:m.target,packetBits:isHardwareDesign(design)?connectedInstruments(design,'spectrometer')[0]?.definition.optics?.bitsPerFrame??1.6e6:1.6e6};
}
export function trajectory(design:Design,count=360):TrajectoryPoint[]{
 const mission=MISSIONS[design.missionId],radius=design.missionId==='earth'?EARTH_RADIUS_KM:MARS_RADIUS_KM;
 return Array.from({length:Math.max(2,count)},(_,i)=>{const t=i/(Math.max(2,count)-1)*mission.duration,s=design.missionId==='earth'?earthStateAt(design.plan,t):marsStateAt(design.plan,t);return {...s,t,eclipse:isEclipsed(s.positionKm,radius),altitudeKm:magnitude(s.positionKm)-radius};});
}
export function createSimulation(design:Design):SimulationState{
 const d=structuredClone(design);if(d.scienceTarget)d.scienceTarget=normalizeScienceTarget(d.scienceTarget);const ev=evaluateDesign(d);
 const state:SimulationState={version:1,modelVersion:earthOrbitModelVersion(d.plan,isHardwareDesign(d)?HARDWARE_SIM_MODEL_VERSION:MODEL_VERSION),...(isHardwareDesign(d)?{hardwareData:{angularRateDegS:0,acquisition:null}}:{}),design:d,time:0,tick:0,remainder:0,energyWh:ev.batteryWh*.85,fuelKg:getBusDefinition(d).fuelKg,dataPackets:[],inFlight:[],events:[{time:0,code:'START',message:'탐사선이 초기 궤도에 투입되었습니다.',severity:'info'}],status:ev.launchable?'running':'failed',safeMode:false,lastCapture:-1000,burnExecuted:false,scienceReceived:0,energyMinimumWh:ev.batteryWh*.85,blockedReason:ev.launchable?null:ev.warnings.filter(w=>w.severity==='error').map(w=>w.message).join(' '),lastEventCode:null,commands:[],commandOverride:null,executedBurnIds:[],hazardForecastIssued:false,hazardPassageRecorded:false,attitudeQuaternion:null};
 state.attitudeQuaternion=quaternionFromBasis(getTelemetry(state).bodyAxes);
 if(d.missionId==='mars'&&ev.launchable){state.fuelKg=Math.max(0,getBusDefinition(d).fuelKg-ev.propellantUsedKg);state.burnExecuted=true;state.executedBurnIds.push('mars-targeting');if(ev.requiredDeltaVMps>.01)event(state,'BURN',`진입점 표적화 기동 ${ev.requiredDeltaVMps.toFixed(1)} m/s · 추진제 ${ev.propellantUsedKg.toFixed(2)} kg`);}
 return state;
}
function operationAt(design:Design,t:number):OperationKind{return design.plan.operations.find(x=>t>=x.start&&t<x.end)?.kind||'charge';}
function event(state:SimulationState,code:string,message:string,severity:'info'|'warning'|'error'='info'){
 const last=state.events[state.events.length-1];if(last?.code===code&&state.time-last.time<120)return;
 state.events.push({time:state.time,code,message,severity});if(state.events.length>300)state.events.splice(1,1);state.lastEventCode=code;
}
export function linkBudget(distanceKm:number,mission:'earth'|'mars'): {rateBps:number;marginDb:number}{
 // X-band teaching link: 5 W RF, 35 dBi spacecraft dish, 32 dBi ground (LEO) / 66 dBi DSN-like dish (Mars), Tsys=100K.
 const freqHz=8.4e9,lambda=C_KM_S*1000/freqHz,rangeM=Math.max(distanceKm,1)*1000;
 const fspl=20*Math.log10(4*Math.PI*rangeM/lambda),eirp=10*Math.log10(5)+35,groundGain=mission==='earth'?32:66;
 const cn0=eirp+groundGain-fspl-3+228.6-10*Math.log10(100);
 const modes=mission==='earth'?[1e6,256e3,64e3,8e3]:[64000,16000,4000,1000,250];
 for(const rate of modes){const margin=cn0-10*Math.log10(rate)-4.5;if(margin>=0)return {rateBps:rate,marginDb:margin};}
 return {rateBps:0,marginDb:cn0-10*Math.log10(modes[modes.length-1])-4.5};
}
function geo(r:Vec3,t:number):{lat:number;lon:number}{let lon=Math.atan2(r[1],r[0])/DEG-t*7.2921159e-5/DEG;lon=((lon+540)%360)-180;return {lat:Math.asin(r[2]/magnitude(r))/DEG,lon};}
function pointingGeometry(design:Design,time:number){
 const isEarth=design.missionId==='earth',orbital=isEarth?earthStateAt(design.plan,time):marsStateAt(design.plan,time),r=orbital.positionKm,radius=isEarth?EARTH_RADIUS_KM:MARS_RADIUS_KM;
 const targetDirection=scale(normalize(r),-1);let earthDirection:Vec3=MARS_EARTH_DIRECTION,groundVisible=true,distanceKm=MARS_EARTH_DISTANCE_KM,contactTargetPositionKm:Vec3|null=null;
 if(isEarth){const stations=[[35,75],[-35,-60],[35,-140],[-25,130],[30,-15]],visible=stations.map(([lat,lon])=>groundPosition(lat,lon,time)).filter(g=>surfaceVisible(r,g,5));groundVisible=visible.length>0;const ground=visible.sort((a,b)=>magnitude(sub(a,r))-magnitude(sub(b,r)))[0]||groundPosition(35,75,time);earthDirection=normalize(sub(ground,r));distanceKm=magnitude(sub(ground,r));contactTargetPositionKm=ground;}
 else groundVisible=!(dot(r,earthDirection)<0&&magnitude(sub(r,scale(earthDirection,dot(r,earthDirection))))<radius);
 return {isEarth,orbital,r,radius,targetDirection,earthDirection,groundVisible,distanceKm,contactTargetPositionKm};
}
export function getTelemetry(state:SimulationState):Telemetry {
 const design=state.design,hardware=isHardwareDesign(design),mission=MISSIONS[design.missionId],requirements=getDesignRequirements(design),ev=evaluateDesign(design),{isEarth,orbital,r,radius,targetDirection,earthDirection,groundVisible,distanceKm,contactTargetPositionKm}=pointingGeometry(design,state.time),altitudeKm=magnitude(r)-radius;
 const eclipse=isEclipsed(r,radius),op=state.commandOverride&&state.time<state.commandOverride.endsAt?state.commandOverride.kind:operationAt(design,state.time),operation=state.safeMode?'charge':op;
 const subpoint=geo(r,state.time);
 const attitude=operation==='observe'?'target':operation==='downlink'?'earth':'sun';
 const requestedBodyAxes=bodyBasis(targetDirection,SUN_DIRECTION,attitude,earthDirection),actualBodyAxes=state.attitudeQuaternion?quaternionToBasis(state.attitudeQuaternion):requestedBodyAxes;
 const toBody=(v:Vec3):Vec3=>[dot(v,actualBodyAxes.x),dot(v,actualBodyAxes.y),dot(v,actualBodyAxes.z)],sunBody=toBody(SUN_DIRECTION),targetBody=toBody(targetDirection),earthBody=toBody(earthDirection);
 const slewAngleDeg=state.attitudeQuaternion?quaternionAngleDeg(state.attitudeQuaternion,quaternionFromBasis(requestedBodyAxes)):0,slewing=slewAngleDeg>.5,slewRemainingS=hardware?hardwareSlewDuration(design,slewAngleDeg):slewAngleDeg/ATTITUDE_RATE_DEG_S;
 const solar=solarGeneration(design,sunBody,eclipse,isEarth?1:1.524);
 const scienceKind=isEarth?'camera':'spectrometer',instruments=hardware?connectedInstruments(design,scienceKind).map(p=>p.part):design.parts.filter(p=>p.kind===scienceKind),antennas=design.parts.filter(p=>p.kind==='antenna'),optics=hardware?connectedInstruments(design,scienceKind)[0]?.definition.optics:undefined;
 const idealTarget=isEarth?evaluateEarthTarget(design.scienceTarget,r,state.time,altitudeKm,1,optics,hardware):null;
 const cameraDirection=idealTarget&&design.scienceTarget?toBody(normalize(sub(groundPosition(idealTarget.observedPoint.latDeg,idealTarget.observedPoint.lonDeg,state.time),r))):targetBody;
 const cameraVisibility=Math.max(0,...instruments.map(p=>partVisibility(design,p,cameraDirection,Math.cos((hardware?getPartDefinition(design,p).optics?.halfAngleDeg??28:28)*DEG))));
 const hardwareRadio=hardware?hardwareLink(design,distanceKm,earthBody,!isEarth):null;
 const antennaVisibility=hardware?hardwareRadio?.antennaPart?partVisibility(design,hardwareRadio.antennaPart,earthBody,-1):0:Math.max(0,...antennas.map(p=>partVisibility(design,p,earthBody,Math.cos(12*DEG))));
 const targetEvaluation=isEarth?evaluateEarthTarget(design.scienceTarget,r,state.time,altitudeKm,cameraVisibility,optics,hardware):null;
 const targetVisible=targetEvaluation?targetEvaluation.withinFootprint&&targetEvaluation.illuminated:altitudeKm<13000;
 const observationQuality=targetEvaluation?targetEvaluation.quality:clamp(Math.min(1,4200/Math.max(altitudeKm,1))*cameraVisibility,0,1);
 const observing=operation==='observe'&&targetVisible&&cameraVisibility>.5&&observationQuality>=requirements.minimumQuality&&!state.safeMode;
 const link=hardwareRadio??linkBudget(distanceKm,design.missionId),linkReady=operation==='downlink'&&groundVisible&&antennaVisibility>.5&&!state.safeMode&&link.rateBps>0;
 let loadPowerW=state.safeMode?(hardware?hardwareSafePower(design,slewing):7):hardware?hardwareLoadPower(design,operation,slewing):ev.basePowerW;
 if(hardware&&state.hardwareData?.acquisition&&operation!=='observe'&&!state.safeMode){const instrument=connectedInstruments(design,isEarth?'camera':'spectrometer')[0];if(instrument)loadPowerW+=(instrument.definition.activePowerW-instrument.definition.idlePowerW)/getBusDefinition(design).conversionEfficiency;}
 if(!hardware&&operation==='observe'&&!state.safeMode)loadPowerW+=instruments.reduce((s,p)=>s+PARTS[p.kind].activePowerW-PARTS[p.kind].idlePowerW,0);
 if(!hardware&&operation==='downlink'&&!state.safeMode)loadPowerW+=antennas.reduce((s,p)=>s+PARTS[p.kind].activePowerW-PARTS[p.kind].idlePowerW,0);
 const storedBits=state.dataPackets.reduce((s,p)=>s+Math.max(0,p.bits-p.receivedBits),0)+(state.hardwareData?.acquisition?.bits??0),receivedBits=state.dataPackets.reduce((s,p)=>s+p.receivedBits,0),transmittedBits=state.dataPackets.reduce((s,p)=>s+p.transmittedBits,0);
 const reason=state.status==='failed'?(state.blockedReason||'임무 중단'):state.safeMode?'배터리 회복을 위한 안전 모드':operation==='observe'?!instruments.length?'관측기가 없습니다.':cameraVisibility<.5?'관측기가 목표를 향하지 않거나 가려져 있습니다.':!targetVisible?'선택한 과학 지역의 시야·조명 조건을 충족하지 못합니다.':targetEvaluation&&!targetEvaluation.resolutionAcceptable?'지상 공간 해상도가 목표 기준을 충족하지 못합니다.':observationQuality<requirements.minimumQuality?'거리가 멀어 요구 품질을 충족하지 못합니다.':'유효한 고유 관측 자료 수집 중':operation==='downlink'?!antennas.length?'안테나가 없습니다.':!groundVisible?'천체 뒤편 / 지상국 비가시':antennaVisibility<.5?'안테나 지향 또는 가림 문제':!link.rateBps?'링크 여유가 부족합니다.':'자료를 지상으로 전송 중':eclipse?'일식: 배터리로 운영합니다.':'태양 지향 자세로 충전합니다.';
 const commandLinkReady=groundVisible&&antennaVisibility>.5&&link.rateBps>0&&state.energyWh>0&&!state.safeMode;
 const pendingCommands=(state.commands||[]).filter(c=>c.status==='queued'||c.status==='inflight').length;
 const commandStatus=state.commandOverride?`지상 명령 실행 중 · ${Math.max(0,state.commandOverride.endsAt-state.time).toFixed(0)} s 남음`:pendingCommands?`명령 ${pendingCommands}개 대기·전파 중`:'탑재된 일정 실행 중';
 const conjunction=conjunctionMetrics(design),debrisDistanceKm=conjunction.enabled?magnitude(sub(r,debrisStateAt(state.time).positionKm)):null,hazardStatus=conjunction.enabled?state.hazardPassageRecorded?conjunction.contact?'접촉 판정 · 임무 중단':conjunction.safe?'근접 통과 · 분리 기준 충족':'근접 통과 · 훈련 분리 기준 미달':`예상 최소 거리 ${conjunction.minDistanceKm.toFixed(2)} km · T+${conjunction.time.toFixed(1)} s`:null;
 const surfaceTargetPositionKm=idealTarget?groundPosition(idealTarget.observedPoint.latDeg,idealTarget.observedPoint.lonDeg,state.time):scale(normalize(r),radius);
 return {time:state.time,duration:mission.duration,...orbital,altitudeKm,speedKmS:magnitude(orbital.velocityKmS),eclipse,groundVisible,linkReady,linkRateBps:linkReady?link.rateBps:0,lightTimeS:distanceKm/C_KM_S,linkMarginDb:link.marginDb,solarPowerW:solar.powerW,loadPowerW,energyWh:state.energyWh,batteryWh:ev.batteryWh,storedBits,storageBits:ev.storageBits,receivedBits,transmittedBits,scienceReceived:state.scienceReceived,targetPackets:requirements.targetPackets,operation,observing,observationQuality,targetVisible,panelVisibility:solar.visibility,cameraVisibility,antennaVisibility,safeMode:state.safeMode,fuelKg:state.fuelKg,status:state.status,reason,attitude,bodyAxes:actualBodyAxes,requestedBodyAxes,slewing,slewAngleDeg,slewRemainingS,commandLinkReady,pendingCommands,commandStatus,chargeLimitW:ev.chargeLimitW,dischargeLimitW:ev.dischargeLimitW,curtailedPowerW:Math.max(0,solar.powerW-loadPowerW-ev.chargeLimitW),debrisDistanceKm,hazardStatus,targetEvaluation,surfaceTargetPositionKm,contactTargetPositionKm,contactDirection:earthDirection};
}
export function getAttitudeBasis(state:SimulationState){return getTelemetry(state).bodyAxes;}
export function queueCommand(state:SimulationState,kind:CommandKind,durationSeconds=600):GroundCommand{
 if(state.status!=='running')throw new Error('진행 중인 임무에만 새 명령을 보낼 수 있습니다.');
 if(!['charge','observe','downlink','resume'].includes(kind))throw new Error('지원하지 않는 명령입니다.');
 if(!Number.isFinite(durationSeconds)||durationSeconds<5||durationSeconds>7200)throw new Error('명령 지속 시간은 5~7,200초여야 합니다.');
 if(state.commands.length>=128)throw new Error('한 임무에서 명령은 최대 128개까지 보낼 수 있습니다.');
 const command:GroundCommand={id:`cmd-${state.commands.length+1}`,kind,requestedAt:state.time,durationSeconds:kind==='resume'?0:Math.round(durationSeconds/5)*5,status:'queued',sentAt:null,arrivesAt:null,executedAt:null,reason:'지상국에서 송신 가능한 자세와 교신창을 기다립니다.'};
 state.commands.push(command);event(state,'COMMAND_QUEUED',`${kind==='resume'?'탑재 일정 복귀':kind==='observe'?'관측':kind==='downlink'?'송신':'충전'} 명령을 지상 송신 큐에 추가했습니다.`);processCommands(state);return command;
}
function processCommands(state:SimulationState){
 if(state.commandOverride&&state.time>=state.commandOverride.endsAt){state.commandOverride=null;event(state,'COMMAND_FINISHED','지상 명령의 운용 구간 종료 · 탑재 일정을 재개합니다.');}
 for(const c of state.commands){
   if(c.status==='executed'||c.status==='failed')continue;
   const telemetry=getTelemetry(state);
   if(c.status==='queued'){
     if(telemetry.commandLinkReady){c.status='inflight';c.sentAt=state.time;c.arrivesAt=state.time+telemetry.lightTimeS;c.reason='전파가 탐사선으로 이동 중입니다.';event(state,'COMMAND_SENT',`${c.id} 송신 · 편도 지연 ${telemetry.lightTimeS.toFixed(1)} s`);}
     else c.reason=telemetry.safeMode?'안전 모드: 탑재 자율 복구를 기다립니다.':!telemetry.groundVisible?'지상국/행성 가림: 지상 큐에서 기다립니다.':'수신 안테나 지향·링크 조건이 맞지 않아 지상 큐에서 기다립니다.';
   }
   if(c.status==='inflight'&&c.arrivesAt!==null&&state.time>=c.arrivesAt){
     // An already-emitted signal cannot wait in space for the receiver to turn back.
     if(!telemetry.commandLinkReady){c.status='failed';c.reason='도착 시각의 가시성·지향·수신 전력 조건을 잃었습니다. 다시 보내야 합니다.';event(state,'COMMAND_LOST',`${c.id} 수신 실패 · 신호는 우주에서 대기하지 않습니다.`,'warning');continue;}
     c.status='executed';c.executedAt=state.time;c.reason='탐사선이 명령을 수신해 실행했습니다.';
     state.commandOverride=c.kind==='resume'?null:{kind:c.kind,endsAt:Math.min(MISSIONS[state.design.missionId].duration,state.time+c.durationSeconds),commandId:c.id};
     event(state,'COMMAND_EXECUTED',`${c.id} 수신 · ${c.kind==='resume'?'탑재 일정 복귀':c.kind==='charge'?'충전':c.kind==='observe'?'관측':'송신'} 실행`);
   }
 }
}
function step(state:SimulationState,dt:number){
 const mission=MISSIONS[state.design.missionId],requirements=getDesignRequirements(state.design),ev=evaluateDesign(state.design);let before=getTelemetry(state);const priorOp=before.operation;
 if(!state.safeMode&&before.loadPowerW-before.solarPowerW>ev.dischargeLimitW){state.safeMode=true;event(state,'DISCHARGE_LIMIT','요구 전력이 배터리 출력 한도를 넘어 안전 모드로 전환합니다.','warning');before=getTelemetry(state);}
 if(state.design.missionId==='earth'){
   const nodes=getManeuvers(state.design.plan);
   for(const node of nodes){if(node.time>state.time+dt||state.executedBurnIds.includes(node.id))continue;
     const deltaV=maneuverMagnitude(node),fuel=fuelForDeltaV(ev.dryMassKg+state.fuelKg,deltaV,getBusDefinition(state.design).ispS);
     if(fuel>state.fuelKg+1e-9){state.status='failed';state.blockedReason='기동 추진제가 부족합니다.';event(state,'FUEL',`${node.id} 기동 추진제가 부족해 경로를 실행하지 못했습니다.`,'error');return;}
     state.fuelKg=Math.max(0,state.fuelKg-fuel);state.executedBurnIds.push(node.id);
     if(deltaV>.01)state.events.push({time:node.time,code:'BURN',message:`${node.id} · 궤도 보정 ${deltaV.toFixed(1)} m/s · 추진제 ${fuel.toFixed(2)} kg`,severity:'info'});
   }
   state.burnExecuted=nodes.every(n=>state.executedBurnIds.includes(n.id));
 }
 const net=clamp(before.solarPowerW-before.loadPowerW,-ev.dischargeLimitW,ev.chargeLimitW),deltaWh=net*dt/3600*(net>=0?.92:1/.95);
 state.energyWh=clamp(state.energyWh+deltaWh,0,ev.batteryWh);state.energyMinimumWh=Math.min(state.energyMinimumWh,state.energyWh);
 const future=pointingGeometry(state.design,state.time+dt),goal=quaternionFromBasis(bodyBasis(future.targetDirection,SUN_DIRECTION,before.attitude,future.earthDirection));
 if(state.hardwareData){const turn=hardwareSlew(state.design,state.attitudeQuaternion||quaternionFromBasis(before.bodyAxes),goal,dt,state.hardwareData.angularRateDegS);state.attitudeQuaternion=turn.quaternion;state.hardwareData.angularRateDegS=turn.rateDegS;}else state.attitudeQuaternion=slewQuaternion(state.attitudeQuaternion||quaternionFromBasis(before.bodyAxes),goal,ATTITUDE_RATE_DEG_S*dt);
 state.time=Math.min(mission.duration,state.time+dt);state.tick++;
 if(!state.safeMode&&state.energyWh<ev.batteryWh*.04){state.safeMode=true;event(state,'SAFE_MODE','배터리 임계치: 과학 관측과 송신을 중단하고 태양을 향합니다.','warning');}
 if(state.safeMode&&state.energyWh>ev.batteryWh*.16){const recovery=getTelemetry({...state,safeMode:false});if(recovery.loadPowerW-recovery.solarPowerW<=ev.dischargeLimitW){state.safeMode=false;event(state,'RECOVERED','충전 회복: 예약된 임무를 재개합니다.');}}
 processCommands(state);
 const conjunction=conjunctionMetrics(state.design);
 if(conjunction.enabled&&!state.hazardForecastIssued&&state.time>=CONJUNCTION_FORECAST_TIME){state.hazardForecastIssued=true;state.events.push({time:CONJUNCTION_FORECAST_TIME,code:'CONJUNCTION_FORECAST',message:`교육용 추적 잔해 · 예상 최근접 T+${conjunction.time.toFixed(1)} s, 최소 거리 ${conjunction.minDistanceKm.toFixed(3)} km. 기준 2 km이며 충돌확률 수치가 아닙니다.`,severity:conjunction.safe?'info':'warning'});}
 if(conjunction.enabled&&!state.hazardPassageRecorded&&state.time>=conjunction.time){state.hazardPassageRecorded=true;state.events.push({time:conjunction.time,code:conjunction.contact?'DEBRIS_CONTACT':'CONJUNCTION_PASSAGE',message:conjunction.contact?'두 궤적의 분리 거리가 교육용 접촉 경계 20 m 미만입니다.':`잔해 근접 통과 · 최소 거리 ${conjunction.minDistanceKm.toFixed(3)} km · ${conjunction.safe?'훈련 분리 기준 충족':'2 km 훈련 분리 기준 미달, 자동 충돌 아님'}`,severity:conjunction.contact?'error':conjunction.safe?'info':'warning'});if(conjunction.contact){state.status='failed';state.blockedReason='교육용 궤도 잔해 접촉 판정으로 임무가 중단되었습니다.';return;}}
 const tele=getTelemetry(state);
 if(tele.altitudeKm<(state.design.missionId==='earth'?100:0)){state.status='failed';state.blockedReason='경로가 안전 표면을 침범했습니다.';event(state,'IMPACT',state.blockedReason,'error');return;}
 if(before.eclipse!==tele.eclipse)event(state,tele.eclipse?'ECLIPSE_ENTER':'ECLIPSE_EXIT',tele.eclipse?'행성 그림자 진입 · 태양발전 중지':'행성 그림자 이탈 · 태양발전 회복');
 if(priorOp!==tele.operation)event(state,'OPERATION',`${tele.operation==='observe'?'관측':tele.operation==='downlink'?'송신':'충전'} 자세로 전환`);
 if(state.hardwareData){
  const instrument=connectedInstruments(state.design,state.design.missionId==='earth'?'camera':'spectrometer')[0],tile=state.design.missionId==='earth'?tele.targetEvaluation!.cellId:`sector-${Math.floor((state.time-7000)/420)}`,id=`${state.design.missionId}:${tile}`,candidate={id,target:tile,quality:Math.min(before.observationQuality,tele.observationQuality),...(tele.targetEvaluation?{observedPoint:{...tele.targetEvaluation.observedPoint}}:{})};
  const eligible=before.observing&&tele.observing&&!state.dataPackets.some(p=>p.id===id)&&(!!state.hardwareData.acquisition||state.time-state.lastCapture>=90);
  const acquired=advanceAcquisition(state.hardwareData,instrument,dt,state.time,eligible,candidate,resolveHardware(state.design).dataWriteRateBps,ev.storageBits-tele.storedBits,!state.safeMode);
  if(acquired.completed){const a=acquired.completed;state.dataPackets.push({id:a.id,target:a.target,capturedAt:a.startedAt,readyAt:state.time,quality:a.quality,bits:a.bits,transmittedBits:0,receivedBits:0,receivedAt:null,kind:a.kind,...(a.observedPoint?{observedPoint:a.observedPoint}:{})});state.lastCapture=state.time;event(state,'CAPTURE','노출 및 데이터 버스 기록을 마친 새 과학 자료를 저장했습니다.');}
 }else if(tele.observing&&state.time-state.lastCapture>=90){
   const tile=state.design.missionId==='earth'?tele.targetEvaluation!.cellId:`sector-${Math.floor((state.time-7000)/420)}`;
   const id=`${state.design.missionId}:${tile}`;
   const bits=requirements.packetBits;
   if(!state.dataPackets.some(p=>p.id===id)){
     if(tele.storedBits+bits<=ev.storageBits){state.dataPackets.push({id,target:tile,capturedAt:state.time,quality:tele.observationQuality,bits,transmittedBits:0,receivedBits:0,receivedAt:null,kind:state.design.missionId==='earth'?'image':'spectrum',...(tele.targetEvaluation?{observedPoint:{...tele.targetEvaluation.observedPoint}}:{})});state.lastCapture=state.time;event(state,'CAPTURE',`고유 ${state.design.missionId==='earth'?'관측 사진':'분광 자료'} 확보 · 품질 ${Math.round(tele.observationQuality*100)}`);}
     else event(state,'STORAGE_FULL','기록장치 포화: 기존 자료를 보존하고 새 관측을 중단합니다.','warning');
   }
 }
 if(tele.linkReady){let budget=tele.linkRateBps*dt;for(const p of state.dataPackets){if(budget<=0)break;if(state.hardwareData&&(p.readyAt??p.capturedAt)>state.time-dt+1e-7)continue;const bits=Math.min(budget,p.bits-p.transmittedBits);if(bits>0){p.transmittedBits+=bits;budget-=bits;state.inFlight.push({packetId:p.id,bits,arrivesAt:state.time+tele.lightTimeS});}}}
 const keep:SimulationState['inFlight']=[];
 for(const transmission of state.inFlight){if(transmission.arrivesAt>state.time){keep.push(transmission);continue;}const p=state.dataPackets.find(p=>p.id===transmission.packetId);if(p){
   if(!tele.groundVisible){p.transmittedBits=Math.max(p.receivedBits,p.transmittedBits-transmission.bits);event(state,'LINK_RETRY','수신 시각의 가시성 조건을 잃어 미확인 자료를 다음 교신 때 재전송합니다.','warning');continue;}
   p.receivedBits=Math.min(p.bits,p.receivedBits+transmission.bits);if(p.receivedBits>=p.bits-.01&&p.receivedAt===null){p.receivedAt=state.time;if(p.quality>=requirements.minimumQuality){state.scienceReceived++;event(state,'RECEIVED',`지구 수신 완료 · 과학 자료 ${state.scienceReceived}/${requirements.targetPackets}`);}}}}
 state.inFlight=keep;
 if(state.time>=mission.duration){state.status='complete';event(state,'END','임무 기한 도달 · 수신 자료와 항법 성과를 평가합니다.');}
}
export function advanceSimulation(state:SimulationState,seconds:number):SimulationState {
 if(!Number.isFinite(seconds)||seconds<0)throw new Error('진행 시간은 0 이상의 유한한 초여야 합니다.');
 if(state.status!=='running')return state;
 state.remainder+=seconds;
 while(state.remainder+1e-9>=FIXED_STEP_S&&state.status==='running'){state.remainder-=FIXED_STEP_S;step(state,FIXED_STEP_S);}
 if(state.status!=='running')state.remainder=0;
 return state;
}
export function getResult(state:SimulationState):MissionResult{
 const mission=MISSIONS[state.design.missionId],requirements=getDesignRequirements(state.design),ev=evaluateDesign(state.design),scienceScore=60*clamp(state.scienceReceived/requirements.targetPackets,0,1);
 const conjunction=conjunctionMetrics(state.design),nav=state.design.missionId==='earth'?state.status!=='failed'&&(!conjunction.enabled||(conjunction.safe&&state.hazardPassageRecorded)):flybyMetrics(state.design.plan).safe&&flybyMetrics(state.design.plan).speedGainKmS>=1;
 const status=state.scienceReceived>=requirements.targetPackets&&nav&&ev.launchable?'success':state.scienceReceived>0?'partial':'failed';
 const missionScore=nav&&ev.launchable?25:0,resourceScore=15*(.4*clamp((mission.budget-ev.cost)/mission.budget,0,1)+.3*clamp(state.fuelKg/getBusDefinition(state.design).fuelKg,0,1)+.3*clamp(ev.batteryWh>0?state.energyMinimumWh/ev.batteryWh:0,0,1));
 const reasons:string[]=[],recommendations:string[]=[];
 if(state.scienceReceived<requirements.targetPackets){reasons.push(`유효 수신 자료 ${state.scienceReceived}/${requirements.targetPackets}개`);if(!ev.cameraCount)recommendations.push('임무에 맞는 과학 관측기를 -Z 면에 장착하세요.');if(!ev.antennaCount)recommendations.push('+Z 면에 지향성 안테나를 추가하세요.');if(state.dataPackets.length>state.scienceReceived)recommendations.push('관측 뒤 더 긴 송신 구간을 확보하고 지상국 교신창을 확인하세요.');else recommendations.push('관측기를 -Z 방향에 노출시키고 관측 회랑에 맞춰 작업 시간을 옮기세요.');}
 if(!nav){if(conjunction.enabled){reasons.push(state.hazardPassageRecorded?`잔해 분리 목표 미달: 최소 ${conjunction.minDistanceKm.toFixed(3)} km / 요구 2 km`:'잔해 근접 통과 이전의 중간 결과입니다.');recommendations.push('근접 통과보다 충분히 이른 작은 법선 기동을 만들고, 전체 궤적의 최소 거리를 다시 확인하세요.');}else{reasons.push('필수 항법·안전 조건 미충족');recommendations.push(state.design.missionId==='mars'?'최근접 250 km 이상, 접근 궤도면 각도 0° 부근에서 출구 속력 증가를 확인하세요.':'궤도 고도와 기동 크기를 줄여 안전한 경로를 확보하세요.');}}
 if(state.events.some(e=>e.code==='SAFE_MODE')){reasons.push('배터리 부족으로 임무가 중단된 구간이 있습니다.');recommendations.push('태양전지 위치, 배터리 용량, 충전 작업 구간을 조정하세요.');}
 if(!reasons.length)reasons.push('필수 과학 자료를 기한 내 지구로 전달하고 항법 조건을 충족했습니다.');
 if(state.blockedReason)reasons.push(state.blockedReason);
 return {modelVersion:state.modelVersion,scoreDefinitionId:M01_M02_SCORE_DEFINITION.id,simulationStatus:state.status,requirements:{targetPackets:requirements.targetPackets,minimumQuality:requirements.minimumQuality,deadlineSeconds:mission.duration},eventLogCoverage:state.events.length>=300?'truncated':'complete',evaluatedAt:state.time,status,title:status==='success'?'임무 성공':status==='partial'?'부분 성과 확보':'다음 설계를 위한 기록',scienceScore,missionScore,resourceScore,score:Math.round(scienceScore+missionScore+resourceScore),received:state.scienceReceived,required:requirements.targetPackets,reasons,recommendations:[...new Set(recommendations)],budgetRemaining:mission.budget-ev.cost,energyMinimumWh:state.energyMinimumWh,fuelRemainingKg:state.fuelKg,timeline:structuredClone(state.events),packets:structuredClone(state.dataPackets),design:structuredClone(state.design),commandHistory:structuredClone(state.commands),...(conjunction.enabled?{hazard:conjunction}:{})};
}
export function previewMission(design:Design):MissionPreview{
 const state=createSimulation(design),samples:Telemetry[]=[getTelemetry(state)];
 while(state.status==='running'){advanceSimulation(state,60);samples.push(getTelemetry(state));}
 return {finalState:state,result:getResult(state),samples};
}
