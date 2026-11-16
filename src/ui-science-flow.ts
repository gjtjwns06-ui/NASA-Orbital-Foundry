import type {DataPacket,SimulationState,Telemetry} from './sim/types';
import {FIXED_STEP_S,getDesignRequirements,getTelemetry} from './sim/simulation';
import {MISSIONS} from './sim/catalog';
import {getLanguage} from './i18n';
import './ui-science-flow.css';

export type SciencePacketStatus='stored'|'transmitting'|'inflight'|'received';
type LinkTelemetry=Pick<Telemetry,'linkReady'>;
export interface SciencePacketView {
  packet:DataPacket;index:number;status:SciencePacketStatus;
  totalBits:number;onboardBits:number;inFlightBits:number;receivedBits:number;
  transmittedFraction:number;receivedFraction:number;
}
export interface ScienceFlowSnapshot {
  packets:SciencePacketView[];
  counts:Record<SciencePacketStatus,number>;
  totalBits:number;onboardBits:number;inFlightBits:number;receivedBits:number;
  nextDelivery:null|{packetId:string;bits:number;arrivesAt:number;processedAt:number;seconds:number;beforeDeadline:boolean};
}
export interface ScienceEventIds {captured:readonly string[];received:readonly string[]}

const word=(ko:string,en:string)=>getLanguage()==='ko'?ko:en;
const finite=(n:number)=>Number.isFinite(n)?Math.max(0,n):0;
const clamp=(n:number,max:number)=>Math.min(finite(n),max);
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const complete=(p:DataPacket)=>p.receivedAt!==null&&Number.isFinite(p.receivedAt)&&p.receivedBits>=p.bits-.01;
const stamp=(seconds:number)=>{
  const s=Math.floor(finite(seconds));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};
/** Decimal bytes, consistent with the game's Mbps/MB resource display, never MiB. */
export function scienceBytes(bits:number):string {
  const bytes=finite(bits)/8;
  if(bytes>=1e6)return `${(bytes/1e6).toFixed(bytes>=100e6?0:1)} MB`;
  if(bytes>=1000)return `${(bytes/1000).toFixed(bytes>=100000?0:1)} kB`;
  return `${Math.round(bytes)} B`;
}

/**
 * Read-only transport state. A partial packet can have bytes onboard and in
 * propagation simultaneously. Its primary status gives the current useful
 * action: actual FIFO sender, propagating bytes, or waiting onboard.
 * A working link is required for `transmitting`; old transmittedBits alone
 * never makes a disconnected or completed run look like an active transmitter.
 */
export function scienceFlowSnapshot(state:SimulationState,telemetry:LinkTelemetry=getTelemetry(state)):ScienceFlowSnapshot {
  const counts:ScienceFlowSnapshot['counts']={stored:0,transmitting:0,inflight:0,received:0};
  const queued=new Map<string,number>(),known=new Map(state.dataPackets.map(p=>[p.id,p]));
  let next:SimulationState['inFlight'][number]|null=null;
  for(const transmission of state.inFlight){
    const p=known.get(transmission.packetId);
    if(!p||complete(p)||!Number.isFinite(transmission.arrivesAt)||!Number.isFinite(transmission.bits)||transmission.bits<=0)continue;
    queued.set(p.id,(queued.get(p.id)||0)+finite(transmission.bits));
    if(!next||transmission.arrivesAt<next.arrivesAt)next=transmission;
  }
  const active=state.status==='running'&&telemetry.linkReady
    ?state.dataPackets.find(p=>!complete(p)&&p.transmittedBits<p.bits-.01)?.id:null;
  const packets=state.dataPackets.map((packet,index):SciencePacketView=>{
    const totalBits=finite(packet.bits),receivedBits=clamp(packet.receivedBits,totalBits);
    const inFlightBits=clamp(queued.get(packet.id)||0,totalBits-receivedBits);
    // The simulation keeps a copy until receipt. Stored bytes and bytes in
    // propagation overlap; emission alone does not free the onboard recorder.
    const onboardBits=Math.max(0,totalBits-receivedBits);
    const status:SciencePacketStatus=complete(packet)?'received':packet.id===active?'transmitting':inFlightBits>0?'inflight':'stored';
    counts[status]++;
    return {packet,index,status,totalBits,onboardBits,inFlightBits,receivedBits,
      transmittedFraction:totalBits?clamp(packet.transmittedBits,totalBits)/totalBits:0,
      receivedFraction:totalBits?receivedBits/totalBits:0};
  });
  const sum=(field:'totalBits'|'onboardBits'|'inFlightBits'|'receivedBits')=>packets.reduce((n,p)=>n+p[field],0);
  // Signals are physically scheduled at arrivesAt but the engine processes the
  // next fixed 5 s boundary. This is an estimate, not guaranteed link reception.
  const processedAt=next?Math.max(state.time+FIXED_STEP_S,Math.ceil(next.arrivesAt/FIXED_STEP_S)*FIXED_STEP_S):0;
  return {packets,counts,totalBits:sum('totalBits'),onboardBits:sum('onboardBits'),inFlightBits:sum('inFlightBits'),receivedBits:sum('receivedBits'),
    nextDelivery:next&&state.status==='running'?{packetId:next.packetId,bits:next.bits,arrivesAt:next.arrivesAt,processedAt,seconds:Math.max(0,processedAt-state.time),beforeDeadline:processedAt<=MISSIONS[state.design.missionId].duration}:null};
}

const statusText=(status:SciencePacketStatus)=>({
  stored:word('송신 대기','Queued'),transmitting:word('송신 중','Sending'),
  inflight:word('전파 중','In transit'),received:word('수신 완료','Received')
})[status];
const marks:Record<SciencePacketStatus,string>={stored:'◇',transmitting:'↑',inflight:'↗',received:'✓'};

function nextDeliveryText(state:SimulationState,snapshot:ScienceFlowSnapshot):string {
  if(state.status!=='running')return word('임무 종료 · 표시된 수신 결과는 확정된 기록입니다.','Run ended · received data shown is the recorded result.');
  const next=snapshot.nextDelivery;
  if(next){
    if(!next.beforeDeadline)return word(`다음 신호 조각 도착은 기한 뒤 T+${stamp(next.processedAt)} 예상 · 이번 임무에서 수신 확정되지 않습니다.`,`Next signal chunk expected after the deadline at T+${stamp(next.processedAt)} · it cannot be confirmed in this run.`);
    return word(`다음 신호 조각 ${scienceBytes(next.bits)} · T+${stamp(next.processedAt)}, 약 ${Math.ceil(next.seconds)}초 뒤 수신 처리 예상.`,`Next signal chunk ${scienceBytes(next.bits)} · reception processing expected at T+${stamp(next.processedAt)}, in about ${Math.ceil(next.seconds)}s.`);
  }
  if(!snapshot.packets.length)return word('아직 확보한 자료가 없습니다. 유효한 관측이 시작되면 여기에 나타납니다.','No captured data yet. Valid observations will appear here.');
  if(snapshot.counts.received===snapshot.packets.length)return word('확보한 자료가 모두 지구에 도착했습니다.','All captured data has reached Earth.');
  if(snapshot.counts.transmitting)return word('교신 연결됨 · 다음 계산 틱에서 남은 자료를 전송합니다.','Link active · remaining data is sent on the next simulation tick.');
  return word('미수신 자료 보관 중 · 송신 일정과 실제 교신 조건을 기다립니다.','Data remains onboard · awaiting a downlink and a usable contact.');
}

/**
 * Root can replace #science-flow with this HTML at its telemetry cadence.
 * Pass existing telemetry as the optional second argument to avoid recomputation.
 * Data attributes retain escaped packet IDs; the visible short labels are only
 * capture-order indices. No terrain image is represented as a received photo.
 */
export function scienceFlowHTML(state:SimulationState,telemetry?:LinkTelemetry):string {
  const s=scienceFlowSnapshot(state,telemetry),requirements=getDesignRequirements(state.design);
  const priority:Record<SciencePacketStatus,number>={transmitting:0,inflight:1,stored:2,received:3};
  const shown=[...s.packets].sort((a,b)=>priority[a.status]-priority[b.status]||b.index-a.index).slice(0,12);
  const cards=shown.map(p=>{
    const noun=p.packet.kind==='spectrum'?word('분광','Spectrum'):word('관측','Observation');
    const detail=`${noun} ${p.index+1} · ${statusText(p.status)} · ${word('기체','Onboard')} ${scienceBytes(p.onboardBits)} · ${word('전파','In transit')} ${scienceBytes(p.inFlightBits)} · ${word('수신','Received')} ${scienceBytes(p.receivedBits)} / ${scienceBytes(p.totalBits)} · ${word('관측','Captured')} T+${stamp(p.packet.capturedAt)}${p.packet.receivedAt!==null?` · ${word('수신','Received')} T+${stamp(p.packet.receivedAt)}`:''}`;
    return `<div class="science-packet" data-packet-id="${esc(p.packet.id)}" data-status="${p.status}" data-captured-at="${finite(p.packet.capturedAt)}" data-received-at="${p.packet.receivedAt===null?'':finite(p.packet.receivedAt)}" title="${esc(detail)}" aria-label="${esc(detail)}"><span class="science-packet-mark" aria-hidden="true">${marks[p.status]}</span><strong>${String(p.index+1).padStart(2,'0')}</strong><small>${statusText(p.status)}</small><span class="science-packet-progress" aria-hidden="true"><i class="science-packet-sent" style="width:${(p.transmittedFraction*100).toFixed(2)}%"></i><i class="science-packet-received" style="width:${(p.receivedFraction*100).toFixed(2)}%"></i></span></div>`;
  }).join('');
  return `<section id="science-flow" class="science-flow" data-total-packets="${s.packets.length}" data-running="${state.status==='running'}" aria-label="${word('과학 자료 전달 과정','Science data journey')}"><div class="science-flow-heading"><strong>${word('자료가 지구에 도착하기까지','From observation to Earth')}</strong><span id="science-flow-valid">${word('유효 수신','Valid science')} ${state.scienceReceived}/${requirements.targetPackets}</span></div><div class="science-flow-stages" aria-label="${word('자료 상태별 개수','Packet counts by status')}">${(['stored','transmitting','inflight','received'] as const).map(status=>`<div data-science-stage="${status}"><span aria-hidden="true">${marks[status]}</span><strong id="science-flow-count-${status}">${s.counts[status]}</strong><small>${statusText(status)}</small></div>`).join('')}</div><div id="science-flow-packets" class="science-flow-packets">${cards}</div>${s.packets.length>12?`<p class="science-flow-overflow">${word(`추가 ${s.packets.length-12}개 · 위 합계에 모두 포함`,`+${s.packets.length-12} more · all included in totals`)}</p>`:''}<div class="science-flow-bytes"><span id="science-flow-onboard">${word('기체','Onboard')} ${scienceBytes(s.onboardBits)}</span><span id="science-flow-inflight">${word('전파','Transit')} ${scienceBytes(s.inFlightBits)}</span><span id="science-flow-received">${word('지구','Earth')} ${scienceBytes(s.receivedBits)}</span></div><p id="science-flow-next" class="science-flow-next" data-next-arrival="${s.nextDelivery?.processedAt??''}">${nextDeliveryText(state,s)}</p>${s.nextDelivery?`<p class="science-flow-footnote">${word('신호 조각의 예상 시각입니다. 5초 틱·도착 시 가시성 판정 뒤에만 수신 확정됩니다.','Signal-chunk estimate. Reception is confirmed only after the 5s tick and arrival-visibility check.')}</p>`:''}</section>`;
}

/** Snapshot when launching/loading: do not celebrate historic receipt again. */
export function scienceEventIds(state:SimulationState):ScienceEventIds {
  return {captured:state.dataPackets.map(p=>p.id),received:state.dataPackets.filter(complete).map(p=>p.id)};
}
/** Pure deltas; `null` initializes without replaying a loaded history as new events. */
export function scienceEventsSince(previous:ScienceEventIds|null,current:SimulationState):{captured:DataPacket[];received:DataPacket[];ids:ScienceEventIds} {
  const ids=scienceEventIds(current);
  if(!previous)return {captured:[],received:[],ids};
  const captured=new Set(previous.captured),received=new Set(previous.received);
  return {captured:current.dataPackets.filter(p=>!captured.has(p.id)),received:current.dataPackets.filter(p=>complete(p)&&!received.has(p.id)),ids};
}
