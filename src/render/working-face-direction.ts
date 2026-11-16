import * as THREE from 'three';
import type {ApertureView,DeploymentGeometryView,OrientedBoxView} from '../deployment/types';

export interface WorkingFaceFrame {
 geometry:Pick<DeploymentGeometryView,'apertures'|'boxes'>;
 position:THREE.Vector3;quaternion:THREE.Quaternion;bodyOffset:THREE.Vector3;displayScale:number;
 target:THREE.Vector3;distance:number;earthRadius:number;
 limbDirection:THREE.Vector3;currentDirection:THREE.Vector3;
}
export type WorkingFaceChoice={status:'unavailable';reason:'invalid-input'|'no-working-apertures'|'no-visible-working-face'|'no-actual-flight'|'view-unavailable'}|{
 status:'found';direction:THREE.Vector3;up:THREE.Vector3;candidateIndex:number;radialAngleRad:number;
 visibleKinds:Array<'solar'|'rf'>;minimumTypeScore:number;totalTypeScore:number;
 apertures:Array<{id:string;partId:string;kind:'solar'|'rf';frontCosine:number;clearSamples:number;samples:number}>;
};
const finite=(v:THREE.Vector3)=>!!v?.isVector3&&v.toArray().every(Number.isFinite)&&Number.isFinite(v.lengthSq());
const validArray=(a:readonly number[]|undefined)=>a?.length===3&&a.every(Number.isFinite)&&Number.isFinite(a.reduce((n,v)=>n+v*v,0));
const vector=(a:readonly number[])=>new THREE.Vector3(a[0],a[1],a[2]);
const unit=(a:readonly number[])=>validArray(a)&&Math.abs(vector(a).lengthSq()-1)<1e-5;
const EPS=1e-9,SAMPLES=[[0,0],[-.32,-.32],[-.32,.32],[.32,-.32],[.32,.32]] as const;

/** Camera visibility only: segment versus supplied current OBB, in body metres.
 * No physical power/link calculation, new FK or contact exemption is inferred. */
function occludes(origin:THREE.Vector3,direction:THREE.Vector3,box:OrientedBoxView,limit:number){
 const delta=origin.clone().sub(vector(box.centerM));let low=-Infinity,high=Infinity;
 for(let i=0;i<3;i++){
  const axis=vector(box.axes[i]),p=delta.dot(axis),d=direction.dot(axis),half=box.halfM[i];
  if(Math.abs(d)<1e-12){if(Math.abs(p)>half)return false;}
  else{const a=(-half-p)/d,b=(half-p)/d;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(high<low)return false;}
 }
 return high>=Math.max(0,low)&&low<limit-1e-6;
}
function valid(frame:WorkingFaceFrame){
 if(!frame||typeof frame!=='object')return false;
 const {position,quaternion,bodyOffset,target,distance,displayScale,earthRadius,limbDirection,currentDirection,geometry}=frame;
 if(![position,bodyOffset,target,limbDirection,currentDirection].every(finite)||limbDirection.lengthSq()<1e-20||currentDirection.lengthSq()<1e-20||![distance,displayScale,earthRadius].every(v=>Number.isFinite(v*v)&&v>0)||position.length()<=earthRadius||!quaternion?.isQuaternion||!quaternion.toArray().every(Number.isFinite)||Math.abs(quaternion.lengthSq()-1)>1e-5||!geometry||!Array.isArray(geometry.apertures)||!Array.isArray(geometry.boxes))return false;
 const keys=new Set<string>();
 for(const b of geometry.boxes){if(!b||typeof b.linkId!=='string'||!b.linkId||typeof b.id!=='string'||!b.id)return false;const key=b.linkId+'|'+b.id;if(keys.has(key)||!validArray(b.centerM)||!validArray(b.halfM)||b.halfM.some(n=>n<=0)||b.axes?.length!==3||!b.axes.every(unit)||b.axes.some((a,i)=>b.axes.some((c,j)=>i!==j&&Math.abs(vector(a).dot(vector(c)))>1e-5)))return false;keys.add(key);}
 const apertureKeys=new Set<string>();
 for(const a of geometry.apertures){if(!a||typeof a.linkId!=='string'||!a.linkId||typeof a.id!=='string'||!a.id)return false;const key=a.linkId+'|'+a.id;if(apertureKeys.has(key)||!validArray(a.centerM)||![a.normal,a.tangentU,a.tangentV].every(unit)||![a.widthM,a.heightM,a.widthM*a.heightM].every(n=>Number.isFinite(n)&&n>0)||Math.abs(vector(a.normal).dot(vector(a.tangentU)))>1e-5||Math.abs(vector(a.normal).dot(vector(a.tangentV)))>1e-5||Math.abs(vector(a.tangentU).dot(vector(a.tangentV)))>1e-5||!keys.has(a.linkId+'|'+a.emittingBoxId))return false;apertureKeys.add(key);}
 return true;
}

/** Explicit one-shot view suggestion from actual current faces. Search120 fixed
 * radial-cone azimuths plus the current azimuth. Rank: visible PV/RF kind count,
 * weakest normalized kind score, total score, then smallest change from current
 * direction. Exact ties retain enumeration order. Sorting identities prevents
 * incidental source-array ordering from changing floating-point sums/ties. */
export function chooseWorkingFaceDirection(frame:WorkingFaceFrame):WorkingFaceChoice {
 if(!valid(frame))return {status:'unavailable',reason:'invalid-input'};
 const faces=frame.geometry.apertures.filter((a):a is ApertureView&{kind:'solar'|'rf'}=>a.kind==='solar'||a.kind==='rf').slice().sort((a,b)=>(a.kind+'|'+a.linkId+'|'+a.id).localeCompare(b.kind+'|'+b.linkId+'|'+b.id));
 if(!faces.length)return {status:'unavailable',reason:'no-working-apertures'};
 const boxes=frame.geometry.boxes.slice().sort((a,b)=>(a.linkId+'|'+a.id).localeCompare(b.linkId+'|'+b.id)),radial=frame.position.clone().normalize(),current=frame.currentDirection.clone().normalize(),theta=Math.acos(THREE.MathUtils.clamp(frame.limbDirection.clone().normalize().dot(radial),-1,1));
 const t1=new THREE.Vector3(0,1,0).addScaledVector(radial,-radial.y);if(t1.lengthSq()<1e-12)t1.set(0,0,1).addScaledVector(radial,-radial.z);t1.normalize();const t2=new THREE.Vector3().crossVectors(radial,t1).normalize(),inverse=frame.quaternion.clone().invert();
 const totals={solar:0,rf:0};for(const a of faces)totals[a.kind]+=a.widthM*a.heightM;
 const kinds=(['solar','rf'] as const).filter(k=>totals[k]>0),currentAngle=Math.atan2(current.dot(t2),current.dot(t1)),angles=[currentAngle,...Array.from({length:120},(_,i)=>i*Math.PI/60)];
 let best:(Extract<WorkingFaceChoice,{status:'found'}>&{rank:number[]})|null=null;
 for(const [candidateIndex,angle]of angles.entries()){
  const direction=radial.clone().multiplyScalar(Math.cos(theta)).addScaledVector(t1,Math.sin(theta)*Math.cos(angle)).addScaledVector(t2,Math.sin(theta)*Math.sin(angle)),eye=frame.target.clone().addScaledVector(direction,frame.distance);
  if(eye.length()<=frame.earthRadius+1e-6)continue;
  const planetHit=new THREE.Ray(eye,frame.target.clone().sub(eye).normalize()).intersectSphere(new THREE.Sphere(new THREE.Vector3(),frame.earthRadius),new THREE.Vector3());if(planetHit&&planetHit.distanceTo(eye)<frame.distance-1e-6)continue;
  const localEye=eye.sub(frame.position).applyQuaternion(inverse).divideScalar(frame.displayScale).sub(frame.bodyOffset),scores={solar:0,rf:0};
  const apertures=faces.map(a=>{
   const center=vector(a.centerM),normal=vector(a.normal),frontCosine=normal.dot(localEye.clone().sub(center).normalize());let clearSamples=0;
   if(frontCosine>.06)for(const [u,v]of SAMPLES){const point=center.clone().addScaledVector(vector(a.tangentU),u*a.widthM).addScaledVector(vector(a.tangentV),v*a.heightM),ray=point.sub(localEye),limit=ray.length();ray.divideScalar(limit);if(!boxes.some(b=>!(b.linkId===a.linkId&&b.id===a.emittingBoxId)&&occludes(localEye,ray,b,limit)))clearSamples++;}
   scores[a.kind]+=a.widthM*a.heightM*Math.max(0,frontCosine)*clearSamples/SAMPLES.length;
   return {id:a.id,partId:a.partId,kind:a.kind,frontCosine,clearSamples,samples:SAMPLES.length};
  });
  const normalized=kinds.map(k=>scores[k]/totals[k]),visibleKinds=kinds.filter(k=>scores[k]/totals[k]>.03),minimumTypeScore=Math.min(...normalized),totalTypeScore=normalized.reduce((a,b)=>a+b,0),rank=[visibleKinds.length,minimumTypeScore,totalTypeScore,current.dot(direction)];
  const better=!best||rank.some((value,i)=>rank.slice(0,i).every((v,j)=>Math.abs(v-best!.rank[j])<=EPS)&&value>best!.rank[i]+EPS);
  if(better){const up=radial.clone().addScaledVector(direction,-radial.dot(direction));if(up.lengthSq()<1e-12)up.copy(t1);best={status:'found',direction,up:up.normalize(),candidateIndex,radialAngleRad:theta,visibleKinds,minimumTypeScore,totalTypeScore,apertures,rank};}
 }
 if(!best?.visibleKinds.length)return {status:'unavailable',reason:'no-visible-working-face'};
 const {rank:_,...result}=best;return result;
}
