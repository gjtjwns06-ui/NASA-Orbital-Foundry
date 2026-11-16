import * as THREE from 'three';
import { partVisibility, solarGeneration, visibilitySamples } from '../sim/assembly';
import { getPartDefinition, partTransformFor, resolveHardware } from '../hardware';
import type { Design, Part, Vec3 } from '../sim/types';

export type InspectionKind = 'power' | 'camera' | 'antenna';
export interface InspectionSummary { value:number; unit:string; detail:string }
export interface PartInspection {
  partId:string;
  visibility:number;
  incidence:number;
  pointing:boolean;
  powerW?:number;
  connectionReady?:boolean;
  halfAngleDegrees?:number;
  samples:ReturnType<typeof visibilitySamples>;
}

const PALETTE={clear:0x6ce5b3,blocked:0xff736c,limited:0xffc46b,normal:0x81c7ff,target:0xace4ff,sun:0xffd47f};
const v=(p:Vec3)=>new THREE.Vector3(...p);
const tuple=(p:THREE.Vector3):Vec3=>[p.x,p.y,p.z];
const finiteDirection=(p:Vec3):Vec3=>p.every(Number.isFinite)&&Math.hypot(...p)>1e-9?tuple(v(p).normalize()):[1,0,0];
const color=(hex:number)=>new THREE.Color(hex);

/**
 * Workshop-only geometric inspection, in spacecraft body-local metres.
 * Attach group to the craft, without the inertial-to-render coordinate mapping.
 * Power is actual solarGeneration at 1 AU (Earth) / 1.524 AU (Mars), with no eclipse.
 * Camera and antenna values are aperture visibility percentages toward reference
 * directions -Z and +Z, not mission success probabilities or received science.
 * FOV half-angles and all five rays use the same engine geometry as the simulation.
 * Materials/geometries are owned exclusively by this group; no DOM/WebGL is needed.
 */
export function createInspectionOverlay(
  design:Design,
  kind:InspectionKind,
  sunDirectionBody:Vec3=[1,.25,.2],
):{group:THREE.Group;summary:InspectionSummary} {
  const group=new THREE.Group();group.name=`inspection-${kind}`;
  const linePositions:number[]=[],lineColors:number[]=[],pointPositions:number[]=[],pointColors:number[]=[];
  const conePositions:number[]=[],coneColors:number[]=[];
  const records:PartInspection[]=[];
  const sun=finiteDirection(sunDirectionBody),distanceAU=design.missionId==='mars'?1.524:1;
  const target:Vec3=kind==='camera'?[0,0,-1]:kind==='antenna'?[0,0,1]:sun;
  const halfAngle=kind==='camera'?28:kind==='antenna'?12:90;
  const parts=design.parts.filter(p=>kind==='power'?Boolean(getPartDefinition(design,p).outputW):kind==='camera'?p.kind==='camera'||p.kind==='spectrometer':p.kind==='antenna');
  const hardware=design.hardwareVersion?resolveHardware(design):null;

  // All line primitives share one vertex-coloured draw call. The small crosses
  // indicate actual blocked/not-pointing samples, not a fictional impact position.
  function line(a:THREE.Vector3,b:THREE.Vector3,hex:number){
    const c=color(hex);linePositions.push(a.x,a.y,a.z,b.x,b.y,b.z);lineColors.push(c.r,c.g,c.b,c.r,c.g,c.b);
  }
  function marker(at:THREE.Vector3,hex:number){const c=color(hex);pointPositions.push(at.x,at.y,at.z);pointColors.push(c.r,c.g,c.b);}
  function arrow(from:THREE.Vector3,to:THREE.Vector3,hex:number,head=.085){
    line(from,to,hex);const axis=to.clone().sub(from).normalize();
    const side=new THREE.Vector3().crossVectors(axis,Math.abs(axis.y)<.85?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize();
    const base=to.clone().addScaledVector(axis,-head);
    line(to,base.clone().addScaledVector(side,head*.45),hex);line(to,base.addScaledVector(side,-head*.45),hex);
  }
  function cross(at:THREE.Vector3,u:THREE.Vector3,w:THREE.Vector3,hex:number){
    const a=u.clone().add(w).multiplyScalar(.035),b=u.clone().sub(w).multiplyScalar(.035);
    line(at.clone().sub(a),at.clone().add(a),hex);line(at.clone().sub(b),at.clone().add(b),hex);
  }
  function ring(center:THREE.Vector3,u:THREE.Vector3,w:THREE.Vector3,radius:number,hex:number,segments=32){
    const p=(angle:number)=>center.clone().addScaledVector(u,Math.cos(angle)*radius).addScaledVector(w,Math.sin(angle)*radius);
    for(let i=0;i<segments;i++)line(p(i/segments*Math.PI*2),p((i+1)/segments*Math.PI*2),hex);
  }
  function cone(part:Part,origin:THREE.Vector3,hex:number,angle:number){
    const tr=partTransformFor(design,part),axis=v(tr.normal),u=v(tr.tangentU),w=v(tr.tangentV),length=kind==='camera'?1.45:1.8;
    const end=origin.clone().addScaledVector(axis,length),radius=Math.tan(angle*Math.PI/180)*length;
    ring(end,u,w,radius,hex);const c=color(hex),segments=32;
    for(let i=0;i<segments;i++){
      const rim=(j:number)=>end.clone().addScaledVector(u,Math.cos(j/segments*Math.PI*2)*radius).addScaledVector(w,Math.sin(j/segments*Math.PI*2)*radius);
      const a=rim(i),b=rim(i+1);conePositions.push(...origin.toArray(),...a.toArray(),...b.toArray());
      for(let k=0;k<3;k++)coneColors.push(c.r,c.g,c.b);
      if(i%8===0)line(origin,a,hex);
    }
    arrow(origin,end,PALETTE.normal,.09);
  }

  for(const part of parts){
    const definition=getPartDefinition(design,part),angle=kind==='camera'?(definition.optics?.halfAngleDeg??28):kind==='antenna'?(definition.antenna?.halfPowerAngleDeg??12):90;
    const dipole=definition.antenna?.pattern==='crossed-dipole';
    const cosFov=kind==='power'?0:dipole?-1:Math.cos(angle*Math.PI/180);
    const tr=partTransformFor(design,part),samples=visibilitySamples(design,part,target,cosFov);
    const visibility=partVisibility(design,part,target,cosFov),incidence=Math.max(0,v(tr.normal).dot(v(target)));
    const pointing=samples.every(s=>s.pointing);
    const resolved=hardware?.parts.find(p=>p.part.id===part.id);
    const connectionReady=!hardware||(part.kind==='antenna'?hardware.antennaId===part.id:!!resolved?.powered&&!!resolved?.dataConnected);
    const status=visibility<=0||!connectionReady?PALETTE.blocked:visibility<1||kind==='power'&&incidence<.5?PALETTE.limited:PALETTE.clear;
    const record:PartInspection={partId:part.id,visibility,incidence,pointing,samples,connectionReady,halfAngleDegrees:angle};
    if(kind==='power')record.powerW=(definition.outputW||0)*incidence*visibility/(distanceAU*distanceAU);
    records.push(record);
    const center=v(samples[0].origin),u=v(tr.tangentU),w=v(tr.tangentV),normal=v(tr.normal);
    if(kind==='power')arrow(center,center.clone().addScaledVector(normal,.58),PALETTE.normal,.09);
    else if(dipole){
      // Normalized crossed-dipole pattern, not a fictional 90-degree optical cone.
      // Three great-circle sections use the same max(1-u²,1-v²) selection law.
      const bases=[[u,w],[u,normal],[w,normal]];
      for(const [a,b] of bases){let previous:THREE.Vector3|null=null;for(let i=0;i<=48;i++){
        const direction=a.clone().multiplyScalar(Math.cos(i/48*Math.PI*2)).addScaledVector(b,Math.sin(i/48*Math.PI*2));
        const gain=Math.max(1-direction.dot(u)**2,1-direction.dot(w)**2);
        const point=center.clone().addScaledVector(direction,.6*Math.sqrt(Math.max(0,gain)));
        if(previous)line(previous,point,status);previous=point;
      }}
    }else cone(part,center,status,angle);
    for(const sample of samples){
      const origin=v(sample.origin),far=origin.clone().addScaledVector(v(sample.direction),kind==='power'?1.75:1.65);
      const usable=sample.clear&&sample.pointing&&connectionReady;
      const sampleColor=!usable?PALETTE.blocked:visibility<1||kind==='power'&&incidence<.5?PALETTE.limited:PALETTE.clear;
      // Sunlight propagates toward the aperture. Sensor sight-lines point outward.
      if(kind==='power')arrow(far,origin,sampleColor,.065);else arrow(origin,far,sampleColor,.065);
      marker(origin,sampleColor);if(!usable)cross(origin,u,w,PALETTE.blocked);
    }
  }

  if(kind==='power'){
    const at=v(sun).multiplyScalar(2.4);
    const handle=new THREE.Mesh(new THREE.SphereGeometry(.105,16,12),new THREE.MeshBasicMaterial({color:PALETTE.sun,depthTest:false,depthWrite:false}));
    handle.name='inspection-sun-handle';handle.position.copy(at);handle.renderOrder=38;handle.userData.inspectionHandle='sun';group.add(handle);
    const basis=new THREE.Vector3().crossVectors(v(sun),Math.abs(sun[1])<.85?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize(),other=new THREE.Vector3().crossVectors(v(sun),basis).normalize();
    ring(at,basis,other,.165,PALETTE.sun,24);
    for(let i=0;i<8;i++){const d=basis.clone().multiplyScalar(Math.cos(i*Math.PI/4)).addScaledVector(other,Math.sin(i*Math.PI/4));line(at.clone().addScaledVector(d,.205),at.clone().addScaledVector(d,.28),PALETTE.sun);}
    arrow(at.clone().addScaledVector(v(sun),-.34),at.clone().addScaledVector(v(sun),-.78),PALETTE.sun,.1);
  }else{
    const axis=v(target),at=axis.clone().multiplyScalar(2.8);
    const u=new THREE.Vector3(1,0,0),w=new THREE.Vector3(0,1,0);
    ring(at,u,w,.14,PALETTE.target,24);cross(at,u,w,PALETTE.target);
    arrow(axis.clone().multiplyScalar(2.25),at,PALETTE.target,.1);
  }

  if(conePositions.length){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(conePositions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(coneColors,3));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.065,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));
    mesh.name='inspection-fov-volume';mesh.renderOrder=30;mesh.raycast=()=>{};group.add(mesh);
  }
  if(linePositions.length){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(lineColors,3));
    const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.8,depthWrite:false,depthTest:false}));
    lines.name='inspection-rays-normals';lines.renderOrder=35;lines.raycast=()=>{};group.add(lines);
  }
  if(pointPositions.length){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pointPositions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(pointColors,3));
    const points=new THREE.Points(geometry,new THREE.PointsMaterial({vertexColors:true,size:5,sizeAttenuation:false,depthTest:false,depthWrite:false}));
    points.name='inspection-aperture-samples';points.renderOrder=36;points.raycast=()=>{};group.add(points);
  }
  const visibleCount=records.filter(r=>r.visibility>0).length;
  const summary:InspectionSummary=kind==='power'?{
    value:solarGeneration(design,sun,false,distanceAU).powerW,unit:'W',
    detail:parts.length?`${distanceAU} AU · 일식 없음 · ${design.hardwareVersion?'패널별 가중 광선과 EPS 한도를':'입사각과 5개 광선의 가림을'} 반영한 발전량. 태양 손잡이를 움직여 빛의 방향을 바꿉니다.`:'태양전지 날개를 장착하면 실제 입사각과 자기 그림자에 따른 발전량을 확인할 수 있습니다.',
  }:{
    value:Math.max(0,...records.map(r=>r.visibility))*100,unit:'%',
    detail:parts.length?`${kind==='camera'?'관측 기준 −Z':'지구 기준 +Z'} · ${design.hardwareVersion?'장비별 시야/안테나 패턴':`반각 ${halfAngle}°`} · ${visibleCount}/${parts.length}개 장비에서 기준 방향이 보입니다. ${design.hardwareVersion?'최고 기하학적 개구 가시율이며 연결·거리·임무 품질·행성 가림은 별도입니다.':'최고 개구 가시율이며 거리·임무 품질·행성 가림은 별도입니다.'}`:`${kind==='camera'?'관측기':'안테나'}를 장착하면 기준 방향의 시야와 가림을 확인할 수 있습니다.`,
  };
  group.userData={inspectionKind:kind,parts:records,sunDirectionBody:[...sun],targetDirectionBody:[...target],distanceAU,halfAngleDegrees:design.hardwareVersion?null:halfAngle,units:'body-local metres; output W or aperture visibility percent',legend:'초록: 보임 · 노랑: 일부 가림/낮은 입사각 · 빨강/×: 가림 또는 방향 불일치 · 파랑: 장비 법선',assumptions:'Static workshop attitude; no eclipse; reference directions only. New hardware uses per-part halfAngleDegrees/pattern and weighted aperture samples. Per-part powerW is raw geometric generation; summary output also includes bus EPS limits. Lines continue through obstacles to identify the sampled obstruction result, not the intersection distance.'};
  return {group,summary};
}

/** Dispose only the exclusively owned resources created above, then detach. */
export function disposeInspectionOverlay(group:THREE.Group):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.removeFromParent();group.clear();
}
