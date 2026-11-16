// Run only after functional QA stops and the production build is frozen:
// $env:PERF_ISOLATED='1'; node tests/browser/performance-extended.mjs room,m03
// Optional: PLAYWRIGHT_BASE_URL, PERF_WIDTH=1920, PERF_HEIGHT=1080,
// PERF_SECONDS (>=120), CHROME_EXECUTABLE. No automatic build or server startup.
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {cpus,totalmem,platform,release} from 'node:os';
import {join} from 'node:path';

if(process.env.PERF_ISOLATED!=='1')throw new Error('Run after all other browser/GPU QA finishes; set PERF_ISOLATED=1 to record operator-confirmed isolation.');
const fixtures=(process.argv[2]||'room,m03').split(',');
if(fixtures.some(x=>!['room','m03'].includes(x)))throw new Error('Fixtures must be room, m03, or room,m03.');
const duration=Number(process.env.PERF_SECONDS||120),width=Number(process.env.PERF_WIDTH||1280),height=Number(process.env.PERF_HEIGHT||720);
if(!Number.isFinite(duration)||duration<120||!Number.isInteger(width)||!Number.isInteger(height)||width<1280||height<720)throw new Error('Use at least 120 seconds and an unscaled viewport of at least 1280×720.');
const artifactDir=join(process.cwd(),'tests/browser/artifacts/performance-extended');mkdirSync(artifactDir,{recursive:true});
const output=join(artifactDir,'report.json');
const report={date:new Date().toISOString(),url:process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4173',viewport:{width,height},deviceScaleFactor:1,durationSeconds:duration,operatorConfirmedIsolation:true,hardware:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramGiB:totalmem()/2**30,os:platform(),release:release()},measurement:'Unclamped requestAnimationFrame intervals during actual live simulation, plus render resources every 20 seconds.',limits:['These are the named preset fixtures, not the original 20-part acceptance benchmark.','Headless Chrome on this machine; no cross-device or commercial-quality claim.','Warm scene measurement; navigation/asset warmup is recorded separately, not a cold network benchmark.','No clicks or screenshots during the timed intervals. Twenty-second diagnostic snapshots add small instrumentation overhead; room snapshots use the read-only state hook.','GPU isolation is attested by the operator; this script does not inspect or close other applications.'],runs:[],completed:false};
const persist=()=>writeFileSync(output,JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-timer-throttling']});report.browser=browser.version();persist();
const rootAction=(page,name)=>page.locator(`[data-action="${name}"]`).first().click();
const transferAction=(page,name)=>page.locator(`[data-transfer-action="${name}"]`).first().click();
const awaitDesign=page=>page.waitForFunction(()=>{const g=window.__game,s=g.getState();return !s.pending&&s.revision===s.acceptedRevision&&!g.scene.tween;});
async function setupRoom(page){
  await rootAction(page,'missions');await page.locator('[data-mission="mars"]').click();await awaitDesign(page);await rootAction(page,'preset-balanced');await awaitDesign(page);await rootAction(page,'plan');await awaitDesign(page);await rootAction(page,'launch');await page.waitForSelector('#flight-time');
  if(await page.evaluate(()=>window.__game.getState().playing))await rootAction(page,'play-pause');
  await rootAction(page,'control-room');await page.waitForFunction(()=>window.__game.scene.controlRoomActive&&window.__game.scene.controlRoom.ready);
  await page.locator('[data-speed="60"]').click();await rootAction(page,'play-pause');
}
async function setupM03(page){
  await rootAction(page,'missions');await rootAction(page,'mission-transfer');await page.locator('[data-action="plan"]').last().click();
  await page.waitForFunction(()=>{const t=window.__game.transfer();return t&&!t.pending;},null,{timeout:45000});await transferAction(page,'launch');await page.waitForFunction(()=>Boolean(window.__game.transfer().runtime));
  // Reach the actual Mars periapsis through the same three milestone actions a
  // player uses. No injected solution, elapsed-time edit or finish shortcut.
  for(let i=0;i<3;i++){
    const previous=await page.evaluate(()=>window.__game.transfer().runtime.time);await transferAction(page,'next');
    await page.waitForFunction(previous=>{const t=window.__game.transfer();return !t.playing&&!t.busy&&t.runtime.time>previous;},previous,{timeout:90000});
  }
  await transferAction(page,'view-mars');
  // 600× would leave the close observation region early; use the actual 1×
  // control to measure a stable active periapsis scene for the full 120 seconds.
  await transferAction(page,'speed-1');await transferAction(page,'play');
  await page.waitForFunction(()=>{const t=window.__game.transfer();return t.playing&&t.telemetry.environment.state.phase==='mars-flyby'&&!t.scene.previewingPhase;});
}
async function metadata(page,fixture){return page.evaluate(fixture=>{
  const g=window.__game,t=fixture==='m03'?g.transfer():null,s=t?t.scene:g.scene,gl=s.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),craft=t?t.craft:g.getState().design,sim=t?t.runtime:g.getState().sim;
  return {scripts:Array.from(document.scripts).filter(x=>x.src).map(x=>x.src),resourceBundles:performance.getEntriesByType('resource').filter(x=>/\.js(?:\?|$)/.test(x.name)).map(x=>x.name),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),devicePixelRatio,pixelRatio:s.renderer.getPixelRatio(),drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},canvasCss:{width:s.canvas.clientWidth,height:s.canvas.clientHeight},quality:t?'Fixed M03 renderer: antialias, ACES, DPR cap 1.5':s.quality,fixture:{mission:fixture==='m03'?'M03 Earth-to-Mars at computed Mars periapsis':'M02 local Mars flyby, control-room interior plus live orbital monitor',preset:'balanced',partCount:craft.parts.length,parts:craft.parts.map(p=>p.kind),simulationTime:sim.time,status:sim.status,speed:t?t.speed:60,phase:t?t.telemetry.environment.state.phase:'local-mars-flyby',actualPhaseView:t?!s.previewingPhase:true,modelVersion:sim.modelVersion,roomActive:fixture==='room'?s.controlRoomActive:false}};
},fixture);}
async function sample(page,fixture){return page.evaluate(fixture=>{
  const g=window.__game,t=fixture==='m03'?g.transfer():null,s=t?t.scene:g.scene,sim=t?t.runtime:g.getState().sim,m=s.renderer.info.memory,intervals=window.__extendedPerf.intervals,sorted=intervals.filter(Number.isFinite).slice().sort((a,b)=>a-b),q=x=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*x))];
  return {wallSeconds:(performance.now()-window.__extendedPerf.started)/1000,frames:sorted.length,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),maxMs:sorted.at(-1),over33_34ms:sorted.filter(x=>x>33.34).length,over50ms:sorted.filter(x=>x>50).length,geometryCount:m.geometries,textureCount:m.textures,programCount:s.renderer.info.programs.length,drawCalls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,simulationTime:sim.time,status:sim.status,scienceReceived:sim.scienceReceived,packets:sim.packets?.length??sim.dataPackets?.length??0,playing:t?t.playing:g.getState().playing,phase:t?t.telemetry.environment.state.phase:'local-mars-flyby',actualPhaseView:t?!s.previewingPhase:true,jsHeapUsed:performance.memory?.usedJSHeapSize,longTasks:window.__extendedPerf.longTasks.slice(),inactivePrimaryRenderer:t?{geometryCount:g.scene.renderer.info.memory.geometries,textureCount:g.scene.renderer.info.memory.textures}:null};
},fixture);}
try{
  for(const fixture of fixtures){
    const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1}),page=await context.newPage();
    const run={fixture,startedAt:new Date().toISOString(),errors:[],samples:[],completed:false};report.runs.push(run);
    page.on('pageerror',e=>run.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.includes('favicon.ico'))run.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))run.errors.push(`${r.status()} ${r.url()}`);});
    const setupStart=performance.now();await page.goto(report.url+'/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady,null,{timeout:45000});
    if(fixture==='room')await setupRoom(page);else await setupM03(page);
    await page.waitForTimeout(3000);run.setupAndWarmupMs=performance.now()-setupStart;run.metadata=await metadata(page,fixture);
    if(fixture==='room'&&run.metadata.quality!=='high')throw new Error('Control-room fixture must use high graphics quality.');
    if(!run.metadata.fixture.actualPhaseView)throw new Error('M03 fixture must render the active local phase, not a preview.');
    await page.evaluate(()=>{
      const record={started:performance.now(),last:null,intervals:[],longTasks:[],running:true,observer:null};window.__extendedPerf=record;
      if(PerformanceObserver.supportedEntryTypes.includes('longtask')){record.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())record.longTasks.push({startMs:e.startTime-record.started,durationMs:e.duration});});record.observer.observe({entryTypes:['longtask']});}
      const frame=now=>{if(!record.running)return;if(record.last!==null)record.intervals.push(now-record.last);record.last=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
    });
    console.log(JSON.stringify({fixture,phase:'begin isolated live sample',seconds:duration,metadata:run.metadata}));
    for(let elapsed=0;elapsed<duration;){const wait=Math.min(20,duration-elapsed);await page.waitForTimeout(wait*1000);elapsed+=wait;run.samples.push(await sample(page,fixture));persist();console.log(JSON.stringify({fixture,phase:'sample',...run.samples.at(-1)}));}
    await page.evaluate(()=>{window.__extendedPerf.running=false;window.__extendedPerf.observer?.disconnect();});
    run.finalMetadata=await metadata(page,fixture);run.final=run.samples.at(-1);run.observedP95Within33_34ms=run.final.p95Ms<=33.34;run.simulationAdvanced=run.final.simulationTime>run.metadata.fixture.simulationTime;run.completed=true;
    await page.screenshot({path:join(artifactDir,`${fixture}-${width}x${height}-${duration}s.png`),fullPage:true});persist();await context.close();
    if(run.errors.length||!run.simulationAdvanced||!run.final.playing||!run.final.actualPhaseView)throw new Error(`Fixture ${fixture} did not remain an error-free active simulation; inspect ${output}.`);
  }
  report.completed=true;persist();console.log(JSON.stringify({complete:true,artifact:output}));
}catch(error){report.failure=error.stack||String(error);persist();throw error;}finally{await browser.close();}
