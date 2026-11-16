import {describe,it,expect} from 'vitest';
import {campaignReadiness,freshCampaign,observationProfile,parseCampaign,recordDiscovery} from '../src/solar/campaign';
import {findDefaultSolarRoute,SOLAR_EPOCH_JD,SOLAR_MAX_JD,type SolarBodyId} from '../src/solar/model';
import {createHardwareDesign} from '../src/hardware';
import {evaluatePlacement} from '../src/sim/assembly';

const asteroidRoute=findDefaultSolarRoute('earth','aster');
const marsRoute=findDefaultSolarRoute('earth','mars');

describe('solar expedition instruments and received discoveries',()=>{
  it('starts with the camera needed for asteroid morphology, then requires a spectrometer at Mars',()=>{
    const campaign=freshCampaign();
    expect(campaign.introSeen).toBe(false);
    expect(campaign.design.parts.some(part=>part.kind==='camera')).toBe(true);
    expect(campaignReadiness(campaign.design,asteroidRoute).ready).toBe(true);
    expect(campaignReadiness(campaign.design,marsRoute).issues).toContain('spectrometer');
    const science=campaign.design.parts.find(part=>part.kind==='camera')!;
    science.kind='spectrometer';
    expect(campaignReadiness(campaign.design,marsRoute).issues).not.toContain('spectrometer');
    expect(campaignReadiness(campaign.design,asteroidRoute).issues).toContain('camera');
  });

  it('links the next science question through all eight destinations without repeated generic labels',()=>{
    const expected:SolarBodyId[]=['aster','venus','mars','jupiter','saturn','uranus','neptune','mercury'];
    let target:SolarBodyId='aster';const labels=new Set<string>();
    for(const destination of expected){
      expect(target).toBe(destination);
      const profile=observationProfile(target);
      expect(profile.labelsKo).toHaveLength(3);expect(profile.labelsEn).toHaveLength(3);
      expect(profile.reasonKo.length).toBeGreaterThan(10);
      expect(profile.energyWh).toBeGreaterThan(0);
      labels.add(profile.labelsKo.join('/'));target=profile.next;
    }
    expect(target).toBe('aster');expect(labels.size).toBe(8);
    const edited=observationProfile('aster');edited.labelsKo[0]='mutated';
    expect(observationProfile('aster').labelsKo[0]).toBe('윤곽');
  });

  for(const obscured of ['camera','antenna'] as const){
    it(`moving a physically valid solar panel clears an obstructed ${obscured} without changing mass or fuel`,()=>{
      const design=createHardwareDesign('earth','balanced');
      const panel=design.parts.find(p=>p.kind==='solar')!,sensor=design.parts.find(p=>p.kind==='camera')!,antenna=design.parts.find(p=>p.kind==='antenna')!;
      panel.face='pz';panel.u=0;panel.v=0;
      if(obscured==='camera'){sensor.face='pz';sensor.u=0;sensor.v=.4;antenna.face='nz';}
      else {antenna.face='pz';antenna.u=0;antenna.v=.4;}
      // Both arrangements are buildable; this is line-of-sight, not overlapping solids.
      for(const part of design.parts)expect(evaluatePlacement(design,part).valid).toBe(true);
      const blocked=campaignReadiness(design,asteroidRoute);
      expect(blocked.ready).toBe(false);
      expect(blocked.issues).toEqual([obscured==='camera'?'sensor-blocked':'antenna-blocked']);
      expect(obscured==='camera'?blocked.sensorVisibility:blocked.antennaVisibility).toBe(0);
      panel.u=.35;
      for(const part of design.parts)expect(evaluatePlacement(design,part).valid).toBe(true);
      const clear=campaignReadiness(design,asteroidRoute);
      expect(clear.ready).toBe(true);
      expect(obscured==='camera'?clear.sensorVisibility:clear.antennaVisibility).toBe(1);
      expect(clear.massKg).toBe(blocked.massKg);expect(clear.fuelKg).toBe(blocked.fuelKg);
    });
  }

  it('accounts for an installed battery reserve and actual added payload mass',()=>{
    const hardware=createHardwareDesign('earth','balanced');
    hardware.parts=hardware.parts.filter(part=>part.kind!=='battery');
    expect(campaignReadiness(hardware,asteroidRoute).issues).toContain('battery');
    const campaign=freshCampaign(),before=campaignReadiness(campaign.design,asteroidRoute);
    campaign.design.parts.push({id:'extra-battery',kind:'battery',face:'py',u:-.28,v:.4,rotation:0});
    expect(evaluatePlacement(campaign.design,campaign.design.parts.at(-1)!).valid).toBe(true);
    const after=campaignReadiness(campaign.design,asteroidRoute);
    expect(after.massKg).toBeGreaterThan(before.massKg);
    expect(after.availableBatteryWh).toBeGreaterThan(before.availableBatteryWh);
    expect(after.fuelKg).toBeGreaterThan(before.fuelKg);
  });

  it('keeps a bounded captured JPEG with its discovery across save parsing, without rewriting the prior campaign',()=>{
    const campaign=freshCampaign(),before=JSON.stringify(campaign),image='data:image/jpeg;base64,/9j/2Q==';
    const recorded=recordDiscovery(campaign,'aster',SOLAR_EPOCH_JD+300,image);
    expect(JSON.stringify(campaign)).toBe(before);
    expect(recorded.discoveries).toHaveLength(1);expect(recorded.discoveries[0].image).toBe(image);
    expect(parseCampaign(JSON.stringify(recorded))).toEqual(recorded);
    const again=recordDiscovery(recorded,'aster',SOLAR_EPOCH_JD+301);
    expect(again.discoveries).toHaveLength(1);expect(again.discoveries[0].receivedJd).toBe(SOLAR_EPOCH_JD+301);
    const legacy={...recorded,discoveries:recorded.discoveries.map(({image,...d})=>d)};
    expect(parseCampaign(JSON.stringify(legacy))).toEqual(legacy);
  });

  it('drops external, malformed and oversized image payloads while retaining the received discovery',()=>{
    for(const image of ['https://example.com/tracker.jpg','data:image/svg+xml;base64,AAAA','data:image/jpeg;base64,AAAA<script>','data:image/jpeg;base64,'+'A'.repeat(400000)]){
      const recorded=recordDiscovery(freshCampaign(),'mars',SOLAR_EPOCH_JD+300,image);
      expect(recorded.discoveries).toHaveLength(1);expect(recorded.discoveries[0].image).toBeUndefined();
      const raw={...recorded,discoveries:[{...recorded.discoveries[0],image}]};
      expect(parseCampaign(JSON.stringify(raw)).discoveries[0].image).toBeUndefined();
    }
  });

  it('rejects finite but unrenderable receipt dates and admits the final light-time margin',()=>{
    const campaign=freshCampaign();
    for(const receivedJd of [1e300,-1e300,SOLAR_EPOCH_JD-1,SOLAR_MAX_JD+1.1]){
      expect(recordDiscovery(campaign,'aster',receivedJd)).toBe(campaign);
      const raw={...campaign,introSeen:true,discoveries:[{body:'aster',receivedJd,observations:3,craftName:'AURORA'}]};
      const parsed=parseCampaign(JSON.stringify(raw));
      expect(parsed.introSeen).toBe(true);expect(parsed.discoveries).toEqual([]);
    }
    expect(recordDiscovery(campaign,'neptune',SOLAR_MAX_JD+1).discoveries).toHaveLength(1);
  });
});
