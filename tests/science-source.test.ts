import {afterEach,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {setLanguage} from '../src/i18n';
import {scienceModelHTML} from '../src/ui-science';
import {HARDWARE_MODELS,HARDWARE_SIM_MODEL_VERSION,HARDWARE_TRANSFER_MODEL_VERSION,HARDWARE_CATALOG_HASH} from '../src/hardware/catalog';
import {getTargetRequirements} from '../src/sim/targets';

afterEach(()=>setLanguage('ko'));
describe('profile-specific scientific disclosure',()=>{
  it.each([
    ['ko','d8d9ddaba56398d7f4191752178d1c53a8903aff94d73589f62769b11127da83'],
    ['en','927510c362f9724bfaaf9c346dd8ce63fec17feab74f71b7b240084925312bec'],
  ] as const)('preserves the complete existing %s legacy disclosure unchanged', (language,priorHash)=>{
    setLanguage(language);const legacy=scienceModelHTML();expect(scienceModelHTML(false)).toBe(legacy);
    expect(createHash('sha256').update(legacy).digest('hex')).toBe(priorHash);
  });

  it('describes the actual hardware controller and data path without inheriting legacy rate or optics claims',()=>{
    setLanguage('en');const html=scienceModelHTML(true);
    expect(html).toContain(`MODEL ${HARDWARE_SIM_MODEL_VERSION}`);expect(html).toContain(`MODEL ${HARDWARE_TRANSFER_MODEL_VERSION}`);
    expect(html).not.toContain('20°/s');expect(html).not.toContain('50 µrad');
    expect(html).toContain('largest diagonal value I as a scalar approximation');expect(html).toContain('τ/I');expect(html).toContain('H/I');
    expect(html).toContain('accumulated wheel saturation/desaturation are not simulated');expect(html).toContain('one installed science instrument');
    expect(html).toContain('all bits pass the instrument-port and recorder bandwidth limits');expect(html).toContain('one selected powered/data-connected radio');
    expect(html).toContain('GMAT comparison validates the stated orbital position/velocity scope only');
    expect(html).toContain('does not certify the new hardware');expect(html).not.toMatch(/[가-힣]/);
  });

  it('renders model-specific authored optics and links both original sources and the pinned catalog identity',()=>{
    for(const language of ['ko','en'] as const){setLanguage(language);const html=scienceModelHTML(true);
      expect(html).toContain(HARDWARE_CATALOG_HASH);expect(html).toContain('href="/data/hardware-catalog-v2.json"');expect(html).toContain('href="/data/component-sources.json"');
      for(const id of ['wide-mono-v2','narrow-mono-v2','mars-spectra-v2']){const d=HARDWARE_MODELS[id],o=d.optics!;expect(html).toContain(language==='en'?d.nameEn:d.name);expect(html).toContain(`${o.halfAngleDeg}°`);expect(html).toContain(`${(o.bitsPerFrame/1e6).toFixed(2)} Mbit`);expect(html).toContain(`${o.exposureSeconds} s`);}
      for(const id of ['ax100u-carrier-v1','iris22-carrier-v1','xact15-carrier-v1'])expect(html).toContain(`href="${HARDWARE_MODELS[id].source}"`);
    }
  });

  it('distinguishes physical region windows from full frames and discloses coarse exposure sampling',()=>{
    setLanguage('en');const html=scienceModelHTML(true),o=HARDWARE_MODELS['narrow-mono-v2'].optics!,bitsPerPixel=o.bitsPerFrame/o.pixelsAcross**2;
    expect(html).toContain('Full frame');
    for(const profile of ['precision','survey'] as const){const pixels=o.regionReadout![profile];expect(html).toContain(`${pixels}×${pixels}-pixel`);expect(html).toContain(`${(pixels**2*bitsPerPixel/1e6).toFixed(6)} Mbit`);}
    expect(html).toContain(`a ${getTargetRequirements({profile:'precision',latDeg:0,lonDeg:0},true).regionRadiusKm} km radius`);
    expect(html).toContain('IFOV is unchanged');expect(html).toContain('detector-window ground width, optical FOV and ground resolution must all qualify');
    expect(html).toContain('5-second state samples and boundaries');expect(html).toContain('does not integrate millisecond attitude motion or real image smear');
  });
});
