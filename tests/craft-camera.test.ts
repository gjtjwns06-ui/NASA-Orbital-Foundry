import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {boundsCorners,CraftInspectionCamera,inspectionFit,inspectionLayout,type CraftCameraFrame,type InspectionControls} from '../src/render/craft-camera';

const bounds=new THREE.Box3(new THREE.Vector3(-3,-1,-1),new THREE.Vector3(3,1,1));
const frame=(overrides:Partial<CraftCameraFrame>={}):CraftCameraFrame=>({position:new THREE.Vector3(0,0,3.23),quaternion:new THREE.Quaternion(),bounds,preferredScale:.18,minimumClearance:.23,obstacles:[{center:new THREE.Vector3(),radius:3}],initialDirection:new THREE.Vector3(.3,.2,1),frameKey:'mars-flyby',...overrides});
function rig(){
  const camera=new THREE.PerspectiveCamera(43,1280/720,.025,10000);camera.position.set(9,6,12);
  const controls:InspectionControls={target:new THREE.Vector3(),enabled:true,enablePan:true,enableDamping:true,minDistance:4.1,maxDistance:4000,minPolarAngle:0,maxPolarAngle:Math.PI*.92,minAzimuthAngle:-Infinity,maxAzimuthAngle:Infinity,update:()=>{camera.lookAt(controls.target);}};
  controls.update();const controller=new CraftInspectionCamera(camera,controls);controller.setViewport(1280,720,{left:280,right:300,top:130,bottom:160});
  return {camera,controls,controller};
}
describe('live craft inspection camera, display-only safety and fit',()=>{
  it('rejects invalid bounds, empty viewport and unsafe planet intersection before changing camera',()=>{
    expect(()=>inspectionFit(1280,720,43,{left:900,right:400,top:0,bottom:0})).toThrow();
    expect(()=>inspectionLayout(frame({position:new THREE.Vector3(0,0,2.9)}),5)).toThrow('inside');
    expect(()=>inspectionLayout(frame({bounds:new THREE.Box3()}),5)).toThrow('Invalid');
    expect(()=>inspectionLayout(frame({preferredScale:NaN}),5)).toThrow('Invalid');
  });
  it('reduces only exaggerated scale so a whole six-wing craft and every orbit angle remain outside low Mars',()=>{
    const original=frame(),before=JSON.stringify({position:original.position,quaternion:original.quaternion,bounds:original.bounds});
    const fit=inspectionFit(1280,720,43,{left:280,right:300,top:130,bottom:160}),layout=inspectionLayout(original,fit.distancePerRadius);
    expect(layout.scale).toBeLessThan(.18);expect(layout.scale).toBeGreaterThan(0);
    for(let i=0;i<300;i++){
      const direction=new THREE.Vector3(Math.cos(i*2.1)*Math.sin(i*.7),Math.sin(i*2.1)*Math.sin(i*.7),Math.cos(i*.7)).normalize();
      const position=layout.target.clone().addScaledVector(direction,layout.maxDistance);
      expect(position.length()).toBeGreaterThan(3);
    }
    expect(original.position.length()-layout.envelopeRadius).toBeGreaterThan(3);
    expect(JSON.stringify({position:original.position,quaternion:original.quaternion,bounds:original.bounds})).toBe(before);
  });
  it.each([{left:280,right:300,top:130,bottom:160},{left:330,right:340,top:154,bottom:190}])('fits actual mounted corners in safe UI rectangle %j at every inertial attitude',insets=>{
    const {camera,controls,controller}=rig();controller.setViewport(1280,720,insets);controller.enter();
    for(let i=0;i<20;i++){
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(i*.37,i*.71,i*.19)),f=frame({quaternion:q});controller.requestFit();const layout=controller.update(f);
      camera.updateMatrixWorld();
      for(const point of boundsCorners(bounds)){
        const p=point.multiplyScalar(layout.scale).applyQuaternion(q).add(f.position).project(camera),x=(p.x+1)*640,y=(1-p.y)*360;
        expect(x).toBeGreaterThan(insets.left);expect(x).toBeLessThan(1280-insets.right);expect(y).toBeGreaterThan(insets.top);expect(y).toBeLessThan(720-insets.bottom);expect(p.z).toBeGreaterThan(-1);expect(p.z).toBeLessThan(1);
      }
      expect(controls.enablePan).toBe(false);
    }
  });
  it('follows true position without changing a player orbit or rotating the craft',()=>{
    const {camera,controls,controller}=rig();controller.enter();controller.update(frame());
    const direction=new THREE.Vector3(.8,.4,-.3).normalize();camera.position.copy(controls.target).addScaledVector(direction,.1);
    const f=frame({position:new THREE.Vector3(.1,.2,3.25)}),quaternion=f.quaternion.toArray();controller.update(f);
    expect(camera.position.clone().sub(controls.target).normalize().distanceTo(direction)).toBeLessThan(1e-12);
    expect(f.quaternion.toArray()).toEqual(quaternion);expect(controls.target.toArray()).toEqual(f.position.toArray());
  });
  it('preserves relative zoom and inertial view through a solar/local frame change',()=>{
    const {camera,controls,controller}=rig();controller.enter();controller.update(frame());
    const before=controller.getState(),direction=camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(direction,before.fitDistance!*1.5);
    controller.update(frame({frameKey:'solar-coast',position:new THREE.Vector3(11,0,2),minimumClearance:undefined,obstacles:[],preferredScale:.115}));
    const after=controller.getState();expect(after.frameKey).toBe('solar-coast');expect(after.distance!/after.fitDistance!).toBeCloseTo(1.5,10);
    expect(camera.position.clone().sub(controls.target).normalize().distanceTo(direction)).toBeLessThan(1e-12);
  });
  it('focuses a real off-centre part without increasing the full-craft display scale',()=>{
    const {controller}=rig();controller.enter();const whole=controller.update(frame());
    controller.requestFit();const focused=controller.update(frame({focusBounds:new THREE.Box3(new THREE.Vector3(2.5,-.2,-.2),new THREE.Vector3(3,.2,.2))}));
    expect(focused.scale).toBe(whole.scale);expect(focused.fitDistance).toBeLessThan(whole.fitDistance);
    expect(focused.target.x).toBeCloseTo(2.75*focused.scale,12);
    expect(focused.target.length()-focused.maxDistance).toBeGreaterThan(3);
  });
  it('restores exact camera projection, user target and control restrictions once',()=>{
    const {camera,controls,controller}=rig();camera.zoom=1.25;camera.updateProjectionMatrix();
    const before={position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),near:camera.near,far:camera.far,zoom:camera.zoom,target:controls.target.toArray(),min:controls.minDistance,max:controls.maxDistance,pan:controls.enablePan,damping:controls.enableDamping};
    controller.enter();controller.enter();controller.update(frame());controller.exit();controller.exit();
    expect({position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),near:camera.near,far:camera.far,zoom:camera.zoom,target:controls.target.toArray(),min:controls.minDistance,max:controls.maxDistance,pan:controls.enablePan,damping:controls.enableDamping}).toEqual(before);
    expect(camera.view).toBeNull();expect(controller.enabled).toBe(false);
  });
  it('keeps a tiny lens-focus orbit outside the real bus envelope',()=>{
    const {camera,controls,controller}=rig(),bus=new THREE.Box3(new THREE.Vector3(-.65,-.8,-.65),new THREE.Vector3(.65,.8,.65));
    controller.enter();const f=frame({focusBounds:new THREE.Box3(new THREE.Vector3(-.1,-.1,.7),new THREE.Vector3(.1,.1,.9)),solidBounds:[bus]});
    const layout=controller.update(f),toWorld=new THREE.Matrix4().compose(f.position,f.quaternion,new THREE.Vector3().setScalar(layout.scale));
    camera.position.set(0,0,.6).applyMatrix4(toWorld);controller.constrain();
    expect(bus.containsPoint(camera.position.clone().applyMatrix4(toWorld.clone().invert()))).toBe(false);
    expect(camera.position.length()).toBeGreaterThan(3);expect(camera.position.distanceTo(controls.target)).toBeLessThan(layout.maxDistance);
  });
  it('repeated idempotent updates do not drift the camera or allocate scene objects',()=>{
    const {camera,controller}=rig();controller.enter();controller.update(frame());const initial=camera.position.clone();
    for(let i=0;i<1000;i++)controller.update(frame());
    expect(camera.position.distanceTo(initial)).toBeLessThan(1e-12);expect(camera.children).toHaveLength(0);
  });
});
