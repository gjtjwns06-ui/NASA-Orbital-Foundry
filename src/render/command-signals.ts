import * as THREE from 'three';

/** Geometry-only transport data. Times are elapsed TDB seconds in one flight.
 * Positions are heliocentric ICRF kilometres at each bit's emission/reception.
 * No receipt, installation, ACK-confirmation or command status is inferred here.
 */
export type SignalPositionKm = readonly [number, number, number];
export interface CommandSignalBitDTO {
  readonly emittedAtSeconds: number;
  readonly arrivesAtSeconds: number;
  readonly emitterPositionKm: SignalPositionKm;
  readonly receiverPositionKm: SignalPositionKm;
}
export interface CommandSignalDTO {
  readonly id: string;
  readonly commandId: string;
  readonly kind: 'command' | 'ack';
  readonly firstBit: CommandSignalBitDTO;
  readonly lastBit: CommandSignalBitDTO;
  /** A predicted final bit is never presented as emitted, including stale snapshots. */
  readonly lastBitIsPlanned?: boolean;
}
export interface SignalBitSample {
  /** Only true while this particular bit is in flight: [emission, arrival). */
  readonly inFlight: boolean;
  readonly emitted: boolean;
  readonly progress: number;
  /** Null before emission; exact reception endpoint after arrival. */
  readonly positionKm: SignalPositionKm | null;
}
export interface CommandSignalSample {
  readonly id: string;
  readonly commandId: string;
  readonly kind: 'command' | 'ack';
  /** Entire finite frame: [first emission, last arrival). */
  readonly visible: boolean;
  readonly firstBit: SignalBitSample;
  readonly lastBit: SignalBitSample;
  readonly lastBitIsPlanned: boolean;
}
/** Supply one consistent display-epoch frame/scale for every input position.
 * For example: (p, out) => out.set(p[0]*s, p[2]*s, -p[1]*s).
 * Local views subtract the SAME epoch's body centre from every endpoint.
 */
export type SignalPositionMapper = (positionKm: SignalPositionKm, out: THREE.Vector3) => void;
export const COMMAND_SIGNAL_LIMITS = Object.freeze({
  count: 512,
  idLength: 160,
  elapsedSeconds: 100 * 365.25 * 86400,
  positionKm: 1e12,
  mappedPosition: 1e7,
});

function finite(value: number, limit: number, label: string, positive = false) {
  if (!Number.isFinite(value) || Math.abs(value) > limit || (positive && value < 0))
    throw new Error(`Invalid command-signal ${label}.`);
}
function validateId(value: string) {
  if (typeof value !== 'string' || !value.trim() || value.length > COMMAND_SIGNAL_LIMITS.idLength || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error('Invalid command-signal identifier.');
}
function copyBit(bit: CommandSignalBitDTO): CommandSignalBitDTO {
  if (!bit || typeof bit !== 'object') throw new Error('Invalid command-signal bit.');
  finite(bit.emittedAtSeconds, COMMAND_SIGNAL_LIMITS.elapsedSeconds, 'emission time', true);
  finite(bit.arrivesAtSeconds, COMMAND_SIGNAL_LIMITS.elapsedSeconds, 'arrival time', true);
  if (bit.arrivesAtSeconds <= bit.emittedAtSeconds) throw new Error('Command-signal arrival must follow emission.');
  const position = (value: SignalPositionKm): SignalPositionKm => {
    if (!Array.isArray(value) || value.length !== 3) throw new Error('Invalid command-signal position.');
    for (const coordinate of value) finite(coordinate, COMMAND_SIGNAL_LIMITS.positionKm, 'position');
    return Object.freeze([value[0], value[1], value[2]]) as SignalPositionKm;
  };
  return Object.freeze({
    emittedAtSeconds: bit.emittedAtSeconds,
    arrivesAtSeconds: bit.arrivesAtSeconds,
    emitterPositionKm: position(bit.emitterPositionKm),
    receiverPositionKm: position(bit.receiverPositionKm),
  });
}
function copySignal(signal: CommandSignalDTO): CommandSignalDTO {
  if (!signal || typeof signal !== 'object') throw new Error('Invalid command signal.');
  validateId(signal.id); validateId(signal.commandId);
  if (signal.kind !== 'command' && signal.kind !== 'ack') throw new Error('Invalid command-signal direction.');
  const firstBit = copyBit(signal.firstBit), lastBit = copyBit(signal.lastBit);
  if (signal.lastBitIsPlanned !== undefined && typeof signal.lastBitIsPlanned !== 'boolean')
    throw new Error('Invalid command-signal planned-tail flag.');
  if (lastBit.emittedAtSeconds < firstBit.emittedAtSeconds || lastBit.arrivesAtSeconds < firstBit.arrivesAtSeconds)
    throw new Error('Command-signal first/last bit times are reversed.');
  return Object.freeze({id: signal.id, commandId: signal.commandId, kind: signal.kind, firstBit, lastBit, lastBitIsPlanned: signal.lastBitIsPlanned === true});
}
function sampleBit(bit: CommandSignalBitDTO, elapsedSeconds: number): SignalBitSample {
  if (elapsedSeconds < bit.emittedAtSeconds) return {inFlight: false, emitted: false, progress: 0, positionKm: null};
  const progress = Math.min(1, (elapsedSeconds - bit.emittedAtSeconds) / (bit.arrivesAtSeconds - bit.emittedAtSeconds));
  const positionKm = bit.emitterPositionKm.map((value, axis) => value + (bit.receiverPositionKm[axis] - value) * progress) as [number, number, number];
  return {inFlight: elapsedSeconds < bit.arrivesAtSeconds, emitted: true, progress, positionKm};
}
function sampleUnchecked(signal: CommandSignalDTO, elapsedSeconds: number): CommandSignalSample {
  const firstBit = sampleBit(signal.firstBit, elapsedSeconds);
  const lastBitIsPlanned = signal.lastBitIsPlanned === true;
  const lastBit: SignalBitSample = lastBitIsPlanned
    ? {inFlight: false, emitted: false, progress: 0, positionKm: null}
    : sampleBit(signal.lastBit, elapsedSeconds);
  return {
    id: signal.id, commandId: signal.commandId, kind: signal.kind,
    // Without an emitted final-bit record only the known first-bit boundary is
    // shown. Unknown intermediate bits are not invented from a planned tail.
    visible: lastBitIsPlanned ? firstBit.inFlight : elapsedSeconds >= signal.firstBit.emittedAtSeconds && elapsedSeconds < signal.lastBit.arrivesAtSeconds,
    firstBit, lastBit, lastBitIsPlanned,
  };
}
/** Independent pure sampling helper; callers may use progress for text in static mode. */
export function sampleCommandSignal(signal: CommandSignalDTO, elapsedSeconds: number): CommandSignalSample {
  finite(elapsedSeconds, COMMAND_SIGNAL_LIMITS.elapsedSeconds, 'display time', true);
  return sampleUnchecked(copySignal(signal), elapsedSeconds);
}

interface SignalEntry {
  dto: CommandSignalDTO;
  signature: string;
  group: THREE.Group;
  route: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  first: THREE.Mesh;
  last: THREE.Mesh;
  direction: THREE.Mesh;
}

/** Owns all its GPU resources. Add `.group` to the scene, call update with the
 * authoritative display time, and dispose BEFORE a scene-wide resource traversal.
 * Static/reduced-motion mode shows a fixed direction arrow and path guides only;
 * it deliberately suppresses travelling markers, not physical time or progress.
 * No independent animation clock, flash, synthetic ACK or simulation mutation.
 */
export class CommandSignals {
  readonly group = new THREE.Group();
  private entries = new Map<string, SignalEntry>();
  private disposed = false;
  private firstGeometry = new THREE.OctahedronGeometry(0.075, 0);
  private lastGeometry = new THREE.OctahedronGeometry(0.095, 0);
  private directionGeometry = new THREE.ConeGeometry(0.055, 0.19, 8);
  private styles = {
    command: this.makeStyle(0x77e1d1),
    ack: this.makeStyle(0xf3b56b),
  };
  constructor() {
    this.group.name = 'command-signal-geometry';
    this.group.userData = {presentationOnly: true, timeBasis: 'elapsed TDB seconds', endpoints: 'heliocentric ICRF km', ownsResources: true};
  }
  private makeStyle(color: number) {
    return {
      route: new THREE.LineBasicMaterial({color, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false}),
      first: new THREE.MeshBasicMaterial({color, toneMapped: false}),
      last: new THREE.MeshBasicMaterial({color, wireframe: true, toneMapped: false}),
    };
  }
  private assertAlive() { if (this.disposed) throw new Error('CommandSignals is disposed.'); }
  /** Atomic validation and detached copies; identical snapshots reuse all objects. */
  setSignals(signals: readonly CommandSignalDTO[]) {
    this.assertAlive();
    if (!Array.isArray(signals) || signals.length > COMMAND_SIGNAL_LIMITS.count) throw new Error('Command-signal count exceeds the bounded renderer capacity.');
    const next = new Map<string, {dto: CommandSignalDTO; signature: string}>();
    for (const source of signals) {
      const dto = copySignal(source);
      if (next.has(dto.id)) throw new Error('Duplicate command-signal identifier.');
      next.set(dto.id, {dto, signature: JSON.stringify(dto)});
    }
    for (const [id, entry] of this.entries) if (!next.has(id)) {
      entry.group.removeFromParent(); entry.route.geometry.dispose(); this.entries.delete(id);
    }
    for (const [id, value] of next) {
      const existing = this.entries.get(id);
      if (existing?.signature === value.signature) continue;
      if (existing) {
        existing.dto = value.dto; existing.signature = value.signature;
        this.assignStyle(existing); existing.group.visible = false;
      } else {
        const group = new THREE.Group(); group.name = `signal:${id}`; group.visible = false;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3).setUsage(THREE.DynamicDrawUsage));
        const style = this.styles[value.dto.kind];
        const route = new THREE.LineSegments(geometry, style.route);
        const first = new THREE.Mesh(this.firstGeometry, style.first), last = new THREE.Mesh(this.lastGeometry, style.last), direction = new THREE.Mesh(this.directionGeometry, style.first);
        route.name = 'emission-reception-guides'; first.name = 'first-bit'; last.name = 'last-bit'; direction.name = 'static-direction';
        for (const object of [route, first, last, direction]) object.frustumCulled = false;
        first.visible = last.visible = direction.visible = false;
        group.add(route, first, last, direction); this.group.add(group);
        this.entries.set(id, {dto: value.dto, signature: value.signature, group, route, first, last, direction});
      }
    }
  }
  private assignStyle(entry: SignalEntry) {
    const style = this.styles[entry.dto.kind];
    entry.route.material = style.route; entry.first.material = style.first; entry.last.material = style.last; entry.direction.material = style.first;
  }
  update(elapsedSeconds: number, mapPosition: SignalPositionMapper, options: {reducedMotion?: boolean} = {}): CommandSignalSample[] {
    this.assertAlive();
    finite(elapsedSeconds, COMMAND_SIGNAL_LIMITS.elapsedSeconds, 'display time', true);
    const map = (position: SignalPositionKm) => {
      const out = new THREE.Vector3(NaN, NaN, NaN); mapPosition(position, out);
      for (const value of out.toArray()) finite(value, COMMAND_SIGNAL_LIMITS.mappedPosition, 'mapped position');
      return out;
    };
    // Validate every mapped coordinate before modifying any live GPU buffer.
    const frames = [...this.entries.values()].map(entry => {
      const sample = sampleUnchecked(entry.dto, elapsedSeconds);
      if (!sample.visible) return {entry, sample, endpoints: null, first: null, last: null};
      const endpoints = [entry.dto.firstBit.emitterPositionKm, entry.dto.firstBit.receiverPositionKm, entry.dto.lastBit.emitterPositionKm, entry.dto.lastBit.receiverPositionKm].map(map);
      return {entry, sample, endpoints, first: sample.firstBit.inFlight ? map(sample.firstBit.positionKm!) : null, last: sample.lastBit.inFlight ? map(sample.lastBit.positionKm!) : null};
    });
    for (const {entry, sample, endpoints, first, last} of frames) {
      entry.group.visible = sample.visible;
      if (!endpoints) { entry.first.visible = entry.last.visible = entry.direction.visible = false; continue; }
      const positions = entry.route.geometry.getAttribute('position') as THREE.BufferAttribute;
      endpoints.forEach((point, index) => positions.setXYZ(index, point.x, point.y, point.z)); positions.needsUpdate = true;
      entry.route.geometry.setDrawRange(0, sample.lastBit.emitted ? 4 : 2);
      entry.first.visible = !!first && !options.reducedMotion;
      entry.last.visible = !!last && !options.reducedMotion;
      if (first) entry.first.position.copy(first);
      if (last) entry.last.position.copy(last);
      const axis = endpoints[1].clone().sub(endpoints[0]);
      entry.direction.visible = !!options.reducedMotion && axis.lengthSq() > 0;
      entry.direction.position.copy(endpoints[0]).lerp(endpoints[1], 0.5);
      if (axis.lengthSq() > 0) entry.direction.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
      entry.group.userData = {signalId: sample.id, commandId: sample.commandId, kind: sample.kind, reducedMotion: !!options.reducedMotion, presentationOnly: true};
    }
    return frames.map(frame => frame.sample);
  }
  clear() { this.setSignals([]); }
  /** Includes reusable marker pools even when no signal is currently attached.
   * CPU objects stay owned here; callers may retire their old GL registrations. */
  getContextResources() {
    return {geometries:[this.firstGeometry,this.lastGeometry,this.directionGeometry,...[...this.entries.values()].map(entry=>entry.route.geometry)],
      materials:Object.values(this.styles).flatMap(style=>Object.values(style))};
  }
  dispose() {
    if (this.disposed) return;
    this.group.removeFromParent(); this.clear(); this.disposed = true;
    this.firstGeometry.dispose(); this.lastGeometry.dispose(); this.directionGeometry.dispose();
    for (const style of Object.values(this.styles)) for (const material of Object.values(style)) material.dispose();
  }
}
