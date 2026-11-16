/**
 * Single planetary gravity assist, zero-SOI patched-conic planning.
 * Sun-only Lambert legs join at the moving planet's centre. A planet-frame
 * hyperbola rotates v-infinity; these are NOT finite-SOI continuous trajectories,
 * Horizons ephemerides, GMAT validation, or radiation/atmosphere certification.
 * NASA/JSC Copernicus ZSOI parameterization, pp.3–5:
 * https://ntrs.nasa.gov/api/citations/20120001856/downloads/20120001856.pdf
 */
import { add, dot, magnitude, normalize, scale, sub } from '../sim/physics';
import type { OrbitalState, Vec3 } from '../sim/types';
import { DAY_S, hyperbolicLocalStateAt, solveLambert, SUN_MU_KM3_S2 } from '../transfer/math';
import { AU_KM, findDefaultSolarRoute, planSolarRoute, solarBody, solarRouteState, solarState, SOLAR_EPOCH_JD, SOLAR_MAX_JD, SOLAR_MIN_JD } from './model';
import type { SolarBodyId, SolarRoute, SolvedSolarRoute } from './model';

export const ASSIST_MODEL_ID = 'solar-zsoi-single-assist-v1';
export const ASSIST_SPEED_TOLERANCE_KM_S = 1e-5; // 1 cm/s numerical match, not a mission uncertainty.
export const ASSIST_SOURCES = [
  'https://science.nasa.gov/learn/basics-of-space-flight/primer/',
  'https://ntrs.nasa.gov/api/citations/20120001856/downloads/20120001856.pdf',
  'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
] as const;
export type AssistMode = 'unpowered' | 'asymptotic-correction';
export interface AssistRouteRequest {
  origin: SolarBodyId;
  assist: SolarBodyId;
  target: SolarBodyId;
  departureJdTdb: number;
  encounterJdTdb: number;
  arrivalJdTdb: number;
  /** Cannot reduce the model's conservative body-specific exclusion altitude. */
  minFlybyAltitudeKm?: number;
  mode?: AssistMode;
}
export interface AssistGeometry {
  incomingVInfinityKmS: Vec3;
  outgoingVInfinityKmS: Vec3;
  naturalOutgoingVInfinityKmS: Vec3;
  correctionVectorMps: Vec3;
  speedMismatchKmS: number;
  turnAngleRad: number;
  maxTurnAngleRad: number;
  requiredPeriapsisKm: number;
  periapsisAltitudeKm: number;
  minPeriapsisKm: number;
  maxPeriapsisKm: number;
  /** Explicit post-flyby asymptotic correction, NOT a periapsis burn. */
  correctionDeltaVMps: number;
  unpowered: boolean;
  periapsisState: OrbitalState;
}
export interface SolvedAssistRoute extends AssistGeometry {
  status: 'solved';
  modelId: typeof ASSIST_MODEL_ID;
  request: AssistRouteRequest;
  legs: [SolvedSolarRoute, SolvedSolarRoute];
  pointsAu: Vec3[];
  flightDays: number;
  encounterElapsedDays: number;
  departureDeltaVMps: number;
  totalPropulsiveDeltaVMps: number;
  c3Km2S2: number;
  /** Identical departure/arrival dates, identical destination flyby policy. */
  directComparison: SolarRoute;
  /** null if the bounded direct solver could not solve that exact comparison. */
  deltaVSavedMps: number | null;
}
export interface InfeasibleAssistRoute {
  status: 'infeasible';
  modelId: typeof ASSIST_MODEL_ID;
  request: AssistRouteRequest;
  error: string;
  code: string;
}
export type AssistRoute = SolvedAssistRoute | InfeasibleAssistRoute;
export interface AssistSearchRequest {
  origin?: SolarBodyId;
  assist: SolarBodyId;
  target: SolarBodyId;
  departureJdTdb?: number;
  /** Deterministic launch scan, never an assertion of global optimality. */
  departureWindowDays?: number;
  departureStepDays?: number;
  /** Total trip durations; adaptive defaults if omitted. */
  flightDays?: readonly number[];
  minFlybyAltitudeKm?: number;
  requireSavings?: boolean;
}
export interface AssistSearchResult {
  status: 'solved' | 'infeasible';
  route: SolvedAssistRoute | null;
  evaluations: number;
  feasibleCandidates: number;
  /** Best of the existing bounded direct-duration scan at the SAME launch dates
   * searched for assists. Different arrival date; present its duration too. */
  sampledDirectWindowRoute: SolvedSolarRoute | null;
  deltaVSavedVsDirectWindowMps: number | null;
  error?: string;
}
export interface AssistSearchProgress { completed: number; total: number; evaluations: number; feasibleCandidates: number }
export interface AssistSearchOptions { signal?: AbortSignal; onProgress?: (progress: AssistSearchProgress) => void }

class AssistError extends Error { constructor(public code: string, message: string) { super(message); } }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/** Authored conservative exclusions, not scientifically certified safe altitudes. */
export const ASSIST_MIN_ALTITUDE_KM: Readonly<Record<SolarBodyId, number>> = Object.freeze({
  mercury: 300, venus: 1000, earth: 1000, mars: 300, aster: 100,
  jupiter: 100000, saturn: 200000, uranus: 60000, neptune: 60000,
});
export function recommendedAssistBodies(target: SolarBodyId): SolarBodyId[] {
  if (target === 'mercury') return ['venus'];
  if (['saturn', 'uranus', 'neptune'].includes(target)) return ['jupiter'];
  if (target === 'jupiter') return ['venus', 'mars'];
  if (target === 'mars' || target === 'aster') return ['venus'];
  return [];
}
function validateRequest(request: AssistRouteRequest): void {
  const { origin, assist, target, departureJdTdb: t0, encounterJdTdb: t1, arrivalJdTdb: t2 } = request;
  if (new Set([origin, assist, target]).size !== 3 || solarBody(assist).fictional) throw new AssistError('BODIES', '출발·경유·도착 천체는 서로 달라야 하며 스윙바이에는 실제 행성이 필요합니다.');
  if (![t0,t1,t2].every(Number.isFinite) || t0 < SOLAR_MIN_JD || t2 > SOLAR_MAX_JD || t1-t0 < 1 || t2-t1 < 1 || t2-t0 > 7300) throw new AssistError('DATES', '스윙바이 날짜는 출발과 도착 사이, 전체 비행은 20년 이내여야 합니다.');
  if (request.minFlybyAltitudeKm !== undefined && (!Number.isFinite(request.minFlybyAltitudeKm) || request.minFlybyAltitudeKm < 0)) throw new AssistError('ALTITUDE', '유효한 스윙바이 최소 고도를 선택해 주세요.');
  if (request.mode !== undefined && !['unpowered','asymptotic-correction'].includes(request.mode)) throw new AssistError('MODE', '지원하지 않는 스윙바이 모델입니다.');
}
/** Validate incoming/outgoing vectors, not a canned speed/fuel bonus. */
export function evaluateAssistGeometry(assist: SolarBodyId, incoming: Vec3, outgoing: Vec3, mode: AssistMode = 'unpowered', minimumAltitudeKm = ASSIST_MIN_ALTITUDE_KM[assist]): AssistGeometry {
  const body = solarBody(assist), speedIn = magnitude(incoming), speedOut = magnitude(outgoing);
  if (![...incoming,...outgoing,minimumAltitudeKm].every(Number.isFinite) || speedIn < 1e-5 || speedOut < 1e-5 || body.fictional || minimumAltitudeKm < 0) throw new AssistError('GEOMETRY', '유효한 행성 상대 접근 속도가 필요합니다.');
  if (!['unpowered','asymptotic-correction'].includes(mode)) throw new AssistError('MODE', '지원하지 않는 스윙바이 모델입니다.');
  const speedMismatchKmS = speedOut-speedIn;
  if (mode === 'unpowered' && Math.abs(speedMismatchKmS) > ASSIST_SPEED_TOLERANCE_KM_S) throw new AssistError('SPEED_MISMATCH', '진입·이탈 상대 속도가 맞지 않아 무추력 스윙바이를 할 수 없습니다.');
  const turnAngleRad = Math.acos(clamp(dot(incoming,outgoing)/(speedIn*speedOut),-1,1));
  const minPeriapsisKm = body.radiusKm+Math.max(ASSIST_MIN_ALTITUDE_KM[assist],minimumAltitudeKm);
  // Laplace SOI estimate; staying within a quarter is a deliberately conservative
  // scope limit for this local two-body hyperbola, not an N-body guarantee.
  const maxPeriapsisKm = .25*body.aAu*AU_KM*Math.pow(body.muKm3S2/SUN_MU_KM3_S2,.4);
  const maxTurnAngleRad = 2*Math.asin(1/(1+minPeriapsisKm*speedIn*speedIn/body.muKm3S2));
  const requiredPeriapsisKm = body.muKm3S2/(speedIn*speedIn)*(1/Math.sin(turnAngleRad/2)-1);
  if (!Number.isFinite(requiredPeriapsisKm) || requiredPeriapsisKm > maxPeriapsisKm) throw new AssistError('WEAK_ENCOUNTER', '필요한 굴절이 행성의 지원 조우 범위 밖입니다. 경유 날짜를 바꿔 주세요.');
  if (requiredPeriapsisKm < minPeriapsisKm || turnAngleRad > maxTurnAngleRad+1e-12) throw new AssistError('UNSAFE_PERIAPSIS', '이 경로를 꺾으려면 행성에 너무 가까이 지나가야 합니다.');
  const naturalOutgoingVInfinityKmS = scale(outgoing,speedIn/speedOut);
  const correctionVectorMps = scale(sub(outgoing,naturalOutgoingVInfinityKmS),1000);
  // At periapsis, p bisects incoming - outgoing directions and q bisects their
  // sum. These orthogonal axes reconstruct a positive-energy physical hyperbola.
  const S = normalize(incoming), O = normalize(outgoing), p = normalize(sub(S,O)), q = normalize(add(S,O));
  const periapsisState: OrbitalState = { positionKm: scale(p,requiredPeriapsisKm), velocityKmS: scale(q,Math.sqrt(speedIn*speedIn+2*body.muKm3S2/requiredPeriapsisKm)) };
  return { incomingVInfinityKmS: [...incoming], outgoingVInfinityKmS: [...outgoing], naturalOutgoingVInfinityKmS, correctionVectorMps, speedMismatchKmS, turnAngleRad, maxTurnAngleRad, requiredPeriapsisKm, periapsisAltitudeKm: requiredPeriapsisKm-body.radiusKm, minPeriapsisKm, maxPeriapsisKm, correctionDeltaVMps: magnitude(correctionVectorMps), unpowered: Math.abs(speedMismatchKmS) <= ASSIST_SPEED_TOLERANCE_KM_S, periapsisState };
}
export function solveAssistRoute(request: AssistRouteRequest): AssistRoute {
  try {
    validateRequest(request);
    const incoming = planSolarRoute(request.origin,request.assist,request.departureJdTdb,request.encounterJdTdb-request.departureJdTdb);
    const outgoing = planSolarRoute(request.assist,request.target,request.encounterJdTdb,request.arrivalJdTdb-request.encounterJdTdb);
    if (incoming.status !== 'solved' || outgoing.status !== 'solved') throw new AssistError('LEG', incoming.status === 'infeasible' ? incoming.error : outgoing.error!);
    const planetVelocity = solarState(request.assist,request.encounterJdTdb).velocityKmS;
    const geometry = evaluateAssistGeometry(request.assist,sub(incoming.arrivalVelocityKmS,planetVelocity),sub(outgoing.departureVelocityKmS,planetVelocity),request.mode,request.minFlybyAltitudeKm);
    const directComparison = planSolarRoute(request.origin,request.target,request.departureJdTdb,request.arrivalJdTdb-request.departureJdTdb);
    const totalPropulsiveDeltaVMps = incoming.departureDeltaVMps+geometry.correctionDeltaVMps;
    return { ...geometry, status:'solved',modelId:ASSIST_MODEL_ID,request:{...request},legs:[incoming,outgoing],pointsAu:[...incoming.pointsAu,...outgoing.pointsAu.slice(1)],flightDays:request.arrivalJdTdb-request.departureJdTdb,encounterElapsedDays:request.encounterJdTdb-request.departureJdTdb,departureDeltaVMps:incoming.departureDeltaVMps,totalPropulsiveDeltaVMps,c3Km2S2:incoming.c3Km2S2,directComparison,deltaVSavedMps:directComparison.status === 'solved' ? directComparison.departureDeltaVMps-totalPropulsiveDeltaVMps : null };
  } catch (error) {
    return { status:'infeasible',modelId:ASSIST_MODEL_ID,request:{...request},code:error instanceof AssistError ? error.code : 'CALCULATION',error:error instanceof Error ? error.message : '스윙바이 경로를 계산할 수 없습니다.' };
  }
}
/** Sun-only coast playback. At the zero-SOI patch velocity changes by gravity. */
export function assistRouteState(route: SolvedAssistRoute, elapsedDays: number): OrbitalState {
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0 || elapsedDays > route.flightDays) throw new Error('비행 재생 시간이 스윙바이 경로 밖입니다.');
  return elapsedDays <= route.encounterElapsedDays ? solarRouteState(route.legs[0],elapsedDays) : solarRouteState(route.legs[1],elapsedDays-route.encounterElapsedDays);
}
/** Independent local hyperbola for the encounter view. Does not assert finite
 * continuity with the zero-SOI coasts. The correction occurs after this arc. */
export function assistLocalState(route: SolvedAssistRoute, secondsFromPeriapsis: number): OrbitalState {
  if (!Number.isFinite(secondsFromPeriapsis) || Math.abs(secondsFromPeriapsis) > 30*DAY_S) throw new Error('지원하는 근접 통과 시간 밖입니다.');
  return hyperbolicLocalStateAt(route.periapsisState,solarBody(route.request.assist).muKm3S2,secondsFromPeriapsis);
}

interface FastPatch { mismatch: number; incoming: Vec3; outgoing: Vec3 }
function fastPatch(request: AssistRouteRequest): FastPatch | null {
  try {
    const from = solarState(request.origin,request.departureJdTdb), at = solarState(request.assist,request.encounterJdTdb), to = solarState(request.target,request.arrivalJdTdb);
    const first = solveLambert(from.positionKm,at.positionKm,(request.encounterJdTdb-request.departureJdTdb)*DAY_S);
    const second = solveLambert(at.positionKm,to.positionKm,(request.arrivalJdTdb-request.encounterJdTdb)*DAY_S);
    const incoming = sub(first.arrivalVelocityKmS,at.velocityKmS), outgoing = sub(second.departureVelocityKmS,at.velocityKmS);
    return { mismatch:magnitude(outgoing)-magnitude(incoming),incoming,outgoing };
  } catch { return null; }
}
function searchDurations(request: AssistSearchRequest): number[] {
  if (request.flightDays) return [...request.flightDays];
  const outer = solarBody(request.target).aAu;
  return outer > 15 ? [2200,2800,3600,4400,5200,6200,7200] : outer > 5 ? [1000,1400,1800,2200,2800,3600,4400] : [150,220,300,420,560,760,1000];
}
/** Generator keeps deterministic numerical search off the rendering loop. Every
 * yield bounds one launch-day/trip-duration pair; async wrapper yields to UI. */
function* searchSteps(request: AssistSearchRequest): Generator<AssistSearchProgress,AssistSearchResult> {
  const start = request.departureJdTdb ?? SOLAR_EPOCH_JD, window = request.departureWindowDays ?? 720, step = request.departureStepDays ?? 60;
  const durations = searchDurations(request);
  if (![start,window,step].every(Number.isFinite) || window < 0 || window > 3650 || step < 1 || durations.length > 40 || !durations.length || (Math.floor(window/step)+1)*durations.length > 420 || durations.some(d => !Number.isFinite(d) || d < 2 || d > 7300)) return {status:'infeasible',route:null,evaluations:0,feasibleCandidates:0,sampledDirectWindowRoute:null,deltaVSavedVsDirectWindowMps:null,error:'지원하는 탐색 날짜 범위를 선택해 주세요.'};
  let best: SolvedAssistRoute | null = null, evaluations = 0, feasibleCandidates = 0, completed = 0;
  let sampledDirectWindowRoute: SolvedSolarRoute | null = null;
  const total = (Math.floor(window/step)+1)*durations.length;
  const evaluate = (r: AssistRouteRequest) => { evaluations++; return fastPatch(r); };
  for (let offset = 0; offset <= window; offset += step) {
    if (start+offset >= SOLAR_MIN_JD && start+offset < SOLAR_MAX_JD) {
      const direct = findDefaultSolarRoute(request.origin ?? 'earth',request.target,start+offset);
      if (direct.status === 'solved' && (!sampledDirectWindowRoute || direct.departureDeltaVMps < sampledDirectWindowRoute.departureDeltaVMps)) sampledDirectWindowRoute=direct;
    }
    for (const duration of durations) {
      const t0 = start+offset, t2 = t0+duration;
      if (t0 < SOLAR_MIN_JD || t2 > SOLAR_MAX_JD) { yield {completed:++completed,total,evaluations,feasibleCandidates}; continue; }
      const base: AssistRouteRequest = {origin:request.origin ?? 'earth',assist:request.assist,target:request.target,departureJdTdb:t0,encounterJdTdb:t0+duration/2,arrivalJdTdb:t2,minFlybyAltitudeKm:request.minFlybyAltitudeKm,mode:'unpowered'};
      let previous: {t:number;patch:FastPatch} | null = null;
      // The encounter may be early for outer destinations; logarithmically
      // augmented fractions include that region without an unbounded optimizer.
      const fractions = [...new Set([.025,.04,.06,.08,...Array.from({length:37},(_,i)=>.1+i*.025)])].sort((a,b)=>a-b).filter(f=>f<.98);
      for (const fraction of fractions) {
        const t = t0+duration*fraction, patch = evaluate({...base,encounterJdTdb:t});
        if (!patch) { previous=null; continue; }
        if (previous && previous.patch.mismatch*patch.mismatch <= 0) {
          let lo = previous.t, hi = t, lowMismatch = previous.patch.mismatch, root = (lo+hi)/2, found: FastPatch | null = null;
          for (let n=0;n<36;n++) {
            root=(lo+hi)/2; found=evaluate({...base,encounterJdTdb:root}); if (!found) break;
            if (Math.abs(found.mismatch) < ASSIST_SPEED_TOLERANCE_KM_S*.1) break;
            if (lowMismatch*found.mismatch <= 0) hi=root; else {lo=root;lowMismatch=found.mismatch;}
          }
          if (found && Math.abs(found.mismatch) <= ASSIST_SPEED_TOLERANCE_KM_S) {
            try {
              evaluateAssistGeometry(base.assist,found.incoming,found.outgoing,'unpowered',base.minFlybyAltitudeKm);
              // Propagate/snapshot only after the inexpensive vector geometry.
              const solved=solveAssistRoute({...base,encounterJdTdb:root});
              if (solved.status === 'solved') {
                feasibleCandidates++;
                if ((!request.requireSavings || (solved.deltaVSavedMps !== null && solved.deltaVSavedMps > 0)) && (!best || solved.totalPropulsiveDeltaVMps < best.totalPropulsiveDeltaVMps)) best=solved;
              }
            } catch { /* A speed-matching root can still require collision or too weak a turn. */ }
          }
        }
        previous={t,patch};
      }
      yield {completed:++completed,total,evaluations,feasibleCandidates};
    }
  }
  return {status:best ? 'solved':'infeasible',route:best,evaluations,feasibleCandidates,sampledDirectWindowRoute,deltaVSavedVsDirectWindowMps:best && sampledDirectWindowRoute ? sampledDirectWindowRoute.departureDeltaVMps-best.totalPropulsiveDeltaVMps : null,...(!best ? {error:'이 탐색 범위에서 안전한 무추력 스윙바이를 찾지 못했습니다. 출발 시기나 목적지를 바꿔 주세요.'}:{})};
}
/** Suitable for a Worker or CPU tests. Never claim this bounded scan is optimal. */
export function searchAssistRouteSync(request: AssistSearchRequest): AssistSearchResult {
  const iterator=searchSteps(request);let result=iterator.next();while(!result.done)result=iterator.next();return result.value;
}
/** Browser-friendly bounded search, cancellable between date pairs. */
export async function searchAssistRoute(request: AssistSearchRequest, options: AssistSearchOptions = {}): Promise<AssistSearchResult> {
  const iterator=searchSteps(request);
  while(true) {
    if(options.signal?.aborted)throw new DOMException('Assist search cancelled','AbortError');
    const result=iterator.next();if(result.done)return result.value;
    options.onProgress?.(result.value);
    await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
}
