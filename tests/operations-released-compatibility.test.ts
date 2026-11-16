import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import manifest from './fixtures/operations-released-source-manifest.json';
import {createDesign} from '../src/sim/catalog';
import {createHardwareTransferDesign} from '../src/hardware';
import {createTransferPlan,solveTransferPlan} from '../src/transfer/planning';
import {createTransferRuntime,advanceTransfer} from '../src/transfer/runtime';
import {createTransferEngineRuntime,advanceTransferEngine} from '../src/transfer/engine';
describe('released model preservation',()=>{
 it('keeps every captured numerical/resource/catalogue input byte unchanged',()=>{for(const [file,sha] of Object.entries(manifest.files))expect(createHash('sha256').update(readFileSync(file)).digest('hex'),file).toBe(sha);});
 it('dispatches old profiles to unchanged engines without adding command state',()=>{const solution=solveTransferPlan(createTransferPlan());for(const craft of [createDesign('mars','balanced'),createHardwareTransferDesign('balanced')]){const direct=createTransferRuntime(solution,craft),facade=createTransferEngineRuntime(solution,craft);advanceTransfer(direct,1200);advanceTransferEngine(facade,1200);expect(facade).toEqual(direct);expect(facade).not.toHaveProperty('operations');}});
});
