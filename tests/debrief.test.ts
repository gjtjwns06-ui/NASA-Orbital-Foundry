import {describe,expect,it} from 'vitest';
import type {MissionResult,DataPacket,GroundCommand} from '../src/sim/types';
import {buildDebrief,compareDesigns,resolveDebriefTarget,type DebriefRun,type DebriefDesign,type DebriefMetadata} from '../src/debrief';
import {createDesign,MODEL_VERSION} from '../src/sim/catalog';
import {createSimulation,advanceSimulation,getResult,M01_M02_SCORE_DEFINITION} from '../src/sim/simulation';

function design():DebriefDesign{return {version:1,missionId:'mars',name:'Test spacecraft',seed:7,parts:[{id:'sensor',kind:'spectrometer',face:'nz',u:0,v:0,rotation:0},{id:'dish',kind:'antenna',face:'pz',u:0,v:0,rotation:0},{id:'wing',kind:'solarLarge',face:'px',u:0,v:0,rotation:0},{id:'pack',kind:'battery',face:'py',u:0,v:0,rotation:0}],plan:{altitudeKm:600,inclinationDeg:51.6,burnTime:1200,progradeMps:0,normalMps:0,radialMps:0,periapsisAltitudeKm:1000,bPlaneAngleDeg:0,operations:[{id:'obs',kind:'observe',start:7200,end:10400},{id:'down',kind:'downlink',start:10600,end:17100}]}};}
function result():MissionResult{return {evaluatedAt:18000,status:'partial',title:'Fixture',scienceScore:20,missionScore:25,resourceScore:10,score:55,received:1,required:3,reasons:[],recommendations:[],budgetRemaining:90,energyMinimumWh:10,fuelRemainingKg:5,timeline:[],packets:[],commandHistory:[],design:design()};}
const meta=():DebriefMetadata=>({modelVersion:'1.3.0',scoreDefinitionId:'science60-navigation25-resources15-v1',simulationStatus:'complete',requirements:{targetPackets:3,minimumQuality:.4,deadlineSeconds:18000},eventLogCoverage:'complete'});
type MutableRun=Omit<DebriefRun,'result'>&{result:MissionResult};
const run=():MutableRun=>({result:result(),meta:meta()});
const packet=(id:string,patch:Partial<DataPacket>={}):DataPacket=>({id,target:'sector1',capturedAt:8000,quality:.8,bits:1000,transmittedBits:0,receivedBits:0,receivedAt:null,kind:'spectrum',...patch});
const command=(id:string,patch:Partial<GroundCommand>={}):GroundCommand=>({id,kind:'observe',requestedAt:7000,durationSeconds:600,status:'queued',sentAt:null,arrivesAt:null,executedAt:null,reason:'fixture',...patch});
function freeze<T>(x:T):T {if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}

describe('evidence-led debrief',()=>{
  it('is deterministic, deeply immutable and never freezes or mutates caller-owned objects',()=>{
    const current=run(),before=structuredClone(current);freeze(current);const a=buildDebrief(current),b=buildDebrief(current);expect(a).toEqual(b);expect(current).toEqual(before);
    expect(Object.isFrozen(a)).toBe(true);expect(Object.isFrozen(a.diagnostics[0].actions[0].target)).toBe(true);expect(()=>a.diagnostics.push(a.diagnostics[0])).toThrow();
    const mutable=run();buildDebrief(mutable);expect(Object.isFrozen(mutable.result.design.parts)).toBe(false);
  });
  it('distinguishes missing equipment from an unknown reason for zero captures',()=>{
    const current=run();let d=buildDebrief(current);const unknown=d.diagnostics.find(x=>x.code==='NO_CAPTURE_EVIDENCE')!;expect(unknown.confidence).toBe('inspect');expect(unknown.detail.en).toContain('do not isolate a cause');expect(d.diagnostics.some(x=>x.code==='MISSING_SENSOR')).toBe(false);
    current.result.design.parts=current.result.design.parts.filter(p=>!['spectrometer','antenna'].includes(p.kind));d=buildDebrief(current);expect(d.diagnostics.map(x=>x.code)).toEqual(['MISSING_ANTENNA','MISSING_SENSOR']);expect(d.diagnostics.every(x=>x.confidence==='observed')).toBe(true);
  });
  it('keeps EPS power limits separate from energy reserve and does not blame panel placement',()=>{
    const current=run();current.result.timeline=[{code:'SAFE_MODE',time:9000,message:'fixture',severity:'warning'},{code:'DISCHARGE_LIMIT',time:11000,message:'fixture',severity:'warning'}];
    const d=buildDebrief(current),power=d.diagnostics.find(x=>x.code==='DISCHARGE_LIMIT')!,energy=d.diagnostics.find(x=>x.code==='SAFE_MODE')!;
    expect(power.detail.en).toContain('Energy capacity (Wh) and output power (W) are different');expect(energy.detail.en).toContain('does not identify panel obstruction');expect(power.actions[0].target).toEqual({kind:'time',time:11000,panel:'resources'});
  });
  it('reports fully emitted but unconfirmed data without inventing current propagation or receipt',()=>{
    const current=run();current.result.packets=[packet('queued'),packet('partial',{transmittedBits:400,receivedBits:100}),packet('emitted',{transmittedBits:1000}),packet('received',{transmittedBits:1000,receivedBits:1000,receivedAt:17000}),packet('low-quality',{quality:.2,transmittedBits:1000,receivedBits:1000,receivedAt:17000}),packet('future',{capturedAt:19000})];
    const d=buildDebrief(current);expect(d.transport).toEqual({captured:5,fullyReceived:2,qualifyingReceived:1,partlyEmitted:1,fullyEmittedUnconfirmed:1,neverEmitted:1,unconfirmedBits:2900});
    const issue=d.diagnostics.find(x=>x.code==='DELIVERY_UNCONFIRMED')!;expect(issue.detail.en).toContain('does not prove they are currently in flight');expect(issue.evidence[0].ids).toEqual(['queued','partial','emitted']);expect(issue.actions[0].target).toEqual({kind:'operation',operationId:'down',operationKind:'downlink',start:10600,end:17100});
  });
  it('retains command identity and real delivery times even for two commands requested on one tick',()=>{
    const current=run();current.result.commandHistory=[command('cmd-a'),command('cmd-b'),command('cmd-c',{status:'failed',sentAt:7100,arrivesAt:7700})];const issues=buildDebrief(current).diagnostics.filter(x=>x.code.startsWith('COMMAND_'));
    expect(new Set(issues.map(x=>x.id)).size).toBe(3);const failed=issues.find(x=>x.code==='COMMAND_FAILED')!;expect(failed.evidence[0].values).toMatchObject({requestedAt:7000,sentAt:7100,arrivesAt:7700,executedAt:null});expect(failed.actions[0].target).toEqual({kind:'command',commandId:'cmd-c',time:7000});expect(failed.detail.en).toContain('not guaranteed');
  });
  it('uses exact structural evidence for part targeting and recorded event time for navigation',()=>{
    const current=run();current.designWarnings=[{code:'PLACEMENT',severity:'error',message:'overlap',partId:'sensor'}];current.result.timeline=[{code:'IMPACT',time:1650,message:'surface',severity:'error'}];
    const d=buildDebrief(current),placement=d.diagnostics.find(x=>x.code==='DESIGN_PLACEMENT')!,impact=d.diagnostics.find(x=>x.code==='IMPACT')!;
    expect(placement.actions[0].target).toMatchObject({kind:'part',partId:'sensor',signature:{kind:'spectrometer',face:'nz'}});expect(impact.actions[0].target).toEqual({kind:'time',time:1650,panel:'trajectory'});expect(impact.detail.en).toContain('does not isolate one maneuver');
  });
  it('does not turn a partial-time result or truncated log into a final causal history',()=>{
    const current=run();current.result.evaluatedAt=9000;current.meta!.simulationStatus='running';current.meta!.eventLogCoverage='truncated';current.result.timeline=[{code:'SAFE_MODE',time:8500,message:'fixture',severity:'warning'}];
    const d=buildDebrief(current);expect(d.isFinal).toBe(false);expect(d.limitations.map(x=>x.en).join(' ')).toContain('not establish total event counts');expect(d.limitations.map(x=>x.en).join(' ')).toContain('not asserted to be the final');
  });
  it('retains captured connection constraints and targets their exact hardware instead of guessing from low return',()=>{
    const current=run();current.designWarnings=[{code:'POWER_VOLTAGE',severity:'error',message:'captured voltage mismatch',partId:'sensor'},{code:'NO_RADIO',severity:'error',message:'captured disconnected RF chain'}];
    const d=buildDebrief(current),power=d.diagnostics.find(x=>x.code==='DESIGN_POWER_VOLTAGE')!,radio=d.diagnostics.find(x=>x.code==='DESIGN_NO_RADIO')!;
    expect(power.actions[0].target).toMatchObject({kind:'part',partId:'sensor'});expect(power.evidence[0]).toMatchObject({kind:'warning',code:'POWER_VOLTAGE',index:0});expect(radio.actions[0].target).toEqual({kind:'part-kind',partKind:'radio'});
  });
});

describe('same-condition comparisons',()=>{
  it('returns actual subscore/resource differences, not a causal contribution per modification',()=>{
    const a=run(),b=run();b.result.score+=12;b.result.scienceScore+=10;b.result.resourceScore+=2;b.result.received+=1;b.result.design.parts[2].u=.2;
    const c=buildDebrief(b,a).comparison;expect(c.comparable).toBe(true);expect(c.scoreDelta).toEqual({total:12,science:10,mission:0,resource:2});expect(c.metricDeltas?.received).toBe(1);expect(c.designChanges[0].kind).toBe('layout');expect(c.designChanges[0]).not.toHaveProperty('scoreContribution');
  });
  it.each([
    ['MISSION',(r:MutableRun)=>{r.result.design.missionId='earth';}],
    ['SEED',(r:MutableRun)=>{r.result.design.seed++;}],
    ['TARGET',(r:MutableRun)=>{r.result.design.scienceTarget={profile:'survey',latDeg:0,lonDeg:0};}],
    ['HAZARD',(r:MutableRun)=>{r.result.design.hazard='debris';}],
    ['EVALUATED_AT',(r:MutableRun)=>{r.result.evaluatedAt-=5;}],
    ['REQUIRED',(r:MutableRun)=>{r.result.required++;}],
    ['REQUIREMENTS',(r:MutableRun)=>{r.meta!.requirements!.minimumQuality=.8;}],
    ['modelVersion',(r:MutableRun)=>{r.meta!.modelVersion='2.0.0';}],
    ['scoreDefinitionId',(r:MutableRun)=>{r.meta!.scoreDefinitionId='transfer70-20-10';}],
  ] as const)('blocks score comparison when %s differs',(code,mutate)=>{
    const a=run(),b=run();mutate(b);const c=buildDebrief(b,a).comparison;expect(c.comparable).toBe(false);expect(c.blockers.some(x=>x.code===code)).toBe(true);expect(c.scoreDelta).toBeUndefined();expect(c.metricDeltas).toBeUndefined();
  });
  it('never backfills legacy provenance with current model assumptions',()=>{
    const current=run(),legacy:DebriefRun={result:result()};const c=buildDebrief(current,legacy).comparison;
    expect(c.comparable).toBe(false);expect(c.blockers.map(x=>x.code)).toEqual(expect.arrayContaining(['MISSING_modelVersion','MISSING_scoreDefinitionId','MISSING_REQUIREMENTS']));
  });
  it('uses captured result metadata and blocks an inconsistent override',()=>{
    const a=run(),b=run();Object.assign(a.result,meta());Object.assign(b.result,meta());delete a.meta;delete b.meta;expect(buildDebrief(b,a).comparison.comparable).toBe(true);
    b.meta={modelVersion:'invented'};expect(buildDebrief(b,a).comparison.blockers.some(x=>x.code==='METADATA_CONFLICT')).toBe(true);
  });
  it('does not mistake explicitly unknown supplemental metadata for a conflicting provenance claim',()=>{
    const a=run(),b=run();Object.assign(a.result,meta());Object.assign(b.result,meta());b.meta={modelVersion:null,scoreDefinitionId:null,simulationStatus:'unknown',requirements:null,eventLogCoverage:'unknown'};
    const d=buildDebrief(b,a);expect(d.comparison.comparable).toBe(true);expect(d.isFinal).toBe(true);
  });
  it('compares command strategy without counting generated command IDs or results as player inputs',()=>{
    const a=run(),b=run();a.result.commandHistory=[command('old')];b.result.commandHistory=[command('new',{status:'failed'})];expect(buildDebrief(b,a).comparison.commandStrategyChanged).toBe(false);
    b.result.commandHistory[0].requestedAt+=5;expect(buildDebrief(b,a).comparison.commandStrategyChanged).toBe(true);
  });
});

describe('physical design deltas and safe navigation targets',()=>{
  it('ignores cosmetic IDs, names, ordering, equivalent rotations and inactive mission fields',()=>{
    const a=design(),b=structuredClone(a);b.name='Renamed';b.parts.reverse();b.parts.forEach((p,i)=>{p.id=`new-${i}`;p.rotation+=360;});b.plan.operations.reverse();b.plan.operations.forEach((o,i)=>o.id=`op-${i}`);b.plan.altitudeKm=900;b.plan.inclinationDeg=40;b.hazard='none';
    expect(compareDesigns(a,b)).toEqual([]);
  });
  it('treats explicit models, bus selection, placement and operation timing as substantive changes',()=>{
    const a=design(),b=structuredClone(a);b.busId='pathfinder-d35-v1';b.parts[0].modelId='spectrometer-b';b.parts[2].u=.2;b.plan.operations[1].end-=600;
    const changes=compareDesigns(a,b);expect(changes.map(x=>x.kind).sort()).toEqual(['bus','hardware','layout','operation']);expect(changes.find(x=>x.kind==='hardware')?.target).toMatchObject({kind:'part',partId:'sensor'});expect(changes.find(x=>x.kind==='operation')?.after).toEqual({kind:'downlink',start:10600,end:16500});
  });
  it('normalizes an explicitly supplied physically identical default without guessing one',()=>{
    const a=design(),b=structuredClone(a);b.parts[0].modelId='legacy-spectrometer';expect(compareDesigns(a,b)).toHaveLength(1);
    expect(compareDesigns(a,b,{defaultModelIds:{spectrometer:'legacy-spectrometer'}})).toEqual([]);
  });
  it('keeps ambiguous duplicate-part changes as a group instead of inventing a moved-part identity',()=>{
    const a=design(),b=design();a.parts=[{...a.parts[2],id:'a',u:-.2},{...a.parts[2],id:'b',u:.2}];b.parts=[{...b.parts[2],id:'c',u:-.3},{...b.parts[2],id:'d',u:.3}];const changes=compareDesigns(a,b);
    expect(changes).toHaveLength(1);expect(changes[0]).toMatchObject({ambiguous:true,key:'group:solarLarge',target:{kind:'part-kind',partKind:'solarLarge'}});
  });
  it('normalizes legacy maneuver representation but preserves meaningful same-time execution order',()=>{
    const a=design(),b=design();a.missionId=b.missionId='earth';b.plan.maneuvers=[{id:'new-id',time:1200,progradeMps:0,normalMps:0,radialMps:0}];expect(compareDesigns(a,b)).toEqual([]);
    a.plan.maneuvers=[{id:'a',time:1200,progradeMps:10,normalMps:0,radialMps:0},{id:'b',time:1200,progradeMps:0,normalMps:10,radialMps:0}];b.plan.maneuvers=structuredClone(a.plan.maneuvers).map((m,i)=>({...m,id:i?'a':'b'}));expect(compareDesigns(a,b).some(x=>x.kind==='trajectory')).toBe(true);
  });
  it('resolves changed IDs only by unique physical signatures and rejects reused/ambiguous IDs',()=>{
    const a=design(),current=run();current.designWarnings=[{code:'PLACEMENT',severity:'error',message:'fixture',partId:'sensor'}];const target=buildDebrief(current).diagnostics.find(x=>x.code==='DESIGN_PLACEMENT')!.actions[0].target;
    expect(resolveDebriefTarget(target,a).status).toBe('exact');a.parts[0].id='new';expect(resolveDebriefTarget(target,a)).toMatchObject({status:'semantic',target:{kind:'part',partId:'new'}});
    a.parts.push({...a.parts[0],id:'other'});expect(resolveDebriefTarget(target,a)).toMatchObject({status:'ambiguous',target:{kind:'part-kind',partKind:'spectrometer'}});
    a.parts=a.parts.filter(p=>p.kind!=='spectrometer');a.parts.push({id:'sensor',kind:'battery',face:'py',u:0,v:0,rotation:0});expect(resolveDebriefTarget(target,a).status).toBe('stale');
  });
  it('falls back to time when an operation has been changed rather than selecting an ID blindly',()=>{
    const d=design();expect(resolveDebriefTarget({kind:'operation',operationId:'down',operationKind:'downlink',start:10600,end:17000},d)).toEqual({status:'stale',target:{kind:'time',time:10600,panel:'timeline'}});
  });
  it('compares active radio by physical choice, not a renamed part ID',()=>{
    const a=design(),b=design();a.activeRadioId='dish';b.parts[1].id='new-dish';b.activeRadioId='new-dish';expect(compareDesigns(a,b)).toEqual([]);
    b.activeRadioId='wing';expect(compareDesigns(a,b).some(x=>x.kind==='radio')).toBe(true);
  });
  it('targets the selected active radio rather than its separate passive antenna in a hardware design',()=>{
    const a=design(),b=design();a.hardwareVersion=b.hardwareVersion='hardware-2.0.0';b.parts.push({id:'rf',kind:'radio',modelId:'rf-example',face:'py',u:.1,v:.1,rotation:0});b.activeRadioId='rf';
    expect(compareDesigns(a,b).find(x=>x.kind==='radio')?.target).toMatchObject({kind:'part',partId:'rf',signature:{kind:'radio'}});
    a.activeRadioId='dish';delete b.activeRadioId;expect(compareDesigns(a,b).find(x=>x.kind==='radio')?.target).toEqual({kind:'part-kind',partKind:'radio'});
  });
});

describe('real simulation result provenance',()=>{
  it('uses the producing engine metadata for an actual failed-delivery and repaired mission without caller supplied defaults',()=>{
    const baseline=createDesign('earth','balanced');baseline.parts=baseline.parts.filter(p=>p.kind!=='antenna');
    const broken=createSimulation(baseline);advanceSimulation(broken,10800);const previous=getResult(broken);
    const fixed=createSimulation(createDesign('earth','balanced'));advanceSimulation(fixed,10800);const current=getResult(fixed);
    expect(previous.modelVersion).toBe(MODEL_VERSION);expect(current.scoreDefinitionId).toBe(M01_M02_SCORE_DEFINITION.id);
    expect(current.requirements).toEqual({targetPackets:4,minimumQuality:.45,deadlineSeconds:10800});expect(current.simulationStatus).toBe('complete');
    expect(previous.received).toBe(0);expect(previous.packets.length).toBeGreaterThan(0);expect(current.received).toBeGreaterThanOrEqual(4);
    const old=buildDebrief({result:previous}),d=buildDebrief({result:current},{result:previous});
    expect(old.diagnostics.map(x=>x.code)).toEqual(expect.arrayContaining(['MISSING_ANTENNA','DELIVERY_UNCONFIRMED']));
    expect(d.isFinal).toBe(true);expect(d.comparison.comparable).toBe(true);expect(d.comparison.metricDeltas?.received).toBe(current.received);
    expect(d.comparison.designChanges).toHaveLength(1);expect(d.comparison.designChanges[0]).toMatchObject({kind:'hardware',key:'group:antenna',before:[],after:[{kind:'antenna'}]});
    expect(Object.isFrozen(M01_M02_SCORE_DEFINITION)).toBe(true);expect(Object.isFrozen(M01_M02_SCORE_DEFINITION.weights)).toBe(true);
    expect(Object.isFrozen(M01_M02_SCORE_DEFINITION.resourceWeights)).toBe(true);
    const partial=createSimulation(baseline);advanceSimulation(partial,900);const interim=getResult(partial);
    expect(interim.simulationStatus).toBe('running');expect(buildDebrief({result:interim}).isFinal).toBe(false);
    expect(buildDebrief({result:current},{result:interim}).comparison.blockers.some(x=>x.code==='EVALUATED_AT')).toBe(true);
  });
});
