import * as THREE from 'three';
import type {DeploymentPalette} from './deployment-link-meshes';

export type DeploymentSurfaceStyle='flat'|'textured';
export const DEPLOYMENT_SURFACE_SIZE=256;
type SurfaceKind='foil'|'aluminum';
type SurfacePixels={normal:Uint8Array;roughness:Uint8Array};
const TAU=Math.PI*2;
const triangle=(phase:number)=>Math.asin(Math.sin(phase))*2/Math.PI;
const foilHeight=(u:number,v:number)=>.026*(.54*triangle(TAU*(2*u+v)+.38*Math.sin(TAU*(u-2*v)))+.31*triangle(TAU*(-u+3*v)+1.7)+.15*Math.sin(TAU*(7*u+5*v)+.5));
const aluminumHeight=(u:number,v:number)=>.00008*Math.sin(TAU*(71*u)+.22*Math.sin(TAU*(3*v)))+.00004*Math.sin(TAU*(111*u+v)+.7);
const byte=(v:number)=>Math.round(Math.max(0,Math.min(1,v))*255);

/** Original periodic appearance maps. They change reflected light only: no
 * vertex displacement, thermal property, collision, mass or random game data.
 * No downloaded or AI-generated bitmap is used. */
export function deploymentSurfacePixels(kind:SurfaceKind,size=DEPLOYMENT_SURFACE_SIZE):SurfacePixels {
 if(!Number.isSafeInteger(size)||size<16||size>512||(size&(size-1))!==0)throw new Error('Surface maps require a bounded power-of-two size.');
 const normal=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),height=kind==='foil'?foilHeight:aluminumHeight,step=1/size;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size,index=(y*size+x)*4;
  const dx=(height(u+step,v)-height(u-step,v))/(2*step),dy=(height(u,v+step)-height(u,v-step))/(2*step),length=Math.hypot(dx,dy,1);
  normal[index]=byte(.5-.5*dx/length);normal[index+1]=byte(.5-.5*dy/length);normal[index+2]=byte(.5+.5/length);normal[index+3]=255;
  const value=kind==='foil'?.69+.15*Math.sin(TAU*(2*u+v)+.3)*Math.sin(TAU*(u-3*v)+1.1)+.07*Math.sin(TAU*(13*u+9*v)):.84+.09*Math.sin(TAU*(71*u)+.22*Math.sin(TAU*3*v))+.035*Math.sin(TAU*(111*u+v)+.7);
  roughness[index]=roughness[index+1]=roughness[index+2]=byte(value);roughness[index+3]=255;
 }
 return {normal,roughness};
}

function makeMap(data:Uint8Array,name:string){
 const texture=new THREE.DataTexture(data,DEPLOYMENT_SURFACE_SIZE,DEPLOYMENT_SURFACE_SIZE,THREE.RGBAFormat,THREE.UnsignedByteType);
 texture.name=`Original spacecraft surface · ${name}`;texture.colorSpace=THREE.NoColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}

/** One view owns four small texture objects. A style toggle retains both the
 * mesh/material identities and cached maps; final disposal releases them once.
 * Inactive maps must be included by the owning scene's context retirement. */
export class DeploymentSurfaceFinish {
 private style:DeploymentSurfaceStyle='flat';private disposed=false;
 private maps:{foilNormal:THREE.DataTexture;foilRoughness:THREE.DataTexture;aluminumNormal:THREE.DataTexture;aluminumRoughness:THREE.DataTexture}|null=null;
 private readonly baseline;
 constructor(private readonly palette:DeploymentPalette){
  this.baseline=([palette.foil,palette.ivory,palette.frame] as const).map(m=>({material:m,color:m.color.clone(),metalness:m.metalness,roughness:m.roughness,normalMap:m.normalMap,roughnessMap:m.roughnessMap,normalScale:m.normalScale.clone()}));
 }
 get textures(){return this.maps?Object.values(this.maps):[];}
 setStyle(style:DeploymentSurfaceStyle){
  if(style!=='flat'&&style!=='textured')throw new Error('Unknown spacecraft surface finish.');
  if(this.disposed||this.style===style)return;
  if(style==='textured'){
   if(!this.maps){const foil=deploymentSurfacePixels('foil'),aluminum=deploymentSurfacePixels('aluminum');this.maps={foilNormal:makeMap(foil.normal,'foil creases'),foilRoughness:makeMap(foil.roughness,'foil roughness'),aluminumNormal:makeMap(aluminum.normal,'aluminum grain'),aluminumRoughness:makeMap(aluminum.roughness,'aluminum roughness')};}
   const {foil,ivory,frame}=this.palette;
   foil.color.setHex(0xcba14e);foil.metalness=.82;foil.roughness=.66;foil.normalMap=this.maps.foilNormal;foil.roughnessMap=this.maps.foilRoughness;foil.normalScale.set(.78,.78);
   ivory.color.setHex(0xb7c6cc);ivory.metalness=.58;ivory.roughness=.48;ivory.normalMap=this.maps.aluminumNormal;ivory.roughnessMap=this.maps.aluminumRoughness;ivory.normalScale.set(.25,.25);
   frame.color.setHex(0x81949f);frame.metalness=.86;frame.roughness=.35;frame.normalMap=this.maps.aluminumNormal;frame.roughnessMap=this.maps.aluminumRoughness;frame.normalScale.set(.2,.2);
  }else this.restoreBaseline();
  this.style=style;for(const {material}of this.baseline)material.needsUpdate=true;
 }
 private restoreBaseline(){for(const b of this.baseline){b.material.color.copy(b.color);b.material.metalness=b.metalness;b.material.roughness=b.roughness;b.material.normalMap=b.normalMap;b.material.roughnessMap=b.roughnessMap;b.material.normalScale.copy(b.normalScale);}}
 getState(){return {style:this.style,cachedTextures:this.textures.length,size:this.maps?DEPLOYMENT_SURFACE_SIZE:0,cpuBytes:this.textures.reduce((sum,t)=>sum+(t.image.data?.byteLength??0),0),estimatedMipBytes:this.maps?4*(DEPLOYMENT_SURFACE_SIZE*DEPLOYMENT_SURFACE_SIZE*4*4-4)/3:0,disposed:this.disposed};}
 dispose(){if(this.disposed)return;this.disposed=true;this.restoreBaseline();this.textures.forEach(t=>t.dispose());this.maps=null;}
}
