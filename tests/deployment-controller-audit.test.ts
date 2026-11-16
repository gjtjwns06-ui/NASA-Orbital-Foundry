import {describe,it,expect} from 'vitest';
import {createDeploymentController} from '../src/deployment-worker-controller';
import {createDeploymentCraft,createDeploymentPlan,createDeploymentRuntime,advanceDeployment,makeDeploymentSave,serializeDeploymentSave} from '../src/deployment';

// Independent controller tests: real compiled domain, no fabricated flight or
// transport result. They do not replace the separate actual Worker/browser gates.
function fixture(){
 const messages:any[]=[],controller=createDeploymentController(m=>messages.push(structuredClone(m)));
 const send=(type:string,extra:Record<string,unknown>={},requestId=1,controlEpoch=0)=>controller.handle({type,requestId,controlEpoch,...extra});
 return {messages,controller,send};
}
async function evaluated(f:ReturnType<typeof fixture>,craft=createDeploymentCraft()){
 await f.send('evaluate',{craft,plan:createDeploymentPlan(),revision:1});
 const message=f.messages.find(m=>m.type==='evaluated');expect(message).toBeTruthy();return message.draft;
}
describe('independent deployment controller ownership audit',()=>{
 it('old-epoch mouse previews cannot be relabeled after Escape/pause',async()=>{
  const f=fixture();try{
   const draft=await evaluated(f),joint=draft.topology.joints[0];
   await f.send('pause',{},1,1);const start=f.messages.length,before=f.controller.getState();
   await f.send('preview-hinge',{sourceId:draft.inputHash,previewId:1,angles:{},jointId:joint.id,targetAngleRad:joint.deployedRad},1,0);
   await f.send('preview-sequence',{sourceId:draft.inputHash,previewId:2},1,0);
   expect(f.messages.slice(start).filter(m=>m.type==='hinge-preview'||m.type==='sequence-preview')).toEqual([]);
   expect(f.controller.getState()).toEqual(before);
  }finally{f.controller.dispose();}
 });
 it('a rejected new editor schema cannot silently save the previous craft as the new draft',async()=>{
  const f=fixture();try{
   const old=await evaluated(f);await f.send('evaluate',{craft:{...old.craft,version:999},plan:old.plan,revision:2},2,0);
   expect(f.messages.at(-1)).toMatchObject({type:'error',operation:'evaluate',requestId:2});
   const start=f.messages.length;await f.send('save',{saveId:'rejected-draft'},2,0);
   expect(f.messages.slice(start).some(m=>m.type==='save-snapshot')).toBe(false);
   expect(f.messages.at(-1)).toMatchObject({type:'error',operation:'save',saveId:'rejected-draft'});
  }finally{f.controller.dispose();}
 });
 it('a physically unlaunchable but schema-valid craft remains saveable with its own exact inputs',async()=>{
  const f=fixture();try{
   const craft=createDeploymentCraft('fixed');craft.launchPackageId='rideshare';
   const draft=await evaluated(f,craft);expect(draft.launchable).toBe(false);expect(draft.inputHash).toBeTruthy();
   await f.send('save',{saveId:'invalid-launch-draft'});const saved=f.messages.at(-1);
   expect(saved.type).toBe('save-snapshot');expect(saved.save.craft).toEqual(craft);expect(saved.save.plan).toEqual(draft.plan);expect(saved.save.checkpoint).toBeUndefined();
  }finally{f.controller.dispose();}
 });
 it('a conflicting same-epoch control terminates with an error and never advances the flight',async()=>{
  const f=fixture();try{
   const draft=await evaluated(f);await f.send('launch',{inputHash:draft.inputHash},1,1);await f.send('pause',{},1,2);
   const paused=f.messages.at(-1),start=f.messages.length;expect(paused.type).toBe('paused');
   await f.send('step',{},1,2);
   expect(f.messages.slice(start).some(m=>m.type==='error'&&m.operation==='step')).toBe(true);
   await f.send('save',{saveId:'after-conflict'},1,2);const saved=f.messages.at(-1);
   expect(saved.type).toBe('save-snapshot');expect(saved.save.checkpoint.time).toBe(paused.state.time);expect(saved.save.checkpoint.requestedTime).toBe(paused.state.time);
  }finally{f.controller.dispose();}
 });
 it('a save rejected during bounded restore does not cancel the independent replay',async()=>{
  const f=fixture();try{
   const craft=createDeploymentCraft(),plan=createDeploymentPlan(),state=createDeploymentRuntime(craft,plan);
   advanceDeployment(state,60,10000);expect(state.time).toBe(60);
   const text=serializeDeploymentSave(makeDeploymentSave(craft,plan,state));
   await evaluated(f);const restore=f.send('restore',{text},2,0);
   expect(f.messages.some(m=>m.type==='restore-progress'&&m.requestId===2)).toBe(true);
   await f.send('save',{saveId:'replay-active'},2,0);
   expect(f.messages.at(-1)).toMatchObject({type:'error',operation:'save',error:'SAVE_REQUIRES_PAUSE',saveId:'replay-active'});
   await restore;const restored=f.messages.find(m=>m.type==='restored'&&m.requestId===2);
   expect(restored).toBeTruthy();expect(restored.state.time).toBe(state.time);expect(restored.state.energyWh).toBe(state.energyWh);
  }finally{f.controller.dispose();}
 },30000);
});
