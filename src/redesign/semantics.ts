import type {Design,Part} from '../sim/types';
import {resolveHardware} from '../hardware';
import type {SwingbyPlan} from '../swingby/types';
import type {Json,PartSignature,Target,SemanticChange,VerifiedRun} from './schema';
import {canonical,freeze} from './validation';
const targetInputs=new WeakMap<VerifiedRun,{craft:Design;plan:SwingbyPlan}>();
/** Adapter-only original input map; targets retain IDs without making IDs a physical delta. */
export function registerSemanticTargets(run:VerifiedRun,craft:Design,plan:SwingbyPlan){targetInputs.set(run,freeze(structuredClone({craft,plan})));}
export const partSignature=(p:Part):PartSignature=>({kind:p.kind,modelId:p.modelId??`legacy:${p.kind}`,face:p.face,uMeters:p.u===0?0:p.u,vMeters:p.v===0?0:p.v,rotationDeg:((p.rotation%360)+360)%360});
export function semanticCraft(craft:Design):Json{
 const radio=craft.parts.find(p=>p.id===resolveHardware(craft).radioId);
 return {hardwareVersion:craft.hardwareVersion??null,busId:craft.busId??null,launchPackageId:craft.launchPackageId??null,parts:craft.parts.map(partSignature).sort((a,b)=>canonical(a).localeCompare(canonical(b))) as unknown as Json[],activeRadio:radio?partSignature(radio) as unknown as Json:null};
}
export const semanticOperations=(plan:SwingbyPlan):Json=>plan.operations.map(o=>({kind:o.kind,start:o.start,end:o.end})).sort((a,b)=>a.start-b.start||a.end-b.end||a.kind.localeCompare(b.kind));
export const partTarget=(p:Part):Target=>({kind:'part',partId:p.id,signature:partSignature(p)});
export function resolvePartTarget(target:Extract<Target,{kind:'part'}>,craft:Design){
 const signature=canonical(target.signature),matches=craft.parts.filter(p=>canonical(partSignature(p))===signature),byId=craft.parts.find(p=>p.id===target.partId);
 if(byId&&canonical(partSignature(byId))===signature)return {status:'exact' as const,partIds:[byId.id]};
 if(matches.length===1)return {status:'semantic' as const,partIds:[matches[0].id]};
 if(matches.length>1)return {status:'ambiguous' as const,partIds:matches.map(p=>p.id)};
 return {status:'stale' as const,partIds:[]};
}
/** Multisets retain duplicate counts. ID reuse never pairs two different models. */
export function semanticChanges(a:VerifiedRun,b:VerifiedRun):SemanticChange[]{
 const changes:SemanticChange[]=[],before=a.semanticInputs.craft as Record<string,Json>,after=b.semanticInputs.craft as Record<string,Json>;
 const scalar=(field:string,kind:SemanticChange['kind'])=>{if(canonical(before[field])!==canonical(after[field]))changes.push({kind,before:before[field],after:after[field],mapping:'semantic',targets:[]});};
 scalar('busId','bus');scalar('hardwareVersion','hardware');scalar('launchPackageId','launch-stage');scalar('activeRadio','active-radio');
 const aa=(before.parts as Json[]).slice(),bb=(after.parts as Json[]).slice();for(let i=aa.length-1;i>=0;i--){const j=bb.findIndex(p=>canonical(p)===canonical(aa[i]));if(j>=0){aa.splice(i,1);bb.splice(j,1);}}
 // A unique same-model remaining pair is a placement edit; ambiguous groups are explicit.
 while(aa.length){const old=aa.shift() as Record<string,Json>,matches=bb.map((p,i)=>({p:p as Record<string,Json>,i})).filter(({p})=>p.modelId===old.modelId&&p.kind===old.kind),oldCount=aa.filter(p=>(p as Record<string,Json>).modelId===old.modelId).length;
  if(matches.length===1&&oldCount===0){const replacement=bb.splice(matches[0].i,1)[0];changes.push({kind:'placement',before:old,after:replacement,mapping:'semantic',targets:[]});}
  else changes.push({kind:'hardware',before:old,after:null,mapping:matches.length||oldCount?'ambiguous':'semantic',targets:[]});
 }
 for(const p of bb)changes.push({kind:'hardware',before:null,after:p,mapping:bb.filter(v=>canonical(v)===canonical(p)).length>1?'ambiguous':'semantic',targets:[]});
 for(const [field,kind] of [['trajectoryPlan','aim'],['initialOperations','operation'],['groundActions','ground-action']] as const)if(canonical(a.semanticInputs[field])!==canonical(b.semanticInputs[field]))changes.push({kind,before:a.semanticInputs[field],after:b.semanticInputs[field],mapping:'semantic',targets:[]});
 const input=targetInputs.get(b);
 if(!input)return changes;
 return changes.map(change=>{
  let targets:Target[]=[],mapping=change.mapping;
  if(change.kind==='hardware'||change.kind==='placement'||change.kind==='active-radio'){
   const signature=change.after as unknown as PartSignature|null;
   if(signature&&typeof signature==='object'&&signature.modelId){const matches=input.craft.parts.filter(p=>canonical(partSignature(p))===canonical(signature));targets=matches.length===1?[partTarget(matches[0])]:[{kind:'part-family',partKind:signature.kind}];if(matches.length>1)mapping='ambiguous';}
   else if(change.before&&typeof change.before==='object'&&!Array.isArray(change.before)){const kind=(change.before as Record<string,Json>).kind;if(typeof kind==='string')targets=[{kind:'part-family',partKind:kind}];}
  }else if(change.kind==='operation')targets=input.plan.operations.slice(0,12).map(o=>({kind:'operation',operationId:o.id,revision:null,signature:{kind:o.kind,startSeconds:o.start,endSeconds:o.end}}));
  else if(change.kind==='aim'||change.kind==='trajectory')targets=[{kind:'time',timeSeconds:0,panel:'trajectory'}];
  return {...change,targets,mapping};
 });
}
