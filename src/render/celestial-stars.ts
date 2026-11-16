import * as THREE from 'three';

/** Original decorative celestial directions, not an astronomical catalogue.
 * One owned geometry/material, no bitmap, animation, physics or random-at-frame
 * state. Camera translation is removed; camera rotation still changes the view. */
export class CelestialStars {
 readonly object:THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
 private disposed=false;
 constructor(readonly count=640,seed=0x5a17c0de){
  if(!Number.isInteger(count)||count<400||count>700||!Number.isSafeInteger(seed))throw new Error('Invalid bounded celestial field.');
  let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const positions=new Float32Array(count*3),colours=new Float32Array(count*3),radius=2000;
  for(let i=0;i<count;i++){
   const y=random()*2-1,angle=random()*Math.PI*2,r=Math.sqrt(1-y*y),brightness=.2+Math.pow(random(),3)*.6,tint=random();
   positions.set([r*Math.cos(angle)*radius,y*radius,r*Math.sin(angle)*radius],i*3);
   colours.set([brightness*(.8+.2*tint),brightness*(.9+.1*tint),brightness],i*3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));
  const material=new THREE.PointsMaterial({size:1.25,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.8,depthWrite:false,depthTest:true,toneMapped:false});
  // A celestial background always lies behind actual bodies, even when a
  // distant overview camera is farther than our finite coordinate shell.
  material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n gl_Position.z = gl_Position.w;');};
  material.customProgramCacheKey=()=> 'original-celestial-far-depth-v1';
  this.object=new THREE.Points(geometry,material);this.object.name='original-static-celestial-stars';this.object.frustumCulled=false;this.object.renderOrder=-100;this.object.raycast=()=>{};
  this.object.userData={originalArtwork:true,astronomicalCatalogue:false,count,directions:'fixed celestial display frame',translationParallax:false,simulationTimeAnimation:false};
 }
 centerOn(camera:THREE.Camera){
  if(this.disposed)return;camera.getWorldPosition(this.object.position);if(this.object.parent)this.object.parent.worldToLocal(this.object.position);this.object.updateMatrixWorld();
 }
 getState(){return {count:this.count,disposed:this.disposed,geometries:1,materials:1,textures:0,translationParallax:false,simulationTimeAnimation:false};}
 dispose(){if(this.disposed)return;this.disposed=true;this.object.removeFromParent();this.object.geometry.dispose();this.object.material.dispose();}
}
