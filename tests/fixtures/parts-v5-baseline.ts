import * as THREE from "three";
import { t } from "../../src/i18n";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Design, Part, PartKind, Vec3 } from "../../src/sim/types";
import { getBusDefinition, getPartDefinition, getPartGeometry } from "../../src/hardware";

const white = new THREE.MeshStandardMaterial({
  color: 0xe6ece9,
  metalness: 0.32,
  roughness: 0.35,
});
const dark = new THREE.MeshStandardMaterial({
  color: 0x24313b,
  metalness: 0.72,
  roughness: 0.3,
});
const gold = new THREE.MeshStandardMaterial({
  color: 0xd5aa47,
  metalness: 0.85,
  roughness: 0.32,
});
const silver = new THREE.MeshStandardMaterial({
  color: 0xb3c5cc,
  metalness: 0.8,
  roughness: 0.24,
});
const teal = new THREE.MeshStandardMaterial({
  color: 0x3cadad,
  metalness: 0.45,
  roughness: 0.3,
});
const lens = new THREE.MeshPhysicalMaterial({
  color: 0x103f66,
  metalness: 0.45,
  roughness: 0.08,
  clearcoat: 1,
  iridescence: 0.8,
});
const mats = { white, dark, gold, silver, teal, lens };

function mesh(
  g: THREE.BufferGeometry,
  m: THREE.Material,
  p: [number, number, number] = [0, 0, 0],
) {
  const o = new THREE.Mesh(g, m);
  o.position.set(...p);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
function box(
  g: THREE.Group,
  s: [number, number, number],
  p: [number, number, number],
  m = white,
  r = 0.025,
) {
  const o = mesh(new RoundedBoxGeometry(...s, 2, r), m, p);
  g.add(o);
  return o;
}
function cyl(
  g: THREE.Group,
  r: number,
  h: number,
  p: [number, number, number],
  m = silver,
  r2 = r,
) {
  const o = mesh(new THREE.CylinderGeometry(r, r2, h, 32), m, p);
  o.rotation.x = Math.PI / 2;
  g.add(o);
  return o;
}
function bolt(g: THREE.Group, x: number, y: number, z: number) {
  cyl(g, 0.022, 0.018, [x, y, z], silver);
}
function bar(
  g: THREE.Group,
  a: THREE.Vector3,
  b: THREE.Vector3,
  r = 0.015,
  m = silver,
) {
  const d = b.clone().sub(a),
    o = mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), m);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.add(o);
}
let solarMat: THREE.MeshStandardMaterial;
function solarMaterial() {
  if (solarMat) return solarMat;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#122333";
  x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 10; row++)
    for (let col = 0; col < 6; col++) {
      const xx = col * 84 + 4,
        yy = row * 50 + 3;
      const grad = x.createLinearGradient(xx, yy, xx + 80, yy + 46);
      grad.addColorStop(0, "#1a396c");
      grad.addColorStop(0.4, "#245182");
      grad.addColorStop(1, "#0f2a51");
      x.fillStyle = grad;
      x.fillRect(xx, yy, 79, 45);
      x.strokeStyle = "#8ea7bd";
      x.lineWidth = 0.5;
      for (let k = 0; k < 8; k++) {
        x.beginPath();
        x.moveTo(xx + k * 10, yy);
        x.lineTo(xx + k * 10, yy + 45);
        x.stroke();
      }
      x.fillStyle = "#a8c4cc";
      x.fillRect(xx, yy + 21, 79, 1);
    }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return (solarMat = new THREE.MeshStandardMaterial({
    map,
    metalness: 0.52,
    roughness: 0.25,
    side: THREE.DoubleSide,
  }));
}
function foil() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#b19b6d";
  x.fillRect(0, 0, 256, 256);
  let s = 41;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 260; i++) {
    x.strokeStyle = `rgba(${rnd() > 0.5 ? "255,246,193" : "34,28,10"},${rnd() * 0.4})`;
    x.lineWidth = rnd() * 2;
    x.beginPath();
    x.moveTo(rnd() * 256, rnd() * 256);
    x.lineTo(rnd() * 256, rnd() * 256);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  return new THREE.MeshStandardMaterial({
    color: 0xe0b856,
    metalness: 0.86,
    roughness: 0.32,
    bumpMap: t,
    bumpScale: 0.012,
  });
}

// Original, deterministic surface artwork for hardware profiles only. No vendor
// circuit, logo or CAD is reproduced. These CPU-backed maps are shared across
// assemblies/ghosts/renderers and must never be disposed by an individual part.
const hardwareTextures = new Set<THREE.Texture>();
let hardwareSurfaceMaps:{colour:THREE.CanvasTexture;detail:THREE.CanvasTexture}|undefined;
function hardwareMaps() {
  if(hardwareSurfaceMaps)return hardwareSurfaceMaps;
  const paint=(size:number,detail:boolean)=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const context=canvas.getContext('2d')!,tile=size/4;
    for(let index=0;index<16;index++){
      const x=(index%4)*tile,y=Math.floor(index/4)*tile,u=tile/256;
      const rect=(xx:number,yy:number,w:number,h:number,colour:string)=>{context.fillStyle=colour;context.fillRect(x+xx*u,y+yy*u,w*u,h*u);};
      const path=(points:number[][],colour:string,width:number)=>{context.strokeStyle=colour;context.lineWidth=width*u;context.beginPath();points.forEach((p,i)=>{if(i)context.lineTo(x+p[0]*u,y+p[1]*u);else context.moveTo(x+p[0]*u,y+p[1]*u);});context.stroke();};
      rect(0,0,256,256,detail?'#b8b8b8':index===8?'#c8a659':'#24594e');
      if(index===8){
        // Large quiet folds, inset tape seams and a subtle satin grain. The
        // physical foil thickness stays unchanged; bump is sub-millimetre.
        for(let fold=0;fold<8;fold++){
          const p=22+fold*29;
          path([[12,p],[87,p-6],[172,p+4],[244,p-2]],detail?'#ababab':'#c1a05a',2.2);
          path([[12,p+2],[87,p-4],[172,p+6],[244,p]],detail?'#c0c0c0':'#d2b36f',1.3);
        }
        for(const edge of [15,238]){rect(edge,12,4,232,detail?'#8c8c8c':'#dfc993');rect(12,edge,232,3,detail?'#8c8c8c':'#dfc993');}
        for(let n=0;n<26;n++)path([[18+n*8,18],[21+n*8,237]],detail?'#b5b5b5':'#c9a95f',.35);
      }else if(index<8){
        const copper=detail?'#777777':'#b8a05d',ink=detail?'#bcbcbc':'#cfddd2';
        for(let route=0;route<12;route++){
          const start=22+route*18,bend=30+((route*37+index*19)%180),end=38+((route*29+index*23)%177);
          path([[start,223],[start,bend],[end,bend],[end,30]],copper,1.4);
          rect(start-2,220,4,7,copper);rect(end-2,27,4,4,copper);
        }
        for(const edge of [20,234])path([[edge,20],[edge,234]],ink,.8);
        if(index===2||index===3){
          const radius=index===2?28:38;
          for(const [cx,cy] of [[71,174],[185,174],[128,82]])path(Array.from({length:25},(_,i)=>[cx+Math.cos(i/24*Math.PI*2)*radius,cy+Math.sin(i/24*Math.PI*2)*radius]),ink,.9);
          path([[96,203],[160,203],[160,238],[96,238],[96,203]],ink,.8);
        }else{
          const columns=index===4?2:index===5?4:3,width=index===4?78:index===5?40:52;
          for(let chip=0;chip<columns*2;chip++){
            const xx=24+(chip%columns)*(208/columns)+(208/columns-width)/2,yy=34+Math.floor(chip/columns)*124;
            path([[xx,yy+64],[xx,yy],[xx+width,yy],[xx+width,yy+64]],ink,.8);
            for(let pin=0;pin<4;pin++){rect(xx-3,yy+10+pin*12,4,2,copper);rect(xx+width-1,yy+10+pin*12,4,2,copper);}
          }
        }
        if(!detail){context.fillStyle='#e2e8d7';context.font=`600 ${10*u}px monospace`;context.textAlign='left';context.textBaseline='middle';context.fillText(['RADIO A','RADIO B','CTRL A','CTRL B','REC 1','REC 8','POWER','AVIONICS'][index],x+30*u,y+16*u);context.fillText('PWR   DATA   RF',x+31*u,y+244*u);}
      }
    }
    const map=new THREE.CanvasTexture(canvas);map.anisotropy=4;map.name=detail?'original-hardware-surface-detail':'original-hardware-colour-atlas';
    if(!detail)map.colorSpace=THREE.SRGBColorSpace;hardwareTextures.add(map);return map;
  };
  hardwareSurfaceMaps={colour:paint(1024,false),detail:paint(512,true)};return hardwareSurfaceMaps;
}
function atlasUV(geometry:THREE.BufferGeometry,tile:number,frontOnly=false) {
  geometry.computeBoundingBox();const bounds=geometry.boundingBox!,positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
  for(let i=0;i<uv.count;i++){
    const front=!frontOnly||normals.getZ(i)>.5,slot=front?tile:15;
    const u=frontOnly?(positions.getX(i)-bounds.min.x)/Math.max(.000001,bounds.max.x-bounds.min.x):uv.getX(i),v=frontOnly?(positions.getY(i)-bounds.min.y)/Math.max(.000001,bounds.max.y-bounds.min.y):uv.getY(i);
    uv.setXY(i,(slot%4+(8+THREE.MathUtils.clamp(u,0,1)*240)/256)/4,1-(Math.floor(slot/4)+(8+(1-THREE.MathUtils.clamp(v,0,1))*240)/256)/4);
  }
  uv.needsUpdate=true;
}
function hardwareFoil() {
  const maps=hardwareMaps();
  return new THREE.MeshStandardMaterial({map:maps.colour,roughnessMap:maps.detail,bumpMap:maps.detail,bumpScale:.00045,metalness:.76,roughness:.58});
}

/** Static authored hardware batches share material draw calls. Photovoltaic
 * patches remain individual surfaces, and removable bus panels retain their tag. */
function batchHardware(group: THREE.Group) {
  const batches=new Map<string,THREE.Mesh[]>();
  for(const object of [...group.children]) {
    if(!(object instanceof THREE.Mesh)||Array.isArray(object.material)||object.name.startsWith('photovoltaic-patch-'))continue;
    const key=`${object.material.uuid}:${object.userData.bayCover?1:0}`;
    const list=batches.get(key)||[];list.push(object);batches.set(key,list);
  }
  for(const objects of batches.values()) {
    if(objects.length<2)continue;
    const geometries=objects.map(o=>{o.updateMatrix();let geometry=o.geometry.clone().applyMatrix4(o.matrix);if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));return geometry;});
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)continue;
    const merged=mesh(geometry,objects[0].material as THREE.Material);merged.userData={...objects[0].userData};
    for(const object of objects){group.remove(object);object.geometry.dispose();}group.add(merged);
  }
}

export function createBus(design?: Design): THREE.Group {
  if (!design?.hardwareVersion) return createLegacyBus();
  const profile=getBusDefinition(design), group=new THREE.Group();
  group.name='spacecraft-bus';
  const [hx,hy,hz]=profile.halfSize;
  const bay=profile.bay, floor=bay.mountY;
  const width=bay.max[0]-bay.min[0],depth=bay.max[2]-bay.min[2];
  const midX=(bay.max[0]+bay.min[0])/2,midZ=(bay.max[2]+bay.min[2])/2;
  const insulation=hardwareFoil();
  const accent=new THREE.MeshStandardMaterial({color:design.busId==='surveyor-l18-v1'?0x317f83:0xb88a37,metalness:.35,roughness:.4});
  // Authored profile shell is contained by the exact simulation halfSize.
  for(const z of [-hz+.0175,hz-.0175]) {
    box(group,[2*hx-.055,1.03,.028],[0,-.265,z],insulation,.009);
    box(group,[2*hx-.055,.5,.028],[0,.55,z],insulation,.009).userData.bayCover=true;
  }
  for(const x of [-hx+.0175,hx-.0175]) {
    box(group,[.028,1.03,2*hz-.055],[x,-.265,0],insulation,.009);
    box(group,[.028,.5,2*hz-.055],[x,.55,0],insulation,.009).userData.bayCover=true;
  }
  for(const x of [-hx+.025,hx-.025])for(const z of [-hz+.025,hz-.025])box(group,[.05,2*hy,.05],[x,0,z],silver,.008);
  for(const y of [-hy+.025,hy-.025]) {
    box(group,[2*hx,.044,2*hz],[0,y,0],dark,.012).userData.bayCover=y>0;
    box(group,[2*hx-.14,.012,2*hz-.14],[0,y+(y>0?.019:-.019),0],white,.004).userData.bayCover=y>0;
  }
  box(group,[width,.024,depth],[midX,floor-.023,midZ],dark,.006);
  for(const x of [bay.min[0]+.04,bay.max[0]-.04])box(group,[.022,.012,depth*.92],[x,floor-.007,midZ],silver,.003);
  for(const z of [bay.min[2]+.04,bay.max[2]-.04])box(group,[width*.92,.012,.022],[midX,floor-.007,z],silver,.003);
  for(const x of [bay.min[0]-.008,bay.max[0]+.008])box(group,[.012,bay.max[1]-bay.min[1],depth],[x,(bay.min[1]+bay.max[1])/2,midZ],accent,.003);
  for(const z of [-hz+.003,hz-.003]) {
    box(group,[.83,.065,.004],[0,-.56,z],accent,.001);
    for(let n=0;n<6;n++)box(group,[.31,.012,.004],[0,.12-n*.035,z],dark,.001);
  }
  const plaque=makeLabel(design.busId==='surveyor-l18-v1'?'SURVEYOR':'PATHFINDER','#17323b','#e4eae4',256,64);
  plaque.scale.set(.69,.17,1);plaque.position.set(0,-.32,hz-.001);group.add(plaque);
  group.userData={hardwareBusId:design.busId,bayBounds:{min:[...bay.min],max:[...bay.max],mountY:floor},physicalUnits:'metres',originalProceduralModel:true};
  group.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===insulation)atlasUV(o.geometry,8);});
  // Sparse fasteners sit inside the pre-existing shell, and merge into silver.
  for(const z of [-hz+.003,hz-.003])for(const x of [-hx+.09,hx-.09])for(const y of [-hy+.12,.18]) {
    const head=mesh(new THREE.CylinderGeometry(.012,.012,.0025,8),silver,[x,y,z]);head.rotation.x=Math.PI/2;group.add(head);
  }
  batchHardware(group);
  return group;
}

function createLegacyBus() {
  const g = new THREE.Group();
  g.name = "spacecraft-bus";
  const insulation = foil();
  // A real hollow upper service bay: removable upper panels and lid expose
  // modules inside the chassis. The lower avionics compartment stays enclosed.
  for (const z of [-0.63, 0.63]) {
    box(g, [1.23, 1.07, 0.04], [0, -0.265, z], insulation, 0.018);
    box(
      g,
      [1.23, 0.5, 0.04],
      [0, 0.55, z],
      insulation,
      0.018,
    ).userData.bayCover = true;
  }
  for (const x of [-0.63, 0.63]) {
    box(g, [0.04, 1.07, 1.23], [x, -0.265, 0], insulation, 0.018);
    box(
      g,
      [0.04, 0.5, 1.23],
      [x, 0.55, 0],
      insulation,
      0.018,
    ).userData.bayCover = true;
  }
  box(g, [1.2, 0.045, 1.2], [0, 0.19, 0], dark, 0.012);
  for (const x of [-0.44, 0.44])
    box(g, [0.025, 0.018, 1.05], [x, 0.222, 0], silver, 0.005);
  for (const z of [-0.48, 0.48])
    box(g, [1.05, 0.018, 0.025], [0, 0.222, z], silver, 0.005);
  for (const x of [-0.65, 0.65])
    for (const z of [-0.65, 0.65])
      box(g, [0.07, 1.64, 0.07], [x, 0, z], silver, 0.012);
  for (const y of [-0.79, 0.79]) {
    box(g, [1.34, 0.07, 1.34], [0, y, 0], dark, 0.025).userData.bayCover =
      y > 0;
    box(
      g,
      [1.17, 0.035, 1.17],
      [0, y + (y > 0 ? 0.045 : -0.045), 0],
      white,
      0.025,
    ).userData.bayCover = y > 0;
  }
  for (const z of [-0.664, 0.664]) {
    box(g, [0.74, 0.45, 0.024], [0, 0.18, z], white, 0.016);
    for (let i = 0; i < 6; i++)
      box(
        g,
        [0.34, 0.015, 0.025],
        [0, 0.29 - i * 0.042, z + (z > 0 ? 0.02 : -0.02)],
        dark,
        0.001,
      );
    for (const x of [-0.55, 0.55])
      for (const y of [-0.66, 0.64]) bolt(g, x, y, z + (z > 0 ? 0.02 : -0.02));
  }
  const plaque = makeLabel("ORBITAL", "#14343e", "#e6ece9", 256, 64);
  plaque.position.set(0, -0.36, 0.685);
  plaque.scale.set(0.69, 0.17, 1);
  g.add(plaque);
  for (const x of [-0.43, 0.43]) {
    const r = mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 16), silver, [
      x,
      0.84,
      0,
    ]);
    r.rotation.x = Math.PI / 2;
    g.add(r);
  }
  return g;
}

function createLegacyPart(kind: PartKind): THREE.Group {
  const g = new THREE.Group();
  g.name = kind;
  box(g, [0.2, 0.2, 0.075], [0, 0, 0.038], dark, 0.018);
  if (kind === "solar" || kind === "solarLarge") {
    const w = kind === "solarLarge" ? 1.35 : 0.91,
      h = kind === "solarLarge" ? 1.8 : 1.15;
    cyl(g, 0.065, 0.32, [0, 0, 0.2], silver);
    box(g, [w + 0.07, h + 0.07, 0.055], [0, 0, 0.39], silver, 0.016);
    const panel = mesh(
      new THREE.PlaneGeometry(w, h),
      solarMaterial(),
      [0, 0, 0.422],
    );
    g.add(panel);
    box(g, [w, 0.026, 0.025], [0, 0, 0.44], dark, 0.001);
    for (const xx of [-w / 2, w / 2])
      for (const yy of [-h / 2, h / 2]) bolt(g, xx, yy, 0.43);
    bar(
      g,
      new THREE.Vector3(-w * 0.4, -h * 0.35, 0.34),
      new THREE.Vector3(0, 0, 0.08),
    );
    bar(
      g,
      new THREE.Vector3(w * 0.4, h * 0.35, 0.34),
      new THREE.Vector3(0, 0, 0.08),
    );
  } else if (kind === "antenna") {
    cyl(g, 0.07, 0.28, [0, 0, 0.18], dark);
    const verts: number[] = [],
      idx: number[] = [];
    const rings = 16,
      segs = 64,
      r = 0.52;
    for (let j = 0; j <= rings; j++)
      for (let i = 0; i <= segs; i++) {
        const rr = (r * j) / rings,
          a = (i / segs) * Math.PI * 2;
        verts.push(
          rr * Math.cos(a),
          rr * Math.sin(a),
          0.3 + 0.29 * (rr / r) ** 2,
        );
      }
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segs; i++) {
        const a = j * (segs + 1) + i,
          b = a + segs + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const dishmat = white.clone();
    dishmat.side = THREE.DoubleSide;
    g.add(mesh(geo, dishmat));
    g.add(
      mesh(new THREE.TorusGeometry(r, 0.015, 10, 64), silver, [0, 0, 0.59]),
    );
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      bar(
        g,
        new THREE.Vector3(Math.cos(a) * 0.47, Math.sin(a) * 0.47, 0.55),
        new THREE.Vector3(0, 0, 0.93),
        0.012,
        gold,
      );
    }
    cyl(g, 0.058, 0.12, [0, 0, 0.9], gold);
    cyl(g, 0.024, 0.06, [0, 0, 0.99], dark);
  } else if (kind === "camera" || kind === "spectrometer") {
    box(
      g,
      [0.38, 0.38, 0.32],
      [0, 0, 0.19],
      kind === "camera" ? white : gold,
      0.04,
    );
    cyl(g, 0.19, 0.2, [0, 0, 0.41], dark);
    cyl(g, 0.16, 0.08, [0, 0, 0.53], silver);
    cyl(g, 0.142, 0.018, [0, 0, 0.58], lens);
    g.add(
      mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 40), dark, [0, 0, 0.595]),
    );
    const glint = mesh(
      new THREE.CircleGeometry(0.045, 24),
      new THREE.MeshBasicMaterial({
        color: 0x80d7e9,
        transparent: true,
        opacity: 0.35,
      }),
      [-0.05, 0.04, 0.592],
    );
    g.add(glint);
    if (kind === "spectrometer") {
      box(g, [0.15, 0.27, 0.28], [0.27, 0, 0.18], dark);
      for (let i = 0; i < 5; i++)
        box(
          g,
          [0.18, 0.014, 0.29],
          [0.27, -0.1 + i * 0.05, 0.18],
          silver,
          0.003,
        );
    }
  } else if (kind === "engine") {
    cyl(g, 0.19, 0.22, [0, 0, 0.15], gold);
    cyl(g, 0.1, 0.14, [0, 0, 0.31], dark);
    const pts = [
      new THREE.Vector2(0.095, 0),
      new THREE.Vector2(0.08, 0.06),
      new THREE.Vector2(0.1, 0.13),
      new THREE.Vector2(0.17, 0.25),
      new THREE.Vector2(0.26, 0.36),
    ];
    const o = mesh(
      new THREE.LatheGeometry(pts, 40),
      new THREE.MeshStandardMaterial({
        color: 0x61727c,
        metalness: 0.9,
        roughness: 0.29,
        side: THREE.DoubleSide,
      }),
      [0, 0, 0.36],
    );
    o.rotation.x = Math.PI / 2;
    g.add(o);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      bar(
        g,
        new THREE.Vector3(0.15 * Math.cos(a), 0.15 * Math.sin(a), 0.15),
        new THREE.Vector3(0.24 * Math.cos(a), 0.24 * Math.sin(a), 0.69),
        0.013,
        gold,
      );
    }
  } else if (kind === "battery") {
    box(g, [0.42, 0.33, 0.29], [0, 0, 0.19], dark, 0.025);
    for (let i = 0; i < 3; i++)
      box(g, [0.1, 0.26, 0.24], [-0.13 + i * 0.13, 0, 0.2], teal, 0.02);
    box(g, [0.4, 0.035, 0.3], [0, 0, 0.19], silver, 0.005);
  } else if (kind === "storage") {
    box(g, [0.35, 0.28, 0.18], [0, 0, 0.13], silver, 0.02);
    box(g, [0.29, 0.21, 0.025], [0, 0, 0.235], dark, 0.008);
    for (let i = 0; i < 3; i++)
      box(g, [0.055, 0.035, 0.028], [-0.09 + i * 0.09, 0, 0.252], teal, 0.003);
  } else if (kind === "radiator") {
    box(g, [0.62, 0.83, 0.08], [0, 0, 0.1], white, 0.025);
    for (let i = 0; i < 10; i++)
      box(g, [0.57, 0.025, 0.06], [0, -0.35 + i * 0.075, 0.16], silver, 0.006);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.userData.partModel = true;
  });
  return g;
}

/** A hardware model uses the same local metre boxes/apertures as the validator.
 * Legacy callers deliberately keep their original nine meshes and dimensions. */
export function createPart(part: PartKind | Part, design?: Design): THREE.Group {
  const kind = typeof part === "string" ? part : part.kind;
  if (!design?.hardwareVersion || typeof part === "string") return createLegacyPart(kind);
  const definition = getPartDefinition(design, part);
  const profile = getPartGeometry(design, part);
  const group = new THREE.Group();
  group.name = kind;
  group.userData = { hardwareModelId: part.modelId, geometryProfileId: profile.id, physicalUnits: "metres", originalProceduralModel: true };
  const surfaceMaps=hardwareMaps();
  const board = new THREE.MeshStandardMaterial({ map:surfaceMaps.colour,roughnessMap:surfaceMaps.detail,roughness:.82,metalness:.2 });
  const boardTile=part.modelId?.startsWith('ax100')?0:part.modelId?.startsWith('iris')?1:part.modelId?.startsWith('xact15')?2:part.modelId?.startsWith('xact50')?3:part.modelId==='recorder-1p6-v2'?4:5;
  const ink = new THREE.MeshStandardMaterial({ color: 0x0d1921, roughness: .55, metalness: .1 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb6965a, roughness: .3, metalness: .85 });
  // Every detail stays inside its authored mechanical box. Detail dimensions
  // below are visual proportions, never replacements for physical dimensions.
  const block = (center: Vec3, half: Vec3, material: THREE.Material, inset = 0) => {
    const size = half.map(h => Math.max(.0002, 2 * h - inset * 2)) as Vec3;
    return box(group, size, center, material as THREE.MeshStandardMaterial, Math.min(...size) * .12);
  };
  const shapeBoxes = profile.deployedBoxes;
  const surfaces = profile.apertures;
  for (let index = 0; index < shapeBoxes.length; index++) {
    const b = shapeBoxes[index], [hx, hy, hz] = b.half, [cx, cy, cz] = b.center;
    const top = cz + hz;
    const tiny = Math.min(hx, hy, hz) < .006;
    const localSurfaces = surfaces.filter(a => a.width<=hx*2.05 && a.height<=hy*2.05 && Math.abs(a.center[0] - cx) <= hx + .001 && Math.abs(a.center[1] - cy) <= hy + .001 && Math.abs(a.center[2] - top) < Math.max(.04, hz));
    if (kind === "solar" || kind === "solarLarge") {
      if(localSurfaces.length) block([cx,cy,cz-hz*.18],[hx,hy,hz*.8],silver);
      else block(b.center,b.half,dark);
      for (const a of localSurfaces) {
        const width = Math.min(a.width, hx * 1.94), height = Math.min(a.height, hy * 1.94);
        const panel = mesh(new THREE.PlaneGeometry(width, height), solarMaterial(), [a.center[0], a.center[1], top - .0002]);
        panel.name = `photovoltaic-patch-${group.children.length}`;
        panel.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), new THREE.Vector3(...a.normal).normalize());
        group.add(panel);
        // Rails and hinge marks are inset into the common collision volume.
        for (const x of [-1, 1]) box(group, [Math.min(.008, hx*.04), hy*1.8, Math.min(.004, hz)], [cx + x*hx*.97,cy,top - Math.min(.002,hz*.5)], dark, .0005);
      }
    } else if (kind === "radio" || kind === "adcs") {
      if (tiny) { block(b.center,b.half,silver); continue; }
      // Original carrier assembly: visible PCB, standoffs and mounted devices.
      // Published electronics dimensions and authored carrier dimensions remain separate upstream.
      block([cx,cy,cz-hz*.88],[hx,hy,hz*.12],silver);
      const levels = kind === "radio" && part.modelId?.includes("iris") ? 3 : 1;
      for (let level=0;level<levels;level++) {
        const z = cz-hz*.62 + level*hz*.48;
        const pcb=block([cx,cy,z],[hx*.91,hy*.91,Math.min(.0012,hz*.06)],board);atlasUV(pcb.geometry,boardTile,true);
        if(level===0)for (const xx of [-1,1]) for(const yy of [-1,1]) {
          const screw = mesh(new THREE.CylinderGeometry(Math.min(hx,hy)*.065,Math.min(hx,hy)*.065,hz*1.6,10),gold,[cx+xx*hx*.83,cy+yy*hy*.83,cz]);
          screw.rotation.x=Math.PI/2; group.add(screw);
        }
        if(kind === "adcs") {
          for(let wheel=0;wheel<3;wheel++) {
            const x=cx+(wheel===0?-.43:wheel===1?.43:0)*hx;
            const y=cy+(wheel===2?.35:-.32)*hy;
            const radius=Math.min(hx,hy,hz)*.42,thickness=radius*.55;
            const axis=wheel===0?new THREE.Vector3(1,0,0):wheel===1?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
            const center=new THREE.Vector3(x,y,cz+hz*.05);
            const rotor=mesh(new THREE.CylinderGeometry(radius,radius,thickness,24),dark);
            rotor.position.copy(center);rotor.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);group.add(rotor);
            for(const side of [-1,1]) {
              const cap=mesh(new THREE.CircleGeometry(radius*.76,24),silver);
              cap.position.copy(center).addScaledVector(axis,side*(thickness*.5+.0001));cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis.clone().multiplyScalar(side));group.add(cap);
            }
          }
          box(group,[hx*.45,hy*.32,hz*.25],[cx,cy-hy*.7,z+hz*.23],ink,.001);
        } else {
          for(let row=0;row<2;row++) for(let col=0;col<3;col++) {
            box(group,[hx*.34,hy*.45,hz*.23],[cx+(col-1)*hx*.54,cy+(row-.5)*hy*.9,z+hz*.16],col===2?silver:ink,.001);
          }
          for(let pin=0;pin<7;pin++) box(group,[hx*.09,hy*.08,hz*.12],[cx+(pin-3)*hx*.22,cy-hy*.91,z+hz*.12],copper,.0003);
        }
      }
    } else if (kind === "battery") {
      block([cx,cy,cz-hz*.2],[hx,hy,hz*.8],dark);
      const cells=part.modelId?.includes("dual")?4:2;
      for(let cell=0;cell<cells;cell++) {
        const width=hx*1.72/cells;
        box(group,[width*.9,hy*1.67,hz*.18],[cx-hx*.86+width*(cell+.5),cy,top-hz*.1],teal,Math.min(width,hy)*.07);
      }
      for(const y of [-.72,.72])box(group,[hx*1.94,hy*.08,hz*.2],[cx,cy+y*hy,top-hz*.11],silver,.0005);
      box(group,[hx*.32,hy*.13,hz*.12],[cx+hx*.55,cy+hy*.86,top-hz*.15],gold,.0005);
    } else if(kind === "storage") {
      block([cx,cy,cz-hz*.2],[hx,hy,hz*.8],silver);
      const pcb=block([cx,cy,top-hz*.16],[hx*.9,hy*.85,hz*.12],board);atlasUV(pcb.geometry,boardTile,true);
      const columns=part.modelId==='recorder-1p6-v2'?2:4;
      for(let col=0;col<columns;col++)for(let row=0;row<2;row++)box(group,[hx*1.5/columns,hy*.55,hz*.08],[cx+(col-(columns-1)/2)*hx*1.7/columns,cy+(row-.5)*hy*.9,top-hz*.07],ink,.0008);
      for(let pin=0;pin<8;pin++)box(group,[hx*.13,hy*.07,hz*.08],[cx+(pin-3.5)*hx*.22,cy-hy*.9,top-hz*.1],gold,.0003);
    } else if(kind === "camera" || kind === "spectrometer") {
      if(!localSurfaces.length) { block(b.center,b.half,kind === "spectrometer" ? gold : white); continue; }
      block([cx,cy,cz-hz*.37],[hx,hy,hz*.63],kind === "spectrometer"?gold:white);
      const a=localSurfaces[0], radius=Math.min(a.width,a.height,hx*1.8,hy*1.8)/2;
      const barrelMaterial=dark.clone();barrelMaterial.side=THREE.DoubleSide;
      const barrel=mesh(new THREE.CylinderGeometry(Math.min(hx,hy)*.92,Math.min(hx,hy)*.92,hz*.83,32,1,true),barrelMaterial,[cx,cy,top-hz*.44]);barrel.rotation.x=Math.PI/2;group.add(barrel);
      const rim=mesh(new THREE.CylinderGeometry(radius*1.08,radius*1.08,hz*.16,32,1,true),silver,[a.center[0],a.center[1],top-hz*.1]);rim.rotation.x=Math.PI/2;group.add(rim);
      // Entrance aperture remains at its descriptor plane. The visible glass
      // sits behind it, with inward rings giving depth without narrowing the
      // declared opening or adding a transmission/refraction render pass.
      const glassMaterial=lens.clone();glassMaterial.color.setHex(0x0a3049);glassMaterial.roughness=.12;
      const glass=mesh(new THREE.CircleGeometry(radius,48),glassMaterial,[a.center[0],a.center[1],top-hz*.24]);glass.name='recessed-optical-glass';group.add(glass);
      for(let ring=0;ring<2;ring++) {
        const retaining=mesh(new THREE.RingGeometry(radius,radius*(ring===0?1.08:1.045),32),ring===0?silver:barrelMaterial,[a.center[0],a.center[1],top-hz*(ring===0?.018:.13)]);group.add(retaining);
      }
      for(const xx of [-.76,.76])for(const yy of [-.76,.76]){
        const fastener=mesh(new THREE.CylinderGeometry(Math.min(hx,hy)*.035,Math.min(hx,hy)*.035,.0012,8),silver,[cx+xx*hx,cy+yy*hy,cz+hz*.265]);fastener.rotation.x=Math.PI/2;group.add(fastener);
      }
      for(let rib=0;rib<4;rib++)box(group,[hx*.09,hy*1.85,hz*.73],[cx+(rib-1.5)*hx*.5,cy,cz-hz*.3],silver,.001);
    } else if(kind === "antenna") {
      if(part.modelId?.includes("dipole")) { block(b.center,b.half,index===0?dark:silver); continue; }
      if(hx < .15 || hy < .15) { block(b.center,b.half,index===0?dark:gold);continue; }
      const vertices:number[]=[],indices:number[]=[],rings=12,segments=48,radius=Math.min(hx,hy)*.97;
      for(let row=0;row<=rings;row++)for(let col=0;col<=segments;col++) {
        const r=radius*row/rings,angle=col/segments*Math.PI*2;
        vertices.push(cx+r*Math.cos(angle),cy+r*Math.sin(angle),cz-hz*.85+hz*1.7*(r/radius)**2);
      }
      for(let row=0;row<rings;row++)for(let col=0;col<segments;col++) {const a=row*(segments+1)+col,c=a+segments+1;indices.push(a,c,a+1,c,c+1,a+1);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      const material=white.clone();material.side=THREE.DoubleSide;group.add(mesh(geometry,material));
      const rim=mesh(new THREE.TorusGeometry(radius,Math.min(.007,hz*.1),8,48),silver,[cx,cy,cz+hz*.85]);group.add(rim);
    } else if(kind === "engine") {
      const radius=Math.min(hx,hy)*.92;
      const points=[new THREE.Vector2(radius*.32,-hz*.92),new THREE.Vector2(radius*.25,-hz*.55),new THREE.Vector2(radius*.42,hz*.05),new THREE.Vector2(radius*.7,hz*.55),new THREE.Vector2(radius,hz*.95)];
      const material=dark.clone();material.side=THREE.DoubleSide;
      const nozzle=mesh(new THREE.LatheGeometry(points,32),material,b.center);nozzle.rotation.x=Math.PI/2;group.add(nozzle);
      cyl(group,radius*.55,hz*.22,[cx,cy,cz-hz*.8],gold);
    } else block(b.center,b.half,white);
  }
  // Dispose unused owned materials; used materials are owned by the resulting model.
  const used=new Set<THREE.Material>();
  group.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.partModel=true;for(const m of Array.isArray(o.material)?o.material:[o.material])used.add(m);}});
  for(const material of [board,ink,copper])if(!used.has(material))material.dispose();
  group.userData.displayName=definition.nameEn;
  batchHardware(group);
  return group;
}

export function makeLabel(
  text: string,
  fg = "#d8f6f4",
  bg = "transparent",
  width = 256,
  height = 64,
) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const x = c.getContext("2d")!;
  if (bg !== "transparent") {
    x.fillStyle = bg;
    x.fillRect(0, 0, width, height);
  }
  x.fillStyle = fg;
  x.font = `600 ${height * 0.52}px Bahnschrift, sans-serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(t(text), width / 2, height / 2);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
}
export function isSharedPartMaterial(material: THREE.Material): boolean {
  return (
    Object.values(mats).includes(material as THREE.MeshStandardMaterial) ||
    material === solarMat
  );
}
export function isSharedPartTexture(texture: THREE.Texture): boolean {
  return (!!solarMat && texture === solarMat.map)||hardwareTextures.has(texture);
}
export { mats };
