// Preparation only: the QA owner must first close every other browser/GPU job.
// Node 24+ strips types from the existing native audit import below.
// PERF_ISOLATED=1 PLAYWRIGHT_QA_CANDIDATE=<frozen-id> node tests/browser/performance-deployment.mjs
// No build, server, source mutation, runtime injection, or threshold override.
import {chromium} from '@playwright/test';
import {installNativeDeletionAudit} from './native-gl-audit.ts';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cpus,totalmem,platform,release} from 'node:os';
import {join,resolve,isAbsolute,relative} from 'node:path';

if(Number(process.versions.node.split('.')[0])<24)throw Error('Node 24+ with native TypeScript stripping is required.');
if(process.env.PERF_ISOLATED!=='1')throw Error('The QA owner must attest an isolated GPU/CPU window with PERF_ISOLATED=1.');
const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE;
const artifact=process.env.SITE_QA_ARTIFACT||'performance-deployment';
if(!candidate||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(candidate))throw Error('Provide an allowlisted frozen candidate identifier.');
if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(artifact))throw Error('Invalid artifact directory identifier.');
const browserName=process.env.PLAYWRIGHT_BROWSER||'chrome';
if(!['chrome','edge','chromium'].includes(browserName))throw Error('PLAYWRIGHT_BROWSER must be chrome, edge, or chromium.');
const base=new URL(process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:5188');
if(base.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.port!=='5188'||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('Use the frozen local production server on loopback port 5188 only.');
const root=process.cwd(),folder=join(root,'tests/browser/artifacts',artifact,candidate,browserName);
if(existsSync(join(folder,'report.json')))throw Error('Preserve earlier evidence: choose a new candidate/artifact identifier instead of overwriting a report.');
const explicitExecutable=process.env.CHROME_EXECUTABLE;
if(explicitExecutable&&(!isAbsolute(explicitExecutable)||!existsSync(explicitExecutable)))throw Error('CHROME_EXECUTABLE must identify an existing absolute local executable.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function treeFiles(directory){
 return readdirSync(join(root,directory),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
  const path=directory+'/'+entry.name;
  if(lstatSync(join(root,path)).isSymbolicLink())throw Error('Frozen manifest cannot silently follow a symbolic link: '+path);
  return entry.isDirectory()?treeFiles(path):entry.isFile()?[path]:[];
 });
}
function manifest(){
 const paths=[...treeFiles('src'),...treeFiles('public'),...treeFiles('dist'),'tests/browser/performance-deployment.mjs','tests/browser/native-gl-audit.ts','package.json','package-lock.json'].filter(path=>existsSync(join(root,path))).sort();
 return paths.map(path=>{const bytes=readFileSync(join(root,path));return {path,bytes:bytes.length,sha256:sha(bytes)};});
}
mkdirSync(folder,{recursive:true});
const before=manifest();
writeFileSync(join(folder,'frozen-before.json'),JSON.stringify(before,null,2));
const report={
 candidate,artifact,date:new Date().toISOString(),url:base.origin,operatorConfirmedIsolation:true,
 viewport:{width:1920,height:1080},deviceScaleFactor:1,warmupMs:10000,durationMs:120000,
 predeclaredGate:{meanFpsAtLeast:60,p99MsAtMost:33.3,minimumPhysicalAdvanceSeconds:115,maximumPhysicalLeadSeconds:.25,maximumMeasurementSeconds:121,quality:'medium',motion:'full',uiScale:'normal',nativeDpr:1,rightDrags:12,wheels:12,stableResourceCounts:true,zeroApplicationErrors:true,zeroResourceErrors:true,zeroNativeOwnershipErrors:true},
 sourceAndBundlesBeforeSha256:sha(JSON.stringify(before)),hardware:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramGiB:totalmem()/2**30,os:platform(),release:release()},
 errors:[],resourceErrors:[],warnings:[],workers:[],samples:[],gestures:[],completed:false,passed:false,
 limits:[
  'New scoped active-flight gate: actual Compact First Light commissioning at 1x in craft view. This is not the original 20-part whole-game fixture or a general performance claim.',
  'All game changes use visible settings, preset, launch, pause, speed, and resume controls. No design, runtime, Worker response, camera, or geometry is injected.',
  'Ten-second paused warmup precedes 120 seconds of actual physical flight. Camera gestures alternate direction every ten seconds. No screenshots are taken by this test.',
  'Read-only snapshots every twenty seconds include committed Worker geometry, native renderer poses, mechanisms, energy and resource counts. Their instrumentation overhead is included.',
  'Render FK means displayed local link transforms match the committed Worker geometry; independent physics correctness is covered by the separate domain acceptance evidence.',
  'Headless browser on one machine; operator attests isolation. Warm rendering makes no cold-network, mobile, or cross-hardware claim.',
 ],
};
const persist=()=>writeFileSync(join(folder,'report.json'),JSON.stringify(report,null,2));
persist();
let browser,context,page,timed=false;
const nativeFailures=()=>report.warnings.filter(w=>/INVALID_OPERATION|does not belong to this context|too many errors|GL_INVALID|context[_ ]lost/i.test(w));
const button=action=>page.locator(`[data-deployment-action="${action}"]`).first();
const click=action=>button(action).click();
const state=()=>page.evaluate(()=>window.__game.deployment().getState());
const ready=()=>page.waitForFunction(()=>{const s=window.__game.deployment()?.getState();return s&&!s.pending&&!s.busy&&!s.restoring&&!s.saving&&!s.closing;},null,{timeout:120000});
async function sample(stop=false){
 return page.evaluate(stop=>{
  const p=window.__deploymentPerf;
  if(stop&&p){p.running=false;p.stopped=performance.now();for(const entry of p.observer?.takeRecords()??[])p.longTasks.push({atMs:entry.startTime-p.started,durationMs:entry.duration});p.observer?.disconnect();}
  const d=window.__game.deployment(),s=d.getState(),scene=d.scene,render=scene.qa.getRenderInfo(),canvas=scene.qa.canvas;
  const sorted=(p?.intervals??[]).slice().sort((a,b)=>a-b),sum=sorted.reduce((a,b)=>a+b,0),q=f=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*f))]:null;
  // Both are read-only observations: live.geometry is the committed Worker
  // message and qa.getDisplayedLinks reads the actual native Three groups.
  const geometry=d.live?.geometry,links=scene.qa.getDisplayedLinks(),workerLinks=geometry?.links??[];
  const mismatches=[];
  for(const link of workerLinks){const actual=links.find(item=>item.linkId===link.linkId);if(!actual){mismatches.push({linkId:link.linkId,missing:true});continue;}const positionError=Math.hypot(...actual.position.map((n,i)=>n-link.pose.positionM[i])),quaternionError=Math.min(Math.hypot(...actual.quaternion.map((n,i)=>n-link.pose.quaternion[i])),Math.hypot(...actual.quaternion.map((n,i)=>n+link.pose.quaternion[i])));if(positionError>1e-9||quaternionError>1e-9)mismatches.push({linkId:link.linkId,positionError,quaternionError});}
  const gl=scene.renderer.getContext(),rect=canvas.getBoundingClientRect();
  return {
   wallSeconds:p?.started===null||!p?0:((p.stopped??performance.now())-p.started)/1000,frames:sorted.length,averageFps:sorted.length?1000*sorted.length/sum:null,meanFrameMs:sorted.length?sum/sorted.length:null,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),maxMs:sorted.at(-1)??null,over33_3ms:sorted.filter(n=>n>33.3).length,over50ms:sorted.filter(n=>n>50).length,
   render,geometryCount:render.memory.geometries,textureCount:render.memory.textures,programCount:render.programs,
   settings:{quality:render.quality,nativeDpr:devicePixelRatio,pixelRatio:scene.renderer.getPixelRatio(),drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight},canvasCss:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},normalUi:!document.body.classList.contains('large-ui'),normalMotion:!document.body.classList.contains('reduced-motion')&&!scene.reducedMotion&&scene.controls.enableDamping},
   runtime:s.runtime?{time:s.runtime.time,requestedTime:s.runtime.requestedTime,tick:s.runtime.tick,status:s.runtime.status,failureReason:s.runtime.failureReason,energyWh:s.runtime.energyWh,motorEnergyJ:s.runtime.motorEnergyJ,mechanisms:s.runtime.mechanisms,angular:s.runtime.angular,events:s.runtime.events}:null,
   playing:s.playing,speed:s.speed,busy:s.busy,error:s.error,scene:s.scene,telemetry:s.telemetry,camera:scene.qa.getCamera(),
   renderFK:{workerRevision:geometry?.revision??null,displayedRevision:s.scene.geometryRevision,workerLinks,displayedLinks:links,linkCountsMatch:links.length===workerLinks.length&&workerLinks.length>0,uniqueDisplayedLinks:new Set(links.map(l=>l.linkId)).size===links.length,mismatches},
   longTasks:p?.longTasks.slice()??[],observedInputCount:p?.inputs.length??0,heapBytes:performance.memory?.usedJSHeapSize,visibility:document.visibilityState,textureFallback:canvas.dataset.textureFallback==='true',
  };
 },stop);
}
async function hitTest(points){
 const hits=await page.evaluate(points=>{const canvas=window.__game.deployment().scene.qa.canvas;return points.map(point=>{const hit=document.elementFromPoint(point.x,point.y);return {...point,canvasHit:hit===canvas,hitTag:hit?.tagName??null,hitClass:typeof hit?.className==='string'?hit.className:null};});},points);
 if(hits.some(point=>!point.canvasHit))throw Error('A native gesture coordinate is covered by UI: '+JSON.stringify(hits));
 return hits;
}
async function waitUntil(atMs){
 let elapsed=await page.evaluate(()=>performance.now()-window.__deploymentPerf.started);
 while(elapsed<atMs){await page.waitForTimeout(Math.max(1,atMs-elapsed));elapsed=await page.evaluate(()=>performance.now()-window.__deploymentPerf.started);}
 return elapsed;
}
async function stopTiming(){
 if(!page||!timed)return;
 report.timing=await page.evaluate(()=>{const p=window.__deploymentPerf;p.running=false;p.stopped??=performance.now();const entries=p.observer?.takeRecords()??[];for(const e of entries)p.longTasks.push({atMs:e.startTime-p.started,durationMs:e.duration});p.observer?.disconnect();return {started:p.started,stopped:p.stopped,intervals:p.intervals,inputs:p.inputs,longTasks:p.longTasks,visibilityChanges:p.visibilityChanges,longTaskObserverSupported:p.longTaskObserverSupported};});
 timed=false;
 writeFileSync(join(folder,'timing.json'),JSON.stringify(report.timing,null,2));
 report.timing={file:'timing.json',sha256:sha(readFileSync(join(folder,'timing.json'))),intervals:report.timing.intervals.length,inputs:report.timing.inputs,longTasks:report.timing.longTasks,visibilityChanges:report.timing.visibilityChanges,longTaskObserverSupported:report.timing.longTaskObserverSupported};
}
try{
 const launch={headless:true,args:['--disable-background-timer-throttling']};
 if(explicitExecutable)launch.executablePath=explicitExecutable;
 else if(browserName!=='chromium')launch.channel=browserName==='edge'?'msedge':'chrome';
 browser=await chromium.launch(launch);report.browser={name:browserName,version:browser.version(),node:process.version};
 context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,reducedMotion:'no-preference'});
 page=await context.newPage();page.setDefaultTimeout(15000);await installNativeDeletionAudit(page);
 page.on('pageerror',e=>report.errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.resourceErrors.push({status:r.status(),url:r.url()});});
 page.on('requestfailed',r=>report.resourceErrors.push({url:r.url(),failure:r.failure()?.errorText??'unknown'}));
 page.on('worker',w=>report.workers.push(w.url()));
 const system=await browser.newBrowserCDPSession();try{report.gpuDriver=(await system.send('SystemInfo.getInfo')).gpu;}finally{await system.detach();}
 await page.goto(base.origin+'/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady,null,{timeout:45000});
 await page.locator('[data-action="settings"]').click();await page.locator('#quality').selectOption('medium');await page.locator('#ui-scale').selectOption('normal');await page.locator('#motion').selectOption('full');
 report.visibleSettings=await page.locator('#quality,#ui-scale,#motion').evaluateAll(elements=>elements.map(el=>({id:el.id,value:el.value})));
 await page.locator('[data-action="close-modal"]').click();await page.locator('[data-action="missions"]').click();await page.locator('[data-action="mission-deployment"]').click();await ready();
 await click('variants');await click('preset:compact');await ready();
 const draft=await state();if(!draft.draft?.launchable||draft.runtime)throw Error('Visible Compact selection must produce a launchable draft with no runtime.');
 report.fixture={craft:draft.craft,plan:draft.plan,partCount:draft.craft.parts.length,sourceId:draft.draft.inputHash,numerics:draft.numerics};
 await click('launch');await page.waitForFunction(()=>Boolean(window.__game.deployment()?.getState().runtime));
 if((await state()).playing)await click('play');await ready();
 for(let i=0;i<4&&(await state()).speed!==1;i++)await click('speed');
 const paused=await state();if(paused.playing||paused.speed!==1||paused.runtime.status!=='running')throw Error('Actual launched flight must be paused at 1x before warmup.');
 if(paused.runtime.time>5)throw Error('Setup advanced beyond the first five physical seconds; preserve this failed attempt instead of substituting another runtime.');
 await click('view-craft');await click('fit');
 report.inputRegion=await page.evaluate(()=>{
  const canvas=window.__game.deployment().scene.qa.canvas,r=canvas.getBoundingClientRect();
  const box=selector=>{const el=document.querySelector(selector);if(!el||getComputedStyle(el).display==='none')return null;const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
  const left=box('.deployment-left'),right=box('.deployment-right'),header=box('.deployment-header'),badge=box('.deployment-badge'),timeline=box('.deployment-timeline');
  const area={left:Math.max(r.left,left?.right??r.left)+24,right:Math.min(r.right,right?.left??r.right)-24,top:Math.max(r.top,header?.bottom??r.top,badge?.bottom??r.top)+24,bottom:Math.min(r.bottom,timeline?.top??r.bottom)-24};
  if(area.right-area.left<180||area.bottom-area.top<120)throw Error('No unobstructed central flight canvas region.');
  const center={x:(area.left+area.right)/2,y:(area.top+area.bottom)/2};
  return {canvas:{left:r.left,top:r.top,width:r.width,height:r.height},excludedPanels:{left,right,header,badge,timeline},usable:area,center};
 });
 const {x,y}=report.inputRegion.center;
 report.initialHitTests=await hitTest([-1,1].flatMap(sign=>Array.from({length:9},(_,i)=>({x:x+36*sign*i/8,y:y-22*sign*i/8}))));
 const warmupBefore=await state();report.warmup={runtimeBeforeSha256:sha(JSON.stringify(warmupBefore.runtime)),physicalTimeBefore:warmupBefore.runtime.time};
 await page.waitForTimeout(report.warmupMs);
 const warmupAfter=await state();Object.assign(report.warmup,{runtimeAfterSha256:sha(JSON.stringify(warmupAfter.runtime)),physicalTimeAfter:warmupAfter.runtime.time,pausedAfter:!warmupAfter.playing});
 if(report.warmup.runtimeBeforeSha256!==report.warmup.runtimeAfterSha256||!report.warmup.pausedAfter)throw Error('Paused warmup changed the actual runtime.');
 report.baseline=await sample();
 const configuration=s=>s.settings.quality==='medium'&&s.settings.nativeDpr===1&&s.settings.pixelRatio===1&&s.settings.drawingBuffer.width===1920&&s.settings.drawingBuffer.height===1080&&s.settings.canvasCss.width===1920&&s.settings.canvasCss.height===1080&&s.settings.normalUi&&s.settings.normalMotion&&s.scene.mode==='craft';
 if(!configuration(report.baseline)||report.baseline.textureFallback||!(report.baseline.render.planet.mapWidth>0))throw Error('Actual renderer/settings/textures do not match the predeclared medium1080/full-motion fixture.');
 report.metadata=await page.evaluate(()=>{const s=window.__game.deployment().scene,gl=s.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {scripts:Array.from(document.scripts).filter(s=>s.src).map(s=>s.src),resources:performance.getEntriesByType('resource').map(e=>({name:e.name,type:e.initiatorType,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize})),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 await page.evaluate(()=>{
  const p=window.__deploymentPerf={armed:true,started:null,stopped:null,last:null,intervals:[],longTasks:[],inputs:[],visibilityChanges:[],running:false,observer:null,longTaskObserverSupported:PerformanceObserver.supportedEntryTypes.includes('longtask')};
  const canvas=window.__game.deployment().scene.qa.canvas;
  for(const type of ['pointerdown','pointermove','pointerup','wheel'])canvas.addEventListener(type,e=>{if(p.running)p.inputs.push({atMs:performance.now()-p.started,type,x:e.clientX,y:e.clientY,button:e.button,buttons:e.buttons,deltaY:e.deltaY,trusted:e.isTrusted});},{passive:true,capture:true});
  document.addEventListener('visibilitychange',()=>{if(p.running)p.visibilityChanges.push({atMs:performance.now()-p.started,state:document.visibilityState});});
  // Arm before the genuine Resume click. Starting here prevents locator latency
  // from excluding early physical flight or first rendered active frames.
  document.addEventListener('click',e=>{
   if(!p.armed||!e.isTrusted||!e.target.closest?.('[data-deployment-action="play"]'))return;
   p.armed=false;p.started=performance.now();p.running=true;
   if(p.longTaskObserverSupported){p.observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())p.longTasks.push({atMs:entry.startTime-p.started,durationMs:entry.duration});});p.observer.observe({entryTypes:['longtask']});}
   const frame=now=>{if(!p.running)return;if(p.last!==null)p.intervals.push(now-p.last);p.last=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  },{capture:true});
 });
 await click('play');timed=true;
 if(!await page.evaluate(()=>window.__deploymentPerf.running&&window.__game.deployment().getState().playing))throw Error('The native Resume click did not begin actual flight and timing.');
 console.log(JSON.stringify({phase:'begin isolated active Compact flight',candidate,browser:report.browser,gate:report.predeclaredGate,baselinePhysicalSeconds:report.baseline.runtime.time}));
 const schedule=[];
 for(let i=0;i<12;i++)schedule.push({at:i*10000+1000,kind:'gesture',index:i,sign:i%2?-1:1});
 for(const at of [20000,40000,60000,80000,100000,120000])schedule.push({at,kind:'sample'});
 schedule.sort((a,b)=>a.at-b.at);
 for(const event of schedule){
  const observedAtMs=await waitUntil(event.at);
  if(event.kind==='gesture'){
   const end={x:x+36*event.sign,y:y-22*event.sign};
   const hits=await hitTest(Array.from({length:9},(_,i)=>({x:x+(end.x-x)*i/8,y:y+(end.y-y)*i/8})));
   await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up({button:'right'});
   const wheelHits=await hitTest([end]);await page.mouse.wheel(0,60*event.sign);
   report.gestures.push({index:event.index,scheduledAtMs:event.at,observedAtMs,from:{x,y},to:end,deltaY:60*event.sign,pathHits:hits,wheelHits});
  }else{
   const value=await sample(event.at===report.durationMs);value.scheduledAtMs=event.at;report.samples.push(value);
   if(event.at===report.durationMs)await stopTiming();
   persist();
   console.log(JSON.stringify({phase:'sample',wallSeconds:value.wallSeconds,physicalSeconds:value.runtime?.time,motorEnergyJ:value.runtime?.motorEnergyJ,meanFps:value.averageFps,p99Ms:value.p99Ms,geometries:value.geometryCount,textures:value.textureCount,programs:value.programCount}));
  }
 }
 await stopTiming();report.final=report.samples.at(-1);
 // Pause and dispose through visible controls only, after the timing interval.
 // The final audit therefore also includes real renderer resource retirement.
 if((await state()).playing)await click('play');await ready();report.afterPause=await sample();
 await click('exit');await page.waitForFunction(()=>!window.__game.deployment(),null,{timeout:120000});
 report.native=await page.evaluate(()=>window.__allContextDeletionAudit);report.teardownCompleted=true;
 const f=report.final,all=[report.baseline,...report.samples],inputs=report.timing.inputs;
 const angleMap=s=>Object.fromEntries(Object.entries(s.runtime.mechanisms).flatMap(([id,m])=>Object.entries(m.jointStates).map(([joint,value])=>[id+'/'+joint,value.angleRad])));
 const initialAngles=angleMap(report.baseline),finalAngles=angleMap(f);
 report.physicalAdvanceSeconds=f.runtime.time-report.baseline.runtime.time;
 report.mechanismEvidence={initialAngles,finalAngles,movingSamples:report.samples.filter(s=>Object.values(s.runtime.mechanisms).some(m=>m.phase==='moving'&&Object.values(m.jointStates).some(j=>Math.abs(j.rateRadS)>0))).map(s=>s.runtime.time),motorEnergyIncreaseJ:f.runtime.motorEnergyJ-report.baseline.runtime.motorEnergyJ};
 report.criteria={
  meanAtLeast60Fps:f.averageFps>=60,p99AtMost33_3ms:f.p99Ms<=33.3,
  complete120Seconds:f.wallSeconds>=120,boundedMeasurement:f.wallSeconds<=121,
  physicalAdvanceAtLeast115Seconds:report.physicalAdvanceSeconds>=115,noFasterThan1x:report.physicalAdvanceSeconds<=f.wallSeconds+.25,
  sixScheduledSamples:report.samples.length===6,playingAt1xThroughout:report.samples.every(s=>s.playing&&s.speed===1&&s.runtime.status==='running'),
  physicalTimeStrictlyAdvances:report.samples.every((s,i)=>s.runtime.time>(i?report.samples[i-1]:report.baseline).runtime.time),
  mechanismsActuallyMove:report.mechanismEvidence.movingSamples.length>0&&Object.keys(initialAngles).some(id=>Math.abs(finalAngles[id]-initialAngles[id])>1e-6),
  motorEnergyActuallyConsumed:report.mechanismEvidence.motorEnergyIncreaseJ>0,
  renderMatchesWorkerFK:all.every(s=>s.renderFK.linkCountsMatch&&s.renderFK.uniqueDisplayedLinks&&!s.renderFK.mismatches.length&&s.renderFK.workerRevision===s.renderFK.displayedRevision&&s.scene.timeSeconds===s.runtime.time),
  displayedMechanismTransformsChange:JSON.stringify(report.baseline.renderFK.displayedLinks)!==JSON.stringify(f.renderFK.displayedLinks),
  medium1080FullMotionDpr1Throughout:all.every(configuration),pausedWarmupUnchanged:report.warmup.runtimeBeforeSha256===report.warmup.runtimeAfterSha256,
  resourceCountsStable:all.every(s=>s.geometryCount===f.geometryCount&&s.textureCount===f.textureCount&&s.programCount===f.programCount),
  realPlanetTexturesLoaded:all.every(s=>!s.textureFallback&&s.render.planet.mapWidth>0),
  observed12RightDrags:inputs.filter(e=>e.type==='pointerdown'&&e.button===2).length===12&&inputs.filter(e=>e.type==='pointerup'&&e.button===2).length===12&&inputs.filter(e=>e.type==='pointermove'&&(e.buttons&2)).length>=12,
  observed12Wheels:inputs.filter(e=>e.type==='wheel').length===12,
  nativeTrustedInputs:inputs.length>0&&inputs.every(e=>e.trusted),allGesturesHitCanvas:report.gestures.length===12&&report.gestures.every(g=>[...g.pathHits,...g.wheelHits].every(h=>h.canvasHit)),
  visibleThroughout:all.every(s=>s.visibility==='visible')&&report.timing.visibilityChanges.every(e=>e.state==='visible'),longTaskObserverPresent:report.timing.longTaskObserverSupported,
  zeroApplicationErrors:report.errors.length===0&&all.every(s=>!s.error),zeroResourceErrors:report.resourceErrors.length===0,
  nativeAuditInstalled:Boolean(report.native)&&(report.native?.contexts?.length??0)>=2,
  zeroNativeOwnershipErrors:(report.native?.errors?.length??1)===0&&nativeFailures().length===0,
  zeroUnexpectedContextLoss:(report.native?.contextLostNotifications??1)===0,visibleExitCompleted:report.teardownCompleted,
 };
 report.completed=true;
}catch(error){
 report.failure=error.stack||String(error);
 if(timed)await stopTiming().catch(e=>{report.timingCollectionFailure=String(e);});
 if(page)report.native=await page.evaluate(()=>window.__allContextDeletionAudit).catch(()=>null);
}finally{
 // Hash outside the measured interval. Include every source/public/dist file,
 // plus this exact test and audit, so this new gate cannot silently tune inputs.
 try{const after=manifest();writeFileSync(join(folder,'frozen-after.json'),JSON.stringify(after,null,2));report.sourceAndBundlesAfterSha256=sha(JSON.stringify(after));report.frozenInputsUnchanged=JSON.stringify(before)===JSON.stringify(after);report.criteria={...report.criteria,frozenInputsUnchanged:report.frozenInputsUnchanged};}catch(error){report.hashFailure=String(error);report.criteria={...report.criteria,frozenInputsUnchanged:false};}
 report.passed=report.completed&&!report.failure&&Object.values(report.criteria??{}).every(value=>value===true);
 persist();await browser?.close();
}
console.log(JSON.stringify({completed:report.completed,passed:report.passed,criteria:report.criteria,artifact:relative(root,resolve(folder,'report.json'))}));
if(!report.passed)throw Error('The predeclared active-flight performance gate failed; preserve and inspect its report.');
