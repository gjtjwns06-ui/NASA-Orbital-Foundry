// Preparation only until the coordinator closes every other browser/GPU job.
// $env:PERF_ISOLATED='1'; node tests/browser/performance-standard.mjs
// Uses the frozen production server, never builds or launches a dev server.
// Optional --private-site reads {url,token} from stdin only. Never put the token
// in argv, environment variables, request logs, screenshots or report objects.
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {cpus,totalmem,platform,release} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

if(process.env.PERF_ISOLATED!=='1')throw new Error('Wait for functional GPU QA to stop, then set PERF_ISOLATED=1 to attest isolation.');
const privateMode=process.argv.includes('--private-site');
let privateAccess;
if(privateMode){
  try{
    const input=JSON.parse(readFileSync(0,'utf8'));
    const url=new URL(input.url);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||typeof input.token!=='string'||!input.token.trim())throw new Error();
    privateAccess={url:url.href.replace(/\/$/,''),origin:url.origin,token:input.token};
  }catch{throw new Error('Private-site stdin must contain an HTTPS URL without credentials/query/hash and a nonempty token.');}
}
const redact=value=>privateAccess&&typeof value==='string'?value.split(privateAccess.token).join('[REDACTED]'):value;
const prep=join(process.cwd(),'tests/browser/artifacts/performance-standard-prep');
const read=name=>JSON.parse(readFileSync(join(prep,name),'utf8'));
const design=read('hardware-20-design.json'),legality=read('legality-report.json'),replay=read('input-replay.json');
if(design.parts.length!==20||!legality.allPlacementsValid||replay.warmupMs!==10000||replay.durationMs!==120000)throw new Error('Regenerate the valid20-part fixture and120-second input replay before measuring.');
const artifactName=process.env.SITE_QA_ARTIFACT||(privateMode?'performance-standard-deployed':'performance-standard');
if(!/^[a-z0-9_-]{1,80}$/.test(artifactName))throw new Error('Invalid QA artifact name.');
const output=join(process.cwd(),'tests/browser/artifacts',artifactName);mkdirSync(output,{recursive:true});
const report={date:new Date().toISOString(),url:privateAccess?.url||process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4173',privateHostedSite:privateMode,operatorConfirmedIsolation:true,viewport:{width:1920,height:1080},deviceScaleFactor:1,warmupMs:10000,durationMs:120000,completed:false,hardware:{cpu:cpus()[0]?.model,logicalCpus:cpus().length,ramGiB:totalmem()/2**30,os:platform(),release:release()},fixture:{parts:20,designSha256:createHash('sha256').update(JSON.stringify(design)).digest('hex'),catalogHash:legality.catalogHash,placementLegal:legality.allPlacementsValid,missionLaunchable:legality.missionLaunchable,massKg:legality.massKg,cost:legality.cost,retainedWarnings:legality.warnings},errors:[],samples:[],limits:['Planning stress fixture with20 real catalogue components and retained budget/power/instrument warnings; not a mission-capable ship or active-flight measurement.','Two actual planet meshes, Earth and Mars, in the normal M03 solar view. Current560 spacecraft-path plus600 planetary-orbit samples are reported separately (1160total, approximately1000). No sample reduction or decorative part clones.','Warm-render measurement after10seconds; no cold-network claim. Actual recorded right-button orbit and wheel inputs replay for120seconds.','Headless Chrome on one machine. Operator attests isolation; this script does not close or inspect unrelated apps.','Read-only resource snapshots every20seconds and input instrumentation add small overhead. No screenshot is taken during the timed interval.']};
if(privateMode)report.limits.push('Private-site same-origin resources are fetched through Playwright routing with redirects not followed, then fulfilled to the browser; this protects the credential across redirects. This warmed rendering benchmark makes no network-throughput claim.');
const persist=()=>writeFileSync(join(output,'report.json'),JSON.stringify(report,(_key,value)=>redact(value),2));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-timer-throttling']});report.browser=browser.version();
const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,serviceWorkers:privateMode?'block':'allow'});
if(privateAccess)await context.route('**/*',async route=>{
  const request=route.request(),headers={...request.headers()};
  for(const key of Object.keys(headers))if(key.toLowerCase()==='oai-sites-authorization')delete headers[key];
  if(new URL(request.url()).origin!==privateAccess.origin){await route.continue({headers});return;}
  headers['OAI-Sites-Authorization']='Bearer '+privateAccess.token;
  try{
    const response=await route.fetch({headers,maxRedirects:0});
    await route.fulfill({response});
  }catch{
    report.errors.push('A private-origin resource request failed (request details withheld).');
    await route.abort('failed').catch(()=>{});
  }
});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(redact(e.stack||e.message)));page.on('console',m=>{if(m.type()==='error')report.errors.push(redact(m.text()));});page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))report.errors.push(redact(`${r.status()} ${r.url()}`));});
async function sample(){return page.evaluate(()=>{
  const p=window.__standardPerf,t=window.__game.transfer(),s=t.scene,info=s.renderer.info,intervals=p.intervals.slice().sort((a,b)=>a-b),q=v=>intervals[Math.min(intervals.length-1,Math.floor(intervals.length*v))],sum=intervals.reduce((a,b)=>a+b,0);
  return {wallSeconds:(performance.now()-p.started)/1000,frames:intervals.length,averageFps:intervals.length?1000*intervals.length/sum:null,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),maxMs:intervals.at(-1),over33_3ms:intervals.filter(v=>v>33.3).length,over50ms:intervals.filter(v=>v>50).length,geometryCount:info.memory.geometries,textureCount:info.memory.textures,programCount:info.programs.length,drawCalls:info.render.calls,triangles:info.render.triangles,partCount:t.craft.parts.length,view:s.currentView,quality:s.getRenderSettings(),longTasks:p.longTasks.slice(),observedInputCount:p.inputs.length,heapBytes:performance.memory?.usedJSHeapSize,inactivePrimaryRenderer:{geometryCount:window.__game.scene.renderer.info.memory.geometries,textureCount:window.__game.scene.renderer.info.memory.textures}};
});}
try{
  const system=await browser.newBrowserCDPSession();try{const info=await system.send('SystemInfo.getInfo');report.gpuDriver=info.gpu;}catch(e){report.gpuDriverUnavailable=String(e);}finally{await system.detach();}
  await page.goto(report.url+'/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady,null,{timeout:45000});
  await page.locator('[data-action="missions"]').click();await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-action="mission-transfer"]').click();
  await page.waitForFunction(()=>!window.__game.scene.tween);
  await page.evaluate(d=>{window.__game.setDesign(d);window.__game.scene.setQuality('medium');},design);
  await page.locator('[data-action="plan"]').first().click();
  await page.waitForFunction(()=>{const t=window.__game.transfer();return t&&!t.pending&&t.solution&&t.scene.earth.material.map&&t.scene.mars.material.map;},null,{timeout:90000});
  const metadata=await page.evaluate(()=>{
    const t=window.__game.transfer(),s=t.scene,gl=s.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    const craftPoints=s.pathGroup.children.filter(o=>o.isLine2).map(o=>(o.geometry.attributes.instanceStart?.count??0)+1),planetPoints=s.orbitGroup.children.filter(o=>o.isLine&&!o.material.isLineDashedMaterial).map(o=>o.geometry.attributes.position.count),guidePoints=s.orbitGroup.children.filter(o=>o.isLine&&o.material.isLineDashedMaterial).map(o=>o.geometry.attributes.position.count);
    return {scripts:Array.from(document.scripts).filter(s=>s.src).map(s=>s.src),bundles:performance.getEntriesByType('resource').filter(e=>/\.js(?:\?|$)/.test(e.name)).map(e=>e.name),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),settings:s.getRenderSettings(),nativeDpr:devicePixelRatio,canvasCss:{width:s.canvas.clientWidth,height:s.canvas.clientHeight},planets:{earth:s.earth.visible,mars:s.mars.visible},craftPoints,planetPoints,guidePoints,actualCraft:structuredClone(t.craft),runtimePresent:!!t.runtime,launchable:t.evaluation?.launchable,warnings:t.evaluation?.warnings,plan:structuredClone(t.plan)};
  });report.metadata=metadata;
  if(metadata.settings.quality!=='medium'||metadata.settings.pixelRatio!==1||metadata.settings.drawingBuffer.width!==1920||metadata.settings.drawingBuffer.height!==1080)throw new Error('Actual inherited renderer must be1920×1080 medium atnativeDPR1.');
  if(!metadata.planets.earth||!metadata.planets.mars||metadata.actualCraft.parts.length!==20||metadata.runtimePresent)throw new Error('Expected two visible planets and exactly20parts in planning mode.');
  if(JSON.stringify(metadata.actualCraft.parts)!==JSON.stringify(design.parts))throw new Error('The actual20-part layout differs from the prepared physical fixture.');
  const points=[...new Map(replay.actions.filter(e=>e.x!==undefined).map(e=>[`${e.x},${e.y}`,{x:e.x*1920,y:e.y*1080}])).values()];
  const blocked=await page.evaluate(points=>points.filter(p=>document.elementFromPoint(p.x,p.y)?.id!=='transfer-universe'),points);if(blocked.length)throw new Error('Replay coordinates are covered by UI: '+JSON.stringify(blocked));
  await page.waitForTimeout(10000);
  await page.evaluate(()=>{
    const record={started:performance.now(),last:null,intervals:[],longTasks:[],inputs:[],running:true,observer:null};window.__standardPerf=record;
    if(PerformanceObserver.supportedEntryTypes.includes('longtask')){record.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())record.longTasks.push({atMs:e.startTime-record.started,durationMs:e.duration});});record.observer.observe({entryTypes:['longtask']});}
    const canvas=window.__game.transfer().scene.canvas;
    for(const type of ['pointerdown','pointermove','pointerup','wheel'])canvas.addEventListener(type,e=>{if(record.running)record.inputs.push({atMs:performance.now()-record.started,type,x:e.clientX,y:e.clientY,button:e.button,buttons:e.buttons,deltaY:e.deltaY});},{passive:true});
    const frame=now=>{if(!record.running)return;if(record.last!==null)record.intervals.push(now-record.last);record.last=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  });
  const schedule=[...replay.actions.map(event=>({...event,kind:'input'})),...[20000,40000,60000,80000,100000,120000].map(atMs=>({atMs,kind:'sample'}))].sort((a,b)=>a.atMs-b.atMs);
  const nodeStart=performance.now();console.log(JSON.stringify({phase:'begin isolated120s20part1920x1080medium',settings:metadata.settings,retainedWarningCodes:report.fixture.retainedWarnings.map(w=>w.code)}));
  for(const event of schedule){
    const remaining=event.atMs-(performance.now()-nodeStart);if(remaining>0)await page.waitForTimeout(remaining);
    if(event.kind==='sample'){report.samples.push(await sample());persist();console.log(JSON.stringify({phase:'sample',...report.samples.at(-1)}));continue;}
    if(event.type==='move')await page.mouse.move(event.x*1920,event.y*1080);
    else if(event.type==='down')await page.mouse.down({button:event.button});
    else if(event.type==='up')await page.mouse.up({button:event.button});
    else if(event.type==='wheel')await page.mouse.wheel(0,event.deltaY);
  }
  report.inputs=await page.evaluate(()=>{const r=window.__standardPerf;r.running=false;r.observer?.disconnect();return r.inputs;});report.final=report.samples.at(-1);
  const metric=report.final;report.criteria={meanAtLeast60Fps:metric.averageFps>=60,p99AtMost33_3ms:metric.p99Ms<=33.3,zeroErrors:report.errors.length===0,completeDuration:metric.wallSeconds>=120,twentyParts:metric.partCount===20,medium1080:metric.quality.quality==='medium'&&metric.quality.drawingBuffer.width===1920&&metric.quality.drawingBuffer.height===1080,allScheduledInputsSent:true,observedDrags:report.inputs.filter(e=>e.type==='pointerdown'&&e.button===2).length,observedWheelEvents:report.inputs.filter(e=>e.type==='wheel').length};
  report.resourceCountsStable=report.samples.every(s=>s.geometryCount===metric.geometryCount&&s.textureCount===metric.textureCount&&s.programCount===metric.programCount);
  report.completed=true;persist();await page.screenshot({path:join(output,'planning-20parts-1920x1080-after120s.png'),fullPage:true});
  console.log(JSON.stringify({completed:true,criteria:report.criteria,resourceCountsStable:report.resourceCountsStable,artifact:join(output,'report.json')}));
  if(report.errors.length||report.criteria.observedDrags!==12||report.criteria.observedWheelEvents!==12)throw new Error('The complete input/error criteria were not met; inspect report.');
}catch(error){report.failure=redact(error.stack||String(error));persist();if(privateMode)throw new Error('Private benchmark failed; inspect the sanitized report.');throw error;}finally{await browser.close();}
