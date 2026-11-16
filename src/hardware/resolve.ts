import {BUS,PARTS} from '../sim/catalog';
import type {Design,Part,PartKind,LegacyPartKind,Vec3,Face,OperationKind} from '../sim/types';
import {add,scale,dot,cross,magnitude,normalize} from '../sim/physics';
import {HARDWARE_VERSION,HARDWARE_CATALOG_HASH,HARDWARE_MODELS,BUSES} from './catalog';
import type {HardwareModel,BusDefinition,GeometryProfile,ResolvedHardware,ResolvedPart,Connection,HardwareIssue,HardwareDesign,LocalBox} from './types';
export function isHardwareDesign(design:Design):design is HardwareDesign{return design.hardwareVersion===HARDWARE_VERSION;}
const legacyBus:BusDefinition={...BUS,id:'legacy-35-v1',name:'기존 탐사선 버스',nameEn:'Legacy spacecraft bus',description:'Model1.3.0 original bus',bay:{min:[-.6,.18,-.6],max:[.6,.75,.6],mountY:.22},rails:[],dataPorts:[],totalPowerW:Infinity,mpptGroups:Infinity,solarLimitW:Infinity,conversionEfficiency:1};
export function getBusDefinition(design:Design):BusDefinition {if(!isHardwareDesign(design))return legacyBus;const bus=BUSES[design.busId];if(!bus)throw new Error('알 수 없는 하드웨어 버스입니다.');return bus;}
const base:LocalBox={center:[0,0,.038],half:[.1,.1,.038]};
// Exact legacy collision proxies retained; this compatibility view does not mutate PARTS.
function legacyBoxes(kind:PartKind):LocalBox[]{switch(kind){case 'solar':return [base,{center:[0,0,.2],half:[.065,.065,.16]},{center:[0,0,.4],half:[.49,.61,.035]}];case 'solarLarge':return [base,{center:[0,0,.2],half:[.065,.065,.16]},{center:[0,0,.4],half:[.71,.935,.035]}];case 'antenna':return [base,{center:[0,0,.18],half:[.07,.07,.14]},{center:[0,0,.46],half:[.52,.52,.16]},{center:[0,0,.93],half:[.06,.06,.09]}];case 'camera':return [base,{center:[0,0,.29],half:[.20,.20,.31]}];case 'spectrometer':return [base,{center:[0,0,.29],half:[.20,.20,.31]},{center:[.27,0,.18],half:[.09,.135,.145]}];case 'engine':return [base,{center:[0,0,.39],half:[.27,.27,.36]}];case 'battery':return [base,{center:[0,0,.19],half:[.21,.165,.15]}];case 'storage':return [base,{center:[0,0,.14],half:[.175,.14,.14]}];case 'radiator':return [base,{center:[0,0,.12],half:[.31,.415,.075]}];default:throw new Error('기존 모델에 없는 부품입니다.');}}
const legacyModels=new Map<string,HardwareModel>();
export function getPartDefinition(design:Design,part:Part):HardwareModel {
 if(isHardwareDesign(design)){const d=part.modelId?HARDWARE_MODELS[part.modelId]:undefined;if(!d||d.kind!==part.kind)throw new Error('장비 모델 ID와 종류가 일치하지 않습니다.');return d;}
 const d=PARTS[part.kind as LegacyPartKind];if(!d)throw new Error('기존 모델에 없는 부품입니다.');let resolved=legacyModels.get(part.kind);if(resolved)return resolved;
 const a=part.kind==='solar'?[.91,1.15,.445]:part.kind==='solarLarge'?[1.35,1.8,.445]:part.kind==='antenna'?[.5,.5,1.035]:part.kind==='camera'||part.kind==='spectrometer'?[.28,.28,.61]:[.2,.2,d.depth+.01];
 const deployedBoxes=legacyBoxes(part.kind),stowedBoxes=part.kind==='solar'?[base,{center:[0,0,.105] as Vec3,half:[.165,.104,.025] as Vec3}]:part.kind==='solarLarge'?[base,{center:[0,0,.13] as Vec3,half:[.165,.104,.05] as Vec3}]:part.kind==='antenna'?[base,{center:[0,0,.18] as Vec3,half:[.28,.28,.14] as Vec3}]:deployedBoxes;
 const geometry:GeometryProfile={id:`legacy-${part.kind}`,mountFootprint:d.footprint,deployedBoxes,stowedBoxes,apertures:[{center:[0,0,a[2]],width:a[0],height:a[1],normal:[0,0,1]}],render:{family:part.kind,size:[d.footprint[0],d.footprint[1],d.depth],variant:'legacy'}};
 resolved={...d,modelId:`legacy:${part.kind}:1.3.0`,geometry,evidence:[]};legacyModels.set(part.kind,resolved);return resolved;
}
export const getPartGeometry=(design:Design,part:Part)=>getPartDefinition(design,part).geometry;
const normals:Record<Face,{n:Vec3;u:Vec3;v:Vec3;axis:0|1|2}>={px:{n:[1,0,0],u:[0,0,-1],v:[0,1,0],axis:0},nx:{n:[-1,0,0],u:[0,0,1],v:[0,1,0],axis:0},py:{n:[0,1,0],u:[1,0,0],v:[0,0,-1],axis:1},ny:{n:[0,-1,0],u:[1,0,0],v:[0,0,1],axis:1},pz:{n:[0,0,1],u:[1,0,0],v:[0,1,0],axis:2},nz:{n:[0,0,-1],u:[-1,0,0],v:[0,1,0],axis:2}};
export function partTransformFor(design:Design,part:Part){const b=normals[part.face],bus=getBusDefinition(design),d=getPartDefinition(design,part),a=part.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),mount=d.internal&&part.face==='py'?bus.bay.mountY:bus.halfSize[b.axis]+.012;return {position:add(scale(b.n,mount),add(scale(b.u,part.u),scale(b.v,part.v))),normal:[...b.n] as Vec3,tangentU:add(scale(b.u,c),scale(b.v,s)),tangentV:add(scale(b.v,c),scale(b.u,-s))};}
function powerFor(d:HardwareModel,mode:OperationKind,slewing=true){if(d.adcs)return slewing?d.adcs.slewPowerW:d.idlePowerW;return mode==='observe'&&d.optics||mode==='downlink'&&d.radio?d.activePowerW:d.idlePowerW;}
const cache=new WeakMap<Design,{signature:string;value:ResolvedHardware}>();
const physicalKey=(p:Part)=>JSON.stringify([p.modelId,p.kind,p.face,p.u,p.v,((p.rotation%360)+360)%360]);
const physicalOrder=(a:ResolvedPart,b:ResolvedPart)=>physicalKey(a.part).localeCompare(physicalKey(b.part))||a.part.id.localeCompare(b.part.id);
export function resolveHardware(design:Design):ResolvedHardware {
 const cached=cache.get(design);if(cached&&Object.isFrozen(design)&&Object.isFrozen(design.parts)&&design.parts.every(Object.isFrozen))return cached.value;const signature=JSON.stringify(design);if(cached?.signature===signature)return cached.value;
 const bus=getBusDefinition(design),parts:ResolvedPart[]=design.parts.map(part=>({part,definition:getPartDefinition(design,part),powered:true,dataConnected:true,dataRateBps:Infinity})),connections:Connection[]=[],issues:HardwareIssue[]=[];
 const issue=(code:string,message:string,partId?:string,required?:number|string,available?:number|string)=>issues.push({code,severity:'error',message,partId,required,available});
 const rails=new Map<string,string>();
 if(isHardwareDesign(design)){
  if(parts.filter(p=>p.definition.optics).length>1)issue('INSTRUMENT_COUNT','이 하드웨어 프로필은 과학 관측기를 하나만 지원합니다. 여러 센서의 성능을 합칠 수 없습니다.');
  if(parts.length>20)issue('PART_LIMIT','하드웨어 설계는 최대 20개 부품을 지원합니다.',undefined,parts.length,20);
  for(const p of parts){const e=p.definition.electrical;if(e){const matches=bus.rails.filter(r=>r.minimumV>=e.minimumV&&r.maximumV<=e.maximumV),rail=matches.find(r=>r.maxPowerW>=e.peakW);if(!rail){p.powered=false;issue(matches.length?'POWER_PORT_LIMIT':'POWER_VOLTAGE',`${p.definition.name}: 호환 전압 또는 최대 전력의 출력 포트가 없습니다.`,p.part.id,e.peakW,matches[0]?.maxPowerW??0);}else{rails.set(p.part.id,rail.id);connections.push({partId:p.part.id,type:'power',endpoint:rail.id,voltageV:rail.voltageV});}}}
  const candidates=parts.filter(p=>p.definition.data).map(p=>({p,ports:bus.dataPorts.filter(port=>p.definition.data!.interfaces.includes(port.interface)&&port.drivers.includes(p.definition.data!.driver))})).sort((a,b)=>a.ports.length-b.ports.length||physicalOrder(a.p,b.p));
  const assigned=new Map<string,typeof bus.dataPorts[number]>(),used=new Set<string>();
  function match(i:number):boolean{if(i===candidates.length)return true;const c=candidates[i];for(const port of c.ports){if(used.has(port.id))continue;used.add(port.id);assigned.set(c.p.part.id,port);if(match(i+1))return true;used.delete(port.id);assigned.delete(c.p.part.id);}return false;}
  if(!match(0)){// Report every unmet device, without hiding an impossible graph behind first-match order.
   for(const c of candidates){c.p.dataConnected=false;c.p.dataRateBps=0;issue(c.ports.length?'DATA_PORT_CAPACITY':'DATA_INTERFACE',`${c.p.definition.name}: 호환 데이터 인터페이스 또는 사용 가능한 포트가 없습니다.`,c.p.part.id,c.p.definition.data!.interfaces.join('/'),c.ports.length);}
  }else for(const c of candidates){const port=assigned.get(c.p.part.id)!;c.p.dataRateBps=Math.min(port.rateBps,c.p.definition.data!.maxRateBps);connections.push({partId:c.p.part.id,type:'data',endpoint:port.id,rateBps:c.p.dataRateBps});}
  let groups=0;for(const p of parts){if(p.definition.solar){groups+=p.definition.solar.mpptGroups;connections.push({partId:p.part.id,type:'solar',endpoint:`MPPT ×${p.definition.solar.mpptGroups}`});}}
  if(groups>bus.mpptGroups)issue('SOLAR_INPUT_LIMIT','태양전지 날개 수가 독립 MPPT 입력 수를 초과합니다.',undefined,groups,bus.mpptGroups);
  if(!parts.some(p=>p.definition.capacityWh))issue('BATTERY_MISSING','버스에 배터리가 포함되지 않습니다. 배터리 팩을 장착하세요.');
 }
 const usable=parts.filter(p=>p.powered&&p.dataConnected),radios=usable.filter(p=>p.definition.radio).sort(physicalOrder),radio=design.activeRadioId?radios.find(p=>p.part.id===design.activeRadioId):radios[0],antenna=radio?usable.filter(p=>p.definition.antenna?.band===radio.definition.radio!.band).sort(physicalOrder)[0]:undefined,adcs=usable.filter(p=>p.definition.adcs).sort(physicalOrder)[0];
 if(isHardwareDesign(design)){
  if(design.activeRadioId&&!radio)issue('RADIO_SELECTION','선택한 무전기가 없거나 연결되지 않았습니다.',design.activeRadioId);
  if(!radio)issue('NO_RADIO','전력과 데이터가 연결된 무전기를 장착하세요.');else if(!antenna)issue('RF_BAND','선택한 무전기에 맞는 주파수 대역의 안테나가 없습니다.',radio.part.id,radio.definition.radio!.band);
  if(radio&&antenna)connections.push({partId:radio.part.id,type:'rf',endpoint:antenna.part.id});
  if(!adcs)issue('ADCS_MISSING','전력과 데이터가 연결된 자세제어 장치가 필요합니다.');
  if(parts.filter(p=>p.definition.adcs).length>1)issue('ADCS_COUNT','이 버스는 자세제어 장치를 하나만 사용합니다.');
 }
 const modeLoadW={} as Record<OperationKind,number>;
 for(const mode of ['charge','observe','downlink'] as const){modeLoadW[mode]=(bus.basePowerW+usable.reduce((sum,p)=>sum+powerFor(p.definition,mode==='downlink'&&p.definition.radio&&p.part.id!==radio?.part.id?'charge':mode),0))/bus.conversionEfficiency;if(isHardwareDesign(design)){
  for(const rail of bus.rails){const load=usable.filter(p=>rails.get(p.part.id)===rail.id).reduce((sum,p)=>sum+powerFor(p.definition,mode==='downlink'&&p.definition.radio&&p.part.id!==radio?.part.id?'charge':mode),0);if(load>rail.maxPowerW+1e-9)issue('POWER_TOTAL_LIMIT',`${mode}: ${rail.voltageV} V 출력의 동시 소비전력이 한도를 초과합니다.`,undefined,load,rail.maxPowerW);}
  if(modeLoadW[mode]>bus.totalPowerW)issue('POWER_TOTAL_LIMIT',`${mode}: 전체 전력 분배 한도를 초과합니다.`,undefined,modeLoadW[mode],bus.totalPowerW);
 }}
 // Uniform-density proxy boxes, with world-rotated self inertia and the full
 // parallel-axis theorem about the combined spacecraft centre of mass.
 const pieces:{mass:number;center:Vec3;half:Vec3;axes:Vec3[]}[]=[{mass:bus.massKg,center:[0,0,0],half:[...bus.halfSize],axes:[[1,0,0],[0,1,0],[0,0,1]]},{mass:bus.fuelKg,center:[0,0,0],half:[.15,.15,.15],axes:[[1,0,0],[0,1,0],[0,0,1]]}];
 for(const p of parts){const tr=partTransformFor(design,p.part),boxes=p.definition.geometry.deployedBoxes,volume=boxes.reduce((v,b)=>v+b.half[0]*b.half[1]*b.half[2],0)||1;for(const b of boxes)pieces.push({mass:p.definition.massKg*b.half[0]*b.half[1]*b.half[2]/volume,center:add(tr.position,add(add(scale(tr.tangentU,b.center[0]),scale(tr.tangentV,b.center[1])),scale(tr.normal,b.center[2]))),half:b.half,axes:[tr.tangentU,tr.tangentV,tr.normal]});}
 const totalMass=pieces.reduce((m,p)=>m+p.mass,0),cg=pieces.reduce((c,p)=>add(c,scale(p.center,p.mass/totalMass)),[0,0,0] as Vec3),inertia:Vec3=[0,0,0];
 for(const p of pieces){const principal=p.half.map((_,j)=>p.mass/3*(p.half[(j+1)%3]**2+p.half[(j+2)%3]**2));for(let i=0;i<3;i++)inertia[i]+=principal.reduce((n,I,j)=>n+I*p.axes[j][i]**2,0)+p.mass*((p.center[(i+1)%3]-cg[(i+1)%3])**2+(p.center[(i+2)%3]-cg[(i+2)%3])**2);}
 const recorders=usable.filter(p=>p.definition.recorder),dataWriteRateBps=Math.max(1e6,...recorders.map(p=>Math.min(p.dataRateBps,p.definition.recorder!.writeRateBps))),dataReadRateBps=Math.max(1e6,...recorders.map(p=>Math.min(p.dataRateBps,p.definition.recorder!.readRateBps)));
 const value:ResolvedHardware={version:isHardwareDesign(design)?HARDWARE_VERSION:'legacy-1.3.0',catalogHash:isHardwareDesign(design)?HARDWARE_CATALOG_HASH:'legacy-1.3.0',bus,parts,connections,issues,radioId:radio?.part.id??null,antennaId:antenna?.part.id??null,adcsId:adcs?.part.id??null,inertiaKgM2:inertia,centerOfMassM:cg,modeLoadW,dataWriteRateBps,dataReadRateBps};cache.set(design,{signature,value});return value;
}
export function evaluateConnections(design:Design,mode:OperationKind='charge'){const r=resolveHardware(design);return {connections:r.connections,issues:r.issues,compatible:r.issues.length===0,loadPowerW:r.modeLoadW[mode]};}
export function hardwareLoadPower(design:Design,mode:OperationKind,slewing:boolean){const r=resolveHardware(design);return (r.bus.basePowerW+r.parts.filter(p=>p.powered&&p.dataConnected).reduce((sum,p)=>sum+powerFor(p.definition,mode==='downlink'&&p.definition.radio&&p.part.id!==r.radioId?'charge':mode,slewing),0))/r.bus.conversionEfficiency;}
export function connectedInstruments(design:Design,kind:'camera'|'spectrometer'){return resolveHardware(design).parts.filter(p=>p.part.kind===kind&&p.powered&&p.dataConnected).sort(physicalOrder).map(p=>{const optics=p.definition.optics,window=design.missionId==='earth'&&design.scienceTarget?optics?.regionReadout?.[design.scienceTarget.profile]:undefined;if(!optics||!window)return p;return {...p,definition:{...p.definition,optics:{...optics,windowPixelsAcross:window,bitsPerFrame:optics.bitsPerFrame*(window/optics.pixelsAcross)**2}}};});}
/** Authored safe-mode CPU duty is half nominal; payloads/radios are off but the
 * sun-seeking ADCS and battery management still draw their actual mode power. */
export function hardwareSafePower(design:Design,slewing:boolean){const r=resolveHardware(design);return (r.bus.basePowerW*.5+r.parts.filter(p=>p.powered&&(p.definition.adcs||p.definition.capacityWh)).reduce((s,p)=>s+(p.definition.adcs?powerFor(p.definition,'charge',slewing):p.definition.idlePowerW),0))/r.bus.conversionEfficiency;}
/** Physical bandwidth and a compatible selected RF chain, including continuous pattern loss. */
export function hardwareLink(design:Design,distanceKm:number,directionBody:Vec3,deep:boolean){const h=resolveHardware(design),radio=h.parts.find(p=>p.part.id===h.radioId),antenna=h.parts.find(p=>p.part.id===h.antennaId);if(!radio?.definition.radio||!antenna?.definition.antenna)return {rateBps:0,marginDb:-120,antennaPart:null as Part|null,pointingGain:0};const r=radio.definition.radio,a=antenna.definition.antenna,tr=partTransformFor(design,antenna.part),dir=normalize(directionBody),angle=Math.acos(Math.min(1,Math.max(-1,dot(tr.normal,dir))))*180/Math.PI;let lossDb=0;
 if(a.pattern==='reflector')lossDb=Math.min(120,3*(angle/a.halfPowerAngleDeg)**2);else {const u=dot(tr.tangentU,dir),v=dot(tr.tangentV,dir);lossDb=-10*Math.log10(Math.max(1e-8,Math.max(1-u*u,1-v*v)))+3;}
 const groundGain=r.band==='UHF'?17:deep?66:32,noiseK=r.band==='UHF'?1000:100,fspl=20*Math.log10(4*Math.PI*Math.max(1,distanceKm)*1000*r.frequencyHz/299792458),cn0=10*Math.log10(r.rfPowerW)+a.peakGainDbi-lossDb+groundGain-fspl-3+228.6-10*Math.log10(noiseK);let rateBps=0,marginDb=cn0-10*Math.log10(r.signalModesBps[0])-r.ebNoDb;
 for(const rate of r.signalModesBps){const margin=cn0-10*Math.log10(rate)-r.ebNoDb;if(margin>=0){rateBps=Math.min(rate*r.payloadFraction,radio.dataRateBps,h.dataReadRateBps);marginDb=margin;}}
 return {rateBps,marginDb,antennaPart:antenna.part,pointingGain:10**(-lossDb/10)};
}
