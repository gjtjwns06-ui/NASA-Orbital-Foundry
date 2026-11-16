import {it,expect} from 'vitest';
import {compileTopology,resolveDeploymentGeometry,uniformBoxMass} from '../src/deployment/kinematics';
import {advanceAngularState} from '../src/deployment/momentum';
import type {AngularState,MechanismTopology,Quaternion,Vec3} from '../src/deployment/types';

// Independent reference: explicit Rodrigues matrices, COM/inertia assembly,
// adjugate solve and quaternion ODE. No production FK, inertia, momentum solver
// or quaternion arithmetic is used inside the reference integrator.
type V=[number,number,number]; type Q=[number,number,number,number]; type M=number[];
const plus=(a:V,b:V):V=>a.map((v,i)=>v+b[i]) as V;
const minus=(a:V,b:V):V=>a.map((v,i)=>v-b[i]) as V;
const times=(a:V,k:number):V=>a.map(v=>v*k) as V;
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mv=(m:M,v:V):V=>[0,1,2].map(i=>m[i*3]*v[0]+m[i*3+1]*v[1]+m[i*3+2]*v[2]) as V;
const transpose=(a:M):M=>[a[0],a[3],a[6],a[1],a[4],a[7],a[2],a[5],a[8]];
const mm=(a:M,b:M):M=>Array.from({length:9},(_,p)=>{const i=Math.floor(p/3),j=p%3;return a[i*3]*b[j]+a[i*3+1]*b[3+j]+a[i*3+2]*b[6+j];});
const skewRotation=(axis:V,a:number):M=>{const [x,y,z]=axis,c=Math.cos(a),s=Math.sin(a),k=1-c;return [c+x*x*k,x*y*k-z*s,x*z*k+y*s,y*x*k+z*s,c+y*y*k,y*z*k-x*s,z*x*k-y*s,z*y*k+x*s,c+z*z*k];};
const parallel=(mass:number,r:V):M=>Array.from({length:9},(_,p)=>{const i=Math.floor(p/3),j=p%3;return mass*((i===j?r.reduce((s,v)=>s+v*v,0):0)-r[i]*r[j]);});
const box=(m:number,h:V):M=>[m*(h[1]**2+h[2]**2)/3,0,0,0,m*(h[0]**2+h[2]**2)/3,0,0,0,m*(h[0]**2+h[1]**2)/3];
const sum=(...ms:M[]):M=>ms[0].map((_,i)=>ms.reduce((v,m)=>v+m[i],0));
const inverse=(m:M):M=>{const [a,b,c,d,e,f,g,h,i]=m,adj=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d],det=a*adj[0]+b*adj[3]+c*adj[6];return adj.map(v=>v/det);};
const qmul=(a:Q,b:Q):Q=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const normal=(q:Q):Q=>{const n=Math.hypot(...q);return q.map(v=>v/n) as Q;};
const rotate=(q:Q,v:V):V=>qmul(qmul(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]).slice(0,3) as V;
const axis:V=[1/Math.sqrt(14),2/Math.sqrt(14),3/Math.sqrt(14)],pivot:V=[.3,.07,-.02],childPivot:V=[-.35,.02,0],m0=10,m1=.8;
const shape=(t:number)=>{const a=.3*Math.sin(.7*t),rate=.21*Math.cos(.7*t),R=mm(skewRotation(axis,a),skewRotation([1,0,0],.2)),offset=mv(R,childPivot),center=minus(pivot,offset),w=times(axis,rate),v=times(cross(w,offset),-1),com=times(center,m1/(m0+m1)),comV=times(v,m1/(m0+m1)),I1=mm(mm(R,box(m1,[.4,.1,.015])),transpose(R)),I=sum(box(m0,[.3,.22,.17]),parallel(m0,times(com,-1)),I1,parallel(m1,minus(center,com))),h=plus(mv(I1,w),plus(times(cross(times(com,-1),times(comV,-1)),m0),times(cross(minus(center,com),minus(v,comV)),m1)));return {I,h};};
const H=plus(mv(shape(0).I,[.01,-.02,.03]),shape(0).h);
const omega=(q:Q,t:number):V=>{const g=shape(t),bodyH=rotate([-q[0],-q[1],-q[2],q[3]],H);return mv(inverse(g.I),minus(bodyH,g.h));};
function reference(step:number){let q:Q=[0,0,0,1];const samples:Q[]=[];const derivative=(q0:Q,t:number):Q=>{const q=normal(q0),w=omega(q,t);return qmul(q,[...w,0]).map(v=>v/2) as Q;},offset=(q:Q,k:Q,s:number):Q=>q.map((v,i)=>v+k[i]*s) as Q;for(let n=0;n<Math.round(6/step);n++){const t=n*step,k1=derivative(q,t),k2=derivative(offset(q,k1,step/2),t+step/2),k3=derivative(offset(q,k2,step/2),t+step/2),k4=derivative(offset(q,k3,step),t+step);q=normal(q.map((v,i)=>v+step*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6) as Q);if((n+1)%Math.round(1/step)===0)samples.push([...q]);}return samples;}
it('matches a separately assembled asymmetric oblique-hinge quaternion/rate trajectory, not only conserved momentum',()=>{const input:MechanismTopology={version:'deployment-geometry-1',links:[{id:'bus',partId:'bus',rootPose:{positionM:[0,0,0],quaternion:[0,0,0,1]},boxes:[],massElements:[uniformBoxMass('bus',m0,[0,0,0],[.3,.22,.17])],apertures:[],render:{family:'bus',variant:'reference'}},{id:'leaf',partId:'leaf',boxes:[],massElements:[uniformBoxMass('leaf',m1,[0,0,0],[.4,.1,.015])],apertures:[],render:{family:'panel',variant:'reference'}}],joints:[{id:'joint',partId:'leaf',parentLinkId:'bus',childLinkId:'leaf',pivotParentM:pivot,pivotChildM:childPivot,axisParent:axis,restQuaternion:[Math.sin(.1),0,0,Math.cos(.1)],minimumRad:-1,maximumRad:1,stowedRad:0,deployedRad:.8}],contactExemptions:[]},compiled=compileTopology(input),at=(t:number)=>resolveDeploymentGeometry(compiled,{joint:{angleRad:.3*Math.sin(.7*t),rateRadS:.21*Math.cos(.7*t)}}),fine=reference(.0005),coarse=reference(.001);let state:AngularState={quaternion:[0,0,0,1],totalInertialMomentumNms:H as Vec3,wheelMomentumBodyNms:[0,0,0],angularVelocityBodyRadS:[.01,-.02,.03]};for(let n=0;n<48;n++){const t=n*.125;state=advanceAngularState(state,u=>at(t+u),.125).state;if((n+1)%8===0){const i=(n+1)/8-1;expect(Math.hypot(...fine[i].map((v,j)=>v-coarse[i][j]))).toBeLessThan(1e-11);expect(Math.hypot(...state.quaternion.map((v,j)=>v-fine[i][j]))).toBeLessThan(1e-7);expect(Math.hypot(...state.angularVelocityBodyRadS.map((v,j)=>v-omega(fine[i],i+1)[j]))).toBeLessThan(1e-7);const actual=at(i+1),expected=shape(i+1);for(let j=0;j<9;j++)expect(actual.mass.lockedInertiaKgM2[j]).toBeCloseTo(expected.I[j],12);for(let j=0;j<3;j++)expect(actual.mass.shapeMomentumNms[j]).toBeCloseTo(expected.h[j],12);}}});
