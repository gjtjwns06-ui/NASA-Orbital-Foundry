import {describe,it,expect} from 'vitest';
import {craftKey,parseJourney,type JourneySnapshot} from '../src/solar/journey-save';
import {freshCampaign,recordDiscovery,parseCampaign,boundedReceivedScience,type ReceivedScience} from '../src/solar/campaign';
import {createOperations,encounterFrame,advanceOperations,releaseExposure,executeCommand,type OperationsState} from '../src/solar/operations';
import {findDefaultSolarRoute,SOLAR_EPOCH_JD} from '../src/solar/model';
import type {Vec3} from '../src/sim';

const jpeg='data:image/jpeg;base64,/9j/AA==';
function fixture(){
 const campaign=freshCampaign(),design=campaign.design,route=findDefaultSolarRoute('earth','aster',SOLAR_EPOCH_JD);
 if(route.status!=='solved')throw new Error('The starter route must solve for the checkpoint regression.');
 const operations=createOperations(design,'aster',route.arrivalVInfinityKmS);operations.playSeconds=75;
 const snapshot:JourneySnapshot={version:2,designKey:craftKey(design),target:'aster',departureJd:route.departureJdTdb,flightDays:route.flightDays,phase:'encounter',flight:1,flybySeconds:0,flybySeen:false,incidentResolved:true,incidentActive:false,view:'instrument',band:'visible',operations,assistRequest:null,images:{},sendElapsedSeconds:0};
 return {campaign,design,route,snapshot};
}
function contextCapture(state:OperationsState){
 let s=state;
 for(let i=0;i<60;i++){const p=encounterFrame(s).positionKm;const dir=p.map(x=>-x/Math.hypot(...p)) as Vec3;s=advanceOperations(s,.02,{aimDirection:dir,fovDeg:65,shutterHeld:true,band:'visible'});}
 return releaseExposure(s).state;
}
function science():ReceivedScience {
 return {instrument:'spectrometer',model:'local-hyperbola-synthetic-response-v1',samples:[
  {id:'obs-1',kind:'spectrum',featureId:'venus-region-3',band:'visible',quality:.9,snr:35,smearPixels:.1,gsdM:20,exposureSeconds:1.2,image:jpeg,reflectanceEstimate:.30,reflectanceUncertainty:.01},
  {id:'obs-2',kind:'spectrum',featureId:'venus-region-3',band:'nir',quality:.88,snr:30,smearPixels:.12,gsdM:20,exposureSeconds:1.3,reflectanceEstimate:.24,reflectanceUncertainty:.008},
 ]};
}

describe('active journey persistence boundaries',()=>{
 it('restores a suspended real encounter and acquired image while stopping held exposure',()=>{
  const {design,snapshot,route}=fixture();snapshot.operations=contextCapture(snapshot.operations);expect(snapshot.operations.records).toHaveLength(1);
  snapshot.images[snapshot.operations.records[0].id]=jpeg;
  const p=encounterFrame(snapshot.operations).positionKm;
  snapshot.operations=advanceOperations(snapshot.operations,.1,{aimDirection:p.map(v=>-v/Math.hypot(...p)) as Vec3,fovDeg:65,shutterHeld:true,band:'visible'});
  snapshot.operations=executeCommand(snapshot.operations,'safe-mode');expect(snapshot.operations.exposure).not.toBeNull();
  const restored=parseJourney(JSON.stringify(snapshot),design)!;
  expect(restored).not.toBeNull();expect(restored.snapshot.phase).toBe('encounter');expect(restored.snapshot.operations.playSeconds).toBe(snapshot.operations.playSeconds);
  expect(restored.snapshot.operations.exposure).toBeNull();expect(restored.snapshot.operations.pendingCommand?.command).toBe('safe-mode');
  expect(restored.snapshot.operations.records[0]).toEqual(snapshot.operations.records[0]);expect(restored.snapshot.images).toEqual(snapshot.images);expect(restored.route.arrivalJdTdb).toBe(route.arrivalJdTdb);
 });
 it('rejects a checkpoint belonging to an edited craft or a different target instead of silently replacing current design',()=>{
  const {design,snapshot}=fixture();const changed=structuredClone(design);changed.parts[0].rotation=90;
  expect(parseJourney(JSON.stringify(snapshot),changed)).toBeNull();
  expect(parseJourney(JSON.stringify({...snapshot,target:'mars'}),design)).toBeNull();
  expect(parseJourney(JSON.stringify({...snapshot,phase:'swingby',assistRequest:null}),design)).toBeNull();
 });
 it('rejects invalid epochs/progress/serialized nonfinite numbers without crashing the load screen',()=>{
  const {design,snapshot}=fixture();
  for(const changed of [{flight:1.01},{flight:-.1},{departureJd:1e300},{flightDays:Infinity},{sendElapsedSeconds:NaN},{phase:'unknown'}])expect(parseJourney(JSON.stringify({...snapshot,...changed}),design)).toBeNull();
  expect(parseJourney('{',design)).toBeNull();expect(parseJourney('x'.repeat(2500001),design)).toBeNull();
 });
 it('recomputes trajectory and hardware calibration rather than trusting saved physics',()=>{
  const {design,snapshot}=fixture();snapshot.operations.encounter.muKm3S2=1e100;snapshot.operations.batteryCapacityWh=1e100;snapshot.operations.downlinkRateBps=1e100;
  const restored=parseJourney(JSON.stringify(snapshot),design)!;expect(restored).not.toBeNull();expect(restored.snapshot.operations.encounter.muKm3S2).not.toBe(1e100);expect(restored.snapshot.operations.batteryCapacityWh).not.toBe(1e100);expect(restored.snapshot.operations.downlinkRateBps).not.toBe(1e100);
 });
 it('keeps only bounded local photographs belonging to actual acquired records',()=>{
  const {design,snapshot}=fixture();snapshot.operations=contextCapture(snapshot.operations);const id=snapshot.operations.records[0].id;
  snapshot.images={[id]:'https://example.org/tracker.jpg',unknown:jpeg};expect(parseJourney(JSON.stringify(snapshot),design)?.snapshot.images).toEqual({});
  snapshot.images[id]='data:image/jpeg;base64,'+'A'.repeat(200001);expect(parseJourney(JSON.stringify(snapshot),design)?.snapshot.images).toEqual({});
 });
});

describe('received science is optional, bounded and backward compatible',()=>{
 it('preserves an old three-observation discovery and adds a real two-sample spectral return',()=>{
  const before=recordDiscovery(freshCampaign(),'aster',SOLAR_EPOCH_JD+100,jpeg),savedBefore=JSON.stringify(before);
  const received=recordDiscovery(before,'venus',SOLAR_EPOCH_JD+200,jpeg,science());const loaded=parseCampaign(JSON.stringify(received));
  expect(JSON.stringify(before)).toBe(savedBefore);expect(loaded.discoveries).toHaveLength(2);expect(loaded.discoveries[0].observations).toBe(3);expect(loaded.discoveries[0].science).toBeUndefined();
  expect(loaded.discoveries[1].observations).toBe(2);expect(loaded.discoveries[1].science?.samples[0].reflectanceEstimate).toBe(.3);expect(loaded.discoveries[1].science?.samples[1].reflectanceUncertainty).toBe(.008);
 });
 it('does not turn explicitly invalid new measurements into a fabricated legacy three-observation result',()=>{
  const before=freshCampaign(),invalid={...science(),samples:[]} as ReceivedScience;
  expect(recordDiscovery(before,'venus',SOLAR_EPOCH_JD+100,undefined,invalid)).toEqual(before);
 });
 it('does not inflate returned sample counts through duplicated IDs or instrument/kind mismatch',()=>{
  const supplied=science();supplied.samples.push({...supplied.samples[0]});expect(boundedReceivedScience(supplied)?.samples).toHaveLength(2);
  const mismatched={...science(),instrument:'camera'};expect(boundedReceivedScience(mismatched)).toBeUndefined();
 });
 it('strips malformed scientific/image fields while retaining compatible historical campaign progress',()=>{
  const received=recordDiscovery(freshCampaign(),'venus',SOLAR_EPOCH_JD+100,jpeg,science());
  const raw=JSON.parse(JSON.stringify(received));raw.discoveries[0].science.samples[0].quality=1e300;raw.discoveries[0].science.samples[1].image='data:image/svg+xml;base64,PHN2Zz4=';
  const loaded=parseCampaign(JSON.stringify(raw));expect(loaded.discoveries).toHaveLength(1);expect(loaded.discoveries[0].science?.samples).toHaveLength(1);expect(loaded.discoveries[0].science?.samples[0].image).toBeUndefined();
  const sample:any={...science().samples[0],reflectanceEstimate:Infinity,reflectanceUncertainty:-1};const bounded=boundedReceivedScience({...science(),samples:[sample]});
  const estimate=bounded?.samples[0]?.reflectanceEstimate;expect(estimate==null||(Number.isFinite(estimate)&&estimate>=0&&estimate<=1)).toBe(true);
 });
});
