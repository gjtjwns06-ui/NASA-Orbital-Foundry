import type { Vec3 } from '../sim/types';

const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const finite=(v:Vec3)=>v.every(Number.isFinite);
const unit=(v:Vec3):Vec3|null=>{const n=Math.hypot(...v);return finite(v)&&n>1e-12?v.map(x=>x/n) as Vec3:null;};

/** Closest positive-ray point to the radial axis through the planet centre.
 * Returns distance along that axis in display units. Near-parallel viewing
 * directions have no usable drag projection and deliberately return null.
 */
export function radialRayParameter(origin:Vec3,direction:Vec3,axis:Vec3):number|null {
 const d=unit(direction),a=unit(axis);if(!finite(origin)||!d||!a)return null;
 const c=dot(d,a),denominator=1-c*c;if(denominator<1e-5)return null;
 const s=(dot(a,origin)-c*dot(d,origin))/denominator;
 const alongRay=c*s-dot(d,origin);
 return Number.isFinite(s)&&alongRay>=0?s:null;
}

/** Render-space ring around the X axis: zero degrees points along -Z and +90 along +Y.
 * This is the same [x,z,-y] transform used by the physical orbit renderer.
 */
export function planeAngleFromRay(origin:Vec3,direction:Vec3,planeX=0):number|null {
 const d=unit(direction);if(!finite(origin)||!Number.isFinite(planeX)||!d||Math.abs(d[0])<1e-5)return null;
 const t=(planeX-origin[0])/d[0];if(t<0)return null;
 const y=origin[1]+t*d[1],z=origin[2]+t*d[2];if(Math.hypot(y,z)<1e-9)return null;
 return Math.atan2(y,-z)*180/Math.PI;
}

export function angularDragDelta(previous:number,next:number):number {
 return ((next-previous+540)%360)-180;
}

export function isOrbitShapeHandle(handle:string):boolean {
 return handle==='earth-periapsis'||handle==='earth-apoapsis'||handle==='earth-plane';
}
