import {expect} from '@playwright/test';
import {test,boot,startSwingby,flightAction,flightState,flightReady,reviewAction,reviewReady,reviewState,downloadReview,builderReady,mainAction,rootState,screenshot,record} from './helpers';

test('blocked review storage retains exact in-memory A across a real fork and new partial flight',async({page})=>{
 test.setTimeout(60000);
 // Explicit browser fault injection: only the detached review Worker cannot
 // open its own archive DB. Original engine code, physics messages and live
 // spacecraft saves are untouched. No checkpoint/result is injected.
 let faultInstalled=false;
 await page.context().route(/review\.worker[^/]*\.(?:ts|js)(?:\?|$)/,async route=>{
  const response=await route.fetch(),original=await response.text();faultInstalled=true;
  // Synchronous prelude preserves the native Worker's original initialization
  // and message handler. The rejected first harness used dynamic await-import
  // and lost its first queued request before that handler was installed.
  const prelude="const qaOriginalReviewOpen=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...args){if(name==='orbital-foundry-review')throw new DOMException('Independent QA: review storage blocked','SecurityError');return qaOriginalReviewOpen.call(this,name,...args);};\n";
  await route.fulfill({response,body:prelude+original,contentType:'text/javascript'});
 });
 const actualPartial=async()=>{await flightAction(page,'launch');await page.waitForFunction(()=>!!(window as any).__game.swingby()?.getState().runtime);if((await flightState(page)).playing)await flightAction(page,'play');await flightReady(page);return flightState(page);};
 await boot(page,'en');await startSwingby(page);const a=await actualPartial();expect(a.runtime.status).toBe('running');await flightAction(page,'review');await reviewReady(page);
 const first=await reviewState(page);expect(faultInstalled).toBe(true);expect(first.baseline).toBeTruthy();expect(first.attempt).toBeNull();expect(first.persisted).toBe(false);expect(first.error).toBe('');expect(first.baseline.evaluation.final).toBe(false);const source=first.baseline.source,authoritativeA=JSON.parse(source.engineSaveText);expect(authoritativeA.craft).toEqual(a.runtime.craft);
 const backup=JSON.parse(await downloadReview(page));expect(backup.baseline.engineSaveText).toBe(source.engineSaveText);await reviewAction(page,'fork');await reviewReady(page);expect((await reviewState(page)).persisted).toBe(false);await expect(page.locator('[data-review-action="fork-memory"]')).toBeVisible();await screenshot(page,'storage-failure-explicit-memory-fork');
 await reviewAction(page,'fork-memory');await builderReady(page);expect((await rootState(page)).design).toEqual(authoritativeA.craft);expect((await rootState(page)).swingbyDraft).toEqual(authoritativeA.plan);expect((await rootState(page)).swingbyNumerics).toEqual(authoritativeA.numerics);
 await mainAction(page,'plan');await flightReady(page);const b=await actualPartial();expect(b.runtime.status).toBe('running');await flightAction(page,'review');await reviewReady(page);const second=await reviewState(page);
 expect(second.error).toBe('');expect(second.persisted).toBe(false);expect(second.baseline.source.engineSaveSha256).toBe(source.engineSaveSha256);expect(second.baseline.source.engineSaveText).toBe(source.engineSaveText);expect(second.attempt).toBeTruthy();expect(second.attempt.source.runId).not.toBe(source.runId);expect(second.attempt.evaluation.final).toBe(false);
 const pair=JSON.parse(await downloadReview(page));expect(pair.baseline.engineSaveText).toBe(source.engineSaveText);expect(JSON.parse(pair.attempt.engineSaveText).craft).toEqual(b.runtime.craft);record('blocked-storage-real-partial-evidence',{scope:'Real short UI flights and memory fork; archive open is fault-injected only. No full-flight success claim.',a:source,b:second.attempt.source,persisted:second.persisted});await screenshot(page,'storage-failure-memory-A-retained-after-B');
 await reviewAction(page,'close');await flightAction(page,'exit');await expect(page.locator('.swingby-experience')).toHaveCount(0);
});
