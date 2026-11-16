import {it,expect} from 'vitest';
import {createHardwareTransferDesign,HARDWARE_TRANSFER_MODEL_VERSION} from '../src/hardware';
import {createHardwareTransferPlan,solveTransferPlan,evaluateEscapeStage} from '../src/transfer/planning';
import {previewTransfer} from '../src/transfer/runtime';

it('both hardware journey presets return actual emitted, propagated and received science',()=>{
 for(const preset of ['balanced','science'] as const){const craft=createHardwareTransferDesign(preset),solution=solveTransferPlan(createHardwareTransferPlan(preset)),launch=evaluateEscapeStage(solution,craft),{state,result}=previewTransfer(solution,craft);expect(launch.launchable).toBe(true);expect(launch.budget).toBe(760);expect(state.modelVersion).toBe(HARDWARE_TRANSFER_MODEL_VERSION);expect(result.status).toBe('success');expect(result.received).toBeGreaterThanOrEqual(3);expect(state.energyMinimumWh).toBeGreaterThan(0);for(const p of state.packets.filter(p=>p.receivedAt!==null)){expect(p.receivedAt!).toBeGreaterThan(p.readyAt??p.capturedAt);expect(p.receivedBits).toBeCloseTo(p.bits,5);expect(p.transmittedBits).toBeCloseTo(p.bits,5);}expect(state.fuelKg).toBe(6);}
},120000);

it('hardware cruise grid 300/600 s preserves science and bounded battery energy',()=>{
 const craft=createHardwareTransferDesign(),solution=solveTransferPlan(createHardwareTransferPlan()),a=previewTransfer(solution,craft,300),b=previewTransfer(solution,craft,600);expect(a.result.status).toBe('success');expect(a.state.packets).toEqual(b.state.packets);expect(Math.abs(a.state.energyMinimumWh-b.state.energyMinimumWh)).toBeLessThan(.2);expect(Math.abs(a.state.energyWh-b.state.energyWh)).toBeLessThan(.2);
},120000);
