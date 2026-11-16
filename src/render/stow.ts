import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { evaluateLaunchPackage, localStowedPartBoxes } from "../sim/launch";
import { getPartGeometry, partTransformFor } from "../hardware";
import type { Design } from "../sim/types";

/** The inspection uses the same authored compact dimensions as the validator.
 * It is an envelope preview, not a certified folding mechanism or deployment animation. */
export function createStowInspection(design: Design): THREE.Group {
  const group = new THREE.Group();
  group.name = "launch-stow-inspection";
  const evaluation = evaluateLaunchPackage(design),
    pkg = evaluation.package;
  const color = evaluation.fitsEnvelope ? 0x8adac1 : 0xf3a07d;
  const fairing = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pkg.fairingDiameterM / 2,
      pkg.fairingDiameterM / 2,
      pkg.fairingHeightM,
      64,
      1,
      true,
    ),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.035,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  fairing.position.y = evaluation.envelope.centerY;
  fairing.raycast = () => {};
  group.add(fairing);
  const boundary = new THREE.Group();
  for (const y of [-0.5, 0.5]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(pkg.fairingDiameterM / 2, 0.008, 6, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = evaluation.envelope.centerY + y * pkg.fairingHeightM;
    boundary.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = (Math.cos(a) * pkg.fairingDiameterM) / 2,
      z = (Math.sin(a) * pkg.fairingDiameterM) / 2;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(
          x,
          evaluation.envelope.centerY - pkg.fairingHeightM / 2,
          z,
        ),
        new THREE.Vector3(
          x,
          evaluation.envelope.centerY + pkg.fairingHeightM / 2,
          z,
        ),
      ]),
      new THREE.LineDashedMaterial({
        color,
        dashSize: 0.05,
        gapSize: 0.05,
        transparent: true,
        opacity: 0.35,
      }),
    );
    line.computeLineDistances();
    boundary.add(line);
  }
  group.add(boundary);
  for (const part of design.parts.filter((p) =>
    ["solar", "solarLarge", "antenna"].includes(p.kind),
  )) {
    const module = new THREE.Group(),
      tr = partTransformFor(design,part);
    const matrix = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...tr.tangentU),
      new THREE.Vector3(...tr.tangentV),
      new THREE.Vector3(...tr.normal),
    );
    module.position.set(...tr.position);
    module.quaternion.setFromRotationMatrix(matrix);
    const boxes = design.hardwareVersion ? getPartGeometry(design,part).stowedBoxes : localStowedPartBoxes(part.kind);
    boxes.forEach((b, i) => {
      const m = new THREE.Mesh(
        new RoundedBoxGeometry(
          b.half[0] * 2,
          b.half[1] * 2,
          b.half[2] * 2,
          2,
          Math.min(.005,...b.half.map(x=>x*.3)),
        ),
        new THREE.MeshStandardMaterial({
          color:
            i === 0 ? 0x25343e : part.kind === "antenna" ? 0xdedecb : 0x234874,
          metalness: 0.55,
          roughness: 0.3,
        }),
      );
      m.position.set(...b.center);
      m.castShadow = true;
      m.receiveShadow = true;
      module.add(m);
      if (i > 0 && part.kind !== "antenna")
        for (let j = 0; j < 4; j++) {
          const edge = new THREE.Mesh(
            new THREE.BoxGeometry(b.half[0] * 1.95, Math.min(.003,b.half[1]*.12), Math.min(.003,b.half[2]*.12)),
            new THREE.MeshStandardMaterial({
              color: 0xaab7b4,
              metalness: 0.65,
              roughness: 0.35,
            }),
          );
          edge.position.set(
            design.hardwareVersion ? b.center[0] : 0,
            design.hardwareVersion ? b.center[1]+b.half[1]*(j/3*1.6-.8) : b.center[1] - b.half[1] + 0.015 + j * 0.05,
            design.hardwareVersion ? b.center[2]+b.half[2]-Math.min(.002,b.half[2]*.2) : b.center[2] + b.half[2] + 0.001,
          );
          module.add(edge);
        }
    });
    group.add(module);
  }
  group.traverse((o) => (o.raycast = () => {}));
  group.userData = {
    fitsEnvelope: evaluation.fitsEnvelope,
    radialMarginM: evaluation.radialMarginM,
    heightMarginM: evaluation.heightMarginM,
    configuration: "authored compact envelope; not deployment mechanics",
  };
  return group;
}

export function disposeStowInspection(group: THREE.Group): void {
  const materials = new Set<THREE.Material>();
  group.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  materials.forEach((m) => m.dispose());
  group.removeFromParent();
  group.clear();
}
