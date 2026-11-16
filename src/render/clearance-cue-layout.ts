/** CSS-pixel annotation layout only. This module never changes a camera,
 * geometry, clearance report or the authoritative craft. */
export interface CueRect {left:number;top:number;right:number;bottom:number}
export interface CuePoint {x:number;y:number;visible:boolean}
export interface CueCard {left:number;top:number;width:number;height:number;endX:number;endY:number}
const inside=(x:number,y:number,r:CueRect)=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const overlaps=(a:CueRect,b:CueRect,pad=0)=>a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;

/** Prefer nearby opposite sides of the two centers; every candidate is bounded
 * by the same unobscured viewport. If there is no readable placement, hide it. */
export function layoutClearanceCues(points:readonly CuePoint[],sizes:readonly {width:number;height:number}[],bounds:CueRect):(CueCard|null)[]{
 const placed:CueRect[]=[];
 return points.map((p,index)=>{
  const size=sizes[index];if(!size||![p.x,p.y,...Object.values(bounds),size.width,size.height].every(Number.isFinite)||!p.visible||!inside(p.x,p.y,bounds)||size.width<=0||size.height<=0||bounds.right-bounds.left<size.width||bounds.bottom-bounds.top<size.height)return null;
  const {width,height}=size,gap=26,preferred=index===0?-1:1;
  const candidates=[preferred,-preferred].flatMap(side=>[p.y-height/2,p.y-height-gap,p.y+gap].map(top=>({left:side<0?p.x-width-gap:p.x+gap,top})));
  candidates.push({left:bounds.left,top:bounds.top},{left:bounds.right-width,top:bounds.bottom-height});
  for(const candidate of candidates){
   const left=clamp(candidate.left,bounds.left,bounds.right-width),top=clamp(candidate.top,bounds.top,bounds.bottom-height),rect={left,top,right:left+width,bottom:top+height};
   if(placed.some(other=>overlaps(rect,other,8))||points.some(point=>point.visible&&inside(point.x,point.y,{left:rect.left-12,top:rect.top-12,right:rect.right+12,bottom:rect.bottom+12})))continue;
   placed.push(rect);return {left,top,width,height,endX:clamp(p.x,left,left+width),endY:clamp(p.y,top,top+height)};
  }
  return null;
 });
}
