import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {createArticulatedDevice} from '../src/deployment/devices';
import {compileTopology,initialJointStates,resolveDeploymentGeometry} from '../src/deployment/kinematics';
import {hingeControlFrame,boundedHingeAngle,hingeRayAngle,HingeManipulator,type HingePreviewRequest} from '../src/render/hinge-manipulator';
import {DeploymentView} from '../src/render/deployment-view';
const rad=Math.PI/180;
function fixture(){const d=createArticulatedDevice('wing','solar'),c=compileTopology(d.topology),states=initialJointStates(c),g=resolveDeploymentGeometry(c,states),joint=d.deployJointOrder[0];return {d,c,states,g,joint,f:hingeControlFrame(c.definition,g,joint)};}
describe('hinge inspection manipulator geometry',()=>{
 it('uses exact supplied parent frame/pivot/axis and right-handed zero datum without applying restQuaternion as an angle offset',()=>{
  const {d}=fixture();d.topology.links[0].rootPose={positionM:[.2,.4,-.3],quaternion:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),.7).toArray()};d.topology.joints[0].restQuaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.4).toArray();const c=compileTopology(d.topology),g=resolveDeploymentGeometry(c,initialJointStates(c)),j=c.definition.joints[0],f=hingeControlFrame(c.definition,g,j.id),parent=g.links.find(l=>l.linkId===j.parentLinkId)!;
  expect(f.pivotBodyM).toEqual(g.joints[j.id].pivotBodyM);expect(f.axisBody).toEqual(g.joints[j.id].axisBody);expect(new THREE.Vector3(...f.zeroBody).distanceTo(new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion(...parent.pose.quaternion)))).toBeLessThan(1e-12);expect(f.actualAngleRad).toBe(j.stowedRad);
 });
 it('unwraps negative half-turn and clamps to exact authored stops without wrapping through the wrong side',()=>{
  expect(boundedHingeAngle(Math.PI-.01,-Math.PI,-Math.PI,0,rad).angleRad).toBe(-Math.PI);
  expect(boundedHingeAngle(-.3,-.2,0,Math.PI,rad).angleRad).toBe(0);
  expect(boundedHingeAngle(2,1,.13,1.99,rad).angleRad).toBe(1.99);
  const a=boundedHingeAngle(.401,.4,0,Math.PI,rad);expect(a.angleRad/rad).toBeCloseTo(23,10);expect(()=>boundedHingeAngle(NaN,0,0,Math.PI,rad)).toThrow();
 });
 it('intersects the real transformed hinge plane and rejects edge-on rays instead of inventing a screen-space angle',()=>{
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(3,-2,1),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.4),new THREE.Vector3(2,2,2)),point=new THREE.Vector3(Math.cos(.7),Math.sin(.7),0).applyMatrix4(matrix),normal=new THREE.Vector3(0,0,1).transformDirection(matrix),ray=new THREE.Ray(point.clone().addScaledVector(normal,5),normal.clone().negate());
  expect(hingeRayAngle(ray,matrix,.7,{minimumRad:0,maximumRad:Math.PI},rad)!.angleRad).toBeCloseTo(40*rad,12);const edge=new THREE.Ray(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0));expect(hingeRayAngle(edge,new THREE.Matrix4(),0,{minimumRad:0,maximumRad:Math.PI},rad)).toBeNull();
 });
});

class Canvas extends EventTarget {captured=new Set<number>();focus(){}getBoundingClientRect(){return {left:0,top:0,width:800,height:600};}setPointerCapture(id:number){this.captured.add(id);}hasPointerCapture(id:number){return this.captured.has(id);}releasePointerCapture(id:number){this.captured.delete(id);}}
function pointer(canvas:Canvas,type:string,x:number,y:number){const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:x,clientY:y});canvas.dispatchEvent(e);}
function setup(){
 const host=new EventTarget();vi.stubGlobal('window',host);const f=fixture(),parent=new THREE.Group(),camera=new THREE.PerspectiveCamera(45,800/600,.01,100);camera.position.set(f.f.pivotBodyM[0],3,f.f.pivotBodyM[2]);camera.up.set(0,0,-1);camera.lookAt(new THREE.Vector3(...f.f.pivotBodyM));camera.updateMatrixWorld();const canvas=new Canvas(),requests:HingePreviewRequest[]=[],view=new DeploymentView(f.c);view.setGeometryView(f.g);parent.add(view.actualRoot,view.previewRoot);const baseline=JSON.stringify(f.states),m=new HingeManipulator(canvas as unknown as HTMLCanvasElement,camera,parent,{request:r=>{requests.push(r);const states=structuredClone(f.states);states[r.jointId].angleRad=r.angleRad;view.setPreviewGeometry(resolveDeploymentGeometry(f.c,states));}});m.setFrame(f.f);
 const point=(angle:number)=>{m.group.updateMatrixWorld(true);const v=new THREE.Vector3(Math.cos(angle),Math.sin(angle),0).applyMatrix4(m.group.matrixWorld).project(camera);return {x:(v.x+1)*400,y:(1-v.y)*300};};return {...f,host,parent,camera,canvas,requests,view,m,point,baseline};
}
describe('editor-only hinge input and ownership',()=>{
 it('real pointer events preview exact domain FK ghosts, then commit only the editor angle',()=>{
  const s=setup(),start=s.m.getHandleScreen()!,end=s.point(Math.PI/2);expect(start.draggable).toBe(true);pointer(s.canvas,'pointerdown',start.x,start.y);pointer(s.canvas,'pointermove',end.x,end.y);s.m.updateDisplay();expect(s.m.getState().dragging).toBe(true);pointer(s.canvas,'pointerup',end.x,end.y);expect(s.requests.map(r=>r.stage)).toEqual(['preview','commit']);expect(s.requests.at(-1)?.angleRad).toBeCloseTo(Math.PI/2,12);expect(s.requests.every(r=>r.authority==='editor-preview-only')).toBe(true);expect(JSON.stringify(s.states)).toBe(s.baseline);expect(s.view.getState().revisions.actual).toBe(0);expect(s.m.getState().actualAngleRad).toBe(Math.PI);s.m.dispose();s.view.dispose();vi.unstubAllGlobals();
 });
 it.each(['Escape','lostpointercapture'] as const)('%s restores the previous preview and never commits a powered joint state',event=>{
  const s=setup(),start=s.m.getHandleScreen()!,end=s.point(Math.PI/3);pointer(s.canvas,'pointerdown',start.x,start.y);pointer(s.canvas,'pointermove',end.x,end.y);if(event==='Escape'){const e=new Event('keydown',{cancelable:true});Object.assign(e,{key:'Escape'});s.host.dispatchEvent(e);}else s.canvas.dispatchEvent(new Event('lostpointercapture'));expect(s.requests.at(-1)?.stage).toBe('cancel');expect(s.requests.at(-1)?.angleRad).toBe(Math.PI);expect(s.requests.some(r=>r.stage==='commit')).toBe(false);expect(s.m.getState().dragging).toBe(false);expect(JSON.stringify(s.states)).toBe(s.baseline);s.m.dispose();s.view.dispose();vi.unstubAllGlobals();
 });
 it('keyboard endpoints/steps honor bounds and disabling the control prevents input',()=>{
  const s=setup();const key=(key:string)=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{key,shiftKey:false});s.canvas.dispatchEvent(e);};key('Home');expect(s.requests.at(-1)?.angleRad).toBe(0);key('ArrowRight');expect(s.requests.at(-1)?.angleRad).toBe(rad);key('End');expect(s.requests.at(-1)?.angleRad).toBe(Math.PI);const n=s.requests.length;s.m.setEnabled(false);key('Home');expect(s.requests).toHaveLength(n);s.m.dispose();s.view.dispose();vi.unstubAllGlobals();
 });
 it('reuses geometry while scrubbing and retires/destroys owned resources without affecting the physical view',()=>{
  const s=setup(),resources=new Set<THREE.BufferGeometry|THREE.Material>();s.m.group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);}});const counts=new Map([...resources].map(r=>[r,0]));resources.forEach(r=>r.addEventListener('dispose',()=>counts.set(r,counts.get(r)!+1)));s.m.retireContext();s.m.retireContext();expect([...counts.values()].every(n=>n===1)).toBe(true);s.m.contextRestored();s.m.dispose();s.m.dispose();expect([...counts.values()].every(n=>n===2)).toBe(true);expect(s.view.actualRoot.children.length).toBeGreaterThan(0);s.view.dispose();vi.unstubAllGlobals();
 });
});
