import {describe,it,expect} from 'vitest';
import {createDesign} from '../src/sim/catalog';
import {earthStateAt,EARTH_RADIUS_KM,groundPosition,magnitude,scale} from '../src/sim/physics';
import {evaluateEarthTarget,earthSubpoint,groundFootprintRadiusKm,getTargetRequirements,normalizeScienceTarget,scienceTargetKey,surfaceDistanceKm,type ScienceTarget} from '../src/sim/targets';
const overhead=(lat:number,lon:number,t:number,h:number)=>scale(groundPosition(lat,lon,t),(EARTH_RADIUS_KM+h)/EARTH_RADIUS_KM);

describe('selectable Earth science targets',()=>{
  it('preserves the legacy corridor quality and packet identity when no target is stored',()=>{
    const result=evaluateEarthTarget(undefined,overhead(35,45,0,600),0,600,.8);
    expect(result.eligible).toBe(true);expect(result.quality).toBe(.8);expect(result.cellId).toBe('6:8');expect(result.requirements.targetPackets).toBe(4);expect(result.requirements.packetBits).toBe(24e6);
    expect(evaluateEarthTarget(undefined,overhead(-20,45,0,600),0,600,1).eligible).toBe(false);
  });
  it('changes actual science eligibility when the selected region moves out of the nadir footprint',()=>{
    const p=overhead(35,45,0,600),near:ScienceTarget={profile:'precision',latDeg:35,lonDeg:45},far={...near,lonDeg:75};
    expect(evaluateEarthTarget(near,p,0,600,1).eligible).toBe(true);
    const miss=evaluateEarthTarget(far,p,0,600,1);expect(miss.eligible).toBe(false);expect(miss.reason).toBe('outside-footprint');
  });
  it('makes high altitude useful to a broad survey but too coarse for the precision objective',()=>{
    const p=overhead(36,44,0,1200),target={latDeg:36,lonDeg:44};
    const precision=evaluateEarthTarget({...target,profile:'precision'},p,0,1200,1),survey=evaluateEarthTarget({...target,profile:'survey'},p,0,1200,1);
    expect(precision.withinFootprint).toBe(true);expect(precision.groundSamplingDistanceM).toBeCloseTo(60,8);expect(precision.reason).toBe('resolution');expect(precision.eligible).toBe(false);
    expect(survey.eligible).toBe(true);expect(survey.requirements.targetPackets).toBe(4);
    expect(groundFootprintRadiusKm(1200)).toBeGreaterThan(groundFootprintRadiusKm(600));
  });
  it('requires the entire precision region inside the footprint, not merely its centre',()=>{
    const target:ScienceTarget={profile:'precision',latDeg:0,lonDeg:0};
    const r=groundFootprintRadiusKm(600),lon=(r-35)/EARTH_RADIUS_KM*180/Math.PI;
    const partial=evaluateEarthTarget(target,overhead(0,lon,0,600),0,600,1);
    expect(partial.targetDistanceKm).toBeLessThan(r);expect(partial.withinFootprint).toBe(false);
  });
  it('retains stable IDs for duplicate frames and different IDs for distinct survey cells',()=>{
    const target:ScienceTarget={profile:'survey',latDeg:36,lonDeg:44};
    const a=evaluateEarthTarget(target,overhead(36,44,0,600),0,600,1),b=evaluateEarthTarget(target,overhead(36,44,90,600),90,600,1),c=evaluateEarthTarget(target,overhead(36,48,90,600),90,600,1);
    expect(a.cellId).toBe(b.cellId);expect(a.cellId).not.toBe(c.cellId);expect(c.eligible).toBe(true);
  });
  it('rejects darkness and partial aperture visibility for precision while retaining survey tolerance',()=>{
    const precision:ScienceTarget={profile:'precision',latDeg:36,lonDeg:44},p=overhead(36,44,0,600);
    expect(evaluateEarthTarget(precision,p,0,600,.6).eligible).toBe(false);
    expect(evaluateEarthTarget({...precision,profile:'survey'},p,0,600,.6).eligible).toBe(true);
    const night={...precision,latDeg:0,lonDeg:-160},result=evaluateEarthTarget(night,overhead(0,-160,0,600),0,600,1);
    expect(result.withinFootprint).toBe(true);expect(result.reason).toBe('night');expect(result.eligible).toBe(false);
  });
  it('handles dateline and pole coordinates without unbounded footprints or duplicate longitude selections',()=>{
    expect(scienceTargetKey({profile:'survey',latDeg:0,lonDeg:181})).toBe(scienceTargetKey({profile:'survey',latDeg:0,lonDeg:-179}));
    expect(surfaceDistanceKm({latDeg:0,lonDeg:179},{latDeg:0,lonDeg:-179})).toBeLessThan(230);
    expect(groundFootprintRadiusKm(100000)).toBeLessThan(Math.PI/2*EARTH_RADIUS_KM);
    expect(normalizeScienceTarget({profile:'precision',latDeg:90,lonDeg:540})).toEqual({profile:'precision',latDeg:90,lonDeg:-180});
    expect(()=>normalizeScienceTarget({profile:'precision',latDeg:91,lonDeg:0})).toThrow();
  });
  it('has attainable precision and survey samples along each existing balanced/science Earth plan',()=>{
    for(const preset of ['balanced','science'] as const){
      const d=createDesign('earth',preset),centerState=earthStateAt(d.plan,1050),center=earthSubpoint(centerState.positionKm,1050);
      for(const profile of ['precision','survey'] as const){
        const target:ScienceTarget={profile,...center},cells=new Set<string>();let lastCapture=-1000;
        for(let t=300;t<=2300;t+=5){const s=earthStateAt(d.plan,t);const result=evaluateEarthTarget(target,s.positionKm,t,magnitude(s.positionKm)-EARTH_RADIUS_KM,1);if(result.eligible&&t-lastCapture>=90&&!cells.has(result.cellId)){cells.add(result.cellId);lastCapture=t;}}
        expect(cells.size,`${preset} ${profile} geometry has enough unique opportunities`).toBeGreaterThanOrEqual(getTargetRequirements(target).targetPackets);
      }
    }
  });
});
