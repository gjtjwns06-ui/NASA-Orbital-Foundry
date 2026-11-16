import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {KeyboardPlacement,keyboardPlacementHTML} from '../src/keyboard-assembly';
import {createDesign} from '../src/sim/catalog';
import {createHardwareDesign} from '../src/hardware';
import {evaluatePlacement} from '../src/sim/assembly';
import type {Part} from '../src/sim/types';
const battery:Part={id:'new-battery',kind:'battery',face:'py',u:0,v:0,rotation:0};
describe('keyboard assembly uses unchanged placement physics',()=>{
 it('previews are detached; valid and invalid placements equal the pointer validator',()=>{
  const design=createDesign('earth','starter'),before=structuredClone(design),edit=new KeyboardPlacement(design,battery);
  edit.key('ArrowRight');edit.key('ArrowUp',true);expect(edit.candidate).toMatchObject({u:.02,v:.005});
  expect(edit.validation(design)).toEqual(evaluatePlacement(design,edit.candidate));expect(edit.validation(design).valid).toBe(true);
  edit.update({u:1});expect(edit.validation(design)).toEqual(evaluatePlacement(design,edit.candidate));expect(edit.validation(design).valid).toBe(false);
  expect(design).toEqual(before);expect(battery.u).toBe(0);
 });
 it('existing-part move does not collide with itself and rejects another actual module',()=>{
  const design=createDesign('earth','balanced'),part=design.parts.find(p=>p.kind==='battery')!,edit=new KeyboardPlacement(design,part);
  expect(edit.validation(design).valid).toBe(true);edit.update({u:.28});
  expect(edit.validation(design).valid).toBe(false);expect(edit.validation(design).reasons.some(r=>r.includes('간섭'))).toBe(true);
  expect(design.parts.find(p=>p.id===part.id)).toEqual(part);
 });
 it('hardware service-bay and engine face restrictions remain authoritative',()=>{
  const design=createHardwareDesign('earth','starter'),part={...battery,modelId:'bpx100-4s2p-v2'},edit=new KeyboardPlacement(design,part);
  edit.update({face:'pz'});expect(edit.validation(design)).toEqual(evaluatePlacement(design,edit.candidate));expect(edit.validation(design).valid).toBe(false);
  edit.update({face:'py'});expect(edit.validation(design).valid).toBe(true);
 });
 it('fine nudges do not accumulate visible coordinate drift and rotation wraps',()=>{
  const design=createDesign('earth','starter'),edit=new KeyboardPlacement(design,battery);
  for(let i=0;i<20;i++)edit.key('ArrowRight',true);expect(edit.candidate.u).toBe(.1);
  edit.key('r',true);expect(edit.candidate.rotation).toBe(345);edit.key('r');expect(edit.candidate.rotation).toBe(0);
  expect(edit.key(' ')).toBe(false);expect(edit.key('Delete')).toBe(false);
 });
 it('nonfinite fields and stale source designs cannot be committed',()=>{
  const design=createDesign('earth','starter'),edit=new KeyboardPlacement(design,battery);edit.update({u:NaN});expect(edit.validation(design).valid).toBe(false);expect(edit.candidate.u).toBe(0);
  edit.update({u:.02});expect(edit.validation(design).valid).toBe(true);design.parts.push({...battery,id:'another'});expect(edit.validation(design).valid).toBe(false);
 });
 it('both language alternatives expose labeled fields and explicit uncommitted/cancel semantics',()=>{
  const design=createDesign('earth','starter'),edit=new KeyboardPlacement(design,battery);
  const en=keyboardPlacementHTML(edit,design,true),ko=keyboardPlacementHTML(edit,design,false);
  expect(en).toContain('Preview only');expect(en).toContain('role="status"');expect(en).toContain('Cancel · Esc');expect(ko).toContain('배치 확정');
  for(const field of ['face','u','v','rotation'])expect(en).toContain(`data-kb-field="${field}"`);
 });
 it('all41 pinned physical source identities are unchanged',()=>{
  const manifest=JSON.parse(readFileSync('docs/redesign-engine-manifest.json','utf8'));
  expect(Object.keys(manifest.files)).toHaveLength(41);
  for(const [path,hash] of Object.entries(manifest.files))expect(createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n?/g,'\n')).digest('hex'),path).toBe(hash);
 });
});
