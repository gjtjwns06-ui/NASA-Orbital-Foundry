/** Bounded zero-revolution Lambert and finite-boundary patched-conic mathematics. */
import {add,cross,dot,magnitude,normalize,propagateKepler,scale,sub} from '../sim/physics';
import type {OrbitalState,Vec3} from '../sim/types';
export const DAY_S=86400;
// JPL DE440 parameter, https://ssd.jpl.nasa.gov/astro_par.html (m³→km³).
export const SUN_MU_KM3_S2=132712440041.279419;
export const ECLIPTIC_NORTH_ICRF:Vec3=[0,-Math.sin(84381.448/3600*Math.PI/180),Math.cos(84381.448/3600*Math.PI/180)];
export type EphemerisRow=[number,number,number,number,number,number,number];
export interface EphemerisTable {body:string;timeScale:'TDB';frame:string;stepSeconds:number;states:EphemerisRow[]}
export interface LambertSolution {departureVelocityKmS:Vec3;arrivalVelocityKmS:Vec3;flightTimeSeconds:number;transferAngleRad:number;iterations:number;timeResidualSeconds:number;endpointErrorKm:number}
/** Cubic Hermite interpolation of geometric position AND velocity. No extrapolation. */
export function ephemerisAt(table:EphemerisTable,jdTdb:number):OrbitalState {
 const rows=table.states,first=rows[0],last=rows[rows.length-1];if(table.timeScale!=='TDB'||!Number.isFinite(jdTdb)||jdTdb<first[0]||jdTdb>last[0])throw new Error('Ephemeris epoch outside frozen TDB range');
 let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid][0]<=jdTdb)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],dt=(b[0]-a[0])*DAY_S,s=(jdTdb-a[0])*DAY_S/dt,s2=s*s,s3=s2*s;
 const p:Vec3=[0,0,0],v:Vec3=[0,0,0];
 for(let k=0;k<3;k++){p[k]=(2*s3-3*s2+1)*a[k+1]+(s3-2*s2+s)*dt*a[k+4]+(-2*s3+3*s2)*b[k+1]+(s3-s2)*dt*b[k+4];v[k]=((6*s2-6*s)*a[k+1]+(3*s2-4*s+1)*dt*a[k+4]+(-6*s2+6*s)*b[k+1]+(3*s2-2*s)*dt*b[k+4])/dt;}
 return {positionKm:p,velocityKmS:v};
}
function stumpff(z:number):[number,number]{if(Math.abs(z)<1e-6)return [.5-z/24+z*z/720-z*z*z/40320,1/6-z/120+z*z/5040-z*z*z/362880];const q=Math.sqrt(Math.abs(z));return z>0?[(1-Math.cos(q))/z,(q-Math.sin(q))/(q*q*q)]:[(Math.cosh(q)-1)/(-z),(Math.sinh(q)-q)/(q*q*q)];}
/** Bounded, zero-revolution universal-variable Lambert; no arbitrary spline or fake thrust.
 * Explicitly rejects collinear endpoints rather than choosing an undefined transfer plane.
 * The bracket is bounded below and at the first 4π² singularity; no multirevolution claim.
 */
export function solveLambert(r1:Vec3,r2:Vec3,flightTimeSeconds:number,mu=SUN_MU_KM3_S2,pole:Vec3=ECLIPTIC_NORTH_ICRF):LambertSolution {
 if(!r1.every(Number.isFinite)||!r2.every(Number.isFinite)||!Number.isFinite(flightTimeSeconds)||flightTimeSeconds<=0||!Number.isFinite(mu)||mu<=0)throw new Error('Invalid Lambert input');
 const R1=magnitude(r1),R2=magnitude(r2),cosTheta=Math.max(-1,Math.min(1,dot(r1,r2)/(R1*R2))),cross12=cross(r1,r2),sinAbs=magnitude(cross12)/(R1*R2);
 if(R1<=0||R2<=0||sinAbs<1e-7)throw new Error('Collinear Lambert endpoints require another plane/solver');
 const sinTheta=(dot(cross12,pole)>=0?1:-1)*sinAbs,A=sinTheta*Math.sqrt(R1*R2/(1-cosTheta));
 const transferAngleRad=(Math.atan2(sinTheta,cosTheta)+Math.PI*2)%(Math.PI*2);
 const at=(z:number)=>{const [C,S]=stumpff(z);if(C<=0)return null;const y=R1+R2+A*(z*S-1)/Math.sqrt(C);if(y<0)return null;const time=(Math.pow(y/C,1.5)*S+A*Math.sqrt(y))/Math.sqrt(mu);return Number.isFinite(time)&&time>=0?{time,y}:null;};
 let low=-4*Math.PI*Math.PI,high=4*Math.PI*Math.PI-1e-7,previous:{z:number;t:number}|null=null,bracketFound=false;
 // A bounded scan avoids Newton jumping into y<0 or another revolution branch.
 for(let i=0;i<=1024;i++){const z=low+(high-low)*i/1024,result=at(z);if(!result)continue;if(previous&&previous.t<=flightTimeSeconds&&result.time>=flightTimeSeconds){low=previous.z;high=z;bracketFound=true;break;}previous={z,t:result.time};}
 if(!bracketFound)throw new Error('No bounded zero-revolution Lambert bracket');
 let iterations=0,z=(low+high)/2,result=at(z)!;
 for(;iterations<90;iterations++){z=(low+high)/2;result=at(z)!;if(!result)throw new Error('Lambert bracket lost physical branch');if(Math.abs(result.time-flightTimeSeconds)<1e-7)break;if(result.time<flightTimeSeconds)low=z;else high=z;}
 const f=1-result.y/R1,g=A*Math.sqrt(result.y/mu),gdot=1-result.y/R2;
 if(Math.abs(g)<1e-10)throw new Error('Lambert singular f/g state');
 const departureVelocityKmS=scale(sub(r2,scale(r1,f)),1/g),arrivalVelocityKmS=scale(sub(scale(r2,gdot),r1),1/g);
 const propagated=propagateKepler({positionKm:r1,velocityKmS:departureVelocityKmS},flightTimeSeconds,mu),endpointErrorKm=magnitude(sub(propagated.positionKm,r2));
 if(!Number.isFinite(endpointErrorKm)||endpointErrorKm>.1)throw new Error(`Lambert endpoint residual ${endpointErrorKm} km exceeds solver bound`);
 return {departureVelocityKmS,arrivalVelocityKmS,flightTimeSeconds,transferAngleRad,iterations,timeResidualSeconds:result.time-flightTimeSeconds,endpointErrorKm};
}
export interface TransferProposal {departureJdTdb:number;arrivalJdTdb:number;flightTimeDays:number;lambert:LambertSolution;earth:OrbitalState;mars:OrbitalState;departureVInfinityKmS:Vec3;arrivalVInfinityKmS:Vec3;c3Km2S2:number;arrivalSpeedKmS:number;idealEscapeBurnFrom300KmMps:number}
export function solveTransfer(earthTable:EphemerisTable,marsTable:EphemerisTable,departureJdTdb:number,arrivalJdTdb:number):TransferProposal {
 const flightTimeDays=arrivalJdTdb-departureJdTdb;if(flightTimeDays<120||flightTimeDays>450)throw new Error('Supported flight time is 120–450 day transfers');
 const earth=ephemerisAt(earthTable,departureJdTdb),mars=ephemerisAt(marsTable,arrivalJdTdb),lambert=solveLambert(earth.positionKm,mars.positionKm,flightTimeDays*DAY_S);
 const departureVInfinityKmS=sub(lambert.departureVelocityKmS,earth.velocityKmS),arrivalVInfinityKmS=sub(lambert.arrivalVelocityKmS,mars.velocityKmS),c3Km2S2=dot(departureVInfinityKmS,departureVInfinityKmS),arrivalSpeedKmS=magnitude(arrivalVInfinityKmS);
 // Scalar ideal aligned impulsive escape: NOT a solved parking-plane/launch-site trajectory.
 const muEarth=398600.435507,rParking=6378.137+300,idealEscapeBurnFrom300KmMps=(Math.sqrt(c3Km2S2+2*muEarth/rParking)-Math.sqrt(muEarth/rParking))*1000;
 return {departureJdTdb,arrivalJdTdb,flightTimeDays,lambert,earth,mars,departureVInfinityKmS,arrivalVInfinityKmS,c3Km2S2,arrivalSpeedKmS,idealEscapeBurnFrom300KmMps};
}
/** A genuine incoming-asymptote-oriented hyperbola, useful to seed a future SOI shooter.
 * Does not pretend this finite state already joins the centre-to-centre Lambert arc.
 */
export function asymptoteFlyby(vInfinity:Vec3,periapsisRadiusKm:number,bPlaneAngleRad:number,boundaryRadiusKm=577000,muMars=42828.375214){
 const speed=magnitude(vInfinity);if(speed<=0||periapsisRadiusKm<=3389.5||boundaryRadiusKm<=periapsisRadiusKm)throw new Error('Invalid flyby geometry');
 const S=normalize(vInfinity),reference=Math.abs(dot(S,ECLIPTIC_NORTH_ICRF))>.95?[1,0,0] as Vec3:ECLIPTIC_NORTH_ICRF,T=normalize(cross(S,reference)),R=normalize(cross(S,T)),Bhat=add(scale(T,Math.cos(bPlaneAngleRad)),scale(R,Math.sin(bPlaneAngleRad))),hhat=normalize(cross(Bhat,S));
 const e=1+periapsisRadiusKm*speed*speed/muMars,qFactor=Math.sqrt(e*e-1),p=scale(add(S,scale(Bhat,qFactor)),1/e),q=cross(hhat,p),a=muMars/(speed*speed),parameter=a*(e*e-1),anomaly=Math.acos((parameter/boundaryRadiusKm-1)/e);
 const state=(nu:number):OrbitalState=>({positionKm:scale(add(scale(p,Math.cos(nu)),scale(q,Math.sin(nu))),parameter/(1+e*Math.cos(nu))),velocityKmS:scale(add(scale(p,-Math.sin(nu)),scale(q,e+Math.cos(nu))),Math.sqrt(muMars/parameter))});
 const incoming=state(-anomaly),outgoing=state(anomaly),vinfOut=scale(add(scale(p,-1/e),scale(q,qFactor/e)),speed),H=Math.acosh((boundaryRadiusKm/a+1)/e),secondsToPeriapsis=Math.sqrt(a*a*a/muMars)*(e*Math.sinh(H)-H);
 return {incoming,outgoing,periapsis:state(0),secondsToPeriapsis,turnAngleRad:2*Math.asin(1/e),eccentricity:e,impactParameterKm:periapsisRadiusKm*Math.sqrt(1+2*muMars/(periapsisRadiusKm*speed*speed)),vInfinityOutgoingKmS:vinfOut};
}
function solveLinear(matrix:number[][],rhs:number[]):number[]{
 const a=matrix.map((row,i)=>[...row,rhs[i]]),n=rhs.length;
 for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;if(Math.abs(a[pivot][i])<1e-10)throw new Error('Singular SOI targeting Jacobian');[a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];for(let k=i;k<=n;k++)a[i][k]/=d;for(let j=0;j<n;j++)if(j!==i){const f=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=f*a[i][k];}}
 return a.map(row=>row[n]);
}
export interface PatchedTransferRequest {
 departurePeriapsisJdTdb:number;arrivalPeriapsisJdTdb:number;
 earthParkingAltitudeKm:number;marsPeriapsisAltitudeKm:number;
 departurePlaneAngleRad:number;marsBPlaneAngleRad:number;
 earthBoundaryRadiusKm?:number;marsBoundaryRadiusKm?:number;
}
/** Six-variable differential correction enforcing BOTH r and v at finite patch surfaces.
 * Local departure is a time-reversed incoming hyperbola; the assumed circular
 * parking orbit is coplanar with its periapsis velocity. Launch-site accessibility
 * and circular-orbit rendezvous are not solved. Boundary gravity switches abruptly.
 */
export function solvePatchedTransfer(earthTable:EphemerisTable,marsTable:EphemerisTable,request:PatchedTransferRequest){
 const central=solveTransfer(earthTable,marsTable,request.departurePeriapsisJdTdb,request.arrivalPeriapsisJdTdb),muEarth=398600.435507,muMars=42828.375214,earthRadius=6378.137+request.earthParkingAltitudeKm,marsRadius=3389.5+request.marsPeriapsisAltitudeKm;
 if(earthRadius<=6378.137||marsRadius<=3389.5)throw new Error('Periapsis must be above the body');
 const earthBoundary=request.earthBoundaryRadiusKm??924000,marsBoundary=request.marsBoundaryRadiusKm??577000;
 const evaluate=(x:number[])=>{
  const departureVInfinityKmS=x.slice(0,3) as Vec3,arrivalVInfinityKmS=x.slice(3) as Vec3;
  const reversedEarth=asymptoteFlyby(scale(departureVInfinityKmS,-1),earthRadius,request.departurePlaneAngleRad,earthBoundary,muEarth),marsLocal=asymptoteFlyby(arrivalVInfinityKmS,marsRadius,request.marsBPlaneAngleRad,marsBoundary,muMars);
  const earthLocalExit:OrbitalState={positionKm:reversedEarth.incoming.positionKm,velocityKmS:scale(reversedEarth.incoming.velocityKmS,-1)},earthLocalPeriapsis:OrbitalState={positionKm:reversedEarth.periapsis.positionKm,velocityKmS:scale(reversedEarth.periapsis.velocityKmS,-1)};
  const exitJdTdb=request.departurePeriapsisJdTdb+reversedEarth.secondsToPeriapsis/DAY_S,entryJdTdb=request.arrivalPeriapsisJdTdb-marsLocal.secondsToPeriapsis/DAY_S;
  const earthAtExit=ephemerisAt(earthTable,exitJdTdb),marsAtEntry=ephemerisAt(marsTable,entryJdTdb),coastInitialPositionKm=add(earthAtExit.positionKm,earthLocalExit.positionKm),coastFinalPositionKm=add(marsAtEntry.positionKm,marsLocal.incoming.positionKm),coast=solveLambert(coastInitialPositionKm,coastFinalPositionKm,(entryJdTdb-exitJdTdb)*DAY_S);
  const departureVelocityResidual=sub(coast.departureVelocityKmS,add(earthAtExit.velocityKmS,earthLocalExit.velocityKmS)),arrivalVelocityResidual=sub(coast.arrivalVelocityKmS,add(marsAtEntry.velocityKmS,marsLocal.incoming.velocityKmS)),residual=[...departureVelocityResidual,...arrivalVelocityResidual];
  return {departureVInfinityKmS,arrivalVInfinityKmS,earthLocalExit,earthLocalPeriapsis,marsLocal,exitJdTdb,entryJdTdb,earthAtExit,marsAtEntry,coastInitialPositionKm,coastFinalPositionKm,coast,residual,residualNorm:Math.hypot(...residual)};
 };
 let variables=[...central.departureVInfinityKmS,...central.arrivalVInfinityKmS],solution=evaluate(variables),iterations=0;
 for(;iterations<14&&solution.residualNorm>1e-8;iterations++){
  const h=1e-4,jac=Array.from({length:6},()=>Array(6).fill(0));
  for(let k=0;k<6;k++){const perturbed=[...variables];perturbed[k]+=h;const f=evaluate(perturbed).residual;for(let row=0;row<6;row++)jac[row][k]=(f[row]-solution.residual[row])/h;}
  const delta=solveLinear(jac,solution.residual.map(v=>-v));let accepted=false;
  for(let damping=1;damping>=1/128;damping/=2){const nextVariables=variables.map((v,i)=>v+damping*delta[i]);try{const next=evaluate(nextVariables);if(next.residualNorm<solution.residualNorm){variables=nextVariables;solution=next;accepted=true;break;}}catch{/* A trial can leave the bounded physical branch. */}}
  if(!accepted)throw new Error('Finite-SOI differential correction did not improve');
 }
 if(solution.residualNorm>1e-8)throw new Error(`Finite-SOI residual ${solution.residualNorm} km/s exceeds bound`);
 const c3Km2S2=dot(solution.departureVInfinityKmS,solution.departureVInfinityKmS),escapeBurnMps=(magnitude(solution.earthLocalPeriapsis.velocityKmS)-Math.sqrt(muEarth/earthRadius))*1000;
 return {request,iterations,...solution,c3Km2S2,escapeBurnMps,arrivalSpeedKmS:magnitude(solution.arrivalVInfinityKmS),earthBoundaryRadiusKm:earthBoundary,marsBoundaryRadiusKm:marsBoundary,model:'continuous-position/velocity finite-boundary patched conics; central Earth / central Sun / central Mars; ephemeris origins'};
}
/** Stable local hyperbola propagation from periapsis; avoids huge universal-anomaly guesses. */
export function hyperbolicLocalStateAt(periapsis:OrbitalState,mu:number,secondsFromPeriapsis:number):OrbitalState {
 const rp=magnitude(periapsis.positionKm),v2=dot(periapsis.velocityKmS,periapsis.velocityKmS),energy=v2/2-mu/rp;
 if(energy<=0||Math.abs(dot(periapsis.positionKm,periapsis.velocityKmS))/(rp*Math.sqrt(v2))>1e-8)throw new Error('Expected a hyperbolic periapsis state');
 const a=mu/(2*energy),e=1+rp/a,p=normalize(periapsis.positionKm),q=normalize(periapsis.velocityKmS),M=secondsFromPeriapsis*Math.sqrt(mu/(a*a*a));let H=Math.asinh(M/e);
 for(let i=0;i<40;i++){const delta=(e*Math.sinh(H)-H-M)/(e*Math.cosh(H)-1);H-=delta;if(Math.abs(delta)<1e-13)break;}
 const sinh=Math.sinh(H),cosh=Math.cosh(H),root=Math.sqrt(e*e-1),factor=Math.sqrt(mu/a)/(e*cosh-1);
 return {positionKm:add(scale(p,a*(e-cosh)),scale(q,a*root*sinh)),velocityKmS:add(scale(p,-factor*sinh),scale(q,factor*root*cosh))};
}

