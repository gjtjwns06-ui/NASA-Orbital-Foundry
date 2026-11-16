import {describe,it,expect} from 'vitest';
import {deploymentFlightFacts} from '../src/deployment-ui';
import {createDeploymentCraft} from '../src/deployment/craft';
import {createDeploymentPlan} from '../src/deployment/plan';
import {createDeploymentRuntime,getDeploymentTelemetry,COMMISSIONING_REQUIREMENTS} from '../src/deployment/runtime';

const initial=()=>createDeploymentRuntime(createDeploymentCraft(),createDeploymentPlan());
describe('First Light current facts versus historical report evidence',()=>{
 it('does not turn a recorded stable window into a claim of current power or pointing',()=>{
  const s=initial();s.diagnosticCreatedAt=123;s.solarGoodSeconds=60;
  const t={...getDeploymentTelemetry(s),solarPowerW:0,bodyRateRadS:COMMISSIONING_REQUIREMENTS.maximumBodyRateRadS*2};
  const before=structuredClone(s),f=deploymentFlightFacts(s,t);
  expect(f.reportRecorded).toBe(true);expect(f.stableSeconds).toBe(60);
  expect(f.powerNowMet).toBe(false);expect(f.rotationNowMet).toBe(false);expect(f.complete).toBe(false);expect(s).toEqual(before);
 });
 it('keeps a failed craft failed even if all emitted report bits arrive',()=>{
  const s=initial();s.status='failed';s.diagnosticCreatedAt=123;s.diagnosticReceivedBits=16e6;
  const f=deploymentFlightFacts(s,getDeploymentTelemetry(s));
  expect(f.failed).toBe(true);expect(f.complete).toBe(false);expect(f.receivedBits).toBe(16e6);expect(f.reportRecorded).toBe(true);
 });
 it('uses actual thresholds and safe-mode state independently of historical completion',()=>{
  const s=initial();s.safeMode=true;
  const f=deploymentFlightFacts(s,{...getDeploymentTelemetry(s),solarPowerW:90,loadPowerW:17,bodyRateRadS:-COMMISSIONING_REQUIREMENTS.maximumBodyRateRadS});
  expect(f.powerNowMet).toBe(true);expect(f.rotationNowMet).toBe(true);expect(f.safeMode).toBe(true);expect(f.loadW).toBe(17);expect(f.reportRecorded).toBe(false);expect(f.complete).toBe(false);
 });
});
