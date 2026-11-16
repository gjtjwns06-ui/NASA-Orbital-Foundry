import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { createBus, createPart } from "./parts";
import { CommandSignals, type CommandSignalDTO, type CommandSignalSample } from "./command-signals";
import { partTransformFor } from "../hardware";
import type { Design, Quaternion, Vec3 } from "../sim/types";
import { getLanguage } from "../i18n";
import {
  AU_KM,
  EPHEMERIS_START_JD_TDB,
  EPHEMERIS_END_JD_TDB,
  TRANSFER_EARTH_RADIUS_KM,
  TRANSFER_MARS_RADIUS_KM,
  transferPlanetState,
  transferStateAt,
  transferTrajectory,
  jdToTdbCalendar,
} from "../transfer";
import type { FullTransferSolution, TransferStateVector } from "../transfer";
import { asymptoteFlyby } from "../transfer/math";
import {CraftInspectionCamera, type InspectionViewport, type CameraObstacle} from './craft-camera';
import {LazySurfaceTexture,shouldLoadMarsSurfaceDetail} from './lazy-surface-texture';
import {retireContextResources} from './context-resources';
import {planetInspectionDirection} from './planet-inspection-direction';

type DateKind = "departure" | "arrival";
type View = "solar" | "earth" | "mars";
export type TransferQuality = 'high'|'medium'|'low';
type EncounterAxis = "altitude" | "angle";
type Callback = {
  dateChange(kind: DateKind, jdTdb: number, commit: boolean): void;
  contextLost?: () => void;
  encounterChange?: (altitudeKm: number, angleRad: number, commit: boolean) => void;
  encounterCancel?: () => void;
  /** Read-only exterior hardware selection; no design or flight mutation. */
  inspectionPartSelected?: (partId:string|null) => void;
};
type Label = {
  element: HTMLDivElement;
  object: THREE.Object3D;
  offset: number;
};
type Drag = {
  kind: DateKind;
  pointerId: number;
  initialJd: number;
  jd: number;
};
type EncounterDrag = {axis:EncounterAxis;pointerId:number;initialAltitude:number;initialAngle:number;altitude:number;angle:number};
const FRAME = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
);
const SOLAR_SCALE = 10 / AU_KM;
const vector = (p: Vec3, scale = 1) =>
  new THREE.Vector3(p[0] * scale, p[2] * scale, -p[1] * scale);
const tr = (ko: string, en: string) => (getLanguage() === "ko" ? ko : en);

/** Lightweight local guide with the accepted incoming asymptote held fixed.
 * This does not solve or replace the heliocentric transfer. Only a committed
 * input requests the full boundary solver through the parent callback. */
export function transferEncounterGuide(solution:Pick<FullTransferSolution,'arrivalVInfinityKmS'>,altitudeKm:number,angleRad:number) {
  const local=asymptoteFlyby(solution.arrivalVInfinityKmS,TRANSFER_MARS_RADIUS_KM+altitudeKm,angleRad);
  const s=new THREE.Vector3(...solution.arrivalVInfinityKmS).normalize();
  const p=new THREE.Vector3(...local.periapsis.positionKm).normalize();
  const b=p.multiplyScalar(local.eccentricity).sub(s).normalize().multiplyScalar(local.impactParameterKm);
  return {periapsis:vector(local.periapsis.positionKm,3/TRANSFER_MARS_RADIUS_KM),bPlane:vector(b.toArray() as Vec3,3/TRANSFER_MARS_RADIUS_KM)};
}

/** Live RF endpoints share the current display epoch's origin. A local phase
 * preview uses another epoch, so it must never display the live flight signals. */
export function transferSignalDisplayFrame(view:View,state:Pick<TransferStateVector,'phase'|'centerPositionKm'>,previewingPhase:boolean) {
  const visible=!previewingPhase&&(view==='solar'||(view==='earth'&&state.phase==='earth-escape')||(view==='mars'&&state.phase==='mars-flyby'));
  const centerPositionKm:Vec3=view==='solar'?[0,0,0]:[...state.centerPositionKm];
  const scale=view==='solar'?SOLAR_SCALE:3/(view==='earth'?TRANSFER_EARTH_RADIUS_KM:TRANSFER_MARS_RADIUS_KM);
  return {visible,centerPositionKm,scale};
}

/** Dedicated M03 renderer. All ephemeris/trajectory positions use ICRF [x,z,-y]. */
export class TransferScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(43, 1, 0.025, 5000);
  readonly canvas: HTMLCanvasElement;
  readonly controls: OrbitControls;
  currentView: View = "solar";
  quality: TransferQuality = 'high';
  previewingPhase = false;
  private solution: FullTransferSolution | null = null;
  private elapsed = 0;
  private attitude: Quaternion | null = null;
  private disposed = false;
  private lost = false;
  private autoFrame = true;
  private resetFrame = true;
  private dateEditing = true;
  private planningPending = false;
  private drag: Drag | null = null;
  private encounterDrag: EncounterDrag | null = null;
  private encounterGroup = new THREE.Group();
  private encounterGuides = new THREE.Group();
  private encounterHandles: Record<EncounterAxis,THREE.Group>;
  private pathGroup = new THREE.Group();
  private previousPathGroup = new THREE.Group();
  private previousSolution: FullTransferSolution | null = null;
  private comparisonCandidateReady = true;
  private orbitGroup = new THREE.Group();
  private craft = new THREE.Group();
  private planetGroup = new THREE.Group();
  private sun: THREE.Mesh;
  private earth: THREE.Mesh;
  private clouds: THREE.Mesh;
  private earthGlow: THREE.Mesh;
  private mars: THREE.Mesh;
  private handles: Record<DateKind, THREE.Group>;
  private ghost: THREE.Group;
  private key = new THREE.DirectionalLight(0xffedd3, 2.8);
  private solarLight = new THREE.PointLight(0xffedd3, 3, 0, 0);
  private labels: Label[] = [];
  private labelLayer: HTMLDivElement;
  private legend: HTMLDivElement;
  private dragLabel: HTMLDivElement;
  private textures = new Set<THREE.Texture>();
  private marsBaseTexture:THREE.Texture|null=null;
  private marsSurfaceDetail:LazySurfaceTexture;
  private environment: THREE.WebGLRenderTarget;
  private environmentDisposed = false;
  private observer: ResizeObserver;
  private commandSignals: CommandSignals|null = null;
  private commandSignalSamples: CommandSignalSample[] = [];
  private commandSignalRecordCount = 0;
  private reducedMotion = false;
  private inspection:CraftInspectionCamera;
  private inspectionRestore:{view:View;autoFrame:boolean;resetFrame:boolean;pathVisible:boolean;orbitVisible:boolean}|null=null;
  private inspectionInsets:InspectionViewport={left:0,right:0,top:0,bottom:0};
  private craftBounds=new THREE.Box3(new THREE.Vector3(-.65,-.8,-.65),new THREE.Vector3(.65,.8,.65));
  private partBounds=new Map<string,THREE.Box3>();
  private inspectionSolidBounds:THREE.Box3[]=[];
  private inspectedPartId:string|null=null;
  private inspectionFocusPartId:string|null=null;
  private inspectionPointer:{id:number;x:number;y:number}|null=null;
  private inspectionOutline=new THREE.Box3Helper(new THREE.Box3(),0x8ce1d4);
  private inspectionPhase:TransferStateVector['phase']|null=null;

  constructor(
    private container: HTMLElement,
    private callbacks: Callback,
    options: {quality?:TransferQuality;reducedMotion?:boolean} = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.canvas = this.renderer.domElement;
    this.canvas.id = "transfer-universe";
    this.canvas.setAttribute(
      "aria-label",
      tr(
        "3D 지구–화성 전이. 출발·도착 손잡이를 왼쪽 드래그, 시점을 오른쪽 드래그, 휠로 확대합니다.",
        "3D Earth–Mars transfer. Drag departure and arrival handles with the left button, orbit with the right button, scroll to zoom.",
      ),
    );
    Object.assign(this.canvas.style, {
      display: "block",
      width: "100%",
      height: "100%",
      touchAction: "none",
    });
    container.appendChild(this.canvas);
    this.scene.background = new THREE.Color(0x030b13);
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      environmentScene = new RoomEnvironment();
    this.environment = pmrem.fromScene(environmentScene, 0.08);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.38;
    environmentScene.dispose();
    pmrem.dispose();
    this.scene.add(
      new THREE.AmbientLight(0xa7c7e8, 0.4),
      this.key,
      this.key.target,
      this.solarLight,
    );
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.mouseButtons = {
      LEFT: undefined as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.minDistance = 4;
    this.controls.maxDistance = 90;
    this.controls.maxPolarAngle = Math.PI * 0.92;
    this.controls.addEventListener("start", this.stopAutoFrame);
    this.inspection=new CraftInspectionCamera(this.camera,this.controls);
    this.inspectionOutline.visible=false;
    this.inspectionOutline.renderOrder=10;
    (this.inspectionOutline.material as THREE.LineBasicMaterial).depthTest=false;
    this.scene.add(this.inspectionOutline);
    this.scene.add(
      this.pathGroup,
      this.previousPathGroup,
      this.orbitGroup,
      this.craft,
      this.planetGroup,
    );
    this.previousPathGroup.name = 'PreviousTransferPlan';
    this.previousPathGroup.visible = false;
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd79a, toneMapped: false }),
    );
    this.scene.add(this.sun);
    this.addSunGlow();
    this.earth = this.makePlanet("/assets/earth-day.jpg", 0x6c9ebc);
    this.mars = this.makePlanet("/assets/mars.jpg", 0xb87650);
    this.marsSurfaceDetail=new LazySurfaceTexture({
      load:()=>new THREE.TextureLoader().loadAsync('/assets/textures/mars-mdim21-4k.webp'),
      validate:texture=>{const image=texture.image as {width:number;height:number};if(image.width!==4096||image.height!==2048)throw new Error('Mars surface detail dimensions do not match the verified 4096×2048 asset');},
      configure:texture=>{
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.flipY=this.marsBaseTexture?.flipY??true;
        texture.wrapS=this.marsBaseTexture?.wrapS??THREE.ClampToEdgeWrapping;
        texture.wrapT=this.marsBaseTexture?.wrapT??THREE.ClampToEdgeWrapping;
        texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
        texture.name='NASA Viking MDIM2.1 colour · Mars close-view detail';
      },
      changed:()=>{if(!this.disposed)this.applyMarsSurfaceTexture();},
    });
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 64, 40),
      new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        roughness: 1,
      }),
    );
    this.loadTexture("/assets/earth-clouds.png", (texture) => {
      (this.clouds.material as THREE.MeshStandardMaterial).map = texture;
      (this.clouds.material as THREE.Material).needsUpdate = true;
    });
    this.earth.add(this.clouds);
    this.earthGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.035, 64, 40),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { color: { value: new THREE.Color(0x438fdf) } },
        vertexShader:
          "varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}",
        fragmentShader:
          "varying vec3 n; varying vec3 v; uniform vec3 color; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.2);gl_FragColor=vec4(color,.38*rim);}",
      }),
    );
    this.earth.add(this.earthGlow);
    this.handles = {
      departure: this.makeHandle(0x77e1d1),
      arrival: this.makeHandle(0xf3b56b),
    };
    this.ghost = this.makeHandle(0xffffff);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.scene.add(this.handles.departure, this.handles.arrival);
    this.encounterHandles={altitude:this.makeHandle(0xffc389),angle:this.makeHandle(0x83d8ee)};
    this.encounterHandles.altitude.scale.setScalar(.35);this.encounterHandles.angle.scale.setScalar(.35);
    this.encounterGroup.add(this.encounterGuides,this.encounterHandles.altitude,this.encounterHandles.angle);
    this.encounterGroup.visible=false;this.scene.add(this.encounterGroup);
    this.labelLayer = document.createElement("div");
    Object.assign(this.labelLayer.style, {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      pointerEvents: "none",
    });
    container.appendChild(this.labelLayer);
    this.addLabel(this.sun, "SUN", 0.95);
    this.addLabel(this.earth, "EARTH", 0.72);
    this.addLabel(this.mars, "MARS", 0.58);
    this.addLabel(
      this.handles.departure,
      tr("지구 출발 · 드래그", "EARTH DEPARTURE · DRAG"),
      0.95,
    );
    this.addLabel(
      this.handles.arrival,
      tr("화성 도착 · 드래그", "MARS ARRIVAL · DRAG"),
      0.85,
    );
    this.addLabel(this.encounterHandles.altitude,tr("최근접 고도 · 드래그","PERIAPSIS ALTITUDE · DRAG"),.45);
    this.addLabel(this.encounterHandles.angle,tr("B-plane 방향 · 드래그","B-PLANE ANGLE · DRAG"),-.38);
    this.legend = this.makeOverlay("");
    this.legend.className = "transfer-scene-legend";
    Object.assign(this.legend.style, {
      bottom: "14px",
      left: "14px",
      maxWidth: "min(540px,65%)",
      fontSize: "11px",
      lineHeight: "1.55",
    });
    if (container.classList.contains("transfer-viewport"))
      Object.assign(this.legend.style, {
        bottom: "154px",
        left: "50%",
        maxWidth: "calc(100% - 580px)",
        transform: "translateX(-50%)",
        textAlign: "center",
      });
    this.dragLabel = this.makeOverlay("");
    Object.assign(this.dragLabel.style, {
      display: "none",
      top: "15px",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: "12px",
      whiteSpace: "nowrap",
    });
    this.addStars();
    this.canvas.addEventListener("pointerdown", this.pointerDown);
    this.canvas.addEventListener("pointermove", this.pointerMove);
    this.canvas.addEventListener("pointerup", this.pointerUp);
    this.canvas.addEventListener("pointercancel", this.pointerCancel);
    this.canvas.addEventListener('dblclick',this.inspectionDoubleClick);
    window.addEventListener("keydown",this.keyDown);
    this.canvas.addEventListener("webglcontextlost", this.contextLost);
    this.canvas.addEventListener("webglcontextrestored", this.contextRestored);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.setView("solar");
    this.setQuality(options.quality??'high');
    this.setReducedMotion(options.reducedMotion??false);
  }

  private makeOverlay(text: string) {
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "absolute",
      padding: "8px 11px",
      background: "rgba(7,23,32,.86)",
      color: "#c3d8df",
      border: "1px solid #29414a",
      borderRadius: "7px",
      fontFamily: "Barlow, sans-serif",
      pointerEvents: "none",
    });
    this.labelLayer.appendChild(el);
    return el;
  }
  private addLabel(object: THREE.Object3D, text: string, offset: number) {
    const element = this.makeOverlay(text);
    Object.assign(element.style, {
      padding: "3px 6px",
      fontSize: "10px",
      letterSpacing: ".12em",
      whiteSpace: "nowrap",
      transform: "translate(-50%,-50%)",
    });
    this.labels.push({ element, object, offset });
  }
  private loadTexture(url: string, apply: (texture: THREE.Texture) => void) {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(
          this.quality==='high'?8:this.quality==='medium'?4:2,
          this.renderer.capabilities.getMaxAnisotropy(),
        );
        this.textures.add(texture);
        apply(texture);
      },
      undefined,
      () => {
        if (!this.disposed) this.canvas.dataset.textureFallback = "true";
      },
    );
  }
  private makePlanet(url: string, color: number) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.93,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
    this.loadTexture(url, (texture) => {
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
      if(url==='/assets/mars.jpg'){
        this.marsBaseTexture=texture;
        if(this.marsSurfaceDetail)this.applyMarsSurfaceTexture();
      }
    });
    this.planetGroup.add(mesh);
    return mesh;
  }
  private makeHandle(color: number) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.035, 8, 64),
      new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        toneMapped: false,
      }),
    );
    ring.renderOrder = 5;
    g.add(ring);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.1),
      new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        toneMapped: false,
      }),
    );
    diamond.position.y = 0.75;
    diamond.renderOrder = 5;
    g.add(diamond);
    return g;
  }
  private addSunGlow() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,210,110,.75)");
    gradient.addColorStop(0.3, "rgba(255,164,63,.18)");
    gradient.addColorStop(1, "rgba(255,164,63,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(c);
    this.textures.add(texture);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffcc80,
      }),
    );
    sprite.scale.set(5.5, 5.5, 1);
    this.sun.add(sprite);
  }
  private addStars() {
    let seed = 417;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const positions = [];
    for (let i = 0; i < 1300; i++) {
      const z = random() * 2 - 1,
        a = random() * Math.PI * 2,
        r = 850,
        s = Math.sqrt(1 - z * z);
      positions.push(Math.cos(a) * s * r, z * r, Math.sin(a) * s * r);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xaec5df,
        size: 0.75,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    );
    stars.name = "TransferStars";
    this.scene.add(stars);
  }
  private stopAutoFrame = () => {
    this.autoFrame = false;
  };

  setSolution(solution: FullTransferSolution) {
    if (this.disposed) return;
    if(this.drag||this.encounterDrag)this.endDrag();
    if(this.solution!==solution)this.clearCommandSignals();
    this.solution = solution;
    this.planningPending=false;
    this.attitude = null;
    this.elapsed = Math.min(this.elapsed, solution.durationSeconds);
    this.rebuildPaths();
    this.rebuildEncounterGuides();
    this.positionScene();
  }
  clearSolution() {
    if (this.disposed) return;
    this.setCraftInspection(false);
    this.endDrag();
    this.solution = null;
    this.planningPending=false;
    this.attitude = null;
    this.previewingPhase = false;
    this.clearCommandSignals();
    this.clearGroup(this.pathGroup);
    this.clearGroup(this.orbitGroup);
    this.craft.visible = false;
    this.earth.visible = false;
    this.mars.visible = false;
    this.handles.departure.visible = false;
    this.handles.arrival.visible = false;
    this.encounterGroup.visible=false;
    this.clearGroup(this.encounterGuides);
    this.updateLegend();
  }
  /** Planning comparison only: both routes use the heliocentric ICRF frame.
   * Never install a previous route as the current physical solution. */
  setPreviousPlan(solution: FullTransferSolution | null, candidateReady = true) {
    if (this.disposed) return;
    this.comparisonCandidateReady = candidateReady;
    if (this.previousSolution !== solution) {
      this.clearGroup(this.previousPathGroup);
      this.previousSolution = solution;
      if (solution) {
        for (const phase of ['earth-escape', 'solar-coast', 'mars-flyby'] as const) {
          const points = transferTrajectory(solution, phase, phase === 'solar-coast' ? 360 : 100)
            .map(point => vector(point.heliocentricPositionKm, SOLAR_SCALE));
          const line = this.line(points, 0xe0b579, .8, true);
          line.name = `PreviousTransfer-${phase}`;
          line.material.depthWrite = false;
          line.raycast = () => {};
          this.previousPathGroup.add(line);
        }
      }
    }
    this.syncPreviousPlanVisibility();
    this.updateLegend();
  }
  private syncPreviousPlanVisibility() {
    this.previousPathGroup.visible = !!this.previousSolution && this.dateEditing && this.currentView === 'solar' && !this.inspection.enabled;
    if (!this.inspection.enabled) this.pathGroup.visible = !this.previousPathGroup.visible || this.comparisonCandidateReady;
  }
  getPlanComparisonState() {
    return { visible: this.previousPathGroup.visible, candidateReady: this.comparisonCandidateReady,
      departureJdTdb: this.previousSolution?.plan.departurePeriapsisJdTdb ?? null,
      arrivalJdTdb: this.previousSolution?.plan.arrivalPeriapsisJdTdb ?? null,
      paths: this.previousPathGroup.children.map(object => {
        const line = object as THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
        return { name: line.name, dashed: line.material.isLineDashedMaterial, points: Array.from(line.geometry.getAttribute('position').array) };
      }) };
  }
  /** Structural DTO is compatible with CommandSignalView; protocol status and
   * Earth-known confirmation remain outside this renderer. Call after solution. */
  setCommandSignals(signals:readonly CommandSignalDTO[]) {
    if(this.disposed)return;
    if(!this.commandSignals&&signals.length){
      const renderer=new CommandSignals();
      try {renderer.setSignals(signals);} catch(error) {renderer.dispose();throw error;}
      this.commandSignals=renderer;this.scene.add(renderer.group);
    }else this.commandSignals?.setSignals(signals);
    this.commandSignalRecordCount=signals.length;
    this.positionScene();
    if(!this.solution&&this.commandSignals)this.commandSignals.group.visible=false;
  }
  clearCommandSignals() {
    if(this.disposed)return;
    this.commandSignals?.clear();
    if(this.commandSignals)this.commandSignals.group.visible=false;
    this.commandSignalRecordCount=0;this.commandSignalSamples=[];
    this.updateLegend();
  }
  setReducedMotion(enabled:boolean) {
    if(this.disposed)return;
    this.reducedMotion=enabled;
    this.controls.enableDamping=!enabled;
    if(this.solution)this.positionScene();
  }
  getCommandSignalPresentation() {
    const visible=!!this.commandSignals?.group.visible;
    const visibleCount=visible?this.commandSignalSamples.filter(sample=>sample.visible).length:0;
    const hiddenForPhasePreview=this.commandSignalRecordCount>0&&this.previewingPhase;
    return {
      recordCount:this.commandSignalRecordCount,visibleCount,hiddenForPhasePreview,reducedMotion:this.reducedMotion,
      plannedTailCount:this.commandSignalSamples.filter(sample=>sample.lastBitIsPlanned).length,
      truthLabel:visibleCount?tr('명령·ACK: 모의 실제 상태 · 지구 확인과 별개','COMMAND/ACK: SIMULATION TRUTH · NOT EARTH CONFIRMATION'):hiddenForPhasePreview?tr('다른 시점의 미리 보기에서는 현재 신호를 숨깁니다.','Live signals hidden in this other-epoch phase preview.'):null,
    };
  }
  private updateCommandSignals(state:TransferStateVector) {
    if(!this.commandSignals)return;
    const frame=transferSignalDisplayFrame(this.currentView,state,this.previewingPhase);
    this.commandSignals.group.visible=frame.visible&&!this.lost&&!this.planningPending;
    if(!this.commandSignals.group.visible){this.commandSignalSamples=[];return;}
    const center=frame.centerPositionKm,scale=frame.scale;
    this.commandSignalSamples=this.commandSignals.update(this.elapsed,(p,out)=>{
      out.set((p[0]-center[0])*scale,(p[2]-center[2])*scale,-(p[1]-center[1])*scale);
    },{reducedMotion:this.reducedMotion});
  }
  setCraft(design: Design) {
    if (this.disposed) return;
    this.clearGroup(this.craft);
    this.craft.add(createBus(design));
    for (const part of design.parts) {
      const mesh = createPart(part,design),
        tr = partTransformFor(design,part);
      mesh.position.set(...tr.position);
      mesh.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          new THREE.Vector3(...tr.tangentU),
          new THREE.Vector3(...tr.tangentV),
          new THREE.Vector3(...tr.normal),
        ),
      );
      mesh.userData.partId = part.id;
      mesh.userData.partKind=part.kind;
      mesh.userData.modelId=part.modelId??null;
      this.craft.add(mesh);
    }
    // The parts module has shared materials. Clone before owning/disposal in this renderer.
    const materials = new Map<THREE.Material, THREE.Material>(),
      textures = new Map<THREE.Texture, THREE.Texture>();
    this.craft.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const clone = (original: THREE.Material) => {
        let mat = materials.get(original);
        if (mat) return mat;
        mat = original.clone();
        for (const key of [
          "map",
          "normalMap",
          "roughnessMap",
          "metalnessMap",
          "emissiveMap",
          "alphaMap",
          "bumpMap",
          "aoMap",
          "lightMap",
          "displacementMap",
          "envMap",
        ] as const) {
          const source = (original as THREE.MeshStandardMaterial)[key];
          if (source) {
            let texture = textures.get(source);
            if (!texture) {
              texture = source.clone();
              texture.needsUpdate = true;
              textures.set(source, texture);
            }
            (mat as THREE.MeshStandardMaterial)[key] = texture;
          }
        }
        materials.set(original, mat);
        return mat;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(clone)
        : clone(o.material);
    });
    // Evaluate actual mounted geometry in the craft's local frame, independent
    // of its current exaggerated display scale and inertial attitude.
    const position=this.craft.position.clone(),quaternion=this.craft.quaternion.clone(),scale=this.craft.scale.clone();
    this.craft.position.set(0,0,0);this.craft.quaternion.identity();this.craft.scale.setScalar(1);this.craft.updateMatrixWorld(true);
    this.craftBounds.setFromObject(this.craft,true);this.partBounds.clear();
    this.inspectionSolidBounds=this.craft.children.map(child=>new THREE.Box3().setFromObject(child,true)).filter(box=>!box.isEmpty());
    for(const child of this.craft.children)if(typeof child.userData.partId==='string')this.partBounds.set(child.userData.partId,new THREE.Box3().setFromObject(child,true));
    this.craft.position.copy(position);this.craft.quaternion.copy(quaternion);this.craft.scale.copy(scale);
    if(this.inspectedPartId&&!this.partBounds.has(this.inspectedPartId))this.inspectedPartId=null;
    if(this.inspectionFocusPartId&&!this.partBounds.has(this.inspectionFocusPartId))this.inspectionFocusPartId=null;
    this.inspection.requestFit();this.positionScene();
  }
  /** Opt-in, reversible, current-epoch inspection. It never calls simulation APIs. */
  setCraftInspection(enabled:boolean):boolean {
    if(this.disposed)return false;
    if(enabled===this.inspection.enabled)return enabled;
    if(enabled){
      if(!this.solution||this.lost||this.planningPending)return false;
      this.endDrag();
      this.inspectionRestore={view:this.currentView,autoFrame:this.autoFrame,resetFrame:this.resetFrame,pathVisible:this.pathGroup.visible,orbitVisible:this.orbitGroup.visible};
      this.inspection.setViewport(this.container.clientWidth,this.container.clientHeight,this.inspectionInsets);
      this.inspection.enter();this.autoFrame=false;this.inspectedPartId=null;this.inspectionFocusPartId=null;
      this.pathGroup.visible=false;this.orbitGroup.visible=false;
      this.inspectionPhase=null;this.positionScene();return true;
    }
    const saved=this.inspectionRestore;
    this.inspection.exit();this.inspectionRestore=null;this.inspectionPhase=null;
    this.inspectedPartId=null;this.inspectionFocusPartId=null;this.inspectionPointer=null;this.inspectionOutline.visible=false;
    if(saved){
      this.currentView=saved.view;this.pathGroup.visible=saved.pathVisible;this.orbitGroup.visible=saved.orbitVisible;
      this.autoFrame=false;this.rebuildPaths();this.positionScene();
      this.autoFrame=saved.autoFrame;this.resetFrame=saved.resetFrame;
    }
    this.callbacks.inspectionPartSelected?.(null);return false;
  }
  setInspectionViewport(insets:InspectionViewport) {
    this.inspection.setViewport(this.container.clientWidth,this.container.clientHeight,insets);
    this.inspectionInsets={...insets};if(this.inspection.enabled)this.positionScene();
  }
  getCraftInspectionState() {
    const state=this.inspection.getState();
    const distanceScale=this.currentView==='solar'?SOLAR_SCALE:3/(this.currentView==='earth'?TRANSFER_EARTH_RADIUS_KM:TRANSFER_MARS_RADIUS_KM);
    const selected=this.craft.children.find(child=>child.userData.partId===this.inspectedPartId);
    const body=this.currentView==='earth'?this.earth:this.currentView==='mars'?this.mars:null;
    return {...state,phase:this.inspectionPhase,selectedPartId:this.inspectedPartId,focusedPartId:this.inspectionFocusPartId,selectedPart:selected?{id:selected.userData.partId,kind:selected.userData.partKind,modelId:selected.userData.modelId}:null,
      epochSeconds:this.elapsed,previewingPhase:this.previewingPhase,view:this.currentView,attitudeIsActual:!!this.attitude&&!this.previewingPhase,
      exaggeration:state.displayScale!==null?state.displayScale/(distanceScale/1000):null,
      cameraSurfaceClearance:body?this.camera.position.distanceTo(body.position)-3:null,
      cameraPosition:this.camera.position.toArray(),craftPosition:this.craft.position.toArray(),craftQuaternion:this.craft.quaternion.toArray()};
  }
  focusInspectionPart(id:string|null):boolean {
    if(!this.inspection.enabled||(id!==null&&!this.partBounds.has(id)))return false;
    this.inspectedPartId=id;this.inspectionFocusPartId=id;this.inspection.requestFit();this.positionScene();this.callbacks.inspectionPartSelected?.(id);return true;
  }
  getInspectionPartScreen(id:string) {
    if(!this.inspection.enabled)return null;
    const bounds=this.partBounds.get(id);if(!bounds)return null;
    this.craft.updateMatrixWorld(true);this.camera.updateMatrixWorld();
    const candidates:THREE.Vector3[]=[],part=this.craft.children.find(child=>child.userData.partId===id),rect=this.canvas.getBoundingClientRect();
    part?.traverse(object=>{if(object instanceof THREE.Mesh&&object.visible){object.geometry.computeBoundingBox();if(object.geometry.boundingBox)candidates.push(object.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(object.matrixWorld));}});
    for(const candidate of candidates){
      const point=candidate.project(this.camera),x=rect.left+(point.x+1)*rect.width/2,y=rect.top+(1-point.y)*rect.height/2;
      if(point.z>-1&&point.z<1&&Math.abs(point.x)<1&&Math.abs(point.y)<1&&this.pickInspectionPart({clientX:x,clientY:y})===id)return {x,y,visible:true};
    }
    const point=bounds.getCenter(new THREE.Vector3()).applyMatrix4(this.craft.matrixWorld).project(this.camera);
    return {x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2,visible:false};
  }
  private updateInspection(state:TransferStateVector) {
    if(!this.inspection.enabled||!this.solution)return;
    const solar=this.currentView==='solar';
    const obstacles:CameraObstacle[]=solar?[
      {center:this.earth.position,radius:TRANSFER_EARTH_RADIUS_KM*SOLAR_SCALE},
      {center:this.mars.position,radius:TRANSFER_MARS_RADIUS_KM*SOLAR_SCALE},
      {center:new THREE.Vector3(),radius:695700*SOLAR_SCALE},
    ]:[{center:new THREE.Vector3(),radius:3.005}]; // Solid surface + numerical margin; atmosphere is transparent.
    const physicalRadius=this.currentView==='earth'?TRANSFER_EARTH_RADIUS_KM:TRANSFER_MARS_RADIUS_KM;
    const minimumClearance=solar?undefined:Math.max(.0001,(this.currentView==='earth'?this.solution.plan.earthParkingAltitudeKm:this.solution.plan.marsPeriapsisAltitudeKm)*3/physicalRadius-.005);
    const outward=solar?vector(state.heliocentricPositionKm).normalize():this.craft.position.clone().normalize();
    const shoulder=new THREE.Vector3(5.9,3.9,-4.6).normalize().applyQuaternion(this.craft.quaternion);
    const initialDirection=this.currentView==='mars'
      ?planetInspectionDirection({craftPosition:this.craft.position,bodyCenter:this.mars.position,bodyRadius:3,shoulder,width:this.container.clientWidth,height:this.container.clientHeight,fovDeg:this.camera.fov,insets:this.inspectionInsets}).direction
      :outward.addScaledVector(shoulder,.5).normalize();
    const layout=this.inspection.update({position:this.craft.position,quaternion:this.craft.quaternion,bounds:this.craftBounds,focusBounds:this.inspectionFocusPartId?this.partBounds.get(this.inspectionFocusPartId):undefined,
      preferredScale:solar?.115:.18,minimumClearance,obstacles,solidBounds:this.inspectionSolidBounds,initialDirection,frameKey:state.phase});
    this.craft.scale.setScalar(layout.scale);this.craft.updateMatrixWorld(true);
    this.inspectionPhase=state.phase;
    const selected=this.inspectedPartId?this.partBounds.get(this.inspectedPartId):null;
    this.inspectionOutline.visible=!!selected;
    if(selected)this.inspectionOutline.box.copy(selected).applyMatrix4(this.craft.matrixWorld);
  }
  private applyMarsSurfaceTexture() {
    const material=this.mars.material as THREE.MeshStandardMaterial;
    const texture=this.marsSurfaceDetail?.activeTexture??this.marsBaseTexture;
    if(material.map!==texture){material.map=texture;if(texture)material.color.set(0xffffff);material.needsUpdate=true;}
  }
  private updateMarsSurfaceDetail() {
    if(!this.marsSurfaceDetail||this.disposed)return;
    const eligible=shouldLoadMarsSurfaceDetail({hasSolution:!!this.solution,inspectionEnabled:this.inspection.enabled,phase:this.inspectionPhase,view:this.currentView,phasePreview:this.previewingPhase,contextLost:this.lost,quality:this.quality,maxTextureSize:this.renderer.capabilities.maxTextureSize});
    this.marsSurfaceDetail.setEligible(eligible);this.applyMarsSurfaceTexture();
  }
  getMarsSurfaceDetailState() {
    const material=this.mars.material as THREE.MeshStandardMaterial,image=material.map?.image as {width?:number;height?:number}|undefined;
    return {...this.marsSurfaceDetail.getState(),supported:this.renderer.capabilities.maxTextureSize>=4096,
      activeWidth:image?.width??null,activeHeight:image?.height??null,
      source:material.map===this.marsSurfaceDetail.texture&&!!material.map?'NASA Trek Viking MDIM2.1':'NASA Viking baseline',
      assetUrl:'/assets/textures/mars-mdim21-4k.webp',provenanceUrl:'/data/mars-surface-detail.json'};
  }
  private pickInspectionPart(event:Pick<MouseEvent,'clientX'|'clientY'>) {
    const rect=this.canvas.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),ray=new THREE.Raycaster();
    this.camera.updateMatrixWorld();this.craft.updateMatrixWorld(true);ray.setFromCamera(pointer,this.camera);
    const first=ray.intersectObject(this.craft,true)[0];
    let object=first?.object as THREE.Object3D|undefined;
    while(object&&object!==this.craft){if(typeof object.userData.partId==='string')return object.userData.partId as string;object=object.parent??undefined;}
    return null;
  }
  private inspectionDoubleClick=(event:MouseEvent)=>{
    if(!this.inspection.enabled||event.button!==0)return;
    this.focusInspectionPart(this.pickInspectionPart(event));event.preventDefault();
  };
  setAttitude(quaternion: Quaternion | null) {
    if (quaternion && quaternion.every(Number.isFinite)) {
      this.attitude = [...quaternion];
    } else this.attitude = null;
    this.positionScene();
  }
  setDateEditing(enabled: boolean) {
    this.dateEditing = enabled;
    if (!enabled) this.endDrag();
    this.syncPreviousPlanVisibility();
    this.positionScene();
  }
  setPlanningPending(pending:boolean) {
    this.planningPending=pending;
    if(pending)this.endDrag(false);
    this.pathGroup.traverse(object=>{
      if(!(object instanceof THREE.Line)&&!(object instanceof Line2))return;
      for(const material of Array.isArray(object.material)?object.material:[object.material]) {
        if(material.userData.acceptedPathOpacity===undefined)material.userData.acceptedPathOpacity=material.opacity;
        material.opacity=pending?material.userData.acceptedPathOpacity*.28:material.userData.acceptedPathOpacity;
      }
    });
    this.positionScene();this.updateLegend();
  }
  setEpoch(elapsedSeconds: number) {
    if (!Number.isFinite(elapsedSeconds) || this.disposed) return;
    this.elapsed = this.solution
      ? THREE.MathUtils.clamp(elapsedSeconds, 0, this.solution.durationSeconds)
      : Math.max(0, elapsedSeconds);
    this.positionScene();
  }
  setView(view: View) {
    if (this.disposed) return;
    if(this.inspection.enabled)this.setCraftInspection(false);
    this.currentView = view;
    this.endDrag();
    this.ghost.visible = false;
    this.dragLabel.style.display = "none";
    this.controls.enabled = true;
    this.autoFrame = true;
    this.resetFrame = true;
    this.controls.target.set(0, 0, 0);
    if (view === "solar") {
      this.camera.position.set(24, 32.4, 36);
      this.controls.minDistance = 8;
      this.controls.maxDistance = 90;
      this.camera.far = 5000;
    } else {
      this.camera.position.set(9, 6, 12);
      this.controls.minDistance = 4.1;
      this.controls.maxDistance = 4000;
      this.camera.far = 10000;
    }
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.rebuildPaths();
    this.setPlanningPending(this.planningPending);
  }
  private effectiveState(): TransferStateVector | null {
    if (!this.solution) return null;
    const s = this.solution,
      phase = transferStateAt(s, this.elapsed);
    this.previewingPhase = false;
    if(this.inspection.enabled){
      const activeView:View=phase.phase==='earth-escape'?'earth':phase.phase==='mars-flyby'?'mars':'solar';
      if(this.currentView!==activeView){this.currentView=activeView;this.rebuildPaths();}
      return phase;
    }
    if (this.currentView === "earth" && phase.phase !== "earth-escape") {
      this.previewingPhase = true;
      return transferStateAt(s, 0);
    }
    if (this.currentView === "mars" && phase.phase !== "mars-flyby") {
      this.previewingPhase = true;
      return transferStateAt(s, s.periapsisSeconds);
    }
    return phase;
  }
  private positionScene() {
    this.syncPreviousPlanVisibility();
    const state = this.effectiveState();
    if (!state || !this.solution) return;
    this.craft.visible = true;
    const solar = this.currentView === "solar",
      scale = solar
        ? SOLAR_SCALE
        : 3 /
          (this.currentView === "earth"
            ? TRANSFER_EARTH_RADIUS_KM
            : TRANSFER_MARS_RADIUS_KM);
    this.sun.visible = solar;
    this.earth.visible = solar || this.currentView === "earth";
    this.mars.visible = solar || this.currentView === "mars";
    // During cruise inspection, planet radii use the actual distance scale;
    // the enlarged overview globes would otherwise engulf a nearby SOI exit.
    this.earth.scale.setScalar(solar ? (this.inspection.enabled?TRANSFER_EARTH_RADIUS_KM*SOLAR_SCALE:0.46) : 3);
    this.mars.scale.setScalar(solar ? (this.inspection.enabled?TRANSFER_MARS_RADIUS_KM*SOLAR_SCALE:0.34) : 3);
    this.sun.scale.setScalar(solar&&this.inspection.enabled?695700*SOLAR_SCALE/.72:1);
    this.earth.position.copy(
      solar ? vector(state.earth.positionKm, SOLAR_SCALE) : new THREE.Vector3(),
    );
    this.mars.position.copy(
      solar ? vector(state.mars.positionKm, SOLAR_SCALE) : new THREE.Vector3(),
    );
    // Surface rotation is a visual convention, not an IAU body-fixed targeting model.
    this.earth.rotation.y = (state.jdTdb - 2451545) * Math.PI * 2;
    this.mars.rotation.y = ((state.jdTdb - 2451545) * Math.PI * 2) / 1.025957;
    this.craft.position.copy(
      vector(
        solar ? state.heliocentricPositionKm : state.relativePositionKm,
        scale,
      ),
    );
    this.craft.scale.setScalar(solar ? 0.115 : 0.18);
    if (this.attitude && !this.previewingPhase)
      this.craft.quaternion.set(...this.attitude).premultiply(FRAME);
    else
      this.craft.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        vector(state.relativeVelocityKmS).normalize(),
      );
    for (const kind of ["departure", "arrival"] as const) {
      const jd =
        kind === "departure"
          ? this.solution.plan.departurePeriapsisJdTdb
          : this.solution.plan.arrivalPeriapsisJdTdb;
      this.handles[kind].position.copy(
        vector(
          transferPlanetState(kind === "departure" ? "earth" : "mars", jd)
            .positionKm,
          SOLAR_SCALE,
        ),
      );
      this.handles[kind].visible = solar && this.dateEditing && !this.planningPending&&!this.inspection.enabled;
    }
    this.encounterGroup.visible=this.currentView==='mars'&&this.dateEditing&&!this.planningPending&&!!this.callbacks.encounterChange&&!this.inspection.enabled;
    this.key.visible = !solar;
    this.solarLight.visible = solar;
    if (!solar) {
      const sunDirection = vector(state.centerPositionKm).normalize().negate();
      this.key.position.copy(sunDirection.clone().multiplyScalar(50));
      this.key.target.position.set(0, 0, 0);
      if (this.autoFrame&&!this.inspection.enabled) {
        const distance = this.craft.position.length(),
          target = this.craft.position
            .clone()
            .multiplyScalar(distance > 7 ? 0.35 : 0),
          direction = this.resetFrame
            ? this.craft.position
                .clone()
                .normalize()
                .addScaledVector(sunDirection, 0.32)
                .add(new THREE.Vector3(0, 0.18, 0))
                .normalize()
            : this.camera.position
                .clone()
                .sub(this.controls.target)
                .normalize();
        this.controls.target.copy(target);
        this.camera.position
          .copy(target)
          .addScaledVector(direction, Math.max(13, distance * 1.5));
        this.controls.update();
        this.resetFrame = false;
      }
    }
    this.updateInspection(state);
    this.updateMarsSurfaceDetail();
    this.updateCommandSignals(state);
    this.updateLegend();
  }
  private updateLegend() {
    // The local Mars B-plane handle lives below/left of the planet. Keep the
    // explanation in the upper safe strip rather than covering that live grip.
    if(this.container.classList.contains('transfer-viewport')) {
      const editingMars=this.currentView==='mars'&&this.dateEditing&&!!this.callbacks.encounterChange;
      this.legend.style.top=editingMars?'134px':'auto';
      this.legend.style.bottom=editingMars?'auto':'154px';
    }
    if (this.lost) {
      this.legend.textContent = tr(
        "그래픽 연결이 중단되었습니다. 복구를 기다리고 있습니다.",
        "Graphics context lost. Waiting for recovery.",
      );
      return;
    }
    if (!this.solution) {
      this.legend.textContent = this.previousPathGroup.visible ? tr(
        "현재 경로를 계산하지 못했습니다 · 점선은 이전 계획 · 이전 계획으로 돌아갈 수 있습니다.",
        "Current route unavailable · dashed line is the previous plan · return to that plan to recover.",
      ) : tr(
        "유효한 전이 경로가 없습니다. 날짜 또는 조우 조건을 수정하세요.",
        "No valid transfer trajectory. Adjust the dates or encounter conditions.",
      );
      return;
    }
    const solar = this.currentView === "solar",
      factor = Math.round(
        0.18 /
          (3 /
            ((this.currentView === "earth"
              ? TRANSFER_EARTH_RADIUS_KM
              : TRANSFER_MARS_RADIUS_KM) *
              1000)),
      );
    this.legend.textContent = solar
      ? tr(
          "ICRF · 거리 1 AU = 10 단위 · 행성·탐사선 크기 확대",
          "ICRF · Distance: 1 AU = 10 units · Planet/craft sizes enlarged",
        )
      : tr(
          `${this.previewingPhase ? "구간 미리 보기 · " : ""}${this.currentView === "earth" ? "지구 탈출" : "화성 근접"} · 행성·경로 동일 축척 · 탐사선 ×${factor.toLocaleString()} 확대`,
          `${this.previewingPhase ? "PHASE PREVIEW · " : ""}${this.currentView === "earth" ? "EARTH ESCAPE" : "MARS FLYBY"} · Planet/path same scale · Craft enlarged ×${factor.toLocaleString()}`,
        );
    if (solar && this.dateEditing)
      this.legend.textContent +=
        " · " + tr("손잡이 드래그 ±45일 TDB", "Drag handles ±45 TDB days");
    if(this.currentView==='mars'&&this.dateEditing&&this.callbacks.encounterChange&&!this.inspection.enabled)
      this.legend.textContent += ' · '+tr('주황: 고도 · 파랑: 입사 B-plane 방향','Amber: altitude · Blue: incoming B-plane angle');
    if (!this.attitude || this.previewingPhase)
      this.legend.textContent +=
        " · " + tr("기체 방향은 설명용", "Illustrative craft orientation");
    if(this.planningPending)this.legend.textContent=tr('이전 승인 경로 · 새 계산 중 — ','PREVIOUS ACCEPTED PATH · CALCULATING — ')+this.legend.textContent;
    if(this.previousPathGroup.visible)this.legend.textContent += ' · '+tr('금색 점선: 이전 계획 · 실선: 변경 경로 · 각각의 계획 날짜 기준','Gold dashed: previous plan · solid: changed route · each at its planned dates');
    const signalLabel=this.getCommandSignalPresentation().truthLabel;
    if(signalLabel)this.legend.textContent+=' · '+signalLabel;
    if(this.inspection.enabled){
      const info=this.getCraftInspectionState(),enlargement=Math.round(info.exaggeration??1).toLocaleString();
      this.legend.style.top='auto';this.legend.style.bottom=`${Math.max(10,this.inspectionInsets.bottom-24)}px`;
      this.legend.textContent=tr(`현재 비행 · 탐사선 ×${enlargement} 표시 확대 · 행성은 실제 현재 방향 · 오른쪽 드래그 / 휠`, `CURRENT FLIGHT · Craft display ×${enlargement} · Actual current planet direction · Right-drag / wheel`);
      if(!info.attitudeIsActual)this.legend.textContent+=' · '+tr('자세는 설명용','Illustrative attitude');
      if(signalLabel)this.legend.textContent+=' · '+signalLabel;
    }
  }
  private line(
    points: THREE.Vector3[],
    color: number,
    opacity = 1,
    dashed = false,
  ) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = dashed
      ? new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity,
          dashSize: 0.13,
          gapSize: 0.13,
        })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new THREE.Line(geometry, material);
    if (dashed) line.computeLineDistances();
    return line;
  }
  private trajectoryLine(points: THREE.Vector3[], color: number) {
    const geometry = new LineGeometry();
    geometry.setPositions(points.flatMap((p) => p.toArray()));
    const material = new LineMaterial({
      color,
      linewidth: 2.1,
      transparent: true,
      opacity: 0.92,
      resolution: this.renderer.getSize(new THREE.Vector2()),
    });
    return new Line2(geometry, material);
  }
  private rebuildPaths() {
    this.clearGroup(this.pathGroup);
    this.clearGroup(this.orbitGroup);
    if (!this.solution) return;
    const s = this.solution;
    if (this.currentView === "solar") {
      for (const [body, color, period] of [
        ["earth", 0x3a6d83, 366],
        ["mars", 0x775849, 687],
      ] as const) {
        const center = s.plan.departurePeriapsisJdTdb,
          from = Math.max(EPHEMERIS_START_JD_TDB, center - 100),
          to = Math.min(EPHEMERIS_END_JD_TDB, from + period),
          points = Array.from({ length: 300 }, (_, i) =>
            vector(
              transferPlanetState(body, from + ((to - from) * i) / 299)
                .positionKm,
              SOLAR_SCALE,
            ),
          );
        this.orbitGroup.add(this.line(points, color, 0.65));
      }
      for (const [phase, color] of [
        ["earth-escape", 0x91dcd5],
        ["solar-coast", 0x78e0c7],
        ["mars-flyby", 0xf3b56b],
      ] as const)
        this.pathGroup.add(
          this.trajectoryLine(
            transferTrajectory(
              s,
              phase,
              phase === "solar-coast" ? 360 : 100,
            ).map((p) => vector(p.heliocentricPositionKm, SOLAR_SCALE)),
            color,
          ),
        );
      const departure = vector(
          transferPlanetState("mars", s.plan.departurePeriapsisJdTdb)
            .positionKm,
          SOLAR_SCALE,
        ),
        arrival = vector(
          transferPlanetState("mars", s.plan.arrivalPeriapsisJdTdb).positionKm,
          SOLAR_SCALE,
        );
      this.orbitGroup.add(
        this.line([departure, arrival], 0xc18b5c, 0.25, true),
      );
    } else {
      const phase =
          this.currentView === "earth" ? "earth-escape" : "mars-flyby",
        scale =
          3 /
          (this.currentView === "earth"
            ? TRANSFER_EARTH_RADIUS_KM
            : TRANSFER_MARS_RADIUS_KM);
      this.pathGroup.add(
        this.trajectoryLine(
          transferTrajectory(s, phase, 440).map((p) =>
            vector(p.relativePositionKm, scale),
          ),
          this.currentView === "earth" ? 0x8ee2d4 : 0xffc58a,
        ),
      );
    }
  }
  getHandleScreen(kind: DateKind, projectedJdTdb?: number) {
    if (
      !this.solution ||
      this.currentView !== "solar" ||
      this.disposed ||
      !this.dateEditing
      || this.planningPending||this.inspection.enabled
    )
      return null;
    this.camera.updateMatrixWorld();
    const rect = this.canvas.getBoundingClientRect(),
      p = (projectedJdTdb === undefined ? this.handles[kind].getWorldPosition(new THREE.Vector3())
        : vector(transferPlanetState(kind === 'departure' ? 'earth' : 'mars', projectedJdTdb).positionKm, SOLAR_SCALE)).project(this.camera);
    return {
      x: rect.left + ((p.x + 1) * rect.width) / 2,
      y: rect.top + ((1 - p.y) * rect.height) / 2,
      visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1,
      jdTdb: projectedJdTdb ?? (kind === "departure"
          ? this.solution.plan.departurePeriapsisJdTdb
          : this.solution.plan.arrivalPeriapsisJdTdb),
    };
  }
  getEncounterHandleScreen(axis:EncounterAxis='altitude') {
    if(!this.solution||this.currentView!=='mars'||!this.dateEditing||this.planningPending||!this.callbacks.encounterChange||this.disposed||this.lost||this.inspection.enabled)return null;
    this.camera.updateMatrixWorld();
    const rect=this.canvas.getBoundingClientRect(),p=this.encounterHandles[axis].getWorldPosition(new THREE.Vector3()).project(this.camera);
    return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,visible:p.z>-1&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1,axis,altitudeKm:this.solution.plan.marsPeriapsisAltitudeKm,angleRad:this.solution.plan.marsBPlaneAngleRad};
  }
  private rebuildEncounterGuides() {
    this.clearGroup(this.encounterGuides);if(!this.solution)return;
    const plan=this.solution.plan,guide=transferEncounterGuide(this.solution,plan.marsPeriapsisAltitudeKm,plan.marsBPlaneAngleRad);
    this.encounterHandles.altitude.position.copy(guide.periapsis);
    this.encounterHandles.angle.position.copy(guide.bPlane);
    const ring:THREE.Vector3[]=[],radial:THREE.Vector3[]=[];
    for(let i=0;i<=128;i++)ring.push(transferEncounterGuide(this.solution,plan.marsPeriapsisAltitudeKm,-Math.PI+i/128*Math.PI*2).bPlane);
    for(let i=0;i<=64;i++)radial.push(transferEncounterGuide(this.solution,250+i/64*9750,plan.marsBPlaneAngleRad).periapsis);
    for(const [points,color] of [[ring,0x72c7df],[radial,0xf3b97e]] as const) {
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color,dashSize:.09,gapSize:.075,transparent:true,opacity:.42,depthWrite:false}));
      line.computeLineDistances();line.raycast=()=>{};this.encounterGuides.add(line);
    }
  }
  private beginEncounterDrag(event:PointerEvent) {
    if(!this.solution||!this.callbacks.encounterChange)return;
    const hits=(['altitude','angle'] as const).map(axis=>({axis,screen:this.getEncounterHandleScreen(axis)})).filter(h=>h.screen?.visible).map(h=>({...h,distance:Math.hypot(h.screen!.x-event.clientX,h.screen!.y-event.clientY)})).sort((a,b)=>a.distance-b.distance);
    if(!hits.length||hits[0].distance>30)return;
    const plan=this.solution.plan;
    this.encounterDrag={axis:hits[0].axis,pointerId:event.pointerId,initialAltitude:plan.marsPeriapsisAltitudeKm,initialAngle:plan.marsBPlaneAngleRad,altitude:plan.marsPeriapsisAltitudeKm,angle:plan.marsBPlaneAngleRad};
    this.autoFrame=false;this.controls.enabled=false;this.canvas.setPointerCapture(event.pointerId);
    this.ghost.position.copy(this.encounterHandles[hits[0].axis].position);this.ghost.scale.setScalar(.35);this.ghost.visible=true;
    event.preventDefault();
  }
  private moveEncounterDrag(event:PointerEvent) {
    const drag=this.encounterDrag;if(!drag||event.pointerId!==drag.pointerId||!this.solution)return;
    const rect=this.canvas.getBoundingClientRect(),minimum=drag.axis==='altitude'?250:-Math.PI,maximum=drag.axis==='altitude'?10000:Math.PI;
    let best=drag.axis==='altitude'?drag.altitude:drag.angle,distance=Infinity;
    const consider=(value:number)=>{
      const guide=transferEncounterGuide(this.solution!,drag.axis==='altitude'?value:drag.initialAltitude,drag.axis==='angle'?value:drag.initialAngle);
      const projected=(drag.axis==='altitude'?guide.periapsis:guide.bPlane).clone().project(this.camera);
      if(projected.z<=-1||projected.z>=1)return;
      const delta=Math.hypot(rect.left+(projected.x+1)*rect.width/2-event.clientX,rect.top+(1-projected.y)*rect.height/2-event.clientY);
      if(delta<distance){best=value;distance=delta;}
    };
    for(let i=0;i<=360;i++)consider(minimum+i/360*(maximum-minimum));
    const coarse=best,step=(maximum-minimum)/360;
    for(let i=-10;i<=10;i++)consider(THREE.MathUtils.clamp(coarse+i/10*step,minimum,maximum));
    if(drag.axis==='altitude')drag.altitude=best;else drag.angle=best;
    const guide=transferEncounterGuide(this.solution,drag.altitude,drag.angle);this.ghost.position.copy(drag.axis==='altitude'?guide.periapsis:guide.bPlane);
    this.dragLabel.textContent=`${drag.altitude.toFixed(0)} km · ${(drag.angle*180/Math.PI).toFixed(1)}° · ${tr('국소 미리 보기 · 놓아서 전체 경로 계산','LOCAL GUIDE · Release to solve full transfer')}`;
    this.dragLabel.style.display='block';
    this.callbacks.encounterChange?.(drag.altitude,drag.angle,false);event.preventDefault();
  }
  private pointerDown = (event: PointerEvent) => {
    if(this.inspection.enabled){
      if(event.button===0)this.inspectionPointer={id:event.pointerId,x:event.clientX,y:event.clientY};
      return;
    }
    if(this.planningPending)return;
    if(event.button===0&&this.solution&&this.dateEditing&&this.currentView==='mars') {this.beginEncounterDrag(event);return;}
    if (
      event.button !== 0 ||
      !this.solution ||
      this.currentView !== "solar" ||
      !this.dateEditing
    )
      return;
    const handles = (["departure", "arrival"] as const)
      .map((kind) => ({ kind, p: this.getHandleScreen(kind) }))
      .filter((v) => v.p?.visible)
      .map((v) => ({
        ...v,
        distance: Math.hypot(v.p!.x - event.clientX, v.p!.y - event.clientY),
      }))
      .sort((a, b) => a.distance - b.distance);
    if (!handles.length || handles[0].distance > 34) return;
    const kind = handles[0].kind,
      jd = handles[0].p!.jdTdb;
    this.drag = { kind, pointerId: event.pointerId, initialJd: jd, jd };
    this.controls.enabled = false;
    this.canvas.setPointerCapture(event.pointerId);
    this.ghost.position.copy(this.handles[kind].position);
    this.ghost.scale.setScalar(1);
    this.ghost.visible = true;
    event.preventDefault();
  };
  private pointerMove = (event: PointerEvent) => {
    if(this.encounterDrag){this.moveEncounterDrag(event);return;}
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const rect = this.canvas.getBoundingClientRect(),
      body = this.drag.kind === "departure" ? "earth" : "mars",
      from = Math.max(EPHEMERIS_START_JD_TDB, this.drag.initialJd - 45),
      to = Math.min(EPHEMERIS_END_JD_TDB, this.drag.initialJd + 45);
    let best = this.drag.jd,
      bestDistance = Infinity;
    for (let i = 0; i <= 360; i++) {
      const jd = from + ((to - from) * i) / 360,
        p = vector(
          transferPlanetState(body, jd).positionKm,
          SOLAR_SCALE,
        ).project(this.camera);
      const distance = Math.hypot(
        rect.left + ((p.x + 1) * rect.width) / 2 - event.clientX,
        rect.top + ((1 - p.y) * rect.height) / 2 - event.clientY,
      );
      if (distance < bestDistance) {
        best = jd;
        bestDistance = distance;
      }
    }
    this.drag.jd = best;
    this.ghost.position.copy(
      vector(transferPlanetState(body, best).positionKm, SOLAR_SCALE),
    );
    this.dragLabel.textContent = `${this.drag.kind === "departure" ? tr("출발", "DEPARTURE") : tr("도착", "ARRIVAL")} · ${jdToTdbCalendar(best)} TDB · ${best - this.drag.initialJd >= 0 ? "+" : ""}${(best - this.drag.initialJd).toFixed(2)} ${tr("일", "days")} · ${tr("놓아서 계산", "Release to solve")}`;
    this.dragLabel.style.display = "block";
    this.callbacks.dateChange(this.drag.kind, best, false);
    event.preventDefault();
  };
  private pointerUp = (event: PointerEvent) => {
    if(this.inspection.enabled){
      const start=this.inspectionPointer;this.inspectionPointer=null;
      if(start&&start.id===event.pointerId&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<5){
        this.inspectedPartId=this.pickInspectionPart(event);this.positionScene();this.callbacks.inspectionPartSelected?.(this.inspectedPartId);
      }
      return;
    }
    if(this.encounterDrag&&event.pointerId===this.encounterDrag.pointerId){const {altitude,angle}=this.encounterDrag;this.endDrag(false);this.callbacks.encounterChange?.(altitude,angle,true);return;}
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const { kind, jd } = this.drag;
    this.endDrag(false);
    this.callbacks.dateChange(kind, jd, true);
  };
  private pointerCancel = () => {
    this.inspectionPointer=null;
    this.endDrag();
  };
  private keyDown = (event:KeyboardEvent) => {if(event.key==='Escape'&&(this.drag||this.encounterDrag)){this.endDrag();event.preventDefault();}};
  private endDrag(restorePreview=true) {
    if (this.drag && this.canvas.hasPointerCapture(this.drag.pointerId))
      this.canvas.releasePointerCapture(this.drag.pointerId);
    if(this.encounterDrag){
      if(this.canvas.hasPointerCapture(this.encounterDrag.pointerId))this.canvas.releasePointerCapture(this.encounterDrag.pointerId);
      if(restorePreview){if(this.callbacks.encounterCancel)this.callbacks.encounterCancel();else this.callbacks.encounterChange?.(this.encounterDrag.initialAltitude,this.encounterDrag.initialAngle,false);}
    }
    this.encounterDrag=null;
    this.drag = null;
    this.ghost.visible = false;
    this.dragLabel.style.display = "none";
    this.controls.enabled = true;
  }
  private contextLost = (event: Event) => {
    event.preventDefault();
    if(this.lost||this.disposed)return;
    this.lost = true;
    this.updateMarsSurfaceDetail();
    // Retire the old target while its original renderer cache still owns its
    // handles. After restoration Three rebuilds that cache, so disposing the
    // pre-loss framebuffer/depthbuffer/texture then would delete foreign handles.
    if(!this.environmentDisposed){this.environment.dispose();this.environmentDisposed=true;}
    this.scene.environment=null;
    const markerPool=this.commandSignals?.getContextResources();
    retireContextResources([this.scene],{...markerPool,textures:[...this.textures,...(this.marsSurfaceDetail.texture?[this.marsSurfaceDetail.texture]:[])]});
    if(this.commandSignals)this.commandSignals.group.visible=false;
    this.endDrag();
    this.updateLegend();
    this.callbacks.contextLost?.();
  };
  private contextRestored = () => {
    // Render-target pixels do not survive a lost context; regenerate the studio
    // reflection map instead of leaving restored metal surfaces black.
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    const restored = pmrem.fromScene(room, 0.08);
    room.dispose();
    pmrem.dispose();
    this.environment = restored;
    this.environmentDisposed=false;
    this.scene.environment = restored.texture;
    this.lost = false;
    this.marsSurfaceDetail.markContextRestored();
    this.positionScene();
    this.updateLegend();
  };
  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if(width-this.inspectionInsets.left-this.inspectionInsets.right>=32&&height-this.inspectionInsets.top-this.inspectionInsets.bottom>=32){
      this.inspection.setViewport(width,height,this.inspectionInsets);
      if(this.inspection.enabled)this.positionScene();
    }
    this.pathGroup.traverse((o) => {
      if (o instanceof Line2) o.material.resolution.set(width, height);
    });
  }
  setQuality(quality:TransferQuality) {
    if(this.disposed)return;
    const changed=quality!==this.quality;
    this.quality=quality;
    const width=quality==='high'?96:quality==='medium'?64:40,height=quality==='high'?64:quality==='medium'?48:28;
    if(changed){
      for(const body of [this.earth,this.mars]){body.geometry.dispose();body.geometry=new THREE.SphereGeometry(1,width,height);}
      const layerWidth=quality==='high'?64:quality==='medium'?48:32,layerHeight=quality==='high'?40:quality==='medium'?32:20;
      this.clouds.geometry.dispose();this.clouds.geometry=new THREE.SphereGeometry(1.012,layerWidth,layerHeight);
      this.earthGlow.geometry.dispose();this.earthGlow.geometry=new THREE.SphereGeometry(1.035,layerWidth,layerHeight);
    }
    this.clouds.visible=quality!=='low';this.earthGlow.visible=quality!=='low';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='high'?1.5:quality==='medium'?1:.85));
    for(const texture of this.textures){texture.anisotropy=Math.min(this.renderer.capabilities.getMaxAnisotropy(),quality==='high'?8:quality==='medium'?4:2);texture.needsUpdate=true;}
    this.resize();
    this.canvas.dataset.quality=quality;
    this.updateMarsSurfaceDetail();
  }
  getRenderSettings() {
    const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return {quality:this.quality,pixelRatio:this.renderer.getPixelRatio(),drawingBuffer:{width:size.x,height:size.y},antialias:true,toneMapping:'ACES',planetSegments:this.quality==='high'?[96,64]:this.quality==='medium'?[64,48]:[40,28],cloudsVisible:this.clouds.visible,atmosphereVisible:this.earthGlow.visible,scientificPathSampling:'unchanged by quality',marsSurfaceDetail:this.getMarsSurfaceDetailState()};
  }
  render(dt: number) {
    if (this.disposed || this.lost) return;
    this.controls.update(dt);
    this.inspection.constrain();
    this.camera.updateMatrixWorld();
    for (const g of [this.handles.departure, this.handles.arrival, this.ghost,this.encounterHandles.altitude,this.encounterHandles.angle])
      g.quaternion.copy(this.camera.quaternion);
    const rect = this.canvas.getBoundingClientRect();
    for (const label of this.labels) {
      const planetLabel =
        label.object === this.earth || label.object === this.mars;
      const visible =
        label.object.visible &&
        (label.object.parent?.visible ?? true) &&
        (!planetLabel || this.currentView === "solar");
      const offset =
        label.object === this.earth
          ? this.currentView === "solar"
            ? -0.8
            : 3.45
          : label.object === this.mars
            ? this.currentView === "solar"
              ? 0.58
              : 3.45
            : label.offset;
      const p = label.object
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, offset, 0))
        .project(this.camera);
      label.element.style.display =
        visible &&
        p.z > -1 &&
        p.z < 1 &&
        Math.abs(p.x) < 1.1 &&
        Math.abs(p.y) < 1.1
          ? "block"
          : "none";
      label.element.style.left = `${((p.x + 1) * rect.width) / 2}px`;
      label.element.style.top = `${((1 - p.y) * rect.height) / 2}px`;
    }
    this.renderer.render(this.scene, this.camera);
  }
  private clearGroup(group: THREE.Object3D) {
    const geometry = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    group.traverse((o) => {
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Line ||
        o instanceof THREE.Points ||
        o instanceof THREE.Sprite
      ) {
        if (!(o instanceof THREE.Sprite)) geometry.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(m);
          for (const key of [
            "map",
            "normalMap",
            "roughnessMap",
            "metalnessMap",
            "emissiveMap",
            "alphaMap",
            "bumpMap",
            "aoMap",
            "lightMap",
            "displacementMap",
            "envMap",
          ] as const) {
            const texture = (m as THREE.MeshStandardMaterial)[key];
            if (texture) textures.add(texture);
          }
        }
      }
    });
    geometry.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    // Asset textures are owned by the renderer pool and retired once on final
    // disposal. Part/path textures are local clones owned by this group.
    textures.forEach((t) => {if(!this.textures.has(t))t.dispose();});
    group.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.endDrag();
    this.disposed = true;
    this.observer.disconnect();
    this.controls.removeEventListener("start", this.stopAutoFrame);
    this.controls.dispose();
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointercancel", this.pointerCancel);
    this.canvas.removeEventListener('dblclick',this.inspectionDoubleClick);
    window.removeEventListener("keydown",this.keyDown);
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.contextRestored,
    );
    // This pool owns shared marker materials/geometry; detach it before the
    // generic scene traversal to prevent duplicate resource disposal.
    this.commandSignals?.dispose();this.commandSignals=null;
    this.commandSignalSamples=[];this.commandSignalRecordCount=0;
    // Detach the independently owned detail cache before generic traversal.
    if((this.mars.material as THREE.MeshStandardMaterial).map===this.marsSurfaceDetail.texture)
      (this.mars.material as THREE.MeshStandardMaterial).map=this.marsBaseTexture;
    this.marsSurfaceDetail.dispose();
    this.clearGroup(this.scene);
    this.textures.forEach((texture) => texture.dispose());
    this.textures.clear();this.marsBaseTexture=null;
    if(!this.environmentDisposed){this.environment.dispose();this.environmentDisposed=true;}
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.labelLayer.remove();
  }
}
