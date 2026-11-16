import './review-ui.css';
import {getLanguage} from './i18n';
import {getSwingbyScenario,SWINGBY_PROPULSION} from './swingby/scenario';
import type {SwingbyPlan,SwingbyNumerics} from './swingby/types';
import type {Design} from './sim/types';
import type {VerifiedRun,RunId,Comparison,ReviewResponse,Target,SemanticChange} from './redesign/schema';
import {getReviewClient,ReviewCancelled} from './review-client';
import {SwingbyReviewScene} from './render/swingby-review-scene';

type Side='A'|'B';
type Sample=Extract<ReviewResponse,{type:'sample'}>;
type Archive=Extract<ReviewResponse,{type:'archive'}>;
export interface ReviewDraft {craft:Design;plan:SwingbyPlan;numerics:SwingbyNumerics;parentRunId:RunId}
export interface ReviewOptions {engineSaveText?:string;quality?:'high'|'medium'|'low';reducedMotion?:boolean;close:()=>void;fork:(draft:ReviewDraft)=>void}
const word=(ko:string,en:string)=>getLanguage()==='ko'?ko:en;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fmt=(v:number|null|undefined,d=2)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const clock=(v:number)=>`${Math.floor(v/86400)}d ${String(Math.floor(v/3600)%24).padStart(2,'0')}:${String(Math.floor(v/60)%60).padStart(2,'0')}:${String(Math.floor(v)%60).padStart(2,'0')}`;
const sign=(v:number,d=2)=>`${v>0?'+':''}${fmt(v,d)}`;
const errorText=(code:string)=>({REVIEW_WORKER_FAILED:word('분석 계산이 중단됐습니다. 비행으로 돌아간 뒤 다시 열 수 있습니다.','Review computation stopped. Return to flight and reopen this view.'),MODEL_UNSUPPORTED:word('이 보관함은 M02B 스윙바이 비행을 지원합니다.','This archive supports M02B swingby flights.'),ARCHIVE_CONFLICT:word('다른 창에서 보관함이 바뀌었습니다. 다시 불러와 확인하세요.','Another window changed the archive. Reload it before saving.'),STORAGE_UNAVAILABLE:word('브라우저 저장소를 사용할 수 없습니다. JSON 백업을 내려받으세요.','Browser storage is unavailable. Download a JSON backup.'),REVIEW_CAPACITY:word('검토 작업이 가득 찼습니다. 분석 화면을 다시 열어 주세요.','The review is at capacity. Reopen this view.')} as Record<string,string>)[code]??`${word('요청을 완료하지 못했습니다. 기존 비행과 보관본을 유지합니다.','The request did not complete. The existing flight and archive are preserved.')} (${code})`;

/** Detached postflight review. Its Worker receives only exact saves; it never
 * advances, edits or replaces the live flight represented by the caller. */
export class ReviewExperience {
 readonly element=document.createElement('div');
 readonly view:SwingbyReviewScene;
 private readonly client=getReviewClient();
 private readonly viewport=document.createElement('div');
 private readonly header=document.createElement('header');
 private readonly left=document.createElement('aside');
 private readonly right=document.createElement('aside');
 private readonly badge=document.createElement('div');
 private readonly timeline=document.createElement('section');
 private readonly slider=document.createElement('input');
 private readonly timelineTitle=document.createElement('div');
 private readonly markers=document.createElement('div');
 private readonly observer:ResizeObserver;
 private unsubscribe:()=>void;
 private baseline:VerifiedRun|null=null;private attempt:VerifiedRun|null=null;private current:VerifiedRun|null=null;
 private comparison:Comparison|null=null;private samples:Partial<Record<Side,Sample>>={};
 private side:Side='A';private requestedTime=0;private cursorPreview:number|null=null;private selectedPart:string|null=null;
 private progressOrder:RunId[]=[];private storageUnconfirmed=false;
 private busy=false;private task='';private fraction=0;private taskTime=0;private progressRun:RunId|null=null;
 private error='';private notice='';private memoryForkAllowed=false;private persisted=false;private revision:number|null=null;
 private generation=0;private closed=false;private dirty=true;private paintingAt=0;private raf=0;private previous=performance.now();
 private playing=false;private demand=0;private speed=3600;private framed=false;private scrubbing=false;
 constructor(private container:HTMLElement,private options:ReviewOptions){
  this.element.className='review-experience';this.viewport.className='review-viewport';this.header.className='review-header';
  this.left.className='review-panel review-left';this.right.className='review-panel review-right';this.badge.className='review-display-badge';this.timeline.className='review-timeline';
  this.timelineTitle.className='review-timeline-title';this.markers.className='review-event-markers';
  this.slider.type='range';this.slider.min='0';this.slider.max='1';this.slider.step='any';this.slider.value='0';this.slider.dataset.reviewCursor='true';this.slider.setAttribute('aria-label',word('분석 시각','Review time'));
  this.timeline.append(this.timelineTitle,this.markers,this.slider);this.element.append(this.viewport,this.header,this.left,this.right,this.badge,this.timeline);container.append(this.element);
  const s=getSwingbyScenario();
  this.view=new SwingbyReviewScene(this.viewport,{scenarioId:s.id,initialEpochJdTdb:s.epochJdTdb,aimPlane:s.aimPlane,goal:{targetDirection:s.exit.targetDirection,toleranceDeg:s.exit.toleranceDeg,energyRangeKm2S2:s.exit.energyRangeKm2S2},carrierProfile:SWINGBY_PROPULSION,quality:options.quality,reducedMotion:options.reducedMotion},{partSelected:id=>{this.selectedPart=id;this.dirty=true;},contextLost:()=>{this.playing=false;this.notice=word('그래픽 복구 중입니다. 분석 시각을 유지합니다.','Graphics are recovering. The review time is retained.');this.dirty=true;},contextRestored:()=>{this.notice=word('그래픽을 복구했습니다.','Graphics restored.');this.dirty=true;}});
  this.element.addEventListener('click',this.onClick);this.slider.addEventListener('input',this.onScrub);this.slider.addEventListener('change',this.onScrubCommit);this.slider.addEventListener('pointerdown',this.onScrubBegin);window.addEventListener('pointerup',this.onScrubEnd);window.addEventListener('keydown',this.onKey);document.addEventListener('visibilitychange',this.onVisibility);
  this.observer=new ResizeObserver(()=>this.layout());this.observer.observe(this.element);
  this.unsubscribe=this.client.onCommit(event=>{if(this.closed)return;this.revision=event.revision;this.persisted=false;this.storageUnconfirmed=true;this.rememberPair();this.notice=event.stale?word('이전 저장 요청이 이미 확정되었습니다. 보관함을 다시 열면 확정된 기록을 확인할 수 있습니다.','An earlier save had already committed. Reload the archive to see that record.'):word('보관함이 갱신되었습니다. 저장된 조합을 확인하고 있습니다.','The archive changed. Confirming which pair was stored.');this.dirty=true;});
  this.paint();this.raf=requestAnimationFrame(this.frame);void this.initialize();
 }
 private run(side=this.side){return side==='A'?this.baseline:this.attempt;}
 private limit(){const times=[this.baseline,this.attempt].filter((r):r is VerifiedRun=>!!r).map(r=>r.evaluation.committedTimeSeconds);return times.length?Math.min(...times):0;}
 private async operation(label:string,work:(alive:()=>boolean)=>Promise<void>){
  const token=++this.generation;this.client.cancel();this.busy=true;this.task=label;this.fraction=0;this.taskTime=0;this.progressRun=null;this.progressOrder=[];this.error='';this.dirty=true;
  const alive=()=>!this.closed&&token===this.generation;
  try{await work(alive);}catch(error){if(alive()&&!(error instanceof ReviewCancelled))this.error=errorText(error instanceof Error?error.message:String(error));}
  finally{if(alive()){this.busy=false;this.task='';this.dirty=true;}}
 }
 private progress=(m:Extract<ReviewResponse,{type:'progress'}>)=>{this.fraction=Math.max(0,Math.min(1,m.fraction));this.taskTime=m.committedTimeSeconds;this.progressRun=m.runId??null;if(m.runId&&!this.progressOrder.includes(m.runId))this.progressOrder.push(m.runId);this.dirty=true;};
 private rememberPair(){this.client.setSessionPair(this.baseline?{baseline:this.baseline,attempt:this.attempt,persisted:this.persisted,revision:this.revision,storageUnconfirmed:this.storageUnconfirmed}:null);}
 private async initialize(forceArchive=false){await this.operation(word('비행 기록 검증','Verifying flight records'),async alive=>{
  const memory=!forceArchive?this.client.getSessionPair():null;
  if(memory){this.baseline=memory.baseline;this.attempt=memory.attempt;this.persisted=memory.persisted;this.revision=memory.revision;this.storageUnconfirmed=memory.storageUnconfirmed??false;this.side=this.attempt?'B':'A';}
  else try{const loaded=await this.client.request({type:'load-archive'},this.progress);if(!alive())return;if(loaded.type==='archive')this.adopt(loaded);}
  catch(error){if(error instanceof ReviewCancelled)throw error;if(!alive())return;this.notice=errorText(error instanceof Error?error.message:String(error));}
  if(!alive())return;
  await this.client.releaseExcept(new Set([this.baseline?.source.runId,this.attempt?.source.runId].filter((v):v is RunId=>!!v)));if(!alive())return;
  if(memory){for(const run of [this.baseline,this.attempt])if(run){const restored=await this.client.request({type:'verify',source:run.source},this.progress);if(!alive())return;if(restored.type!=='verified')throw Error('REVIEW_RESPONSE');}}
  if(this.options.engineSaveText){
   const pin=await this.client.request({type:'pin',engineSaveText:this.options.engineSaveText,runId:crypto.randomUUID(),displayName:word('이번 비행','Current flight')},this.progress);if(!alive())return;if(pin.type!=='verified')throw Error('REVIEW_RESPONSE');
   this.current=pin.run;
   if(!this.baseline){this.baseline=pin.run;this.attempt=null;this.side='A';}else{this.attempt=pin.run;this.side='B';}
   this.persisted=false;
  }
  this.rememberPair();
  if(this.baseline){await this.compare(alive);if(!alive())return;this.requestedTime=this.limit();await this.sample(this.side,this.requestedTime,alive);}
 });}
 private adopt(a:Archive){
  this.baseline=a.baseline;this.attempt=a.attempt;this.revision=a.revision;this.persisted=a.persisted;this.storageUnconfirmed=false;
  this.side=this.attempt?'B':'A';this.samples={};this.comparison=null;this.framed=false;
  this.memoryForkAllowed=!!a.baseline&&!a.persisted&&!!a.storageError;this.rememberPair();
  this.notice=a.storageError?errorText(a.storageError):a.baseline?word('보관함의 비행 원본을 검증해 불러왔습니다.','Original flight saves verified and loaded from the archive.'):word('보관함에 저장된 비행이 없습니다.','No flights are stored in this archive.');
 }
 private async verifiedRequest(runs:readonly VerifiedRun[],request:()=>Promise<ReviewResponse>,alive:()=>boolean){
  const verify=async(run:VerifiedRun)=>{const response=await this.client.request({type:'verify',source:run.source},this.progress);if(!alive())throw new ReviewCancelled();if(response.type!=='verified')throw Error('REVIEW_RESPONSE');};
  for(const run of runs)if(!this.client.retainedRuns.has(run.source.runId))await verify(run);
  try{return await request();}catch(error){
   // An archive response can already be in transit when the user cancels it.
   // Its logical map may have changed although the original source is retained.
   // Reverify those exact bytes once; never substitute a different stored run.
   if(!(error instanceof Error)||error.message!=='RUN_NOT_VERIFIED'||!alive())throw error;
   for(const run of runs)await verify(run);
   return request();
  }
 }
 private async compare(alive:()=>boolean){
  this.comparison=null;if(!this.baseline||!this.attempt)return;
  const a=this.baseline,b=this.attempt;const r=await this.verifiedRequest([a,b],()=>this.client.request({type:'compare',beforeRunId:a.source.runId,afterRunId:b.source.runId}),alive);if(alive()&&r.type==='comparison')this.comparison=r.comparison;
 }
 private async sample(side:Side,seconds:number,alive:()=>boolean,target?:Target){
  const run=this.run(side);if(!run)return;
  const result=await this.verifiedRequest([run],()=>this.client.request(target?{type:'inspect',runId:run.source.runId,target}:{type:'seek',runId:run.source.runId,timeSeconds:seconds},this.progress),alive);
  if(!alive()||result.type!=='sample')return;
  this.view.setCommonCursor(result.cursor.requestedTimeSeconds);
  if(!this.view.setSample(side,result)||!this.view.setSide(side))throw Error('REVIEW_FRAME_INVALID');
  this.requestedTime=result.cursor.requestedTimeSeconds;this.samples[side]=result;this.side=side;
  if(!this.framed){this.view.setInspection(true);this.framed=true;}
  const focus=result.renderDto.reviewFocus;if(focus&&(focus.kind==='part'||focus.kind==='part-family')&&focus.partIds?.length){this.view.setInspection(true);this.view.focusPart(focus.partIds[0]);this.selectedPart=focus.partIds[0];}
  this.dirty=true;
 }
 private seek(seconds:number,side=this.side){
  const target=Math.max(0,Math.min(this.limit(),seconds));this.requestedTime=target;this.demand=target;this.cursorPreview=null;this.dirty=true;
  return this.operation(word('실제 기록 재생','Replaying actual history'),alive=>this.sample(side,target,alive));
 }
 private cancel(){this.playing=false;this.generation++;this.client.cancel();this.busy=false;this.task='';this.cursorPreview=null;this.notice=word('분석을 취소했습니다. 마지막 확정 화면과 원래 비행은 유지됩니다.','Review cancelled. The last committed frame and original flight are retained.');this.dirty=true;}
 private persist(){return this.operation(word('보관함 저장','Saving review archive'),async alive=>{
  if(!this.baseline)return;const a=this.baseline,b=this.attempt;const r=await this.verifiedRequest(b?[a,b]:[a],()=>this.client.request({type:'save-pair',beforeRunId:a.source.runId,afterRunId:b?.source.runId??null},this.progress),alive);
  if(!alive()||r.type!=='archive')return;this.persisted=r.persisted;this.storageUnconfirmed=false;this.memoryForkAllowed=!r.persisted;this.revision=r.revision;
  this.rememberPair();
  this.notice=r.persisted?word('A와 B를 별도 분석 보관함에 저장했습니다.','A and B saved in the separate review archive.'):errorText(r.storageError??'STORAGE_UNAVAILABLE');
 });}
 private async fork(){await this.operation(word('B 설계 준비','Preparing design B'),async alive=>{
  if(!this.baseline)return;
  // Capture A as the immutable comparison basis before handing off the initial
  // craft/plan. Persistence failure remains visible and never becomes success.
  const a=this.baseline,b=this.attempt;const stored=await this.verifiedRequest(b?[a,b]:[a],()=>this.client.request({type:'save-pair',beforeRunId:a.source.runId,afterRunId:b?.source.runId??null},this.progress),alive);if(!alive())return;
  if(stored.type==='archive'&&!stored.persisted){this.persisted=false;this.memoryForkAllowed=true;this.rememberPair();this.notice=word('브라우저 저장에 실패했습니다. JSON 백업을 내려받거나 메모리의 A로 B를 만들 수 있습니다.','Browser storage failed. Download a JSON backup or make B from the in-memory A.');this.dirty=true;return;}
  this.persisted=stored.type==='archive'&&stored.persisted;this.storageUnconfirmed=false;if(stored.type==='archive')this.revision=stored.revision;this.rememberPair();await this.finishFork(alive);
 });}
 private async finishFork(alive:()=>boolean){
  if(!this.baseline)return;this.rememberPair();const a=this.baseline;const r=await this.verifiedRequest([a],()=>this.client.request({type:'fork',runId:a.source.runId}),alive);
  if(alive()&&r.type==='draft')this.options.fork(structuredClone(r.draft) as unknown as ReviewDraft);
 }
 private exportPair(){return this.operation(word('JSON 백업 준비','Preparing JSON backup'),async alive=>{
  if(!this.baseline)return;const a=this.baseline,b=this.attempt;const r=await this.verifiedRequest(b?[a,b]:[a],()=>this.client.request({type:'export-pair',beforeRunId:a.source.runId,afterRunId:b?.source.runId??null}),alive);if(!alive()||r.type!=='archive-export')return;
  const url=URL.createObjectURL(new Blob([r.text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='orbital-foundry-review-ab.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.notice=word('검증된 원본 비행 두 개를 JSON에 담았습니다.','The JSON contains the verified original flight saves.');
 });}
 private importPair(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>{const file=input.files?.[0];if(!file)return;if(file.size>8*1024*1024+64*1024){this.error=word('분석 파일 크기 한도를 넘었습니다.','Review file exceeds its size limit.');this.dirty=true;return;}void this.operation(word('가져온 비행 검증','Verifying imported flights'),async alive=>{
   const text=await file.text();if(!alive())return;const r=await this.client.request({type:'import-archive',text,persist:true},this.progress);if(!alive()||r.type!=='archive')return;this.current=null;this.adopt(r);await this.compare(alive);if(alive()&&this.baseline){this.requestedTime=this.limit();await this.sample(this.side,this.requestedTime,alive);}
  });};input.click();}
 private inspect(index:number){const run=this.run(),card=run?.diagnostics[index],target=card?.targets.find(t=>t.kind==='maneuver'||t.kind==='time'||t.kind==='operation')??card?.targets[0];if(!run||!card||!target)return;
  const source=JSON.parse(run.source.engineSaveText);const evidenceTime=target.kind==='time'||target.kind==='maneuver'?target.timeSeconds:target.kind==='operation'?target.signature.startSeconds:target.kind==='packet'?source.checkpoint?.packets?.find((p:{id:string})=>p.id===target.packetId)?.capturedAt:run.evaluation.committedTimeSeconds;
  if(typeof evidenceTime==='number'&&evidenceTime>this.limit()+1e-7){this.notice=word('이 사건은 비교 상대의 기록이 끝난 뒤에 있습니다. 공통 시간 구간을 유지하며 현재 확정 화면을 보존합니다.','This event is later than the other flight’s record. The common time range and current committed frame are retained.');this.dirty=true;return;}
  this.playing=false;return this.operation(word('원인 기록 확인','Inspecting recorded evidence'),async alive=>{await this.sample(this.side,this.requestedTime,alive,target);if(!alive())return;
   const part=card.targets.find(t=>t.kind==='part'&&t.signature.kind==='adcs')??card.targets.find(t=>t.kind==='part');if(part?.kind==='part'){this.view.setInspection(true);this.view.focusPart(part.partId);this.selectedPart=part.partId;}
  });
 }
 private onClick=(event:MouseEvent)=>{
  const e=(event.target as HTMLElement).closest<HTMLElement>('[data-review-action]');if(!e||e.hasAttribute('disabled'))return;const a=e.dataset.reviewAction!;
  if(a==='close'){this.cancel();this.options.close();return;}if(a==='cancel'){this.cancel();return;}
  if(a==='inspect'){this.view.setInspection(true);this.dirty=true;return;}if(a==='whole'){this.view.setInspection(false);this.view.focusOverview('whole');this.dirty=true;return;}if(a==='focus'){this.view.focusPart(this.selectedPart);this.dirty=true;return;}
  if(a==='A'||a==='B'){this.playing=false;if(this.run(a))void this.seek(this.requestedTime,a);return;}
  if(a==='play'){if(this.playing){this.playing=false;this.client.cancel();this.generation++;this.busy=false;}else if(this.run()){this.playing=true;if(this.requestedTime>=this.limit()){this.demand=0;void this.seek(0);}else this.demand=this.requestedTime;}this.dirty=true;return;}
  if(a==='speed'){this.speed=this.speed===60?3600:this.speed===3600?21600:60;this.dirty=true;return;}
  if(a.startsWith('event:')){this.playing=false;void this.seek(Number(a.slice(6)));return;}
  if(this.busy)return;
  if(a==='save')void this.persist();else if(a==='export')void this.exportPair();else if(a==='import')this.importPair();
  else if(a==='reload')void this.initialize(true);else if(a==='retry')void this.initialize();else if(a==='fork')void this.fork();else if(a==='fork-memory')void this.operation(word('B 설계 준비','Preparing design B'),alive=>this.finishFork(alive));
  else if(a==='current-A'&&this.current){this.baseline=this.current;this.attempt=null;this.side='A';this.persisted=false;this.comparison=null;this.samples={};this.framed=false;this.rememberPair();void this.seek(this.limit(),'A');}
  else if(a.startsWith('diagnostic:'))void this.inspect(Number(a.slice(11)));
 };
 private onScrubBegin=()=>{this.scrubbing=true;this.playing=false;};
 private onScrubEnd=()=>{this.scrubbing=false;};
 private onScrub=()=>{this.cursorPreview=Number(this.slider.value);this.playing=false;this.dirty=true;};
 private onScrubCommit=()=>{this.scrubbing=false;this.playing=false;void this.seek(Number(this.slider.value));};
 private onKey=(event:KeyboardEvent)=>{
  if(this.closed||(event.target as HTMLElement).closest('textarea,select,[contenteditable=true]'))return;
  if(event.key==='Escape'){event.preventDefault();if(this.busy)this.cancel();else this.view.setInspection(false);return;}
  if(event.key.toLowerCase()==='f'&&!(event.target as HTMLElement).closest('input')){event.preventDefault();this.view.setInspection(true);this.view.focusPart(this.selectedPart);return;}
  if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)&&this.run()&&!(event.target as HTMLElement).closest('input,button')){event.preventDefault();this.playing=false;const t=event.key==='Home'?0:event.key==='End'?this.limit():this.requestedTime+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?600:60);void this.seek(t);}
 };
 private onVisibility=()=>{if(document.hidden){this.playing=false;this.cancel();}};
 private button(action:string,label:string,disabled=false,primary=false){return `<button data-review-action="${action}" ${disabled?'disabled':''} class="${primary?'review-primary':''}">${esc(label)}</button>`;}
 private slot(side:Side,run:VerifiedRun|null){return `<button data-review-action="${side}" class="review-slot ${this.side===side?'selected':''}" ${!run?'disabled':''}><span class="review-slot-letter">${side}</span><span><strong>${esc(run?run.source.displayName:word('아직 없음','Not recorded'))}</strong><small>${run?`${fmt(run.result.score,0)} / 100 · ${fmt(run.result.received,0)} ${word('수신','received')} · ${run.evaluation.final?word('최종','final'):word('중간','interim')}`:word('실제 재비행으로 채웁니다','Filled by an actual reflight')}</small></span></button>`;}
 private change(change:SemanticChange){const labels:Record<string,string>={hardware:word('장비','Hardware'),placement:word('배치','Placement'),aim:word('조준점','Aim point'),operation:word('일정','Schedule'),bus:word('버스','Bus'),'active-radio':word('송신기','Active radio'),trajectory:word('경로','Trajectory')};const display=(v:unknown)=>v===null?'—':typeof v==='string'?v:JSON.stringify(v);return `<details class="review-change"><summary>${esc(labels[change.kind]??change.kind)}</summary><div><b>A</b><code>${esc(display(change.before))}</code></div><div><b>B</b><code>${esc(display(change.after))}</code></div></details>`;}
 private paint(){
  const focus=document.activeElement instanceof HTMLElement?document.activeElement.dataset.reviewAction:undefined,scroll=[this.left.scrollTop,this.right.scrollTop];
  const run=this.run(),sample=this.samples[this.side],t=sample?.telemetry.values;
  this.header.innerHTML=`<div><span>ORBITAL FOUNDRY / FLIGHT REVIEW</span><h1>${word('실패를 다음 설계로','Turn a flight into a better design')}</h1></div><nav>${this.button('save',word('A/B 보관','Save A/B'),this.busy||!this.baseline)}${this.button('export','JSON ↓',this.busy||!this.baseline)}${this.button('import','JSON ↑',this.busy)}${this.button('close',this.options.engineSaveText?word('비행으로 돌아가기','Return to flight'):word('임무 선택','Missions'))}</nav>`;
  this.left.innerHTML=`<div class="review-eyebrow">${word('실제로 비행한 두 설계','TWO ACTUAL FLIGHTS')}</div><div class="review-slots">${this.slot('A',this.baseline)}${this.slot('B',this.attempt)}</div><p class="review-storage ${this.persisted?'saved':''}">${this.storageUnconfirmed?word('보관함 갱신됨 · 현재 조합 확인 필요','Archive changed · current pair needs confirmation'):this.persisted?word('브라우저 보관 완료','Archived in this browser'):word('현재 화면의 조합 · 아직 미보관','Current pair · not yet archived')}${this.revision!==null?` · r${this.revision}`:''}</p>${this.button('fork',word('A를 복제해 B 만들기','Copy A to build B'),this.busy||!this.baseline,true)}${this.memoryForkAllowed&&!this.persisted?this.button('fork-memory',word('메모리의 A로 B 만들기','Make B from in-memory A'),this.busy):''}${this.current&&this.current!==this.baseline?this.button('current-A',word('이번 비행을 새 A로','Use current flight as new A'),this.busy):''}<div class="review-divider"></div><h2>${word('기록에서 찾은 원인','Evidence from the flight')}</h2>${run?.diagnostics.length?run.diagnostics.map((d,i)=>`<article class="review-diagnostic ${d.severity}"><strong>${esc(d.title[getLanguage()])}</strong><p>${esc(d.explanation[getLanguage()])}</p>${d.evidence.map(e=>`<div class="review-evidence"><time>${e.timeSeconds===null?'—':clock(e.timeSeconds)}</time>${Object.entries(e.values).slice(0,5).map(([k,v])=>`<span>${esc(k)} <b>${esc(typeof v.value==='number'?fmt(v.value,5):v.value??'—')} ${esc(v.unit??'')}</b></span>`).join('')}</div>`).join('')}${this.button('diagnostic:'+i,word('해당 순간·부품 보기','Inspect moment and hardware'),this.busy||!d.targets.length)}${d.suggestedInvestigation?`<small>${esc(d.suggestedInvestigation[getLanguage()])}</small>`:''}</article>`).join(''):`<p class="review-muted">${run?word('현재 기록에서 특별한 거부 원인이 발견되지 않았습니다. 시간 눈금에서 실제 비행을 살펴보세요.','No specific rejection was found in this record. Inspect the actual history with the time ruler.'):word('비행을 실행한 뒤 분석하거나 A/B JSON을 불러오세요.','Fly a mission or import an A/B JSON archive.')}</p>`}`;
  const c=this.comparison;
  this.right.innerHTML=`<div class="review-eyebrow">${word('관찰된 차이','OBSERVED DIFFERENCES')}</div><h2>${word('한 가지를 바꿔 보세요','Change one thing')}</h2>${sample?`<section class="review-current-resources"><h3>${word('확정된 재생 시각','Committed replay time')} · T+${clock(sample.cursor.committedTimeSeconds)}</h3><div><span>${word('배터리','Battery')}</span><b>${fmt(t?.energyWh)} Wh</b></div><div><span>${word('발전 / 소비','Generation / load')}</span><b>${fmt(t?.solarPowerW)} / ${fmt(t?.loadPowerW)} W</b></div><div><span>${word('지구 수신','Earth received')}</span><b>${fmt(t?.scienceReceived,0)}</b></div><div><span>${word('현재 운용 목표 지향 오차','Current operating-target error')}</span><b>${fmt(t?.slewAngleDeg,4)}°</b></div></section>`:''}${c?`<div class="review-compatibility ${c.compatibility.mode==='blocked'?'blocked':'allowed'}">${c.compatibility.mode==='controlled'?(this.baseline?.evaluation.final?word('같은 조건의 최종 결과','Final results under matching conditions'):word('같은 시각의 중간 기록','Intermediate records at the same time')):word('직접 점수 비교 불가','Direct score comparison unavailable')}</div>${c.deltas?`<div class="review-score-delta ${(c.deltas.score??0)<0?'negative':(c.deltas.score??0)>0?'positive':'neutral'}"><strong>${c.deltas.score===undefined?'—':sign(c.deltas.score,0)}</strong><span>${word('점 · B − A','points · B − A')}</span></div><div class="review-metrics">${[['received',word('지구 수신','Earth received'),''],['energyMinimumWh',word('최저 배터리','Minimum battery'),'Wh'],['fuelRemainingKg',word('남은 추진제','Remaining propellant'),'kg'],['totalCost',word('설계 비용','Design cost'),''],['observedDurationSeconds',word('관찰 기간 차이','Observed duration'),'s']].map(([k,l,u])=>`<div><span>${l}</span><b>${sign(c.deltas![k],k==='fuelRemainingKg'?5:2)} ${u}</b></div>`).join('')}</div>`:c.compatibility.blockers.map(b=>`<p class="review-warning">${esc(b.detail[getLanguage()])}<small>${esc(b.code)}</small></p>`).join('')}<h3>${word('변경한 입력','Changed inputs')} (${c.changes.length})</h3>${c.changes.map(ch=>this.change(ch)).join('')}<p class="review-muted">${esc(c.warning[getLanguage()])}</p>`:`<p class="review-muted">${word('A를 보관하고 설계 B를 직접 비행하면 실제 차이를 비교합니다. 재비행 전 점수 상승을 예측해 제시하지 않습니다.','Archive A and actually fly design B to compare observed differences. No score gain is invented before the reflight.')}</p>`}<div class="review-actions">${this.button('retry',word('분석 다시 시도','Retry review'),this.busy)}${this.button('reload',word('보관함 다시 읽기','Reload archive'),this.busy)}</div><div class="review-divider"></div>${[this.baseline,this.attempt].map((r,i)=>r?`<div class="review-duration"><strong>${i?'B':'A'} · ${r.evaluation.final?word('최종 기록','Final record'):word('중간 기록','Intermediate record')}</strong><span>T+${clock(r.evaluation.committedTimeSeconds)}</span><small>${esc(r.identity.modelVersion)} · ${esc(r.source.engineSaveSha256.slice(0,12))}</small></div>`:'').join('')}<details class="review-provenance"><summary>${word('비교 조건과 출처','Comparison conditions and sources')}</summary><p>${word('동일한 시나리오·천체력·수치 정책·점수 정의를 확인합니다. 단순화한 게임 모델의 계산 결과입니다.','Scenario, ephemeris, numerical policy and score definition are checked. Results come from the declared simplified game model.')}</p>${run?`<p>ICRF · TDB · JD ${fmt(run.identity.initialEpochJdTdb,9)}</p><code>${esc(run.identity.engineManifestSha256)}</code>`:''}<a href="/data/swingby/model-v1.json" target="_blank" rel="noopener">${word('임무 자료','Mission data')}</a></details>`;
  
  this.badge.innerHTML=`<div class="review-camera-controls">${this.button('inspect',word('기체 · F','Spacecraft · F'),!run)}${this.button('focus',word('선택 부품','Selected part'),!run)}${this.button('whole',word('실제 항로','Actual route'),!run)}</div><p>${word('과거 비행 재구성 · 원래 비행은 정지','RECONSTRUCTED HISTORY · LIVE FLIGHT PAUSED')}</p>${sample?`<strong>${this.side} · T+${clock(sample.cursor.committedTimeSeconds)}</strong><small>${word('확정 시각의 실제 자세·위치','Actual pose and position at committed time')}</small>${this.view.getState().inspection.serviceBayCutaway?`<small class="review-cutaway-label">${word('서비스 베이 단면 보기 · 내부 장비 점검','SERVICE BAY CUTAWAY · INTERNAL HARDWARE INSPECTION')}</small>`:''}`:''}${this.busy?`<div class="review-progress" role="status"><span>${esc(this.task)} · ${this.progressRun?`${word('비행','flight')} ${this.progressOrder.indexOf(this.progressRun)+1} · `:''}${fmt(this.fraction*100,0)}%${this.taskTime?` · T+${clock(this.taskTime)}`:''}</span><progress max="1" value="${this.fraction}"></progress>${this.button('cancel',word('취소','Cancel'))}</div>`:''}${this.error?`<div class="review-error" role="alert">${esc(this.error)}</div>`:''}${this.notice?`<div class="review-notice" role="status">${esc(this.notice)}</div>`:''}`;
  const max=this.limit(),shown=this.cursorPreview??this.requestedTime;
  this.timelineTitle.innerHTML=`<div>${this.button('play',this.playing?word('재생 멈춤','Pause replay'):word('기록 재생','Play history'),!run)}${this.button('speed',`${this.speed}×`,!run)}</div><strong>T+${clock(shown)}</strong><span>${word('눈금을 드래그 · ←→ 1분 · Shift 10분 · 각 화면은 확정 시각 표시','Drag time · ←→ 1 min · Shift 10 min · Each frame shows committed time')}</span>`;
  this.slider.max=String(Math.max(1,max));this.slider.disabled=!run;if(!this.scrubbing)this.slider.value=String(Math.min(max,shown));this.slider.setAttribute('aria-valuetext',clock(shown));
  const events=run?JSON.parse(run.source.engineSaveText).checkpoint?.events??[]:[];const seen=new Set<string>();
  this.markers.innerHTML=(events as {time:number;code:string}[]).filter(e=>e.time<=max&&!seen.has(e.code)&&!!seen.add(e.code)).slice(0,9).map(e=>`<button data-review-action="event:${e.time}" style="left:${max?e.time/max*100:0}%" title="${esc(e.code)} · T+${clock(e.time)}" aria-label="${esc(e.code)} ${clock(e.time)}"><i></i></button>`).join('');
  this.left.scrollTop=scroll[0];this.right.scrollTop=scroll[1];if(focus)this.element.querySelector<HTMLElement>(`[data-review-action="${CSS.escape(focus)}"]`)?.focus({preventScroll:true});
  this.layout();
 }
 private layout(){if(this.closed)return;const e=this.element.getBoundingClientRect(),l=this.left.getBoundingClientRect(),r=this.right.getBoundingClientRect(),h=this.header.getBoundingClientRect(),t=this.timeline.getBoundingClientRect();this.view.setViewport({left:l.right-e.left+12,right:e.right-r.left+12,top:h.bottom-e.top+100,bottom:e.bottom-t.top+12});}
 private frame=(now:number)=>{
  if(this.closed)return;const dt=Math.min(.1,(now-this.previous)/1000);this.previous=now;
  if(this.playing){this.demand=Math.min(this.limit(),this.demand+dt*this.speed);if(!this.busy&&this.demand>this.requestedTime+.5){const target=this.demand;void this.seek(target);if(target>=this.limit())this.playing=false;}}
  if(this.dirty&&now-this.paintingAt>120){this.paint();this.dirty=false;this.paintingAt=now;}this.view.render(dt);this.raf=requestAnimationFrame(this.frame);
 };
 getState(){return {baseline:this.baseline?structuredClone(this.baseline):null,attempt:this.attempt?structuredClone(this.attempt):null,current:this.current?structuredClone(this.current):null,comparison:this.comparison?structuredClone(this.comparison):null,side:this.side,requestedTime:this.requestedTime,displayed:this.view.getState(),samples:structuredClone(this.samples),busy:this.busy,playing:this.playing,task:this.task,persisted:this.persisted,storageUnconfirmed:this.storageUnconfirmed,revision:this.revision,error:this.error,notice:this.notice,selectedPartId:this.selectedPart};}
 dispose(){if(this.closed)return;this.closed=true;this.generation++;this.client.cancel();this.unsubscribe();cancelAnimationFrame(this.raf);this.observer.disconnect();this.element.removeEventListener('click',this.onClick);this.slider.removeEventListener('input',this.onScrub);this.slider.removeEventListener('change',this.onScrubCommit);this.slider.removeEventListener('pointerdown',this.onScrubBegin);window.removeEventListener('pointerup',this.onScrubEnd);window.removeEventListener('keydown',this.onKey);document.removeEventListener('visibilitychange',this.onVisibility);this.view.dispose();this.element.remove();}
}
