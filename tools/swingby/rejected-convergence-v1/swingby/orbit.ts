import {add,dot,magnitude,normalize,scale,sub,cross} from '../sim/physics';
import type {Vec3} from '../sim/types';
import {transferPlanetState} from '../transfer/ephemeris';
import {SUN_MU_KM3_S2} from '../transfer/math';
import type {TransferStateVector} from '../transfer/types';
import {getSwingbyScenario} from './scenario';
import {applyLocalImpulse,localArcFromCartesian,localArcPeriapsisTime,localArcRadiusTime,localArcStateAt,SWINGBY_MARS_RADIUS_KM,SwingbyError} from './conic';
import type {ExitMeasurement,LocalArc,SwingbyOrbitSolution} from './types';
export function swingbyStateAt(arcs:readonly LocalArc[],time:number):TransferStateVector {
 const scenario=getSwingbyScenario(),arc=[...arcs].reverse().find(a=>time>=a.epochSeconds-1e-9)??arcs[0],local=localArcStateAt(arc,time),jdTdb=scenario.epochJdTdb+time/86400,mars=transferPlanetState('mars',jdTdb),earth=transferPlanetState('earth',jdTdb);
 return {elapsedSeconds:time,jdTdb,phase:'mars-flyby',frame:'ICRF',heliocentricPositionKm:add(mars.positionKm,local.positionKm),heliocentricVelocityKmS:add(mars.velocityKmS,local.velocityKmS),relativePositionKm:local.positionKm,relativeVelocityKmS:local.velocityKmS,centerPositionKm:mars.positionKm,centerVelocityKmS:mars.velocityKmS,centerBody:'Mars',altitudeKm:magnitude(local.positionKm)-SWINGBY_MARS_RADIUS_KM,earth,mars};
}
export function measureSwingbyExit(arc:LocalArc):ExitMeasurement {
 const s=getSwingbyScenario(),time=localArcRadiusTime(arc,s.exit.radiusKm,'outbound'),v=swingbyStateAt([arc],time),energy=dot(v.heliocentricVelocityKmS,v.heliocentricVelocityKmS)/2-SUN_MU_KM3_S2/magnitude(v.heliocentricPositionKm),u=normalize(v.heliocentricVelocityKmS),directionErrorDeg=Math.atan2(magnitude(cross(u,s.exit.targetDirection)),dot(u,s.exit.targetDirection))*180/Math.PI;
 return {time,jdTdb:v.jdTdb,localPositionKm:v.relativePositionKm,localVelocityKmS:v.relativeVelocityKmS,heliocentricPositionKm:v.heliocentricPositionKm,heliocentricVelocityKmS:v.heliocentricVelocityKmS,outwardRadialSpeedKmS:dot(v.relativePositionKm,v.relativeVelocityKmS)/magnitude(v.relativePositionKm),energyKm2S2:energy,directionErrorDeg,directionPassed:directionErrorDeg<=s.exit.toleranceDeg,energyPassed:energy>=s.exit.energyRangeKm2S2[0]&&energy<=s.exit.energyRangeKm2S2[1]};
}
export function solveSwingbyControl(control:{xMps:number;yMps:number}):SwingbyOrbitSolution {
 const s=getSwingbyScenario(),{xMps,yMps}=control;if(!Number.isFinite(xMps)||!Number.isFinite(yMps)||Math.abs(xMps)>s.control.maxAxisMps+1e-10||Math.abs(yMps)>s.control.maxAxisMps+1e-10||Math.hypot(xMps,yMps)>s.control.maxMagnitudeMps+1e-10)throw new SwingbyError('CONTROL_RANGE');
 const original=localArcFromCartesian(s.initial),vectorMps=add(scale(s.controlX,xMps),scale(s.controlY,yMps)),corrected=applyLocalImpulse(original,s.correctionSeconds,vectorMps),periapsisSeconds=localArcPeriapsisTime(corrected),patchExitSeconds=localArcRadiusTime(corrected,s.patchRadiusKm,'outbound');
 return {correction:{time:s.correctionSeconds,xMps,yMps,vectorMps,residualKm:0},arcs:[original,corrected],periapsisSeconds,periapsisAltitudeKm:corrected.periapsisRadiusKm-SWINGBY_MARS_RADIUS_KM,exit:measureSwingbyExit(corrected),patchExitSeconds};
}
export function aimFromSwingbyControl(control:{xMps:number;yMps:number}) {
 const s=getSwingbyScenario(),orbit=solveSwingbyControl(control),arc=orbit.arcs[1],plane=s.aimPlane;let lo=s.correctionSeconds,hi=orbit.periapsisSeconds;
 const signed=(t:number)=>dot(sub(localArcStateAt(arc,t).positionKm,plane.centerKm),plane.normal);
 if(signed(lo)>=0||signed(hi)<=0)throw new SwingbyError('AIM_PLANE_MISSING');
 for(let i=0;i<60&&hi-lo>1e-8;i++){const mid=(lo+hi)/2;if(signed(mid)>0)hi=mid;else lo=mid;}
 const time=(lo+hi)/2,state=localArcStateAt(arc,time),offset=sub(state.positionKm,plane.centerKm);if(dot(state.velocityKmS,plane.normal)<=0)throw new SwingbyError('AIM_BRANCH');
 return {xKm:dot(offset,plane.xAxis),yKm:dot(offset,plane.yAxis),time,state};
}
export function solveSwingbyAim(aim:{xKm:number;yKm:number}):SwingbyOrbitSolution {
 if(!Number.isFinite(aim.xKm)||!Number.isFinite(aim.yKm)||Math.hypot(aim.xKm,aim.yKm)>5000)throw new SwingbyError('AIM_RANGE');
 let x=0,y=0;const tolerance=getSwingbyScenario().control.aimResidualKm;
 for(let iteration=0;iteration<16;iteration++){
  const p=aimFromSwingbyControl({xMps:x,yMps:y}),rx=aim.xKm-p.xKm,ry=aim.yKm-p.yKm,residual=Math.hypot(rx,ry);
  if(residual<=tolerance){const solution=solveSwingbyControl({xMps:x,yMps:y});solution.correction.residualKm=residual;return solution;}
  const feasible=(a:number,b:number)=>Math.abs(a)<=7&&Math.abs(b)<=7&&Math.hypot(a,b)<=8+1e-12;
  const dx=[.01,-.01].find(step=>feasible(x+step,y)),dy=[.01,-.01].find(step=>feasible(x,y+step));if(dx===undefined||dy===undefined)throw new SwingbyError('AIM_SINGULAR');
  const px=aimFromSwingbyControl({xMps:x+dx,yMps:y}),py=aimFromSwingbyControl({xMps:x,yMps:y+dy}),a=(px.xKm-p.xKm)/dx,b=(py.xKm-p.xKm)/dy,c=(px.yKm-p.yKm)/dx,d=(py.yKm-p.yKm)/dy,det=a*d-b*c;
  if(!Number.isFinite(det)||Math.abs(det)<1e-8)throw new SwingbyError('AIM_SINGULAR');
  const sx=(rx*d-b*ry)/det,sy=(a*ry-rx*c)/det;let accepted=false;
  // Project only trial controls into the trust region. Acceptance still demands
  // the original aim residual; unreachable target coordinates are never clamped.
  for(let j=0;j<12;j++){const factor=2**-j;let nx=Math.max(-7,Math.min(7,x+sx*factor)),ny=Math.max(-7,Math.min(7,y+sy*factor));const length=Math.hypot(nx,ny);if(length>8){nx*=8/length;ny*=8/length;}try{const q=aimFromSwingbyControl({xMps:nx,yMps:ny});if(Math.hypot(aim.xKm-q.xKm,aim.yKm-q.yKm)<residual){x=nx;y=ny;accepted=true;break;}}catch(e){if(!(e instanceof SwingbyError))throw e;}}
  if(!accepted)throw new SwingbyError('AIM_UNREACHABLE');
 }
 throw new SwingbyError('AIM_NO_CONVERGENCE');
}
