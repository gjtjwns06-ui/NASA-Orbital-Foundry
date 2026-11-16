import {createDesign} from '../sim/catalog';
import {earthStateAt} from '../sim/physics';
import {earthSubpoint} from '../sim/targets';
import type {MissionId,Part} from '../sim/types';
import type {BusId,HardwareDesign} from './types';
import {HARDWARE_MODELS,HARDWARE_VERSION} from './catalog';
export function createHardwarePart(modelId:string,id:string,face:Part['face']='py',u=0,v=0,rotation=0):Part{const d=HARDWARE_MODELS[modelId];if(!d)throw new Error('알 수 없는 장비 모델입니다.');return {id,kind:d.kind,modelId,face,u,v,rotation};}
/** Initial authored layouts; runtime regression tests, not this factory, establish success. */
export function createHardwareDesign(missionId:MissionId='earth',preset:'starter'|'balanced'|'science'='balanced',busId?:BusId):HardwareDesign {
 const deep=missionId==='mars'||preset==='science',bus=busId??(deep?'pathfinder-d35-v1':'surveyor-l18-v1'),d=createDesign(missionId,'starter');
 const design:HardwareDesign={...d,hardwareVersion:HARDWARE_VERSION,busId:bus,name:missionId==='earth'?'SURVEYOR-H2':'PATHFINDER-H2',activeRadioId:preset==='starter'?undefined:'radio-1'};
 if(preset==='starter')return design;
 design.parts=[
  createHardwarePart(deep?'tsp45-sixwing-v2':'tsp45-fixed-v2','solar-1','px'),
  createHardwarePart(missionId==='mars'?'mars-spectra-v2':'wide-mono-v2','science-1','nz'),
  createHardwarePart(missionId==='mars'?'xband-reflector-1m-v1':'uhf-dipole-pair-v1','antenna-1','pz'),
  createHardwarePart(missionId==='mars'?'iris22-carrier-v1':'ax100u-carrier-v1','radio-1','py',-.22,.2),
  createHardwarePart(missionId==='mars'&&preset==='science'?'bpx100-dual-v2':'bpx100-4s2p-v2','battery-1','py',-.22,-.22),
  createHardwarePart(missionId==='mars'&&preset==='science'?'recorder-8-v2':'recorder-1p6-v2','storage-1','py',.22,-.22),
  createHardwarePart('xact50-carrier-v1','adcs-1','py',.22,.2),
 ];
 if(missionId==='mars'||preset==='balanced')design.parts.push(createHardwarePart('chemical230-v2','engine-1','ny'));
 if(missionId==='earth')design.plan.operations=[{id:'obs-1',kind:'observe',start:0,end:1800},{id:'down-1',kind:'downlink',start:1800,end:10800}];
 return design;
}
/** M03 has a three-hour encounter window after months of cruise; reserve two
 * physical BPX packs instead of silently increasing a single pack's capacity. */
export function createHardwareTransferDesign(preset:'balanced'|'science'='balanced'):HardwareDesign {
 const design=createHardwareDesign('mars',preset);
 design.parts=design.parts.map(p=>p.kind==='battery'?createHardwarePart('bpx100-dual-v2',p.id,p.face,p.u,p.v,p.rotation):p);
 return design;
}
/** Verified examples, not automatic changes to an imported/player design. */
export function createHardwareRegionDesign(profile:'precision'|'survey'):HardwareDesign {
 const design=createHardwareDesign('earth','science');
 design.parts=design.parts.map(p=>p.kind==='camera'?createHardwarePart('narrow-mono-v2',p.id,p.face,p.u,p.v,p.rotation):p.kind==='battery'?createHardwarePart('bpx100-dual-v2',p.id,p.face,p.u,p.v,p.rotation):p);
 design.plan.altitudeKm=profile==='precision'?800:1800;design.plan.inclinationDeg=profile==='precision'?51.6:40;
 design.launchPackageId=profile==='precision'?'precision':'heavy';
 const sampleTime=profile==='precision'?1500:1700;
 design.scienceTarget={profile,...earthSubpoint(earthStateAt(design.plan,sampleTime).positionKm,sampleTime)};
 const stop=profile==='precision'?2000:2600;
 design.plan.operations=[{id:'region-observe',kind:'observe',start:0,end:stop},{id:'region-return',kind:'downlink',start:stop,end:10800}];
 return design;
}
