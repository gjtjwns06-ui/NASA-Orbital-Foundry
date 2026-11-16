import type {ConjunctionMetrics,Design,OrbitalState,Vec3} from './types';
import {add,circularState,cross,dot,EARTH_MU,earthStateAt,getManeuvers,magnitude,normalize,propagateKepler,scale,sub} from './physics';
export const CONJUNCTION_REFERENCE_TIME=3600;
export const CONJUNCTION_FORECAST_TIME=900;
export const CONJUNCTION_WINDOW:[number,number]=[3510,3690];
export const CONJUNCTION_SEPARATION_KM=2;
export const CONJUNCTION_CONTACT_KM=.02;
const nominal=circularState(600,51.6,CONJUNCTION_REFERENCE_TIME),normal=normalize(cross(nominal.positionKm,nominal.velocityKmS));
// Synthetic known debris state at one epoch; its entire path is then a gravitational two-body trajectory.
const debrisAtEpoch:OrbitalState={positionKm:add(nominal.positionKm,scale(normal,.5)),velocityKmS:add(scale(nominal.velocityKmS,-1),scale(normal,.45))};
export function debrisStateAt(t:number):OrbitalState{return propagateKepler(debrisAtEpoch,t-CONJUNCTION_REFERENCE_TIME,EARTH_MU);}
const cache=new WeakMap<Design,{key:string;value:ConjunctionMetrics}>();
export function conjunctionMetrics(design:Design):ConjunctionMetrics {
 if(design.missionId!=='earth'||design.hazard!=='debris')return {enabled:false,time:CONJUNCTION_REFERENCE_TIME,minDistanceKm:Infinity,relativeSpeedKmS:0,safe:true,contact:false,thresholdKm:CONJUNCTION_SEPARATION_KM,contactThresholdKm:CONJUNCTION_CONTACT_KM,spacecraftPositionKm:[0,0,0],debrisPositionKm:[0,0,0]};
 const key=JSON.stringify(design.plan.earthOrbit!==undefined?[design.plan.altitudeKm,design.plan.inclinationDeg,getManeuvers(design.plan),design.plan.earthOrbit]:[design.plan.altitudeKm,design.plan.inclinationDeg,getManeuvers(design.plan)]),prior=cache.get(design);if(prior?.key===key)return prior.value;
 const distanceSquared=(t:number)=>{const delta=sub(earthStateAt(design.plan,t).positionKm,debrisStateAt(t).positionKm);return dot(delta,delta);};
 const [start,end]=CONJUNCTION_WINDOW,spacing=2;
 let minimumTime=start,minimum=distanceSquared(start);
 for(let t=start+spacing;t<=end;t+=spacing){const d=distanceSquared(t);if(d<minimum){minimum=d;minimumTime=t;}}
 // Refine the best sampled basin. Bounds/endpoints remain candidates, so no unbounded extrapolation is accepted.
 let left=Math.max(start,minimumTime-spacing),right=Math.min(end,minimumTime+spacing);const ratio=(Math.sqrt(5)-1)/2;
 let a=right-ratio*(right-left),b=left+ratio*(right-left),fa=distanceSquared(a),fb=distanceSquared(b);
 for(let k=0;k<48&&right-left>1e-7;k++){if(fa<fb){right=b;b=a;fb=fa;a=right-ratio*(right-left);fa=distanceSquared(a);}else{left=a;a=b;fa=fb;b=left+ratio*(right-left);fb=distanceSquared(b);}}
 for(const t of [left,right,(left+right)/2,start,end]){const d=distanceSquared(t);if(d<minimum){minimum=d;minimumTime=t;}}
 const own=earthStateAt(design.plan,minimumTime),other=debrisStateAt(minimumTime),minDistanceKm=Math.sqrt(minimum);
 const value:ConjunctionMetrics={enabled:true,time:minimumTime,minDistanceKm,relativeSpeedKmS:magnitude(sub(own.velocityKmS,other.velocityKmS)),safe:minDistanceKm>=CONJUNCTION_SEPARATION_KM,contact:minDistanceKm<CONJUNCTION_CONTACT_KM,thresholdKm:CONJUNCTION_SEPARATION_KM,contactThresholdKm:CONJUNCTION_CONTACT_KM,spacecraftPositionKm:own.positionKm,debrisPositionKm:other.positionKm};
 cache.set(design,{key,value});return value;
}
