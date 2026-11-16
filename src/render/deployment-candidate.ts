import * as THREE from 'three';
import type {DeploymentGeometryView,MechanismTopology} from '../deployment/types';
import type {DeploymentPreviewView} from './deployment-scene-types';
import {DeploymentView} from './deployment-view';
import {changedMountBoxes} from './deployment-scene-math';

/** Independently owned placement candidate. The accepted view is never edited.
 * Full topology/geometry are validated by DeploymentView, then only changed
 * part links and exact changed bus-pad solids are shown as a ghost. */
export class DeploymentCandidate {
 readonly root=new THREE.Group();
 private readonly view:DeploymentView;
 private readonly ghost=new THREE.MeshBasicMaterial({color:0x67ddcb,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 private readonly pads:THREE.Mesh[]=[];
 private disposed=false;
 readonly visibleParts:string[];
 constructor(actualTopology:MechanismTopology,actual:DeploymentGeometryView,preview:DeploymentPreviewView){
  if(!preview.topology)throw new Error('Placement candidate requires its complete topology.');
  this.view=new DeploymentView({definition:preview.topology});
  try{this.view.setGeometryView(preview.geometry);}catch(error){this.view.dispose();this.ghost.dispose();throw error;}
  const before=new Map(actual.links.map(l=>[l.linkId,l]));
  const changed=new Set(preview.changedPartIds??preview.geometry.links.filter(l=>l.partId!=='bus'&&JSON.stringify(l.pose)!==JSON.stringify(before.get(l.linkId)?.pose)).map(l=>l.partId));
  this.visibleParts=[...changed];
  for(const link of this.view.actualRoot.children){link.visible=changed.has(link.userData.partId);link.traverse(o=>{if(o instanceof THREE.Mesh){o.material=this.ghost;o.castShadow=false;o.receiveShadow=false;}});}
  this.root.add(this.view.actualRoot);this.root.name='independent-candidate-only-geometry';this.root.userData={authority:'editor-candidate-only',sourceId:preview.sourceId,requestId:preview.requestId,candidateSourceId:preview.candidateSourceId??null};
  for(const {linkId,box} of changedMountBoxes(actualTopology,preview.topology)){
   const pose=preview.geometry.links.find(l=>l.linkId===linkId)!.pose,group=new THREE.Group();group.position.set(...pose.positionM);group.quaternion.set(...pose.quaternion);
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...box.halfM.map(n=>n*2) as [number,number,number]),this.ghost);mesh.position.set(...box.centerM);if(box.quaternion)mesh.quaternion.set(...box.quaternion);mesh.userData={candidateMountPad:true,linkId,boxId:box.id};group.add(mesh);this.root.add(group);this.pads.push(mesh);
  }
  this.root.traverse(o=>o.layers.set(1));
 }
 getState(){return {visibleParts:[...this.visibleParts],changedMountPads:this.pads.map(p=>({...p.userData})),disposed:this.disposed};}
 dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.view.dispose();for(const pad of this.pads)pad.geometry.dispose();this.ghost.dispose();this.root.clear();}
}
