import * as THREE from 'three';
import {SwingbyCarrier,type SwingbyCarrierProfile} from './swingby-carrier';

type Direction=readonly [number,number,number];
type MountedPart={id:string;kind:string;modelId?:string};
/** Optional scenario adapter. This owns only the temporary carrier, never the
 * catalogue model, attachment transform, physics state or shared factory pool. */
export class SwingbyBuilderCarrier {
 private profile:SwingbyCarrierProfile|null=null;
 private partId:string|null=null;
 private direction:Direction|null=null;
 private instance:SwingbyCarrier|null=null;
 private engine:THREE.Object3D|null=null;
 private appliedKey='';
 private poseAccepted=true;
 private ghost:SwingbyCarrier|null=null;
 private ghostEngine:THREE.Object3D|null=null;

 configure(profile:SwingbyCarrierProfile|null,partId:string|null,direction?:Direction){
  this.profile=profile?structuredClone(profile):null;this.partId=partId;
  this.direction=direction?[...direction]:null;
  if(!profile||!partId)this.detach();
 }
 /** Run after every assembly rebuild, including undo and physical remount. */
 sync(parts:ReadonlyMap<string,THREE.Object3D>,descriptors:readonly MountedPart[]){
  const descriptor=descriptors.find(p=>p.id===this.partId);
  const model=this.profile?.engineModelId??'chemical230-v2';
  const engine=this.profile&&descriptor?.kind==='engine'&&descriptor.modelId===model?parts.get(descriptor.id)??null:null;
  const key=this.profile?JSON.stringify(this.profile):'';
  if(this.engine!==engine||this.appliedKey!==key)this.detach();
  if(engine&&this.profile&&!this.instance){
   this.instance=new SwingbyCarrier(engine,this.profile);this.engine=engine;this.appliedKey=key;
   this.instance.group.traverse(o=>o.userData.partId=this.partId);
  }
  this.poseAccepted=this.applyDirection(this.instance,this.engine);
 }
 /** Detach before the caller disposes a replaced/deleted factory object. This
  * prevents a second disposal of the carrier's otherwise attached resources. */
 beforePartDisposal(object:THREE.Object3D){if(object===this.engine)this.detach();if(object===this.ghostEngine)this.clearGhost();}
 private applyDirection(instance:SwingbyCarrier|null,engine:THREE.Object3D|null){
  if(!instance||!engine)return true;
  const body=this.direction;
  if(!body)return instance.setThrustDirection(instance.profile.geometry.nominalThrust);
  const local=new THREE.Vector3(...body).applyQuaternion(engine.quaternion.clone().invert());
  return instance.setThrustDirection(local.toArray() as [number,number,number]);
 }
 /** Moving an existing scenario engine keeps its narrow bell/CG ring visible.
  * The direction is supplied by the last evaluated domain state, not recomputed. */
 syncGhost(object:THREE.Object3D,partId:string){
  if(partId!==this.partId||!this.instance||!this.profile){this.clearGhost();return;}
  if(object!==this.ghostEngine){this.clearGhost();this.ghost=new SwingbyCarrier(object,this.profile);this.ghostEngine=object;this.ghost.group.traverse(o=>{o.userData.partId=partId;if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=.55;}});}
  this.applyDirection(this.ghost,this.ghostEngine);
 }
 clearGhost(){this.ghost?.dispose();this.ghost=null;this.ghostEngine=null;}
 /** Three's raycaster also intersects invisible children. Exclude only the
  * stock meshes suppressed by this adapter, without changing legacy hit tests. */
 permitsHit(object:THREE.Object3D){
  if(!this.engine)return true;
  let current:THREE.Object3D|null=object;let visible=true;
  while(current&&current!==this.engine){visible=visible&&current.visible;current=current.parent;}
  return current!==this.engine||visible;
 }
 getState(){return {requestedPartId:this.partId,attachedPartId:this.instance?this.partId:null,profileHash:this.profile?.hash??null,poseAccepted:this.poseAccepted,carrier:this.instance?.getState()??null};}
 private detach(){this.clearGhost();this.instance?.dispose();this.instance=null;this.engine=null;this.appliedKey='';this.poseAccepted=true;}
 dispose(){this.detach();this.profile=null;this.partId=null;this.direction=null;}
}
