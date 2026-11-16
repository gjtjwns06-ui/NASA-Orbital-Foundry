import * as THREE from 'three';
import type { SolarBodyId } from './model';

export function seeded(seed:number){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function canvasTexture(canvas:HTMLCanvasElement){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;}
export function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d')!,g=x.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(255,244,211,1)');g.addColorStop(.15,'rgba(255,216,138,.65)');g.addColorStop(.4,'rgba(255,172,68,.16)');g.addColorStop(1,'rgba(255,148,45,0)');
  x.fillStyle=g;x.fillRect(0,0,256,256);return canvasTexture(c);
}
/** Original procedural maps. NASA base maps remain used for Earth and Mars. */
export function planetTexture(id:SolarBodyId,color:string){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d')!,random=seeded(id.split('').reduce((n,ch)=>n+ch.charCodeAt(0),71)),base=new THREE.Color(color),pixels=x.createImageData(c.width,c.height);
  const gas=['jupiter','saturn','uranus','neptune','venus'].includes(id),srgb=base.clone().convertLinearToSRGB();
  for(let yy=0;yy<c.height;yy++)for(let xx=0;xx<c.width;xx++){
    const u=xx/c.width*2*Math.PI,v=yy/c.height*Math.PI;
    const bands=Math.sin(v*44+Math.sin(u*5+v*5)*.45)+.4*Math.sin(v*93+Math.sin(u*8)*.7);
    const noise=(random()-.5)*.1;
    let shade=gas?.84+bands*(id==='jupiter'?.14:id==='saturn'?.10:.035)+noise:.72+.15*Math.sin(u*9+Math.sin(v*7))+noise*1.8;
    if(id==='venus')shade=.92+.05*Math.sin(v*13+u*5+Math.sin(u*6));
    const index=(yy*c.width+xx)*4;
    // Canvas channels use display-sRGB colours, not linear Color components.
    pixels.data[index]=Math.min(255,srgb.r*255*shade);pixels.data[index+1]=Math.min(255,srgb.g*255*shade);pixels.data[index+2]=Math.min(255,srgb.b*255*shade);pixels.data[index+3]=255;
  }
  x.putImageData(pixels,0,0);
  if(id==='jupiter'){
    for(let i=0;i<9;i++){x.beginPath();x.ellipse(735,315,54-i*4,21-i*1.7,-.09,0,Math.PI*2);x.fillStyle=`rgba(${185+i*4},${87+i*6},${48+i*6},.45)`;x.fill();}
  }
  if(id==='mercury'||id==='aster')for(let i=0;i<180;i++){
    const px=random()*1024,py=random()*512,r=2+random()*18;
    x.beginPath();x.ellipse(px,py,r,r*.65,0,0,Math.PI*2);x.fillStyle='rgba(32,29,25,.23)';x.fill();
    x.beginPath();x.ellipse(px-1,py-1,r*.85,r*.5,0,0,Math.PI*2);x.strokeStyle='rgba(236,223,202,.15)';x.lineWidth=1.3;x.stroke();
  }
  return canvasTexture(c);
}
export function ringTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=4;const x=c.getContext('2d')!,random=seeded(61);
  for(let i=0;i<1024;i++){const t=i/1024,gap=t>.57&&t<.625,alpha=gap?.04:.4+.4*random();x.fillStyle=`rgba(${190+Math.floor(random()*40)},${171+Math.floor(random()*30)},${126+Math.floor(random()*36)},${alpha})`;x.fillRect(i,0,1,4);}return canvasTexture(c);
}
export function disposeGraph(root:THREE.Object3D){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture&&!value.isRenderTargetTexture)textures.add(value);}});
  geometries.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());textures.forEach(v=>v.dispose());
}

