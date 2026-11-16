import {DeploymentScene} from '../../../src/render/deployment-scene';
import {EARTH_RADIUS_KM} from '../../../src/sim/physics';
const fixture=await(await fetch('/docs/qa/milestone-8/camera-component/runtime/camera-replay-fixture.json')).json(),baseline=new URLSearchParams(location.search).has('baseline'),motion=new URLSearchParams(location.search).has('motion');
const scene=new DeploymentScene(document.querySelector('#scene') as HTMLElement,{}, {earthRadiusKm:EARTH_RADIUS_KM,quality:'high',reducedMotion:!motion,orbitalInspectionFollow:!baseline});
scene.setViewport({left:248,right:248,top:170,bottom:120});scene.setCraft(fixture.craftView);scene.setWorkshopEditable(false);
let index=0;
function commit(next:number){index=next;scene.setSnapshot(fixture.snapshots[next]);document.querySelector('#time')!.textContent='T'+fixture.snapshots[next].timeSeconds.toFixed(3)+' s';}
commit(0);scene.setView('craft');
document.querySelector('#variant')!.textContent=baseline?'ACCEPTED INERTIAL INSPECTION':'CANDIDATE · ORBITAL INSPECTION FOLLOW';
['t0','t240','t600','t1385'].forEach((id,i)=>document.querySelector('#'+id)!.addEventListener('click',()=>commit(i)));
document.querySelector('#craft')!.addEventListener('click',()=>scene.setView('craft'));document.querySelector('#orbit')!.addEventListener('click',()=>scene.setView('orbit'));document.querySelector('#battery')!.addEventListener('click',()=>scene.focusPart('battery'));document.querySelector('#whole')!.addEventListener('click',()=>scene.focusCraft());
let running=true,frames=0,last=performance.now();function frame(now:number){if(!running)return;scene.render(Math.min(.1,(now-last)/1000));last=now;frames++;requestAnimationFrame(frame);}requestAnimationFrame(frame);
(window as any).__camera={scene,commit,frames:()=>frames,index:()=>index,inspect:()=>{const s=scene as any;return {camera:scene.qa.getCamera(),up:s.camera.up.toArray(),radial:s.anchor.position.clone().normalize().toArray(),follow:s.orbitalFollow.capture(),physical:{sourceSnapshot:fixture.snapshots[index],anchorPosition:s.anchor.position.toArray(),anchorQuaternion:s.anchor.quaternion.toArray(),bodyPosition:s.body.position.toArray(),earthPosition:s.earth.position.toArray(),earthRadius:s.earth.geometry.parameters.radius,earthRotation:s.earth.rotation.toArray(),links:scene.qa.getDisplayedLinks()},render:scene.qa.getRenderInfo(),state:scene.getState()};},dispose(){running=false;scene.dispose();}};
