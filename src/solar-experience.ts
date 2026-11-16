import './solar-experience.css';
import {SolarScene} from './solar/scene';
import {AU_KM,SOLAR_BODIES,SOLAR_EPOCH_JD,SOLAR_MAX_JD,findDefaultSolarRoute,planSolarRoute,solarFlightDayBounds,type SolarBodyId,type SolarRoute} from './solar/model';
import {CAMPAIGN_KEY,CARRIER,OBJECTIVES,boundedReceivedScience,campaignReadiness,observationProfile,parseCampaign,recordDiscovery,type Campaign,type Discovery} from './solar/campaign';
import {recommendedAssistBodies,searchAssistRoute,solveAssistRoute,type AssistSearchResult,type SolvedAssistRoute} from './solar/assist';
import {asSolarRoute,JOURNEY_KEY,parseJourney,type JourneySnapshot} from './solar/journey-save';
import {VoyageController} from './solar/voyage-controller';
import {loadPhotos,openPhotoAlbum,downloadPhoto,type ExpeditionPhoto} from './solar/photo-album';
import type {OperationsState} from './solar/operations';
import type {Design,Vec3} from './sim';

type Phase='intro'|'map'|'flight'|'encounter'|'sending'|'report';
interface Options {onClose:()=>void;onBuild:(design:Design)=>void;design?:Design;language:'ko'|'en'}
interface RouteHistory {departure:number;days:number;assist:SolvedAssistRoute|null}
const escape=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const date=(jd:number)=>new Date((jd-2440587.5)*86400000).toISOString().slice(0,10);
const num=(x:number,d=0)=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const names=(id:SolarBodyId,en:boolean)=>{const b=SOLAR_BODIES.find(b=>b.id===id)!;return en?b.nameEn:b.nameKo;};
export const SOLAR_ASSIST_PLAN_KEY='orbital-solar-assist-plan-v1';

/** The campaign owns a separate save and rendering lifetime. Existing laboratory
 * designs, numerical workers and their save keys are never repurposed. */
export class SolarExperience {
 private root=document.createElement('section');
 private world=document.createElement('div');
 private hud=document.createElement('div');
 private scene!:SolarScene;
 private campaign:Campaign;
 private phase:Phase='intro';
 private beat=0;
 private route:SolarRoute|null=null;
 private previous:RouteHistory|null=null;
 private drag:({kind:'arrival'|'departure';startX:number;pointer:number;last:number;target:HTMLElement}&RouteHistory)|null=null;
 private assist:SolvedAssistRoute|null=null;
 private assistPanel=false;
 private assistSearch:AssistSearchResult|null=null;
 private assistSearching=false;
 private assistSearchProgress=0;
 private assistAbort:AbortController|null=null;
 private assistBody:SolarBodyId|null=null;
 private directBeforeAssist:RouteHistory|null=null;
 private voyage:VoyageController|null=null;
 private running=false;
 private frame=0;
 private last=0;
 private journal=false;
 private model=false;
 private status='';
 private saved=true;
 private photo:string|undefined;
 private photoAlbum:{close():void}|null=null;
 private windowSearched=false;
 private graphicsLost=false;
 private readonly en:boolean;
 constructor(private host:HTMLElement,private options:Options){
  this.en=options.language==='en';
  let stored:string|null=null;try{stored=localStorage.getItem(CAMPAIGN_KEY);}catch{/* unavailable storage is surfaced in save status */}
  this.campaign=parseCampaign(stored);if(options.design)this.campaign.design=structuredClone(options.design);
  try{
   const raw=JSON.parse(localStorage.getItem(SOLAR_ASSIST_PLAN_KEY)??'null');
   if(raw?.version===1&&raw.request){
    const candidate=solveAssistRoute(raw.request);
    if(candidate.status==='solved'&&candidate.request.origin==='earth'&&candidate.request.target===this.campaign.target&&candidate.request.departureJdTdb===this.campaign.departureJd&&candidate.flightDays===this.campaign.flightDays){
     this.assist=candidate;
     if(Number.isFinite(raw.direct?.departure)&&raw.direct.departure>=SOLAR_EPOCH_JD&&raw.direct.departure<SOLAR_MAX_JD&&Number.isFinite(raw.direct?.days)&&raw.direct.days>=1&&raw.direct.days<=7300)this.directBeforeAssist={departure:raw.direct.departure,days:raw.direct.days,assist:null};
    }
   }
  }catch{/* An invalid map plan must never become a free gravity assist. */}
  this.phase=this.campaign.introSeen?'map':'intro';
 }
 start(){
  this.root.className='solar-experience';this.root.setAttribute('aria-label',this.words('태양계 탐사','Solar expedition'));
  this.world.className='solar-world';this.hud.className='solar-hud';this.root.append(this.world,this.hud);this.host.append(this.root);
  this.scene=new SolarScene(this.world,{onBody:id=>this.selectBody(id)});
  this.scene.canvas.addEventListener('webglcontextlost',this.contextLost);
  this.scene.canvas.addEventListener('webglcontextrestored',this.contextRestored);
  this.scene.setCraftDesign(this.campaign.design);this.scene.setEpoch(this.campaign.departureJd);
  this.recalculate(true);this.scene.setTarget(this.campaign.target);
  if(this.phase==='intro')this.scene.focusBody('aster');
  this.hud.addEventListener('click',this.click);this.hud.addEventListener('pointerdown',this.pointerDown);
  this.hud.addEventListener('pointermove',this.pointerMove);this.hud.addEventListener('pointerup',this.pointerUp);this.hud.addEventListener('pointercancel',this.pointerCancel);
  window.addEventListener('keydown',this.key);window.addEventListener('resize',this.resize);
  this.renderHUD();this.persist();
  let savedJourney:string|null=null;try{savedJourney=localStorage.getItem(JOURNEY_KEY);}catch{/* unavailable storage */}
  const restored=parseJourney(savedJourney,this.campaign.design);
  if(restored){
   this.campaign.target=restored.snapshot.target;this.campaign.departureJd=restored.snapshot.departureJd;this.campaign.flightDays=restored.snapshot.flightDays;this.campaign.introSeen=true;
   this.route=restored.route;this.assist=restored.assist;this.persist();this.beginVoyage(restored.snapshot);
  }
  this.running=true;this.frame=requestAnimationFrame(this.tick);
 }
 private words(ko:string,en:string){return this.en?en:ko;}
 private contextLost=()=>{this.graphicsLost=true;const notice=document.createElement('div');notice.className='solar-graphics-notice';notice.textContent=this.words('화면을 복구하는 동안 탐사를 잠시 멈춥니다.','Expedition paused while the graphics recover.');this.root.append(notice);};
 private contextRestored=()=>{this.graphicsLost=false;this.root.querySelector('.solar-graphics-notice')?.remove();};
 isSaved(){return this.saved;}
 getState(){return {phase:this.voyage?'voyage':this.phase,campaign:structuredClone(this.campaign),route:this.route?structuredClone(this.route):null,assist:this.assist?structuredClone(this.assist):null,assistSearching:this.assistSearching,voyage:this.voyage?.getState()??null};}
 assemblyBrief(){const p=observationProfile(this.campaign.target);return {title:names(this.campaign.target,this.en),sensor:p.sensor,reason:this.words(p.reasonKo,p.reasonEn)};}
 private persist(){try{
  localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(this.campaign));
  if(this.assist)localStorage.setItem(SOLAR_ASSIST_PLAN_KEY,JSON.stringify({version:1,request:this.assist.request,direct:this.directBeforeAssist?{departure:this.directBeforeAssist.departure,days:this.directBeforeAssist.days}:null}));
  else localStorage.removeItem(SOLAR_ASSIST_PLAN_KEY);
  this.saved=true;
 }catch{this.saved=false;}}
 private resize=()=>{this.scene.resize();this.project();};
 private recalculate(useDefault=false){
  const c=this.campaign;
  if(this.assist&&(this.assist.request.target!==c.target||this.assist.request.departureJdTdb!==c.departureJd||this.assist.flightDays!==c.flightDays))this.assist=null;
  this.route=this.assist?asSolarRoute(this.assist):useDefault&&c.flightDays<=0?findDefaultSolarRoute('earth',c.target,c.departureJd):planSolarRoute('earth',c.target,c.departureJd,c.flightDays);
  if(this.route.status==='solved')c.flightDays=this.route.flightDays;
  this.scene.setEpoch(c.departureJd);this.scene.setTarget(c.target);this.scene.setRoute(this.route);
  if(this.assist)this.scene.setJourneyPath(this.assist.pointsAu,this.assist.request.assist,this.assist.legs[0].arrivalPositionKm.map(x=>x/AU_KM) as Vec3);
 }
 private selectBody(id:SolarBodyId){
  if(this.phase==='intro'){if(id==='aster')this.nextBeat();return;}
  if(this.phase!=='map')return;
  if(id==='earth'){this.scene.focusBody('earth');this.status=this.words('지구 · 탐사선이 출발하고 자료가 돌아오는 곳','Earth · departure and receiving station');this.updateMetrics();return;}
  if(this.drag)this.cancelDrag();
  this.stopAssistSearch();this.assist=null;this.assistSearch=null;this.assistPanel=false;this.directBeforeAssist=null;
  this.campaign.target=id;this.campaign.flightDays=0;this.previous=null;this.status='';this.windowSearched=false;
  this.recalculate(true);this.scene.overview();this.persist();this.renderHUD();
 }
 private nextBeat(){
  if(this.beat<2){this.beat++;if(this.beat===1)this.scene.focusBody('earth');else this.scene.overview();this.renderHUD();return;}
  this.campaign.introSeen=true;this.phase='map';this.scene.overview();this.persist();this.renderHUD();
 }
 private click=(event:MouseEvent)=>{
  if(this.voyage)return;
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-solar-action],[data-solar-body],[data-assist-body]');if(!target)return;
  if(target.dataset.assistBody){void this.findAssist(target.dataset.assistBody as SolarBodyId);return;}
  if(target.dataset.solarBody){this.selectBody(target.dataset.solarBody as SolarBodyId);return;}
  if(target.dataset.solarAction?.startsWith('photo-')){
   const [action,discoveryIndex,sampleIndex]=target.dataset.solarAction.split(':');
   const discovery=this.campaign.discoveries[Number(discoveryIndex)];
   const photo=discovery?this.receivedPhoto(discovery,Number(sampleIndex)):null;
   if(photo){if(action==='photo-download'){try{downloadPhoto(photo);}catch{this.photoAlbum=openPhotoAlbum(this.options.language,[photo]);const status=document.querySelector('[data-photo-status]');if(status)status.textContent=this.words('파일을 만들지 못했어요. 사진을 다시 저장해 주세요.','The file could not be created. Please try saving it again.');}}else this.photoAlbum=openPhotoAlbum(this.options.language,[photo,...this.allPhotos().filter(item=>item.imageDataUrl!==photo.imageDataUrl)]);}
   return;
  }
  switch(target.dataset.solarAction){
   case 'close':this.options.onClose();break;
   case 'story':this.nextBeat();break;
   case 'skip':this.beat=2;this.nextBeat();break;
   case 'build':this.persist();this.options.onBuild(structuredClone(this.campaign.design));break;
   case 'overview':this.scene.overview();break;
   case 'journal':this.journal=!this.journal;this.model=false;this.assistPanel=false;this.renderHUD();break;
   case 'photos':this.photoAlbum=openPhotoAlbum(this.options.language,this.allPhotos());break;
   case 'model':this.model=!this.model;this.journal=false;this.assistPanel=false;this.renderHUD();break;
   case 'panel-close':this.model=false;this.journal=false;this.assistPanel=false;this.stopAssistSearch();this.renderHUD();break;
   case 'undo':if(this.previous){const prev=this.previous;this.previous=this.routeHistory();this.campaign.departureJd=prev.departure;this.campaign.flightDays=prev.days;this.assist=prev.assist;this.recalculate();this.persist();this.renderHUD();}break;
   case 'window':this.findWindow();break;
   case 'assist':this.assistPanel=true;this.model=false;this.journal=false;if(!this.assistSearch&&!this.assistSearching)void this.findAssist(recommendedAssistBodies(this.campaign.target)[0]);else this.renderHUD();break;
   case 'assist-apply':this.applyAssist();break;
   case 'direct':this.restoreDirect();break;
   case 'launch':this.launch();break;
   case 'map':this.phase='map';this.scene.setEncounter(this.campaign.target,false);this.scene.setFlightPosition(null);this.recalculate();this.scene.overview();this.renderHUD();break;
   case 'next':{const preferred=observationProfile(this.campaign.target).next;const next=SOLAR_BODIES.find(b=>b.id===preferred&&!this.campaign.discoveries.some(d=>d.body===b.id))??SOLAR_BODIES.find(b=>b.id!=='earth'&&!this.campaign.discoveries.some(d=>d.body===b.id));this.phase='map';this.scene.setEncounter(this.campaign.target,false);this.scene.setFlightPosition(null);if(next)this.selectBody(next.id);else{this.scene.overview();this.renderHUD();}break;}
  }
 };
 private findWindow(){
  this.previous=this.routeHistory();
  this.stopAssistSearch();this.assist=null;this.assistPanel=false;
  this.windowSearched=true;
  let best:SolarRoute|null=null;
  for(let day=0;day<=720;day+=60){const departure=SOLAR_EPOCH_JD+day;if(departure>=SOLAR_MAX_JD-30)continue;const r=findDefaultSolarRoute('earth',this.campaign.target,departure);if(r.status==='solved'&&(!best||best.status!=='solved'||r.departureDeltaVMps<best.departureDeltaVMps))best=r;}
  if(best?.status==='solved'){this.campaign.departureJd=best.departureJdTdb;this.campaign.flightDays=best.flightDays;this.recalculate();this.status=campaignReadiness(this.campaign.design,this.route).issues.includes('fuel')?this.words('이 기간에는 연료가 충분하지 않아요. 항로를 직접 조절하거나 다른 목적지를 골라 주세요.','No fuel-feasible route in this search. Adjust the route or choose another destination.'):this.words('검색한 출발 시점 중 연료가 적은 항로입니다.','A lower-fuel route among the searched opportunities.');}
  else this.status=this.words('이 기간에는 항로를 찾지 못했어요. 다른 목적지를 골라 주세요.','No route found in this interval. Choose another destination.');
  this.persist();this.renderHUD();
 }
 private routeHistory():RouteHistory{return {departure:this.campaign.departureJd,days:this.campaign.flightDays,assist:this.assist};}
 private stopAssistSearch(){this.assistAbort?.abort();this.assistAbort=null;this.assistSearching=false;}
 private async findAssist(body:SolarBodyId|undefined){
  if(!body||this.phase!=='map')return;
  this.stopAssistSearch();const controller=new AbortController();this.assistAbort=controller;
  this.assistBody=body;this.assistSearch=null;this.assistSearching=true;this.assistSearchProgress=0;this.assistPanel=true;this.renderHUD();
  try{
   const result=await searchAssistRoute({origin:'earth',assist:body,target:this.campaign.target,departureJdTdb:SOLAR_EPOCH_JD,requireSavings:true},{signal:controller.signal,onProgress:p=>{
    if(controller.signal.aborted)return;this.assistSearchProgress=p.completed/p.total;
    const fill=this.hud.querySelector<HTMLElement>('[data-assist-progress]');if(fill)fill.style.width=`${this.assistSearchProgress*100}%`;
   }});
   if(controller.signal.aborted)return;this.assistSearch=result;this.assistSearching=false;this.assistAbort=null;this.renderHUD();
  }catch(error){if(controller.signal.aborted)return;this.assistSearching=false;this.assistAbort=null;this.status=this.words('스윙바이를 계산하지 못했습니다. 현재 항로는 유지됩니다.','Could not solve the assist. Your current route is unchanged.');this.renderHUD();}
 }
 private applyAssist(){
  const candidate=this.assistSearch?.route;if(!candidate)return;
  this.previous=this.routeHistory();if(!this.assist)this.directBeforeAssist=this.previous;
  this.assist=candidate;this.campaign.departureJd=candidate.request.departureJdTdb;this.campaign.flightDays=candidate.flightDays;
  this.assistPanel=false;this.status=this.words('날짜를 끌어 바꾸면 직항으로 전환됩니다.','Dragging a date switches this plan to a direct route.');this.recalculate();this.scene.overview();this.persist();this.renderHUD();
 }
 private restoreDirect(){
  this.previous=this.routeHistory();const saved=this.directBeforeAssist;this.assist=null;this.assistPanel=false;
  if(saved){this.campaign.departureJd=saved.departure;this.campaign.flightDays=saved.days;}else this.campaign.flightDays=0;
  this.status='';this.recalculate(true);this.persist();this.renderHUD();
 }
 private pointerDown=(event:PointerEvent)=>{
  if(this.voyage||event.button!==0)return;
  const el=(event.target as HTMLElement).closest<HTMLElement>('[data-route-drag]');if(!el)return;
  if(this.phase!=='map'||this.drag)return;
  const kind=el.dataset.routeDrag as 'arrival'|'departure';event.preventDefault();el.setPointerCapture(event.pointerId);
  this.drag={kind,startX:event.clientX,...this.routeHistory(),pointer:event.pointerId,last:0,target:el};el.classList.add('dragging');
 };
 private pointerMove=(event:PointerEvent)=>{
  const d=this.drag;if(!d||d.pointer!==event.pointerId||performance.now()-d.last<32)return;d.last=performance.now();this.status='';this.windowSearched=false;
  const delta=event.clientX-d.startX;
  if(Math.abs(delta)<2&&this.campaign.departureJd===d.departure&&this.campaign.flightDays===d.days)return;
  if(this.assist){this.assist=null;this.status=this.words('날짜를 바꿔 직항을 다시 그립니다. 되돌리면 스윙바이가 복원됩니다.','Dates changed: plotting a direct route. Undo restores the assist.');}
  if(d.kind==='departure')this.campaign.departureJd=clamp(d.departure+Math.round(delta*1.5),SOLAR_EPOCH_JD,SOLAR_EPOCH_JD+900);
  else{const bounds=solarFlightDayBounds('earth',this.campaign.target,this.campaign.departureJd);const rate=Math.max(.5,d.days/220);this.campaign.flightDays=clamp(Math.round(d.days+delta*rate),bounds.min,bounds.max);}
  this.recalculate();this.updateMetrics();this.project();
 };
 private pointerUp=(event:PointerEvent)=>{
  const d=this.drag;if(!d||d.pointer!==event.pointerId)return;
  d.last=-Infinity;this.pointerMove(event);
  this.previous={departure:d.departure,days:d.days,assist:d.assist};d.target.classList.remove('dragging');this.drag=null;this.persist();this.renderHUD();
 };
 private pointerCancel=()=>{this.cancelDrag();this.project();};
 private cancelDrag(){const d=this.drag;if(!d)return;this.campaign.departureJd=d.departure;this.campaign.flightDays=d.days;this.assist=d.assist;this.drag=null;d.target.classList.remove('dragging');if(d.target.hasPointerCapture(d.pointer))d.target.releasePointerCapture(d.pointer);this.recalculate();this.renderHUD();}
 private key=(event:KeyboardEvent)=>{
  if(this.voyage)return;
  if(event.key==='Escape'){event.preventDefault();if(this.drag)this.cancelDrag();else if(this.model||this.journal||this.assistPanel){this.model=false;this.journal=false;this.assistPanel=false;this.stopAssistSearch();this.renderHUD();}return;}
  const el=(event.target as HTMLElement).closest<HTMLElement>('[data-route-drag]');if(!el||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();this.status=this.assist?this.words('날짜를 바꿔 직항으로 전환했습니다.','Changed dates: switched to a direct route.'):'';this.windowSearched=false;this.previous=this.routeHistory();this.assist=null;const sign=['ArrowLeft','ArrowDown'].includes(event.key)?-1:1;
  if(el.dataset.routeDrag==='departure')this.campaign.departureJd=clamp(this.campaign.departureJd+sign*(event.shiftKey?1:10),SOLAR_EPOCH_JD,SOLAR_EPOCH_JD+900);
  else{const b=solarFlightDayBounds('earth',this.campaign.target,this.campaign.departureJd);this.campaign.flightDays=clamp(this.campaign.flightDays+sign*(event.shiftKey?1:Math.max(5,Math.round(this.campaign.flightDays/40))),b.min,b.max);}
  this.recalculate();this.persist();this.updateMetrics();
 };
 private launch(){
  if(!this.route||this.route.status!=='solved'||!campaignReadiness(this.campaign.design,this.route).ready)return;
  this.beginVoyage();
 }
 private beginVoyage(snapshot?:JourneySnapshot){
  if(this.route?.status!=='solved')return;
  this.stopAssistSearch();this.phase='flight';this.model=false;this.journal=false;this.assistPanel=false;this.photo=undefined;
  this.hud.hidden=true;
  this.voyage=new VoyageController(this.root,this.scene,{language:this.options.language,design:this.campaign.design,route:this.route,assist:this.assist,snapshot,onComplete:(result:{operations:OperationsState;images:Record<string,string>;receivedJd:number})=>this.receiveVoyage(result),onExit:()=>this.options.onClose(),onReturnToMap:()=>this.returnToMap()});
  this.voyage.start();
 }
 private returnToMap(){
  this.voyage?.dispose();this.voyage=null;
  try{localStorage.removeItem(JOURNEY_KEY);}catch{/* Map remains available for this session. */}
  this.phase='map';this.scene.setEncounter(this.campaign.target,false);this.scene.setFlightPosition(null);this.recalculate();this.scene.overview();
  this.hud.hidden=false;this.status=this.words('기록 전 항해를 마치고 항로를 다시 설계합니다.','The unfinished voyage has ended. Shape the next route.');this.persist();this.renderHUD();
 }
 private receiveVoyage(result:{operations:OperationsState;images:Record<string,string>;receivedJd:number}){
  const samples=result.operations.records.filter(record=>record.valid&&record.transmittedBits+1e-6>=record.dataBits).sort((a,b)=>b.quality-a.quality);
  const science=boundedReceivedScience({instrument:result.operations.sensor,model:'local-hyperbola-synthetic-response-v1',samples:samples.map(record=>({...record,image:result.images[record.id]}))});
  if(!science)return;
  this.photo=science.samples.find(sample=>sample.image)?.image;
  this.campaign=recordDiscovery(this.campaign,this.campaign.target,result.receivedJd,this.photo,science);
  this.voyage?.dispose();this.voyage=null;
  try{localStorage.removeItem(JOURNEY_KEY);}catch{/* Session completion remains visible. */}
  this.phase='report';this.hud.hidden=false;this.persist();this.renderHUD();
 }
 private tick=(now:number)=>{
  if(!this.running)return;const dt=Math.min(.05,(now-(this.last||now))/1000);this.last=now;
  if(!this.graphicsLost)this.voyage?.tick(dt);
  this.scene.render(dt);if(!this.voyage)this.project();this.frame=requestAnimationFrame(this.tick);
 };
 private button(action:string,text:string,cls=''){return `<button type="button" class="${cls}" data-solar-action="${action}">${escape(text)}</button>`;}
 private renderHUD(){
  const title=names(this.campaign.target,this.en),objective=OBJECTIVES[this.campaign.target];
  this.hud.innerHTML=`<header class="solar-header"><button class="solar-wordmark" data-solar-action="close" aria-label="${this.words('발사 기지로','Return to launch base')}"><span class="solar-mark">◌</span> ORBITAL <small>THE EXPEDITION</small></button><span class="solar-chapter">${this.words('태양계 탐사 계획','SOLAR EXPLORATION PROGRAMME')} <i> / </i>${num(this.campaign.discoveries.length)} / 8</span><div>${this.button('photos',this.words('사진 보관함','Photos'))}${this.button('journal',this.words('탐사 기록','Journal'))}${this.button('model','ⓘ', 'solar-icon')}</div></header>
   ${this.phase==='intro'?this.introHTML():`<nav class="solar-destinations" aria-label="${this.words('탐사 목적지','Destinations')}">${SOLAR_BODIES.map(b=>`<button data-solar-body="${b.id}" class="${b.id===this.campaign.target?'selected':''}" aria-pressed="${b.id===this.campaign.target}" ${this.phase!=='map'?'disabled':''}><i style="--body-color:${b.color}"></i><span>${escape(this.en?b.nameEn:b.nameKo)}</span>${this.campaign.discoveries.some(d=>d.body===b.id)?'<em>✓</em>':''}</button>`).join('')}</nav>
   <div class="solar-world-labels">${SOLAR_BODIES.map(b=>`<button class="solar-body-label ${b.id===this.campaign.target?'target':''}" data-label-body="${b.id}" data-solar-body="${b.id}" ${this.phase!=='map'?'disabled':''}>${escape(this.en?b.nameEn:b.nameKo)}${b.id===this.campaign.target?'<span>◎</span>':''}</button>`).join('')}</div>
   ${this.phase==='map'?`<aside class="solar-objective"><span class="solar-eyebrow">${this.campaign.discoveries.length?'NEXT DISCOVERY':'FIRST CONTACT'}</span><h1>${escape(title)}</h1><h2>${escape(this.en?objective.enTitle:objective.title)}</h2><p>${escape(this.en?objective.enQuestion:objective.question)}</p><small class="solar-required-sensor">${this.words(observationProfile(this.campaign.target).reasonKo,observationProfile(this.campaign.target).reasonEn)}</small><div class="solar-craft-card"><span>◇ ${escape(this.campaign.design.name)}</span>${this.button('build',this.words('탐사선 조립','Build probe'))}${recommendedAssistBodies(this.campaign.target).length?this.button('assist',this.words('중력으로 돌아가는 길','A route with gravity'),'solar-assist-open'):''}</div></aside><div class="solar-route-handles"><button class="solar-route-handle departure" data-route-drag="departure" aria-label="${this.words('출발 시점 조절','Adjust departure time')}"><i>↔</i><span>${this.words('출발','Departure')}</span><small data-departure-date></small></button><button class="solar-route-handle arrival" data-route-drag="arrival" aria-label="${this.words('만남 시점 조절','Adjust encounter time')}"><i>↔</i><span>${this.words('만날 지점','Encounter')}</span><small data-arrival-date></small></button></div>${this.assist?`<div class="solar-assist-waypoint" data-assist-waypoint><b>↱ ${escape(names(this.assist.request.assist,this.en))}</b><small>${date(this.assist.request.encounterJdTdb)}</small></div>`:''}<div class="solar-drag-hint">${this.words('↔ 만날 지점을 끌어 항로를 바꿔 보세요','↔ Drag the encounter marker to shape your route')}</div><section class="solar-route-deck"><div class="solar-route-summary" aria-live="polite"></div><div class="solar-route-actions">${this.previous?this.button('undo',this.words('되돌리기','Undo')):''}${this.assist?this.button('direct',this.words('직항으로','Direct route')):''}${this.button('launch',this.words('이 항로로 출발','Launch this route'),'solar-primary')}</div></section>`:this.phaseHTML()}
   <div class="solar-map-tools">${this.phase==='map'?this.button('overview',this.words('전체 보기','Overview')):''}<small>${this.phase==='map'?this.words('우클릭 회전 · 휠 확대','Right-drag orbit · Scroll zoom'):this.words('태양계 탐사 · 시간 가속','Solar expedition · Time compressed')}</small></div>`}
   ${this.journal?this.journalHTML():''}${this.model?this.modelHTML():''}${this.assistPanel?this.assistHTML():''}<div class="solar-storage-note">${this.saved?'':this.words('저장 공간을 사용할 수 없습니다. 이 창에서만 진행됩니다.','Storage unavailable. Progress lasts for this session only.')}</div>`;
  this.updateMetrics();this.project();
 }
 private introHTML(){
  const beats=this.en?[
   ['23:41 / OBSERVATION STATION','One light moved.','“That point wasn’t in yesterday’s frame.”','Confirm the signal'],
   ['FLIGHT DIRECTOR · HAN','We need another point of view.','“We lost ASTER-7 in the glare. Before we decide anything, we need to see it up close.”','See the expedition plan'],
   ['PROJECT AURORA','An answer is out there.','“Build our probe. Meet the asteroid. Bring its first portrait home. Then we’ll choose the next question together.”','Begin the expedition'],
  ]:[
   ['23:41 / 관측소','별 하나가 움직였다.','“어제의 사진에는 저 점이 없었어요.”','신호 확인'],
   ['비행 책임자 · 한서윤','다른 곳에서 봐야 해요.','“태양빛에 가려 아스터-7을 놓쳤어요. 결정을 내리기 전에, 가까이에서 확인해야 합니다.”','탐사 계획 보기'],
   ['PROJECT AURORA','답은 저곳에 있다.','“우리 탐사선을 만들어 주세요. 소행성을 만나 첫 모습을 보내줘요. 다음 질문은 그 사진에서 시작될 거예요.”','탐사 시작'],
  ];const b=beats[this.beat];
  return `<div class="solar-cinematic-vignette"></div><div class="solar-incident"><span class="solar-alert-dot"></span>${this.beat===0?'ASTER-7 / SIGNAL DETECTED':this.beat===1?'EARTH / MISSION CONTROL':'SOLAR SYSTEM / NEW FRONTIER'}</div><section class="solar-dialogue"><div class="solar-speaker-avatar">${this.beat===0?'◉':'H'}</div><div><span class="solar-eyebrow">${b[0]}</span><h1>${b[1]}</h1><p>${b[2]}</p><div class="solar-dialogue-footer"><span>${this.beat+1} / 3</span>${this.button('story',b[3]+' →','solar-primary')}</div></div></section><small class="solar-fiction">${this.words('가상의 탐사 이야기 · 실제 충돌 경보가 아닙니다','A fictional expedition story · not a real impact alert')}</small>${this.button('skip',this.words('지도부터 시작','Start on the map'),'solar-skip')}`;
 }
 private updateMetrics(){
  if(this.phase!=='map')return;
  const c=this.campaign,r=this.route,readiness=campaignReadiness(c.design,r);
  const summary=this.hud.querySelector<HTMLElement>('.solar-route-summary');if(!summary)return;
  if(this.previous&&!this.hud.querySelector('[data-solar-action="undo"]'))this.hud.querySelector('.solar-route-actions')?.insertAdjacentHTML('afterbegin',this.button('undo',this.words('되돌리기','Undo')));
  const issues:Record<string,string>={camera:this.words('광학 카메라로 형태를 기록해야 해요','This mission needs an optical camera'),spectrometer:this.words('분광 관측기로 성분 단서를 찾아야 해요','This mission needs a spectrometer'),'sensor-blocked':this.words('관측기 앞을 다른 부품이 가리고 있어요','Another part blocks the sensor'),'antenna-blocked':this.words('안테나 앞을 비워 주세요','Clear the antenna view'),sensor:this.words('관측 장비를 붙여 주세요','Mount a science sensor'),antenna:this.words('안테나가 필요해요','Mount an antenna'),battery:this.words('배터리가 필요해요','Mount a battery'),storage:this.words('기록 장치가 필요해요','Mount a recorder'),fuel:this.words('연료를 넘는 항로예요','This route exceeds the fuel supply'),power:this.words('소비 전력이 너무 커요','Power demand is too high'),mass:this.words('탐사선이 너무 무거워요','The probe is too heavy'),cost:this.words('장비 예산을 넘었어요','Payload exceeds budget')};
  if(!this.assist)this.hud.querySelector('[data-solar-action="direct"]')?.remove();
  const bad=readiness.issues.length>0;
  summary.innerHTML=`<div class="solar-route-fact"><small>${this.words('지구 →','Earth →')} ${this.assist?escape(names(this.assist.request.assist,this.en))+' → ':''}${escape(names(c.target,this.en))}</small><strong>${num(c.flightDays)} <em>${this.words('일','days')}</em></strong><span>${date(c.departureJd)} → ${date(c.departureJd+c.flightDays)}</span></div><div class="solar-route-fuel ${readiness.fuelFraction>1?'over':''}"><small>${this.words('운반선 추진제','Carrier propellant')}</small><strong>${num(readiness.fuelKg)} <em>/ ${num(CARRIER.propellantKg)} kg</em></strong><div class="solar-meter"><i style="width:${Math.min(100,Math.max(0,readiness.fuelFraction*100))}%"></i></div></div><div class="solar-route-state ${bad?'warning':''}"><b>${r?.status!=='solved'?this.words('이 시점에는 만날 수 없어요','No encounter at this time'):bad?issues[readiness.issues[0]]:this.words('항로가 이어졌어요','Your route connects')}</b><span>${escape(this.status||this.words('행성은 도착할 때의 위치에서 만납니다','Meet the planet where it will be at arrival'))}</span>${(r?.status!=='solved'||readiness.issues.includes('fuel'))&&!this.windowSearched?this.button('window',this.words('다른 출발 기회 찾기','Find another departure')):bad?this.button('build',this.words('탐사선 고치기','Edit the probe')):''}</div>`;
  const launch=this.hud.querySelector<HTMLButtonElement>('[data-solar-action="launch"]');if(launch)launch.disabled=!readiness.ready||r?.status!=='solved';
  const dep=this.hud.querySelector('[data-departure-date]'),arr=this.hud.querySelector('[data-arrival-date]');if(dep)dep.textContent=date(c.departureJd);if(arr)arr.textContent=date(c.departureJd+c.flightDays);
  const arrow=this.hud.querySelector('[data-route-drag="arrival"] i'),bounds=solarFlightDayBounds('earth',c.target,c.departureJd);if(arrow)arrow.textContent=c.flightDays>=bounds.max?'←':c.flightDays<=bounds.min?'→':'↔';
 }
 private assistHTML(){
  const result=this.assistSearch,assist=result?.route,body=this.assistBody??recommendedAssistBodies(this.campaign.target)[0];
  const choices=recommendedAssistBodies(this.campaign.target),direct=result?.sampledDirectWindowRoute;
  const comparison=(label:string,r:SolarRoute|null,dv:number|null=null)=>{
   if(r?.status!=='solved')return `<div class="solar-assist-option"><h3>${escape(label)}</h3><p>${this.words('이 범위의 항로가 없습니다','No supported route in this window')}</p></div>`;
   const fuel=campaignReadiness(this.campaign.design,r).fuelKg;
   return `<div class="solar-assist-option"><h3>${escape(label)}</h3><strong>${num(fuel)} <small>kg</small></strong><span>${num(r.flightDays)} ${this.words('일','days')}</span><small>${date(r.departureJdTdb)} → ${date(r.arrivalJdTdb)}</small>${dv!==null?`<small>Δv ${num(dv)} m/s</small>`:''}</div>`;
  };
  return `<aside class="solar-drawer solar-assist-drawer" role="dialog" aria-label="${this.words('중력 도움 항로','Gravity assist routes')}"><header><div><span class="solar-eyebrow">A DIFFERENT WAY OUT</span><h2>${this.words('중력을 빌려 더 멀리','Let gravity take us farther')}</h2></div>${this.button('panel-close','×')}</header><p>${this.words('행성 옆을 지나 방향을 바꿉니다. 연료와 기다리는 시간, 어느 쪽을 아낄까요?','Pass a moving planet to bend our path. Save propellant, or save time?')}</p>${choices.length>1?`<div class="solar-assist-choices">${choices.map(id=>`<button data-assist-body="${id}" aria-pressed="${body===id}">${escape(names(id,this.en))}</button>`).join('')}</div>`:''}
   ${this.assistSearching?`<div class="solar-assist-search" role="status"><b>${this.words(names(body,this.en)+'에서 길이 이어지는 시점을 찾는 중',`Finding a connecting encounter at ${names(body,this.en)}`)}</b><div class="solar-flight-track"><i data-assist-progress style="width:${this.assistSearchProgress*100}%"></i></div><small>${this.words('현재 지도와 항로는 계속 움직일 수 있습니다','Your map and current route remain available')}</small></div>`:assist?`
   <div class="solar-assist-comparison">${comparison(this.words('직항 · 탐색한 출발 기회','Direct · searched window'),direct??null,direct?.departureDeltaVMps??null)}${comparison(this.words(names(assist.request.assist,this.en)+' 경유',`Via ${names(assist.request.assist,this.en)}`),asSolarRoute(assist),assist.totalPropulsiveDeltaVMps)}</div>
   <div class="solar-assist-tradeoff">${result!.deltaVSavedVsDirectWindowMps!==null&&result!.deltaVSavedVsDirectWindowMps>0?`<strong>${num(campaignReadiness(this.campaign.design,direct??null).fuelKg-campaignReadiness(this.campaign.design,asSolarRoute(assist)).fuelKg)} kg ${this.words('절약','saved')}</strong><span>${this.words('찾아본 직항 기회와 비교한 추진제','Propellant compared with the sampled direct opportunities')}</span>`:`<strong>${this.words('이 탐색에서는 직항이 경제적입니다','Direct uses less propellant in this scan')}</strong><span>${this.words('중력 도움도 행성의 위치와 시기가 맞아야 유리합니다','Gravity assists depend on planetary timing and geometry')}</span>`}</div>
   <ol class="solar-assist-itinerary"><li><span>${this.words('지구 출발','Earth departure')}</span><time>${date(assist.request.departureJdTdb)}</time></li><li><span>${escape(names(assist.request.assist,this.en))} ↱ ${num(assist.turnAngleRad*180/Math.PI,1)}°</span><time>${date(assist.request.encounterJdTdb)}</time></li><li><span>${escape(names(assist.request.target,this.en))}</span><time>${date(assist.request.arrivalJdTdb)}</time></li></ol>
   <small class="solar-assist-limits">${this.words('정해진 날짜들을 탐색한 비교입니다. 최적 경로를 보장하지 않습니다.','A bounded date search, not a globally optimal route.')}</small>
   ${this.button('assist-apply',this.words('이 스윙바이 항로 선택 →','Choose this assist route →'),'solar-primary')}
   <details class="solar-assist-science"><summary>${this.words('가까이 지나갈 조건','Encounter geometry')}</summary><p>${this.words('최접근 고도','Closest altitude')} ${num(assist.periapsisAltitudeKm)} km · ${this.words('행성 상대 속도','Planet-relative speed')} ${num(Math.hypot(...assist.incomingVInfinityKmS),2)} km/s</p><p>${this.words('무추력 속도 일치 · 중력에 의한 방향 전환','Matched asymptotic speed · direction changed by gravity')}</p><p>${this.words('동일한 출발일과 도착일의 직항 대비','Against a direct route with identical departure and arrival dates')}: ${num(assist.deltaVSavedMps??0)} m/s. ${this.words('긴 직항은 비효율적이므로 위의 출발 기회 비교도 함께 보세요.','That long direct coast is inefficient; the launch-window comparison above is the useful tradeoff.')}</p></details>`:`<div class="solar-assist-empty"><b>${this.words('이어지는 경유 항로를 찾지 못했어요','No connecting assist in this search')}</b><p>${escape(this.en?'The turn or encounter speed does not match within the searched dates. Your current route is still available.':result?.error??'날짜와 행성의 위치가 맞아야 길이 이어집니다. 현재 항로는 그대로입니다.')}</p>${this.button('panel-close',this.words('현재 항로로 돌아가기','Return to current route'))}</div>`}
  </aside>`;
 }
 private receivedPhoto(discovery:Discovery,sampleIndex=-1):ExpeditionPhoto|null{
  const sample=sampleIndex>=0?discovery.science?.samples[sampleIndex]:undefined;
  const image=sampleIndex>=0?sample?.image:discovery.image??discovery.science?.samples.find(item=>item.image)?.image;
  if(!image)return null;
  return {id:`received-${discovery.body}-${discovery.receivedJd}-${sampleIndex}`,imageDataUrl:image,target:discovery.body,label:`${names(discovery.body,this.en)} · ${sample?sample.kind==='context'?this.words('전체 윤곽','Global context'):sample.kind==='detail'?this.words('근접 지형','Surface detail'):this.words('분광 관측 화면','Spectrometer view'):this.words('수신 사진','Received photo')}`,scientific:true,capturedAt:new Date((discovery.receivedJd-2440587.5)*86400000).toISOString()};
 }
 private allPhotos():ExpeditionPhoto[]{
  const photos=loadPhotos();
  for(const discovery of this.campaign.discoveries){for(const sampleIndex of [-1,...(discovery.science?.samples.map((_,index)=>index)??[])]){const photo=this.receivedPhoto(discovery,sampleIndex);if(photo&&!photos.some(item=>item.imageDataUrl===photo.imageDataUrl))photos.push(photo);}}
  return photos;
 }
 private photoActions(discovery:Discovery|undefined,sampleIndex=-1){
  if(!discovery||!this.receivedPhoto(discovery,sampleIndex))return '';
  const index=this.campaign.discoveries.indexOf(discovery);
  return `<div class="solar-photo-actions">${this.button(`photo-view:${index}:${sampleIndex}`,this.words('사진 크게 보기','View photo'))}${this.button(`photo-download:${index}:${sampleIndex}`,this.words('↓ 사진 저장','↓ Save photo'))}</div>`;
 }
 private measurementsHTML(discovery:Discovery|undefined){
  const science=discovery?.science;if(!science)return '';
  let spectral='';
  if(science.instrument==='spectrometer'){
   const visible=science.samples.find(s=>s.band==='visible'&&s.featureId&&typeof s.reflectanceEstimate==='number'&&s.reflectanceEstimate>0&&typeof s.reflectanceUncertainty==='number'&&science.samples.some(n=>n.band==='nir'&&n.featureId===s.featureId&&typeof n.reflectanceEstimate==='number'&&typeof n.reflectanceUncertainty==='number'));
   const infrared=visible?science.samples.find(s=>s.band==='nir'&&s.featureId===visible.featureId&&typeof s.reflectanceEstimate==='number'&&typeof s.reflectanceUncertainty==='number'):undefined;
   if(visible&&infrared){
    const v=visible.reflectanceEstimate!,n=infrared.reflectanceEstimate!,sv=visible.reflectanceUncertainty!,sn=infrared.reflectanceUncertainty!,ratio=n/v,uncertainty=Math.hypot(sn/v,n*sv/(v*v));
    spectral=`<div class="solar-spectral-receipt"><span>${this.words('같은 영역, 두 파장의 기록','Two bands, the same region')}</span><div class="solar-spectral-bars">${[visible,infrared].map(s=>`<div><i style="--reflectance:${Math.max(2,s.reflectanceEstimate!*100)}%"></i><small>${s.band==='visible'?'VIS':'NIR'}</small><b>${num(s.reflectanceEstimate!,3)} ± ${num(s.reflectanceUncertainty!,3)}</b></div>`).join('')}</div><strong>NIR / VIS ${num(ratio,3)} ± ${num(uncertainty,3)}</strong><small>${this.words('가상 반사율 비교 · 화학 물질 판정이 아닙니다','Synthetic reflectance comparison · not chemical identification')}</small></div>`;
   }
  }
  const label=(kind:string)=>kind==='context'?this.words('전체 윤곽','Global context'):kind==='detail'?this.words('근접 지형','Surface detail'):this.words('분광 측정','Spectral measurement');
  return `${spectral}<details class="solar-measurements"><summary>${this.words('도착한 측정 자료','Received measurements')} · ${science.samples.length}</summary><div>${science.samples.map((s,index)=>`<article><header><b>${label(s.kind)}</b><span>${s.band==='nir'?'NIR':this.words('가시광','Visible')}</span></header><p>SNR ${num(s.snr,1)} · ${this.words('흔들림','Smear')} ${num(s.smearPixels,2)} px</p><p>${this.words('지상 표본 간격','Ground sample distance')} ${num(s.gsdM,1)} m · ${this.words('노출','Exposure')} ${num(s.exposureSeconds,2)} s</p>${s.image?`<img class="solar-sample-photo" src="${s.image}" alt="${escape(label(s.kind))}">${this.photoActions(discovery,index)}`:''}</article>`).join('')}</div><small>${this.words('가상 표면과 검출기 반응으로 계산한 게임 내 측정값','In-game measurements from a synthetic surface and detector response')}</small></details>`;
 }
 private phaseHTML(){
  const body=names(this.campaign.target,this.en),obj=OBJECTIVES[this.campaign.target],discovery=this.campaign.discoveries.find(d=>d.body===this.campaign.target);
  const count=discovery?.science?.samples.length??discovery?.observations??0;
  return `<section class="solar-discovery-card"><span class="solar-eyebrow">DISCOVERY RECEIVED · ${escape(body)}</span><h1>${this.words('우리가 보낸 눈으로 본 세계','A world seen through our own instrument')}</h1><p>${escape(this.en?obj.enDiscovery:obj.discovery)}</p>${this.photo?`<img class="solar-discovery-image" alt="${this.words('탐사 현장에서 기록한 게임 화면','View recorded during this encounter')}" src="${this.photo}">`:''}${this.photoActions(discovery)}<div class="solar-discovery-stamp">✓ ${count} ${this.words('개의 유효한 측정 자료가 지구에 도착했습니다','valid measurements received on Earth')}</div>${this.measurementsHTML(discovery)}<blockquote>${this.words('한서윤: “잘 받았어요. 우리가 고른 시선과 기다린 시간이 이 기록에 남아 있어요.”','Han: “Received. The view we chose, and the time we spent, are in this record.”')}</blockquote><div>${this.button('map',this.words('태양계 지도','Solar System map'))}${this.button('next',this.words('다음 발견으로 →','The next discovery →'),'solar-primary')}</div></section>`;
 }
 private journalHTML(){return `<aside class="solar-drawer" role="dialog" aria-label="${this.words('탐사 기록','Journal')}"><header><h2>${this.words('우리가 발견한 세계','Worlds we discovered')}</h2>${this.button('panel-close','×')}</header>${this.button('photos',this.words('사진 보관함 열기','Open photo album'))}${this.campaign.discoveries.length?this.campaign.discoveries.map(d=>`<article><small>${date(d.receivedJd)} · ${escape(d.craftName)}</small><h3>${escape(names(d.body,this.en))}</h3>${d.image?`<img class="solar-discovery-image" src="${d.image}" alt="${this.words('탐사 현장 기록','Recorded encounter view')}">`:''}${this.photoActions(d)}<p>${escape(this.en?OBJECTIVES[d.body].enDiscovery:OBJECTIVES[d.body].discovery)}</p><small>${d.science?.samples.length??d.observations} ${this.words('개 수신 기록','received records')}</small>${this.measurementsHTML(d)}</article>`).join(''):`<p>${this.words('아직 빈 노트예요. 첫 관측이 돌아오면 여기에 기록됩니다.','An empty notebook. Your first returned observation will begin it.')}</p>`}</aside>`;}
 private modelHTML(){return `<aside class="solar-drawer" role="dialog" aria-label="${this.words('탐사 모델','Exploration model')}"><header><h2>${this.words('이 탐사의 바탕','About this expedition')}</h2>${this.button('panel-close','×')}</header><p>${this.words('8개 행성은 JPL의 1800–2050 근사 궤도 요소를 사용합니다. 항로는 태양 중력의 Lambert 해입니다. 스윙바이는 두 항로의 행성 상대 속도와 굴절각을 맞춘 단일 경유 근사이며, 정밀 다체 해석이나 GMAT 검증을 받은 항로가 아닙니다.','The eight planets use JPL approximate elements for 1800–2050. Coasts are Sun-only Lambert solutions. A single gravity assist matches the planet-relative velocities and turning angle; it is not a high-fidelity multi-body or GMAT-validated solution.')}</p><p>${this.words('지도는 거리를 압축하고 행성을 확대합니다. 근접 관측은 도착 속도로 만든 별도의 국소 쌍곡선이며 순항 항로와 유한 경계에서 이어지는 정밀 해는 아닙니다. 카메라 조준, 시야, 노출, 흔들림과 표면의 빛 조건이 관측 품질에 영향을 줍니다. 표면 영역과 검출기 반응은 게임을 위해 만든 모형입니다. 근접 관측 시간은 플레이를 위해 늘리거나 압축합니다.','The map compresses distances and enlarges planets. Observation uses a separate local hyperbola at the cruise arrival speed, not a finite-boundary continuous join. Aim, field of view, exposure, smear and illumination affect quality. Surface regions and detector responses are authored models. Local encounter time can be stretched or compressed for play.')}</p><p>${this.words('명령과 이상 상황은 교육용 운용 시나리오입니다. 전력·열·저장량과 전송량을 계산하지만 실제 탐사선의 인증 해석은 아닙니다. 수신 완료에는 전송과 편도 빛 이동 시간이 반영되며 화면에서는 시간을 가속합니다.','Commands and contingencies are authored operations scenarios. Power, heat, storage and transmitted data are computed without spacecraft certification claims. Reception includes transmission and one-way light time, with compressed playback.')}</p><p>${this.words('게임 운반선: 건조 질량 400 kg, 추진제 6,500 kg, 비추력 450초, 상시 전력 300 W. 조립한 탐사선의 질량과 장비가 탑재 조건과 추진제에 반영됩니다. 스윙바이도 필요한 보정 추진제는 지불합니다.','Authored carrier: 400 kg dry mass, 6,500 kg propellant, 450 s Isp, 300 W continuous power. Your probe mass and equipment affect readiness and fuel. Any assist correction impulse is charged.')}</p><p>${this.words('아스터-7과 등장인물은 창작입니다. 실제 NASA 충돌 경보가 아닙니다.','ASTER-7 and the crew are fictional, not a real NASA impact alert.')}</p><p>${this.words('별 배경: NASA/Goddard SVS · Ernie Wright. Gaia DR2: ESA/Gaia/DPAC. 표시 노출과 방향은 예술적으로 조정했으며 측성·측광 장비가 아닙니다.','Star background: NASA/Goddard SVS · Ernie Wright. Gaia DR2: ESA/Gaia/DPAC. Display exposure and orientation are artistic, not a calibrated astrometric or photometric instrument.')}</p><a href="https://svs.gsfc.nasa.gov/4851/" target="_blank" rel="noopener">NASA · Deep Star Maps 2020 ↗</a><a href="assets/solar-sky-provenance.json" target="_blank" rel="noopener">${this.words('배경 자료의 출처·변환 기록','Sky source and processing record')} ↗</a><a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">JPL · Approximate planetary positions ↗</a><a href="https://ntrs.nasa.gov/api/citations/20120001856/downloads/20120001856.pdf" target="_blank" rel="noopener">NASA/JSC · Gravity-assist parameterization ↗</a></aside>`;}
 private project(){
  if(!this.scene||!this.root.isConnected)return;
  const rect=this.root.getBoundingClientRect(),w=rect.width,h=rect.height;
  this.hud.querySelectorAll<HTMLElement>('[data-label-body]').forEach(el=>{const p=this.scene.projectBody(el.dataset.labelBody as SolarBodyId);el.style.left=`${p.x}px`;el.style.top=`${p.y+25}px`;el.hidden=!p.visible||p.x<240||p.x>w-50||p.y<130||p.y>h-160||this.phase!=='map';});
  this.hud.querySelectorAll<HTMLElement>('[data-route-drag]').forEach(el=>{const p=this.scene.projectRouteHandle(el.dataset.routeDrag as 'arrival'|'departure');el.style.left=`${clamp(p.x,260,w-90)}px`;el.style.top=`${clamp(p.y,160,h-190)}px`;el.hidden=!p.visible;});
  const waypoint=this.hud.querySelector<HTMLElement>('[data-assist-waypoint]');if(waypoint){const p=this.scene.projectJourneyWaypoint();waypoint.hidden=!p?.visible||!this.assist;if(p){waypoint.style.left=`${clamp(p.x,270,w-100)}px`;waypoint.style.top=`${clamp(p.y-25,175,h-210)}px`;}}

 }
 dispose(){this.running=false;this.photoAlbum?.close();this.photoAlbum=null;this.stopAssistSearch();this.voyage?.dispose();this.voyage=null;cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.resize);window.removeEventListener('keydown',this.key);this.persist();this.scene?.canvas.removeEventListener('webglcontextlost',this.contextLost);this.scene?.canvas.removeEventListener('webglcontextrestored',this.contextRestored);this.scene?.dispose();this.root.remove();}
}
