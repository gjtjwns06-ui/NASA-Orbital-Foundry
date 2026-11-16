import type {Matrix3,Quaternion,Vec3} from './types';
export class DeploymentError extends Error {constructor(public readonly code:string,message=code){super(message);this.name='DeploymentError';}}
export const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const length=(a:Vec3)=>Math.hypot(...a);
export const finiteVector=(a:unknown):a is Vec3=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
export function unit(a:Vec3):Vec3 {const n=length(a);if(!finiteVector(a)||n<1e-14)throw new DeploymentError('INVALID_AXIS');return scale(a,1/n);}
export const identityMatrix=():Matrix3=>[1,0,0,0,1,0,0,0,1];
export const zeroMatrix=():Matrix3=>[0,0,0,0,0,0,0,0,0];
export const matrixVector=(m:Matrix3,v:Vec3):Vec3=>[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
export const transpose=(m:Matrix3):Matrix3=>[m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]];
export const matrixAdd=(a:Matrix3,b:Matrix3):Matrix3=>a.map((v,i)=>v+b[i]) as Matrix3;
export const matrixScale=(a:Matrix3,s:number):Matrix3=>a.map(v=>v*s) as Matrix3;
export function matrixMultiply(a:Matrix3,b:Matrix3):Matrix3 {const result=zeroMatrix();for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)result[i*3+j]+=a[i*3+k]*b[k*3+j];return result;}
export function inverse(m:Matrix3):Matrix3 {
 const [a,b,c,d,e,f,g,h,i]=m,A=e*i-f*h,B=f*g-d*i,C=d*h-e*g,det=a*A+b*B+c*C,scaleM=Math.max(...m.map(Math.abs));
 if(!m.every(Number.isFinite)||!Number.isFinite(det)||Math.abs(det)<=Math.max(1e-30,scaleM**3*1e-14))throw new DeploymentError('SINGULAR_INERTIA');
 return [A,c*h-b*i,b*f-c*e,B,a*i-c*g,c*d-a*f,C,b*g-a*h,a*e-b*d].map(v=>v/det) as Matrix3;
}
export function normalizedQuaternion(q:Quaternion):Quaternion {if(!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite))throw new DeploymentError('INVALID_QUATERNION');const n=Math.hypot(...q);if(n<1e-14)throw new DeploymentError('INVALID_QUATERNION');return q.map(v=>v/n) as Quaternion;}
export function multiplyQuaternion(a:Quaternion,b:Quaternion):Quaternion {const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];}
export const conjugate=(q:Quaternion):Quaternion=>[-q[0],-q[1],-q[2],q[3]];
export function axisQuaternion(axis:Vec3,angle:number):Quaternion {if(!Number.isFinite(angle))throw new DeploymentError('INVALID_ANGLE');const v=scale(unit(axis),Math.sin(angle/2));return [...v,Math.cos(angle/2)];}
export function rotate(q:Quaternion,v:Vec3):Vec3 {const u:Vec3=[q[0],q[1],q[2]],t=scale(cross(u,v),2);return add(v,add(scale(t,q[3]),cross(u,t)));}
export function quaternionMatrix(q:Quaternion):Matrix3 {const x=rotate(q,[1,0,0]),y=rotate(q,[0,1,0]),z=rotate(q,[0,0,1]);return [x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]];}
export function rotatedInertia(inertia:Matrix3,q:Quaternion):Matrix3 {const r=quaternionMatrix(q);return matrixMultiply(matrixMultiply(r,inertia),transpose(r));}
export function parallelAxis(massKg:number,r:Vec3):Matrix3 {const r2=dot(r,r);return [r2-r[0]*r[0],-r[0]*r[1],-r[0]*r[2],-r[1]*r[0],r2-r[1]*r[1],-r[1]*r[2],-r[2]*r[0],-r[2]*r[1],r2-r[2]*r[2]].map(v=>massKg*v) as Matrix3;}
export function boxInertia(massKg:number,halfM:Vec3):Matrix3 {if(!Number.isFinite(massKg)||massKg<0||!finiteVector(halfM)||halfM.some(v=>v<=0))throw new DeploymentError('INVALID_MASS_ELEMENT');const [x,y,z]=halfM;return [massKg*(y*y+z*z)/3,0,0,0,massKg*(x*x+z*z)/3,0,0,0,massKg*(x*x+y*y)/3];}
export function freeze<T>(value:T):T {if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
