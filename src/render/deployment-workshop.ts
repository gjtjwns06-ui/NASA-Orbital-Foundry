import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/** Original workshop scenery, explicitly excluded from spacecraft picking,
 * mounting and physical topology. The accepted hangar is lazily reused. */
export class DeploymentWorkshop {
 readonly root=new THREE.Group();
 private disposed=false;
 private readonly materials=new Set<THREE.Material>();private readonly geometries=new Set<THREE.BufferGeometry>();private readonly textures=new Set<THREE.Texture>();
 private readonly stand=new THREE.Group();private loaded=false;
 constructor(){
  this.root.name='decorative-commissioning-workshop';this.root.userData={decorativeOnly:true,partRaycast:false};
  const palette={navy:new THREE.MeshStandardMaterial({color:0x153343,metalness:.55,roughness:.4}),ivory:new THREE.MeshStandardMaterial({color:0xcbdad9,metalness:.28,roughness:.55}),edge:new THREE.MeshStandardMaterial({color:0xf2b44e,metalness:.3,roughness:.44}),floor:new THREE.MeshStandardMaterial({color:0x264454,metalness:.2,roughness:.75})};Object.values(palette).forEach(m=>this.materials.add(m));
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,pos:[number,number,number],parent=this.root)=>{this.geometries.add(geometry);const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.castShadow=m.receiveShadow=true;m.raycast=()=>{};parent.add(m);return m;};
  const floor=add(new THREE.PlaneGeometry(40,40),palette.floor,[0,-.008,0]);floor.rotation.x=-Math.PI/2;
  add(new THREE.CylinderGeometry(1.25,1.4,.14,48),palette.navy,[0,.07,0]);add(new THREE.CylinderGeometry(1.17,1.17,.024,48),palette.ivory,[0,.15,0]);
  const rim=add(new THREE.TorusGeometry(1.22,.012,8,64),palette.edge,[0,.145,0]);rim.rotation.x=Math.PI/2;
  this.root.add(this.stand);add(new RoundedBoxGeometry(.52,1,.52,1,.025),palette.navy,[0,.5,0],this.stand);add(new RoundedBoxGeometry(.74,.045,.74,1,.008),palette.ivory,[0,1,0],this.stand);
  for(const x of[-1,1])for(const z of[-1,1])add(new RoundedBoxGeometry(.1,.06,.1,1,.01),palette.edge,[x*.28,1.04,z*.28],this.stand);
  new GLTFLoader().load('/assets/hangar.glb',g=>{if(this.disposed){this.releaseLoaded(g.scene);return;}g.scene.name='original-lazy-hangar-background';g.scene.traverse(o=>{if(o instanceof THREE.Mesh){this.geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){this.materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)this.textures.add(v);}o.raycast=()=>{};o.castShadow=false;o.receiveShadow=true;}});this.root.add(g.scene);this.loaded=true;},undefined,()=>{});
 }
 /** Stand is environmental presentation; exact craft minimum remains untouched. */
 setCraftBottom(worldY:number){const top=Math.max(.25,worldY-.01),height=Math.max(.08,top-.17);this.stand.position.y=.17;this.stand.scale.y=height/1.07;}
 private releaseLoaded(root:THREE.Object3D){const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();root.traverse(o=>{if(o instanceof THREE.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
 getState(){return {loaded:this.loaded,decorativeOnly:true};}
 dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.root.clear();}
}
