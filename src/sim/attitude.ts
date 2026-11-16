import type {Quaternion,Vec3} from './types';
export const ATTITUDE_RATE_DEG_S=20;
export type BodyAxes={x:Vec3;y:Vec3;z:Vec3};
const normalized=(q:Quaternion):Quaternion=>{const m=Math.hypot(...q);return q.map(v=>v/(m||1)) as Quaternion;};
export function quaternionFromBasis(b:BodyAxes):Quaternion {
 const m00=b.x[0],m01=b.y[0],m02=b.z[0],m10=b.x[1],m11=b.y[1],m12=b.z[1],m20=b.x[2],m21=b.y[2],m22=b.z[2],trace=m00+m11+m22;
 let q:Quaternion;
 if(trace>0){const s=Math.sqrt(trace+1)*2;q=[(m21-m12)/s,(m02-m20)/s,(m10-m01)/s,.25*s];}
 else if(m00>m11&&m00>m22){const s=Math.sqrt(1+m00-m11-m22)*2;q=[.25*s,(m01+m10)/s,(m02+m20)/s,(m21-m12)/s];}
 else if(m11>m22){const s=Math.sqrt(1+m11-m00-m22)*2;q=[(m01+m10)/s,.25*s,(m12+m21)/s,(m02-m20)/s];}
 else{const s=Math.sqrt(1+m22-m00-m11)*2;q=[(m02+m20)/s,(m12+m21)/s,.25*s,(m10-m01)/s];}
 return normalized(q);
}
export function quaternionToBasis(q0:Quaternion):BodyAxes {
 const [x,y,z,w]=normalized(q0);
 return {x:[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w)],y:[2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)],z:[2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)]};
}
export function quaternionAngleDeg(a0:Quaternion,b0:Quaternion):number{const a=normalized(a0),b=normalized(b0),d=a.reduce((s,v,i)=>s+v*b[i],0);return 2*Math.acos(Math.min(1,Math.abs(d)))*180/Math.PI;}
export function slewQuaternion(from0:Quaternion,to0:Quaternion,maxAngleDeg:number):Quaternion {
 const from=normalized(from0);let to=normalized(to0),d=from.reduce((s,v,i)=>s+v*to[i],0);if(d<0){to=to.map(v=>-v) as Quaternion;d=-d;}
 const halfAngle=Math.acos(Math.min(1,d)),angleDeg=halfAngle*360/Math.PI;
 if(angleDeg<1e-9||maxAngleDeg>=angleDeg)return to;
 const ratio=Math.max(0,maxAngleDeg)/angleDeg;
 if(d>.9995)return normalized(from.map((v,i)=>v+(to[i]-v)*ratio) as Quaternion);
 const a=Math.sin((1-ratio)*halfAngle)/Math.sin(halfAngle),b=Math.sin(ratio*halfAngle)/Math.sin(halfAngle);
 return normalized(from.map((v,i)=>v*a+to[i]*b) as Quaternion);
}
