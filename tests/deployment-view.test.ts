import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {DeploymentView} from '../src/render/deployment-view';
import {createArticulatedDevice,createFixedSolarDevice} from '../src/deployment/devices';
import {compileTopology,initialJointStates,resolveDeploymentGeometry} from '../src/deployment/kinematics';
import {compileDeploymentCraft,createDeploymentCraft} from '../src/deployment/craft';
import type {LocalBox,MechanismTopology} from '../src/deployment/types';

const inside=(p:THREE.Vector3,b:LocalBox)=>{const x=p.clone().sub(new THREE.Vector3(...b.centerM));if(b.quaternion)x.applyQuaternion(new THREE.Quaternion(...b.quaternion).invert());return x.toArray().every((n,i)=>Math.abs(n)<=b.halfM[i]+1e-5);};
function boundArt(topology:MechanismTopology,view:DeploymentView){
 for(const link of topology.links){const group=view.actualRoot.children.find(g=>g.name===link.id)!;
  for(const mesh of group.children)if(mesh instanceof THREE.Mesh){const a=mesh.geometry.getAttribute('position');for(let i=0;i<a.count;i++){const p=new THREE.Vector3().fromBufferAttribute(a,i);expect(link.boxes.some(b=>inside(p,b)),`${link.id} vertex ${p.toArray()}`).toBe(true);}}
 }
}
function resources(view:DeploymentView){const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();for(const root of [view.actualRoot,view.previewRoot])root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});return {geometry,materials};}

describe('original articulated link renderer',()=>{
 it.each(['solar','rf'] as const)('%s: all original vertices stay inside the exact proxy union at folded/intermediate/deployed poses',kind=>{
  const d=createArticulatedDevice('device',kind),c=compileTopology(d.topology),view=new DeploymentView(c),state=initialJointStates(c);
  for(const fraction of [0,.15,.5,.85,1]){for(const joint of c.definition.joints)state[joint.id].angleRad=joint.stowedRad+(joint.deployedRad-joint.stowedRad)*fraction;const dto=resolveDeploymentGeometry(c,state,Math.round(fraction*100));view.setGeometryView(dto);boundArt(c.definition,view);
   view.actualRoot.updateMatrixWorld(true);for(const link of dto.links){const group=view.actualRoot.children.find(g=>g.name===link.linkId)!;expect(group.position.toArray()).toEqual(link.pose.positionM);expect(group.quaternion.toArray()).toEqual(link.pose.quaternion);expect(group.scale.toArray()).toEqual([1,1,1]);}
  }view.dispose();
 });
 it('renders the real fixed span and complete craft topology without adding hidden mount or chassis geometry',()=>{
  const fixed=compileTopology(createFixedSolarDevice('fixed').topology),a=new DeploymentView(fixed);a.setGeometryView(resolveDeploymentGeometry(fixed,{}));boundArt(fixed.definition,a);
  const full=compileDeploymentCraft(createDeploymentCraft()),b=new DeploymentView(full.topology);b.setGeometryView(resolveDeploymentGeometry(full.topology,initialJointStates(full.topology)));boundArt(full.topology.definition,b);
  let draws=0,triangles=0;for(const root of [b.actualRoot])root.traverse(o=>{if(o instanceof THREE.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])expect(Object.values(m).some(v=>v instanceof THREE.Texture)).toBe(false);}});
  expect(draws).toBeLessThanOrEqual(full.topology.definition.links.length*8);expect(triangles).toBeLessThan(150000);a.dispose();b.dispose();
 });
 it('keeps actual and ghost poses independent, with no physical scaling or mutation of the supplied DTO',()=>{
  const c=compileTopology(createArticulatedDevice('wing','solar').topology),view=new DeploymentView(c),actual=resolveDeploymentGeometry(c,initialJointStates(c),1),preview=resolveDeploymentGeometry(c,initialJointStates(c,'deployed'),2),saved=JSON.stringify(actual);
  view.setGeometryView(actual);const prior=view.actualRoot.children.map(g=>[...g.position.toArray(),...g.quaternion.toArray()]);view.setPreviewGeometry(preview);expect(view.actualRoot.children.map(g=>[...g.position.toArray(),...g.quaternion.toArray()])).toEqual(prior);expect(view.previewRoot.children.map(g=>g.quaternion.toArray())).not.toEqual(view.actualRoot.children.map(g=>g.quaternion.toArray()));expect(JSON.stringify(actual)).toBe(saved);
  preview.links[1].pose.positionM[0]=999;expect(view.previewRoot.children[1].position.x).not.toBe(999);view.setPreviewGeometry(null);expect(view.previewRoot.visible).toBe(false);expect(view.actualRoot.visible).toBe(true);view.dispose();
 });
 it('rejects incomplete, nonfinite or resized snapshots atomically before moving any link',()=>{
  const c=compileTopology(createArticulatedDevice('wing','solar').topology),view=new DeploymentView(c),dto=resolveDeploymentGeometry(c,initialJointStates(c),1);view.setGeometryView(dto);const original=view.actualRoot.children.map(g=>g.matrix.toArray());
  for(const corrupt of [(v:typeof dto)=>v.links.pop(),(v:typeof dto)=>v.links[2].pose.positionM[0]=NaN,(v:typeof dto)=>v.links[2].pose.quaternion[3]=9,(v:typeof dto)=>v.boxes[0].halfM[0]*=2,(v:typeof dto)=>delete v.joints[c.definition.joints[0].id]]){const bad=structuredClone(dto);bad.links[0].pose.positionM[0]=20;corrupt(bad);expect(()=>view.setGeometryView(bad)).toThrow();expect(view.actualRoot.children[0].position.x).toBe(dto.links[0].pose.positionM[0]);expect(view.actualRoot.children.map(g=>g.matrix.toArray())).toEqual(original);}view.dispose();
 });
 it('does not allocate new geometry/materials for repeated pose revisions or repeated preview toggles',()=>{
  const c=compileTopology(createArticulatedDevice('wing','rf').topology),view=new DeploymentView(c),dto=resolveDeploymentGeometry(c,initialJointStates(c)),before=resources(view);
  for(let i=0;i<60;i++){dto.revision=i;view.setGeometryView(dto);view.setPreviewGeometry(i%2?dto:null);}
  expect(resources(view).geometry).toEqual(before.geometry);expect(resources(view).materials).toEqual(before.materials);view.dispose();
 });
 it('shows only changed ghost links so unchanged chassis surfaces do not double-draw or masquerade as moving hardware',()=>{
  const c=compileTopology(createArticulatedDevice('wing','solar').topology),view=new DeploymentView(c),states=initialJointStates(c),actual=resolveDeploymentGeometry(c,states);view.setGeometryView(actual);view.setPreviewGeometry(actual);expect(view.getState().previewMovingLinkIds).toEqual([]);states[c.definition.joints[1].id].angleRad=Math.PI/2;view.setPreviewGeometry(resolveDeploymentGeometry(c,states));expect(view.getState().previewMovingLinkIds).toEqual([c.definition.joints[1].childLinkId]);view.dispose();
 });
 it('projects the published hinge pivot through the caller body frame, without deriving a second hinge tree',()=>{
  const c=compileTopology(createArticulatedDevice('wing','solar').topology),view=new DeploymentView(c),dto=resolveDeploymentGeometry(c,initialJointStates(c));view.setGeometryView(dto);view.actualRoot.position.set(1,2,-1);view.actualRoot.rotation.set(.2,.4,.1);const camera=new THREE.PerspectiveCamera(45,16/9,.01,100);camera.position.set(5,4,6);camera.lookAt(view.actualRoot.position);const joint=c.definition.joints[0].id,handle=view.getJointHandleScreen(joint,camera,{left:5,top:7,width:1280,height:720})!,expected=new THREE.Vector3(...dto.joints[joint].pivotBodyM).applyMatrix4(view.actualRoot.matrixWorld);expect(handle.worldPosition).toEqual(expected.toArray());expect(handle.angleRad).toBe(dto.joints[joint].angleRad);expect(handle.channel).toBe('actual');expect(view.getJointHandleScreen('missing',camera,{left:0,top:0,width:1,height:1})).toBeNull();view.dispose();
 });
 it('highlights only exact domain witness boxes and does not fabricate a swept solid',()=>{
  const c=compileTopology(createArticulatedDevice('wing','solar').topology),view=new DeploymentView(c),dto=resolveDeploymentGeometry(c,initialJointStates(c));view.setPreviewGeometry(dto);const a=c.definition.links[0],b=c.definition.links[1],report={status:'uncertain' as const,clearanceM:.002,angleRangeRad:[-Math.PI,0] as [number,number],checkedIntervals:3,maximumUnresolvedDisplacementM:.001,firstWitness:null,firstUncertainWitness:{a:{partId:a.partId,linkId:a.id,boxId:a.boxes[0].id},b:{partId:b.partId,linkId:b.id,boxId:b.boxes[0].id},jointId:c.definition.joints[0].id,angleIntervalRad:[-.3,-.2] as [number,number],sampleAngleRad:-.25,clearanceM:.002},safeThroughAngleRad:-.3};view.setClearance(report);let shown=0;view.previewRoot.traverse(o=>{if(o instanceof THREE.LineSegments&&o.visible)shown++;});expect(shown).toBe(2);expect(view.getState().clearance).toEqual(report);view.setClearance(null);shown=0;view.previewRoot.traverse(o=>{if(o instanceof THREE.LineSegments&&o.visible)shown++;});expect(shown).toBe(0);view.dispose();
 });
 it('retires each owned GPU registration once per loss and retains CPU arrays, then disposes once at the end',()=>{
  const c=compileTopology(createArticulatedDevice('wing','solar').topology),view=new DeploymentView(c),{geometry,materials}=resources(view),counts=new Map<object,number>(),arrays=new Map([...geometry].map(g=>[g,g.getAttribute('position').array]));for(const r of [...geometry,...materials]){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)!+1));}
  view.retireContext();view.retireContext();for(const n of counts.values())expect(n).toBe(1);for(const [g,a]of arrays)expect(g.getAttribute('position').array).toBe(a);view.contextRestored();view.retireContext();for(const n of counts.values())expect(n).toBe(2);view.dispose();view.dispose();for(const n of counts.values())expect(n).toBe(3);expect(view.actualRoot.children).toHaveLength(0);expect(view.previewRoot.children).toHaveLength(0);
 });
});
