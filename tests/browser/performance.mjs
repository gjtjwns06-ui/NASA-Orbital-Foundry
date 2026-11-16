// Standalone, reproducible measurement: node tests/browser/performance.mjs
// Keep this outside *.spec.ts so ordinary interaction reruns do not repeat a 2-minute sample.
import {chromium} from '@playwright/test';
import {writeFileSync,mkdirSync} from 'node:fs';
import {cpus,totalmem} from 'node:os';
import {join} from 'node:path';
const out=join(process.cwd(),'tests','browser','artifacts','performance.json');mkdirSync(join(out,'..'),{recursive:true});
const report={date:new Date().toISOString(),url:process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4173',viewport:{width:1280,height:720},cpu:cpus()[0]?.model,ramGiB:totalmem()/2**30,network:{downloadMbps:10,uploadMbps:5,latencyMs:40,cacheDisabled:true},errors:[],samples:[]};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-background-timer-throttling']});report.browser=browser.version();
const page=await browser.newPage({viewport:report.viewport});page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:10e6/8,uploadThroughput:5e6/8});
const start=performance.now();await page.goto(report.url+'/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady,null,{timeout:90000});
report.coldAssetsReadyMs=performance.now()-start;
report.cold=await page.evaluate(()=>{const s=window.__game.scene,gl=s.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {bundle:[...document.scripts].find(x=>x.type==='module')?.src,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').pop(),transferBytes:r.transferSize,decodedBytes:r.decodedBodySize,durationMs:r.duration})),dpr:devicePixelRatio,quality:s.quality};});
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
await page.evaluate(()=>window.__game.startMission('mars','balanced'));await page.waitForFunction(()=>!window.__game.getState().pending&&!window.__game.scene.tween);await page.locator('[data-action="plan"]').first().click();await page.locator('[data-action="launch"]').click();await page.waitForSelector('#flight-time');await page.waitForTimeout(3000);
await page.evaluate(()=>{window.__game.scene.frameTimes=[];});
console.log(JSON.stringify({phase:'cold complete, beginning 120-second Mars flight sample',coldAssetsReadyMs:report.coldAssetsReadyMs,renderer:report.cold.renderer}));
for(let i=1;i<=6;i++){
 await page.waitForTimeout(20000);
 report.samples.push(await page.evaluate(()=>{const s=window.__game.scene,values=[...s.frameTimes].filter(Number.isFinite).sort((a,b)=>a-b),quantile=q=>values[Math.min(values.length-1,Math.floor(values.length*q))],memory=s.renderer.info.memory;return {frames:values.length,p50Ms:quantile(.5),p95Ms:quantile(.95),p99Ms:quantile(.99),over33ms:values.filter(x=>x>33.34).length,geometryCount:memory.geometries,textureCount:memory.textures,programCount:s.renderer.info.programs.length,drawCalls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,simulationTime:window.__game.getState().sim.time,jsHeapUsed:performance.memory?.usedJSHeapSize};}));
 writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({phase:'steady sample',seconds:i*20,...report.samples.at(-1)}));
}
report.steadyDurationSeconds=120;report.completed=true;writeFileSync(out,JSON.stringify(report,null,2));await page.screenshot({path:join(out,'..','performance-mars-120s.png')});await browser.close();
console.log(JSON.stringify({complete:true,artifact:out,errors:report.errors}));
