/** Sparse independent Horizons off-grid samples, with raw requests retained. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ephemerisAt} from '../transfer-prototype.ts';
import {magnitude,sub} from '../../src/sim/physics.ts';
const results=[];
for(const body of ['earth','mars']){
 const data=JSON.parse(await readFile(new URL(`./data/${body}.json`,import.meta.url),'utf8')),url=new URL(data.sourceUrl);for(const key of ['START_TIME','STOP_TIME','STEP_SIZE'])url.searchParams.delete(key);
 const epochs=[0,50,200,400,600,800,1000,1200,1400,1600,1800,2000,2300].map(i=>data.states[i][0]+.125);url.searchParams.set('TLIST',epochs.map(t=>`'${t}'`).join(' '));url.searchParams.set('TLIST_TYPE',"'JD'");
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Horizons ${response.status}`);const raw=await response.text(),result=JSON.parse(raw);if(result.error||!result.result?.includes('$$SOE'))throw new Error(result.error||raw.slice(0,2000));
 const rows=result.result.split('$$SOE')[1].split('$$EOE')[0].trim().split(/\r?\n/).map(line=>{const cols=line.split(',').map(s=>s.trim());return [Number(cols[0]),...cols.slice(2,8).map(Number)];});
 let maxPositionErrorKm=0,maxVelocityErrorKmS=0;for(const [jd,...s] of rows){const p=ephemerisAt(data,jd);maxPositionErrorKm=Math.max(maxPositionErrorKm,magnitude(sub(p.positionKm,s.slice(0,3))));maxVelocityErrorKmS=Math.max(maxVelocityErrorKmS,magnitude(sub(p.velocityKmS,s.slice(3))));}
 const detail={body,samples:rows.length,sourceUrl:url.href,sourceSha256:createHash('sha256').update(raw).digest('hex'),maxPositionErrorKm,maxVelocityErrorKmS,pass:maxPositionErrorKm<.01&&maxVelocityErrorKmS<1e-6};results.push(detail);await writeFile(new URL(`./data/${body}-offgrid-raw.json`,import.meta.url),raw);console.log(JSON.stringify(detail));
}
await writeFile(new URL('./interpolation-report.json',import.meta.url),JSON.stringify({generatedAtUtc:new Date().toISOString(),method:'cubic Hermite position/velocity; independently queried 13 midpoints per body; no global bound claimed',results,pass:results.every(x=>x.pass)},null,2));if(results.some(x=>!x.pass))process.exitCode=1;
