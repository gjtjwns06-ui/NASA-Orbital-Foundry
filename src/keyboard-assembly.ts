import {evaluatePlacement} from './sim/assembly';
import {getPartDefinition} from './hardware';
import type {Design,Face,Part} from './sim/types';

export const ASSEMBLY_FACES:Face[]=['px','nx','py','ny','pz','nz'];
/** Editor-only transaction. Validation is the same authoritative placement
 * function used by pointer placement; no candidate mutates the design. */
export class KeyboardPlacement {
 readonly original:Part;
 readonly designIdentity:string;
 candidate:Part;
 invalidInput=false;
 constructor(design:Design,part:Part){this.original=structuredClone(part);this.candidate=structuredClone(part);this.designIdentity=JSON.stringify(design);}
 update(patch:Partial<Pick<Part,'face'|'u'|'v'|'rotation'>>){
  if(patch.face!==undefined&&!ASSEMBLY_FACES.includes(patch.face)||[patch.u,patch.v,patch.rotation].some(n=>n!==undefined&&!Number.isFinite(n))){this.invalidInput=true;return;}
  this.invalidInput=false;this.candidate={...this.candidate,...patch};
  this.candidate.rotation=((this.candidate.rotation%360)+360)%360;
 }
 key(key:string,fine=false):boolean{
  const p=this.candidate,step=fine?.005:.02,round=(n:number)=>Math.round(n*1e6)/1e6;
  if(key==='ArrowRight')this.update({u:round(p.u+step)});
  else if(key==='ArrowLeft')this.update({u:round(p.u-step)});
  else if(key==='ArrowUp')this.update({v:round(p.v+step)});
  else if(key==='ArrowDown')this.update({v:round(p.v-step)});
  else if(key.toLowerCase()==='r')this.update({rotation:p.rotation+(fine?-15:15)});
  else return false;
  return true;
 }
 validation(design:Design){
  if(this.invalidInput)return {valid:false,reasons:['유한한 숫자를 입력하세요.']};
  if(JSON.stringify(design)!==this.designIdentity)return {valid:false,reasons:['원본 설계가 변경되었습니다. 취소 후 다시 배치하세요.']};
  return evaluatePlacement(design,this.candidate);
 }
}
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function keyboardPlacementHTML(edit:KeyboardPlacement,design:Design,en:boolean){
 const p=edit.candidate,d=getPartDefinition(design,p),valid=edit.validation(design);
 return `<div class="keyboard-placement" role="region" aria-label="${en?'Keyboard placement':'키보드 배치'}"><div class="panel-head"><div class="eyebrow">KEYBOARD ASSEMBLY</div><h3>${esc(en?d.nameEn:d.name)}</h3></div><div class="panel-body"><p class="small-note">${en?'Preview only. Confirm applies one undoable change.':'미리보기입니다. 확정하면 한 번에 되돌릴 수 있는 변경이 적용됩니다.'}</p><div class="kb-actions"><button class="primary" data-kb-command="confirm" ${valid.valid?'':'disabled'}>${en?'Confirm':'배치 확정'}</button><button class="secondary" data-kb-command="cancel">${en?'Cancel · Esc':'취소 · Esc'}</button></div><p class="kb-status" role="status" aria-live="polite" aria-atomic="true" data-valid="${valid.valid}"></p><label>${en?'Mounting face':'장착면'}<select data-kb-field="face">${ASSEMBLY_FACES.map((f,i)=>`<option value="${f}" ${f===p.face?'selected':''}>${['+X','−X','+Y','−Y','+Z','−Z'][i]} · ${(en?['Right','Left','Top / service bay','Bottom','Front','Back']:['오른쪽','왼쪽','위 / 서비스 베이','아래','앞','뒤'])[i]}</option>`).join('')}</select></label><div class="kb-coordinates">${(['u','v','rotation'] as const).map(f=>`<label>${f==='rotation'?(en?'Rotation °':'회전 °'):f.toUpperCase()+' (m)'}<input data-kb-field="${f}" type="number" step="${f==='rotation'?15:.005}" value="${p[f]}" aria-label="${f==='rotation'?(en?'Rotation degrees':'회전 각도'):f.toUpperCase()+' metres'}"/></label>`).join('')}</div><button class="secondary kb-move-pad" data-kb-command="pad" aria-describedby="kb-key-help">${en?'Move with arrow keys':'방향키로 위치 조절'}<br><small>← −U · +U → / ↑ +V · −V ↓</small></button><p id="kb-key-help" class="small-note">${en?'Arrows: 2 cm · Shift: 5 mm. R / Shift+R: ±15°. Enter confirms; Escape restores your view. Numeric fields keep their native keys.':'방향키 2 cm · Shift 5 mm. R / Shift+R ±15°. Enter 확정 · Escape 이전 시점 복원. 숫자 입력란에서는 기본 키 동작을 사용합니다.'}</p></div></div>`;
}
export function installedPartsHTML(design:Design,en:boolean){
 return `<details class="keyboard-parts"><summary>${en?'Installed parts · keyboard edit':'장착 부품 · 키보드 편집'} (${design.parts.length})</summary>${design.parts.map(p=>{const d=getPartDefinition(design,p);return `<button class="secondary" data-keyboard-part="${esc(p.id)}">${esc(en?d.nameEn:d.name)} · ${p.face.toUpperCase()}</button>`;}).join('')}</details>`;
}
