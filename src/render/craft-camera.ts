import * as THREE from 'three';

/** Camera-only display convention. No simulation, mesh or GPU resource ownership. */
export type InspectionViewport = {left:number;right:number;top:number;bottom:number};
export type CameraObstacle = {center:THREE.Vector3;radius:number};
export type CraftCameraFrame = {
  position:THREE.Vector3;
  quaternion:THREE.Quaternion;
  bounds:THREE.Box3;
  focusBounds?:THREE.Box3;
  preferredScale:number;
  /** A known minimum altitude in this phase, in the same display units. */
  minimumClearance?:number;
  obstacles:readonly CameraObstacle[];
  /** Conservative bounds of real components, in metres in craft-local space. */
  solidBounds?:readonly THREE.Box3[];
  initialDirection:THREE.Vector3;
  frameKey:string;
};
export type InspectionControls = {
  target:THREE.Vector3;enabled:boolean;enablePan:boolean;enableDamping:boolean;
  minDistance:number;maxDistance:number;minPolarAngle:number;maxPolarAngle:number;
  minAzimuthAngle:number;maxAzimuthAngle:number;update:(deltaTime?:number)=>unknown;
};
type Snapshot={position:THREE.Vector3;quaternion:THREE.Quaternion;up:THREE.Vector3;near:number;far:number;zoom:number;view:THREE.PerspectiveCamera['view'];controls:Omit<InspectionControls,'update'>};

function finiteVector(vector:THREE.Vector3) {return [vector.x,vector.y,vector.z].every(Number.isFinite);}
function validBounds(bounds:THREE.Box3) {return !bounds.isEmpty()&&finiteVector(bounds.min)&&finiteVector(bounds.max);}
export function boundsCorners(bounds:THREE.Box3) {
  return [0,1,2,3,4,5,6,7].map(i=>new THREE.Vector3(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z));
}

/** Insets are UI occupancy, not another render viewport or cropped canvas. */
export function inspectionFit(width:number,height:number,fovDeg:number,insets:InspectionViewport) {
  if(![width,height,fovDeg,...Object.values(insets)].every(Number.isFinite)||width<=0||height<=0||fovDeg<=1||fovDeg>=160||Object.values(insets).some(v=>v<0))throw new Error('Invalid inspection viewport');
  const availableWidth=width-insets.left-insets.right,availableHeight=height-insets.top-insets.bottom;
  if(availableWidth<32||availableHeight<32)throw new Error('Inspection viewport has no usable space');
  const tangent=Math.tan(THREE.MathUtils.degToRad(fovDeg)/2);
  // A bounding sphere keeps even the full six-wing assembly in the safe area
  // after a real user orbit. Extra margin leaves room for thin protrusions.
  const halfAngle=Math.atan(Math.min(tangent*availableHeight/height,tangent*availableWidth/height)*.76);
  return {distancePerRadius:1/Math.sin(halfAngle),availableWidth,availableHeight,
    centerX:insets.left+availableWidth/2,centerY:insets.top+availableHeight/2};
}

export function inspectionLayout(frame:CraftCameraFrame,fitDistancePerRadius:number) {
  if(!validBounds(frame.bounds)||!finiteVector(frame.position)||!frame.quaternion.toArray().every(Number.isFinite)||frame.quaternion.lengthSq()<.5||!finiteVector(frame.initialDirection)||!Number.isFinite(frame.preferredScale)||frame.preferredScale<=0||!Number.isFinite(fitDistancePerRadius)||fitDistancePerRadius<1)throw new Error('Invalid craft camera frame');
  const focus=frame.focusBounds??frame.bounds;
  if(!validBounds(focus))throw new Error('Invalid focus bounds');
  const center=focus.getCenter(new THREE.Vector3()),radius=Math.max(1e-4,focus.getSize(new THREE.Vector3()).length()/2);
  const envelopeRadius=Math.max(1e-4,...boundsCorners(frame.bounds).map(p=>p.length()));
  let clearance=Infinity;
  for(const obstacle of frame.obstacles){
    if(!finiteVector(obstacle.center)||!Number.isFinite(obstacle.radius)||obstacle.radius<0)throw new Error('Invalid camera obstacle');
    clearance=Math.min(clearance,frame.position.distanceTo(obstacle.center)-obstacle.radius);
  }
  if(frame.minimumClearance!==undefined){
    if(!Number.isFinite(frame.minimumClearance)||frame.minimumClearance<=0)throw new Error('Invalid phase clearance');
    clearance=Math.min(clearance,frame.minimumClearance);
  }
  if(clearance<=1e-7)throw new Error('Craft lies inside displayed body');
  // Fit orbit consumes <=32% of surface clearance; full craft occupies <=8%.
  // The remaining margin permits any orbit angle, without moving the planet.
  const scale=Math.min(frame.preferredScale,Number.isFinite(clearance)?clearance*.32/(fitDistancePerRadius*envelopeRadius):Infinity);
  const target=center.clone().multiplyScalar(scale).applyQuaternion(frame.quaternion).add(frame.position);
  const worldRadius=radius*scale,fitDistance=worldRadius*fitDistancePerRadius;
  const maxDistance=Number.isFinite(clearance)?Math.max(fitDistance,clearance*.78-center.length()*scale):fitDistance*7;
  return {scale,target,worldRadius,fitDistance,minDistance:worldRadius*1.18,maxDistance,clearance,
    envelopeRadius:envelopeRadius*scale,near:Math.max(1e-7,Math.min(.02,worldRadius*.025))};
}

export class CraftInspectionCamera {
  private snapshot:Snapshot|null=null;
  private viewport:InspectionViewport={left:0,right:0,top:0,bottom:0};
  private width=1;private height=1;
  private lastTarget:THREE.Vector3|null=null;
  private lastFit=0;
  private frameKey='';
  private fitRequested=true;
  private lastLayout:ReturnType<typeof inspectionLayout>|null=null;
  private localToWorld=new THREE.Matrix4();
  private worldToLocal=new THREE.Matrix4();
  private solidBounds:readonly THREE.Box3[]=[];
  constructor(private camera:THREE.PerspectiveCamera,private controls:InspectionControls){}
  get enabled(){return this.snapshot!==null;}
  setViewport(width:number,height:number,insets:InspectionViewport=this.viewport) {
    inspectionFit(width,height,this.camera.fov,insets);
    const changed=width!==this.width||height!==this.height||(['left','right','top','bottom'] as const).some(k=>insets[k]!==this.viewport[k]);
    this.width=width;this.height=height;this.viewport={...insets};
    if(changed)this.fitRequested=true;
    if(this.enabled)this.applyProjection();
  }
  enter() {
    if(this.enabled)return;
    // Flush any residual orbit inertia before capturing a reversible viewpoint.
    const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.enableDamping=damping;
    const c=this.controls;
    this.snapshot={position:this.camera.position.clone(),quaternion:this.camera.quaternion.clone(),up:this.camera.up.clone(),near:this.camera.near,far:this.camera.far,zoom:this.camera.zoom,view:this.camera.view?{...this.camera.view}:null,
      controls:{target:c.target.clone(),enabled:c.enabled,enablePan:c.enablePan,enableDamping:c.enableDamping,minDistance:c.minDistance,maxDistance:c.maxDistance,minPolarAngle:c.minPolarAngle,maxPolarAngle:c.maxPolarAngle,minAzimuthAngle:c.minAzimuthAngle,maxAzimuthAngle:c.maxAzimuthAngle}};
    c.enabled=true;c.enablePan=false;c.minPolarAngle=.005;c.maxPolarAngle=Math.PI-.005;c.minAzimuthAngle=-Infinity;c.maxAzimuthAngle=Infinity;
    this.camera.zoom=1;this.lastTarget=null;this.lastFit=0;this.frameKey='';this.fitRequested=true;this.applyProjection();
  }
  private applyProjection() {
    const fit=inspectionFit(this.width,this.height,this.camera.fov,this.viewport);
    this.camera.setViewOffset(this.width,this.height,this.width/2-fit.centerX,this.height/2-fit.centerY,this.width,this.height);
    this.camera.updateProjectionMatrix();
  }
  requestFit(){this.fitRequested=true;}
  update(frame:CraftCameraFrame) {
    if(!this.enabled)throw new Error('Inspection camera is not enabled');
    const fit=inspectionFit(this.width,this.height,this.camera.fov,this.viewport),layout=inspectionLayout(frame,fit.distancePerRadius);
    const direction=this.lastTarget?this.camera.position.clone().sub(this.controls.target).normalize():frame.initialDirection.clone().normalize();
    if(direction.lengthSq()<.1)direction.set(1,.5,1).normalize();
    const previousDistance=this.camera.position.distanceTo(this.controls.target);
    const zoomRatio=this.lastFit>0?previousDistance/this.lastFit:1;
    let distance=this.fitRequested||!this.lastTarget?layout.fitDistance:layout.fitDistance*zoomRatio;
    distance=THREE.MathUtils.clamp(distance,layout.minDistance,layout.maxDistance);
    this.camera.position.copy(layout.target).addScaledVector(direction,distance);
    this.controls.target.copy(layout.target);
    this.controls.minDistance=layout.minDistance;this.controls.maxDistance=layout.maxDistance;
    this.camera.near=layout.near;this.camera.updateProjectionMatrix();this.camera.lookAt(layout.target);
    this.lastTarget=layout.target.clone();this.lastFit=layout.fitDistance;this.frameKey=frame.frameKey;this.fitRequested=false;this.lastLayout=layout;
    this.localToWorld.compose(frame.position,frame.quaternion,new THREE.Vector3().setScalar(layout.scale));
    this.worldToLocal.copy(this.localToWorld).invert();this.solidBounds=frame.solidBounds??[];
    this.constrain();
    return layout;
  }
  /** After OrbitControls input, constrain only its radius; never rotate the ship. */
  constrain() {
    if(!this.enabled||!this.lastLayout)return;
    const offset=this.camera.position.clone().sub(this.controls.target),length=offset.length(),next=THREE.MathUtils.clamp(length,this.lastLayout.minDistance,this.lastLayout.maxDistance);
    if(length>0&&next!==length)this.camera.position.copy(this.controls.target).addScaledVector(offset,next/length);
    // A focused lens can be much smaller than its bus. Keep an orbit from
    // entering another real component without cloning or mutating its mesh.
    const localDirection=offset.clone().transformDirection(this.worldToLocal);
    for(let pass=0;pass<=this.solidBounds.length;pass++){
      const localPosition=this.camera.position.clone().applyMatrix4(this.worldToLocal);
      const obstacle=this.solidBounds.find(box=>box.containsPoint(localPosition));if(!obstacle)break;
      const exit=new THREE.Ray(localPosition,localDirection).intersectBox(obstacle,new THREE.Vector3());if(!exit)break;
      exit.addScaledVector(localDirection,.025);this.camera.position.copy(exit.applyMatrix4(this.localToWorld));
    }
    this.camera.lookAt(this.controls.target);
  }
  getState() {
    const layout=this.lastLayout;
    return {enabled:this.enabled,frameKey:this.frameKey,displayScale:layout?.scale??null,fitDistance:layout?.fitDistance??null,
      distance:this.enabled?this.camera.position.distanceTo(this.controls.target):null,minDistance:layout?.minDistance??null,maxDistance:layout?.maxDistance??null,
      conservativeSurfaceClearance:layout?.clearance??null,displayEnvelopeRadius:layout?.envelopeRadius??null,viewport:{...this.viewport}};
  }
  exit() {
    const snapshot=this.snapshot;if(!snapshot)return;
    // Clear accumulated damping before restoring the exact previous controls.
    this.controls.enableDamping=false;this.controls.update();
    Object.assign(this.controls,{...snapshot.controls,target:this.controls.target});this.controls.target.copy(snapshot.controls.target);
    this.camera.position.copy(snapshot.position);this.camera.quaternion.copy(snapshot.quaternion);this.camera.up.copy(snapshot.up);
    this.camera.near=snapshot.near;this.camera.far=snapshot.far;this.camera.zoom=snapshot.zoom;
    this.camera.view=snapshot.view?{...snapshot.view}:null;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.snapshot=null;this.lastTarget=null;this.lastFit=0;this.lastLayout=null;this.frameKey='';this.solidBounds=[];
  }
}
