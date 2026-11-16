import {expect} from '@playwright/test';
import {test,fixtureCode,boot,mainAction,reviewAction,reviewReady,reviewState,importReview,downloadReview,screenshot,controlInside,record} from './helpers';

let pairText='',mismatchedText='';
test.beforeAll(async({browser})=>{
 test.setTimeout(60000);
 // Genuine short engine executions are imported ONLY for interface checks.
 // They do not stand in for the two complete browser flights in journey.spec.
 // Engine uses exact checkpoint replay. Node and Chrome math implementations
 // differed at 14 tiny numeric leaves in the preserved first attempt; no
 // tolerance is weakened. Generate genuine browser sources in an EMPTY page.
 const fixturePage=await browser.newPage();try{
  await fixturePage.route('**/independent-review-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Pure browser engine fixture; no game scene</title>'}));await fixturePage.goto((process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:5177')+'/independent-review-fixture');
  const fixture=await fixturePage.evaluate(async code=>{const module={exports:{} as any};new Function('module','exports','require',code)(module,module.exports,(name:string)=>{throw Error('Unexpected external fixture dependency '+name);});const d=module.exports;
   const make=async(model:string,id:string,time:number)=>{const craft=d.createSwingbyDesign();craft.parts.find((p:any)=>p.kind==='adcs').modelId=model;const plan=d.createSwingbyPlan('baseline'),solved=d.solveSwingbyPlan(plan,craft);if(solved.status!=='solved')throw Error('Fixture solve');const runtime=d.createSwingbyRuntime(solved.solution,craft);d.advanceSwingby(runtime,time,Infinity);const text=d.serializeSwingbySave(d.makeSwingbySave(plan,craft,runtime));return d.pinSwingbyRun(text,{runId:id,displayName:id,origin:'strict-engine-import'});};
   const a=await make('xact15-carrier-v1','fixture-A-5000',5000),b=await make('xact50-carrier-v1','fixture-B-5000',5000),short=await make('xact50-carrier-v1','fixture-B-4500',4500);return {pairText:d.makeReviewPair(a,b).text,mismatchedText:d.makeReviewPair(a,short).text,a:a.source,b:b.source,short:short.source};
  },fixtureCode);pairText=fixture.pairText;mismatchedText=fixture.mismatchedText;record('short-fixture-provenance',{scope:'Actual browser engine executions and strict replay in an isolated empty page, imported for UI only; no product state injection or full mission claim.',...fixture});
 }finally{await fixturePage.close();}
});

for(const language of ['ko','en'] as const)for(const scale of ['normal','large'] as const){
 test(`${language}-${scale} imported genuine short review keeps controls reachable and replays actual history`,async({page})=>{
  test.setTimeout(180000);await boot(page,language,scale);await mainAction(page,'review-archive');await reviewReady(page);await importReview(page,pairText);const initial=await reviewState(page);
  expect(initial.error).toBe('');expect(initial.persisted).toBe(true);expect(initial.comparison.compatibility.mode).toBe('controlled');expect(initial.baseline.evaluation.final).toBe(false);expect(initial.attempt.evaluation.final).toBe(false);expect(initial.requestedTime).toBe(5000);expect(initial.displayed.committedTimeSeconds).toBe(5000);
  await expect(page.locator('.review-notice')).toContainText(language==='en'?'Original flight saves verified and loaded':'비행 원본을 검증해 불러왔습니다');
  const controls:Record<string,unknown>={};for(const name of ['close','save','export','import','A','B','fork','play','speed','inspect','whole'])controls[name]=await controlInside(page,`[data-review-action="${name}"]`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const text=await page.locator('.review-experience').innerText();expect(text).not.toMatch(/NaN|Infinity|undefined|\uFFFD/);if(language==='en')expect(text).not.toMatch(/[가-힣]/);
  await expect(page.locator('[data-review-action="A"]')).toContainText(language==='en'?'interim':'중간');await expect(page.locator('[data-review-action="B"]')).toContainText(language==='en'?'interim':'중간');await expect(page.locator('.review-score-delta')).toHaveClass(/negative/);
  await screenshot(page,`${language}-${scale}-short-review-entry`);
  // Regression: Play at the initialized final cursor must actually seek zero.
  await reviewAction(page,'play');await page.waitForFunction(()=>{const s=(window as any).__game.review()?.getState();return s&&s.displayed.committedTimeSeconds<5000;},null,{timeout:15000});
  await reviewAction(page,'play');await reviewReady(page);const stopped=await reviewState(page);expect(stopped.playing).toBe(false);expect(stopped.displayed.stateOrigin).toBe('replayed-actual');expect(stopped.samples[stopped.side].renderDto.trajectory.points.every((p:any)=>p.elapsedSeconds<=stopped.displayed.committedTimeSeconds+1e-7)).toBe(true);
  // Native range keyboard actions seek a common requested instant.
  await page.locator('[data-review-cursor]').focus();await page.keyboard.press('Home');await reviewReady(page);const zero=await reviewState(page);expect(zero.requestedTime).toBe(0);expect(zero.displayed.committedTimeSeconds).toBe(0);
  await reviewAction(page,'A');await reviewReady(page);const aa=await reviewState(page);await reviewAction(page,'B');await reviewReady(page);const bb=await reviewState(page);expect(aa.requestedTime).toBe(bb.requestedTime);expect(aa.displayed.displayedRunId).toBe(initial.baseline.source.runId);expect(bb.displayed.displayedRunId).toBe(initial.attempt.source.runId);
  const malformed=JSON.parse(pairText);malformed.baseline.engineSaveSha256='0'.repeat(64);await importReview(page,JSON.stringify(malformed));const rejected=await reviewState(page);expect(rejected.error).toBeTruthy();expect(rejected.baseline.source.engineSaveText).toBe(initial.baseline.source.engineSaveText);expect(rejected.attempt.source.engineSaveText).toBe(initial.attempt.source.engineSaveText);expect(rejected.displayed.displayedRunId).toBe(bb.displayed.displayedRunId);
  // A genuine different committed-time pair must not expose a score delta.
  if(language==='en'&&scale==='normal'){
   await importReview(page,mismatchedText);const mismatch=await reviewState(page);expect(mismatch.comparison.compatibility.mode).toBe('blocked');expect(mismatch.comparison.compatibility.blockers.some((b:any)=>b.code==='PARTIAL_TIME')).toBe(true);expect(mismatch.comparison.deltas).toBeNull();await expect(page.locator('.review-score-delta')).toHaveCount(0);await screenshot(page,'en-normal-partial-time-comparison-blocked');await importReview(page,pairText);
  }
  if(language==='ko'&&scale==='normal'){
   const before=await reviewState(page);await page.evaluate(()=>{const e=(window as any).__game.review(),canvas=e.view.qa.canvas,gl=canvas.getContext('webgl2'),ext=gl.getExtension('WEBGL_lose_context');if(!ext)throw Error('WEBGL_lose_context unavailable');ext.loseContext();setTimeout(()=>ext.restoreContext(),100);});
   await page.waitForFunction(()=>{const e=(window as any).__game.review();return e&&!e.view.qa.canvas.getContext('webgl2').isContextLost();});await page.waitForTimeout(200);const after=await reviewState(page);expect(after.baseline.source).toEqual(before.baseline.source);expect(after.attempt.source).toEqual(before.attempt.source);expect(after.displayed.committedTimeSeconds).toBe(before.displayed.committedTimeSeconds);expect(after.displayed.displayedSourceSha256).toBe(before.displayed.displayedSourceSha256);expect(after.playing).toBe(false);await screenshot(page,'ko-normal-real-review-context-restored');
  }
  const backup=JSON.parse(await downloadReview(page));expect(backup.baseline.engineSaveText).toBe(initial.baseline.source.engineSaveText);expect(backup.attempt.engineSaveText).toBe(initial.attempt.source.engineSaveText);
  record(`${language}-${scale}-actual-layout`,{controls,initial:{requestedTime:initial.requestedTime,displayed:initial.displayed},stopped,scope:'Imported genuine 5,000 s partial flights; UI/layout/strict replay only.'});await screenshot(page,`${language}-${scale}-short-review-final`);await reviewAction(page,'close');await expect(page.locator('.review-experience')).toHaveCount(0);
 });
}

test('late actual archive response preserves old source handles and does not mislabel them as persisted',async({page})=>{
 test.setTimeout(180000);
 // Delay delivery of one genuine completed archive response. Its commit and
 // contents remain unchanged; no private Worker message or verified run is made.
 await page.addInitScript(()=>{
  const descriptor=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage')!,handlers=new WeakMap<Worker,((event:MessageEvent)=>void)|null>();
  Object.defineProperty(Worker.prototype,'onmessage',{configurable:true,get(){return handlers.get(this)??null;},set(handler){handlers.set(this,handler);descriptor.set!.call(this,handler?((event:MessageEvent)=>{
   if((window as any).__delayReviewArchiveOnce&&event.data?.type==='archive'){
    (window as any).__delayReviewArchiveOnce=false;(window as any).__reviewArchiveDelayed={revision:event.data.revision,baselineId:event.data.baseline?.source.runId,attemptId:event.data.attempt?.source.runId};
    setTimeout(()=>{handler.call(this,event);(window as any).__reviewArchiveDelivered=true;},2000);return;
   }handler.call(this,event);
  }):null);}});
 });
 await boot(page,'en');await mainAction(page,'review-archive');await reviewReady(page);await importReview(page,pairText);const before=await reviewState(page);expect(before.persisted).toBe(true);
 await page.evaluate(()=>{(window as any).__delayReviewArchiveOnce=true;});const file=page.waitForEvent('filechooser');await reviewAction(page,'import');await(await file).setFiles({name:'different-real-pair.json',mimeType:'application/json',buffer:Buffer.from(mismatchedText)});
 await page.waitForFunction(()=>Boolean((window as any).__reviewArchiveDelayed));await reviewAction(page,'cancel');const cancelled=await reviewState(page);expect(cancelled.baseline.source.engineSaveText).toBe(before.baseline.source.engineSaveText);expect(cancelled.attempt.source.engineSaveText).toBe(before.attempt.source.engineSaveText);expect(cancelled.persisted).toBe(false);
 await page.waitForFunction(()=>Boolean((window as any).__reviewArchiveDelivered));await reviewAction(page,'B');await reviewReady(page);const recovered=await reviewState(page);expect(recovered.error).toBe('');expect(recovered.attempt.source.engineSaveText).toBe(before.attempt.source.engineSaveText);expect(recovered.displayed.displayedRunId).toBe(before.attempt.source.runId);expect(recovered.persisted).toBe(false);expect(recovered.comparison).toEqual(before.comparison);
 const backup=JSON.parse(await downloadReview(page));expect(backup.attempt.engineSaveText).toBe(before.attempt.source.engineSaveText);await screenshot(page,'cancelled-real-import-old-pair-not-archived');
 await reviewAction(page,'reload');await reviewReady(page);const actuallyStored=await reviewState(page);expect(actuallyStored.persisted).toBe(true);expect(actuallyStored.attempt.source.runId).toBe('fixture-B-4500');expect(actuallyStored.comparison.compatibility.mode).toBe('blocked');record('late-real-archive-response',{scope:'Actual Worker/IDB commit with delayed delivery only; old run bytes restored by strict re-verification, not synthetic response data.',before:{A:before.baseline.source,B:before.attempt.source,revision:before.revision},cancelled:{persisted:cancelled.persisted,revision:cancelled.revision},recovered:{A:recovered.baseline.source,B:recovered.attempt.source,persisted:recovered.persisted},actualStoredRevision:actuallyStored.revision});await reviewAction(page,'close');
});
