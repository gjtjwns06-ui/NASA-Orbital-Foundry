import type {Design} from '../sim';
import {restoreOperations,type OperationsState,type ScienceBand} from './operations';
import {solveAssistRoute,type AssistRouteRequest,type SolvedAssistRoute} from './assist';
import {planSolarRoute,SOLAR_EPOCH_JD,SOLAR_MAX_JD,type SolarBodyId,type SolvedSolarRoute} from './model';

export const JOURNEY_KEY='orbital-solar-active-journey-v2';
export type JourneyPhase='flight'|'swingby'|'encounter'|'sending';
export type JourneyView='map'|'chase'|'instrument';
export interface JourneySnapshot {
 version:2;designKey:string;target:SolarBodyId;departureJd:number;flightDays:number;
 phase:JourneyPhase;flight:number;flybySeconds:number;flybySeen:boolean;
 incidentResolved:boolean;incidentActive:boolean;view:JourneyView;band:ScienceBand;
 operations:OperationsState;assistRequest:AssistRouteRequest|null;
 images:Record<string,string>;sendElapsedSeconds:number;
}
function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
 return JSON.stringify(value)??'null';
}
/** A change detector, not authentication or tamper-proof save signing. */
export function craftKey(design:Design):string {
 let hash=2166136261;for(const char of canonical(design))hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return (hash>>>0).toString(16);
}
const finite=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const jpeg=(value:unknown):value is string=>typeof value==='string'&&value.length<=200000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
export function parseJourney(value:string|null,design:Design):{snapshot:JourneySnapshot;route:SolvedSolarRoute;assist:SolvedAssistRoute|null}|null {
 if(!value||value.length>2500000)return null;
 try{
  const raw=JSON.parse(value) as JourneySnapshot;
  if(raw.version!==2||raw.designKey!==craftKey(design)||!['flight','swingby','encounter','sending'].includes(raw.phase)||!['map','chase','instrument'].includes(raw.view)||!['visible','nir'].includes(raw.band))return null;
  if(!finite(raw.departureJd,SOLAR_EPOCH_JD,SOLAR_MAX_JD)||!finite(raw.flightDays,1,7300)||!finite(raw.flight,0,1)||!finite(raw.flybySeconds,0,120)||!finite(raw.sendElapsedSeconds,0,86400))return null;
  if(![raw.flybySeen,raw.incidentActive,raw.incidentResolved].every(x=>typeof x==='boolean'))return null;
  let assist:SolvedAssistRoute|null=null;
  if(raw.assistRequest){const candidate=solveAssistRoute(raw.assistRequest);if(candidate.status!=='solved'||candidate.request.target!==raw.target||candidate.request.origin!=='earth'||candidate.request.departureJdTdb!==raw.departureJd||candidate.flightDays!==raw.flightDays)return null;assist=candidate;}
  const direct=planSolarRoute('earth',raw.target,raw.departureJd,raw.flightDays);
  const route=assist?asSolarRoute(assist):direct;
  if(route.status!=='solved'||(raw.phase==='swingby'&&!assist))return null;
  const operations=restoreOperations(raw.operations,design,raw.target,route.arrivalVInfinityKmS);
  if(!operations)return null;
  const images:Record<string,string>={};
  for(const record of operations.records.slice(0,12)){const image=raw.images?.[record.id];if(jpeg(image))images[record.id]=image;}
  // Held pointer/keyboard input never survives a page navigation.
  operations.exposure=null;
  return {snapshot:{...raw,operations,images},route,assist};
 }catch{return null;}
}
/** Adapter for existing payload readiness; the charged impulse is the entire
 * plan's departure plus explicit correction, not the second planet's launch. */
export function asSolarRoute(assist:SolvedAssistRoute):SolvedSolarRoute {
 const first=assist.legs[0],last=assist.legs[1];
 return {...first,targetId:last.targetId,arrivalJdTdb:last.arrivalJdTdb,flightDays:assist.flightDays,pointsAu:assist.pointsAu,arrivalPositionKm:last.arrivalPositionKm,arrivalVelocityKmS:last.arrivalVelocityKmS,arrivalVInfinityKmS:last.arrivalVInfinityKmS,arrivalDeltaVMps:last.arrivalDeltaVMps,departureDeltaVMps:assist.totalPropulsiveDeltaVMps,endpointErrorKm:Math.max(first.endpointErrorKm,last.endpointErrorKm),minimumSolarDistanceAu:Math.min(first.minimumSolarDistanceAu,last.minimumSolarDistanceAu)};
}
