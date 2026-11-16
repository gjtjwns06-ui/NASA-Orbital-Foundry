import {describe,it,expect} from 'vitest';
import sourceRecords from '../public/data/component-sources.json';
import {createDesign} from '../src/sim/catalog';
import {createHardwareDesign,createHardwarePart} from '../src/hardware/presets';
import {HARDWARE_MODELS,HARDWARE_VERSION,HARDWARE_SIM_MODEL_VERSION,HARDWARE_TRANSFER_MODEL_VERSION,HARDWARE_CATALOG_HASH,BUSES} from '../src/hardware/catalog';
import {resolveHardware,hardwareLink,hardwareLoadPower,getBusDefinition} from '../src/hardware/resolve';
import {evaluateDesign} from '../src/sim/assembly';
import {createSimulation,advanceSimulation,getResult} from '../src/sim/simulation';
import {makeSave,parseSave,validateDesign} from '../src/sim/persistence';
import {createTransferPlan,solveTransferPlan} from '../src/transfer/planning';
import {createTransferRuntime,advanceTransfer} from '../src/transfer/runtime';
import {makeTransferSave,serializeTransferSave,parseTransferSave} from '../src/transfer/persistence';

const sourceValue=(id:string,key:string)=>{
  const record=sourceRecords.records.find(x=>x.id===id);
  const value=record?.specifications.find(x=>x.key===key)?.value;
  if(typeof value!=='number')throw new Error(`Missing verified scalar ${id}:${key}`);
  return value;
};

describe('independent source-unit and connection audit',()=>{
  it('keeps published radio DC draw, RF output, board mass and authored carrier in separate quantities',()=>{
    const radio=HARDWARE_MODELS['ax100u-carrier-v1'];
    expect(radio.idlePowerW).toBeCloseTo(sourceValue('gomspace-ax100u','supplyVoltageV')*sourceValue('gomspace-ax100u','rxCurrentTypicalA'),12);
    expect(radio.activePowerW).toBeCloseTo(sourceValue('gomspace-ax100u','supplyVoltageV')*sourceValue('gomspace-ax100u','txCurrentTypicalA'),12);
    expect(radio.radio?.rfPowerW).toBeCloseTo(10**((sourceValue('gomspace-ax100u','rfOutputTypicalDbm')-30)/10),12);
    expect(radio.massKg).toBeCloseTo(sourceValue('gomspace-ax100u','massKg')+.075,12);
    expect(radio.activePowerW).toBeGreaterThan(radio.radio!.rfPowerW);
    expect(Math.max(...radio.radio!.signalModesBps)).toBeLessThanOrEqual(sourceValue('gomspace-ax100u','signalRateMaxBps'));
    expect(radio.provenance).toBe('derived-assembly');
    expect(HARDWARE_MODELS['uhf-dipole-pair-v1'].activePowerW).toBe(0);
  });

  it('preserves usable Wh versus nominal Wh, complete-wing W and explicitly derived combined mass',()=>{
    const pack=HARDWARE_MODELS['bpx100-4s2p-v2'],dual=HARDWARE_MODELS['bpx100-dual-v2'];
    expect(pack.capacityWh).toBe(sourceValue('gomspace-bpx100','recommendedRangeEnergyWh'));
    expect(pack.nominalCapacityWh).toBe(sourceValue('gomspace-bpx100','nominalEnergyWh'));
    expect(pack.capacityWh).toBeLessThan(pack.nominalCapacityWh!);
    expect(dual.capacityWh).toBe(2*pack.capacityWh!);expect(dual.massKg).toBeCloseTo(2*pack.massKg+.1,12);
    const wing=HARDWARE_MODELS['tsp45-fixed-v2'],array=HARDWARE_MODELS['tsp45-sixwing-v2'];
    expect(wing.outputW).toBe(sourceValue('gomspace-tsp45w','powerPerWingW'));
    expect(wing.massKg).toBe(sourceValue('gomspace-tsp45w','massTotalKg'));
    expect(array.outputW).toBe(6*wing.outputW!);expect(array.massKg).toBeCloseTo(6*wing.massKg+.4,12);
  });

  it('reserves a compatible voltage interval and peak port power rather than accepting nominal-voltage coincidence',()=>{
    const d=createHardwareDesign('earth','balanced');
    d.parts=d.parts.filter(p=>p.kind!=='radio'&&p.kind!=='antenna');
    d.parts.push(createHardwarePart('iris22-carrier-v1','iris','py',-.22,.2),createHardwarePart('xband-reflector-1m-v1','dish','pz'));
    d.activeRadioId='iris';
    const weak=resolveHardware(d);
    expect(weak.parts.find(p=>p.part.id==='iris')?.powered).toBe(false);
    expect(weak.issues).toContainEqual(expect.objectContaining({code:'POWER_PORT_LIMIT',partId:'iris',required:35,available:15}));
    d.busId='pathfinder-d35-v1';const strong=resolveHardware(d);
    expect(strong.parts.find(p=>p.part.id==='iris')?.powered).toBe(true);
    for(const connection of strong.connections.filter(c=>c.type==='power')){
      const item=strong.parts.find(p=>p.part.id===connection.partId)!,rail=strong.bus.rails.find(r=>r.id===connection.endpoint)!;
      expect(rail.minimumV).toBeGreaterThanOrEqual(item.definition.electrical!.minimumV);
      expect(rail.maximumV).toBeLessThanOrEqual(item.definition.electrical!.maximumV);
      expect(rail.maxPowerW).toBeGreaterThanOrEqual(item.definition.electrical!.peakW);
    }
  });

  it('never obtains a UHF downlink from an X-band reflector or exceeds its actual payload signal cap',()=>{
    const d=createHardwareDesign('earth','balanced'),good=hardwareLink(d,600,[0,0,1],false);
    expect(good.rateBps).toBeGreaterThan(0);expect(good.rateBps).toBeLessThanOrEqual(38400*.75);
    d.parts=d.parts.filter(p=>p.kind!=='antenna');d.parts.push(createHardwarePart('xband-reflector-1m-v1','wrong-band','pz'));
    expect(resolveHardware(d).issues.some(x=>x.code==='RF_BAND')).toBe(true);
    expect(hardwareLink(d,600,[0,0,1],false).rateBps).toBe(0);
  });

  it('charges an unselected second radio its idle draw instead of a second transmitter draw',()=>{
    const d=createHardwareDesign('earth','balanced'),one=hardwareLoadPower(d,'downlink',false);
    d.parts.push(createHardwarePart('ax100u-carrier-v1','standby','py',0,.02));
    const two=hardwareLoadPower(d,'downlink',false);
    expect(resolveHardware(d).radioId).toBe('radio-1');
    expect(two-one).toBeCloseTo(HARDWARE_MODELS['ax100u-carrier-v1'].idlePowerW/BUSES[d.busId].conversionEfficiency,10);
    expect(resolveHardware(d).parts.find(p=>p.part.id==='standby')?.dataConnected).toBe(true);
  });

  it('resolves identical physical assemblies independently of part ordering, cosmetic IDs and full rotations',()=>{
    const a=createHardwareDesign('earth','balanced'),b=structuredClone(a);delete a.activeRadioId;delete b.activeRadioId;
    b.parts.reverse();b.parts.forEach((p,i)=>{p.id=`renamed-${i}`;p.rotation+=360;});
    const x=resolveHardware(a),y=resolveHardware(b);
    for(const mode of ['charge','observe','downlink'] as const)expect(y.modeLoadW[mode]).toBeCloseTo(x.modeLoadW[mode],10);
    y.inertiaKgM2.forEach((value,i)=>expect(value).toBeCloseTo(x.inertiaKgM2[i],10));
    expect(y.parts.find(p=>p.part.id===y.radioId)?.definition.modelId).toBe(x.parts.find(p=>p.part.id===x.radioId)?.definition.modelId);
    expect(hardwareLink(b,600,[0,0,1],false)).toMatchObject({rateBps:hardwareLink(a,600,[0,0,1],false).rateBps,marginDb:hardwareLink(a,600,[0,0,1],false).marginDb});
  });

  it('uses each bus actual fuel inventory in mass and initial state instead of silently granting legacy six kg',()=>{
    const d=createHardwareDesign('earth','balanced'),bus=getBusDefinition(d),e=evaluateDesign(d),s=createSimulation(d);
    expect(bus.fuelKg).toBe(4);expect(s.fuelKg).toBe(4);
    const independentWetMass=bus.massKg+4+d.parts.reduce((m,p)=>m+HARDWARE_MODELS[p.modelId!].massKg,0);
    expect(e.massKg).toBeCloseTo(independentWetMass,12);expect(e.massKg-e.dryMassKg).toBeCloseTo(4,12);
    expect(s.modelVersion).toBe(HARDWARE_SIM_MODEL_VERSION);
  });
});

describe('independent model/save dispatch audit',()=>{
  it('keeps a deliberately empty hardware draft review finite even though launch is blocked',()=>{
    const d=createHardwareDesign('earth','starter'),s=createSimulation(d),result=getResult(s);
    expect(s.status).toBe('failed');expect(evaluateDesign(d).launchable).toBe(false);
    for(const field of ['score','scienceScore','missionScore','resourceScore','energyMinimumWh','budgetRemaining','fuelRemainingKg'] as const)expect(Number.isFinite(result[field]),field).toBe(true);
  });
  it('round-trips an actual new-model checkpoint and rejects changed acquisition bytes instead of trusting them',()=>{
    const d=createHardwareDesign('earth','balanced'),s=createSimulation(d);expect(s.status).toBe('running');advanceSimulation(s,900);
    expect(s.time).toBe(900);const save=makeSave(s.design,s),copy=parseSave(JSON.stringify(save));
    expect(save.modelVersion).toBe(HARDWARE_SIM_MODEL_VERSION);expect(save.hardwareCatalogHash).toBe(HARDWARE_CATALOG_HASH);
    expect(copy.simulation).toEqual(s);expect(getResult(copy.simulation!).modelVersion).toBe(HARDWARE_SIM_MODEL_VERSION);
    const modified=structuredClone(save);modified.simulation!.hardwareData!.angularRateDegS+=.001;
    expect(()=>parseSave(JSON.stringify(modified))).toThrow(/hardwareData/);
  });

  it('rejects cross-profile markers, altered catalog identities and newer model fields inside a legacy design',()=>{
    const hardware=makeSave(createHardwareDesign()),legacy=makeSave(createDesign());
    expect(()=>parseSave(JSON.stringify({...hardware,modelVersion:legacy.modelVersion}))).toThrow();
    expect(()=>parseSave(JSON.stringify({...hardware,hardwareCatalogHash:'different-catalog'}))).toThrow();
    expect(()=>parseSave(JSON.stringify({...legacy,modelVersion:HARDWARE_SIM_MODEL_VERSION}))).toThrow();
    const mixed=structuredClone(legacy.design);mixed.parts[0].modelId='tsp45-fixed-v2';expect(()=>validateDesign(mixed)).toThrow();
    const unknown={...structuredClone(hardware.design),hardwareVersion:'future-version'};expect(()=>validateDesign(unknown)).toThrow();
    const wrongKind=structuredClone(hardware.design);wrongKind.parts[0].kind='camera';expect(()=>validateDesign(wrongKind)).toThrow();
    expect(parseSave(JSON.stringify(legacy)).design.hardwareVersion).toBeUndefined();
  });

  it('keeps M03 hardware drafts distinct from M01/M02 and legacy transfer engines',()=>{
    const plan=createTransferPlan(),save=makeTransferSave(plan,createHardwareDesign('mars','balanced'));
    expect(save.modelVersion).toBe(HARDWARE_TRANSFER_MODEL_VERSION);expect(save.craft.hardwareVersion).toBe(HARDWARE_VERSION);
    const copy=parseTransferSave(serializeTransferSave(save));expect(copy.craft).toEqual(save.craft);
    expect(()=>parseTransferSave(JSON.stringify({...save,modelVersion:HARDWARE_SIM_MODEL_VERSION}))).toThrow();
    expect(()=>parseTransferSave(JSON.stringify({...save,hardwareCatalogHash:'changed'}))).toThrow();
  });
  it('replays a real short M03 hardware checkpoint with its own controller and unchanged onboard fuel',()=>{
    const solution=solveTransferPlan(createTransferPlan()),s=createTransferRuntime(solution,createHardwareDesign('mars','balanced'));
    expect(s.status).toBe('running');advanceTransfer(s,1200);expect(s.time).toBe(1200);
    expect(s.modelVersion).toBe(HARDWARE_TRANSFER_MODEL_VERSION);expect(s.fuelKg).toBe(6);
    const saved=serializeTransferSave(makeTransferSave(s.solution.plan,s.craft,s)),restored=parseTransferSave(saved).runtime!;
    expect(restored.hardwareData).toEqual(s.hardwareData);expect(restored.time).toBe(s.time);
    expect(restored.energyWh).toBeCloseTo(s.energyWh,10);expect(restored.fuelKg).toBe(s.fuelKg);
    expect(restored.attitudeQuaternion).toEqual(s.attitudeQuaternion);
    const forged=JSON.parse(saved);forged.runtime.hardwareData.angularRateDegS+=.001;
    expect(()=>parseTransferSave(JSON.stringify(forged))).toThrow(/hardwareData/);
  });
});
