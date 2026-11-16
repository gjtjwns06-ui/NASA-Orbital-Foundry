import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createBus, createPart } from '../render/parts';
import { partTransformFor } from '../hardware';
import { retireContextResources } from '../render/context-resources';
import type { Design, Vec3 } from '../sim/types';
import { AU_KM, SOLAR_BODIES, SOLAR_EPOCH_JD, solarOrbitAu, solarPositionAu, type SolarBodyId, type SolarRoute } from './model';
import { aimAttitude, instrumentMounts, instrumentPose, type InstrumentMount, type InstrumentPose, type SolarEncounterFrame, type SolarFeatureVisual, type SolarViewMode } from './instrument-rig';
import { disposeGraph, glowTexture, planetTexture, ringTexture, seeded } from './scene-art';
export type { InstrumentPose, SolarViewMode } from './instrument-rig';

export type Projected = { x:number; y:number; visible:boolean };
type Callbacks = { onBody:(id:SolarBodyId)=>void; onDrag?:(kind:'departure'|'arrival',deltaX:number,finished:boolean,cancelled?:boolean)=>void };
type BodyVisual = { group:THREE.Group; globe:THREE.Mesh; radius:number; atmosphere?:THREE.Mesh; ring?:THREE.Mesh };
const E=Math.PI/180*23.43928, UP=new THREE.Vector3(0,1,0), RAD=Math.PI/180;
/** Radial compression is only the map projection; local views use physical km. */
export function solarDisplayPosition(p:Vec3):THREE.Vector3 {
  const r=Math.hypot(...p),display=14*Math.log1p(r*1.5);if(!r)return new THREE.Vector3();
  const y=Math.cos(E)*p[1]+Math.sin(E)*p[2],z=-Math.sin(E)*p[1]+Math.cos(E)*p[2];
  return new THREE.Vector3(p[0],z,-y).multiplyScalar(display/r);
}
function heliocentricToView(p:Vec3):THREE.Vector3 {
  return new THREE.Vector3(p[0],-Math.sin(E)*p[1]+Math.cos(E)*p[2],-(Math.cos(E)*p[1]+Math.sin(E)*p[2]));
}

/** One real 3D scene, with map and floating-origin flight cameras.
 * Close views: 1 scene unit = 1 km; spacecraft factory metres scale by .001.
 * Apparent angular size, camera aperture and observation ray therefore agree.
 */
export class SolarScene {
  readonly canvas:HTMLCanvasElement;
  readonly renderer:THREE.WebGLRenderer;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(42,1,.04,1600);
  readonly controls:OrbitControls;
  private readonly instrumentCamera=new THREE.PerspectiveCamera(36,1.6,.00001,1e10);
  private readonly bodies=new Map<SolarBodyId,BodyVisual>();
  private readonly orbits=new THREE.Group();
  private readonly routeRoot=new THREE.Group();
  private readonly craft=new THREE.Group();
  private readonly craftModel=new THREE.Group();
  private readonly sunRoot=new THREE.Group();
  private readonly ghost=new THREE.Group();
  private readonly featureRoot=new THREE.Group();
  private readonly waypointRoot=new THREE.Group();
  private readonly mapSun=new THREE.PointLight('#fff1d8',3.7,0,0);
  private readonly localSun=new THREE.DirectionalLight('#fff1dd',3.5);
  private readonly targetRing:THREE.Mesh;
  private routeLine:Line2|null=null;
  private epoch=SOLAR_EPOCH_JD;
  private target:SolarBodyId='aster';
  private encounter=false;
  private frame:SolarEncounterFrame|null=null;
  private viewMode:SolarViewMode='map';
  private flightPosition:Vec3|null=null;
  private flightVelocity:Vec3|null=null;
  private readonly orbitLines=new Map<SolarBodyId,THREE.Line>();
  private disposed=false;
  private lost=false;
  private readonly observer:ResizeObserver;
  private environment:THREE.WebGLRenderTarget;
  private starMap:THREE.Texture|null=null;
  private readonly fallbackStars=new THREE.Group();
  private animationTime=0;
  private pointer:{id:number;x:number;y:number;moved:boolean;lastTime:number}|null=null;
  private easing:{position:THREE.Vector3;target:THREE.Vector3}|null=null;
  private routePoints:{departure:THREE.Vector3;arrival:THREE.Vector3}|null=null;
  private journeyWaypoint:THREE.Vector3|null=null;
  private readonly texLoader=new THREE.TextureLoader();
  private mounts:InstrumentMount[]=[];
  private mountedInstrument:InstrumentMount|null=null;
  private readonly attitude=new THREE.Quaternion();
  private attitudeInitialized=false;
  private fovDeg=65;
  private angularRateDegS=0;
  private pointingRevision=0;
  private features:SolarFeatureVisual[]=[];
  private hintIds=new Set<string>();
  private captureBusy=false;

  constructor(private readonly host:HTMLElement,private readonly callbacks:Callbacks){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true,logarithmicDepthBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.canvas=this.renderer.domElement;this.canvas.id='solar-universe';this.canvas.setAttribute('aria-label','3D 태양계 탐사 지도');this.canvas.tabIndex=0;
    Object.assign(this.canvas.style,{display:'block',width:'100%',height:'100%',touchAction:'none'});host.appendChild(this.canvas);
    this.scene.background=new THREE.Color('#010205');this.environment=this.makeEnvironment();this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.055;
    this.scene.add(new THREE.AmbientLight('#a8bdd5',.045),this.mapSun,this.localSun,this.localSun.target);this.localSun.visible=false;
    this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.enablePan=false;
    this.controls.minDistance=3;this.controls.maxDistance=200;this.controls.maxPolarAngle=Math.PI*.98;
    this.controls.mouseButtons={LEFT:undefined,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};this.controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};this.controls.addEventListener('start',this.stopCameraAnimation);
    this.scene.add(this.orbits,this.routeRoot,this.craft,this.sunRoot,this.ghost,this.featureRoot,this.waypointRoot,this.fallbackStars);this.craft.add(this.craftModel);this.craft.visible=false;
    this.makeStars();this.makeSun();for(const body of SOLAR_BODIES)this.makeBody(body.id);
    this.targetRing=new THREE.Mesh(new THREE.RingGeometry(1.06,1.085,96),new THREE.MeshBasicMaterial({color:'#82e6cf',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));this.scene.add(this.targetRing);
    this.ghost.add(new THREE.Mesh(new THREE.SphereGeometry(.42,24,16),new THREE.MeshBasicMaterial({color:'#94f6d8',transparent:true,opacity:.22,wireframe:true,depthWrite:false})));
    const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.22),new THREE.MeshBasicMaterial({color:'#dcfff1',toneMapped:false,depthTest:false,depthWrite:false}));marker.name='craft-map-marker';marker.renderOrder=8;this.craft.add(marker);
    this.waypointRoot.add(new THREE.Mesh(new THREE.TorusGeometry(.65,.035,8,64),new THREE.MeshBasicMaterial({color:'#f6ca7d',transparent:true,opacity:.9,depthWrite:false})));this.waypointRoot.visible=false;
    this.setEpoch(this.epoch);this.setTarget(this.target);this.overview();this.camera.position.set(-16,58,74);this.controls.target.set(0,0,0);this.easing=null;this.controls.update();
    this.canvas.addEventListener('pointerdown',this.onPointerDown);this.canvas.addEventListener('pointermove',this.onPointerMove);this.canvas.addEventListener('pointerup',this.onPointerUp);this.canvas.addEventListener('pointercancel',this.onPointerCancel);
    this.canvas.addEventListener('wheel',this.onWheel,{passive:false});this.canvas.addEventListener('contextmenu',this.onContextMenu);this.canvas.addEventListener('webglcontextlost',this.onContextLost);this.canvas.addEventListener('webglcontextrestored',this.onContextRestored);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
  }
  private makeEnvironment(){const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment(),result=pmrem.fromScene(room,.06);room.dispose();pmrem.dispose();return result;}
  private makeStars(){
    const random=seeded(4591),positions:number[]=[],colors:number[]=[];
    for(let i=0;i<1300;i++){const z=random()*2-1,a=random()*Math.PI*2,r=600,s=Math.sqrt(1-z*z);positions.push(r*s*Math.cos(a),r*z,r*s*Math.sin(a));const c=new THREE.Color().setHSL(.55+random()*.2,.1+random()*.15,.32+random()*.4);colors.push(c.r,c.g,c.b);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.fallbackStars.add(new THREE.Points(geometry,new THREE.PointsMaterial({size:.65,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.55,depthWrite:false})));
    this.texLoader.load('/assets/textures/nasa-star-map-2020-4k.webp',texture=>{if(this.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;this.starMap=texture;this.scene.background=texture;this.scene.backgroundIntensity=this.viewMode==='map'?.055:.11;this.scene.backgroundRotation.set(-E,Math.PI,0);this.fallbackStars.visible=false;},undefined,()=>{/* Original sparse star field survives a texture failure. */});
  }
  private makeSun(){
    this.sunRoot.add(new THREE.Mesh(new THREE.SphereGeometry(2.1,48,32),new THREE.MeshBasicMaterial({color:'#fff0cc',toneMapped:false})));
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:'#ffe5b5',blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,toneMapped:false}));halo.scale.set(14,14,1);this.sunRoot.add(halo);
  }
  private makeBody(id:SolarBodyId){
    const body=SOLAR_BODIES.find(v=>v.id===id)!,radii:Record<SolarBodyId,number>={mercury:.48,venus:.75,earth:.8,mars:.61,aster:.3,jupiter:1.65,saturn:1.4,uranus:1.03,neptune:1.02};
    const radius=radii[id],group=new THREE.Group(),texture=planetTexture(id,body.color),material=new THREE.MeshStandardMaterial({map:texture,roughness:id==='earth'?.68:.94,metalness:0});
    // Spherical reference surfaces agree with the instrument ray model.
    const globe=new THREE.Mesh(new THREE.SphereGeometry(radius,96,64),material);group.add(globe);this.scene.add(group);const visual:BodyVisual={group,globe,radius};this.bodies.set(id,visual);
    if(id==='earth'||id==='mars')this.texLoader.load(id==='earth'?'/assets/earth-day.jpg':'/assets/textures/mars-mdim21-4k.webp',loaded=>{if(this.disposed){loaded.dispose();return;}loaded.colorSpace=THREE.SRGBColorSpace;loaded.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());material.map?.dispose();material.map=loaded;material.needsUpdate=true;},undefined,()=>{});
    if(['earth','venus','jupiter','saturn','uranus','neptune'].includes(id)){
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(radius*1.028,64,40),new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(id==='earth'?'#4a9fee':body.color)},sunDirection:{value:new THREE.Vector3(1,0,0)}},vertexShader:'#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 n;varying vec3 v;varying vec3 wn;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);wn=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*p;\n#include <logdepthbuf_vertex>\n}',fragmentShader:'#include <logdepthbuf_pars_fragment>\nuniform vec3 tint;uniform vec3 sunDirection;varying vec3 n;varying vec3 v;varying vec3 wn;void main(){\n#include <logdepthbuf_fragment>\nfloat edge=pow(1.0-abs(dot(normalize(n),normalize(v))),3.8);float day=smoothstep(-.25,.6,dot(normalize(wn),normalize(sunDirection)));gl_FragColor=vec4(tint,edge*(.04+.42*day));}',side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));group.add(atmosphere);visual.atmosphere=atmosphere;
    }
    if(id==='earth'){
      const clouds=new THREE.Mesh(new THREE.SphereGeometry(radius*1.008,64,40),new THREE.MeshStandardMaterial({color:'white',transparent:true,opacity:.48,depthWrite:false}));clouds.visible=false;globe.add(clouds);
      this.texLoader.load('/assets/earth-clouds.png',loaded=>{if(this.disposed){loaded.dispose();return;}loaded.colorSpace=THREE.SRGBColorSpace;clouds.material.map=loaded;clouds.material.needsUpdate=true;clouds.visible=true;},undefined,()=>{clouds.visible=false;});
    }
    if(id==='saturn'){
      const ringGeo=new THREE.RingGeometry(radius*1.45,radius*2.45,192),uv=ringGeo.getAttribute('uv'),p=ringGeo.getAttribute('position');for(let i=0;i<p.count;i++)uv.setXY(i,(Math.hypot(p.getX(i),p.getY(i))-radius*1.45)/radius,.5);
      const ring=new THREE.Mesh(ringGeo,new THREE.MeshStandardMaterial({map:ringTexture(),transparent:true,side:THREE.DoubleSide,roughness:1,opacity:.92,depthWrite:false}));ring.rotation.x=-Math.PI/2+.48;group.add(ring);visual.ring=ring;
    }
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(solarOrbitAu(id,this.epoch).map(solarDisplayPosition)),new THREE.LineBasicMaterial({color:body.color,transparent:true,opacity:.16,depthWrite:false}));line.name=`orbit-${id}`;this.orbits.add(line);this.orbitLines.set(id,line);
  }
  setEpoch(jd:number){if(this.disposed)return;this.epoch=jd;this.updateWorld();}
  setTarget(id:SolarBodyId){this.target=id;for(const [body,line]of this.orbitLines)(line.material as THREE.LineBasicMaterial).opacity=body===id?.55:.15;this.updateTargetRing();}
  private updateTargetRing(){if(!this.targetRing)return;const body=this.bodies.get(this.target)!;this.targetRing.position.copy(body.group.position);this.targetRing.scale.setScalar(body.radius*1.65);this.targetRing.visible=this.viewMode==='map';}
  private setRouteLine(pointsAu:Vec3[]){
    if(this.routeLine){this.routeRoot.remove(this.routeLine);this.routeLine.geometry.dispose();this.routeLine.material.dispose();this.routeLine=null;}if(pointsAu.length<2)return;
    const geometry=new LineGeometry();geometry.setPositions(pointsAu.map(solarDisplayPosition).flatMap(p=>[p.x,p.y,p.z]));const material=new LineMaterial({color:0x88f4d5,linewidth:2.8,transparent:true,opacity:.94,depthWrite:false});material.resolution.set(this.host.clientWidth,this.host.clientHeight);
    this.routeLine=new Line2(geometry,material);this.routeLine.computeLineDistances();this.routeRoot.add(this.routeLine);
  }
  setRoute(route:SolarRoute|null){
    this.setRouteLine([]);this.journeyWaypoint=null;this.waypointRoot.visible=false;if(!route){this.routePoints=null;this.ghost.visible=false;return;}
    try{this.routePoints={departure:solarDisplayPosition(solarPositionAu(route.originId,route.departureJdTdb)),arrival:solarDisplayPosition(solarPositionAu(route.targetId,route.arrivalJdTdb))};this.ghost.position.copy(this.routePoints.arrival);}catch{this.routePoints=null;}
    ((this.ghost.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(route.status==='solved'?'#94f6d8':'#f9ba87');if(route.status==='solved')this.setRouteLine(route.pointsAu);this.restoreVisibility();
  }
  setJourneyPath(pointsAu:Vec3[],_assistBody?:SolarBodyId,assistPositionAu?:Vec3){
    this.setRouteLine(pointsAu);if(pointsAu.length>1){this.routePoints={departure:solarDisplayPosition(pointsAu[0]),arrival:solarDisplayPosition(pointsAu.at(-1)!)};this.ghost.position.copy(this.routePoints.arrival);}
    this.journeyWaypoint=assistPositionAu?solarDisplayPosition(assistPositionAu):null;if(this.journeyWaypoint)this.waypointRoot.position.copy(this.journeyWaypoint);this.restoreVisibility();
  }
  projectJourneyWaypoint():Projected|null{return this.journeyWaypoint&&this.viewMode==='map'?this.project(this.journeyWaypoint):null;}
  setCraftDesign(design:Design){
    const previous=this.mountedInstrument?.partId;disposeGraph(this.craftModel);this.craftModel.clear();this.craftModel.add(createBus(design));
    for(const part of design.parts){const object=createPart(part,design),tr=partTransformFor(design,part);object.position.set(...tr.position);object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...tr.tangentU),new THREE.Vector3(...tr.tangentV),new THREE.Vector3(...tr.normal)));object.userData.partId=part.id;this.craftModel.add(object);}
    const materials=new Map<THREE.Material,THREE.Material>(),textures=new Map<THREE.Texture,THREE.Texture>();
    const clone=(source:THREE.Material)=>{let owned=materials.get(source);if(owned)return owned;owned=source.clone();for(const key of Object.keys(source)){const value=(source as unknown as Record<string,unknown>)[key];if(value instanceof THREE.Texture&&!value.isRenderTargetTexture){let texture=textures.get(value);if(!texture){texture=value.clone();texture.needsUpdate=true;textures.set(value,texture);}(owned as unknown as Record<string,unknown>)[key]=texture;}}materials.set(source,owned);return owned;};
    this.craftModel.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry=object.geometry.clone();object.material=Array.isArray(object.material)?object.material.map(clone):clone(object.material);}});
    this.mounts=instrumentMounts(design);this.mountedInstrument=this.mounts.find(v=>v.partId===previous)??this.mounts[0]??null;this.attitudeInitialized=false;this.updateCraft();
  }
  setInstrument(sensorOrPartId:string){const next=this.mounts.find(v=>v.partId===sensorOrPartId)??this.mounts.find(v=>v.sensor===sensorOrPartId)??null;if(this.mountedInstrument===next)return;this.mountedInstrument=next;this.attitudeInitialized=false;this.fovDeg=65;this.updateCraft();this.updateInstrumentCamera();}
  setFlightPosition(positionAu:Vec3|null,velocityKmS?:Vec3){this.flightPosition=positionAu?[...positionAu]:null;this.flightVelocity=velocityKmS?[...velocityKmS]:null;this.updateWorld();}
  setEncounterFrame(bodyId:SolarBodyId,frame:Omit<SolarEncounterFrame,'sunDirectionBody'|'rangeKm'|'altitudeKm'|'elapsedSeconds'>&Partial<Pick<SolarEncounterFrame,'sunDirectionBody'|'rangeKm'|'altitudeKm'|'elapsedSeconds'>>,features?:readonly SolarFeatureVisual[]):void;
  setEncounterFrame(frame:SolarEncounterFrame,features?:readonly SolarFeatureVisual[]):void;
  setEncounterFrame(bodyOrFrame:SolarBodyId|SolarEncounterFrame,frameOrFeatures?:Partial<SolarEncounterFrame>|readonly SolarFeatureVisual[],suppliedFeatures?:readonly SolarFeatureVisual[]){
    const source=(typeof bodyOrFrame==='string'?frameOrFeatures:bodyOrFrame) as SolarEncounterFrame;
    if(typeof bodyOrFrame==='string'&&(!this.encounter||this.target!==bodyOrFrame))this.setEncounter(bodyOrFrame,true);
    const radius=SOLAR_BODIES.find(v=>v.id===this.target)!.radiusKm;
    const frame:SolarEncounterFrame={...source,rangeKm:source.rangeKm??Math.hypot(...source.positionKm),altitudeKm:source.altitudeKm??Math.hypot(...source.positionKm)-radius,elapsedSeconds:source.elapsedSeconds??0,sunDirectionBody:source.sunDirectionBody??[.35,.25,1]};
    const features=typeof bodyOrFrame==='string'?suppliedFeatures:frameOrFeatures as readonly SolarFeatureVisual[]|undefined;
    if(!frame.positionKm.every(Number.isFinite)||!frame.velocityKmS.every(Number.isFinite))return;
    const firstFrame=!this.frame;
    this.frame={...frame,positionKm:[...frame.positionKm],velocityKmS:[...frame.velocityKmS],sunDirectionBody:[...frame.sunDirectionBody]};
    if(features&&(features.length!==this.features.length||features.some((f,i)=>this.features[i]?.id!==f.id))){this.features=features.map(f=>({...f,positionBodyKm:[...f.positionBodyKm]}));this.rebuildFeatureHints();}this.updateWorld();if(firstFrame&&this.viewMode==='chase')this.alignChaseCamera();
  }
  setFeatureHints(ids:readonly string[]){if(ids.length===this.hintIds.size&&ids.every(id=>this.hintIds.has(id)))return;this.hintIds=new Set(ids);this.rebuildFeatureHints();}
  private rebuildFeatureHints(){
    disposeGraph(this.featureRoot);this.featureRoot.clear();for(const feature of this.features){if(!this.hintIds.has(feature.id))continue;const normal=new THREE.Vector3(...feature.positionBodyKm).normalize(),r=feature.radiusKm;const ring=new THREE.Mesh(new THREE.RingGeometry(r*.94,r,64),new THREE.MeshBasicMaterial({color:'#a9ead2',transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false}));ring.name=feature.id;ring.position.set(...feature.positionBodyKm).addScaledVector(normal,r*.015);ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);this.featureRoot.add(ring);}
  }
  projectFeature(id:string):Projected|null{
    const feature=this.features.find(f=>f.id===id);if(!feature||!this.frame||this.viewMode==='map')return null;const surface=new THREE.Vector3(...feature.positionBodyKm),camera=new THREE.Vector3(...this.frame.positionKm),p=surface.clone().sub(camera),result=this.project(p);return {...result,visible:result.visible&&surface.dot(camera.sub(surface))>0};
  }
  private updateWorld(){
    const local=this.viewMode!=='map';for(const [id,visual]of this.bodies){const definition=SOLAR_BODIES.find(v=>v.id===id)!;
      if(!local){visual.group.position.copy(solarDisplayPosition(solarPositionAu(id,this.epoch)));visual.group.scale.setScalar(1);}
      else if(this.encounter&&this.frame){visual.group.position.set(...this.frame.positionKm).negate();visual.group.scale.setScalar(definition.radiusKm/visual.radius);}
      else if(this.flightPosition){visual.group.position.copy(heliocentricToView(solarPositionAu(id,this.epoch)).sub(heliocentricToView(this.flightPosition)).multiplyScalar(AU_KM));visual.group.scale.setScalar(definition.radiusKm/visual.radius);}
      visual.globe.rotation.y=0;const sun=this.encounter&&this.frame?new THREE.Vector3(...this.frame.sunDirectionBody):visual.group.position.clone().negate().normalize();if(visual.atmosphere)(visual.atmosphere.material as THREE.ShaderMaterial).uniforms.sunDirection.value.copy(sun);
    }
    if(local){const direction=this.encounter&&this.frame?new THREE.Vector3(...this.frame.sunDirectionBody).normalize():this.flightPosition?heliocentricToView(this.flightPosition).negate().normalize():new THREE.Vector3(.35,.25,1).normalize();this.localSun.position.copy(direction).multiplyScalar(10);this.localSun.target.position.set(0,0,0);if(!this.encounter&&this.flightPosition){this.sunRoot.position.copy(heliocentricToView(this.flightPosition)).multiplyScalar(-AU_KM);this.sunRoot.scale.setScalar(696340/2.1);}if(this.frame&&this.encounter)this.featureRoot.position.set(...this.frame.positionKm).negate();}
    else{this.sunRoot.position.set(0,0,0);this.sunRoot.scale.setScalar(1);}
    this.updateCraft();this.updateTargetRing();this.restoreVisibility();this.updateInstrumentCamera();
  }
  private updateCraft(){
    const marker=this.craft.getObjectByName('craft-map-marker'),local=this.viewMode!=='map';this.craft.visible=local||!!this.flightPosition;
    if(local){this.craft.position.set(0,0,0);this.craftModel.scale.setScalar(.001);if(marker)marker.visible=false;}else{if(this.flightPosition)this.craft.position.copy(solarDisplayPosition(this.flightPosition));this.craftModel.scale.setScalar(.085);if(marker)marker.visible=true;}
    if(!this.attitudeInitialized&&this.mountedInstrument){const direction=this.encounter&&this.frame?new THREE.Vector3(...this.frame.positionKm).negate():this.flightVelocity?heliocentricToView(this.flightVelocity):new THREE.Vector3(0,0,-1);this.attitude.copy(aimAttitude(this.mountedInstrument,direction));this.attitudeInitialized=this.encounter?!!this.frame:true;}
    this.craftModel.quaternion.copy(this.attitude);
  }
  setViewMode(mode:SolarViewMode){
    const changed=mode!==this.viewMode;this.viewMode=mode;this.easing=null;this.onPointerCancel();this.controls.enabled=mode!=='instrument';this.canvas.style.cursor=mode==='instrument'?'crosshair':'';
    this.mapSun.visible=mode==='map';this.localSun.visible=mode!=='map';this.scene.environmentIntensity=mode==='map'?.055:.09;this.scene.backgroundIntensity=mode==='map'?.055:.11;
    this.camera.near=mode==='map'?.04:.00001;this.camera.far=mode==='map'?1600:1e10;this.camera.fov=mode==='instrument'?this.fovDeg:mode==='chase'?44:42;this.camera.updateProjectionMatrix();
    this.controls.minDistance=mode==='map'?3:.0015;this.controls.maxDistance=mode==='map'?200:.09;this.updateWorld();
    if(changed&&mode==='chase')this.alignChaseCamera();
    else if(mode==='instrument')this.updateInstrumentCamera();else if(changed){this.camera.up.copy(UP);this.camera.position.set(-16,58,74);this.controls.target.set(0,0,0);this.controls.update();}
  }
  getViewMode():SolarViewMode{return this.viewMode;}
  private alignChaseCamera(){const aim=this.mountedInstrument?this.mountedInstrument.normal.clone().applyQuaternion(this.attitude):new THREE.Vector3(0,0,-1),up=this.mountedInstrument?this.mountedInstrument.up.clone().applyQuaternion(this.attitude):UP.clone(),right=aim.clone().cross(up).normalize();this.camera.position.copy(aim).multiplyScalar(-.0065).addScaledVector(up,.0026).addScaledVector(right,.0032);this.controls.target.copy(aim).multiplyScalar(.0028);this.camera.up.copy(up);this.controls.update();}
  setInstrumentFov(degrees:number){if(!Number.isFinite(degrees))return;this.fovDeg=THREE.MathUtils.clamp(degrees,6,65);this.updateInstrumentCamera();}
  getInstrumentPose():InstrumentPose|null{if(!this.encounter||!this.frame||!this.mountedInstrument)return null;return instrumentPose(this.mountedInstrument,this.attitude,this.frame.positionKm,this.fovDeg,this.angularRateDegS);}
  isInstrumentDragging():boolean{return this.viewMode==='instrument'&&this.pointer!==null;}
  getPointingRevision():number{return this.pointingRevision;}
  /** Stabilized target tracking. The controller supplies a real body-frame
   * anchor; no screen position or feature completion is inferred here.
   * Shortest-arc corrections preserve roll instead of rebuilding a look-at
   * attitude. Iteration accounts for the aperture moving as the craft rotates.
   */
  trackInstrumentTarget(pointBodyKm:Vec3):void{
    if(!this.encounter||!this.frame||!this.mountedInstrument||this.isInstrumentDragging()||!pointBodyKm.every(Number.isFinite))return;
    const target=new THREE.Vector3(...pointBodyKm),centre=new THREE.Vector3(...this.frame.positionKm);
    for(let i=0;i<5;i++){
      const aperture=this.mountedInstrument.apertureM.clone().multiplyScalar(.001).applyQuaternion(this.attitude).add(centre),desired=target.clone().sub(aperture);
      if(desired.lengthSq()<1e-20)return;
      desired.normalize();const current=this.mountedInstrument.normal.clone().applyQuaternion(this.attitude).normalize();
      if(current.distanceToSquared(desired)<1e-24)break;
      this.attitude.premultiply(new THREE.Quaternion().setFromUnitVectors(current,desired)).normalize();
    }
    this.attitudeInitialized=true;this.craftModel.quaternion.copy(this.attitude);this.updateInstrumentCamera();
  }
  /** Keyboard/controller accessibility uses the same pointing motion as dragging. */
  aimInstrument(deltaX:number,deltaY:number){
    if(!this.mountedInstrument||!Number.isFinite(deltaX+deltaY))return;const sensitivity=this.fovDeg/Math.max(300,this.host.clientHeight)*RAD,up=this.mountedInstrument.up.clone().applyQuaternion(this.attitude).normalize(),direction=this.mountedInstrument.normal.clone().applyQuaternion(this.attitude).normalize(),right=direction.clone().cross(up).normalize();
    const rotation=new THREE.Quaternion().setFromAxisAngle(up,-deltaX*sensitivity).multiply(new THREE.Quaternion().setFromAxisAngle(right,-deltaY*sensitivity));this.attitude.premultiply(rotation).normalize();this.pointingRevision++;this.attitudeInitialized=true;this.craftModel.quaternion.copy(this.attitude);this.updateInstrumentCamera();
  }
  private updateInstrumentCamera(){
    if(!this.mountedInstrument)return;const position=this.mountedInstrument.apertureM.clone().multiplyScalar(.001).applyQuaternion(this.attitude),direction=this.mountedInstrument.normal.clone().applyQuaternion(this.attitude).normalize(),up=this.mountedInstrument.up.clone().applyQuaternion(this.attitude).normalize();
    this.instrumentCamera.position.copy(position);this.instrumentCamera.up.copy(up);this.instrumentCamera.lookAt(position.clone().add(direction));this.instrumentCamera.fov=this.fovDeg;this.instrumentCamera.updateProjectionMatrix();this.instrumentCamera.updateMatrixWorld();
    if(this.viewMode==='instrument'){this.camera.position.copy(this.instrumentCamera.position);this.camera.quaternion.copy(this.instrumentCamera.quaternion);this.camera.up.copy(up);this.camera.fov=this.fovDeg;this.camera.updateProjectionMatrix();}
  }
  async captureInstrument():Promise<{imageDataUrl:string;pose:InstrumentPose}>{
    const pose=this.getInstrumentPose();if(!pose||this.disposed||this.lost||this.captureBusy)throw new Error('Instrument image is not available.');this.captureBusy=true;
    // Match the live framing. Bounded encoding below guarantees every photo
    // fits the existing journey record instead of silently dropping big JPEGs.
    const width=960,height=Math.round(width/Math.max(.6,Math.min(3,this.host.clientWidth/Math.max(1,this.host.clientHeight)))),target=new THREE.WebGLRenderTarget(width,height,{type:THREE.UnsignedByteType,format:THREE.RGBAFormat,depthBuffer:true,samples:2});target.texture.colorSpace=THREE.SRGBColorSpace;
    const previousTarget=this.renderer.getRenderTarget(),previousHints=this.featureRoot.visible,previousAspect=this.instrumentCamera.aspect;
    try{this.updateInstrumentCamera();this.instrumentCamera.aspect=width/height;this.instrumentCamera.updateProjectionMatrix();this.featureRoot.visible=false;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.instrumentCamera);this.renderer.setRenderTarget(previousTarget);this.featureRoot.visible=previousHints;
      const pixels=new Uint8Array(width*height*4);
      try{await this.renderer.readRenderTargetPixelsAsync(target,0,0,width,height,pixels);}catch(error){if(this.disposed||this.lost)throw error;this.renderer.readRenderTargetPixels(target,0,0,width,height,pixels);}
      if(this.disposed||this.lost)throw new Error('Instrument image was interrupted.');
      const output=document.createElement('canvas');output.width=width;output.height=height;const context=output.getContext('2d');if(!context)throw new Error('Image encoder unavailable.');
      const data=context.createImageData(width,height);for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);context.putImageData(data,0,0);
      let imageDataUrl=output.toDataURL('image/jpeg',.84);
      for(const quality of [.72,.58,.42]){if(imageDataUrl.length<=200000)break;imageDataUrl=output.toDataURL('image/jpeg',quality);}
      if(imageDataUrl.length>200000){const small=document.createElement('canvas');small.width=480;small.height=Math.round(height/2);const ctx=small.getContext('2d');if(!ctx)throw new Error('Image encoder unavailable.');ctx.drawImage(output,0,0,small.width,small.height);imageDataUrl=small.toDataURL('image/jpeg',.58);}
      if(!imageDataUrl.startsWith('data:image/jpeg;base64,')||imageDataUrl.length>200000)throw new Error('Image encoding failed.');
      return {imageDataUrl,pose};
    }finally{if(!this.disposed){this.renderer.setRenderTarget(previousTarget);this.featureRoot.visible=previousHints;this.instrumentCamera.aspect=previousAspect;this.instrumentCamera.updateProjectionMatrix();}target.dispose();this.captureBusy=false;}
  }
  focusBody(id:SolarBodyId){if(this.viewMode!=='map')this.setViewMode('map');const body=this.bodies.get(id)!,target=body.group.position.clone(),d=body.radius*4;this.controls.minDistance=body.radius*2.4;this.easing={target,position:target.clone().add(new THREE.Vector3(d*.65,d*.55,d))};}
  overview(){this.encounter=false;this.frame=null;this.attitudeInitialized=false;this.setViewMode('map');this.easing={position:new THREE.Vector3(-16,58,74),target:new THREE.Vector3()};this.controls.minDistance=3;this.updateWorld();}
  setEncounter(id:SolarBodyId,active:boolean){const changed=!this.encounter||id!==this.target;this.encounter=active;this.setTarget(id);if(active){if(changed){this.frame=null;this.attitudeInitialized=false;this.features=[];this.hintIds.clear();this.rebuildFeatureHints();}this.setViewMode('chase');}else this.overview();}
  private restoreVisibility(){const map=this.viewMode==='map';for(const [id,body]of this.bodies)body.group.visible=map||!this.encounter||id===this.target;this.orbits.visible=map;this.routeRoot.visible=map;this.sunRoot.visible=map||!this.encounter;this.ghost.visible=map&&!!this.routePoints;this.waypointRoot.visible=map&&!!this.journeyWaypoint;this.featureRoot.visible=!map&&this.encounter;}
  private project(p:THREE.Vector3):Projected{this.camera.updateMatrixWorld();const clip=p.clone().project(this.camera),width=this.host.clientWidth,height=this.host.clientHeight;return {x:(clip.x+1)*width/2,y:(1-clip.y)*height/2,visible:clip.z>-1&&clip.z<1&&Math.abs(clip.x)<1.1&&Math.abs(clip.y)<1.1};}
  projectBody(id:SolarBodyId):Projected{const body=this.bodies.get(id)!,result=this.project(body.group.position);return {...result,visible:result.visible&&body.group.visible};}
  projectRouteHandle(kind:'departure'|'arrival'):Projected{if(!this.routePoints||this.encounter||this.viewMode!=='map')return {x:0,y:0,visible:false};return this.project(this.routePoints[kind]);}
  resize(){if(this.disposed)return;const width=Math.max(1,this.host.clientWidth),height=Math.max(1,this.host.clientHeight);this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();if(this.routeLine)this.routeLine.material.resolution.set(width,height);}
  render(dt:number){
    if(this.disposed||this.lost)return;const elapsed=Math.min(Math.max(dt,0),.1);this.animationTime+=elapsed;if(!this.pointer)this.angularRateDegS*=Math.exp(-elapsed*9);
    if(this.easing){const factor=1-Math.exp(-elapsed*5);this.camera.position.lerp(this.easing.position,factor);this.controls.target.lerp(this.easing.target,factor);if(this.camera.position.distanceTo(this.easing.position)<.015&&this.controls.target.distanceTo(this.easing.target)<.015)this.easing=null;}
    if(this.viewMode==='instrument')this.updateInstrumentCamera();else this.controls.update();this.targetRing.quaternion.copy(this.camera.quaternion);(this.targetRing.material as THREE.MeshBasicMaterial).opacity=.58+Math.sin(this.animationTime*2.5)*.12;this.waypointRoot.quaternion.copy(this.camera.quaternion);this.fallbackStars.position.copy(this.camera.position);this.renderer.render(this.scene,this.camera);
  }
  private stopCameraAnimation=()=>{this.easing=null;};
  private onContextMenu=(event:Event)=>event.preventDefault();
  private onPointerDown=(event:PointerEvent)=>{if(event.button!==0)return;this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,lastTime:event.timeStamp};if(this.viewMode==='instrument'){event.preventDefault();this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(event.pointerId);}};
  private onPointerMove=(event:PointerEvent)=>{const down=this.pointer;if(!down||down.id!==event.pointerId)return;const dx=event.clientX-down.x,dy=event.clientY-down.y;if(Math.hypot(dx,dy)>3)down.moved=true;if(this.viewMode!=='instrument')return;const seconds=Math.max(.008,(event.timeStamp-down.lastTime)/1000);this.angularRateDegS=Math.min(180,Math.hypot(dx,dy)*this.fovDeg/Math.max(300,this.host.clientHeight)/seconds);this.aimInstrument(dx,dy);down.x=event.clientX;down.y=event.clientY;down.lastTime=event.timeStamp;};
  private onPointerCancel=()=>{const id=this.pointer?.id;this.pointer=null;if(id!==undefined&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);};
  private onPointerUp=(event:PointerEvent)=>{
    const down=this.pointer;this.onPointerCancel();if(!down||down.id!==event.pointerId||down.moved||this.viewMode!=='map'||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;const rect=this.canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;let nearest:{id:SolarBodyId;distance:number}|null=null;
    for(const [id,body]of this.bodies){if(!body.group.visible)continue;const p=this.projectBody(id),distance=Math.hypot(p.x-x,p.y-y),edge=this.project(body.group.position.clone().add(new THREE.Vector3(body.radius,0,0))),radius=Math.max(20,Math.abs(edge.x-p.x)+8);if(p.visible&&distance<radius&&(!nearest||distance<nearest.distance))nearest={id,distance};}if(nearest)this.callbacks.onBody(nearest.id);
  };
  private onWheel=(event:WheelEvent)=>{if(this.viewMode!=='instrument')return;event.preventDefault();this.fovDeg=THREE.MathUtils.clamp(this.fovDeg*Math.exp(event.deltaY*.001),6,65);this.updateInstrumentCamera();};
  private onContextLost=(event:Event)=>{event.preventDefault();this.lost=true;this.onPointerCancel();retireContextResources([this.scene]);this.environment.dispose();};
  private onContextRestored=()=>{if(this.disposed)return;this.environment=this.makeEnvironment();this.scene.environment=this.environment.texture;if(this.starMap)this.starMap.needsUpdate=true;this.lost=false;this.resize();};
  dispose(){
    if(this.disposed)return;this.disposed=true;this.onPointerCancel();this.observer.disconnect();this.controls.removeEventListener('start',this.stopCameraAnimation);this.controls.dispose();this.canvas.removeEventListener('pointerdown',this.onPointerDown);this.canvas.removeEventListener('pointermove',this.onPointerMove);this.canvas.removeEventListener('pointerup',this.onPointerUp);this.canvas.removeEventListener('pointercancel',this.onPointerCancel);this.canvas.removeEventListener('wheel',this.onWheel);this.canvas.removeEventListener('contextmenu',this.onContextMenu);this.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.canvas.removeEventListener('webglcontextrestored',this.onContextRestored);disposeGraph(this.scene);this.starMap?.dispose();this.environment.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove();
  }
}
