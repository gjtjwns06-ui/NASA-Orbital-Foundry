import earthJson from './data/earth.json';
import marsJson from './data/mars.json';
import {ephemerisAt,type EphemerisTable} from './math';
export const TRANSFER_DATASET_ID='jpl-horizons-icrf-tdb-20260801-20280301-v1';
export const TRANSFER_DATA_SOURCES=Object.freeze({
 earth:Object.freeze({url:earthJson.sourceUrl,sha256:earthJson.sourceSha256,ephemeris:'DE441',bodyId:399}),
 mars:Object.freeze({url:marsJson.sourceUrl,sha256:marsJson.sourceSha256,ephemeris:'mar099; Sun origin DE441',bodyId:499}),
 frame:'ICRF',origin:'Sun',timeScale:'TDB',aberration:'NONE',stepSeconds:21600,
});
function table(raw:unknown):EphemerisTable {
 const value=raw as EphemerisTable;
 if(value.timeScale!=='TDB'||value.stepSeconds!==21600||value.states.length!==2313)throw new Error('Bundled ephemeris metadata is inconsistent');
 for(let i=0;i<value.states.length;i++){const row=value.states[i];if(row.length!==7||!row.every(Number.isFinite)||(i>0&&Math.abs(row[0]-value.states[i-1][0]-.25)>1e-10))throw new Error('Bundled ephemeris table is malformed');}
 value.states.forEach(Object.freeze);Object.freeze(value.states);Object.freeze(value);return value;
}
const earth=table(earthJson),mars=table(marsJson);
export const EPHEMERIS_START_JD_TDB=earth.states[0][0],EPHEMERIS_END_JD_TDB=earth.states.at(-1)![0];
/** Shared frozen source objects; callers must not mutate data. */
export function transferEphemerides(){return {earth,mars};}
export function transferPlanetState(body:'earth'|'mars',jdTdb:number){return ephemerisAt(body==='earth'?earth:mars,jdTdb);}
/** Calendar labels are explicitly TDB. No implicit conversion from physical UTC. */
export function tdbCalendarToJd(label:string):number {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(label))throw new Error('TDB 날짜는 YYYY-MM-DD 형식이어야 합니다.');
 const milliseconds=Date.parse(label+'T00:00:00Z');if(!Number.isFinite(milliseconds)||new Date(milliseconds).toISOString().slice(0,10)!==label)throw new Error('유효하지 않은 TDB 날짜입니다.');return milliseconds/86400000+2440587.5;
}
export function jdToTdbCalendar(jd:number):string {if(!Number.isFinite(jd))throw new Error('유효하지 않은 TDB 시각입니다.');return new Date((jd-2440587.5)*86400000).toISOString().slice(0,10);}
