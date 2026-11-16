import {describe,it,expect} from 'vitest';
import {createOperationsLesson} from '../src/transfer/operations-lesson';
import {createOperationsRuntime,getOperationsTelemetry} from '../src/transfer/runtime-v3';
import {solveTransferPlan} from '../src/transfer/planning';
import {commandBitAt,selectGroundEmission} from '../src/transfer/command-link';
import {apertureConeLowerBound,guardCommandReception,trajectorySpeedCertificate} from '../src/transfer/command-guards';
import {bodyBasis,partVisibility} from '../src/sim/assembly';
import {quaternionFromBasis} from '../src/sim/attitude';
import {resolveHardware,getBusDefinition} from '../src/hardware';
import {normalize,sub} from '../src/sim/physics';
import {transferEnvironmentAt} from '../src/transfer/state';

describe('finite-frame conservative guards',()=>{
 const lesson=createOperationsLesson(),solution=solveTransferPlan(lesson.plan);
 it('certifies a global conic/ephemeris speed bound without relying on sampled endpoint speed',()=>{const cert=trajectorySpeedCertificate(solution);expect(cert.certified).toBe(true);expect(cert.maximumSpacecraftSpeedKmS).toBeLessThan(100);expect(cert.maximumStationSpeedKmS).toBeLessThan(40);const forged=structuredClone(solution);forged.trajectory.coast.departureVelocityKmS=[3000,0,0];expect(trajectorySpeedCertificate(forged).certified).toBe(false);});
 it('rejects a half-second actual-pointing interruption even with good first/last attitudes',()=>{
  // Isolated geometry fixture at a real immutable trajectory epoch. This is not
  // evidence of having flown the preceding resource history.
  const state=createOperationsRuntime(solution,lesson.craft),tx=lesson.suggestedCommandAtSeconds,selection=selectGroundEmission(solution,tx).selection!;expect(selection).not.toBeNull();const first=commandBitAt(solution,selection.stationId,tx),last=commandBitAt(solution,selection.stationId,tx+.5),mid=(first.arrivesAtSeconds+last.arrivesAtSeconds)/2,env=transferEnvironmentAt(solution,mid),earth=normalize(sub(first.emitterPositionKm,env.state.heliocentricPositionKm)),good=quaternionFromBasis(bodyBasis(env.targetDirection,env.sunDirection,'earth',earth)),bad=quaternionFromBasis(bodyBasis(env.targetDirection,env.sunDirection,'sun',earth)),interval={start:first.arrivesAtSeconds,end:last.arrivesAtSeconds,startQ:good,midQ:good,endQ:good,receiverPowered:true,transmitterPowered:false};state.time=first.arrivesAtSeconds;
  expect(guardCommandReception(state,selection.stationId,interval.start,interval.end,selection.budget.eirpDbW,interval).valid).toBe(true);
  expect(guardCommandReception(state,selection.stationId,interval.start,interval.end,selection.budget.eirpDbW,{...interval,midQ:bad}).valid).toBe(false);
  expect(guardCommandReception(state,selection.stationId,interval.start,interval.end,selection.budget.eirpDbW,{...interval,receiverPowered:false}).reasonCode).toBe('RECEIVER_OFF');
 });
 it('uses the same aperture rays and refuses to invent visibility under a wide uncertainty cone',()=>{const state=createOperationsRuntime(solution,lesson.craft),h=resolveHardware(state.craft),antenna=h.parts.find(p=>p.part.id===h.antennaId)!.part,forward:[number,number,number]=[0,0,1];expect(apertureConeLowerBound(state.craft,antenna,forward,0)).toBe(partVisibility(state.craft,antenna,forward));expect(apertureConeLowerBound(state.craft,antenna,forward,90)).toBeLessThanOrEqual(partVisibility(state.craft,antenna,forward));});
 it('replaces one selected Iris load with RX/combined table power once, including bus conversion',()=>{
  const state=createOperationsRuntime(solution,lesson.craft);state.time=lesson.listeningWindow.start+500;const listening=getOperationsTelemetry(state);expect(listening.radioMode).toBe('rx');state.packets.push({id:'power-only-fixture',capturedAt:0,bits:1e6,quality:1,transmittedBits:0,receivedBits:0,receivedAt:null});const transmitting=getOperationsTelemetry(state);expect(transmitting.radioMode).toBe('rx-tx');expect(transmitting.loadPowerW-listening.loadPowerW).toBeCloseTo((29-9.1)/getBusDefinition(state.craft).conversionEfficiency,10);state.safeMode=true;expect(getOperationsTelemetry(state).radioMode).toBe('off');expect(getOperationsTelemetry(state).receiverPowered).toBe(false);
 });
});
