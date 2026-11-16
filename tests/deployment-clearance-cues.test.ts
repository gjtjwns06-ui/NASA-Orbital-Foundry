import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createArticulatedDevice} from '../src/deployment/devices';
import {compileTopology,initialJointStates,resolveDeploymentGeometry} from '../src/deployment/kinematics';
import type {ClearanceReport} from '../src/deployment/types';
import {DeploymentView} from '../src/render/deployment-view';
import {DeploymentScene} from '../src/render/deployment-scene';
import {layoutClearanceCues} from '../src/render/clearance-cue-layout';

// Synthetic reports test presentation contracts; they are not physical
// clearance outcomes. Their boxes and transformed geometry are real DTOs.
function fixture(status:'blocked'|'uncertain'='blocked'){
 const c=compileTopology(createArticulatedDevice('wing','solar').topology),states=initialJointStates(c);
 const joint=c.definition.joints[0];states[joint.id].angleRad=(joint.stowedRad+joint.deployedRad)/2;
 const geometry=resolveDeploymentGeometry(c,states,3),view=new DeploymentView(c),a=geometry.boxes[0],b=geometry.boxes.find(box=>box.linkId!==a.linkId)!;
 const witness={a:{partId:a.partId,linkId:a.linkId,boxId:a.id},b:{partId:b.partId,linkId:b.linkId,boxId:b.id},jointId:joint.id,angleIntervalRad:[states[joint.id].angleRad,states[joint.id].angleRad] as [number,number],sampleAngleRad:states[joint.id].angleRad,clearanceM:.002};
 const report:ClearanceReport={status,clearanceM:.002,angleRangeRad:[joint.stowedRad,joint.deployedRad],checkedIntervals:1,maximumUnresolvedDisplacementM:status==='uncertain'?.001:0,firstWitness:status==='blocked'?witness:null,firstUncertainWitness:status==='uncertain'?witness:null,safeThroughAngleRad:joint.stowedRad};
 view.setGeometryView(resolveDeploymentGeometry(c,initialJointStates(c),1));view.setPreviewGeometry(geometry);view.setClearance(report);
 return {view,geometry,report,witness};
}
function sceneFixture(){
 const f=fixture(),scene=Object.create(DeploymentScene.prototype) as DeploymentScene,raw=scene as any,camera=new THREE.PerspectiveCamera(45,1280/720,.01,100);
 camera.position.set(4,3,6);camera.lookAt(0,0,0);
 Object.assign(raw,{actual:f.view,camera,craft:{sourceId:'accepted-source'},preview:{sourceId:'accepted-source',requestId:'sweep-7',kind:'clearance-witness',geometry:f.geometry,report:f.report},pending:null,cancelledRequests:new Set(),mode:'workshop',editable:true,snapshot:null,lost:false,visible:true,disposed:false,viewport:{left:278,right:294,top:160,bottom:204},renderer:{domElement:{getBoundingClientRect:()=>({left:10,top:20,width:1280,height:720,right:1290,bottom:740})}}});
 return {...f,scene,raw,camera};
}
describe('clearance witness annotation geometry and freshness',()=>{
 it.each(['blocked','uncertain'] as const)('reads two exact existing %s guide centers under the full preview/body transform',status=>{
  const {view,geometry,report,witness}=fixture(status),parent=new THREE.Group();parent.position.set(2,3,-1);parent.rotation.set(.2,-.4,.3);parent.scale.setScalar(.7);parent.add(view.actualRoot,view.previewRoot);
  const before=JSON.stringify(geometry),resources=new Set<unknown>();parent.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){resources.add(o.geometry);resources.add(o.material);}});
  const cues=view.getClearanceAnchors()!;expect(cues.status).toBe(status);expect(cues.sampleAngleRad).toBe(witness.sampleAngleRad);expect(cues.channel).toBe('preview');expect(cues.points).toHaveLength(2);
  for(const [i,p]of cues.points.entries()){const ref=i===0?witness.a:witness.b,box=geometry.boxes.find(box=>box.linkId===ref.linkId&&box.id===ref.boxId)!;expect(p.partId).toBe(ref.partId);expect(p.boxId).toBe(ref.boxId);expect(new THREE.Vector3(...p.worldPosition).distanceTo(new THREE.Vector3(...box.centerM).applyMatrix4(parent.matrixWorld))).toBeLessThan(1e-12);}
  cues.points[0].worldPosition[0]=999;expect(view.getClearanceAnchors()!.points[0].worldPosition[0]).not.toBe(999);expect(JSON.stringify(geometry)).toBe(before);const after=new Set<unknown>();parent.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){after.add(o.geometry);after.add(o.material);}});expect(after).toEqual(resources);
  view.setPreviewGeometry(null);expect(view.getClearanceAnchors()).toBeNull();view.setPreviewGeometry(geometry);view.setClearance(null);expect(view.getClearanceAnchors()).toBeNull();view.setClearance(report);view.retireContext();expect(view.getClearanceAnchors()).toBeNull();view.contextRestored();expect(view.getClearanceAnchors()).not.toBeNull();view.dispose();expect(view.getClearanceAnchors()).toBeNull();
 });
 it('projects without camera motion and rejects stale, pending, flight, hidden and lost contexts',()=>{
  const {scene,raw,camera,view}=sceneFixture(),pose=[...camera.position.toArray(),...camera.quaternion.toArray()];
  const cues=scene.getClearanceCues('accepted-source','sweep-7')!;expect(cues.points.every(p=>p.visible)).toBe(true);expect(cues.bounds).toEqual({left:288,top:180,right:996,bottom:536});expect([...camera.position.toArray(),...camera.quaternion.toArray()]).toEqual(pose);
  expect(scene.getClearanceCues('stale-source','sweep-7')).toBeNull();expect(scene.getClearanceCues('accepted-source','sweep-6')).toBeNull();
  for(const [key,value]of Object.entries({pending:{sourceId:'accepted-source',requestId:'sweep-8'},snapshot:{timeSeconds:0},mode:'craft',editable:false,lost:true,visible:false,disposed:true})){const old=raw[key];raw[key]=value;expect(scene.getClearanceCues('accepted-source','sweep-7'),key).toBeNull();raw[key]=old;}
  raw.cancelledRequests.add('sweep-7');expect(scene.getClearanceCues('accepted-source','sweep-7')).toBeNull();raw.cancelledRequests.clear();raw.preview.topology={};expect(scene.getClearanceCues('accepted-source','sweep-7')).toBeNull();delete raw.preview.topology;
  raw.craft.sourceId='new-source';expect(scene.getClearanceCues('accepted-source','sweep-7')).toBeNull();raw.craft.sourceId='accepted-source';
  camera.lookAt(camera.position.clone().multiplyScalar(2));expect(scene.getClearanceCues('accepted-source','sweep-7')!.points.every(p=>!p.visible)).toBe(true);view.dispose();
 });
 it('bounds and separates cards around close anchors, hides clipped/UI-covered anchors and never clamps a fake anchor',()=>{
  const bounds={left:278,top:260,right:986,bottom:516},points=[{x:620,y:370,visible:true},{x:626,y:376,visible:true}],sizes=[{width:174,height:62},{width:174,height:62}],before=JSON.stringify(points),cards=layoutClearanceCues(points,sizes,bounds);
  expect(cards.every(Boolean)).toBe(true);const [a,b]=cards as NonNullable<typeof cards[number]>[];expect(a.left+a.width+8<=b.left||b.left+b.width+8<=a.left||a.top+a.height+8<=b.top||b.top+b.height+8<=a.top).toBe(true);
  for(const card of cards){expect(card!.left).toBeGreaterThanOrEqual(bounds.left);expect(card!.top).toBeGreaterThanOrEqual(bounds.top);expect(card!.left+card!.width).toBeLessThanOrEqual(bounds.right);expect(card!.top+card!.height).toBeLessThanOrEqual(bounds.bottom);}expect(JSON.stringify(points)).toBe(before);
  expect(layoutClearanceCues([{x:620,y:200,visible:true},{x:626,y:376,visible:false}],sizes,bounds)).toEqual([null,null]);expect(layoutClearanceCues(points,sizes,{left:600,top:360,right:640,bottom:400})).toEqual([null,null]);
 });
});
