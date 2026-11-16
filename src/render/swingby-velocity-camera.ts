export type VelocityPoint=readonly [number,number,number];
/** Intersection of a DISPLAY direction ray with the shared direction plane.
 * The angle has already been magnified by the objective. This changes neither
 * that angle nor the recorded physical direction/pass status. */
export function velocityDirectionPlanePoint(direction:VelocityPoint,depth:number):[number,number,number]{
 if(![...direction,depth].every(Number.isFinite)||depth<=0||direction[2]<=0||Math.abs(Math.hypot(...direction)-1)>1e-5)throw new Error('Invalid display velocity direction.');
 const factor=depth/direction[2];return [direction[0]*factor,direction[1]*factor,depth];
}
/** Isotropic orthographic framing in CSS pixels. Zoom changes the entire
 * direction plane together, never the marker/tolerance relation. */
export function velocityInsetFrame(input:{width:number;height:number;goalRadius:number;tipPoints:readonly VelocityPoint[];targetGoalDiameterCssPx?:number}){
 const {width,height,goalRadius,tipPoints}=input,desired=input.targetGoalDiameterCssPx??70;
 if(![width,height,goalRadius,desired].every(Number.isFinite)||width<32||height<32||goalRadius<=0||desired<1)throw new Error('Invalid velocity inset viewport.');
 if(tipPoints.some(p=>p.length!==3||!p.every(Number.isFinite)))throw new Error('Invalid velocity inset marker.');
 const target=Math.min(desired,(Math.min(width,height)-24)*.85),nominalUnitsPerCssPx=goalRadius*2/target,padding=12;
 let unitsPerCssPx=nominalUnitsPerCssPx;
 for(const p of tipPoints)unitsPerCssPx=Math.max(unitsPerCssPx,Math.abs(p[0])/(width/2-padding),Math.abs(p[1])/(height/2-padding));
 // The ring and its ticks remain inside the inset even at unusually small sizes.
 unitsPerCssPx=Math.max(unitsPerCssPx,goalRadius*1.18/(width/2-padding),goalRadius*1.18/(height/2-padding));
 const halfWidth=width*unitsPerCssPx/2,halfHeight=height*unitsPerCssPx/2;
 return {left:-halfWidth,right:halfWidth,top:halfHeight,bottom:-halfHeight,unitsPerCssPx,
  targetGoalDiameterCssPx:target,goalDiameterCssPx:goalRadius*2/unitsPerCssPx,viewZoom:nominalUnitsPerCssPx/unitsPerCssPx,
  adapted:unitsPerCssPx>nominalUnitsPerCssPx*(1+1e-9),projection:'orthographic-direction-plane' as const};
}
