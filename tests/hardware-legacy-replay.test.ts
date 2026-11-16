import {it,expect} from 'vitest';
import fixture from './fixtures/hardware-legacy-v2.json';
import {parseSave,getResult} from '../src/sim';
import {parseTransferSave} from '../src/transfer/persistence';
import {getTransferResult} from '../src/transfer/runtime';

for(const c of fixture.cases)it(`preserves actual v2 legacy checkpoint ${c.id}`,()=>{
 const restored=parseSave(JSON.stringify(c.save));expect(restored.simulation).toEqual(c.save.simulation);const result=getResult(restored.simulation!);for(const [key,value]of Object.entries(c.result))expect(result[key as keyof typeof result]).toEqual(value);
});
for(const key of ['partial','full'] as const)it(`preserves actual v2 transfer checkpoint ${key}`,()=>{
 const entry=fixture.transfer[key],text=typeof entry.save==='string'?entry.save:JSON.stringify(entry.save),restored=parseTransferSave(text);expect(restored.runtime).toBeDefined();const raw=JSON.parse(text);for(const [k,v]of Object.entries(raw.runtime))expect(restored.runtime![k as keyof typeof restored.runtime]).toEqual(v);if('result' in entry)expect(getTransferResult(restored.runtime!)).toEqual(entry.result);
},30000);
