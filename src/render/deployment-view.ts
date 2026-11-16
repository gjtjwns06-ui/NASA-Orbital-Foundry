import * as THREE from 'three';
import type {CompiledTopology} from '../deployment/kinematics';
import type {ClearanceReport,DeploymentGeometryView,MechanismState,MechanismTopology,Quaternion,Vec3} from '../deployment/types';
import {createDeploymentLink,deploymentPalette} from './deployment-link-meshes';
import {retireContextResources} from './context-resources';
import {DeploymentSurfaceFinish,type DeploymentSurfaceStyle} from './deployment-surface-finish';

type Channel='actual'|'preview';
type JointView=DeploymentGeometryView['joints'];
const finite=(a:readonly number[],length:number)=>Array.isArray(a)&&a.length===length&&a.every(Number.isFinite);
const unitQ=(q:Quaternion)=>finite(q,4)&&Math.abs(Math.hypot(...q)-1)<1e-6;
const key=(linkId:string,boxId:string)=>`${linkId}|${boxId}`;

/** Immutable original art plus authoritative FK pose application. There is no
 * mechanics solver, progress tween, clock, latch decision or success callback.
 * The caller attaches both roots under the SAME structural-body frame. */
export class DeploymentView {
 readonly actualRoot=new THREE.Group();readonly previewRoot=new THREE.Group();
 private readonly topology:MechanismTopology;private readonly palette=deploymentPalette();
 private readonly surfaceFinish=new DeploymentSurfaceFinish(this.palette);
 private readonly ghost=new THREE.MeshBasicMaterial({color:0x70daca,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 private readonly obstruction=new THREE.LineBasicMaterial({color:0xff9d6a,depthTest:false,toneMapped:false});
 private readonly uncertain=new THREE.LineBasicMaterial({color:0xf4d577,depthTest:false,toneMapped:false});
 private readonly links={actual:new Map<string,THREE.Group>(),preview:new Map<string,THREE.Group>()};
 private readonly guides={actual:new Map<string,THREE.LineSegments>(),preview:new Map<string,THREE.LineSegments>()};
 private readonly geometry=new Set<THREE.BufferGeometry>();private readonly materials=new Set<THREE.Material>();
 private revisions:{actual:number|null;preview:number|null}={actual:null,preview:null};
 private joints:{actual:JointView;preview:JointView}={actual:{},preview:{}};
 private states:MechanismState[]=[];private report:ClearanceReport|null=null;private clearanceChannel:Channel='preview';private disposed=false;private retired=false;
 constructor(compiled:Pick<CompiledTopology,'definition'>,options:{surfaceFinish?:DeploymentSurfaceStyle}={}){
  if(compiled.definition.version!=='deployment-geometry-1')throw new Error('Unsupported deployment geometry version.');
  const d=compiled.definition;if(!Array.isArray(d.links)||d.links.length<1||d.links.length>64||d.joints.length>16||new Set(d.links.map(l=>l.id)).size!==d.links.length)throw new Error('Invalid deployment renderer topology.');
  for(const link of d.links){for(const box of link.boxes)if(!finite(box.centerM,3)||!finite(box.halfM,3)||box.halfM.some(n=>n<=0||n>20)||box.quaternion&&!unitQ(box.quaternion)||box.jointId&&!d.joints.some(j=>j.id===box.jointId))throw new Error('Invalid deployment render envelope.');for(const a of link.apertures)if(!finite(a.centerM,3)||!finite(a.normal,3)||!finite(a.tangentU,3)||!finite(a.tangentV,3)||!Number.isFinite(a.widthM)||!Number.isFinite(a.heightM)||a.widthM<=0||a.heightM<=0)throw new Error('Invalid deployment aperture.');}
  this.topology=structuredClone(compiled.definition);this.actualRoot.name='actual-deployment-body';this.previewRoot.name='preview-deployment-body';this.actualRoot.visible=this.previewRoot.visible=false;
  [...Object.values(this.palette),this.ghost,this.obstruction,this.uncertain].forEach(m=>this.materials.add(m));
  for(const link of this.topology.links){
   const actual=createDeploymentLink(link,this.topology,this.palette),preview=actual.clone(true);preview.traverse(o=>{if(o instanceof THREE.Mesh){o.material=this.ghost;o.castShadow=false;o.receiveShadow=false;}});
   this.links.actual.set(link.id,actual);this.links.preview.set(link.id,preview);this.actualRoot.add(actual);this.previewRoot.add(preview);
   actual.traverse(o=>{if(o instanceof THREE.Mesh)this.geometry.add(o.geometry);});
   for(const box of link.boxes){
    const source=new THREE.BoxGeometry(...box.halfM.map(n=>n*2) as [number,number,number]),edges=new THREE.EdgesGeometry(source);source.dispose();this.geometry.add(edges);
    for(const channel of ['actual','preview'] as const){const line=new THREE.LineSegments(edges,this.obstruction);line.position.set(...box.centerM);if(box.quaternion)line.quaternion.set(...box.quaternion);line.visible=false;line.renderOrder=100;line.userData={guide:true,linkId:link.id,boxId:box.id};this.links[channel].get(link.id)!.add(line);this.guides[channel].set(key(link.id,box.id),line);}
   }
  }
  this.surfaceFinish.setStyle(options.surfaceFinish??'flat');
 }
 setSurfaceFinish(style:DeploymentSurfaceStyle){if(!this.disposed)this.surfaceFinish.setStyle(style);}
 getSurfaceFinishState(){return this.surfaceFinish.getState();}
 getSurfaceTextures(){return this.surfaceFinish.textures;}
 private validate(view:DeploymentGeometryView){
  if(!view||!Number.isSafeInteger(view.revision)||view.revision<0||view.links.length!==this.topology.links.length||new Set(view.links.map(l=>l.linkId)).size!==view.links.length)throw new Error('Incomplete deployment geometry snapshot.');
  for(const link of view.links){const def=this.topology.links.find(l=>l.id===link.linkId);if(!def||def.partId!==link.partId||!finite(link.pose.positionM,3)||!unitQ(link.pose.quaternion)||!finite(link.relativeLinearVelocityMps,3)||!finite(link.relativeAngularVelocityRadS,3))throw new Error('Invalid deployment link pose.');}
  if(Object.keys(view.joints).length!==this.topology.joints.length)throw new Error('Incomplete deployment joints.');
  for(const joint of this.topology.joints){const s=view.joints[joint.id];if(!s||!Number.isFinite(s.angleRad)||!Number.isFinite(s.rateRadS)||s.angleRad<joint.minimumRad-1e-10||s.angleRad>joint.maximumRad+1e-10||!finite(s.pivotBodyM,3)||!finite(s.axisBody,3)||Math.abs(Math.hypot(...s.axisBody)-1)>1e-6)throw new Error('Invalid deployment joint view.');}
  // A revision never authorizes resizing or silently replacing topology.
  const expected=this.topology.links.flatMap(l=>l.boxes.map(b=>({link:l,box:b})));if(view.boxes.length!==expected.length||new Set(view.boxes.map(b=>key(b.linkId,b.id))).size!==expected.length)throw new Error('Incomplete deployment proxy snapshot.');
  for(const {link,box} of expected){const b=view.boxes.find(b=>b.linkId===link.id&&b.id===box.id);if(!b||b.partId!==link.partId||!finite(b.centerM,3)||!finite(b.halfM,3)||b.halfM.some((n,i)=>n!==box.halfM[i])||b.axes.length!==3||b.axes.some(a=>!finite(a,3)))throw new Error('Deployment topology cannot change through a pose revision.');}
 }
 private apply(view:DeploymentGeometryView,channel:Channel){
  if(this.disposed)return false;this.validate(view);
  // All validation finishes before any actual/preview transform is changed.
  for(const link of view.links){const group=this.links[channel].get(link.linkId)!;group.position.set(...link.pose.positionM);group.quaternion.set(...link.pose.quaternion);group.scale.set(1,1,1);}
  this.revisions[channel]=view.revision;this.joints[channel]=structuredClone(view.joints);(channel==='actual'?this.actualRoot:this.previewRoot).visible=true;this.syncPreviewVisibility();return true;
 }
 private syncPreviewVisibility(){for(const [id,preview] of this.links.preview){const actual=this.links.actual.get(id)!,moved=!this.actualRoot.visible||actual.position.distanceToSquared(preview.position)>1e-18||1-Math.abs(actual.quaternion.dot(preview.quaternion))>1e-10;for(const object of preview.children)if(object instanceof THREE.Mesh)object.visible=moved;}}
 setGeometryView(view:DeploymentGeometryView){return this.apply(view,'actual');}
 setPreviewGeometry(view:DeploymentGeometryView|null){if(this.disposed)return false;if(!view){this.previewRoot.visible=false;this.revisions.preview=null;this.joints.preview={};return true;}return this.apply(view,'preview');}
 setMechanismStates(states:readonly MechanismState[]){
  if(this.disposed)return;const ids=new Set<string>();for(const state of states){if(!this.topology.links.some(l=>l.partId===state.partId)||ids.has(state.partId)||!Number.isFinite(state.motorEnergyJ)||state.motorEnergyJ<0)throw new Error('Invalid deployment mechanism metadata.');ids.add(state.partId);}this.states=structuredClone([...states]);
  // Metadata only. No visual completion is inferred from a commanded angle.
 }
 setClearance(report:ClearanceReport|null,channel:Channel='preview'){
  if(this.disposed)return;const witness=report?.firstWitness??report?.firstUncertainWitness;
  if(report&&(!['clear','blocked','uncertain'].includes(report.status)||!Number.isFinite(report.safeThroughAngleRad)||witness&&(!this.guides[channel].has(key(witness.a.linkId,witness.a.boxId))||!this.guides[channel].has(key(witness.b.linkId,witness.b.boxId)))))throw new Error('Unknown clearance witness.');
  for(const mode of ['actual','preview'] as const)for(const guide of this.guides[mode].values())guide.visible=false;
  if(witness)for(const item of [witness.a,witness.b]){const line=this.guides[channel].get(key(item.linkId,item.boxId))!;line.material=report!.status==='blocked'?this.obstruction:this.uncertain;line.visible=true;}
  this.report=report?structuredClone(report):null;this.clearanceChannel=channel;
 }
 /** Existing inspection-box centers, not contact points. Read the rendered
  * guide transforms so labels cannot invent a second FK or witness pose. */
 getClearanceAnchors(){
  const report=this.report,witness=report?.firstWitness??report?.firstUncertainWitness,channel=this.clearanceChannel,root=channel==='actual'?this.actualRoot:this.previewRoot;
  if(this.disposed||this.retired||!root.visible||!witness||!Number.isFinite(witness.sampleAngleRad)||!report||report.status==='clear')return null;
  root.updateWorldMatrix(true,true);
  const points=([witness.a,witness.b] as const).map((item,index)=>{const guide=this.guides[channel].get(key(item.linkId,item.boxId)),link=this.links[channel].get(item.linkId);if(!guide?.visible||!link?.visible||this.topology.links.find(l=>l.id===item.linkId)?.partId!==item.partId)return null;return {role:(index===0?'a':'b') as 'a'|'b',...item,worldPosition:guide.getWorldPosition(new THREE.Vector3()).toArray() as Vec3};});
  if(points.some(p=>!p))return null;
  return {channel,status:report.status,sampleAngleRad:witness.sampleAngleRad,points:points.filter((p):p is NonNullable<typeof p>=>p!==null)};
 }
 getJointHandleScreen(id:string,camera:THREE.Camera,viewport:{left:number;top:number;width:number;height:number},channel:Channel='actual'){
  const joint=this.joints[channel][id],root=channel==='actual'?this.actualRoot:this.previewRoot;if(this.disposed||!joint||!root.visible)return null;
  if(!Object.values(viewport).every(Number.isFinite)||viewport.width<=0||viewport.height<=0)throw new Error('Invalid joint projection viewport.');root.updateWorldMatrix(true,true);camera.updateMatrixWorld();const world=new THREE.Vector3(...joint.pivotBodyM).applyMatrix4(root.matrixWorld),p=world.clone().project(camera);
  return {jointId:id,partId:this.topology.joints.find(j=>j.id===id)!.partId,channel,angleRad:joint.angleRad,pivotBodyM:[...joint.pivotBodyM] as Vec3,worldPosition:world.toArray(),x:viewport.left+(p.x+1)*viewport.width/2,y:viewport.top+(1-p.y)*viewport.height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1};
 }
 getState(){return {geometryVersion:this.topology.version,revisions:{...this.revisions},actualVisible:this.actualRoot.visible,previewVisible:this.previewRoot.visible,previewMovingLinkIds:this.previewRoot.visible?[...this.links.preview].filter(([,g])=>g.children.some(o=>o instanceof THREE.Mesh&&o.visible)).map(([id])=>id):[],mechanisms:structuredClone(this.states),clearance:this.report?structuredClone(this.report):null,disposed:this.disposed};}
 /** Use this OR the owning scene's traversal, once on context loss, not both. */
 retireContext(){if(this.disposed||this.retired)return null;this.retired=true;return retireContextResources([this.actualRoot,this.previewRoot],{textures:this.surfaceFinish.textures});}
 contextRestored(){if(!this.disposed)this.retired=false;}
 dispose(){if(this.disposed)return;this.disposed=true;this.surfaceFinish.dispose();this.geometry.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.actualRoot.removeFromParent();this.previewRoot.removeFromParent();this.actualRoot.clear();this.previewRoot.clear();this.actualRoot.visible=this.previewRoot.visible=false;this.geometry.clear();this.materials.clear();}
}
