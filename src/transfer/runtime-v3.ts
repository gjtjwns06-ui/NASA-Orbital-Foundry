import {advanceFlightData} from '../flight/data';
import {flightTelemetry,resources,requestedAxes,usedStorage,energyRate,runtimeSlew} from '../flight/resources';
import type {TransferTelemetry} from '../flight/resources';
import {advanceAcquisition,connectedInstruments,getBusDefinition,getPartDefinition,hardwareLink,hardwareLoadPower,hardwareSafePower,hardwareSlew,HARDWARE_TRANSFER_MODEL_VERSION,isHardwareDesign,resolveHardware} from '../hardware';
import {BUS,PARTS} from '../sim/catalog';
import {bodyBasis,evaluateDesign,partVisibility,solarGeneration} from '../sim/assembly';
import {ATTITUDE_RATE_DEG_S,quaternionAngleDeg,quaternionFromBasis,quaternionToBasis,slewQuaternion} from '../sim/attitude';
import {cross,dot,magnitude,normalize,scale,sub} from '../sim/physics';
import type {Design,Quaternion,Vec3} from '../sim/types';
import {TRANSFER_MODEL_VERSION,evaluateEscapeStage,transferCraftDesign} from './planning';
import {transferEnvironmentAt} from './state';
import type {FullTransferSolution,TransferEnvironment,TransferOperationKind} from './types';
import type {OperationsRuntimeState,OperationsRuntimeOptions,OperationsSnapshot} from './operations-types';
import {OPERATIONS_MODEL_VERSION} from './operations-types';
import {COMMAND_NETWORK as N,COMMAND_NETWORK_ID,COMMAND_NETWORK_HASH} from './command-network';
import {initialOperationsState,evaluateCommandCompatibility,getTransferOperationsSnapshot} from './operations';
import {createTransferRuntime as createReleasedRuntime} from './runtime';
import {emittingAcknowledgement,pendingAcknowledgement,transportActive,groundEmissionReady,processTransportBoundaries,transportNextBoundary,integrateCommandTransport} from './command-transport';
import {OperationsError} from './operations-codes';
import {freezeTransferInput} from './immutable';
export const TRANSFER_SCIENCE_REQUIREMENTS=Object.freeze({targetPackets:3,minimumQuality:.4,packetBits:24e6,maximumAltitudeKm:12000,minimumCaptureIntervalSeconds:120,uniqueBinSeconds:300});
export type {TransferTelemetry} from '../flight/resources';
export interface TransferResult {status:'success'|'partial'|'failed';score:number;received:number;required:number;reasons:string[];elapsedSeconds:number;energyMinimumWh:number;fuelRemainingKg:number;totalCost:number;budgetRemaining:number;packets:OperationsRuntimeState['packets'];events:OperationsRuntimeState['events']}
const activeMode=(state:OperationsRuntimeState,time=state.time):TransferOperationKind=>state.safeMode?'charge':state.operations.onboardOperations.find(op=>time>=op.start&&time<op.end)?.kind??'charge';
function event(state:OperationsRuntimeState,code:string,message:string,severity:'info'|'warning'|'error'='info'){state.events.push({time:state.time,code,message,severity});}
function telemetry(state:OperationsRuntimeState,time:number,q:Quaternion,environment?:TransferEnvironment,full=false):TransferTelemetry {const operation=activeMode(state,time),env=environment??transferEnvironmentAt(state.solution,time,full||operation==='downlink');return flightTelemetry(state,time,q,env,{operation,duration:state.solution.durationSeconds,radio:radioPowerState(state,operation,time)},full);}
export function getOperationsTelemetry(state:OperationsRuntimeState):TransferTelemetry&{commandUplinkActive:boolean;ackDownlinkActive:boolean;operations:OperationsSnapshot}{return {...telemetry(state,state.time,state.attitudeQuaternion,undefined,true),commandUplinkActive:state.operations.commands.some(c=>c.attempts.some(a=>a.status==='emitting')),ackDownlinkActive:!!emittingAcknowledgement(state),operations:getTransferOperationsSnapshot(state)};}
export function createOperationsRuntime(solution:FullTransferSolution,craft:Design,options:OperationsRuntimeOptions={}):OperationsRuntimeState {
 const integrationStepSeconds=options.integrationStepSeconds??600,activeStepSeconds=options.activeStepSeconds??1;if(![300,600].includes(integrationStepSeconds)||![1,.5,.25].includes(activeStepSeconds))throw new OperationsError('INVALID_INPUT','Unsupported numerical profile.');
 const seed=createReleasedRuntime(solution,craft,integrationStepSeconds),issues=evaluateCommandCompatibility(seed.craft),state:OperationsRuntimeState={...seed,modelVersion:OPERATIONS_MODEL_VERSION,scenarioId:options.scenarioId??'custom-operations',commandNetworkId:COMMAND_NETWORK_ID,commandNetworkHash:COMMAND_NETWORK_HASH,numerics:{cruiseStepSeconds:integrationStepSeconds,activeStepSeconds},operations:initialOperationsState(solution.plan.operations)};
 if(issues.length){state.status='failed';state.failureReason=issues.map(i=>i.message).join(' ');state.events=state.events.filter(e=>e.code!=='ESCAPE_BURN');event(state,'LAUNCH_BLOCKED',state.failureReason,'error');}if(state.status==='running')updatePowerMode(state,telemetry(state,0,state.attitudeQuaternion));return state;
}
function radioPowerState(state:OperationsRuntimeState,operation:TransferOperationKind,time:number){const receiverPowered=!state.safeMode&&state.status!=='failed',transmit=receiverPowered&&operation==='downlink'&&(!!pendingAcknowledgement(state)||state.packets.some(p=>(p.readyAt??p.capturedAt)<=time&&p.transmittedBits<p.bits));return {receiverPowered,mode:!receiverPowered?'off' as const:transmit?'rx-tx' as const:'rx' as const,powerW:!receiverPowered?0:transmit?N.irisSimultaneousPowerW:N.irisRxPowerW};}
function transportTelemetry(state:OperationsRuntimeState,t=telemetry(state,state.time,state.attitudeQuaternion)){return {linkReady:t.linkReady,linkRateBps:t.linkRateBps,stationId:t.environment.groundStationId,receiverPowered:t.receiverPowered,transmitterPowered:t.radioMode==='tx'||t.radioMode==='rx-tx'};}
export function settleOperationsBoundary(state:OperationsRuntimeState){
 updatePowerMode(state,telemetry(state,state.time,state.attitudeQuaternion));
 processTransportBoundaries(state,transportTelemetry(state),'receive');
 updatePowerMode(state,telemetry(state,state.time,state.attitudeQuaternion));
 processTransportBoundaries(state,transportTelemetry(state),'emit');
}
function processArrivalsAndEvents(state:OperationsRuntimeState){
 for(const signal of state.signals.filter(s=>s.arrivesAt<=state.time+1e-6)){const packet=state.packets.find(p=>p.id===signal.packetId);if(packet){packet.receivedBits=Math.min(packet.bits,packet.receivedBits+signal.bits);if(packet.receivedBits>=packet.bits-1e-6&&packet.receivedAt===null){packet.receivedAt=signal.arrivesAt;event(state,'DATA_RECEIVED','고유 분광 자료가 지구에 완전히 수신되었습니다.');}}}
 state.signals=state.signals.filter(s=>s.arrivesAt>state.time+1e-6);state.scienceReceived=state.packets.filter(p=>p.receivedAt!==null&&p.quality>=TRANSFER_SCIENCE_REQUIREMENTS.minimumQuality).length;
 for(const e of state.solution.phaseEvents){if(e.elapsedSeconds<=state.time+1e-6&&!state.processedEventIds.includes(e.id)){state.processedEventIds.push(e.id);event(state,e.id.toUpperCase().replaceAll('-','_'),e.id==='earth-exit'?'지구 중력 구간을 떠나 태양 중심 순항으로 전환했습니다.':e.id==='mars-entry'?'같은 위치·속도로 화성 조우 구간에 진입했습니다.':e.id==='periapsis'?'계획한 실제 최근접점을 통과했습니다.':'화성 영향권 경계에 도착했습니다.');}}
 if(state.time>=state.solution.durationSeconds-1e-6){state.time=state.solution.durationSeconds;if(state.status==='running')state.status='complete';}
}
function updatePowerMode(state:OperationsRuntimeState,t:TransferTelemetry){
 const ev=resources(state.craft);
 if(!state.safeMode&&(state.energyWh<=ev.batteryWh*.04+1e-8||t.loadPowerW-t.solarPowerW>ev.dischargeLimitW)){state.safeMode=true;event(state,'SAFE_MODE','배터리 잔량 또는 EPS 방전 한도로 안전 모드에 진입했습니다.','warning');}
 else if(state.safeMode&&state.energyWh>=ev.batteryWh*.16-1e-8){const prospective={...state,safeMode:false},next=telemetry(prospective,state.time,state.attitudeQuaternion,t.environment);if(next.loadPowerW-next.solarPowerW<=ev.dischargeLimitW){state.safeMode=false;event(state,'RECOVERED','충전 후 탑재 일정으로 복귀했습니다.');}}
}
function canonicalNextTime(state:OperationsRuntimeState):number {
 const env=transferEnvironmentAt(state.solution,state.time,false),nearEncounter=Math.abs(state.time-state.solution.periapsisSeconds)<9000,nearDeparture=state.time<3600;
 const step=nearEncounter||nearDeparture?5:env.state.phase==='earth-escape'?60:state.integrationStepSeconds;
 let next=Math.min(state.solution.durationSeconds,(Math.floor((state.time+1e-7)/step)+1)*step);
 if(activeMode(state)==='downlink'||state.pendingFrames.length)next=Math.min(next,(Math.floor((state.time+1e-7)/60)+1)*60);
 for(const e of state.solution.phaseEvents)if(e.elapsedSeconds>state.time+1e-7)next=Math.min(next,e.elapsedSeconds);
 for(const op of state.operations.onboardOperations)for(const boundary of [op.start,op.end])if(boundary>state.time+1e-7)next=Math.min(next,boundary);
 for(const signal of state.signals)if(signal.arrivesAt>state.time+1e-7)next=Math.min(next,signal.arrivesAt);
 for(const boundary of [state.solution.periapsisSeconds-9000,state.solution.periapsisSeconds+9000,3600])if(boundary>state.time+1e-7)next=Math.min(next,boundary);
 const target=quaternionFromBasis(requestedAxes(env,activeMode(state))),angle=quaternionAngleDeg(state.attitudeQuaternion,target);if(angle>.25||transportActive(state)||groundEmissionReady(state))next=Math.min(next,(Math.floor((state.time+1e-7)/state.numerics.activeStepSeconds)+1)*state.numerics.activeStepSeconds);
 next=transportNextBoundary(state,next);
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
function stepRuntime(state:OperationsRuntimeState,end:number){
 const start=state.time,startQ=[...state.attitudeQuaternion] as Quaternion,dt=end-start,mid=start+dt/2,operation=activeMode(state,start),env=transferEnvironmentAt(state.solution,mid,operation==='downlink'),midTurn=runtimeSlew(state,state.attitudeQuaternion,quaternionFromBasis(requestedAxes(env,operation)),dt/2),midQ=midTurn.quaternion,t=telemetry(state,mid,midQ,env),ev=resources(state.craft);
 // Stored battery energy is integrated in Wh; surplus charge above EPS limit is curtailed.
 state.energyWh=Math.max(0,Math.min(ev.batteryWh,state.energyWh+energyRate(t)*dt/3600));state.energyMinimumWh=Math.min(state.energyMinimumWh,state.energyWh);
 const endEnv=transferEnvironmentAt(state.solution,end,operation==='downlink');const endTurn=runtimeSlew(state,midQ,quaternionFromBasis(requestedAxes(endEnv,operation)),dt/2,midTurn.rateDegS);state.attitudeQuaternion=endTurn.quaternion;if(state.hardwareData)state.hardwareData.angularRateDegS=endTurn.rateDegS;state.time=end;state.tick++;
 const reservedAckSeconds=integrateCommandTransport(state,{start,end,startQ,midQ,endQ:state.attitudeQuaternion,receiverPowered:t.receiverPowered,transmitterPowered:t.radioMode==='tx'||t.radioMode==='rx-tx'});
 updatePowerMode(state,telemetry(state,end,state.attitudeQuaternion,endEnv));
 if(state.energyWh<=1e-8&&t.solarPowerW<(state.hardwareData?hardwareSafePower(state.craft,true):7)){state.status='failed';state.failureReason='배터리가 소진되어 버스 최소 생존 전력도 유지하지 못했습니다.';event(state,'POWER_LOSS',state.failureReason,'error');}
 const current=telemetry(state,end,state.attitudeQuaternion,endEnv);
 advanceFlightData(state,start,end,t,current,state.solution.periapsisSeconds,reservedAckSeconds);
 // Fixed 60 s RF packetization prevents arrival events from recursively creating
 // finer transmission frames. Batching conservatively delays receipt by ≤60 s.
 if(state.pendingFrames.length&&(Math.abs(end/60-Math.round(end/60))<1e-8||activeMode(state,end)!==operation||end>=state.solution.durationSeconds-1e-6)){const network=endEnv.groundStationId?endEnv:transferEnvironmentAt(state.solution,end);for(const frame of state.pendingFrames)state.signals.push({id:`signal-${state.tick}-${frame.packetId}`,packetId:frame.packetId,bits:frame.bits,sentAt:end,arrivesAt:end+network.lightTimeSeconds,stationId:network.groundStationId||'network'});state.pendingFrames=[];}
 processArrivalsAndEvents(state);
 settleOperationsBoundary(state);
}
/** Accumulates requested time; only complete canonical/event intervals are committed.
 * Small frame requests cannot change the physical integration partition. maxSteps
 * lets a worker yield; call again with zero elapsed to drain remaining requested time.
 */
export function advanceOperations(state:OperationsRuntimeState,elapsedSeconds:number,maxSteps=Infinity):OperationsRuntimeState {
 if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw new Error('경과 시간은 음수가 아닌 유한값이어야 합니다.');
 if(maxSteps!==Infinity&&(!Number.isInteger(maxSteps)||maxSteps<0))throw new Error('작업 청크는 0 이상의 정수여야 합니다.');
 state.requestedTime=Math.min(state.solution.durationSeconds,state.requestedTime+elapsedSeconds);let steps=0;
 while(state.status==='running'&&state.time<state.requestedTime-1e-7&&steps<maxSteps){let next=canonicalNextTime(state);if(next>state.requestedTime+1e-7)break;if(groundEmissionReady(state)){processTransportBoundaries(state,transportTelemetry(state));next=canonicalNextTime(state);if(next>state.requestedTime+1e-7)throw new OperationsError('INVALID_INPUT','Transport changed the already-committable interval.');}stepRuntime(state,next);steps++;}
 return state;
}
export function getOperationsResult(state:OperationsRuntimeState):TransferResult {
 const launch=evaluateEscapeStage(state.solution,state.craft),required=TRANSFER_SCIENCE_REQUIREMENTS.targetPackets,received=state.scienceReceived,status=state.status==='complete'&&received>=required?'success':received>0&&state.status!=='failed'?'partial':'failed',reasons:string[]=[];
 if(state.failureReason)reasons.push(state.failureReason);if(received<required)reasons.push(`지구에 완전히 수신된 고유 분광 자료 ${received}/${required}개`);if(state.status!=='complete')reasons.push('화성 영향권 이탈까지 임무가 아직 완료되지 않았습니다.');if(state.packets.length===0)reasons.push('조명·거리·장비 방향·운영 일정의 관측 조건을 확인하세요.');if(state.packets.length>received)reasons.push('선상 기록과 송신 중 자료는 완전 수신 전까지 과학 성과에 포함되지 않습니다.');
 const science=Math.min(1,received/required)*70,completion=state.status==='complete'?20:0,efficiency=Math.max(0,Math.min(1,(launch.budget-launch.totalCost)/launch.budget))*10;
 return {status,score:Math.round(science+completion+efficiency),received,required,reasons,elapsedSeconds:state.time,energyMinimumWh:state.energyMinimumWh,fuelRemainingKg:state.fuelKg,totalCost:launch.totalCost,budgetRemaining:launch.budget-launch.totalCost,packets:structuredClone(state.packets),events:structuredClone(state.events)};
}
export function previewOperations(solution:FullTransferSolution,craft:Design,options:OperationsRuntimeOptions={}){const state=createOperationsRuntime(solution,craft,options);advanceOperations(state,solution.durationSeconds);return {state,result:getOperationsResult(state)};}
