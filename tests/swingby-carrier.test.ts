import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {SwingbyCarrier,type SwingbyCarrierProfile} from '../src/render/swingby-carrier';
const profile=():SwingbyCarrierProfile=>({id:'authored-cg-trim-v1',hash:'provisional-test-profile',provenance:'game-assumption',carrierMassKg:.4,carrierCost:12,maximumGimbalDeg:10,geometry:{envelope:{center:[0,0,.3],half:[.19,.19,.3]},annulus:{center:[0,0,.07],outerRadiusM:.18,innerRadiusM:.07,thicknessM:.04},pivot:[0,0,.12],nominalThrust:[0,0,-1],bell:{lengthM:.46,mouthRadiusM:.10,neckRadiusM:.025}}});
describe('scenario-only gimbal carrier',()=>{
 it('keeps every rendered vertex in the physical envelope through300allowed gimbal directions',()=>{
  const engine=new THREE.Group(),carrier=new SwingbyCarrier(engine,profile()),limit=new THREE.Box3(new THREE.Vector3(-.1900001,-.1900001,-.0000001),new THREE.Vector3(.1900001,.1900001,.6000001));
  engine.position.set(5,7,-2);engine.rotation.set(.4,-.7,1.1);
  for(let i=0;i<300;i++){
   const angle=(i%6)/5*10*Math.PI/180,azimuth=i*Math.PI*2/300;expect(carrier.setThrustDirection([Math.sin(angle)*Math.cos(azimuth),Math.sin(angle)*Math.sin(azimuth),-Math.cos(angle)])).toBe(true);
   engine.updateMatrixWorld(true);const inverse=engine.matrixWorld.clone().invert(),point=new THREE.Vector3();let allInside=true;carrier.group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const matrix=inverse.clone().multiply(o.matrixWorld),a=o.geometry.getAttribute('position');for(let p=0;p<a.count;p++)if(!limit.containsPoint(point.fromBufferAttribute(a,p).applyMatrix4(matrix)))allInside=false;});expect(allInside,`gimbal sample ${i}`).toBe(true);
  }carrier.dispose();
 });
 it('rejects excess angle and nonfinite directions without changing the accepted nozzle',()=>{
  const c=new SwingbyCarrier(new THREE.Group(),profile());expect(c.setThrustDirection([0,Math.sin(.1),-Math.cos(.1)])).toBe(true);const before=c.getState(),q=c.nozzle.quaternion.clone();expect(c.setThrustDirection([1,0,0])).toBe(false);expect(c.setThrustDirection([NaN,0,-1])).toBe(false);expect(c.getState()).toEqual(before);expect(c.nozzle.quaternion.equals(q)).toBe(true);c.dispose();
 });
 it('temporarily hides stock geometry and exactly restores visibility without disposing borrowed resources',()=>{
  const engine=new THREE.Group(),g=new THREE.BoxGeometry(),m=new THREE.MeshStandardMaterial(),a=new THREE.Mesh(g,m),b=new THREE.Mesh(g,m);b.visible=false;engine.add(a,b);const oldDispose=vi.fn();g.addEventListener('dispose',oldDispose);m.addEventListener('dispose',oldDispose);
  const c=new SwingbyCarrier(engine,profile());expect(a.visible).toBe(false);expect(b.visible).toBe(false);expect(()=>new SwingbyCarrier(engine,profile())).toThrow(/already/);
  const resources=new Set<THREE.BufferGeometry|THREE.Material>();c.group.traverse(o=>{if(o instanceof THREE.Mesh){resources.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material])resources.add(mat);}});const ownDispose=vi.fn();resources.forEach(r=>r.addEventListener('dispose',ownDispose));c.dispose();c.dispose();expect(a.visible).toBe(true);expect(b.visible).toBe(false);expect(engine.children).toEqual([a,b]);expect(oldDispose).not.toHaveBeenCalled();expect(ownDispose).toHaveBeenCalledTimes(resources.size);g.dispose();m.dispose();
 });
 it('exposes the authored centroid/profile without changing caller data',()=>{
  const p=profile(),before=structuredClone(p),c=new SwingbyCarrier(new THREE.Group(),p);expect(c.getState().carrierCentroidM).toEqual([0,0,.07]);expect(c.getState().profileHash).toBe(p.hash);expect(p).toEqual(before);p.geometry.annulus.center=[1,2,3];expect(c.getState().carrierCentroidM).toEqual([0,0,.07]);c.dispose();
 });
});
