import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:"export * from './src/swingby';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false}),m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
const runs=[],checks=[];
for(const name of ['baseline','lower','higher','economy','science-craft','starter','energy-only-negative','no-downlink']){
 const craft=m.createSwingbyDesign(name==='science-craft'?'science':'balanced'),plan=m.createSwingbyPlan(['baseline','lower','higher','economy','starter'].includes(name)?name:'baseline');
 if(name==='energy-only-negative'){const aim=m.aimFromSwingbyControl({xMps:-2,yMps:2});plan.aim={xKm:aim.xKm,yKm:aim.yKm};}
 if(name==='no-downlink')plan.operations=plan.operations.filter(o=>o.kind!=='downlink');
 const solved=m.solveSwingbyPlan(plan,craft);assert.equal(solved.status,'solved');assert.equal(solved.evaluation.launchable,true);const s=m.createSwingbyRuntime(solved.solution,craft),start=performance.now();
 m.advanceSwingby(s,m.getSwingbyScenario().deadlineSeconds,Infinity);const result=m.getSwingbyResult(s),requirement=id=>result.requirements.find(r=>r.id===id).status;
 let pass;if(['baseline','lower','higher','economy','science-craft'].includes(name))pass=result.status==='success'&&s.burn.status==='fired'&&result.received>=result.required&&result.requirements.every(r=>r.status==='passed');
 else if(name==='starter')pass=result.status!=='success'&&s.burn.status==='no-op'&&s.burn.fuelUsedKg===0&&requirement('direction')==='failed'&&requirement('energy')==='passed'&&requirement('science')==='passed';
 else if(name==='energy-only-negative')pass=result.status!=='success'&&s.burn.status==='fired'&&requirement('direction')==='passed'&&requirement('energy')==='failed'&&requirement('science')==='passed';
 else pass=result.status!=='success'&&s.packets.length>=3&&s.packets.every(p=>p.receivedAt===null&&p.transmittedBits===0)&&result.received===0&&requirement('science')==='failed'&&requirement('direction')==='passed'&&requirement('energy')==='passed';
 runs.push({name,pass,craft,plan,evaluation:solved.evaluation,result,functionalWallMs:performance.now()-start});console.log(JSON.stringify({name,pass,status:result.status,received:result.received,fuelUsed:s.burn.fuelUsedKg,requirements:result.requirements}));
 if(name==='baseline'){
  const save=m.makeSwingbySave(plan,craft,s),task=m.createSwingbyReplay(m.serializeSwingbySave(save));let chunks=0;while(task.progress.status==='running'){task.step(500);chunks++;}assert.deepEqual(m.swingbyCheckpoint(task.result().runtime),m.swingbyCheckpoint(s));checks.push({name:'full-flight-exit-and-packets-strict-replay',pass:true,chunks});
  const forged=structuredClone(save);forged.checkpoint.achievedExit.energyKm2S2=0;const bad=m.createSwingbyReplay(JSON.stringify(forged));let rejected=false;try{while(bad.progress.status==='running')bad.step(500);}catch(e){rejected=e.message==='BAD_CHECKPOINT';}assert.equal(rejected,true);checks.push({name:'forged-achieved-exit-rejected',pass:true});
 }
}
const baseline=runs.find(r=>r.name==='baseline'),economy=runs.find(r=>r.name==='economy');checks.push({name:'actual-economy-fuel-saving',pass:economy.result.burn.fuelUsedKg<baseline.result.burn.fuelUsedKg*.8});
const pass=runs.every(r=>r.pass)&&checks.every(c=>c.pass);await mkdir('docs/qa/swingby',{recursive:true});await writeFile('docs/qa/swingby/flight-acceptance.json',JSON.stringify({generatedAt:new Date().toISOString(),scope:'Actual initial-state integrations only; functional durations are not performance claims.',pass,scenario:m.getSwingbyScenario(),propulsion:m.SWINGBY_PROPULSION,checks,runs},null,2));if(!pass)process.exitCode=1;
