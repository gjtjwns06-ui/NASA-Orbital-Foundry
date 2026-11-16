import type {DeploymentPlan} from './deployment/plan';
import {getLanguage} from './i18n';
const word=(ko:string,en:string)=>getLanguage()==='ko'?ko:en;
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
type Item={id:string;kind:'action'|'operation';start:number;end:number;label:string;row:number};
const maximum=10800,minimum=5;
export function editDeploymentInterval(start:number,end:number,delta:number,resize:boolean){
 if(![start,end,delta].every(Number.isFinite)||start<0||end<=start||end>maximum)throw Error('INVALID_TIMELINE_INTERVAL');
 if(resize)return {start,end:Math.max(Math.min(maximum,start+minimum),Math.min(maximum,end+delta))};
 const moved=Math.max(0,Math.min(maximum-(end-start),start+delta));return {start:moved,end:moved+(end-start)};
}
/** Edits command eligibility/deadline windows, not inferred motor duration.
 * The host's Worker validates every committed plan before flight. */
export class DeploymentTimeline{
 readonly element=document.createElement('section');
 private header=document.createElement('div');private track=document.createElement('div');private ticks=document.createElement('div');private hint=document.createElement('p');
 private plan:DeploymentPlan|null=null;private locked=false;private currentTime=0;private rangeStart=0;private span=1800;
 private drag:{pointerId:number;item:Item;x:number;width:number;resize:boolean;original:DeploymentPlan;candidate:DeploymentPlan}|null=null;
 private marker=document.createElement('i');private disposed=false;
 constructor(parent:HTMLElement,private changed:(plan:DeploymentPlan)=>void){
  this.element.className='deployment-timeline';this.header.className='deployment-timeline-head';this.track.className='deployment-time-track';this.ticks.className='deployment-time-ticks';this.marker.className='deployment-now';this.hint.className='deployment-time-hint';
  this.element.append(this.header,this.track,this.ticks,this.hint);parent.append(this.element);
  this.element.addEventListener('click',this.click);this.track.addEventListener('pointerdown',this.down);this.track.addEventListener('pointermove',this.move);this.track.addEventListener('pointerup',this.up);this.track.addEventListener('pointercancel',this.cancelEvent);this.track.addEventListener('lostpointercapture',this.cancelEvent);this.track.addEventListener('keydown',this.key);window.addEventListener('keydown',this.escape);window.addEventListener('blur',this.cancelEvent);
 }
 set(plan:DeploymentPlan,locked:boolean,time=0){
  const changed=JSON.stringify(this.plan)!==JSON.stringify(plan)||this.locked!==locked;this.locked=locked;this.currentTime=time;
  if(changed){this.cancel();this.plan=structuredClone(plan);this.paint();}else this.updateMarker();
 }
 private items(plan=this.plan):Item[]{if(!plan)return [];return [
  ...plan.actions.map((a,i)=>({id:a.id,kind:'action' as const,start:a.earliestSeconds,end:a.deadlineSeconds,row:i,label:`${a.partId==='wing'?word('태양판','Solar wing'):a.partId==='antenna'?word('안테나','Antenna'):a.partId} · ${a.desired==='deployed'?word('전개','Deploy'):word('수납','Stow')}`})),
  ...plan.operations.map(o=>({id:o.id,kind:'operation' as const,start:o.startSeconds,end:o.endSeconds,row:plan.actions.length,label:o.kind==='charge'?word('충전','Charge'):`${word('송신','Downlink')} · ${o.stationId??word('자동 지상국','Automatic station')}`})),
 ];}
 private patch(plan:DeploymentPlan,item:Item,start:number,end:number){const copy=structuredClone(plan);if(item.kind==='action'){const a=copy.actions.find(a=>a.id===item.id)!;a.earliestSeconds=start;a.deadlineSeconds=end;}else{const o=copy.operations.find(o=>o.id===item.id)!;o.startSeconds=start;o.endSeconds=end;}return copy;}
 private overlapping(plan:DeploymentPlan){const sorted=plan.operations.slice().sort((a,b)=>a.startSeconds-b.startSeconds);return sorted.some((o,i)=>i>0&&o.startSeconds<sorted[i-1].endSeconds);}
 private paint(){
  if(this.disposed||!this.plan||this.drag)return;const focused=(document.activeElement as HTMLElement)?.dataset.deploymentBlock;
  this.header.innerHTML=`<strong>${word('기체에 실을 실행 일정','ONBOARD PROGRAMME')}</strong><div><button data-time-action="previous" ${this.rangeStart===0?'disabled':''}>←</button><button data-time-action="range">${this.span/60} ${word('분 보기','min view')}</button><button data-time-action="next" ${this.rangeStart+this.span>=maximum?'disabled':''}>→</button><button data-time-action="now">${word('현재 시각','Current time')}</button></div>`;
  const items=this.items(),rows=Math.max(2,this.plan.actions.length+1);this.track.style.height=`${rows*30+4}px`;
  this.track.innerHTML=items.filter(i=>i.end>this.rangeStart&&i.start<this.rangeStart+this.span).map(i=>{const left=Math.max(0,(i.start-this.rangeStart)/this.span*100),right=Math.min(100,(i.end-this.rangeStart)/this.span*100),label=`${i.label} · ${i.start}s → ${i.end}s`;return `<div class="deployment-time-block ${i.kind}" tabindex="0" role="group" aria-label="${escape(label)}" data-deployment-block="${escape(i.id)}" style="left:${left}%;width:${Math.max(.35,right-left)}%;top:${i.row*30+2}px" title="${escape(label)}"><span>${escape(i.label)}</span><i data-time-resize></i></div>`;}).join('');
  this.track.append(this.marker);this.track.classList.toggle('locked',this.locked);this.updateMarker();
  this.ticks.innerHTML=Array.from({length:7},(_,i)=>`<span>${Math.round((this.rangeStart+this.span*i/6)/60)}m</span>`).join('');
  this.hint.textContent=this.locked?word('탑재 일정 실행 중 · 위쪽 줄은 시작 가능 시각부터 마감까지의 창입니다.','Onboard programme executing · Upper rows show earliest-start/deadline windows.') :word('블록 드래그: 이동 · 오른쪽 끝: 길이 · ←→ 5초 / Shift 1분 / Alt 길이 · 전개 창은 실제 모터 작동시간과 다릅니다.','Drag: move · Right edge: resize · ←→ 5s / Shift 1min / Alt resize · Deployment windows are not motor durations.');
  if(focused)this.track.querySelector<HTMLElement>(`[data-deployment-block="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
 }
 private updateMarker(){const visible=this.currentTime>=this.rangeStart&&this.currentTime<=this.rangeStart+this.span;this.marker.hidden=!visible;this.marker.style.left=`${(this.currentTime-this.rangeStart)/this.span*100}%`;this.marker.title=`T+${this.currentTime.toFixed(2)}s`;}
 private click=(e:MouseEvent)=>{const action=(e.target as HTMLElement).closest<HTMLElement>('[data-time-action]')?.dataset.timeAction;if(!action||this.drag)return;if(action==='range'){this.span=this.span===1800?5400:this.span===5400?10800:1800;this.rangeStart=Math.min(this.rangeStart,maximum-this.span);}if(action==='previous')this.rangeStart=Math.max(0,this.rangeStart-this.span);if(action==='next')this.rangeStart=Math.min(maximum-this.span,this.rangeStart+this.span);if(action==='now')this.rangeStart=Math.min(maximum-this.span,Math.floor(this.currentTime/this.span)*this.span);this.paint();};
 private down=(e:PointerEvent)=>{
  const el=(e.target as HTMLElement).closest<HTMLElement>('[data-deployment-block]');if(!el||!this.plan||this.locked||e.button!==0)return;
  const item=this.items().find(i=>i.id===el.dataset.deploymentBlock)!;e.preventDefault();el.focus();this.drag={pointerId:e.pointerId,item,x:e.clientX,width:this.track.getBoundingClientRect().width,resize:!!(e.target as HTMLElement).closest('[data-time-resize]'),original:structuredClone(this.plan),candidate:structuredClone(this.plan)};this.track.setPointerCapture(e.pointerId);
 };
 private move=(e:PointerEvent)=>{
  const d=this.drag;if(!d||e.pointerId!==d.pointerId)return;const delta=Math.round((e.clientX-d.x)/d.width*this.span/5)*5,interval=editDeploymentInterval(d.item.start,d.item.end,delta,d.resize);d.candidate=this.patch(d.original,d.item,interval.start,interval.end);
  const block=this.track.querySelector<HTMLElement>(`[data-deployment-block="${CSS.escape(d.item.id)}"]`);if(block){block.style.left=`${Math.max(0,(interval.start-this.rangeStart)/this.span*100)}%`;block.style.width=`${Math.max(.35,(Math.min(this.rangeStart+this.span,interval.end)-Math.max(this.rangeStart,interval.start))/this.span*100)}%`;block.classList.toggle('invalid',this.overlapping(d.candidate));}
  this.hint.textContent=`${d.item.label}: ${interval.start}s → ${interval.end}s${this.overlapping(d.candidate)?word(' · 운용 구간이 겹칩니다. 놓으면 원래 일정으로 돌아갑니다.',' · Operating intervals overlap. Release restores the original plan.'):''}`;
 };
 private release(){const d=this.drag;this.drag=null;if(d&&this.track.hasPointerCapture(d.pointerId))this.track.releasePointerCapture(d.pointerId);return d;}
 private up=(e:PointerEvent)=>{if(!this.drag||this.drag.pointerId!==e.pointerId)return;const d=this.release()!;if(!this.overlapping(d.candidate)&&JSON.stringify(d.candidate)!==JSON.stringify(d.original)){this.plan=d.candidate;this.changed(structuredClone(d.candidate));}this.paint();};
 cancel(){if(!this.drag)return;this.release();this.paint();}
 private cancelEvent=()=>this.cancel();private escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&this.drag){e.preventDefault();this.cancel();}};
 private key=(e:KeyboardEvent)=>{if(this.locked||!this.plan||this.drag||!['ArrowLeft','ArrowRight'].includes(e.key))return;const el=(e.target as HTMLElement).closest<HTMLElement>('[data-deployment-block]'),item=this.items().find(i=>i.id===el?.dataset.deploymentBlock);if(!item)return;e.preventDefault();const interval=editDeploymentInterval(item.start,item.end,(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?60:5),e.altKey),next=this.patch(this.plan,item,interval.start,interval.end);if(this.overlapping(next)){this.hint.textContent=word('운용 구간이 겹쳐 변경하지 않았습니다.','Overlapping operating windows: the original plan is retained.');return;}this.plan=next;this.changed(structuredClone(next));this.paint();};
 getState(){return {rangeStart:this.rangeStart,rangeEnd:this.rangeStart+this.span,currentTime:this.currentTime,locked:this.locked,dragging:!!this.drag,plan:this.plan?structuredClone(this.plan):null};}
 dispose(){this.cancel();this.disposed=true;this.element.removeEventListener('click',this.click);this.track.removeEventListener('pointerdown',this.down);this.track.removeEventListener('pointermove',this.move);this.track.removeEventListener('pointerup',this.up);this.track.removeEventListener('pointercancel',this.cancelEvent);this.track.removeEventListener('lostpointercapture',this.cancelEvent);this.track.removeEventListener('keydown',this.key);window.removeEventListener('keydown',this.escape);window.removeEventListener('blur',this.cancelEvent);this.element.remove();}
}
