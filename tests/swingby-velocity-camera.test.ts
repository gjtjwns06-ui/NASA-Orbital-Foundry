import {describe,it,expect} from 'vitest';
import {velocityDirectionPlanePoint,velocityInsetFrame} from '../src/render/swingby-velocity-camera';
import {magnifiedVelocityDirection} from '../src/render/swingby-objective';
const depth=1.8,tolerance=.12,magnification=40,goalRadius=depth*Math.tan(tolerance*magnification*Math.PI/180);
describe('honest velocity-plane inset',()=>{
 it('preserves the magnified ray angle and tolerance-side relation at the physical boundary',()=>{
  for(const degrees of [0,.06,.11999,.12,.12001,.24,1,2]){
   const a=degrees*Math.PI/180,d=magnifiedVelocityDirection([Math.sin(a),0,Math.cos(a)],[0,0,1],magnification),p=velocityDirectionPlanePoint(d.direction.toArray() as [number,number,number],depth);
   expect(Math.atan2(Math.hypot(p[0],p[1]),p[2])).toBeCloseTo(degrees*magnification*Math.PI/180,8);
   if(degrees<tolerance)expect(Math.hypot(p[0],p[1])).toBeLessThan(goalRadius);else if(degrees>tolerance)expect(Math.hypot(p[0],p[1])).toBeGreaterThan(goalRadius);
  }
 });
 it('makes the normal goal70CSSpx while accounting for title/footer space',()=>{
  const f=velocityInsetFrame({width:208,height:116,goalRadius,tipPoints:[[goalRadius*.9,0,depth]]});expect(f.goalDiameterCssPx).toBeCloseTo(70,12);expect(f.viewZoom).toBe(1);expect(f.adapted).toBe(false);
  const horizontal=(goalRadius-f.left)/(f.right-f.left)*208,center=(0-f.left)/(f.right-f.left)*208;expect((horizontal-center)*2).toBeCloseTo(70,10);
 });
 it('keeps far-outside actual/predicted tips visible by uniform labeled zoom without changing their positions',()=>{
  for(const [width,height] of [[208,116],[168,92],[320,180]])for(const multiplier of [1,3,15,130]){
   const points:[number,number,number][]=[[goalRadius*multiplier,goalRadius*.6,depth],[-goalRadius*2,-goalRadius*multiplier,depth]],before=structuredClone(points),f=velocityInsetFrame({width,height,goalRadius,tipPoints:points});
   for(const p of points){const x=(p[0]-f.left)/(f.right-f.left)*width,y=(f.top-p[1])/(f.top-f.bottom)*height;expect(x).toBeGreaterThanOrEqual(12-1e-9);expect(x).toBeLessThanOrEqual(width-12+1e-9);expect(y).toBeGreaterThanOrEqual(12-1e-9);expect(y).toBeLessThanOrEqual(height-12+1e-9);}
   expect(points).toEqual(before);expect(f.viewZoom).toBeLessThanOrEqual(1);expect(f.goalDiameterCssPx).toBeCloseTo(f.targetGoalDiameterCssPx*f.viewZoom,10);
  }
 });
 it('keeps an85degree display clamp visibly outside the regular goal and preserves its explicit clamp flag',()=>{
  const d=magnifiedVelocityDirection([1,0,0],[0,0,1],magnification),p=velocityDirectionPlanePoint(d.direction.toArray() as [number,number,number],depth),f=velocityInsetFrame({width:208,height:116,goalRadius,tipPoints:[p]});
  expect(d.clamped).toBe(true);expect(Math.hypot(p[0],p[1])).toBeGreaterThan(goalRadius*100);expect(f.adapted).toBe(true);expect(f.goalDiameterCssPx).toBeLessThan(5);
 });
 it('rejects invalid projections before producing an infinite camera or marker',()=>{
  expect(()=>velocityDirectionPlanePoint([1,0,0],depth)).toThrow();expect(()=>velocityDirectionPlanePoint([0,0,-1],depth)).toThrow();expect(()=>velocityInsetFrame({width:20,height:116,goalRadius,tipPoints:[]})).toThrow();expect(()=>velocityInsetFrame({width:208,height:116,goalRadius,tipPoints:[[NaN,0,depth]]})).toThrow();
 });
});
