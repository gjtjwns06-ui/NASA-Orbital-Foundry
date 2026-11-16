import type {HardwareRuntimeData,ResolvedPart} from './types';
export interface AcquisitionCandidate {id:string;target:string;quality:number;observedPoint?:{latDeg:number;lonDeg:number}}
/** A single instrument buffer: exposure must retain pointing for its whole duration;
 * readout subsequently consumes the actual payload port/recorder bandwidth. */
export function advanceAcquisition(data:HardwareRuntimeData,instrument:ResolvedPart|undefined,dt:number,time:number,eligible:boolean,candidate:AcquisitionCandidate|null,writeRateBps:number,availableBits:number,powered=true){
 let completed:HardwareRuntimeData['acquisition']=null,cancelled=false;
 const optics=instrument?.definition.optics;
 if(data.acquisition){const a=data.acquisition;if(!powered||!instrument){data.acquisition=null;cancelled=true;}
  else {let remaining=dt;if(a.exposureRemainingS>0){if(!eligible||candidate?.id!==a.id){data.acquisition=null;cancelled=true;}else{a.quality=Math.min(a.quality,candidate.quality);const exposure=Math.min(a.exposureRemainingS,remaining);a.exposureRemainingS-=exposure;remaining-=exposure;}}
   if(data.acquisition&&a.exposureRemainingS<=0){a.remainingBits=Math.max(0,a.remainingBits-Math.min(writeRateBps,instrument.dataRateBps)*remaining);if(a.remainingBits<=1e-6){completed={...a};data.acquisition=null;}}
  }
 }
 if(!data.acquisition&&!completed&&!cancelled&&eligible&&candidate&&optics&&availableBits>=optics.bitsPerFrame){data.acquisition={...candidate,startedAt:time,bits:optics.bitsPerFrame,remainingBits:optics.bitsPerFrame,exposureRemainingS:optics.exposureSeconds,kind:optics.kind};}
 return {completed,cancelled};
}
