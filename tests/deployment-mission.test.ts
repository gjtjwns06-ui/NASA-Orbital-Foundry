import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {createDeploymentCraft} from '../src/deployment/craft';
import {createDeploymentPlan} from '../src/deployment/plan';
import {advanceDeployment,createDeploymentRuntime,getDeploymentResult,getDeploymentTelemetry} from '../src/deployment/runtime';
import {makeDeploymentSave,serializeDeploymentSave} from '../src/deployment/persistence';
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
it('candidate compact full flight must earn power commissioning and real Earth receipt',()=>{
 const craft=createDeploymentCraft(),plan=createDeploymentPlan(),s=createDeploymentRuntime(craft,plan),trace:unknown[]=[],start=performance.now();advanceDeployment(s,10800,0);
 for(let batch=0;batch<20000&&s.status==='running';batch++){const old=s.tick;advanceDeployment(s,0,500);const t=getDeploymentTelemetry(s);trace.push({time:s.time,tick:s.tick,energyWh:s.energyWh,solarW:t.solarPowerW,loadW:t.loadPowerW,phase:Object.values(s.mechanisms).map(m=>[m.partId,m.phase]),angle:t.attitudeErrorDeg,bodyRate:t.bodyRateRadS,station:t.stationId,elevation:t.environment.ground.find(g=>g.id===t.stationId)!.elevationDeg,linkMarginDb:t.linkMarginDb,received:s.diagnosticReceivedBits,diagnosticAt:s.diagnosticCreatedAt});if(s.tick===old)throw new Error('stalled committed simulation');}
 const result=getDeploymentResult(s),directory='docs/qa/mission-'+stamp;mkdirSync(directory,{recursive:true});const files=readdirSync('src/deployment').filter(f=>f.endsWith('.ts')).sort().map(path=>({path:'src/deployment/'+path,sha256:createHash('sha256').update(readFileSync(join('src/deployment',path))).digest('hex')}));writeFileSync(join(directory,'compact.json'),JSON.stringify({elapsedWallSeconds:(performance.now()-start)/1000,result,trace,events:s.events,sourceFiles:files},null,2));writeFileSync(join(directory,'compact-save.json'),serializeDeploymentSave(makeDeploymentSave(craft,plan,s)));expect(result.success,JSON.stringify(result)).toBe(true);expect(s.diagnosticReceivedBits).toBe(16e6);expect(s.frames.some(f=>f.status==='received'&&f.arrivesAt!>f.lastEmittedAt!)).toBe(true);
},240000);
