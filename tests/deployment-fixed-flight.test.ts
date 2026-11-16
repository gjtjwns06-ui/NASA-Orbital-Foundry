import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createDeploymentCraft} from '../src/deployment/craft';
import {createDeploymentPlan} from '../src/deployment/plan';
import {advanceDeployment,createDeploymentRuntime,getDeploymentResult} from '../src/deployment/runtime';
import {makeDeploymentSave,serializeDeploymentSave} from '../src/deployment/persistence';
it('the physically fixed larger-fairing alternative earns the same real received commissioning diagnostic',()=>{const craft=createDeploymentCraft('fixed'),plan=createDeploymentPlan(true),s=createDeploymentRuntime(craft,plan);advanceDeployment(s,10800,0);for(let n=0;n<10000&&s.status==='running';n++){const tick=s.tick;advanceDeployment(s,0,500);if(tick===s.tick)throw new Error('stalled');}const result=getDeploymentResult(s),dir='docs/qa/fixed-'+new Date().toISOString().replace(/[:.]/g,'-');mkdirSync(dir,{recursive:true});writeFileSync(dir+'/result.json',JSON.stringify({result,events:s.events},null,2));writeFileSync(dir+'/save.json',serializeDeploymentSave(makeDeploymentSave(craft,plan,s)));expect(result.success,JSON.stringify(result)).toBe(true);expect(result.receivedBits).toBe(16e6);expect(result.motorEnergyJ).toBeLessThan(1128);expect(result.cost).toBeGreaterThan(374);expect(result.massKg).toBeLessThan(49.66);},180000);
