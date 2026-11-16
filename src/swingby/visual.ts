import {dot,magnitude,scale,sub,add} from '../sim/physics';
import type {Vec3} from '../sim/types';
import {localArcPeriapsisTime,localArcRadiusTime,localArcStateAt,SWINGBY_MARS_RADIUS_KM} from './conic';
import {swingbyStateAt} from './orbit';
import {getSwingbyScenario} from './scenario';
import type {LocalArc,SwingbyRuntime,SwingbySolution} from './types';

export const SWINGBY_VISUAL_CHORD_TOLERANCE_KM=2;
export const SWINGBY_VISUAL_MAX_SAMPLES=2000;
export interface SwingbyVisualAnchor {kind:'start'|'correction'|'periapsis'|'exit'|'surface'|'current'|'endpoint';time:number}
const chordAltitude=(a:Vec3,b:Vec3)=>{const d=sub(b,a),d2=dot(d,d),f=d2?Math.max(0,Math.min(1,-dot(a,d)/d2)):0;return magnitude(add(a,scale(d,f)))-SWINGBY_MARS_RADIUS_KM;};

/** Visual-only local-ICRF path. No runtime stepping, altered conic or inferred achievement.
 * For each smooth arc, ||r(t)-linear(t)|| <= max||r''||*dt²/8. The analytic
 * minimum radius supplies max||r''||=mu/rmin². Impulses are explicit anchors.
 * A cap failure is exposed, never silently described as a certified path.
 */
export function getSwingbyVisualTrajectory(source:SwingbySolution|SwingbyRuntime){
 const runtime='actualArcs'in source,arcs=runtime?source.actualArcs:source.arcs,s=getSwingbyScenario(),end=runtime?Math.min(s.deadlineSeconds,source.actualPatchExitSeconds):source.patchExitSeconds,anchors:SwingbyVisualAnchor[]=[{kind:'start',time:0},{kind:'endpoint',time:end}];
 const anchor=(kind:SwingbyVisualAnchor['kind'],time:number)=>{if(Number.isFinite(time)&&time>=0&&time<=end)anchors.push({kind,time});};
 for(let i=0;i<arcs.length;i++){
  const arc=arcs[i],start=Math.max(0,arc.epochSeconds),stop=Math.min(end,arcs[i+1]?.epochSeconds??end),within=(t:number)=>t>=start&&t<=stop;
  if(i>0)anchor('correction',arc.epochSeconds);const peri=localArcPeriapsisTime(arc);if(within(peri))anchor('periapsis',peri);
  if(arc.periapsisRadiusKm<=s.exit.radiusKm){const exit=localArcRadiusTime(arc,s.exit.radiusKm,'outbound');if(within(exit))anchor('exit',exit);}
  if(arc.periapsisRadiusKm<=SWINGBY_MARS_RADIUS_KM)for(const branch of ['inbound','outbound'] as const){const t=localArcRadiusTime(arc,SWINGBY_MARS_RADIUS_KM,branch);if(within(t))anchor('surface',t);}
 }
 if(runtime)anchor('current',source.time);
 const times=[...new Set(anchors.map(a=>a.time))].sort((a,b)=>a-b),arcAt=(time:number):LocalArc=>[...arcs].reverse().find(a=>time>=a.epochSeconds)??arcs[0];
 const error=(a:number,b:number)=>{const arc=arcAt((a+b)/2),peri=localArcPeriapsisTime(arc),rmin=peri>=a&&peri<=b?arc.periapsisRadiusKm:Math.min(magnitude(localArcStateAt(arc,a).positionKm),magnitude(localArcStateAt(arc,b).positionKm));return arc.muKm3S2/rmin**2*(b-a)**2/8;};
 // Split the worst interval first. Near-periapsis curvature receives the samples;
 // far-field straight sections remain economical without losing the same bound.
 let errors=times.slice(1).map((t,i)=>error(times[i],t));
 while(times.length<SWINGBY_VISUAL_MAX_SAMPLES){let index=0;for(let i=1;i<errors.length;i++)if(errors[i]>errors[index])index=i;if(errors[index]<=SWINGBY_VISUAL_CHORD_TOLERANCE_KM)break;const mid=(times[index]+times[index+1])/2,a=times[index],b=times[index+1];times.splice(index+1,0,mid);errors.splice(index,1,error(a,mid),error(mid,b));}
 const points=times.map(t=>swingbyStateAt(arcs,t)),maxChordErrorKm=Math.max(0,...errors),minimumChordAltitudeKm=Math.min(...points.slice(1).map((p,i)=>chordAltitude(points[i].relativePositionKm,p.relativePositionKm)));
 return {points,anchors:anchors.sort((a,b)=>a.time-b.time||a.kind.localeCompare(b.kind)),certified:maxChordErrorKm<=SWINGBY_VISUAL_CHORD_TOLERANCE_KM,maxChordErrorKm,minimumChordAltitudeKm,toleranceKm:SWINGBY_VISUAL_CHORD_TOLERANCE_KM,maxSamples:SWINGBY_VISUAL_MAX_SAMPLES};
}
