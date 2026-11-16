import * as THREE from 'three';
import type {DeploymentGeometryView,JointDefinition,MechanismTopology,Vec3} from '../deployment/types';
import {retireContextResources} from './context-resources';

export interface HingeControlFrame {jointId:string;partId:string;pivotBodyM:Vec3;axisBody:Vec3;zeroBody:Vec3;actualAngleRad:number;minimumRad:number;maximumRad:number;stowedRad:number;deployedRad:number}
export interface HingePreviewRequest {jointId:string;partId:string;angleRad:number;previousAngleRad:number;stage:'preview'|'commit'|'cancel';authority:'editor-preview-only'}
export interface HingeManipulatorCallbacks {request:(value:HingePreviewRequest)=>void;activeChanged?:(active:boolean)=>void}
const TAU=Math.PI*2;
const vec=(v:Vec3)=>new THREE.Vector3(...v);
function valid(frame:HingeControlFrame){
 const {axisBody,zeroBody,pivotBodyM}=frame;
 if(!frame.jointId||!frame.partId||![...axisBody,...zeroBody,...pivotBodyM,frame.actualAngleRad,frame.minimumRad,frame.maximumRad,frame.stowedRad,frame.deployedRad].every(Number.isFinite)||Math.abs(vec(axisBody).length()-1)>1e-6||Math.abs(vec(zeroBody).length()-1)>1e-6||Math.abs(vec(axisBody).dot(vec(zeroBody)))>1e-6||frame.minimumRad>=frame.maximumRad||frame.maximumRad-frame.minimumRad>TAU+1e-10||[frame.actualAngleRad,frame.stowedRad,frame.deployedRad].some(a=>a<frame.minimumRad-1e-10||a>frame.maximumRad+1e-10))throw new Error('Invalid authored hinge control frame.');
}
/** Control datum, not a second FK solution: project parent-local X onto the
 * hinge plane (fallback Z), then apply the supplied parent FK quaternion.
 * restQuaternion is not an extra angle offset. */
export function hingeControlFrame(topology:MechanismTopology,geometry:DeploymentGeometryView,jointId:string):HingeControlFrame {
 const joint=topology.joints.find(j=>j.id===jointId),state=geometry.joints[jointId];if(!joint||!state)throw new Error('Unknown hinge control.');
 const parent=geometry.links.find(l=>l.linkId===joint.parentLinkId);if(!parent)throw new Error('Missing hinge parent pose.');const axis=vec(joint.axisParent).normalize(),zero=new THREE.Vector3(1,0,0).addScaledVector(axis,-axis.x);if(zero.lengthSq()<1e-10)zero.set(0,0,1).addScaledVector(axis,-axis.z);zero.normalize().applyQuaternion(new THREE.Quaternion(...parent.pose.quaternion));
 const f={jointId,partId:joint.partId,pivotBodyM:[...state.pivotBodyM] as Vec3,axisBody:[...state.axisBody] as Vec3,zeroBody:zero.toArray() as Vec3,actualAngleRad:state.angleRad,minimumRad:joint.minimumRad,maximumRad:joint.maximumRad,stowedRad:joint.stowedRad,deployedRad:joint.deployedRad};valid(f);return f;
}
export function boundedHingeAngle(rawRad:number,referenceRad:number,minimumRad:number,maximumRad:number,stepRad:number){
 if(![rawRad,referenceRad,minimumRad,maximumRad,stepRad].every(Number.isFinite)||minimumRad>=maximumRad||maximumRad-minimumRad>TAU+1e-10||stepRad<=0)throw new Error('Invalid hinge preview bounds.');
 const unwrapped=rawRad+Math.round((referenceRad-rawRad)/TAU)*TAU,clamped=THREE.MathUtils.clamp(unwrapped,minimumRad,maximumRad);
 // Mechanical stops remain exact even if the authored interval is not an
 // integer multiple of the explicitly labelled editor snap step.
 const snapped=clamped===minimumRad||clamped===maximumRad?clamped:THREE.MathUtils.clamp(minimumRad+Math.round((clamped-minimumRad)/stepRad)*stepRad,minimumRad,maximumRad);
 return {angleRad:snapped,unwrappedRad:unwrapped};
}
export function hingeRayAngle(ray:THREE.Ray,worldFromArc:THREE.Matrix4,referenceRad:number,frame:Pick<JointDefinition,'minimumRad'|'maximumRad'>,stepRad:number){
 const local=ray.clone().applyMatrix4(worldFromArc.clone().invert());if(Math.abs(local.direction.z)<.08)return null;
 const point=local.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),new THREE.Vector3());if(!point||Math.hypot(point.x,point.y)<.08)return null;
 return boundedHingeAngle(Math.atan2(point.y,point.x),referenceRad,frame.minimumRad,frame.maximumRad,stepRad);
}

/** Visible, screen-sized editor control around a real hinge pivot. A release
 * commits only an inspection-preview angle. The current flight schema still
 * supports stowed/deployed motor commands; this control cannot bypass it. */
export class HingeManipulator {
 readonly group=new THREE.Group();
 private readonly arcMaterial=new THREE.LineBasicMaterial({color:0x69c6ba,transparent:true,opacity:.65,depthTest:false,depthWrite:false,toneMapped:false});
 private readonly tickMaterial=new THREE.LineBasicMaterial({color:0x9aafbb,depthTest:false,depthWrite:false,toneMapped:false});
 private readonly handleMaterial=new THREE.MeshBasicMaterial({color:0xffcc79,depthTest:false,depthWrite:false,toneMapped:false});
 private readonly actualMaterial=new THREE.MeshBasicMaterial({color:0xe3ece6,depthTest:false,depthWrite:false,toneMapped:false});
 private readonly arcGeometry=new THREE.BufferGeometry();private readonly tickGeometry=new THREE.BufferGeometry();private readonly ball=new THREE.SphereGeometry(.095,16,12);
 private readonly arc:THREE.Line;private readonly ticks:THREE.LineSegments;private readonly handle:THREE.Mesh;private readonly actual:THREE.Mesh;
 private frame:HingeControlFrame|null=null;private angle=0;private enabled=true;private disposed=false;private retired=false;
 private drag:{pointerId:number;initial:number;reference:number;matrix:THREE.Matrix4}|null=null;
 private readonly stepRad:number;private readonly radiusCssPx:number;private available=false;
 constructor(private canvas:HTMLCanvasElement,private camera:THREE.Camera,parent:THREE.Object3D,private callbacks:HingeManipulatorCallbacks,options:{stepRad?:number;radiusCssPx?:number}={}){
  this.stepRad=options.stepRad??Math.PI/180;this.radiusCssPx=options.radiusCssPx??70;if(!Number.isFinite(this.stepRad)||this.stepRad<=0||this.stepRad>Math.PI||!Number.isFinite(this.radiusCssPx)||this.radiusCssPx<24||this.radiusCssPx>160)throw new Error('Invalid hinge editor display settings.');
  this.arcGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(129*3),3));this.tickGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(64*2*3),3));
  this.arc=new THREE.Line(this.arcGeometry,this.arcMaterial);this.ticks=new THREE.LineSegments(this.tickGeometry,this.tickMaterial);this.handle=new THREE.Mesh(this.ball,this.handleMaterial);this.actual=new THREE.Mesh(this.ball,this.actualMaterial);this.actual.scale.setScalar(.52);this.group.add(this.arc,this.ticks,this.handle,this.actual);this.group.visible=false;this.group.name='hinge-inspection-preview-control';this.group.userData={uiControl:true,physicalGeometry:false,authority:'editor-preview-only'};this.group.traverse(o=>o.renderOrder=250);parent.add(this.group);
  canvas.addEventListener('pointerdown',this.down,true);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.cancelEvent);canvas.addEventListener('lostpointercapture',this.cancelEvent);canvas.addEventListener('keydown',this.key);window.addEventListener('keydown',this.escape);window.addEventListener('blur',this.cancelEvent);
 }
 setFrame(frame:HingeControlFrame|null,previewAngleRad?:number){
  if(this.disposed)return;if(!frame){this.cancel();this.frame=null;this.group.visible=false;return;}valid(frame);if(previewAngleRad!==undefined&&(!Number.isFinite(previewAngleRad)||previewAngleRad<frame.minimumRad||previewAngleRad>frame.maximumRad))throw new Error('Preview exceeds authored joint bounds.');
  const changed=JSON.stringify(frame)!==JSON.stringify(this.frame);if(changed)this.cancel();const same=this.frame?.jointId===frame.jointId;this.frame=structuredClone(frame);if(previewAngleRad!==undefined)this.angle=previewAngleRad;else if(!same)this.angle=frame.actualAngleRad;else this.angle=THREE.MathUtils.clamp(this.angle,frame.minimumRad,frame.maximumRad);
  const x=vec(frame.zeroBody),z=vec(frame.axisBody),y=z.clone().cross(x);this.group.position.set(...frame.pivotBodyM);this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));this.group.visible=true;this.draw();this.updateDisplay();
 }
 setEnabled(enabled:boolean){if(!enabled)this.cancel();this.enabled=enabled;this.handleMaterial.color.set(enabled?0xffcc79:0x6b797e);}
 private draw(){if(!this.frame)return;const f=this.frame,a=this.arcGeometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<=128;i++){const t=f.minimumRad+(f.maximumRad-f.minimumRad)*i/128;a.setXYZ(i,Math.cos(t),Math.sin(t),0);}a.needsUpdate=true;this.arcGeometry.setDrawRange(0,129);this.arcGeometry.computeBoundingSphere();
  const ticks=[f.minimumRad,f.maximumRad];for(let t=Math.ceil(f.minimumRad/(Math.PI/12))*Math.PI/12;t<f.maximumRad;t+=Math.PI/12)if(t>f.minimumRad+1e-8)ticks.push(t);const b=this.tickGeometry.getAttribute('position') as THREE.BufferAttribute;let n=0;for(const t of ticks){b.setXYZ(n++,Math.cos(t)*.94,Math.sin(t)*.94,0);b.setXYZ(n++,Math.cos(t)*1.06,Math.sin(t)*1.06,0);}b.needsUpdate=true;this.tickGeometry.setDrawRange(0,n);this.tickGeometry.computeBoundingSphere();this.handle.position.set(Math.cos(this.angle),Math.sin(this.angle),0);this.actual.position.set(Math.cos(f.actualAngleRad)*.8,Math.sin(f.actualAngleRad)*.8,0);
 }
 /** Call after camera/root changes. Arc size is a labelled UI affordance; the
 * pivot/axis and all physical spacecraft meshes remain untouched. */
 updateDisplay(){
  if(this.disposed||!this.frame)return;this.group.scale.setScalar(1);this.group.updateWorldMatrix(true,true);this.camera.updateMatrixWorld();const center=new THREE.Vector3().setFromMatrixPosition(this.group.matrixWorld),cameraPoint=center.clone().applyMatrix4(this.camera.matrixWorldInverse),rect=this.canvas.getBoundingClientRect();let perPixel:number;
  if(this.camera instanceof THREE.PerspectiveCamera)perPixel=2*Math.abs(cameraPoint.z)*Math.tan(this.camera.fov*Math.PI/360)/(this.camera.zoom*Math.max(1,rect.height));else if(this.camera instanceof THREE.OrthographicCamera)perPixel=(this.camera.top-this.camera.bottom)/(this.camera.zoom*Math.max(1,rect.height));else throw new Error('Unsupported hinge camera.');
  const parentScale=this.group.parent!.getWorldScale(new THREE.Vector3());if(Math.min(parentScale.x,parentScale.y,parentScale.z)<=0||Math.max(parentScale.x,parentScale.y,parentScale.z)-Math.min(parentScale.x,parentScale.y,parentScale.z)>1e-6)throw new Error('Hinge control requires a uniform structural-body display scale.');
  this.group.scale.setScalar(Math.max(1e-6,perPixel*this.radiusCssPx/parentScale.x));this.group.updateWorldMatrix(true,true);const normal=new THREE.Vector3(0,0,1).transformDirection(this.group.matrixWorld),toCamera=this.camera instanceof THREE.PerspectiveCamera?this.camera.getWorldPosition(new THREE.Vector3()).sub(center).normalize():this.camera.getWorldDirection(new THREE.Vector3()).negate();this.available=cameraPoint.z<0&&Math.abs(normal.dot(toCamera))>=.08;
  if(this.drag&&!this.drag.matrix.equals(this.group.matrixWorld))this.cancel();
 }
 getHandleScreen(){if(!this.frame||!this.group.visible||this.disposed)return null;this.group.updateWorldMatrix(true,true);const r=this.canvas.getBoundingClientRect(),p=this.handle.getWorldPosition(new THREE.Vector3()).project(this.camera);return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1,draggable:this.enabled&&this.available};}
 getState(){return {jointId:this.frame?.jointId??null,partId:this.frame?.partId??null,actualAngleRad:this.frame?.actualAngleRad??null,previewAngleRad:this.frame?this.angle:null,minimumRad:this.frame?.minimumRad??null,maximumRad:this.frame?.maximumRad??null,stepRad:this.stepRad,radiusCssPx:this.radiusCssPx,dragging:!!this.drag,enabled:this.enabled,available:this.available,reason:!this.available?'view-hinge-plane-face-on':null,authority:'editor-preview-only',actualStateChanged:false};}
 private ray(e:PointerEvent){const r=this.canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),this.camera);return ray.ray;}
 private emit(stage:HingePreviewRequest['stage'],previousAngleRad:number){if(this.frame)this.callbacks.request({jointId:this.frame.jointId,partId:this.frame.partId,angleRad:this.angle,previousAngleRad,stage,authority:'editor-preview-only'});}
 private down=(e:PointerEvent)=>{if(e.button!==0||!this.enabled||!this.frame||this.disposed)return;this.updateDisplay();const h=this.getHandleScreen();if(!h?.visible||!h.draggable||Math.hypot(e.clientX-h.x,e.clientY-h.y)>12)return;e.preventDefault();e.stopImmediatePropagation();this.canvas.focus();this.drag={pointerId:e.pointerId,initial:this.angle,reference:this.angle,matrix:this.group.matrixWorld.clone()};this.canvas.setPointerCapture(e.pointerId);this.callbacks.activeChanged?.(true);};
 private move=(e:PointerEvent)=>{if(!this.drag||e.pointerId!==this.drag.pointerId||!this.frame)return;const result=hingeRayAngle(this.ray(e),this.drag.matrix,this.drag.reference,this.frame,this.stepRad);if(!result)return;this.drag.reference=result.unwrappedRad;if(result.angleRad===this.angle)return;this.angle=result.angleRad;this.draw();this.emit('preview',this.drag.initial);};
 private release(){const d=this.drag;if(!d)return;this.drag=null;if(this.canvas.hasPointerCapture(d.pointerId))this.canvas.releasePointerCapture(d.pointerId);this.callbacks.activeChanged?.(false);}
 private up=(e:PointerEvent)=>{if(!this.drag||e.pointerId!==this.drag.pointerId)return;const prior=this.drag.initial;this.release();this.emit('commit',prior);};
 cancel(){if(!this.drag)return;const prior=this.drag.initial;this.angle=prior;this.release();this.draw();this.emit('cancel',prior);}
 private cancelEvent=()=>this.cancel();private escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&this.drag){e.preventDefault();this.cancel();}};
 private key=(e:KeyboardEvent)=>{if(!this.frame||!this.enabled||this.drag||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const prior=this.angle,delta=this.stepRad*(e.shiftKey?10:1);this.angle=e.key==='Home'?this.frame.minimumRad:e.key==='End'?this.frame.maximumRad:THREE.MathUtils.clamp(this.angle+(e.key==='ArrowLeft'?-delta:delta),this.frame.minimumRad,this.frame.maximumRad);this.draw();this.emit('commit',prior);};
 retireContext(){if(this.disposed||this.retired)return null;this.cancel();this.retired=true;return retireContextResources([this.group]);}contextRestored(){this.retired=false;}
 dispose(){if(this.disposed)return;this.cancel();this.disposed=true;this.canvas.removeEventListener('pointerdown',this.down,true);this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerup',this.up);this.canvas.removeEventListener('pointercancel',this.cancelEvent);this.canvas.removeEventListener('lostpointercapture',this.cancelEvent);this.canvas.removeEventListener('keydown',this.key);window.removeEventListener('keydown',this.escape);window.removeEventListener('blur',this.cancelEvent);this.group.removeFromParent();this.group.clear();for(const g of [this.arcGeometry,this.tickGeometry,this.ball])g.dispose();for(const m of [this.arcMaterial,this.tickMaterial,this.handleMaterial,this.actualMaterial])m.dispose();}
}
