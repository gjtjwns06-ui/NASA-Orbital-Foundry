import * as THREE from 'three';
import {velocityDirectionPlanePoint} from './swingby-velocity-camera';

/** Render DTO only. All positions are Mars-centred ICRF km at their stated
 * elapsed-TDB times. The caller supplies solved samples and achieved records. */
export type SwingbyVector=readonly [number,number,number];
export interface SwingbyAimPlane {centerKm:SwingbyVector;normal:SwingbyVector;xAxis:SwingbyVector;yAxis:SwingbyVector}
export interface SwingbyExitView {
 time:number;localPositionKm:SwingbyVector;heliocentricVelocityKmS:SwingbyVector;
 energyKm2S2:number;directionErrorDeg:number;directionPassed:boolean;energyPassed:boolean;
}
export interface SwingbyObjectiveSnapshot {
 scenarioId:string;revision:number;elapsedSeconds:number;
 aimPlane:SwingbyAimPlane;aim:{xKm:number;yKm:number};
 referencePathKm?:readonly SwingbyVector[];predictedPathKm:readonly SwingbyVector[];actualPathKm:readonly SwingbyVector[];
 correction:{time:number;positionKm:SwingbyVector;vectorMps:SwingbyVector;actualVectorMps?:SwingbyVector}|null;
 predictedExit:SwingbyExitView|null;achievedExit:SwingbyExitView|null;
 goal:{targetDirection:SwingbyVector;toleranceDeg:number;energyRangeKm2S2:readonly [number,number]};
 previewStatus:'accepted'|'pending'|'invalid';
}
export interface SwingbyObjectiveLabels {
 aim:{kind:'fixed-inbound-aim-plane';xKm:number;yKm:number;ghost:boolean;previewStatus:SwingbyObjectiveSnapshot['previewStatus']};
 correction:{time:number;plannedVectorMps:SwingbyVector;actualVectorMps:SwingbyVector|null;displayLengthPerMps:number}|null;
 velocity:{space:'heliocentric-velocity';physicalToleranceDeg:number;angularMagnification:number;displayToleranceDeg:number;displayAngleClamped:boolean;energyRangeKm2S2:readonly [number,number];predicted:SwingbyExitView|null;achieved:SwingbyExitView|null};
}
export type SwingbyAimDrag={xKm:number;yKm:number;revision:number;scenarioId:string};
export const SWINGBY_OBJECTIVE_LIMITS=Object.freeze({pathSamples:16384,positionKm:1e9,aimKm:1e7,mappedPosition:1e7,maximumDisplayedAngleDeg:85});
const UP=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),DEG=Math.PI/180;
const finite=(v:number,label:string,max=1e12)=>{if(!Number.isFinite(v)||Math.abs(v)>max)throw new Error(`Invalid swingby visual ${label}.`);};
const vector=(v:SwingbyVector,label:string,max:number=SWINGBY_OBJECTIVE_LIMITS.positionKm)=>{if(!Array.isArray(v)||v.length!==3)throw new Error(`Invalid swingby visual ${label}.`);v.forEach(n=>finite(n,label,max));return new THREE.Vector3(...v);};
const unit=(v:SwingbyVector,label:string)=>{const n=vector(v,label);if(Math.abs(n.length()-1)>1e-5)throw new Error(`Swingby visual ${label} must be unit length.`);return n;};
const icrf=(v:SwingbyVector)=>new THREE.Vector3(v[0],v[2],-v[1]);
const lineMaterial=(color:number,opacity=1)=>new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:false,toneMapped:false});

/** Returns a finite physical point on the fixed plane. No clamp, targeting
 * solve, success calculation or plan mutation takes place in this renderer. */
export function intersectSwingbyAimPlane(ray:THREE.Ray,plane:SwingbyAimPlane):{xKm:number;yKm:number}|null {
 const n=unit(plane.normal,'aim normal'),center=vector(plane.centerKm,'aim center'),x=unit(plane.xAxis,'aim X'),y=unit(plane.yAxis,'aim Y');
 const hit=ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n,center),new THREE.Vector3());
 if(!hit)return null;const offset=hit.sub(center),xKm=offset.dot(x),yKm=offset.dot(y);
 if(!Number.isFinite(xKm)||!Number.isFinite(yKm)||Math.max(Math.abs(xKm),Math.abs(yKm))>SWINGBY_OBJECTIVE_LIMITS.aimKm)return null;
 return {xKm,yKm};
}
/** Independent direction display. Magnifies angular separation around the
 * fixed goal axis, never velocity magnitude or the physical success tolerance. */
export function magnifiedVelocityDirection(direction:SwingbyVector,target:SwingbyVector,magnification:number){
 finite(magnification,'angular magnification',1000);if(magnification<1)throw new Error('Angular magnification must be at least one.');
 const axis=unit(target,'goal direction'),actual=vector(direction,'exit velocity',1e5);if(actual.length()<1e-12)throw new Error('Zero exit velocity cannot define a direction.');actual.normalize();
 const basisX=new THREE.Vector3().crossVectors(Math.abs(axis.y)<.9?UP:Z,axis).normalize(),basisY=new THREE.Vector3().crossVectors(axis,basisX);
 const dot=THREE.MathUtils.clamp(actual.dot(axis),-1,1),physicalAngleRad=Math.acos(dot),raw=physicalAngleRad*magnification;
 const displayAngleRad=Math.min(raw,SWINGBY_OBJECTIVE_LIMITS.maximumDisplayedAngleDeg*DEG),azimuth=Math.atan2(actual.dot(basisY),actual.dot(basisX));
 return {direction:new THREE.Vector3(Math.sin(displayAngleRad)*Math.cos(azimuth),Math.sin(displayAngleRad)*Math.sin(azimuth),Math.cos(displayAngleRad)),physicalAngleRad,displayAngleRad,clamped:raw>displayAngleRad+1e-12};
}

function validate(snapshot:SwingbyObjectiveSnapshot){
 if(!snapshot||typeof snapshot.scenarioId!=='string'||!snapshot.scenarioId.trim()||snapshot.scenarioId.length>160)throw new Error('Invalid swingby visual scenario.');
 if(!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0)throw new Error('Invalid swingby visual revision.');
 finite(snapshot.elapsedSeconds,'time');if(snapshot.elapsedSeconds<0)throw new Error('Invalid swingby visual time.');
 if(!['accepted','pending','invalid'].includes(snapshot.previewStatus))throw new Error('Invalid swingby preview status.');
 const p=snapshot.aimPlane,x=unit(p.xAxis,'aim X'),y=unit(p.yAxis,'aim Y'),n=unit(p.normal,'aim normal');vector(p.centerKm,'aim center');
 if(Math.max(Math.abs(x.dot(y)),Math.abs(x.dot(n)),Math.abs(y.dot(n)))>1e-5||new THREE.Vector3().crossVectors(x,y).dot(n)<.99999)throw new Error('Aim plane must have a right-handed orthonormal basis.');
 finite(snapshot.aim.xKm,'aim X',SWINGBY_OBJECTIVE_LIMITS.aimKm);finite(snapshot.aim.yKm,'aim Y',SWINGBY_OBJECTIVE_LIMITS.aimKm);
 for(const path of [snapshot.referencePathKm??[],snapshot.predictedPathKm,snapshot.actualPathKm]){if(!Array.isArray(path)||path.length>SWINGBY_OBJECTIVE_LIMITS.pathSamples)throw new Error('Swingby visual path exceeds bounded sample budget.');path.forEach(v=>vector(v,'path point'));}
 if(snapshot.correction){const c=snapshot.correction;finite(c.time,'correction time');vector(c.positionKm,'correction position');vector(c.vectorMps,'correction vector',1e4);if(c.actualVectorMps){if(c.time>snapshot.elapsedSeconds)throw new Error('Actual burn cannot be drawn before its event.');vector(c.actualVectorMps,'actual correction',1e4);}}
 const exit=(e:SwingbyExitView)=>{finite(e.time,'exit time');if(e.time<0)throw new Error('Invalid exit time.');vector(e.localPositionKm,'exit position');if(vector(e.heliocentricVelocityKmS,'exit velocity',1e5).length()<1e-12)throw new Error('Zero exit velocity.');finite(e.energyKm2S2,'exit energy');finite(e.directionErrorDeg,'exit direction error',180);if(e.directionErrorDeg<0||typeof e.directionPassed!=='boolean'||typeof e.energyPassed!=='boolean')throw new Error('Invalid exit diagnostic.');};
 if(snapshot.predictedExit)exit(snapshot.predictedExit);if(snapshot.achievedExit){exit(snapshot.achievedExit);if(snapshot.achievedExit.time>snapshot.elapsedSeconds)throw new Error('Achieved exit cannot be drawn before its event.');}
 unit(snapshot.goal.targetDirection,'goal direction');finite(snapshot.goal.toleranceDeg,'goal tolerance',85);if(snapshot.goal.toleranceDeg<=0)throw new Error('Goal tolerance must be positive.');
 const range=snapshot.goal.energyRangeKm2S2;if(!Array.isArray(range)||range.length!==2)throw new Error('Invalid goal energy range.');range.forEach(v=>finite(v,'goal energy'));if(range[0]>=range[1])throw new Error('Reversed goal energy range.');
}

/** Owns all GPU resources beneath both groups. Detach/dispose before a parent
 * scene-wide disposal pass. No DOM, scene renderer, global listener or texture.
 * The velocity group is an INSET: do not place it at a spatial exit waypoint. */
export class SwingbyObjective {
 readonly group=new THREE.Group();
 readonly velocityGroup=new THREE.Group();
 private snapshot:SwingbyObjectiveSnapshot|null=null;
 private signature='';private disposed=false;private editing=true;private historyOnly=false;
 private frameOrigin:SwingbyVector=[0,0,0];private kmToScene=1;
 private planeSpanKm=2000;private handleRadius=.15;private correctionScale=.12;
 private velocityLength=1.8;private angularMagnification=40;
 private drag:SwingbyAimDrag|null=null;
 private geometry=new Set<THREE.BufferGeometry>();private materials=new Set<THREE.Material>();
 private planeGroup=new THREE.Group();private handleGroup=new THREE.Group();private ghostGroup=new THREE.Group();
 private reference:THREE.Line;private predicted:THREE.Line;private actual:THREE.Line;
 private predictedExit:THREE.Mesh;private achievedExit:THREE.Mesh;
 private burnStem:THREE.Line;private burnHead:THREE.Mesh;private actualBurnStem:THREE.Line;private actualBurnHead:THREE.Mesh;
 private velocityCone:THREE.Mesh;private velocityRim:THREE.Line;private velocityAxis:THREE.Line;
 private velocityTicks:THREE.LineSegments;private velocityInnerRing:THREE.Line;
 private velocityPredicted:THREE.Line;private velocityAchieved:THREE.Line;private velocityPredictedTip:THREE.Mesh;private velocityAchievedTip:THREE.Mesh;
 private planeGrid:THREE.LineSegments;private planePanel:THREE.Mesh;
 constructor(){
  this.group.name='swingby-objective';this.velocityGroup.name='swingby-velocity-space-inset';
  this.group.userData={ownsResources:true,frame:'Mars-centered ICRF km',presentationOnly:true};this.velocityGroup.userData={ownsResources:true,space:'heliocentric velocity direction',notSpatialPortal:true};
  this.reference=this.path('reference-path',0x93a6b3,.28);this.predicted=this.path('predicted-path',0x72dfd1,.9);this.actual=this.path('actual-flown-path',0xf5d6a0,1);
  this.group.add(this.reference,this.predicted,this.actual,this.planeGroup,this.handleGroup,this.ghostGroup);
  const grid:number[]=[];for(let i=-5;i<=5;i++){const t=i/5;grid.push(-1,t,0,1,t,0,t,-1,0,t,1,0);}
  const gridGeometry=this.own(new THREE.BufferGeometry());gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));
  this.planeGrid=new THREE.LineSegments(gridGeometry,this.mat(lineMaterial(0x79bac6,.3)));
  this.planePanel=new THREE.Mesh(this.own(new THREE.PlaneGeometry(2,2)),this.mat(new THREE.MeshBasicMaterial({color:0x244453,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false,toneMapped:false})));
  this.planeGroup.add(this.planePanel,this.planeGrid);this.planeGroup.name='fixed-inbound-aim-plane';
  this.reticle(this.handleGroup,0xf7c775);this.reticle(this.ghostGroup,0x94e7e0,.55);this.handleGroup.name='physical-aim-target';this.ghostGroup.name='provisional-pointer-aim';this.ghostGroup.visible=false;
  this.predictedExit=new THREE.Mesh(this.own(new THREE.OctahedronGeometry(.095,0)),this.mat(new THREE.MeshBasicMaterial({color:0x72dfd1,wireframe:true,toneMapped:false})));
  this.achievedExit=new THREE.Mesh(this.own(new THREE.OctahedronGeometry(.1,0)),this.mat(new THREE.MeshStandardMaterial({color:0xf5d6a0,roughness:.35,metalness:.45})));
  this.predictedExit.name='predicted-outward-exit';this.achievedExit.name='recorded-outward-exit';this.group.add(this.predictedExit,this.achievedExit);
  this.burnStem=this.line('planned-correction-vector',0xf7c775,2);this.actualBurnStem=this.line('recorded-correction-vector',0xf5d6a0,2);
  this.burnHead=this.arrowHead(0xf7c775);this.actualBurnHead=this.arrowHead(0xf5d6a0);this.group.add(this.burnStem,this.burnHead,this.actualBurnStem,this.actualBurnHead);
  const coneGeom=this.own(new THREE.ConeGeometry(1,1,64,1,true));coneGeom.translate(0,-.5,0);coneGeom.rotateX(-Math.PI/2);
  this.velocityCone=new THREE.Mesh(coneGeom,this.mat(new THREE.MeshBasicMaterial({color:0x6fd7c4,transparent:true,opacity:.08,side:THREE.DoubleSide,depthWrite:false,toneMapped:false})));
  this.velocityRim=this.line('velocity-tolerance-rim',0x6fd7c4,65);this.velocityAxis=this.line('fixed-velocity-goal-axis',0x6fd7c4,2);
  this.velocityInnerRing=this.line('velocity-half-tolerance-guide',0x6fd7c4,65,.2);
  const ticks=this.own(new THREE.BufferGeometry());ticks.setAttribute('position',new THREE.BufferAttribute(new Float32Array(28*3),3).setUsage(THREE.DynamicDrawUsage));ticks.setDrawRange(0,0);
  this.velocityTicks=new THREE.LineSegments(ticks,this.mat(lineMaterial(0x8eafba,.45)));this.velocityTicks.name='velocity-radial-ticks';this.velocityTicks.frustumCulled=false;
  this.velocityPredicted=this.line('predicted-heliocentric-velocity',0x7ddde5,2);this.velocityAchieved=this.line('achieved-heliocentric-velocity',0xf5d6a0,2);
  this.velocityPredictedTip=new THREE.Mesh(this.own(new THREE.OctahedronGeometry(.055,0)),this.mat(new THREE.MeshBasicMaterial({color:0x7ddde5,wireframe:true,toneMapped:false})));
  this.velocityAchievedTip=new THREE.Mesh(this.own(new THREE.OctahedronGeometry(.055,0)),this.mat(new THREE.MeshBasicMaterial({color:0xf5d6a0,toneMapped:false})));
  this.velocityGroup.add(this.velocityCone,this.velocityRim,this.velocityAxis,this.velocityTicks,this.velocityInnerRing,this.velocityPredicted,this.velocityAchieved,this.velocityPredictedTip,this.velocityAchievedTip);this.group.visible=false;this.velocityGroup.visible=false;
 }
 private own<T extends THREE.BufferGeometry>(g:T):T{this.geometry.add(g);return g;}
 private mat<T extends THREE.Material>(m:T):T{this.materials.add(m);return m;}
 private line(name:string,color:number,capacity:number,opacity=1){const geometry=this.own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);const line=new THREE.Line(geometry,this.mat(lineMaterial(color,opacity)));line.name=name;line.frustumCulled=false;return line;}
 private path(name:string,color:number,opacity:number){return this.line(name,color,SWINGBY_OBJECTIVE_LIMITS.pathSamples,opacity);}
 private arrowHead(color:number){const mesh=new THREE.Mesh(this.own(new THREE.ConeGeometry(.045,.13,12)),this.mat(new THREE.MeshBasicMaterial({color,toneMapped:false})));return mesh;}
 private reticle(group:THREE.Group,color:number,opacity=1){
  const material=this.mat(new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,toneMapped:false,depthTest:false,depthWrite:false}));
  const ring=new THREE.Mesh(this.own(new THREE.TorusGeometry(.12,.012,8,48)),material);const center=new THREE.Mesh(this.own(new THREE.OctahedronGeometry(.035,0)),material);
  ring.renderOrder=center.renderOrder=20;group.add(ring,center);
  const ticks:number[]=[];for(let i=0;i<4;i++){const a=i*Math.PI/2;ticks.push(Math.cos(a)*.16,Math.sin(a)*.16,0,Math.cos(a)*.21,Math.sin(a)*.21,0);}
  const geo=this.own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(ticks,3));const tick=new THREE.LineSegments(geo,this.mat(new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false,depthWrite:false,toneMapped:false})));tick.renderOrder=20;group.add(tick);
 }
 setSnapshot(snapshot:SwingbyObjectiveSnapshot|null){
  if(this.disposed)return;if(!snapshot){this.snapshot=null;this.signature='';this.drag=null;this.group.visible=this.velocityGroup.visible=false;return;}
  validate(snapshot);const signature=JSON.stringify(snapshot);if(signature===this.signature)return;
  this.snapshot=structuredClone(snapshot);this.signature=signature;this.drag=null;this.rebuild();
 }
 setDisplayFrame(originKm:SwingbyVector,kmToScene:number){vector(originKm,'display origin');finite(kmToScene,'display scale',1e6);if(kmToScene<=0)throw new Error('Display scale must be positive.');this.frameOrigin=[...originKm];this.kmToScene=kmToScene;this.rebuild();}
 setAimDisplay(options:{spanKm?:number;handleRadiusWorld?:number;correctionWorldPerMps?:number}){
  for(const [key,value] of Object.entries(options)){finite(value,`display ${key}`,1e7);if(value<=0)throw new Error('Display dimensions must be positive.');}
  this.planeSpanKm=options.spanKm??this.planeSpanKm;this.handleRadius=options.handleRadiusWorld??this.handleRadius;this.correctionScale=options.correctionWorldPerMps??this.correctionScale;this.rebuild();
 }
 setVelocityDisplay(options:{length?:number;angularMagnification?:number}){
  const length=options.length??this.velocityLength,magnification=options.angularMagnification??this.angularMagnification;finite(length,'velocity inset length',1e4);finite(magnification,'angular magnification',1000);if(length<=0||magnification<1)throw new Error('Invalid velocity display dimensions.');this.velocityLength=length;this.angularMagnification=magnification;this.rebuild();
 }
 setEditing(enabled:boolean){this.editing=enabled;if(!enabled)this.drag=null;this.rebuild();}
 /** Review presentation never turns a future plan into recorded history. */
 setHistoryOnly(enabled:boolean){this.historyOnly=enabled;if(enabled)this.drag=null;this.rebuild();}
 private map(position:SwingbyVector){const p=icrf([position[0]-this.frameOrigin[0],position[1]-this.frameOrigin[1],position[2]-this.frameOrigin[2]]).multiplyScalar(this.kmToScene);if(p.length()>SWINGBY_OBJECTIVE_LIMITS.mappedPosition)throw new Error('Swingby visual display frame is too large.');return p;}
 private aimPosition(aim:{xKm:number;yKm:number}){const p=this.snapshot!.aimPlane;return this.map([p.centerKm[0]+p.xAxis[0]*aim.xKm+p.yAxis[0]*aim.yKm,p.centerKm[1]+p.xAxis[1]*aim.xKm+p.yAxis[1]*aim.yKm,p.centerKm[2]+p.xAxis[2]*aim.xKm+p.yAxis[2]*aim.yKm]);}
 private writeLine(line:THREE.Line,points:readonly THREE.Vector3[]){const a=line.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<points.length;i++)a.setXYZ(i,points[i].x,points[i].y,points[i].z);a.needsUpdate=true;line.geometry.setDrawRange(0,points.length);line.visible=points.length>=2;}
 private writePath(line:THREE.Line,points:readonly SwingbyVector[]){const a=line.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<points.length;i++){const p=this.map(points[i]);a.setXYZ(i,p.x,p.y,p.z);}a.needsUpdate=true;line.geometry.setDrawRange(0,points.length);line.visible=points.length>=2;}
 private arrow(stem:THREE.Line,head:THREE.Mesh,start:THREE.Vector3,vectorMps:SwingbyVector|null){
  const direction=vectorMps?icrf(vectorMps):new THREE.Vector3(),magnitude=direction.length();stem.visible=head.visible=magnitude>1e-12;if(!stem.visible)return;direction.normalize();const end=start.clone().addScaledVector(direction,magnitude*this.correctionScale);this.writeLine(stem,[start,end]);head.position.copy(end);head.quaternion.setFromUnitVectors(UP,direction);
 }
 private rebuild(){
  if(this.disposed||!this.snapshot)return;const s=this.snapshot,p=s.aimPlane;this.group.visible=this.velocityGroup.visible=true;
  const basis=new THREE.Matrix4().makeBasis(icrf(p.xAxis),icrf(p.yAxis),icrf(p.normal));this.planeGroup.position.copy(this.map(p.centerKm));this.planeGroup.quaternion.setFromRotationMatrix(basis);this.planeGroup.scale.setScalar(this.planeSpanKm*this.kmToScene);
  this.handleGroup.position.copy(this.aimPosition(s.aim));this.handleGroup.quaternion.copy(this.planeGroup.quaternion);this.handleGroup.scale.setScalar(this.handleRadius/.15);this.handleGroup.visible=this.editing;
  this.ghostGroup.quaternion.copy(this.planeGroup.quaternion);this.ghostGroup.scale.copy(this.handleGroup.scale);this.ghostGroup.visible=!!this.drag;if(this.drag)this.ghostGroup.position.copy(this.aimPosition(this.drag));
  this.writePath(this.reference,s.referencePathKm??[]);this.writePath(this.predicted,s.previewStatus==='invalid'?[]:s.predictedPathKm);this.writePath(this.actual,s.actualPathKm);
  const planned=this.predicted.material as THREE.LineBasicMaterial;planned.opacity=s.previewStatus==='pending'?.24:.9;planned.transparent=true;
  this.predictedExit.visible=!!s.predictedExit&&s.previewStatus==='accepted';if(s.predictedExit)this.predictedExit.position.copy(this.map(s.predictedExit.localPositionKm));
  this.achievedExit.visible=!!s.achievedExit;if(s.achievedExit)this.achievedExit.position.copy(this.map(s.achievedExit.localPositionKm));
  if(s.correction){const start=this.map(s.correction.positionKm);this.arrow(this.burnStem,this.burnHead,start,s.correction.vectorMps);this.arrow(this.actualBurnStem,this.actualBurnHead,start,s.correction.actualVectorMps??null);}else this.burnStem.visible=this.burnHead.visible=this.actualBurnStem.visible=this.actualBurnHead.visible=false;
  const theta=Math.min(s.goal.toleranceDeg*this.angularMagnification,SWINGBY_OBJECTIVE_LIMITS.maximumDisplayedAngleDeg)*DEG,r=this.velocityLength*Math.tan(theta),length=this.velocityLength;
  this.velocityCone.scale.set(r,r,length); // Cone geometry lies along +Z after construction.
  const rim=Array.from({length:65},(_,i)=>new THREE.Vector3(r*Math.cos(i/64*Math.PI*2),r*Math.sin(i/64*Math.PI*2),length));this.writeLine(this.velocityRim,rim);this.writeLine(this.velocityInnerRing,rim.map(p=>new THREE.Vector3(p.x*.5,p.y*.5,p.z)));this.writeLine(this.velocityAxis,[new THREE.Vector3(),new THREE.Vector3(0,0,length)]);
  const tickPoints:THREE.Vector3[]=[];for(let i=0;i<12;i++){const a=i*Math.PI/6,outer=i%3===0?1.17:1.1;for(const factor of [1.025,outer])tickPoints.push(new THREE.Vector3(r*factor*Math.cos(a),r*factor*Math.sin(a),length));}tickPoints.push(new THREE.Vector3(-r*.1,0,length),new THREE.Vector3(r*.1,0,length),new THREE.Vector3(0,-r*.1,length),new THREE.Vector3(0,r*.1,length));this.writeLine(this.velocityTicks,tickPoints);
  const showVelocity=(record:SwingbyExitView|null,line:THREE.Line,tip:THREE.Mesh)=>{line.visible=tip.visible=!!record;if(!record)return;const direction=magnifiedVelocityDirection(record.heliocentricVelocityKmS,s.goal.targetDirection,this.angularMagnification).direction;const end=new THREE.Vector3(...velocityDirectionPlanePoint(direction.toArray() as [number,number,number],length));this.writeLine(line,[new THREE.Vector3(),end]);tip.position.copy(end);};
  showVelocity(s.previewStatus==='accepted'?s.predictedExit:null,this.velocityPredicted,this.velocityPredictedTip);showVelocity(s.achievedExit,this.velocityAchieved,this.velocityAchievedTip);
  this.planeGroup.visible=!this.historyOnly;
  if(this.historyOnly){for(const object of [this.handleGroup,this.ghostGroup,this.reference,this.predicted,this.predictedExit,this.burnStem,this.burnHead,this.velocityGroup])object.visible=false;}
 }
 private localRay(worldRay:THREE.Ray){this.group.updateWorldMatrix(true,false);return worldRay.clone().applyMatrix4(this.group.matrixWorld.clone().invert());}
 pickAim(worldRay:THREE.Ray):boolean {if(this.disposed||!this.snapshot||!this.editing||this.historyOnly||this.snapshot.previewStatus==='pending')return false;return this.localRay(worldRay).intersectsSphere(new THREE.Sphere(this.handleGroup.position,this.handleRadius*1.5));}
 private dragPoint(worldRay:THREE.Ray):SwingbyAimDrag|null {
  const s=this.snapshot;if(!s)return null;const ray=this.localRay(worldRay),origin=ray.origin.clone().divideScalar(this.kmToScene),direction=ray.direction;
  const physicalRay=new THREE.Ray(new THREE.Vector3(origin.x+this.frameOrigin[0],-origin.z+this.frameOrigin[1],origin.y+this.frameOrigin[2]),new THREE.Vector3(direction.x,-direction.z,direction.y).normalize());
  const point=intersectSwingbyAimPlane(physicalRay,s.aimPlane);return point?{...point,revision:s.revision,scenarioId:s.scenarioId}:null;
 }
 beginAimDrag(ray:THREE.Ray):SwingbyAimDrag|null {if(!this.pickAim(ray))return null;this.drag=this.dragPoint(ray);this.rebuild();return this.drag?{...this.drag}:null;}
 updateAimDrag(ray:THREE.Ray):SwingbyAimDrag|null {if(!this.drag)return null;const point=this.dragPoint(ray);if(point)this.drag=point;this.rebuild();return point?{...point}:null;}
 endAimDrag(commit:boolean):SwingbyAimDrag|null {const result=commit&&this.drag?{...this.drag}:null;this.drag=null;this.rebuild();return result;}
 getAimWorldPosition(){if(!this.snapshot||this.disposed)return null;this.group.updateWorldMatrix(true,false);return this.handleGroup.position.clone().applyMatrix4(this.group.matrixWorld);}
 getVelocityDisplayGeometry(){if(!this.snapshot||this.disposed)return null;return {planeDepth:this.velocityLength,goalRadius:this.velocityCone.scale.x,tipPoints:[this.velocityPredictedTip,this.velocityAchievedTip].filter(t=>t.visible).map(t=>t.position.toArray() as [number,number,number])};}
 setVelocityMarkerWorldRadius(radius:number){if(!Number.isFinite(radius)||radius<=0)throw new Error('Invalid velocity marker radius');for(const tip of [this.velocityPredictedTip,this.velocityAchievedTip])tip.scale.setScalar(radius/.055);}
 getLabelDTOs():SwingbyObjectiveLabels|null {
  const s=this.snapshot;if(!s||this.disposed)return null;const displayedTolerance=Math.min(s.goal.toleranceDeg*this.angularMagnification,SWINGBY_OBJECTIVE_LIMITS.maximumDisplayedAngleDeg);
  const records=[s.previewStatus==='accepted'?s.predictedExit:null,s.achievedExit].filter((v):v is SwingbyExitView=>!!v);
  return structuredClone({aim:{kind:'fixed-inbound-aim-plane',xKm:this.drag?.xKm??s.aim.xKm,yKm:this.drag?.yKm??s.aim.yKm,ghost:!!this.drag,previewStatus:s.previewStatus},correction:s.correction?{time:s.correction.time,plannedVectorMps:s.correction.vectorMps,actualVectorMps:s.correction.actualVectorMps??null,displayLengthPerMps:this.correctionScale}:null,
   velocity:{space:'heliocentric-velocity',physicalToleranceDeg:s.goal.toleranceDeg,angularMagnification:this.angularMagnification,displayToleranceDeg:displayedTolerance,displayAngleClamped:displayedTolerance<s.goal.toleranceDeg*this.angularMagnification||records.some(r=>magnifiedVelocityDirection(r.heliocentricVelocityKmS,s.goal.targetDirection,this.angularMagnification).clamped),energyRangeKm2S2:s.goal.energyRangeKm2S2,predicted:s.previewStatus==='accepted'?s.predictedExit:null,achieved:s.achievedExit}});
 }
 getResourceCounts(){return {geometries:this.geometry.size,materials:this.materials.size,textures:0,disposed:this.disposed};}
 dispose(){if(this.disposed)return;this.disposed=true;this.drag=null;this.snapshot=null;this.group.removeFromParent();this.velocityGroup.removeFromParent();this.group.clear();this.velocityGroup.clear();this.geometry.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.geometry.clear();this.materials.clear();}
}
