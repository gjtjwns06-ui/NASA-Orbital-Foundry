import {SwingbyScene,validateSwingbySceneSnapshot,type SwingbySceneCallbacks} from './swingby-scene';
import type {InspectionViewport} from './craft-camera';
import {prepareReviewFrame,ReviewFrameSelection,type ReviewSide,type ReviewSceneSample,type ReviewSceneContext} from './review-frame';
export type {ReviewSide,ReviewSceneSample,ReviewSceneContext} from './review-frame';

/** One detached, read-only renderer. The review Worker and product UI own
 * verification, seeking, cancellation and all request/session barriers. */
export class SwingbyReviewScene {
 private readonly scene:SwingbyScene;private readonly frames=new ReviewFrameSelection();private disposed=false;
 private craftSignature='';private enginePartId:string|null=null;private error:string|null=null;private preferredView:'craft'|'encounter'|'whole'='craft';private lastOverview:'encounter'|'whole'='encounter';
 readonly qa:Readonly<{canvas:HTMLCanvasElement;getPartScreen:SwingbyScene['getPartScreen'];getInspectionState:SwingbyScene['getInspectionState'];getRenderSettings:SwingbyScene['getRenderSettings'];getEncounterViewState:SwingbyScene['getEncounterViewState']}>;
 constructor(container:HTMLElement,private context:ReviewSceneContext&{quality?:'high'|'medium'|'low';reducedMotion?:boolean},callbacks:Pick<SwingbySceneCallbacks,'partSelected'|'contextLost'|'contextRestored'>={}){
  this.context=structuredClone(context);this.scene=new SwingbyScene(container,callbacks,context);this.scene.setReviewPresentation(true);
  this.qa=Object.freeze({canvas:this.scene.canvas,getPartScreen:this.scene.getPartScreen.bind(this.scene),getInspectionState:this.scene.getInspectionState.bind(this.scene),getRenderSettings:this.scene.getRenderSettings.bind(this.scene),getEncounterViewState:this.scene.getEncounterViewState.bind(this.scene)});
 }
 setCommonCursor(seconds:number){if(this.disposed)return;this.frames.setCommonCursor(seconds);this.applyCandidate();}
 setSide(side:ReviewSide){if(this.disposed)return false;this.frames.setSide(side);return this.applyCandidate();}
 setSample(side:ReviewSide,sample:ReviewSceneSample){
  if(this.disposed)return false;
  if(Math.abs(sample.cursor.requestedTimeSeconds-this.frames.commonRequestedTimeSeconds)>1e-7)return false;
  try{const frame=prepareReviewFrame(sample,this.context);validateSwingbySceneSnapshot(frame.snapshot);if(!this.frames.put(side,frame))return false;this.error=null;this.applyCandidate();return true;}catch(error){this.error=error instanceof Error?error.message:String(error);return false;}
 }
 private applyCandidate(){
  const next=this.frames.candidate();if(!next)return false;if(this.frames.displayedFrame===next||this.frames.displayedFrame?.frame===next.frame)return true;
  const frame=next.frame,first=!this.frames.displayedFrame;
  if(frame.enginePartId!==this.enginePartId||first){this.scene.setCarrierProfile(frame.enginePartId?this.context.carrierProfile:null,frame.enginePartId);this.enginePartId=frame.enginePartId;}
  if(frame.sourceSignature!==this.craftSignature){this.scene.setCraft(frame.craft);this.craftSignature=frame.sourceSignature;}
  this.scene.setSnapshot(frame.snapshot);this.frames.commit(next);
  if(first){if(this.preferredView==='craft')this.scene.setInspection(true);else this.scene.focusOverview(this.preferredView);}
  this.error=null;return true;
 }
 setViewport(insets:InspectionViewport){if(!this.disposed)this.scene.setInspectionViewport(insets);}
 setInspection(enabled:boolean){if(this.disposed)return false;const active=this.scene.setInspection(enabled);this.preferredView=active?'craft':this.lastOverview;return active;}
 focusPart(id:string|null){if(this.disposed||!this.frames.displayedFrame)return false;if(id!==null&&!this.frames.displayedFrame.frame.craft.parts.some(p=>p.id===id))return false;this.preferredView='craft';if(!this.scene.setInspection(true))return false;return this.scene.focusReviewPart(id);}
 focusOverview(view:'whole'|'encounter'='encounter'){if(this.disposed)return;this.preferredView=this.lastOverview=view;this.scene.focusOverview(view);}
 getState(){return {...this.frames.getState(),readOnly:true,error:this.error,disposed:this.disposed,view:this.preferredView,inspection:this.scene.getInspectionState(),encounter:this.scene.getEncounterViewState(),surfaceRotation:'visual elapsed-time convention, not a body-fixed science model'};}
 resize(){if(!this.disposed)this.scene.resize();}
 render(dt:number){if(!this.disposed)this.scene.render(dt);}
 dispose(){if(this.disposed)return;this.disposed=true;this.scene.dispose();}
}
