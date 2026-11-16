import * as THREE from 'three';
import {compileDeploymentCraft,commissioningMount} from '../../../src/deployment/craft';
import {createDeploymentRuntime,advanceDeployment,getDeploymentGeometry,getDeploymentTelemetry} from '../../../src/deployment/runtime';
import {COMMISSIONING_ENVIRONMENT} from '../../../src/deployment/environment';
import type {DeploymentSceneSnapshot,DeploymentCraftView} from '../../../src/render/deployment-scene-types';
export async function buildCameraFixture(){
 const save=await(await fetch('/docs/qa/milestone-8/camera-component/actual-camera-input.json')).json(),s=createDeploymentRuntime(save.craft,save.plan,save.numerics),c=compileDeploymentCraft(save.craft),sourceId='actual-repaired-camera-replay',snapshots:DeploymentSceneSnapshot[]=[];
 const capture=()=>{const t=getDeploymentTelemetry(s);snapshots.push({sourceId,timeSeconds:s.time,epochTai:COMMISSIONING_ENVIRONMENT.epoch,frame:'EarthMJ2000Eq',geometry:getDeploymentGeometry(s),mechanisms:structuredClone(Object.values(s.mechanisms)),attitudeQuaternion:[...s.angular.quaternion],environment:{...t.environment,earthRotationRad:s.time*COMMISSIONING_ENVIRONMENT.earthRotationRadS}});};
 capture();for(const target of [240,600,save.checkpoint.time]){while(s.time<target-1e-10&&s.status==='running'){advanceDeployment(s,Math.max(0,target-s.requestedTime),64);(window as any).__fixtureProgress=s.time;await new Promise(r=>setTimeout(r,0));}capture();}
 const mismatches=Object.keys(save.checkpoint).filter(k=>JSON.stringify((s as any)[k])!==JSON.stringify(save.checkpoint[k])).map(k=>({key:k,actual:(s as any)[k],expected:save.checkpoint[k]}));
 const craftView:DeploymentCraftView={sourceId,topology:c.topology.definition,geometry:snapshots[0].geometry,
  mountPlanes:c.craft.parts.map(p=>{const pose=commissioningMount({...p,u:0,v:0,rotation:0}),q=new THREE.Quaternion(...pose.quaternion);return {partId:p.id,face:p.face,originBodyM:pose.positionM,normalBody:new THREE.Vector3(0,0,1).applyQuaternion(q).toArray(),axisUBody:new THREE.Vector3(1,0,0).applyQuaternion(q).toArray(),axisVBody:new THREE.Vector3(0,1,0).applyQuaternion(q).toArray(),minimumU:-.6,maximumU:.6,minimumV:-.75,maximumV:.75};}),
  partMounts:c.craft.parts.map(p=>({partId:p.id,face:p.face,u:p.u,v:p.v,rotation:p.rotation,allowedFaces:[p.face]}))};
 return {mismatches,status:s.status,craftView,snapshots};
}
