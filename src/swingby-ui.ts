import './swingby-ui.css';
import {getLanguage,t as translate} from './i18n';
import {createSwingbyDesign,createSwingbyPlan,getSwingbyScenario,SWINGBY_PROPULSION,saveSwingbyLocal,loadSwingbyLocalText} from './swingby';
import type {getSwingbyTelemetry,getSwingbyResult} from './swingby';
import type {SwingbyPlan,SwingbySolution,SwingbyEvaluation,SwingbyRuntime,SwingbyIssue,SwingbySave,SwingbyNumerics} from './swingby/types';
import type {Design,Quaternion,Vec3} from './sim/types';
import type {TransferStateVector} from './transfer/types';
import {SwingbyScene} from './render/swingby-scene';
import type {SwingbyObjectiveSnapshot} from './render/swingby-objective';

const word=(ko:string,en:string)=>getLanguage()==='ko'?ko:en;
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fmt=(v:number|null|undefined,d=1)=>v!==null&&v!==undefined&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const time=(v:number)=>`${Math.floor(v/86400)}d ${String(Math.floor(v/3600)%24).padStart(2,'0')}:${String(Math.floor(v/60)%60).padStart(2,'0')}:${String(Math.floor(v)%60).padStart(2,'0')}`;
const issueText=(code:string,fallback:string)=>getLanguage()==='en'?translate(fallback):({GIMBAL_LIMIT:'장비가 한쪽으로 치우쳐 엔진이 무게중심을 향할 수 없습니다. 배치를 조정하세요.',FUEL:'이 경로에 필요한 추진제가 부족합니다. 더 작은 경로 보정을 시도하세요.',UNSAFE_PERIAPSIS:'예측 최근접 고도가 안전 경계250km보다 낮습니다.',BUDGET:'장비와 무게중심 보정 장치의 합계가 임무 예산을 초과합니다.',PREPARATION_POWER:'기동 준비에 필요한 전력이 버스의 전력 공급 한도를 넘습니다.',PROPULSION_UNAVAILABLE:'연결된 화학 엔진과 이 임무의 무게중심 보정 장치가 필요합니다.',SCHEDULE_CONFLICT:'일정이 겹칩니다. 블록을 이동해 관측과 교신을 분리하세요.',SCHEDULE_AFTER_PATCH:'이 일정은 국소 조우가 끝난 뒤까지 이어집니다.',BURN_PRIORITY:'기동 준비 중에는 엔진 방향 맞추기가 이 일정보다 우선합니다.',AIM_RANGE:'선택한 조준점이 이 임무에서 다룰 수 있는 범위 밖에 있습니다.',AIM_UNREACHABLE:'이 표적은 허용된 기동으로 도달하지 못합니다. 이전 표적 쪽으로 이동해 보세요.',BAD_CHECKPOINT:'저장된 비행이 원래 조건의 재생 결과와 다릅니다. 현재 비행은 보존했습니다.'} as Record<string,string>)[code]??fallback;
const eventText=(code:string,fallback:string)=>getLanguage()==='en'?translate(fallback):({SCENARIO_START:'선언된 화성 접근 위치에서 실제 비행을 시작했습니다.',CORRECTION_FIRED:'엔진이 실제 자세 방향으로 기동했고 추진제를 사용했습니다.',CORRECTION_NOOP:'기동 없이 원래 경로를 따라갑니다.',BURN_SKIPPED:'기동 조건을 충족하지 못해 원래 경로를 유지합니다.',PERIAPSIS:'실제 최근접 위치와 고도를 기록했습니다.',EXIT_MEASURED:'바깥쪽 출구를 통과해 실제 방향과 에너지를 기록했습니다.',MARS_PATCH_EXIT:'국소 화성 조우가 끝났습니다.',DATA_RECEIVED:'완전한 분광 자료 한 개가 지구에 도착했습니다.',SAFE_MODE:'전력 부족으로 안전 충전을 시작했습니다.',RECOVERED:'전력이 회복되어 탑재 일정을 재개했습니다.',POWER_LOSS:'버스 유지 전력이 부족해 임무를 계속할 수 없습니다.',SURFACE_CONTACT:'실제 경로가 화성 표면과 만났습니다.'} as Record<string,string>)[code]??fallback;
type Telemetry=ReturnType<typeof getSwingbyTelemetry>;
type Result=ReturnType<typeof getSwingbyResult>;
type Initial={attitudeQuaternion:Quaternion;telemetry:Telemetry};
type Callbacks={exit:()=>void;edit:(craft:Design,plan:SwingbyPlan,numerics?:SwingbyNumerics)=>void};

/** A separate authored encounter. Every navigation preview and live step is
 * owned by the real Worker; pointer/camera events never mutate a flight. */
export class SwingbyExperience {
 readonly element=document.createElement('div');
 readonly scene:SwingbyScene;
 craft:Design;plan:SwingbyPlan;solution:SwingbySolution|null=null;
 evaluation:SwingbyEvaluation|null=null;runtime:SwingbyRuntime|null=null;
 telemetry:Telemetry|null=null;result:Result|null=null;forecast:Result|null=null;
 playing=false;speed=3600;pending=true;busy=false;revision=0;
 private worker:Worker;private requestId=0;private controlEpoch=0;
 private numerics:SwingbyNumerics={cruiseStepSeconds:300,activeStepSeconds:1};
 private review:import('./review-ui').ReviewExperience|null=null;private reviewOpening=false;
 private initial:Initial|null=null;private correctionPosition:Vec3|null=null;
 private predicted:TransferStateVector[]=[];private actual:TransferStateVector[]=[];
 private displaySolution:SwingbySolution|null=null;private issues:SwingbyIssue[]=[];
 private dirty=true;private raf=0;private last=performance.now();private uiAt=0;private pointerBusy=false;
 private demand=0;private closed=false;private restoring=false;private forecastPending=false;
 private error='';private notice='';private selected:string|null=null;private layoutKey='';
 private pathCertified=true;
 private draftSaveable=false;private unsavedExit=false;private workerFailed=false;
 private undoStack:SwingbyPlan[]=[];private redoStack:SwingbyPlan[]=[];
 private draftAim:{xKm:number;yKm:number}|null=null;
 private timelineRange:'encounter'|'delivery'='encounter';
 private timelineExpanded=true;private overview:'whole'|'encounter'|'aim'|'correction'='encounter';
 private drag:{id:string;edge:boolean;pointer:number;x:number;start:number;end:number;scale:number;before:SwingbyPlan}|null=null;
 private saveSeq=0;private saveIntents=new Map<number,'auto'|'local'|'export'|'exit'|'edit'|'review'>();
 private storageQueue:Promise<void>=Promise.resolve();private lastAutosave=0;private savedStamp='';private closing=false;private saveTransaction=false;
 private resizeObserver:ResizeObserver;
 private readonly viewport=document.createElement('div');
 private readonly header=document.createElement('header');
 private readonly left=document.createElement('aside');
 private readonly right=document.createElement('aside');
 private readonly timeline=document.createElement('section');
 private readonly hint=document.createElement('div');
 private readonly velocity=document.createElement('div');
 constructor(private container:HTMLElement,private callbacks:Callbacks,craft?:Design,plan?:SwingbyPlan,initialSave?:string,options?:{quality?:'high'|'medium'|'low';reducedMotion?:boolean;numerics?:SwingbyNumerics}){
  if(options?.numerics)this.numerics=structuredClone(options.numerics);
  this.craft=structuredClone(craft??createSwingbyDesign());this.plan=structuredClone(plan??createSwingbyPlan('starter'));
  this.element.className='swingby-experience';this.viewport.className='swingby-viewport';this.header.className='swingby-header';
  this.left.className='swingby-panel swingby-left';this.right.className='swingby-panel swingby-right';this.timeline.className='swingby-timeline';this.hint.className='swingby-hint';this.velocity.className='swingby-velocity';
  this.element.append(this.viewport,this.header,this.left,this.right,this.timeline,this.hint,this.velocity);container.append(this.element);
  this.scene=new SwingbyScene(this.viewport,{aimChange:(point,commit)=>this.aim(point,commit),aimCancel:()=>{this.draftAim=null;this.dirty=true;},partSelected:id=>{this.selected=id;this.dirty=true;},contextLost:()=>{this.pause();this.notice=word('그래픽 복구를 기다립니다. 비행은 일시정지했습니다.','Graphics recovery pending. Flight paused.');this.dirty=true;},contextRestored:()=>{this.notice=word('그래픽을 복구했습니다. 비행을 계속할 수 있습니다.','Graphics restored. Flight remains paused.');this.dirty=true;}},options);
  this.scene.setCraft(this.craft);
  this.worker=new Worker(new URL('./swingby.worker.ts',import.meta.url),{type:'module'});
  this.worker.onmessage=event=>this.receive(event.data);
  this.worker.onerror=()=>{this.workerFailed=true;this.playing=this.pending=this.busy=this.restoring=this.forecastPending=this.closing=this.saveTransaction=false;this.saveIntents.clear();this.draftSaveable=false;this.unsavedExit=true;this.scene.setEditing(false);this.error=word('비행 계산이 중단되었습니다. 이전 저장을 유지한 채 임무를 다시 열 수 있습니다.','Flight calculation stopped. You can leave and reopen the previous save.');this.dirty=true;};
  this.element.addEventListener('click',this.onClick);this.element.addEventListener('pointerdown',this.onPointerBegin);this.timeline.addEventListener('pointerdown',this.onTimelineDown);
  window.addEventListener('pointermove',this.onPointerMove);window.addEventListener('pointerup',this.onPointerUp);window.addEventListener('pointercancel',this.onPointerCancel);window.addEventListener('keydown',this.onKey);
  document.addEventListener('visibilitychange',this.onVisibility);this.resizeObserver=new ResizeObserver(()=>this.layout());this.resizeObserver.observe(this.element);
  this.paint();if(initialSave)this.restore(initialSave);else this.solve();this.raf=requestAnimationFrame(this.frame);
 }
 private post(type:string,extra:Record<string,unknown>={}){if(!this.workerFailed)this.worker.postMessage({type,requestId:this.requestId,controlEpoch:this.controlEpoch,...extra});}
 private barrier(type:string,extra:Record<string,unknown>={}){this.controlEpoch++;this.busy=true;this.post(type,extra);}
 private remember(before=this.plan){this.undoStack.push(structuredClone(before));if(this.undoStack.length>30)this.undoStack.shift();this.redoStack=[];}
 private solve(){
  if(this.closed||this.runtime)return;this.saveIntents.clear();this.requestId++;this.controlEpoch=0;this.revision++;this.unsavedExit=false;this.draftSaveable=false;this.pending=true;this.forecastPending=false;this.forecast=null;this.solution=null;this.evaluation=null;this.issues=[];this.error='';this.dirty=true;
  this.post('solve',{plan:this.plan,craft:this.craft,revision:this.revision,numerics:this.numerics});this.updateScene();
 }
 private receive(m:Record<string,any>){
  if(this.closed||m.requestId!==this.requestId)return;
  // A coherent save snapshot belongs to its explicit intent and flight session.
  // A subsequent pause/visibility barrier cannot invalidate that acknowledgement.
  if(m.type==='save-snapshot'){if(this.saveIntents.has(m.saveId)&&this.saveIntents.get(m.saveId)!=='auto')this.saveTransaction=false;void this.finishSave(m.saveId,m.save,m.text);this.updateScene();this.dirty=true;return;}
  if(m.type==='error'&&m.operation==='save'){
   const intent=this.saveIntents.get(m.saveId);this.saveIntents.delete(m.saveId);
   if(intent&&intent!=='auto')this.saveTransaction=false;if(intent==='exit'||intent==='edit'||intent==='review')this.closing=false;if(intent==='exit')this.unsavedExit=true;
   this.error=issueText(String(m.error),String(m.error));this.dirty=true;return;
  }
  if(m.controlEpoch!==this.controlEpoch)return;
  if(Object.hasOwn(m,'draftSaveable'))this.draftSaveable=m.draftSaveable;
  if(m.visualPath){this.pathCertified=m.visualPath.certified;if(!this.pathCertified)this.notice=word('곡선 표시의 정밀도 한도를 넘었습니다. 경로 선을 숨겼으며 실제 비행 계산은 유지됩니다.','Path display precision limit exceeded. Lines are hidden; physical flight calculation is unchanged.');}
  if(m.type==='solved'){
   if(m.revision!==this.revision)return;this.pending=false;this.busy=false;
   this.solution=m.status==='solved'?m.solution:null;this.evaluation=m.evaluation??null;this.issues=m.issues??this.evaluation?.issues??[];this.lastAutosave=performance.now()-15001;
   if(this.solution){this.displaySolution=this.solution;this.initial=m.initial;this.correctionPosition=m.correctionPositionKm;this.predicted=m.trajectory??[];}
   this.scene.setCarrierProfile(this.evaluation?.enginePartId?SWINGBY_PROPULSION:null,this.evaluation?.enginePartId??null);
  }else if(['launched','runtime','runtime-progress','paused','restore-cancelled','restored'].includes(m.type)){
   this.runtime=m.state??null;this.telemetry=m.telemetry??null;this.result=m.result??null;
   this.actual=m.trajectory??this.actual;
   this.busy=m.type==='runtime-progress';
   if(m.type==='paused'){this.demand=this.runtime?.time??0;this.busy=false;}
   if(m.type==='launched'){this.playing=true;this.timelineExpanded=false;this.demand=this.runtime?.time??0;this.lastAutosave=performance.now()-15001;this.scene.setInspection(true);}
   if(m.type==='restored'||m.type==='restore-cancelled'){
    this.restoring=this.pending=false;this.playing=false;this.busy=false;if(m.type==='restored')this.timelineExpanded=!this.runtime;
    if(m.numerics)this.numerics=structuredClone(m.numerics);if(m.plan)this.plan=m.plan;if(m.craft){this.craft=m.craft;this.scene.setCraft(this.craft);}
    if(Object.hasOwn(m,'solution'))this.solution=m.solution;this.displaySolution=this.solution;
    if(Object.hasOwn(m,'evaluation'))this.evaluation=m.evaluation;
    if(Object.hasOwn(m,'initial'))this.initial=m.initial;
    if(Object.hasOwn(m,'correctionPositionKm'))this.correctionPosition=m.correctionPositionKm;
    if(Object.hasOwn(m,'predictedTrajectory'))this.predicted=m.predictedTrajectory??[];this.issues=m.issues??this.evaluation?.issues??this.issues;
    this.scene.setCarrierProfile(this.evaluation?.enginePartId?SWINGBY_PROPULSION:null,this.evaluation?.enginePartId??null);
    if(!this.runtime&&!this.initial)this.scene.setSnapshot(null);
    this.demand=this.runtime?.time??0;this.notice=m.type==='restored'?word('저장된 조건과 비행을 검증해 복원했습니다.','Saved inputs and flight verified and restored.'):word('불러오기를 취소했습니다.','Restore cancelled.');
   }
   if(this.runtime?.status!=='running'){this.playing=false;this.busy=false;this.lastAutosave=performance.now()-15001;}
  }else if(m.type==='forecast-progress'){this.notice=word('별도 예측 중 · 실제 비행은 시작하지 않았습니다.','Forecasting separately · live flight has not started.');}
  else if(m.type==='forecast'){if(m.inputHash!==this.solution?.inputHash)return;this.forecast=m.result;this.forecastPending=false;this.notice=word('같은 기체·계획의 예측입니다. 실제 결과는 실행 후 확인합니다.','Forecast for this exact craft and plan. Run to record an actual result.');}
  else if(m.type==='forecast-cancelled'){this.forecastPending=false;}
  else if(m.type==='restore-progress'){this.notice=word('저장된 비행을 재생하며 검증 중…','Replaying and verifying saved flight…');}
  else if(m.type==='error'){
   this.playing=false;this.busy=this.pending=this.restoring=this.forecastPending=false;this.error=issueText(String(m.error),String(m.error));this.notice='';
   if(m.retainedFlight&&m.state){this.runtime=m.state;this.telemetry=m.telemetry;this.result=m.result;if(m.numerics)this.numerics=structuredClone(m.numerics);if(m.plan)this.plan=m.plan;if(m.craft)this.craft=m.craft;this.solution=m.solution??this.solution;this.demand=this.runtime?.time??0;}
   if(m.operation==='save'){this.saveIntents.clear();this.closing=false;}
  }
  this.updateScene();this.dirty=true;
 }
 private updateScene(){
  const t=this.runtime?this.telemetry:this.initial?.telemetry,q=this.runtime?.attitudeQuaternion??this.initial?.attitudeQuaternion;
  if(!t||!q)return;const scenario=getSwingbyScenario(),s=this.solution??this.displaySolution,elapsed=this.runtime?.time??0;
  const passed=(this.runtime?this.actual:[]).filter(p=>p.elapsedSeconds<=elapsed+1e-7).map(p=>p.relativePositionKm);
  if(this.runtime)passed.push(t.environment.state.relativePositionKm);
  const objective:SwingbyObjectiveSnapshot={scenarioId:scenario.id,revision:this.revision,elapsedSeconds:elapsed,aimPlane:scenario.aimPlane,aim:this.plan.aim,
   predictedPathKm:this.pathCertified?this.predicted.map(p=>p.relativePositionKm):[],actualPathKm:this.pathCertified?passed:[],
   correction:this.solution&&this.correctionPosition?{time:this.solution.correction.time,positionKm:this.correctionPosition,vectorMps:this.solution.correction.vectorMps,...(this.runtime?.burn?{actualVectorMps:this.runtime.burn.actualDeltaVMps}:{})}:null,
   predictedExit:this.solution?.exit??null,achievedExit:this.runtime?.achievedExit??null,
   goal:{targetDirection:scenario.exit.targetDirection,toleranceDeg:scenario.exit.toleranceDeg,energyRangeKm2S2:scenario.exit.energyRangeKm2S2},previewStatus:this.pending?'pending':this.solution?'accepted':'invalid'};
  this.scene.setEditing(!this.workerFailed&&!this.runtime&&!this.restoring&&!this.pending&&!this.closing&&!this.saveTransaction);
  this.scene.setSnapshot({timeSeconds:elapsed,positionKm:t.environment.state.relativePositionKm,attitudeQuaternion:q,sunDirectionICRF:t.environment.sunDirection,marsSurfaceRotationRad:elapsed/88642.6848*Math.PI*2,objective,
   ...(this.solution&&this.evaluation?.enginePartId?{engine:{partId:this.evaluation.enginePartId,thrustDirectionBody:t.thrust.thrustDirectionBody}}:{})});
 }
 private aim(point:{xKm:number;yKm:number},commit:boolean){
  if(this.workerFailed||this.runtime||this.pending||this.restoring||this.closing||this.saveTransaction)return;
  this.draftAim={xKm:point.xKm,yKm:point.yKm};
  if(commit){this.remember();this.plan={...this.plan,aim:{...this.draftAim}};this.draftAim=null;this.solve();}else this.dirty=true;
 }
 private pause(){this.playing=false;if(!this.workerFailed&&this.runtime&&!this.restoring){this.barrier('pause');this.demand=this.runtime.time;}this.dirty=true;}
 private save(intent:'local'|'export'|'exit'|'edit'|'review'){
  if(this.workerFailed||this.pending||this.restoring||this.closing||this.saveTransaction)return;this.pause();this.saveTransaction=true;this.scene.setEditing(false);this.closing=intent==='exit'||intent==='edit'||intent==='review';const id=++this.saveSeq;this.saveIntents.set(id,intent);this.post('save',{saveId:id});
 }
 private async finishSave(id:number,save:SwingbySave,text:string){
  const intent=this.saveIntents.get(id);this.saveIntents.delete(id);if(!intent||this.closed)return;
  const write=this.storageQueue.catch(()=>{}).then(()=>saveSwingbyLocal(save));this.storageQueue=write;
  let stored=false;
  try{await write;stored=true;if(!this.closed&&intent!=='auto')this.notice=word('이 임무의 별도 슬롯에 저장했습니다.','Saved to this mission’s separate slot.');}catch{if(!this.closed)this.notice=word('브라우저 저장 공간을 사용할 수 없습니다. JSON 백업을 사용하세요.','Browser storage unavailable. Use a JSON backup.');}
  if(this.closed)return;
  if(intent==='exit'&&!stored){this.closing=false;this.unsavedExit=true;this.updateScene();this.dirty=true;return;}
  if(intent==='export'){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='orbital-foundry-swingby.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(intent==='exit'||intent==='edit'||intent==='review')this.closing=false;if(intent==='exit')this.callbacks.exit();else if(intent==='edit')this.callbacks.edit(structuredClone(save.craft),structuredClone(save.plan),structuredClone(save.numerics));
  else if(intent==='review')void this.openReview(text);
  this.dirty=true;
 }
 restore(text:string){if(this.workerFailed||this.closing||this.saveTransaction)return;this.playing=false;this.saveIntents.clear();this.requestId++;this.controlEpoch=0;this.restoring=this.pending=true;this.busy=false;this.error='';this.dirty=true;this.post('restore',{text});}
 private onVisibility=()=>{if(document.hidden){this.onPointerCancel();this.scene.setEditing(false);this.pause();}else this.updateScene();};
 private onKey=(e:KeyboardEvent)=>{
  if(this.review||this.reviewOpening)return;
  if(this.workerFailed||this.closing||this.saveTransaction)return;
  if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;
  const operation=(e.target as HTMLElement).closest<HTMLElement>('[data-swingby-operation]');
  if(operation&&['ArrowLeft','ArrowRight'].includes(e.key)&&!this.runtime&&!this.pending){
   e.preventDefault();const op=this.plan.operations.find(o=>o.id===operation.dataset.swingbyOperation);if(!op)return;this.remember();const amount=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?600:60),duration=op.end-op.start;
   if(e.altKey)op.end=Math.max(op.start+60,Math.min(getSwingbyScenario().deadlineSeconds,op.end+amount));else{op.start=Math.max(0,Math.min(getSwingbyScenario().deadlineSeconds-duration,op.start+amount));op.end=op.start+duration;}this.solve();return;
  }
  if(e.key==='Escape'){if(this.drag){this.onPointerCancel();return;}if(this.scene.getInspectionState().enabled){this.scene.setInspection(false);this.dirty=true;return;}}
  if(e.code==='Space'&&!(e.target as HTMLElement).closest('button,summary')){e.preventDefault();if(this.runtime&&!this.restoring){if(this.playing||this.busy)this.pause();else{this.playing=true;this.demand=this.runtime.time;this.dirty=true;}}}
  if(e.key.toLowerCase()==='f'){e.preventDefault();if(this.scene.getInspectionState().enabled)this.scene.focusInspectionPart(this.selected);else this.scene.setInspection(true);this.dirty=true;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();this.history(e.shiftKey?'redo':'undo');}
 };
 private history(kind:'undo'|'redo'){
  if(this.runtime||this.pending||this.drag)return;const from=kind==='undo'?this.undoStack:this.redoStack,to=kind==='undo'?this.redoStack:this.undoStack,next=from.pop();if(!next)return;to.push(structuredClone(this.plan));this.plan=next;this.solve();
 }
 private onClick=(event:MouseEvent)=>{
  if(this.closing||this.saveTransaction)return;
  const button=(event.target as HTMLElement).closest<HTMLElement>('[data-swingby-action]');if(!button||button.hasAttribute('disabled'))return;
  const action=button.dataset.swingbyAction!;
  if(action==='leave-unsaved'){void this.storageQueue.catch(()=>{}).then(()=>{if(!this.closed)this.callbacks.exit();});return;}
  if(this.workerFailed)return;
  if(action==='exit'){this.save('exit');return;}if(action==='export'){this.save('export');return;}if(action==='save'){this.save('local');return;}
  if(action==='import'){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;if(file.size>2*1024*1024){this.error=word('저장 파일은 2MiB 이하여야 합니다.','Save file must be at most2MiB.');this.dirty=true;return;}this.restore(await file.text());};input.click();return;}
  if(action==='continue'){void loadSwingbyLocalText().then(text=>{if(text)this.restore(text);else{this.notice=word('저장된 스윙바이 비행이 없습니다.','No saved swingby flight.');this.dirty=true;}}).catch(()=>{this.error=word('저장 공간을 읽지 못했습니다.','Could not read saved flight.');this.dirty=true;});return;}
  if(action==='cancel-restore'){this.barrier('cancel-restore');return;}if(this.pending||this.restoring)return;
  if(action==='inspect'){this.scene.setInspection(!this.scene.getInspectionState().enabled);this.dirty=true;return;}
  if(action==='whole-craft'){this.scene.focusInspectionPart(null);this.dirty=true;return;}
  if(action.startsWith('view-')){this.overview=action.slice(5) as 'whole'|'encounter'|'aim'|'correction';this.scene.focusOverview(this.overview);this.dirty=true;return;}
  if(action==='timeline-toggle'){this.timelineExpanded=!this.timelineExpanded;this.dirty=true;return;}
  if(action==='launch'&&this.solution&&this.evaluation?.launchable&&!this.runtime){this.forecastPending=false;this.barrier('launch',{inputHash:this.solution.inputHash});return;}
  if(action==='forecast'&&this.solution&&!this.runtime){this.forecastPending=true;this.post('forecast');this.dirty=true;return;}
  if(action==='cancel-forecast'){this.post('cancel-forecast');return;}
  if(action==='play'&&this.runtime?.status==='running'){if(this.playing||this.busy)this.pause();else{this.playing=true;this.demand=this.runtime.time;this.dirty=true;}return;}
  if(action==='next'&&this.runtime?.status==='running'){this.playing=false;this.barrier('warp');this.dirty=true;return;}
  if(action==='speed'){this.speed=this.speed===60?3600:this.speed===3600?21600:60;this.dirty=true;return;}
  if(action==='review'&&this.runtime){this.save('review');return;}
  if(action==='edit'){this.save('edit');return;}
  if(action==='retry'){this.pause();this.runtime=null;this.telemetry=null;this.result=null;this.actual=[];this.demand=0;this.timelineExpanded=true;this.scene.setInspection(false);this.solve();return;}
  if(action==='undo'||action==='redo'){this.history(action);return;}
  if(action==='reset'&&!this.runtime){this.remember();this.plan=createSwingbyPlan('starter');this.solve();return;}
  if(action==='range'){this.timelineRange=this.timelineRange==='encounter'?'delivery':'encounter';this.dirty=true;return;}
 };
 private range(){const peri=this.solution?.periapsisSeconds??this.displaySolution?.periapsisSeconds??138000;return this.timelineRange==='encounter'?{start:peri-4*3600,end:peri+4*3600}:{start:peri,end:Math.min(getSwingbyScenario().deadlineSeconds,peri+52*3600)};}
 private onTimelineDown=(e:PointerEvent)=>{
  const block=(e.target as HTMLElement).closest<HTMLElement>('[data-swingby-operation]');if(!block||this.runtime||this.pending||this.closing||this.saveTransaction||e.button!==0)return;
  const op=this.plan.operations.find(o=>o.id===block.dataset.swingbyOperation),track=block.parentElement!;if(!op)return;
  const r=this.range();this.drag={id:op.id,edge:!!(e.target as HTMLElement).closest('[data-resize]'),pointer:e.pointerId,x:e.clientX,start:op.start,end:op.end,scale:(r.end-r.start)/track.clientWidth,before:structuredClone(this.plan)};track.setPointerCapture(e.pointerId);e.preventDefault();
 };
 private onPointerMove=(e:PointerEvent)=>{
  const d=this.drag;if(!d||e.pointerId!==d.pointer)return;const op=this.plan.operations.find(o=>o.id===d.id)!;
  const delta=Math.round((e.clientX-d.x)*d.scale/60)*60;
  if(d.edge)op.end=Math.max(op.start+60,Math.min(getSwingbyScenario().deadlineSeconds,d.end+delta));else{op.start=Math.max(0,Math.min(getSwingbyScenario().deadlineSeconds-(d.end-d.start),d.start+delta));op.end=op.start+d.end-d.start;}
  const block=this.timeline.querySelector<HTMLElement>(`[data-swingby-operation="${CSS.escape(d.id)}"]`),r=this.range();if(block){block.style.left=`${(op.start-r.start)/(r.end-r.start)*100}%`;block.style.width=`${(op.end-op.start)/(r.end-r.start)*100}%`;block.title=`${time(op.start)} → ${time(op.end)}`;}
 };
 private onPointerBegin=()=>{this.pointerBusy=true;};
 private onPointerUp=(e:PointerEvent)=>{this.pointerBusy=false;if(!this.drag||this.drag.pointer!==e.pointerId)return;const before=this.drag.before;this.drag=null;this.remember(before);this.solve();};
 private onPointerCancel=()=>{this.pointerBusy=false;if(!this.drag)return;this.plan=this.drag.before;this.drag=null;this.dirty=true;};
 private button(action:string,label:string,disabled=false,primary=false){return `<button class="${primary?'swingby-primary':''}" data-swingby-action="${action}" ${disabled?'disabled':''}>${label}</button>`;}
 private metric(label:string,value:string,pass?:boolean){return `<div class="swingby-metric ${pass===undefined?'':pass?'passed':'missed'}"><span>${label}</span><strong>${value}</strong></div>`;}
 private paint(){
  const active=document.activeElement instanceof HTMLElement&&this.element.contains(document.activeElement)?document.activeElement:null;
  const focusKey=active?.dataset.swingbyAction?`[data-swingby-action="${CSS.escape(active.dataset.swingbyAction)}"]`:active?.dataset.swingbyOperation?`[data-swingby-operation="${CSS.escape(active.dataset.swingbyOperation)}"]`:null;
  const scroll={left:this.left.scrollTop,right:this.right.scrollTop,track:this.timeline.querySelector('.swingby-track-viewport')?.scrollTop??0};
  const w=word,s=getSwingbyScenario(),sol=this.solution,ev=this.evaluation,rt=this.runtime,t=this.telemetry,locked=this.workerFailed||this.pending||this.restoring||this.closing||this.saveTransaction,inspect=this.scene.getInspectionState().enabled;
  this.header.innerHTML=`<div><span class="swingby-eyebrow">ORBITAL FOUNDRY / M02B</span><h1>${w('화성의 중력으로 다음 항로를 열어라','Find your next route through Mars')}</h1></div><nav>${this.runtime?this.button('review',w('비행 분석 · A/B','Review flight · A/B'),locked):''}${this.button('save',w('저장','Save'),locked)}${this.button('export','JSON ↓',locked)}${this.button('import','JSON ↑',locked)}${this.button('exit',w('임무 선택','Missions'),locked)}</nav>`;
  const liveExit=rt?.achievedExit,exit=liveExit??sol?.exit,periRecorded=!!rt?.processedEventIds.includes('periapsis'),shownAltitude=periRecorded?rt!.minimumAltitudeKm:sol?.periapsisAltitudeKm;
  this.left.innerHTML=`<span class="swingby-eyebrow">${rt?w('실제 비행','ACTUAL FLIGHT'):w('경로 설계','FLIGHT PLANNING')}</span><h2>${w('한 번의 기동, 세 가지 약속','One burn. Three commitments.')}</h2>${!rt?`<p>${w('화성을 안전하게 돌아 목표 방향·에너지로 나가고, 관측 자료를 지구에 보내세요.','Pass Mars safely, leave with the target direction and energy, and deliver spectra to Earth.')}</p>`:''}<div class="swingby-clock">T+${time(rt?.time??0)}</div><div class="swingby-status">${this.restoring?w('저장 검증 중','Verifying save'):this.pending?w('새 경로 계산 중','Solving new route'):rt?rt.status==='running'?(this.playing?w('비행 중','Running'):w('일시정지','Paused')):w('비행 종료','Flight ended'):w('아직 출발하지 않았습니다','Flight has not started')}</div><div class="swingby-divider"></div><span class="swingby-eyebrow">${liveExit?w('실제로 통과한 출구','RECORDED OUTBOUND CROSSING'):w('예측 출구 · 실행 후 확인','PREDICTED EXIT · UNVERIFIED')}</span>${this.metric(w('목표 방향 오차','Direction error'),`${fmt(exit?.directionErrorDeg,4)}° / ${s.exit.toleranceDeg}°`,exit?.directionPassed)}${this.metric(w('태양 기준 비에너지','Solar specific energy'),`${fmt(exit?.energyKm2S2,2)} km²/s²`,exit?.energyPassed)}<small>${fmt(s.exit.energyRangeKm2S2[0])} … ${fmt(s.exit.energyRangeKm2S2[1])} km²/s²</small>${this.metric(periRecorded?w('실제 최근접 고도','Recorded closest altitude'):w('최근접 고도 예측','Predicted closest altitude'),`${fmt(shownAltitude)} km`,shownAltitude===undefined?undefined:shownAltitude>=s.safetyAltitudeKm)}${this.metric(w('지구 수신 자료','Spectra received on Earth'),`${rt?.scienceReceived??0} / ${s.science.targetPackets}`,rt?rt.scienceReceived>=s.science.targetPackets:undefined)}<div class="swingby-divider"></div>${rt?`${this.metric(w('태양광 / 소비','Generation / load'),`${fmt(t?.solarPowerW)} / ${fmt(t?.loadPowerW)} W`)}${this.metric(w('배터리','Battery'),`${fmt(rt.energyWh)} / ${fmt(t?.batteryWh)} Wh`)}${this.metric(w('남은 추진제','Propellant remaining'),`${fmt(rt.fuelKg,4)} kg`)}${this.metric(w('기동 상태','Correction'),esc(rt.burn?.status??t?.burnPhase??'pending'))}`:`<ol><li>${w('조준면의 주황색 표적을 드래그하세요.','Drag the orange aim-plane target.')}</li><li>${w('목표 방향과 에너지, 연료를 함께 확인하세요.','Check direction, energy and fuel together.')}</li><li>${w('관측·교신 시간을 움직이고 실제로 비행하세요.','Move observation and downlink blocks, then fly.')}</li></ol>`}`;
  const primary=rt?`<div class="swingby-actions swingby-run-controls">${this.button('play',this.playing||this.busy?w('일시정지','Pause'):w('계속 비행','Resume'),locked||rt.status!=='running')}${this.button('next',w('다음 사건까지','Next event'),locked||rt.status!=='running'||this.busy)}${this.button('speed',`${this.speed}×`,locked)}</div>`:`${this.button('launch',w('계획대로 비행 시작','Fly this plan'),locked||!ev?.launchable||this.busy,true)}`;
  this.right.innerHTML=`<span class="swingby-eyebrow">${rt?w('임무 운용','MISSION OPERATIONS'):w('설계 검토','DESIGN REVIEW')}</span><h2>${w('선택이 결과를 바꿉니다','Choices change the outcome')}</h2>${primary}${this.error?`<p class="swingby-error" role="alert">${esc(this.error)}</p>`:''}${this.unsavedExit?`<p class="swingby-notice">${this.workerFailed?w('이전 저장을 유지한 채 임무 선택으로 돌아갈 수 있습니다.','You can return to mission selection while keeping the previous save.'):w('현재 변경을 저장하지 못했습니다. JSON 백업을 받거나, 이전 저장을 유지한 채 나갈 수 있습니다.','These changes could not be saved. Download a JSON backup, or leave while keeping the previous save.')}</p>${this.button('leave-unsaved',w('현재 변경 저장 없이 나가기','Leave without saving changes'))}`:''}${this.notice?`<p class="swingby-notice" role="status">${esc(this.notice)}</p>`:''}${this.restoring?this.button('cancel-restore',w('불러오기 취소','Cancel restore')):''}${!rt?`${this.button('edit',w('장비 위치 바꾸기','Rearrange hardware'),locked)}${this.metric(w('질량 / 예산','Mass / credits'),`${fmt(ev?.loadedMassKg,2)} kg · ${fmt(ev?.totalCost,0)}/${ev?.budget??760}`)}${this.metric(w('요구 속도 변화','Required Δv'),`${fmt(sol?Math.hypot(...sol.correction.vectorMps):null,3)} m/s`)}${this.metric(w('예측 추진제','Predicted fuel'),`${fmt(ev?.requiredFuelKg,4)} / ${s.initialFuelKg} kg`)}${this.metric(w('무게중심 보정각','CG trim angle'),`${fmt(ev?.gimbalAngleDeg,2)}° / ${SWINGBY_PROPULSION.maximumGimbalDeg}°`)}<div class="swingby-actions">${this.button('undo',w('되돌리기','Undo'),locked||!this.undoStack.length)}${this.button('redo',w('다시 실행','Redo'),locked||!this.redoStack.length)}${this.button('reset',w('무기동 경로','Zero-burn draft'),locked)}</div>${this.button('forecast',w('기체·일정 예측','Forecast craft + schedule'),locked||!ev?.launchable||this.forecastPending)}${this.forecastPending?this.button('cancel-forecast',w('예측 취소','Cancel forecast')):''}${this.forecast?`<p class="swingby-notice">${w('예측 결과','Forecast')}: ${esc(this.forecast.status)} · ${this.forecast.received}/${this.forecast.required} ${w('자료 수신','spectra received')} · ${this.forecast.score}/100</p>`:''}`:`${this.result?`<div class="swingby-result"><strong>${this.result.status==='success'?w('임무 성공','Mission success'):this.result.status==='partial'?w('일부 목표 달성','Partial mission'):w('임무 목표 미달','Mission incomplete')}</strong><b>${this.result.score}/100</b><p>${w('실제 출구·안전 고도·지구 수신 기록을 평가했습니다.','Evaluated the actual exit, safe altitude and Earth receipt.')}</p>${this.button('retry',w('설계를 바꾸고 다시 도전','Revise and retry'))}</div>`:''}<div class="swingby-events">${rt.events.slice(-5).reverse().map(e=>`<p><time>${time(e.time)}</time><span>${esc(eventText(e.code,e.message))}</span></p>`).join('')}</div>`}<div class="swingby-issues">${this.issues.map(i=>`<p class="${i.severity==='error'?'swingby-error':''}"><b>${esc(i.code)}</b> ${esc(issueText(i.code,i.message))}</p>`).join('')}</div><details><summary>${w('이 임무의 과학 모델','Science model')}</summary><p>${w('2027년 실제 천체력 시각의 국소 화성 조우입니다. 앞선 지구 출발 비행은 이 임무에 포함되지 않습니다. 1시간 뒤 한 번의 이상적 충격 기동을 수행하며, 실제 자세·전력·추진제 조건을 충족해야 합니다.','A local Mars encounter at a 2027 ephemeris epoch. The earlier Earth departure is outside this mission. One ideal impulse occurs after one hour only if actual attitude, power and fuel conditions permit.')}</p><p>${w('목표 출구는 화성 중심100,000km의 바깥쪽 통과입니다. 방향과 비에너지는 태양 기준이며, 화면의 작은 원뿔은 방향 차이를40배 확대합니다.','The exit is the outward 100,000km Mars-centred crossing. Direction and specific energy are heliocentric; the inset magnifies angular differences 40×.')}</p><p>${w('CG 보정 장치와 크레딧은 게임 가정입니다. 기체 표시는 확대되며 행성·경로 계산은 물리 좌표를 사용합니다. 지표 자전은 화면 연출용이고 지표 표적 계산에 쓰지 않습니다.','CG trim carrier and credits are authored assumptions. The craft is visually enlarged; flight calculations use physical coordinates. Surface rotation is a display convention, not a body-fixed targeting model.')}</p></details>`;
  this.hint.innerHTML=`<div class="swingby-actions">${this.button('view-aim',w('조준면','Aim plane'),locked)}${this.button('view-encounter',w('화성 조우','Encounter'),locked)}${this.button('view-whole',w('전체 항로','Whole route'),locked)}${this.button('inspect',inspect?w('경로로 돌아가기','Back to route'):w('탐사선 · F','Spacecraft · F'),locked)}${inspect?this.button('whole-craft',w('기체 전체','Fit craft')):''}</div><p>${inspect?w('오른쪽 드래그: 회전 · 휠: 확대 · 클릭: 부품 선택 · 더블클릭/F: 초점 · Esc: 경로','Right-drag: orbit · Wheel: zoom · Click: select · Double-click/F: focus · Esc: route'):this.draftAim?w('놓으면 실제 도달 경로를 계산합니다. Esc로 취소합니다.','Release to solve the reachable path. Esc cancels.'):this.overview==='aim'?w('정밀 조준 · 격자 한 칸400km · 표적을 끌고 놓아 경로 계산','Precision aim · Each grid cell400km · Drag and release to solve'):this.overview==='encounter'?w('화성 반지름 4배 범위 확대 · 기체가 화면 밖일 수 있습니다 · 전체 항로로 전환 가능','Close-up within 4 Mars radii · Craft may be outside this crop · Whole route shows the full path'):w('실제 항로 보기 · 조준면에서 표적 편집 · 오른쪽 드래그: 회전','Route view · Open Aim plane to edit · Right-drag: orbit')}</p>`;
  const velocityDisplay=this.scene.getVelocityDisplayState(),angularScale=velocityDisplay?.angularMagnification??40;this.velocity.hidden=inspect;this.velocity.innerHTML=`<span>${w(`출구 방향 · 각도${angularScale}배`,`EXIT DIRECTION · ANGLES${angularScale}×`)}</span><small>${w(`허용${s.exit.toleranceDeg}° · 보기${fmt(velocityDisplay?.viewZoom??1,2)}× · 청록: 예측 / 금색: 실제`,`Tolerance${s.exit.toleranceDeg}° · View${fmt(velocityDisplay?.viewZoom??1,2)}× · Cyan: forecast / Gold: actual`)}</small>`;
  this.paintTimeline();this.layout();
  if(focusKey)this.element.querySelector<HTMLElement>(focusKey)?.focus({preventScroll:true});this.left.scrollTop=scroll.left;this.right.scrollTop=scroll.right;const track=this.timeline.querySelector('.swingby-track-viewport');if(track)track.scrollTop=scroll.track;
 }
 private paintTimeline(){
  const collapsed=!!this.runtime&&!this.timelineExpanded;this.element.classList.toggle('timeline-collapsed',collapsed);
  if(collapsed){this.timeline.innerHTML=`<div class="swingby-timeline-title"><strong>${word('탑재 일정','ONBOARD SCHEDULE')}</strong><span>${word(`관측·교신 ${this.plan.operations.length}개 구간 · 실제 비행 기록 유지`,`Observation and contact · ${this.plan.operations.length} windows · Recorded flight retained`)}</span>${this.button('timeline-toggle',word('일정 펼치기','Expand schedule'))}</div>`;return;}
  const r=this.range(),span=r.end-r.start,peri=this.solution?.periapsisSeconds??this.displaySolution?.periapsisSeconds??138000;
  const occupied:number[]=[],rows=new Map<string,number>();
  const visible=this.plan.operations.filter(o=>o.end>r.start&&o.start<r.end).sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
  for(const op of visible){let row=occupied.findIndex(end=>end<=op.start);if(row<0)row=occupied.length;occupied[row]=op.end;rows.set(op.id,row);}
  this.timeline.innerHTML=`<div class="swingby-timeline-title"><strong>${word('관측과 교신을 직접 배치하세요','Place observation and downlink windows')}</strong>${this.runtime?this.button('timeline-toggle',word('일정 접기','Collapse schedule')):''}${this.button('range',this.timelineRange==='encounter'?word('접근8시간 → 수신52시간','Encounter8h → Delivery52h'):word('수신52시간 → 접근8시간','Delivery52h → Encounter8h'))}<span>${this.runtime?word('비행 중 일정은 고정됩니다.','Onboard plan is fixed during this encounter.'):word('드래그 · 방향키:1분 · Shift:10분 · Alt:길이','Drag · Arrows:1min · Shift:10min · Alt:resize')}</span></div><div class="swingby-track-viewport"><div class="swingby-track" style="height:${Math.max(1,occupied.length)*30}px">${visible.map(o=>`<div tabindex="0" role="group" aria-label="${esc(o.kind)} ${time(o.start)} — ${time(o.end)}" class="swingby-operation ${o.kind}" data-swingby-operation="${esc(o.id)}" style="top:${2+(rows.get(o.id)??0)*30}px;left:${(o.start-r.start)/span*100}%;width:${(o.end-o.start)/span*100}%" title="${time(o.start)} → ${time(o.end)}"><span>${o.kind==='observe'?word('분광 관측','Spectra'):o.kind==='downlink'?word('지구 송신','Downlink'):word('충전','Charge')}</span><i data-resize></i></div>`).join('')}<div class="swingby-periapsis" style="left:${(peri-r.start)/span*100}%"></div>${this.runtime&&this.runtime.time>=r.start&&this.runtime.time<=r.end?`<div class="swingby-now" style="left:${(this.runtime.time-r.start)/span*100}%"></div>`:''}</div></div><div class="swingby-ticks">${Array.from({length:5},(_,i)=>`<span>${fmt((r.start+span*i/4-peri)/3600,1)}h</span>`).join('')}</div><small>${word('0h = 예측 최근접 · 빈 구간은 충전 · 청록선: 계획 · 금색선: 실제로 지나온 경로','0h = predicted closest approach · Empty intervals charge · Cyan: planned · Gold: actually flown')}</small>`;
 }
 private layout(){
  if(this.closed)return;const box=this.element.getBoundingClientRect(),left=this.left.getBoundingClientRect(),right=this.right.getBoundingClientRect(),hint=this.hint.getBoundingClientRect(),timeline=this.timeline.getBoundingClientRect();
  const inset={left:Math.max(0,left.right-box.left+16),right:Math.max(0,box.right-right.left+16),top:Math.max(0,hint.bottom-box.top+12),bottom:Math.max(0,box.bottom-timeline.top+16)};
  const key=JSON.stringify([box.width,box.height,inset]);if(key!==this.layoutKey&&box.width-inset.left-inset.right>32&&box.height-inset.top-inset.bottom>32){this.layoutKey=key;this.scene.setInspectionViewport(inset);}
  const v=this.velocity.getBoundingClientRect();this.scene.setVelocityViewport(this.velocity.hidden?null:{left:v.left-box.left+6,top:v.top-box.top+30,width:Math.max(1,v.width-12),height:Math.max(1,v.height-58)});
 }
 private async openReview(text:string){
  if(this.closed||this.review||this.reviewOpening)return;
  this.reviewOpening=true;this.playing=false;
  try{
   const {ReviewExperience}=await import('./review-ui');
   if(this.closed)return;
   this.element.style.visibility='hidden';
   this.review=new ReviewExperience(this.container,{engineSaveText:text,quality:this.scene.getRenderSettings().quality,reducedMotion:this.scene.getRenderSettings().reducedMotion,
    close:()=>{this.review?.dispose();this.review=null;this.element.style.visibility='';this.last=performance.now();this.dirty=true;},
    fork:draft=>{this.review?.dispose();this.review=null;this.callbacks.edit(structuredClone(draft.craft),structuredClone(draft.plan),structuredClone(draft.numerics));},
   });
  }catch(error){this.element.style.visibility='';this.error=error instanceof Error?error.message:String(error);this.dirty=true;}
  finally{this.reviewOpening=false;}
 }
 private frame=(now:number)=>{
  if(this.closed)return;const dt=Math.min(.1,(now-this.last)/1000);this.last=now;
  if(this.review||this.reviewOpening){this.raf=requestAnimationFrame(this.frame);return;}
  if(this.playing&&!this.busy&&!this.pending&&this.runtime?.status==='running'){
   this.demand=Math.max(this.demand,this.runtime.requestedTime)+dt*this.speed;
   if(this.demand-this.runtime.requestedTime>=1){this.busy=true;this.post('advance',{targetTime:this.demand});}
  }
  if(!this.pending&&!this.restoring&&!this.closing&&this.draftSaveable&&now-this.lastAutosave>15000){
   const stamp=`${this.requestId}:${this.runtime?.time??'draft'}`;
   if(stamp!==this.savedStamp){this.savedStamp=stamp;this.lastAutosave=now;const id=++this.saveSeq;this.saveIntents.set(id,'auto');this.post('save',{saveId:id});}
  }
  if(this.dirty&&!this.drag&&!this.pointerBusy&&now-this.uiAt>120){this.paint();this.dirty=false;this.uiAt=now;}
  this.scene.render(dt);this.raf=requestAnimationFrame(this.frame);
 };
 getReview(){return this.review;}
 getState(){return {numerics:structuredClone(this.numerics),reviewOpen:!!this.review,reviewOpening:this.reviewOpening,plan:structuredClone(this.plan),craft:structuredClone(this.craft),solution:this.solution,evaluation:this.evaluation,runtime:this.runtime,telemetry:this.telemetry,result:this.result,forecast:this.forecast,playing:this.playing,pending:this.pending,busy:this.busy,revision:this.revision,requestId:this.requestId,controlEpoch:this.controlEpoch,error:this.error,inspection:this.scene.getInspectionState(),render:this.scene.getRenderSettings()};}
 dispose(){if(this.closed)return;this.closed=true;this.review?.dispose();this.review=null;cancelAnimationFrame(this.raf);this.worker.terminate();this.resizeObserver.disconnect();this.element.removeEventListener('click',this.onClick);this.element.removeEventListener('pointerdown',this.onPointerBegin);this.timeline.removeEventListener('pointerdown',this.onTimelineDown);window.removeEventListener('pointermove',this.onPointerMove);window.removeEventListener('pointerup',this.onPointerUp);window.removeEventListener('pointercancel',this.onPointerCancel);window.removeEventListener('keydown',this.onKey);document.removeEventListener('visibilitychange',this.onVisibility);this.scene.dispose();this.element.remove();}
}
