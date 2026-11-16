import {describe,it,expect} from 'vitest';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {historicalCases} from '../tools/swingby/historical-cases';
const base='tests/fixtures/swingby-historical/',hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
describe('pre-extraction transfer 3 exact compatibility gate',()=>{
 it('pins source, bundle and injective binary oracle before running the extracted kernel',()=>{
  const manifest=JSON.parse(readFileSync(base+'manifest.json','utf8'));
  expect(hash(readFileSync(base+'checkpoints.bin'))).toBe(manifest.fixtureSha256);
  expect(hash(readFileSync(base+'pre-extraction-engine.mjs'))).toBe(manifest.bundleSha256);
  for(const row of manifest.sourceFiles as {file:string;sha256:string}[])if(!['src/transfer/state.ts','src/transfer/runtime-v3.ts'].includes(row.file))expect(hash(readFileSync(row.file)),row.file).toBe(row.sha256);
 });
 it('preserves 52 whole physical/protocol/telemetry checkpoints, inputs and full early/no/late results exactly',()=>{
  const expected=deserialize(readFileSync(base+'checkpoints.bin')) as ReturnType<typeof historicalCases>,actual=historicalCases();
  expect(isDeepStrictEqual(actual.inputs,expected.inputs),'Factory input and solved trajectory drift').toBe(true);
  expect(actual.records.map(r=>r.name)).toEqual(expected.records.map(r=>r.name));
  for(let i=0;i<actual.records.length;i++)expect(actual.records[i].value,actual.records[i].name).toStrictEqual(expected.records[i].value);
  mkdirSync('docs/qa/swingby',{recursive:true});writeFileSync('docs/qa/swingby/extraction-exact.json',JSON.stringify({generatedAt:new Date().toISOString(),fixtureHash:hash(readFileSync(base+'checkpoints.bin')),count:actual.records.length,status:'PASS',scope:'Exact whole-checkpoint/telemetry/result equality with immutable pre-extraction binary oracle. No approximate tolerances or regenerated oracle.'},null,2));
 },180000);
});
