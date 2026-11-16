import type {ClearanceReport,ClearanceWitness,JointStates,OrientedBoxView,Vec3} from './types';
import type {CompiledTopology} from './kinematics';
import {resolveDeploymentGeometry} from './kinematics';
import {add,cross,DeploymentError,dot,length,scale,sub,unit} from './math';
const key=(box:Pick<OrientedBoxView,'linkId'|'id'>)=>box.linkId+'|'+box.id;
export function boxCorners(box:OrientedBoxView):Vec3[]{const points:Vec3[]=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])points.push(add(box.centerM,add(add(scale(box.axes[0],x*box.halfM[0]),scale(box.axes[1],y*box.halfM[1])),scale(box.axes[2],z*box.halfM[2]))));return points;}
/** Positive value is a sufficient separating-axis distance lower bound.
 * Nonpositive means overlap/touch under the15-axis OBB theorem. A positive
 * value smaller than requested clearance is NOT proof of insufficient distance. */
export function separatingGap(a:OrientedBoxView,b:OrientedBoxView):number {const delta=sub(b.centerM,a.centerM),axes=[...a.axes,...b.axes,...a.axes.flatMap(x=>b.axes.map(y=>cross(x,y)))];let gap=-Infinity;for(const raw of axes){if(length(raw)<1e-12)continue;const axis=unit(raw),ra=a.axes.reduce((sum,v,i)=>sum+Math.abs(dot(axis,v))*a.halfM[i],0),rb=b.axes.reduce((sum,v,i)=>sum+Math.abs(dot(axis,v))*b.halfM[i],0);gap=Math.max(gap,Math.abs(dot(delta,axis))-ra-rb);}return gap;}
const witness=(a:OrientedBoxView,b:OrientedBoxView,jointId:string,range:[number,number],sample:number,clearanceM:number):ClearanceWitness=>({a:{partId:a.partId,linkId:a.linkId,boxId:a.id},b:{partId:b.partId,linkId:b.linkId,boxId:b.id},jointId,angleIntervalRad:range,sampleAngleRad:sample,clearanceM});
export interface SweepOptions {clearanceM?:number;angleToleranceRad?:number;displacementToleranceM?:number;maximumIntervals?:number}
/** One powered actuator channel: the selected hinge changes, all other relative
 * angles stay fixed. Its entire descendant subtree undergoes one rigid rotation.
 * Geometry confidence is explicit; there is no endpoint-only fallback. */
export function evaluateJointSweep(compiled:CompiledTopology,states:JointStates,jointId:string,targetAngleRad:number,options:SweepOptions={}):ClearanceReport {
 const clearanceM=options.clearanceM??.002,angleTol=options.angleToleranceRad??Math.PI/18000,displacementTol=options.displacementToleranceM??.001,maxIntervals=options.maximumIntervals??16384,joint=compiled.definition.joints.find(j=>j.id===jointId);
 if(!joint||!Number.isFinite(targetAngleRad)||targetAngleRad<joint.minimumRad||targetAngleRad>joint.maximumRad||![clearanceM,angleTol,displacementTol].every(n=>Number.isFinite(n)&&n>=0)||angleTol<=0||displacementTol<=0||!Number.isInteger(maxIntervals)||maxIntervals<1||maxIntervals>100000)throw new DeploymentError('INVALID_SWEEP');
 const start=states[jointId]?.angleRad,initial=resolveDeploymentGeometry(compiled,states),base=initial.boxes.slice().sort((a,b)=>key(a).localeCompare(key(b))),axis=initial.joints[jointId].axisBody,pivot=initial.joints[jointId].pivotBodyM,descendants=new Set([joint.childLinkId]);
 let changed=true;while(changed){changed=false;for(const j of compiled.definition.joints)if(descendants.has(j.parentLinkId)&&!descendants.has(j.childLinkId)){descendants.add(j.childLinkId);changed=true;}}
 const exemptions=new Set(compiled.definition.contactExemptions.map(e=>[e.a.linkId+'|'+e.a.boxId,e.b.linkId+'|'+e.b.boxId].sort().join('::'))),radius=new Map<string,number>();for(const b of base)radius.set(key(b),descendants.has(b.linkId)?Math.max(...boxCorners(b).map(p=>{const r=sub(p,pivot);return length(sub(r,scale(axis,dot(r,axis))));})):0);
 const pairs:{a:string;b:string;movingRadius:number}[]=[];let firstUncertain:ClearanceWitness|null=null,firstCollision:ClearanceWitness|null=null,safeThrough=start,maxUnresolved=0,checked=0;
 for(let i=0;i<base.length;i++)for(let j=i+1;j<base.length;j++){const a=base[i],b=base[j];if(a.linkId===b.linkId||exemptions.has([key(a),key(b)].sort().join('::')))continue;const gap=separatingGap(a,b);if(gap<=0){firstCollision=witness(a,b,jointId,[start,start],start,clearanceM);return {status:'blocked',clearanceM,angleRangeRad:[start,targetAngleRad],checkedIntervals:1,maximumUnresolvedDisplacementM:0,firstWitness:firstCollision,firstUncertainWitness:null,safeThroughAngleRad:start};}
  if(descendants.has(a.linkId)===descendants.has(b.linkId)||start===targetAngleRad){if(gap<=clearanceM&&!firstUncertain)firstUncertain=witness(a,b,jointId,[start,start],start,clearanceM);continue;}
  pairs.push({a:key(a),b:key(b),movingRadius:radius.get(key(a))!+radius.get(key(b))!});
 }
 const stateAt=(angle:number)=>({...states,[jointId]:{...states[jointId],angleRad:angle}}),at=(angle:number)=>new Map(resolveDeploymentGeometry(compiled,stateAt(angle)).boxes.map(b=>[key(b),b]));
 function inspect(a:number,b:number):boolean {
  const mid=(a+b)/2,width=Math.abs(b-a),view=at(mid);checked++;const failures=pairs.flatMap(pair=>{const A=view.get(pair.a)!,B=view.get(pair.b)!,bound=2*pair.movingRadius*Math.sin(Math.min(Math.PI,width/4)),gap=separatingGap(A,B);return gap>clearanceM+bound?[]:[{A,B,bound,gap}];});
  if(!failures.length){if(!firstUncertain&&!firstCollision)safeThrough=b;return false;}
  const bound=Math.max(...failures.map(f=>f.bound)),small=width<=angleTol&&bound<=displacementTol;
  if(small||checked>=maxIntervals){const collision=failures.find(f=>f.gap<=0);if(collision&&small){firstCollision=witness(collision.A,collision.B,jointId,[a,b],mid,clearanceM);return true;}if(!firstUncertain){const f=failures[0];firstUncertain=witness(f.A,f.B,jointId,[a,b],mid,clearanceM);safeThrough=a;}maxUnresolved=Math.max(maxUnresolved,bound);if(checked>=maxIntervals)maxUnresolved=Math.max(maxUnresolved,...pairs.map(p=>2*p.movingRadius*Math.sin(Math.abs(targetAngleRad-start)/4)));return checked>=maxIntervals;}
  if(inspect(a,mid))return true;return inspect(mid,b);
 }
 if(start!==targetAngleRad)inspect(start,targetAngleRad);else safeThrough=targetAngleRad;
 const status:ClearanceReport['status']=firstCollision?'blocked':firstUncertain?'uncertain':'clear';return {status,clearanceM,angleRangeRad:[start,targetAngleRad],checkedIntervals:checked,maximumUnresolvedDisplacementM:maxUnresolved,firstWitness:firstCollision,firstUncertainWitness:firstUncertain,safeThroughAngleRad:status==='clear'?targetAngleRad:safeThrough};
}
