import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {retireContextResources} from './context-resources';

/** A separate, lazily loaded 3D room. Its main monitor is a live orbital camera. */
export class ControlRoom {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  readonly controls: OrbitControls;
  readonly screen = new THREE.WebGLRenderTarget(1280, 720, {
    depthBuffer: true,
  });
  ready = false;
  private loading: Promise<void> | null = null;
  private restoreEnvironment = false;
  private restoredEnvironment: THREE.WebGLRenderTarget | null = null;
  private disposed = false;
  private contextLost = false;
  private screenRetired = false;
  private onContextLost = () => {
    if(this.contextLost||this.disposed)return;
    this.contextLost=true;this.restoreEnvironment=false;
    // The initial environment is borrowed from GameScene. Only retire a target
    // created by this room, and do so before Three replaces the old GL caches.
    this.restoredEnvironment?.dispose();this.restoredEnvironment=null;
    this.scene.traverse(object=>{if(object instanceof THREE.Light&&object.shadow){object.shadow.dispose();object.shadow.map=null;object.shadow.mapPass=null;}});
    this.scene.environment=null;
    if(!this.screenRetired){this.screen.dispose();this.screenRetired=true;}
    retireContextResources([this.scene]);
  };
  private onContextRestored = () => {
    this.contextLost=false;
    this.restoreEnvironment = true;
  };
  private canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement, environment: THREE.Texture | null) {
    this.canvas = canvas;
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.scene.background = new THREE.Color(0x101b24);
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.3;
    this.camera.position.set(7, 5, 14);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 2.8, -2.5);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 23;
    // Keep the interactive camera under the cutaway ceiling beams.
    this.controls.minPolarAngle = 1.43;
    this.controls.maxPolarAngle = 1.52;
    this.controls.minAzimuthAngle = -0.75;
    this.controls.maxAzimuthAngle = 0.75;
    this.controls.mouseButtons = {
      LEFT: undefined as unknown as THREE.MOUSE,
      MIDDLE: undefined as unknown as THREE.MOUSE,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.enabled = false;
    this.controls.update();
    this.scene.add(new THREE.HemisphereLight(0xd4ebff, 0x303b38, 1.4));
    const key = new THREE.DirectionalLight(0xffe1ad, 2.1);
    key.position.set(0, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    key.shadow.normalBias = 0.025;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x69bcb1, 1.1);
    fill.position.set(0, 5, -10);
    this.scene.add(fill);
  }
  async load() {
    if (this.disposed) throw new Error("Control room is disposed.");
    if (!this.loading)
      this.loading = (async () => {
        const gltf = await new GLTFLoader().loadAsync(
          "/assets/mission-control.glb",
        );
        if (this.disposed) {
          this.disposeMeshes(gltf.scene);
          return;
        }
        let found = false;
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.name === "MainScreen") {
            const old = o.material;
            const materials = Array.isArray(old) ? old : [old];
            const textures = new Set<THREE.Texture>();
            materials.forEach((m) => {
              const standard = m as THREE.MeshStandardMaterial;
              if (standard.map) textures.add(standard.map);
              if (standard.emissiveMap) textures.add(standard.emissiveMap);
              m.dispose();
            });
            textures.forEach((texture) => texture.dispose());
            // glTF image UVs use the opposite vertical convention to a WebGL
            // render target. Convert once so the live orbital feed stays upright.
            const uv = o.geometry.getAttribute("uv");
            for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
            uv.needsUpdate = true;
            o.material = new THREE.MeshBasicMaterial({
              map: this.screen.texture,
              toneMapped: false,
            });
            found = true;
            o.castShadow = false;
          }
        });
        if (!found) throw new Error("Control-room live screen is missing.");
        this.scene.add(gltf.scene);
        this.ready = true;
      })().catch((error) => {
        this.loading = null;
        throw error;
      });
    await this.loading;
  }
  render(
    renderer: THREE.WebGLRenderer,
    space: THREE.Scene,
    spaceCamera: THREE.PerspectiveCamera,
    dt: number,
  ) {
    if (this.disposed || this.contextLost) return;
    if (this.restoreEnvironment) {
      const generator = new THREE.PMREMGenerator(renderer),
        room = new RoomEnvironment();
      const restored = generator.fromScene(room, 0.04);
      room.dispose();
      generator.dispose();
      this.restoredEnvironment = restored;
      this.scene.environment = restored.texture;
      this.restoreEnvironment = false;
    }
    const aspect = spaceCamera.aspect,
      exposure = renderer.toneMappingExposure;
    spaceCamera.aspect = 16 / 9;
    spaceCamera.updateProjectionMatrix();
    renderer.setRenderTarget(this.screen);
    this.screenRetired=false;
    renderer.clear();
    renderer.render(space, spaceCamera);
    spaceCamera.aspect = aspect;
    spaceCamera.updateProjectionMatrix();
    renderer.setRenderTarget(null);
    const size = renderer.getSize(new THREE.Vector2());
    this.camera.aspect = size.x / size.y;
    this.camera.updateProjectionMatrix();
    this.controls.update(dt);
    renderer.toneMappingExposure = 1.08;
    renderer.render(this.scene, this.camera);
    renderer.toneMappingExposure = exposure;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    this.canvas.removeEventListener("webglcontextlost",this.onContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored,
    );
    this.controls.dispose();
    if(!this.screenRetired){this.screen.dispose();this.screenRetired=true;}
    this.restoredEnvironment?.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.DirectionalLight) o.shadow.dispose();
    });
    this.disposeMeshes(this.scene);
    this.scene.clear();
  }
  private disposeMeshes(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      geometries.add(o.geometry);
      for (const material of Array.isArray(o.material)
        ? o.material
        : [o.material]) {
        materials.add(material);
        const m = material as THREE.MeshStandardMaterial;
        if (m.map && m.map !== this.screen.texture) textures.add(m.map);
        if (m.emissiveMap) textures.add(m.emissiveMap);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  }
}
