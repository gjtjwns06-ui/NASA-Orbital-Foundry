import * as THREE from 'three';

type V=readonly [number,number,number];
/** Structural subset of the domain's separately hashed, authored propulsion
 * profile. Rendering does not change the released hardware catalogue. */
export interface SwingbyCarrierProfile {
 id:string;hash:string;provenance:'game-assumption';carrierMassKg:number;carrierCost:number;maximumGimbalDeg:number;
 engineModelId?:string;
 geometry:{envelope:{center:V;half:V};annulus:{center:V;outerRadiusM:number;innerRadiusM:number;thicknessM:number};pivot:V;nominalThrust:V;bell:{lengthM:number;mouthRadiusM:number;neckRadiusM:number}};
}
const attachments=new WeakMap<THREE.Object3D,SwingbyCarrier>();

/** Scenario-only reversible adapter. The stock engine's original children are
 * hidden, never edited/disposed, and exactly restored on removal. The narrower
 * authored bell stays in the old conservative collision/mass-proxy envelope. */
export class SwingbyCarrier {
 readonly group=new THREE.Group();
 readonly nozzle=new THREE.Group();
 private original:{object:THREE.Object3D;visible:boolean}[]=[];
 private geometries=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();
 private disposed=false;private angleDeg=0;private thrust:V;
 private readonly nominal:THREE.Vector3;
 constructor(private engine:THREE.Object3D,readonly profile:SwingbyCarrierProfile){
  if(attachments.has(engine))throw new Error('This engine already has a swingby carrier.');
  this.profile=structuredClone(profile);
  const g=profile.geometry,a=g.annulus,b=g.bell;
  for(const v of [profile.carrierMassKg,profile.carrierCost,profile.maximumGimbalDeg,...g.envelope.center,...g.envelope.half,...a.center,a.outerRadiusM,a.innerRadiusM,a.thicknessM,...g.pivot,...g.nominalThrust,b.lengthM,b.mouthRadiusM,b.neckRadiusM])if(!Number.isFinite(v))throw new Error('Invalid carrier profile.');
  if(profile.provenance!=='game-assumption'||profile.maximumGimbalDeg<=0||profile.maximumGimbalDeg>30||a.innerRadiusM<=0||a.outerRadiusM<=a.innerRadiusM||a.thicknessM<=0||b.lengthM<=0||b.mouthRadiusM<=b.neckRadiusM||b.neckRadiusM<=0||g.envelope.half.some(v=>v<=0))throw new Error('Invalid carrier geometry.');
  this.nominal=new THREE.Vector3(...g.nominalThrust);if(this.nominal.distanceTo(new THREE.Vector3(0,0,-1))>1e-10)throw new Error('Carrier artwork expects the agreed local −Z nominal thrust.');
  this.thrust=[...g.nominalThrust];this.group.name='scenario-cg-trim-carrier';this.group.userData={profileId:profile.id,profileHash:profile.hash,authored:true,carrierMassKg:profile.carrierMassKg,carrierCentroidM:[...a.center],conservativeEnvelope:g.envelope};
  this.nozzle.name='scenario-gimballed-nozzle';this.nozzle.position.set(...g.pivot);this.group.add(this.nozzle);
  const silver=this.mat(new THREE.MeshStandardMaterial({color:0xaebdc3,metalness:.8,roughness:.24})),dark=this.mat(new THREE.MeshStandardMaterial({color:0x24323c,metalness:.76,roughness:.3,side:THREE.DoubleSide})),gold=this.mat(new THREE.MeshStandardMaterial({color:0xc49c48,metalness:.78,roughness:.34}));
  const shape=new THREE.Shape();shape.absarc(0,0,a.outerRadiusM,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,a.innerRadiusM,0,Math.PI*2,true);shape.holes.push(hole);
  const ring=new THREE.ExtrudeGeometry(shape,{depth:a.thicknessM,bevelEnabled:false,steps:1,curveSegments:48});ring.translate(0,0,-a.thicknessM/2);this.add(this.group,ring,silver,a.center);
  for(const z of [-1,1])this.add(this.group,new THREE.TorusGeometry(a.outerRadiusM-.003,.003,8,64),gold,[a.center[0],a.center[1],a.center[2]+z*(a.thicknessM/2-.003)]);
  this.add(this.group,new THREE.SphereGeometry(Math.min(a.innerRadiusM*.65,.042),24,16),dark,g.pivot);
  for(let i=0;i<6;i++){
   const angle=i/6*Math.PI*2,r=(a.outerRadiusM+a.innerRadiusM)*.5;
   const bolt=new THREE.CylinderGeometry(.006,.006,.004,6);bolt.rotateX(Math.PI/2);this.add(this.group,bolt,dark,[a.center[0]+Math.cos(angle)*r,a.center[1]+Math.sin(angle)*r,a.center[2]+a.thicknessM/2]);
  }
  for(let i=0;i<3;i++){
   const angle=i*Math.PI*2/3,start=new THREE.Vector3(a.center[0]+Math.cos(angle)*a.innerRadiusM,a.center[1]+Math.sin(angle)*a.innerRadiusM,a.center[2]),end=new THREE.Vector3(...g.pivot),delta=end.clone().sub(start);
   const support=this.add(this.group,new THREE.CylinderGeometry(.009,.009,delta.length(),10),silver,start.clone().add(end).multiplyScalar(.5).toArray() as [number,number,number]);support.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  }
  const points=[new THREE.Vector2(b.neckRadiusM,0),new THREE.Vector2(b.neckRadiusM*.92,b.lengthM*.16),new THREE.Vector2(b.neckRadiusM*1.15,b.lengthM*.33),new THREE.Vector2(b.mouthRadiusM*.57,b.lengthM*.63),new THREE.Vector2(b.mouthRadiusM*.8,b.lengthM*.84),new THREE.Vector2(b.mouthRadiusM,b.lengthM)];
  const bell=new THREE.LatheGeometry(points,48);bell.rotateX(Math.PI/2);this.add(this.nozzle,bell,dark);
  this.add(this.nozzle,new THREE.TorusGeometry(b.mouthRadiusM-.002,.002,8,48),silver,[0,0,b.lengthM]);
  for(const t of [.22,.27])this.add(this.nozzle,new THREE.TorusGeometry(b.neckRadiusM*1.02,.002,8,32),gold,[0,0,b.lengthM*t]);
  // Bounds are checked before touching the existing visible engine.
  if(!this.withinEnvelope()) {this.disposeOwned();throw new Error('Carrier geometry exceeds its shared physical envelope.');}
  this.original=engine.children.map(object=>({object,visible:object.visible}));this.original.forEach(({object})=>{object.visible=false;});engine.add(this.group);attachments.set(engine,this);
 }
 private mat<T extends THREE.Material>(m:T){this.materials.add(m);return m;}
 private add(parent:THREE.Group,g:THREE.BufferGeometry,m:THREE.Material,p:V=[0,0,0]){this.geometries.add(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(...p);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 private withinEnvelope(){
  this.group.updateWorldMatrix(true,true);const inverse=this.group.matrixWorld.clone().invert(),box=new THREE.Box3();
  this.group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;if(!b)return;const matrix=inverse.clone().multiply(o.matrixWorld);for(let i=0;i<8;i++)box.expandByPoint(new THREE.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(matrix));});
  const g=this.profile.geometry.envelope,limit=new THREE.Box3(new THREE.Vector3(...g.center).sub(new THREE.Vector3(...g.half)),new THREE.Vector3(...g.center).add(new THREE.Vector3(...g.half))).expandByScalar(1e-7);return limit.containsBox(box);
 }
 setThrustDirection(direction:V):boolean {
  if(this.disposed)return false;const v=new THREE.Vector3(...direction);if(!v.toArray().every(Number.isFinite)||Math.abs(v.length()-1)>1e-5)return false;
  const angle=THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(v.dot(this.nominal),-1,1)));if(angle>this.profile.maximumGimbalDeg+1e-7)return false;
  const previous=this.nozzle.quaternion.clone();this.nozzle.quaternion.setFromUnitVectors(this.nominal,v);if(!this.withinEnvelope()){this.nozzle.quaternion.copy(previous);return false;}
  this.thrust=[...direction];this.angleDeg=angle;return true;
 }
 getState(){return {profileId:this.profile.id,profileHash:this.profile.hash,thrustDirectionLocal:[...this.thrust],gimbalAngleDeg:this.angleDeg,carrierCentroidM:[...this.profile.geometry.annulus.center],disposed:this.disposed};}
 private disposeOwned(){this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.geometries.clear();this.materials.clear();}
 dispose(){if(this.disposed)return;this.disposed=true;this.group.removeFromParent();this.original.forEach(({object,visible})=>{if(object.parent===this.engine)object.visible=visible;});this.original=[];this.group.clear();this.disposeOwned();if(attachments.get(this.engine)===this)attachments.delete(this.engine);}
}
