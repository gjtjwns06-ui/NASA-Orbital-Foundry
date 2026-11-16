import * as THREE from 'three';
import { getPartGeometry, partTransformFor } from '../hardware';
import type { Design, Vec3 } from '../sim/types';

export type SolarViewMode = 'map' | 'chase' | 'instrument';
export type ScienceSensor = 'camera' | 'spectrometer';
export interface SolarEncounterFrame {
  positionKm: Vec3;
  velocityKmS: Vec3;
  rangeKm: number;
  altitudeKm: number;
  elapsedSeconds: number;
  progress?: number;
  sunDirectionBody: Vec3;
}
export interface SolarFeatureVisual {
  id: string;
  positionBodyKm: Vec3;
  radiusKm: number;
}
export interface InstrumentPose {
  positionKm: Vec3;
  boresightBody: Vec3;
  /** Alias consumed by the pure observation model. */
  aimDirection: Vec3;
  upBody: Vec3;
  fovDeg: number;
  angularRateDegS: number;
  partId: string;
  sensor: ScienceSensor;
}
export interface InstrumentMount {
  partId: string;
  sensor: ScienceSensor;
  apertureM: THREE.Vector3;
  normal: THREE.Vector3;
  up: THREE.Vector3;
}
export const vectorTuple = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];

/** Uses the very same physical aperture and mounting basis as assembly. */
export function instrumentMounts(design: Design): InstrumentMount[] {
  return design.parts.filter(part => part.kind === 'camera' || part.kind === 'spectrometer').flatMap(part => {
    const aperture = getPartGeometry(design, part).apertures[0];
    if (!aperture) return [];
    const mount = partTransformFor(design, part);
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(...mount.tangentU), new THREE.Vector3(...mount.tangentV), new THREE.Vector3(...mount.normal));
    return [{
      partId: part.id,
      sensor: part.kind as ScienceSensor,
      apertureM: new THREE.Vector3(...aperture.center).applyMatrix4(basis).add(new THREE.Vector3(...mount.position)),
      normal: new THREE.Vector3(...aperture.normal).transformDirection(basis),
      up: new THREE.Vector3(...mount.tangentV).normalize(),
    }];
  });
}

export function instrumentPose(mount: InstrumentMount, attitude: THREE.Quaternion, positionKm: Vec3, fovDeg: number, angularRateDegS: number): InstrumentPose {
  const aim = vectorTuple(mount.normal.clone().applyQuaternion(attitude).normalize());
  return {
    positionKm: vectorTuple(mount.apertureM.clone().multiplyScalar(.001).applyQuaternion(attitude).add(new THREE.Vector3(...positionKm))),
    boresightBody: aim,
    aimDirection: [...aim],
    upBody: vectorTuple(mount.up.clone().applyQuaternion(attitude).normalize()),
    fovDeg,
    angularRateDegS,
    partId: mount.partId,
    sensor: mount.sensor,
  };
}

/** Point the mounted lens at a body, preserving a stable up basis. */
export function aimAttitude(mount: InstrumentMount, direction: THREE.Vector3): THREE.Quaternion {
  const n = direction.clone().normalize();
  const up = Math.abs(n.y) > .98 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const right = up.clone().cross(n).normalize();
  const desiredUp = n.clone().cross(right).normalize();
  const sourceRight = mount.up.clone().cross(mount.normal).normalize();
  const sourceUp = mount.normal.clone().cross(sourceRight).normalize();
  const source = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(sourceRight, sourceUp, mount.normal));
  const desired = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, desiredUp, n));
  return desired.multiply(source.invert());
}
