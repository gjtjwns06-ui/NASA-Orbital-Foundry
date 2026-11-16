import {afterEach,describe,expect,it} from 'vitest';
import {createDesign} from '../src/sim/catalog';
import {createSimulation} from '../src/sim/simulation';
import {setLanguage} from '../src/i18n';
import type {DataPacket} from '../src/sim/types';
import {scienceBytes,scienceEventIds,scienceEventsSince,scienceFlowHTML,scienceFlowSnapshot} from '../src/ui-science-flow';

afterEach(()=>setLanguage('ko'));
const packet=(id:string,patch:Partial<DataPacket>={}):DataPacket=>({id,target:'sector-1',capturedAt:500,quality:.9,bits:8000,transmittedBits:0,receivedBits:0,receivedAt:null,kind:'spectrum',...patch});
function state(){const s=createSimulation(createDesign('mars'));s.time=1000;s.tick=200;return s;}

describe('actual science data transport presentation',()=>{
  it('distinguishes queued, active FIFO transmission, real propagation and confirmed reception',()=>{
    const s=state();s.dataPackets=[packet('sending',{transmittedBits:4000,receivedBits:2000}),packet('waiting'),packet('flying',{transmittedBits:8000}),packet('done',{transmittedBits:8000,receivedBits:8000,receivedAt:900})];
    s.inFlight=[{packetId:'sending',bits:2000,arrivesAt:1100},{packetId:'flying',bits:8000,arrivesAt:1200}];
    const f=scienceFlowSnapshot(s,{linkReady:true});
    expect(f.packets.map(p=>p.status)).toEqual(['transmitting','stored','inflight','received']);
    expect(f.counts).toEqual({stored:1,transmitting:1,inflight:1,received:1});
    expect(f.receivedBits).toBe(10000);expect(f.inFlightBits).toBe(10000);
    // The spacecraft retains its transmitted copy until actual receipt.
    expect(f.onboardBits).toBe(22000);
    expect(f.packets[0].receivedFraction).toBe(.25);expect(f.packets[0].transmittedFraction).toBe(.5);
  });

  it('never treats a disconnected partial transfer or emitted bytes as a completed receipt',()=>{
    const s=state();s.dataPackets=[packet('partial',{transmittedBits:4000}),packet('emitted',{transmittedBits:8000}),packet('bad',{receivedBits:8000})];
    s.inFlight=[{packetId:'emitted',bits:8000,arrivesAt:1100}];
    const a=scienceFlowSnapshot(s,{linkReady:false});
    expect(a.packets.map(p=>p.status)).toEqual(['stored','inflight','stored']);expect(a.counts.received).toBe(0);
    s.status='complete';expect(scienceFlowSnapshot(s,{linkReady:true}).counts.transmitting).toBe(0);
    expect(scienceFlowSnapshot(s,{linkReady:true}).nextDelivery).toBeNull();
  });

  it('uses the real earliest signal arrival and the fixed processing boundary without promising whole-packet completion',()=>{
    const s=state();s.dataPackets=[packet('a')];s.inFlight=[{packetId:'a',bits:1000,arrivesAt:1112.3},{packetId:'a',bits:1000,arrivesAt:1100.1}];
    const f=scienceFlowSnapshot(s,{linkReady:false});
    expect(f.nextDelivery).toEqual({packetId:'a',bits:1000,arrivesAt:1100.1,processedAt:1105,seconds:105,beforeDeadline:true});
    setLanguage('en');const html=scienceFlowHTML(s,{linkReady:false});
    expect(html).toContain('Next signal chunk 125 B');expect(html).toContain('in about 105s');expect(html).toContain('arrival-visibility check');
    expect(html).not.toContain('All captured data has reached Earth');
    s.time=17990;s.inFlight=[{packetId:'a',bits:1000,arrivesAt:18000.5}];
    expect(scienceFlowHTML(s,{linkReady:false})).toContain('after the deadline');
  });

  it('caps the packet grid at twelve while retaining complete counters and escaping packet IDs',()=>{
    const s=state();s.dataPackets=Array.from({length:17},(_,i)=>packet(`p-${i}`));s.dataPackets[16].id='\"><img src=x onerror="alert(1)">';
    const original=JSON.stringify(s),html=scienceFlowHTML(s,{linkReady:false});
    expect((html.match(/class="science-packet"/g)||[])).toHaveLength(12);
    expect(html).toContain('data-total-packets="17"');expect(html).toContain('추가 5개');
    expect(html).toContain('&quot;&gt;&lt;img');expect(html).not.toContain('<img');
    expect(JSON.stringify(s)).toBe(original);
  });

  it('renders both languages directly and keeps received transport separate from science qualification',()=>{
    const s=state();s.dataPackets=[packet('low-quality',{quality:.01,receivedBits:8000,transmittedBits:8000,receivedAt:800})];s.scienceReceived=0;
    expect(scienceFlowHTML(s,{linkReady:false})).toContain('유효 수신 0/3');
    setLanguage('en');const html=scienceFlowHTML(s,{linkReady:false});expect(html).toContain('Valid science 0/3');expect(html).toContain('science-flow-count-received">1');expect(html).not.toMatch(/[가-힣]/);
    expect(scienceBytes(8000)).toBe('1.0 kB');expect(scienceBytes(8e6)).toBe('1.0 MB');
  });

  it('emits capture/receipt deltas once and does not celebrate loaded history again',()=>{
    const s=state(),previous=scienceEventIds(s);s.dataPackets.push(packet('a'));
    const captured=scienceEventsSince(previous,s);expect(captured.captured.map(p=>p.id)).toEqual(['a']);expect(captured.received).toEqual([]);
    s.dataPackets[0].receivedBits=4000;expect(scienceEventsSince(captured.ids,s).received).toEqual([]);
    s.dataPackets[0].receivedBits=8000;s.dataPackets[0].receivedAt=1100;
    const received=scienceEventsSince(captured.ids,s);expect(received.received.map(p=>p.id)).toEqual(['a']);expect(scienceEventsSince(received.ids,s).received).toEqual([]);
    const loaded=scienceEventsSince(null,s);expect(loaded.captured).toEqual([]);expect(loaded.received).toEqual([]);expect(loaded.ids.received).toEqual(['a']);
  });
});
