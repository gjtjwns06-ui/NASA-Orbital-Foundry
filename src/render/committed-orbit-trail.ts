import * as THREE from 'three';

export interface CommittedTrailPoint {
 readonly timeSeconds:number;
 readonly positionKm:readonly [number,number,number];
}

/** Retained presentation of supplied history, never trajectory propagation.
 * The host retains at most 720 samples; 1024 positions need 12 KiB. Larger
 * callers grow geometrically without truncation. Growth retires the old
 * geometry's GPU registration; line and material remain the same objects. */
export class CommittedOrbitTrail {
 readonly line:THREE.Line<THREE.BufferGeometry,THREE.LineBasicMaterial>;
 private capacity:number;
 private disposed=false;
 private readonly scratch=new THREE.Vector3();

 constructor(private readonly kilometresToWorld:number,initialCapacity=1024){
  if(!Number.isFinite(kilometresToWorld)||kilometresToWorld<=0||!Number.isSafeInteger(initialCapacity)||initialCapacity<2)throw new Error('Invalid committed trail display allocation.');
  this.capacity=initialCapacity;
  this.line=new THREE.Line(this.allocate(initialCapacity),new THREE.LineBasicMaterial({color:0x61aaa8,transparent:true,opacity:.55}));
  this.line.name='committed-actual-history';this.line.raycast=()=>{};this.line.visible=false;
 }

 private allocate(capacity:number){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0,0);geometry.boundingBox=new THREE.Box3();geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),0);
  return geometry;
 }

 setHistory(points:readonly CommittedTrailPoint[]=[]){
  if(this.disposed)return;
  // Validate before modifying the retained buffer. Match the display mapping
  // EarthMJ2000Eq (x,y,z) -> Three (x,z,-y), including Float32 storage.
  for(const point of points)if(!point||!Number.isFinite(point.timeSeconds)||point.positionKm?.length!==3||point.positionKm.some(v=>!Number.isFinite(v)||!Number.isFinite(Math.fround(v*this.kilometresToWorld))))throw new Error('Invalid committed trail position.');
  if(points.length>this.capacity){
   let capacity=this.capacity;while(capacity<points.length)capacity*=2;
   const next=this.allocate(capacity),previous=this.line.geometry;
   this.line.geometry=next;this.capacity=capacity;previous.dispose();
  }
  const geometry=this.line.geometry,attribute=geometry.getAttribute('position') as THREE.BufferAttribute,array=attribute.array as Float32Array,box=geometry.boundingBox!,sphere=geometry.boundingSphere!;
  box.makeEmpty();
  for(let i=0;i<points.length;i++){
   const [x,y,z]=points[i].positionKm,j=i*3;
   array[j]=x*this.kilometresToWorld;array[j+1]=z*this.kilometresToWorld;array[j+2]=(-y*this.kilometresToWorld)||0;
   box.expandByPoint(this.scratch.fromArray(array,j));
  }
  // BufferGeometry.computeBoundingSphere reads the entire capacity, including
  // stale/unused coordinates. Bounds must instead cover the active vertices.
  if(points.length){
   box.getCenter(sphere.center);let radiusSq=0;
   for(let i=0;i<points.length;i++)radiusSq=Math.max(radiusSq,this.scratch.fromArray(array,i*3).distanceToSquared(sphere.center));
   sphere.radius=Math.sqrt(radiusSq);
  }else{sphere.center.set(0,0,0);sphere.radius=0;}
  geometry.setDrawRange(0,points.length);attribute.clearUpdateRanges();
  if(points.length){attribute.addUpdateRange(0,points.length*3);attribute.needsUpdate=true;}
  this.line.visible=points.length>=2;
 }

 /** Source/workshop reset retains allocation; zero vertices are drawn. */
 clear(){this.setHistory();}

 /** Context loss uses the scene's retireContextResources traversal: it retires
  * GPU registrations while retaining these CPU objects and their data. */
 dispose(){if(this.disposed)return;this.disposed=true;this.line.visible=false;this.line.removeFromParent();this.line.geometry.dispose();this.line.material.dispose();}
}
