/** Research-only offline source authoring; never called by the game. */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder=new URL('./data/',import.meta.url);
await mkdir(folder,{recursive:true});
const common={format:'json',OBJ_DATA:'YES',MAKE_EPHEM:'YES',EPHEM_TYPE:'VECTORS',CENTER:'500@10',START_TIME:'2026-08-01',STOP_TIME:'2028-03-01',STEP_SIZE:'6 h',REF_SYSTEM:'ICRF',REF_PLANE:'FRAME',OUT_UNITS:'KM-S',TIME_TYPE:'TDB',VEC_TABLE:'2',VEC_CORR:'NONE',CSV_FORMAT:'YES',VEC_LABELS:'YES'};
for(const [body,command] of [['earth','399'],['mars','499']]){
 const parameters={...common,COMMAND:command},url=new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
 for(const [key,value] of Object.entries(parameters))url.searchParams.set(key,key==='format'?value:`'${value}'`);
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Horizons ${response.status}`);
 const raw=await response.text(),payload=JSON.parse(raw);if(payload.error||!payload.result?.includes('$$SOE'))throw new Error(payload.error||raw.slice(0,2000));
 const result=payload.result,table=result.split('$$SOE')[1].split('$$EOE')[0];
 const states=table.trim().split(/\r?\n/).map(line=>{const columns=line.split(',').map(x=>x.trim());return [Number(columns[0]),...columns.slice(2,8).map(Number)];});
 if(states.some(row=>row.length!==7||row.some(x=>!Number.isFinite(x))))throw new Error('Invalid vector table');
 const dataset={schemaVersion:1,body,bodyId:command,origin:'Sun (10)',frame:'ICRF / FRAME (equatorial)',timeScale:'TDB',units:{position:'km',velocity:'km/s',epoch:'Julian day'},aberration:'NONE (geometric)',sourceUrl:url.href,retrievedAtUtc:new Date().toISOString(),sourceSha256:createHash('sha256').update(raw).digest('hex'),sourceSignature:payload.signature,sourceHeader:result.split('$$SOE')[0],columns:['jdTdb','x','y','z','vx','vy','vz'],stepSeconds:21600,states};
 await writeFile(new URL(`${body}-raw.json`,folder),raw);await writeFile(new URL(`${body}.json`,folder),JSON.stringify(dataset));
 console.log(`${body}: ${states.length} geometric Horizons states; ${dataset.sourceSha256}`);
}
