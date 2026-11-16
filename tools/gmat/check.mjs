/** Regression check against immutable states exported by an actual GMAT console run. */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const physics = await import(pathToFileURL(path.join(project,'src/sim/physics.ts')));
const summary = JSON.parse(await readFile(path.join(project,'public/data/gmat/validation-summary.json'),'utf8'));
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const sha = data=>createHash('sha256').update(data).digest('hex');
if(summary.gmatRelease!=='R2026a'||summary.pass!==true||summary.cases.length!==8)throw new Error('GMAT evidence set is missing or incomplete');
let failed=false,total=0;
for(const c of summary.cases){
  const reference=JSON.parse(await readFile(path.join(project,'public/data/gmat',c.id+'.json'),'utf8'));
  const raw=await readFile(path.join(project,'tools/gmat/evidence',c.id+'.csv'),'utf8');
  const script=await readFile(path.join(project,'tools/gmat/scripts',c.id+'.script'),'utf8');
  if(sha(raw)!==c.csvSha256||sha(script)!==c.scriptSha256)throw new Error(`${c.id}: evidence hash mismatch; rerun actual GMAT`);
  const rawStates=raw.trim().split(/\r?\n/).map(line=>line.split(',').map(Number));
  if(JSON.stringify(rawStates)!==JSON.stringify(reference.samples))throw new Error(`${c.id}: published data differs from actual GMAT report`);
  if(reference.samples.length!==c.sampleCount)throw new Error(`${c.id}: sample count mismatch`);
  let pos=0,vel=0;
  for(const [t,...state] of reference.samples){
    const requestedTime=Math.round(t/summary.sampleSeconds)*summary.sampleSeconds;
    if(Math.abs(t-requestedTime)>0.001)throw new Error(`${c.id}: invalid sample epoch`);
    const expected=c.body==='Earth'?physics.earthStateAt(c.plan,requestedTime):physics.marsStateAt(c.plan,requestedTime);
    pos=Math.max(pos,distance(state.slice(0,3),expected.positionKm));
    vel=Math.max(vel,distance(state.slice(3),expected.velocityKmS));
  }
  const pass=Number.isFinite(pos)&&Number.isFinite(vel)&&pos<=summary.tolerance.maxPositionErrorKm&&vel<=summary.tolerance.maxVelocityErrorKmS;
  failed ||= !pass; total+=reference.samples.length;
  console.log(`${pass?'PASS':'FAIL'} ${c.id}: position ${(pos*1000).toFixed(4)} m, velocity ${(vel*1000).toFixed(6)} m/s`);
}
console.log(`${total} independent GMAT states checked; ${failed?'FAIL':'PASS'}`);
if(failed)process.exitCode=1;
