import './voyage.css';
import type {Design,Vec3} from '../sim';
import {AU_KM,solarBody,solarPosition,solarRouteState,type SolvedSolarRoute} from './model';
import {assistRouteState,assistLocalState,type SolvedAssistRoute} from './assist';
import {createOperations,encounterFrame,evaluateExposure,advanceOperations,advanceDownlink,releaseExposure,operationsSummary,executeCommand,resolveCruiseEvent,scheduledCruiseEvent,type OperationsState,type ScienceBand,type OnboardCommand,type ObservationInput} from './operations';
import {JOURNEY_KEY,craftKey,type JourneySnapshot,type JourneyPhase,type JourneyView} from './journey-save';
import type {SolarScene} from './scene';
import {savePhoto,loadPhotos,openPhotoAlbum,type ExpeditionPhoto} from './photo-album';

interface VoyageOptions {
 language:'ko'|'en';design:Design;route:SolvedSolarRoute;assist:SolvedAssistRoute|null;snapshot?:JourneySnapshot;
 onComplete:(result:{operations:OperationsState;images:Record<string,string>;receivedJd:number})=>void;
 onExit:()=>void;
 onReturnToMap?:()=>void;
}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const unit=(v:Vec3):Vec3=>v.map(x=>x/Math.max(1e-9,Math.hypot(...v))) as Vec3;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const formatTime=(seconds:number)=>seconds>=3600?`${(seconds/3600).toFixed(1)} h`:seconds>=60?`${(seconds/60).toFixed(1)} min`:`${Math.max(0,seconds).toFixed(1)} s`;

/** Presentation clock and input orchestration. Scientific credit stays in the
 * domain: no screen-space target, button press, or frame counter awards data. */
export class VoyageController {
 private ui=document.createElement('div');
 private ops:OperationsState;
 private phase:JourneyPhase='flight';private view:JourneyView='chase';private band:ScienceBand='visible';
 private flight=0;private flybySeconds=0;private flybySeen=false;
 private incidentResolved=false;private incidentActive=false;private paused=false;
 private shutter=false;private captureBusy=false;private images:Record<string,string>={};
 private sendElapsedSeconds=0;private disposed=false;private saveClock=0;private uiClock=0;
 private lastLayout='';private notice='';private noticeTime=0;private lost=false;private completed=false;
 private captureVersion=0;
 private shutterSeconds=0;private autoExposure=false;private shutterPointer=false;
 private latestPhoto:ExpeditionPhoto|null=null;
 private album:{close():void}|null=null;
 private trackingPoint:Vec3|null=null;
 private pointingRevision=0;
 private flybyAltitudeKm:number|null=null;
 constructor(private host:HTMLElement,private scene:SolarScene,private options:VoyageOptions){
  const earth=solarPosition('earth',options.route.arrivalJdTdb),position=options.route.arrivalPositionKm;
  const delay=Math.hypot(...position.map((v,i)=>v-earth[i]))/299792.458;
  this.ops=createOperations(options.design,options.route.targetId,options.route.arrivalVInfinityKmS,{oneWayLightSeconds:delay});
  if(options.snapshot){const s=options.snapshot;this.ops=s.operations;this.phase=s.phase;this.view=s.view;this.band=s.band;this.flight=s.flight;this.flybySeconds=s.flybySeconds;this.flybySeen=s.flybySeen;this.incidentResolved=s.incidentResolved;this.incidentActive=s.incidentActive;this.images={...s.images};this.sendElapsedSeconds=s.sendElapsedSeconds;this.paused=true;}
  this.latestPhoto=loadPhotos().find(photo=>photo.target===options.route.targetId)??null;
  this.ui.className='solar-voyage-ui';
 }
 private t(ko:string,en:string){return this.options.language==='ko'?ko:en;}
 private bodyName(id=this.options.route.targetId){const body=solarBody(id);return this.options.language==='ko'?body.nameKo:body.nameEn;}
 start(){
  this.host.append(this.ui);this.scene.setCraftDesign(this.options.design);this.scene.setRoute(this.options.route);
  if(this.options.assist)this.scene.setJourneyPath(this.options.assist.pointsAu,this.options.assist.request.assist,this.options.assist.legs[0].arrivalPositionKm.map(x=>x/AU_KM) as Vec3);
  this.ui.addEventListener('click',this.onClick);this.ui.addEventListener('pointerdown',this.onPointerDown);
  window.addEventListener('pointerup',this.onPointerUp);window.addEventListener('pointercancel',this.onCancel);
  window.addEventListener('keydown',this.onKeyDown);window.addEventListener('keyup',this.onKeyUp);window.addEventListener('blur',this.onBlur);
  document.addEventListener('visibilitychange',this.onVisibility);
  this.scene.canvas.addEventListener('webglcontextlost',this.onContextLost);this.scene.canvas.addEventListener('webglcontextrestored',this.onContextRestored);
  this.syncScene(true);this.draw(true);this.save();
 }
 private input():ObservationInput {
  const frame=encounterFrame(this.ops),pose=this.scene.getInstrumentPose();
  return {aimDirection:pose?.aimDirection??unit(frame.positionKm.map(x=>-x) as Vec3),positionKm:pose?.positionKm,fovDeg:pose?.fovDeg??65,shutterHeld:this.shutter&&this.view==='instrument',band:this.band};
 }
 tick(dt:number){
  if(this.disposed)return;dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
  this.noticeTime=Math.max(0,this.noticeTime-dt);if(!this.noticeTime)this.notice='';
  if(!this.paused&&!this.lost){
   if(this.phase==='flight'&&!this.incidentActive)this.advanceFlight(dt/72);
   else if(this.phase==='swingby'){this.flybySeconds+=dt;if(this.flybySeconds>=14){this.flybySeen=true;this.phase='flight';this.scene.setEncounter(this.options.route.targetId,false);this.view='chase';this.scene.setViewMode(this.view);}}
   else if(this.phase==='encounter'){
    this.ops=advanceOperations(this.ops,dt,this.input());
    if(this.ops.mode==='safe'&&this.shutter)this.cancelExposure();
    if(this.shutter){this.shutterSeconds+=dt;if(this.autoExposure&&this.shutterSeconds>=.85)void this.endExposure();}
   }else if(this.phase==='sending')this.tickSending(dt);
  }
  this.syncScene();this.uiClock+=dt;this.saveClock+=dt;
  if(this.uiClock>.08){this.draw();this.uiClock=0;}
  if(this.saveClock>1){this.save();this.saveClock=0;}
 }
 private advanceFlight(amount:number){
  let next=Math.min(1,this.flight+amount);
  if(!this.incidentResolved&&next>=.46){next=.46;this.incidentActive=true;}
  const a=this.options.assist,patch=a?a.encounterElapsedDays/a.flightDays:2;
  // An unresolved event and the flyby are ordered by actual route progress.
  if(a&&!this.flybySeen&&this.flight<=patch&&next>=patch){this.flight=patch;this.phase='swingby';this.flybySeconds=0;this.incidentActive=false;this.view='chase';this.syncScene(true);return;}
  this.flight=next;
  if(next>=1){this.phase='encounter';this.view='instrument';this.syncScene(true);this.flash(this.t('행성이 시야에 들어왔습니다. 넓은 모습부터 담아보세요.','The world is in view. Begin with a wide observation.'));}
 }
 private syncScene(reset=false){
  const route=this.options.route,a=this.options.assist;
  if(this.phase==='flight'){
   this.scene.setEpoch(route.departureJdTdb+route.flightDays*this.flight);
   const state=a?assistRouteState(a,route.flightDays*this.flight):solarRouteState(route,route.flightDays*this.flight);
   this.scene.setFlightPosition(state.positionKm.map(x=>x/AU_KM) as Vec3,state.velocityKmS);
  }else if(this.phase==='swingby'&&a){
   const span=Math.min(86400,Math.max(1000,4*a.requiredPeriapsisKm/Math.max(.1,Math.hypot(...a.periapsisState.velocityKmS))));
   const frame=assistLocalState(a,(this.flybySeconds/14*2-1)*span);
   this.flybyAltitudeKm=Math.hypot(...frame.positionKm)-solarBody(a.request.assist).radiusKm;
   this.scene.setEncounterFrame(a.request.assist,{...frame,sunDirectionBody:unit(a.legs[0].arrivalPositionKm.map(x=>-x) as Vec3)},[]);
  }else{
   this.scene.setEncounterFrame(route.targetId,encounterFrame(this.ops),this.ops.encounter.features);
   this.scene.setFeatureHints(this.ops.sensor==='spectrometer'||operationsSummary(this.ops).context?this.ops.encounter.features.map(f=>f.id):[]);
   if(this.ops.stabilized&&this.ops.mode==='science'){
    const input=this.input(),sample=evaluateExposure(this.ops,input),revision=this.scene.getPointingRevision(),manual=revision!==this.pointingRevision;
    this.pointingRevision=revision;
    if(!this.trackingPoint||manual||this.scene.isInstrumentDragging()){
     const origin=input.positionKm??encounterFrame(this.ops).positionKm;
     this.trackingPoint=sample.context&&!manual&&!this.scene.isInstrumentDragging()?[0,0,0]:sample.hit?origin.map((x,i)=>x+input.aimDirection[i]*sample.slantRangeKm) as Vec3:null;
    }
    if(this.trackingPoint&&!this.scene.isInstrumentDragging())this.scene.trackInstrumentTarget(this.trackingPoint);
   }else this.trackingPoint=null;
  }
  if(reset){this.scene.setViewMode(this.view);if(this.phase==='encounter'||this.phase==='sending')this.scene.setInstrument(this.ops.sensor);}
 }
 private tickSending(dt:number){
  if(this.ops.pendingCommand){this.ops=advanceOperations(this.ops,dt,{...this.input(),shutterHeld:false});return;}
  if(this.ops.mode==='safe'){
   this.ops=advanceOperations(this.ops,dt,{...this.input(),shutterHeld:false});return;
  }
  if(this.ops.mode!=='downlink')return;
  const remaining=this.ops.records.reduce((sum,r)=>sum+Math.max(0,r.dataBits-r.transmittedBits),0);
  if(remaining>1e-6){
   // Compress transmission to about eight wall seconds; actual link-rate and
   // physical Wh accounting remain in the domain, independent of flyby speed.
   const total=this.ops.records.reduce((sum,r)=>sum+r.dataBits,0)/this.ops.downlinkRateBps;
   this.ops=advanceDownlink(this.ops,Math.min(remaining/this.ops.downlinkRateBps,dt*Math.max(1,total/8)));
  }else{
   this.sendElapsedSeconds=Math.min(this.ops.oneWayLightSeconds,this.sendElapsedSeconds+dt*Math.max(1,this.ops.oneWayLightSeconds/8));
   if(this.sendElapsedSeconds>=this.ops.oneWayLightSeconds&&!this.completed){
    this.completed=true;this.save();
    // The planned encounter epoch represents local periapsis, not window entry.
    const physicalEncounter=encounterFrame(this.ops).elapsedSeconds;
    const transmission=this.ops.records.reduce((sum,r)=>sum+r.dataBits,0)/this.ops.downlinkRateBps;
    this.options.onComplete({operations:this.ops,images:{...this.images},receivedJd:this.options.route.arrivalJdTdb+(physicalEncounter+transmission+this.ops.oneWayLightSeconds)/86400});
   }
  }
 }
 private setView(view:JourneyView){
  if(view==='instrument'&&this.phase!=='encounter'&&this.phase!=='sending')return;
  this.cancelExposure();this.view=view;this.scene.setViewMode(view);this.draw(true);this.save();
 }
 private flash(message:string){this.notice=message;this.noticeTime=5;}
 private cancelExposure(){this.shutter=false;this.autoExposure=false;this.shutterPointer=false;this.shutterSeconds=0;this.ops={...this.ops,exposure:null};}
 private beginExposure(){
  if(this.lost||this.captureBusy||this.shutter||document.querySelector('dialog[open]')||this.phase!=='encounter'||this.view!=='instrument')return;
  if(this.paused||!operationsSummary(this.ops).canCapture){void this.capturePhoto(false,this.issue(this.ops.lastIssue));return;}
  this.shutterSeconds=0;this.autoExposure=false;this.shutter=true;this.draw();
 }
 private releaseShutter(){
  if(!this.shutter)return;
  // A tap requests an automatic exposure; holding still permits manual timing.
  if(this.shutterSeconds<.45){this.autoExposure=true;return;}
  void this.endExposure();
 }
 private async endExposure(){
  if(!this.shutter)return;this.shutter=false;this.autoExposure=false;
  const released=releaseExposure(this.ops);this.ops=released.state;const record=released.record;
  await this.capturePhoto(!!record?.valid,this.issue(record?.reason??this.ops.lastIssue),record?.valid?record.id:undefined);
 }
 private async capturePhoto(scientific:boolean,reason='',recordId?:string){
  if(this.captureBusy||this.disposed)return;
  this.captureBusy=true;const generation=++this.captureVersion;
  this.draw(true);
  try{
   const capture=await this.scene.captureInstrument();
   if(this.disposed||generation!==this.captureVersion)return;
   // The independent album always receives this photo. Keep checkpoint images
   // within the reader's 12-frame limit so repeated shots cannot break resume.
   if(recordId&&Object.keys(this.images).length<12)this.images[recordId]=capture.imageDataUrl;
   const result=savePhoto({imageDataUrl:capture.imageDataUrl,target:this.options.route.targetId,label:this.bodyName(),scientific});
   this.latestPhoto=result.photo;
   this.flash(!result.persisted?this.t('사진을 촬영했습니다. 브라우저 공간 부족 · 사진을 열어 파일로 저장하세요.','Photo captured. Browser storage is full · open it and download the file.'):scientific?this.t('사진 저장 완료 · 과학 관측 인정','Photo saved · science observation accepted'):this.t(`사진 저장 완료 · 과학 관측 미인정${reason?`: ${reason}`:''}`,`Photo saved · not a science observation${reason?`: ${reason}`:''}`));
  }catch{if(!this.disposed)this.flash(this.t('사진 생성에 실패했습니다. 촬영 버튼을 다시 눌러주세요. 측정 자료는 보존됩니다.','Could not create the photo. Press the shutter to retry. Measurements are preserved.'));}
  finally{if(!this.disposed){this.captureBusy=false;this.draw(true);this.save();}}
 }
 private showAlbum(){
  this.cancelExposure();this.paused=true;this.draw(true);this.save();
  this.album?.close();this.album=openPhotoAlbum(this.options.language);
 }
 private command(command:OnboardCommand){
  this.cancelExposure();this.ops=executeCommand(this.ops,command);this.paused=false;this.draw(true);this.save();
 }
 private warp(){
  if(this.incidentActive||this.phase!=='flight')return;
  this.paused=false;this.advanceFlight(1);this.syncScene(true);this.draw(true);this.save();
 }
 private restartEncounter(){
  const response=this.ops.cruiseResponse,delay=this.ops.oneWayLightSeconds;
  this.ops=createOperations(this.options.design,this.options.route.targetId,this.options.route.arrivalVInfinityKmS,{oneWayLightSeconds:delay});
  if(response!=='none')this.ops=resolveCruiseEvent(this.ops,response);
  this.images={};this.sendElapsedSeconds=0;this.phase='encounter';this.paused=false;this.view='instrument';this.band='visible';this.captureVersion++;this.captureBusy=false;
  this.trackingPoint=null;
  this.syncScene(true);this.draw(true);this.save();
 }
 private onClick=(event:MouseEvent)=>{
  const button=(event.target as HTMLElement).closest<HTMLElement>('[data-voyage]');if(!button)return;
  const action=button.dataset.voyage!;
  if(action==='photos')this.showAlbum();
  else if(action==='shutter'&&event.detail===0){this.beginExposure();if(this.shutter)this.autoExposure=true;}
  else if(action.startsWith('view:'))this.setView(action.slice(5) as JourneyView);
  else if(action==='pause'){this.cancelExposure();this.paused=!this.paused;this.draw(true);this.save();}
  else if(action==='exit'){this.cancelExposure();this.paused=true;this.save();this.options.onExit();}
  else if(action==='replan'){this.cancelExposure();this.completed=true;this.options.onReturnToMap?.();}
  else if(action==='warp')this.warp();
  else if(action==='safe-choice'||action==='continue-choice'){
   this.ops=resolveCruiseEvent(this.ops,action==='safe-choice'?'safe-mode':'continue');this.incidentResolved=true;this.incidentActive=false;this.paused=false;this.draw(true);this.save();
  }else if(action.startsWith('command:'))this.command(action.slice(8) as OnboardCommand);
  else if(action.startsWith('band:')){this.cancelExposure();this.band=action.slice(5) as ScienceBand;this.draw(true);}
  else if(action==='send'&&operationsSummary(this.ops).ready){this.phase='sending';this.sendElapsedSeconds=0;this.command('downlink');this.setView('chase');}
  else if(action==='retry')this.restartEncounter();
  else if(action==='resume-send')this.command('downlink');
 };
 private onPointerDown=(event:PointerEvent)=>{if(event.button===0&&(event.target as HTMLElement).closest('[data-voyage="shutter"]')){event.preventDefault();this.beginExposure();this.shutterPointer=this.shutter;}};
 private onPointerUp=()=>{if(this.shutterPointer){this.shutterPointer=false;this.releaseShutter();}};
 private onCancel=()=>{this.cancelExposure();};
 private onKeyDown=(event:KeyboardEvent)=>{
  if(event.repeat||document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName))return;
  if(event.code==='Space'){event.preventDefault();this.beginExposure();}
  if(event.code==='Escape'){this.cancelExposure();this.paused=true;this.draw(true);this.save();}
 };
 private onKeyUp=(event:KeyboardEvent)=>{if(event.code==='Space'&&!document.querySelector('dialog[open]')){event.preventDefault();this.releaseShutter();}};
 private onBlur=()=>{this.cancelExposure();this.paused=true;this.save();this.draw(true);};
 private onVisibility=()=>{if(document.hidden)this.onBlur();};
 private onContextLost=(event:Event)=>{event.preventDefault();this.lost=true;this.onBlur();};
 private onContextRestored=()=>{this.lost=false;this.paused=true;this.flash(this.t('그래픽 복구 완료 · 이어서 재생하세요.','Graphics restored · resume when ready.'));this.draw(true);};
 private issue(code:string){
  const messages:Record<string,[string,string]>={'window-closed':['관측 창 종료 · 자료를 보내거나 접근을 다시 연습하세요','Window closed · transmit or rehearse the approach'],space:['표면 밖','Outside the surface'],dark:['햇빛이 닿지 않는 면','Unlit surface'],limb:['가장자리: 더 정면으로','Limb: aim closer to centre'],short:['조금 더 길게 노출하세요','Hold a little longer'],blurred:['흔들림 과다 · 자세를 안정화하세요','Too much smear · stabilize pointing'],'low-signal':['신호 부족 · 더 오래 빛을 모으세요','Low signal · collect more light'],'bad-geometry':['넓은 원반 또는 관심 지역을 담으세요','Frame the disc or a region of interest'],'storage-full':['저장 공간 부족','Storage is full'],'framing-changed':['노출 중 대상이 달라졌습니다','Framing changed during exposure'],'stabilizing':['자세 안정화 중','Settling attitude'],'safe-hold':['안전 자세 · 냉각 중','Safe hold · cooling'],'thermal-safe':['과열 보호 · 자료 보존됨','Thermal protection · data preserved'],'thermal-warning':['온도 상승 · 안전 자세로 냉각 가능','Heating · safe hold can cool the sensor'],'reference-drift':['별 기준 이탈 · 자세 안정화 필요','Reference drift · stabilize pointing'],'record-limit':['관측 저장 한도에 도달했습니다','Observation limit reached']};
  return messages[code]?this.t(...messages[code]):'';
 }
 private button(action:string,label:string,extra=''){return `<button type="button" data-voyage="${action}" ${extra}>${label}</button>`;}
 private draw(force=false){
  if(this.disposed)return;
  const s=operationsSummary(this.ops),frame=encounterFrame(this.ops),sample=evaluateExposure(this.ops,this.input());
  const phaseLabel=this.phase==='flight'?this.t('항해','CRUISE'):this.phase==='swingby'?this.t('중력 도움','GRAVITY ASSIST'):this.phase==='sending'?this.t('지구로 보내는 편지','A LETTER HOME'):this.t('근접 탐사','CLOSE ENCOUNTER');
  const layout=[this.phase,this.view,this.paused,this.incidentActive,this.incidentResolved,this.ops.mode,!!this.ops.pendingCommand,this.ops.recoverySeconds>0,this.ops.temperatureC>=55,s.ready,this.ops.sensor,this.band,this.ops.records.length,this.captureBusy,this.lost,this.ops.playSeconds>=150].join(':');
  if(force||layout!==this.lastLayout){
   this.lastLayout=layout;
   const viewButtons=[this.button('view:map',this.t('항로','MAP'),this.view==='map'?'aria-pressed="true"':''),this.button('view:chase',this.t('탐사선','SPACECRAFT'),this.view==='chase'?'aria-pressed="true"':'')];
   if(this.phase==='encounter'||this.phase==='sending')viewButtons.push(this.button('view:instrument',this.t('관측기 시점','INSTRUMENT'),this.view==='instrument'?'aria-pressed="true"':''));
   let content='';
   if(this.incidentActive){content=`<section class="voyage-event"><span class="voyage-kicker">${this.t('자율 운용 · 상황 발생','ONBOARD OPERATIONS · DECISION')}</span><h2>${this.t('별의 기준이 흐려졌다','The stars have slipped')}</h2><p>${this.t('관측 직전, 별 추적기의 기준이 흔들립니다. 안정화 시간을 확보할까요, 관측 창을 지킬까요?','The star reference is drifting before arrival. Recover it now, or preserve the observing window?')}</p><div>${this.button('safe-choice',this.t('안전 자세로 회복 <small>안정된 시선 · 관측 창 12초 사용</small>','Recover in safe hold <small>Stable pointing · uses 12 seconds of the window</small>'))}${this.button('continue-choice',this.t('접근 유지 <small>관측 창 유지 · 도착 후 안정화 필요</small>','Continue the approach <small>Keep the window · stabilize on arrival</small>'))}</div></section>`;}
   else if(this.phase==='flight'){content=`<section class="voyage-story"><span class="voyage-kicker">${this.t('우리가 만든 작은 탐사선','THE SMALL SPACECRAFT WE BUILT')}</span><h1>${this.bodyName()}${this.t('을 향해',' AHEAD')}</h1><p>${this.t('지구의 마지막 명령을 품고, 햇빛과 별을 따라갑니다.','Carrying Earth’s last instructions, following sunlight and stars.')}</p><p class="voyage-forecast" data-live="forecast"></p></section><div class="voyage-next">${this.button('warp',this.t('다음 순간까지 ⏩','Next moment ⏩'),'class="voyage-primary"')}<small>${this.t('상황 발생과 근접 통과 앞에서 멈춥니다','Stops for decisions and close approaches')}</small></div>`;}
   else if(this.phase==='swingby'){content=`<section class="voyage-story"><span class="voyage-kicker">${this.t('엔진을 끈 채, 행성의 움직임을 빌리다','ENGINES QUIET · BORROWING A PLANET’S MOTION')}</span><h1>${this.bodyName(this.options.assist!.request.assist)} ${this.t('스윙바이','FLYBY')}</h1><p>${this.t('행성 기준 속력은 유지되고, 진행 방향이 휘어집니다.','Planet-relative speed is conserved while the direction turns.')}</p><strong>${(this.options.assist!.turnAngleRad*180/Math.PI).toFixed(1)}°</strong><small>${this.t('별도 국소 쌍곡선으로 본 근접 통과','Independent local hyperbola encounter view')}</small></section>`;}
   else if(this.phase==='encounter'){
    const status=this.ops.mode==='safe'?`${this.button('command:resume',this.t('관측 재개','Resume science'),this.ops.temperatureC>=55||this.ops.recoverySeconds>0?'disabled':'')}`:`${!this.ops.stabilized?this.button('command:stabilize',this.t('시선 안정화','Stabilize pointing'),this.ops.pendingCommand||this.ops.recoverySeconds>0?'disabled':''):''}${this.button('command:safe-mode',this.t('안전 자세','Safe hold'),this.ops.pendingCommand?'disabled':'')}`;
    const goals=this.ops.sensor==='camera'?`<div class="voyage-goal ${s.context?'done':''}"><b>${s.context?'✓':'01'}</b>${this.t('세계의 전체 모습','The whole world')}</div><div class="voyage-goal ${s.detail?'done':''}"><b>${s.detail?'✓':'02'}</b>${this.t('관심 지역의 세부','Detail of a region')}</div>`:`<div class="voyage-goal ${s.spectralPair?'done':''}"><b>${s.spectralPair?'✓':'◎'}</b>${this.t('같은 지역 · 두 파장','One region · two bands')}</div><div class="voyage-bands">${this.button('band:visible',this.t('가시광','VISIBLE'),this.band==='visible'?'aria-pressed="true"':'')}${this.button('band:nir',this.t('근적외선','NEAR IR'),this.band==='nir'?'aria-pressed="true"':'')}</div>`;
    content=`<section class="voyage-science"><span class="voyage-kicker">${this.t('아직 아무도 본 적 없는 시선','A NEW POINT OF VIEW')}</span><h2>${this.bodyName()}</h2>${goals}${this.latestPhoto?`<button type="button" data-voyage="photos" class="voyage-latest-photo"><img src="${this.latestPhoto.imageDataUrl}" alt="${this.t('방금 촬영한 탐사 사진','Latest captured expedition photo')}"><span>${this.t('사진 열기 · 파일로 저장','Open photo · Download')}</span></button>`:''}<div data-live="spectrum"></div>${s.ready?this.button('send',this.t('관측 자료 지구로 보내기 →','Send observations home →'),'class="voyage-primary"'):''}</section><section class="voyage-instrument ${this.view==='instrument'?'':'voyage-not-instrument'}"><div class="voyage-readout"><span data-live="target"></span><b data-live="signal"></b><span data-live="footprint"></span></div><div class="voyage-exposure-bar"><i data-live="exposure-bar"></i></div><div class="voyage-shutter-row">${this.view==='instrument'?this.button('shutter',this.t('● 사진 촬영','● Take photo'),`class="voyage-shutter" ${this.lost||this.captureBusy?'disabled':''}`):this.button('view:instrument',this.t('관측기 들여다보기','Look through the instrument'),'class="voyage-primary"')}</div><small>${this.t('클릭: 자동 촬영 · 길게 누르기: 수동 노출 · 휠: 화각','Click: auto exposure · Hold: manual exposure · Wheel: zoom')}</small><p data-live="issue"></p></section><aside class="voyage-commands">${status}${this.ops.playSeconds>=150?this.button('retry',this.t('접근 다시 연습','Rehearse this approach again')):''}</aside>`;
   }else{
    content=`<section class="voyage-letter"><span class="voyage-kicker">${this.t('서두를 수 없는 마지막 구간','THE LAST LEG CANNOT OUTRUN LIGHT')}</span><h1 data-live="send-title"></h1><p data-live="send-detail"></p><div class="voyage-transfer"><i data-live="send-bar"></i></div><small>${this.t('송신과 전파 이동을 시간 압축으로 재생 중','Transmission and propagation shown with time compression')}</small>${this.ops.mode==='safe'?`<p>${this.t('온도 보호로 송신 대기 · 자료는 보존됩니다','Thermal hold · stored data is preserved')}</p>${this.button('resume-send',this.t('식으면 송신 재개','Resume downlink after cooling'),this.ops.temperatureC>=55?'disabled':'')}`:''}</section>`;
   }
   this.ui.innerHTML=`<header class="voyage-header"><div><span class="voyage-kicker">${phaseLabel}</span><strong>${esc(this.options.design.name)}</strong></div><nav aria-label="${this.t('탐사 시점','Voyage view')}">${viewButtons.join('')}</nav><div class="voyage-header-actions">${this.button('pause',this.paused?this.t('▶ 이어서','▶ Resume'):this.t('Ⅱ 잠시 멈춤','Ⅱ Pause'))}${this.button('photos',this.t('사진첩','Photos'))}${this.button('exit',this.t('저장하고 돌아가기','Save & return'))}</div></header>${content}<div class="voyage-reticle ${this.view==='instrument'&&this.phase==='encounter'?'':'hidden'}"><i></i><i></i><i></i><i></i></div><div class="voyage-markers"></div><footer class="voyage-telemetry"><span data-live="distance"></span><span data-live="battery"></span><span data-live="temperature"></span><span data-live="memory"></span><span data-live="light"></span><span data-live="clock"></span></footer><div class="voyage-toast" role="status" data-live="notice"></div>${this.paused?`<div class="voyage-paused"><span>${this.lost?this.t('그래픽 복구 대기 · 진행 저장됨','Waiting for graphics recovery · progress saved'):this.t('잠시 멈춤','PAUSED')}</span>${!this.lost?this.button('pause',this.t('▶ 이어서 탐사','▶ Continue expedition'),'class="voyage-primary"'):''}</div>`:''}`;
  }
  const pausePanel=this.ui.querySelector('.voyage-paused');
  if(pausePanel&&this.options.onReturnToMap&&!pausePanel.querySelector('[data-voyage="replan"]'))pausePanel.insertAdjacentHTML('beforeend',this.button('replan',this.t('항로 다시 설계','Replan the route')));
  const set=(key:string,value:string)=>{const el=this.ui.querySelector<HTMLElement>(`[data-live="${key}"]`);if(el&&el.textContent!==value)el.textContent=value;};
  set('forecast',scheduledCruiseEvent(this.flight)&&!this.incidentResolved?this.t('관제 메모 · 별 추적기 신호가 약해지고 있습니다','CONTROL NOTE · star-reference signal is weakening'):'');
  set('distance',this.phase==='flight'?`${this.t('여정','JOURNEY')} ${(this.flight*100).toFixed(1)}%`:`${this.t('고도','ALTITUDE')} ${Math.round(this.phase==='swingby'?(this.flybyAltitudeKm??frame.altitudeKm):frame.altitudeKm).toLocaleString()} km`);
  set('battery',`${this.t('전력','ENERGY')} ${this.ops.batteryWh.toFixed(1)} Wh`);set('temperature',`${this.t('관측기','SENSOR')} ${this.ops.temperatureC.toFixed(1)}°C`);
  set('memory',`${this.t('선내','ONBOARD')} ${(this.ops.storedBits/8e6).toFixed(1)} MB`);set('light',`${this.t('빛의 편도','ONE-WAY LIGHT')} ${formatTime(this.ops.oneWayLightSeconds)}`);
  set('clock',this.phase==='encounter'?`${this.t('관측 창','WINDOW')} ${Math.max(0,150-this.ops.playSeconds).toFixed(0)} s`:this.t('선내 운용 연습 · 시간 압축','ONBOARD REHEARSAL · TIME COMPRESSED'));
  const region=this.ops.encounter.features.find(f=>f.id===sample.featureId);
  set('target',sample.reason==='ready'?(sample.context?this.t('전체 원반','FULL DISC'):region?this.t(region.labelKo,region.labelEn):this.t('표면 · 관심 지역을 찾아보세요','SURFACE · FIND A REGION')):this.issue(sample.reason));
  set('signal',this.shutter?`${this.t('촬영 중','EXPOSING')} · SNR ${s.exposureSnr.toFixed(1)} · ${this.t('흔들림','SMEAR')} ${s.exposureSmear.toFixed(2)} px`:this.t('사진 촬영 · 한 번 클릭','Click once to take a photo'));
  if(!this.shutter&&region&&sample.footprintKm>region.radiusKm*(this.ops.sensor==='camera'?2.6:3))set('signal',this.t('아직 멀어요 · 다가오는 모습을 지켜보세요','Still too far · watch the world draw closer'));
  set('footprint',sample.hit?`${this.t('화폭','FOOTPRINT')} ${sample.footprintKm.toFixed(1)} km · ${this.t('해상도','GSD')} ${sample.gsdM.toFixed(0)} m/px`:'');
  set('issue',this.ops.pendingCommand?this.t('선내 명령 실행 중…','Executing onboard command…'):this.ops.recoverySeconds>0?`${this.t('자세 회복','SETTLING')} ${this.ops.recoverySeconds.toFixed(1)} s`:this.issue(this.ops.lastIssue));
  const bar=this.ui.querySelector<HTMLElement>('[data-live="exposure-bar"]');if(bar)bar.style.width=`${this.shutter?Math.min(100,this.shutterSeconds/.85*100):0}%`;
  const shutter=this.ui.querySelector<HTMLElement>('[data-voyage="shutter"]');shutter?.classList.toggle('exposing',this.shutter);
  if(shutter)shutter.textContent=this.captureBusy?this.t('사진 생성 중…','Creating photo…'):this.shutter?this.t('● 촬영 중…','● Exposing…'):this.t('● 사진 촬영','● Take photo');
  const chart=this.ui.querySelector<HTMLElement>('[data-live="spectrum"]');if(chart&&s.spectralPair){chart.innerHTML=`<small>${this.t('가상 두 파장 비교 · 화학 물질 판정 아님','Illustrative two-band comparison · not chemical identification')}</small><div class="voyage-spectrum">${s.spectralPair.map(r=>`<div><i style="height:${Math.max(2,(r.reflectanceEstimate??0)*100)}%"></i><span>${r.band==='visible'?'VIS':'NIR'}</span><b>${r.reflectanceEstimate?.toFixed(3)} ± ${r.reflectanceUncertainty?.toFixed(3)}</b></div>`).join('')}</div>`;}
  set('notice',this.notice);this.ui.querySelector('.voyage-toast')?.classList.toggle('visible',!!this.notice);
  if(this.phase==='sending'){
   const total=this.ops.records.reduce((sum,r)=>sum+r.dataBits,0),sent=this.ops.records.reduce((sum,r)=>sum+r.transmittedBits,0),inTransit=sent>=total-1e-6;
   set('send-title',inTransit?this.t('빛이 지구를 향하고 있습니다','The signal is travelling home'):this.t('관측 자료를 송신합니다','Transmitting the observations'));
   set('send-detail',inTransit?`${this.t('남은 전파 이동','SIGNAL TRAVEL REMAINING')} ${formatTime(Math.max(0,this.ops.oneWayLightSeconds-this.sendElapsedSeconds))}`:`${(sent/8e6).toFixed(2)} / ${(total/8e6).toFixed(2)} MB · ${(this.ops.downlinkRateBps/1000).toFixed(0)} kbps`);
   const sendBar=this.ui.querySelector<HTMLElement>('[data-live="send-bar"]');if(sendBar)sendBar.style.width=`${100*(inTransit?this.sendElapsedSeconds/Math.max(1e-6,this.ops.oneWayLightSeconds):sent/Math.max(1,total))}%`;
  }
  this.drawMarkers();
 }
 private drawMarkers(){
  const holder=this.ui.querySelector<HTMLElement>('.voyage-markers');if(!holder)return;
  if(this.view!=='instrument'||this.phase!=='encounter'||(this.ops.sensor==='camera'&&!operationsSummary(this.ops).context)){holder.innerHTML='';return;}
  // Quiet annotations locate actual body-fixed features, never grant credit.
  const bounds=this.host.getBoundingClientRect();
  holder.innerHTML=this.ops.encounter.features.map(feature=>{const p=this.scene.projectFeature(feature.id);return p?.visible&&p.x>bounds.width*.22&&p.x<bounds.width*.8&&p.y>100&&p.y<bounds.height-230?`<span style="left:${p.x}px;top:${p.y}px">◇<small>${esc(this.t(feature.labelKo,feature.labelEn))}</small></span>`:'';}).join('');
 }
 private save(){
  if(this.disposed||this.completed)return;
  const snapshot:JourneySnapshot={version:2,designKey:craftKey(this.options.design),target:this.options.route.targetId,departureJd:this.options.route.departureJdTdb,flightDays:this.options.route.flightDays,phase:this.phase,flight:this.flight,flybySeconds:this.flybySeconds,flybySeen:this.flybySeen,incidentResolved:this.incidentResolved,incidentActive:this.incidentActive,view:this.view,band:this.band,operations:{...this.ops,exposure:null},assistRequest:this.options.assist?.request??null,images:this.images,sendElapsedSeconds:this.sendElapsedSeconds};
  try{localStorage.setItem(JOURNEY_KEY,JSON.stringify(snapshot));}catch{this.flash(this.t('저장 공간이 부족합니다. 이 탐사는 현재 탭에서 계속할 수 있습니다.','Storage is full. This expedition can continue in the current tab.'));}
 }
 getState(){return {phase:this.phase,view:this.view,paused:this.paused,flight:this.flight,incidentActive:this.incidentActive,incidentResolved:this.incidentResolved,flybySeen:this.flybySeen,flybySeconds:this.flybySeconds,band:this.band,shutter:this.shutter,sendElapsedSeconds:this.sendElapsedSeconds,operations:structuredClone(this.ops),summary:operationsSummary(this.ops),frame:encounterFrame(this.ops),pose:this.scene.getInstrumentPose(),exposure:evaluateExposure(this.ops,this.input()),featureScreens:this.ops.encounter.features.map(f=>({id:f.id,...this.scene.projectFeature(f.id)})),images:Object.keys(this.images)};}
 dispose(){
  if(this.disposed)return;this.save();this.disposed=true;this.captureVersion++;this.cancelExposure();
  this.album?.close();
  this.ui.remove();window.removeEventListener('pointerup',this.onPointerUp);window.removeEventListener('pointercancel',this.onCancel);window.removeEventListener('keydown',this.onKeyDown);window.removeEventListener('keyup',this.onKeyUp);window.removeEventListener('blur',this.onBlur);document.removeEventListener('visibilitychange',this.onVisibility);this.scene.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.scene.canvas.removeEventListener('webglcontextrestored',this.onContextRestored);
 }
}

