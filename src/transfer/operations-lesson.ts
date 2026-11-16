import {createHardwareTransferDesign} from '../hardware';
import {createHardwareTransferPlan,solveTransferPlan} from './planning';
import type {OperationsLesson} from './operations-types';
import {OperationsError} from './operations-codes';
/** Authored training setup; no state/energy/science checkpoint is injected.
 * The one intended manual edit is extending the 100 s observe block's right
 * edge to periapsis + 1800 s, using the existing empty charging gap. */
export function createOperationsLesson(id:'iris-schedule-rescue-v1'='iris-schedule-rescue-v1'):OperationsLesson {
 if(id!=='iris-schedule-rescue-v1')throw new OperationsError('INVALID_INPUT');
 const craft=createHardwareTransferDesign('balanced'),plan=createHardwareTransferPlan('balanced'),solution=solveTransferPlan(plan),peri=solution.periapsisSeconds,start=peri-3600,end=peri+1800;
 const good=structuredClone(plan.operations),observe=good.find(o=>o.kind==='observe')!;
 observe.start=start;observe.end=end;
 const bad=structuredClone(good);bad.find(o=>o.kind==='observe')!.end=start+100;
 const listeningWindow={start:peri-10800,end:start};plan.operations=[{id:'command-listen',kind:'downlink',...listeningWindow},...bad];
 return {id,name:'화성 조우 일정 복구',nameEn:'Repair the encounter schedule',description:'An observation block ends too early. Extend its right edge into the empty charging gap, then uplink the replacement while the preloaded listening window is open.',craft,plan,listeningWindow,suggestedCommandAtSeconds:peri-8200,suggestedPayload:{kind:'replace-schedule',baseRevision:0,replaceFromSeconds:start,operations:good},suggestedExpirySeconds:start};
}
