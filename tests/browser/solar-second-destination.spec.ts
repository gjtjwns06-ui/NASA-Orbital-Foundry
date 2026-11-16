import {test,expect,type Page} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {aimRegion,expose,reachEncounter,voyageButton,voyageState} from './voyage-helpers';

const out=join(process.cwd(),'tests/browser/artifacts/solar-second-destination');
mkdirSync(out,{recursive:true});
test.use({viewport:{width:1440,height:900}});
test.setTimeout(240000);
const action=(page:Page,name:string)=>page.locator(`[data-solar-action="${name}"]`).first();
const assemblyState=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());

test('Venus requires and uses an actually installed spectrometer before returning a new discovery',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?qa');
  await page.locator('[data-action="solar-campaign"]').click();
  await expect(page.locator('.solar-experience')).toBeVisible({timeout:45000});
  for(let i=0;i<3;i++)await action(page,'story').click();
  await page.locator('.solar-destinations [data-solar-body="venus"]').click();
  await expect(page.locator('.solar-objective h1')).toHaveText('금성');
  await expect(action(page,'launch')).toBeDisabled();
  await expect(page.locator('.solar-route-state')).toContainText('분광');
  await page.screenshot({path:join(out,'venus-needs-spectrometer.png')});

  await action(page,'build').click();
  await expect(page.locator('.solar-experience')).toHaveCount(0);
  await expect(page.locator('.solar-assembly-heading')).toContainText('태양계');
  await expect(page.locator('.assembly-purpose h2')).toHaveText('금성');
  await page.waitForFunction(()=>{const g=(window as any).__game;return g&&!g.scene.tween&&!g.getState().pending;},null,{timeout:30000});
  const before=await assemblyState(page);
  expect(before.design.parts.some((p:{kind:string})=>p.kind==='spectrometer')).toBe(false);
  const count=before.design.parts.length;

  // Actual shelf keyboard placement, not test mutation. The existing camera
  // occupies -Z, so fit the new spectrometer to the free left (-X) face.
  await page.locator('[data-part="spectrometer"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.keyboard-placement')).toBeVisible();
  await page.locator('[data-kb-field="face"]').selectOption('nx');
  await expect(page.locator('[data-kb-command="confirm"]')).toBeEnabled();
  await page.locator('[data-kb-command="confirm"]').click();
  await expect.poll(async()=>(await assemblyState(page)).design.parts.length).toBe(count+1);
  const changed=await assemblyState(page);
  const installed=changed.design.parts.find((p:{kind:string})=>p.kind==='spectrometer');
  expect(installed?.face).toBe('nx');
  await expect(page.locator('[data-part="spectrometer"]')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:join(out,'venus-instrument-installed.png')});
  await page.locator('.assembly-flightbar [data-action="solar-campaign"]').click();
  await expect(page.locator('.solar-objective h1')).toHaveText('금성');
  if(await action(page,'launch').isDisabled()){
    await expect(action(page,'window')).toBeVisible();
    await action(page,'window').click();
  }
  await expect(action(page,'launch')).toBeEnabled();
  await expect(page.locator('.solar-route-state')).not.toContainText('분광 관측기가 필요');
  await page.screenshot({path:join(out,'venus-ready-route.png')});
  await action(page,'launch').click();
  await reachEncounter(page,'safe-choice');
  await expect(page.locator('.voyage-science h2')).toHaveText('금성');
  expect((await voyageState(page)).operations.sensor).toBe('spectrometer');
  expect((await voyageState(page)).pose.partId).toBe(installed.id);

  // Native pointing through the newly installed aperture. The actual approach
  // must shrink the footprint; zoom alone cannot make a broad scan valid.
  await aimRegion(page,2);
  await page.mouse.move(720,450);
  await page.mouse.wheel(0,-3000);
  await aimRegion(page,2);
  await expect.poll(async()=>{
    const s=await voyageState(page),region=s.operations.encounter.features[2];
    return s.exposure.featureId===region.id&&s.exposure.reason==='ready'&&s.exposure.footprintKm<=region.radiusKm*3;
  },{timeout:80000}).toBe(true);
  const observedFeature=(await voyageState(page)).exposure.featureId;
  await expose(page);
  await expect.poll(async()=>(await voyageState(page)).summary.validRecords).toBe(1);
  expect((await voyageState(page)).summary.ready).toBe(false);
  await voyageButton(page,'band:nir').click();
  await expose(page);
  await expect.poll(async()=>(await voyageState(page)).summary.ready).toBe(true);
  const measured=await voyageState(page);
  expect(measured.summary.spectralPair).toHaveLength(2);
  expect(measured.summary.spectralPair.map((r:any)=>r.band)).toEqual(['visible','nir']);
  expect(measured.summary.spectralPair.every((r:any)=>r.featureId===observedFeature)).toBe(true);
  expect(measured.summary.spectralPair.every((r:any)=>Number.isFinite(r.reflectanceEstimate)&&r.reflectanceEstimate>0&&Number.isFinite(r.reflectanceUncertainty)&&r.reflectanceUncertainty>0)).toBe(true);
  await expect(page.locator('.voyage-thumbnails figure')).toHaveCount(2);
  await page.screenshot({path:join(out,'venus-two-band-observations.png')});

  await voyageButton(page,'send').click();
  await expect(page.locator('.voyage-letter')).toBeVisible();
  // Read-only evidence distinguishes transmitted bits from an Earth receipt.
  await expect.poll(async()=>{
    const s=await voyageState(page);
    return s?.phase==='sending'&&s.summary.transmittedReady&&s.sendElapsedSeconds<s.operations.oneWayLightSeconds;
  },{timeout:20000}).toBe(true);
  await expect(page.locator('.solar-discovery-card')).toHaveCount(0);
  await expect(page.locator('.solar-discovery-card')).toBeVisible({timeout:30000});
  await expect(page.locator('.solar-discovery-card .solar-eyebrow')).toContainText('금성');
  await expect(page.locator('.solar-discovery-stamp')).toContainText('지구에 도착');
  await expect(page.locator('.solar-discovery-card .solar-discovery-image')).toHaveAttribute('src',/^data:image\/jpeg;base64,/);
  await expect(page.locator('.solar-spectral-receipt')).toContainText('NIR / VIS');
  await action(page,'journal').click();
  await expect(page.locator('.solar-drawer > article')).toHaveCount(1);
  await expect(page.locator('.solar-drawer > article h3')).toHaveText('금성');
  await page.screenshot({path:join(out,'venus-received-journal.png')});
  // Reading the saved receipt confirms the public gameplay actually persisted
  // the newly equipped craft and destination, without writing test-only state.
  const receipt=await page.evaluate(()=>{
    const save=JSON.parse(localStorage.getItem('orbital-solar-expedition-v1')!);
    return {target:save.target,parts:save.design.parts.map((p:any)=>({id:p.id,kind:p.kind,face:p.face})),discoveries:save.discoveries.map((d:any)=>({body:d.body,receivedJd:d.receivedJd,observations:d.observations,imagePresent:!!d.image,science:d.science?{...d.science,samples:d.science.samples.map((s:any)=>({...s,image:undefined,imagePresent:/^data:image\/jpeg;base64,/.test(s.image??'')}))}:null}))};
  });
  expect(receipt.target).toBe('venus');
  expect(receipt.parts.some((p:{kind:string;face:string})=>p.kind==='spectrometer'&&p.face==='nx')).toBe(true);
  expect(receipt.discoveries[0]?.body).toBe('venus');
  expect(receipt.discoveries[0]?.observations).toBe(2);
  expect(receipt.discoveries[0]?.imagePresent).toBe(true);
  const science=receipt.discoveries[0]?.science;
  expect(science?.instrument).toBe('spectrometer');
  expect(science?.model).toBe('local-hyperbola-synthetic-response-v1');
  expect(science?.samples).toHaveLength(2);
  expect(science.samples.map((s:any)=>s.band)).toEqual(['visible','nir']);
  expect(science.samples.every((s:any)=>s.kind==='spectrum'&&s.featureId===observedFeature&&s.imagePresent&&s.snr>=10&&s.smearPixels<=2.5&&Number.isFinite(s.reflectanceEstimate)&&Number.isFinite(s.reflectanceUncertainty))).toBe(true);
  writeFileSync(join(out,'venus-journey-result.json'),JSON.stringify({browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),receipt,errors,scope:'Real UI wrong-instrument block, native keyboard spectrometer installation, safe-recovery cruise, native same-region VIS/NIR held exposures, transmission/light-travel wait, and actual received image/measurement journal. No human fun or first-use-understanding claim.'},null,2));
  expect(errors).toEqual([]);
});
