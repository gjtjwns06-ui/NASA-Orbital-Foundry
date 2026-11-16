import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {freshCampaign} from '../src/solar/campaign';
import {aimAttitude,instrumentMounts,instrumentPose} from '../src/solar/instrument-rig';
import {getPartGeometry,partTransformFor} from '../src/hardware';
import {createOperations,evaluateExposure,encounterFrame} from '../src/solar/operations';
import type {Vec3} from '../src/sim/types';

describe('mounted science camera and the physical encounter agree',()=>{
 it.each(['px','nx','py','ny','pz','nz'] as const)('uses the actual %s mounting face and metre aperture for the returned ray',face=>{
  const design=freshCampaign().design,part=design.parts.find(p=>p.kind==='camera')!;
  part.face=face;part.rotation=90;
  const mount=instrumentMounts(design)[0],transform=partTransformFor(design,part),aperture=getPartGeometry(design,part).apertures[0];
  const expected=new THREE.Vector3(...transform.position).addScaledVector(new THREE.Vector3(...transform.tangentU),aperture.center[0]).addScaledVector(new THREE.Vector3(...transform.tangentV),aperture.center[1]).addScaledVector(new THREE.Vector3(...transform.normal),aperture.center[2]);
  expect(mount.apertureM.distanceTo(expected)).toBeLessThan(1e-12);
  const direction=new THREE.Vector3(.2,.1,-1).normalize(),attitude=aimAttitude(mount,direction),origin:Vec3=[0,0,9000];
  const pose=instrumentPose(mount,attitude,origin,65,.02);
  expect(new THREE.Vector3(...pose.aimDirection).distanceTo(direction)).toBeLessThan(1e-12);
  expect(new THREE.Vector3(...pose.positionKm).sub(new THREE.Vector3(...origin)).length()).toBeCloseTo(mount.apertureM.length()*.001,10);
  expect(new THREE.Vector3(...pose.upBody).dot(direction)).toBeCloseTo(0,12);
  expect(pose.partId).toBe(part.id);
 });
 it('the centre ray captures context and aiming into space cannot earn a surface result',()=>{
  const design=freshCampaign().design,state=createOperations(design,'aster',8),frame=encounterFrame(state),mount=instrumentMounts(design)[0];
  const attitude=aimAttitude(mount,new THREE.Vector3(...frame.positionKm).negate()),pose=instrumentPose(mount,attitude,frame.positionKm,65,0);
  const result=evaluateExposure(state,{...pose,shutterHeld:true,band:'visible'});
  expect(result.hit).toBe(true);expect(result.context).toBe(true);expect(result.incidenceCos).toBeGreaterThan(.04);
  const away={...pose,aimDirection:pose.aimDirection.map(v=>-v) as Vec3};
  expect(evaluateExposure(state,{...away,shutterHeld:true,band:'visible'}).hit).toBe(false);
 });
});
