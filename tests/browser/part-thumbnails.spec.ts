import {test as base,expect,type Page,type Locator} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const candidate=process.env.PLAYWRIGHT_QA_CANDIDATE||'candidate-7b-benchmark';
if(!/^[a-z0-9-]+$/.test(candidate))throw new Error('Invalid QA artifact candidate label');
const artifacts=join(process.cwd(),'tests/browser/artifacts',candidate,'thumbnail-layout');
mkdirSync(artifacts,{recursive:true});
const test=base.extend<{errors:string[]}>({errors:[async({page},use,info)=>{
  const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  await use(errors);
  const evidence={title:info.title,status:info.status,browser:page.context().browser()?.version(),url:page.url(),viewport:page.viewportSize(),scripts:await page.locator('script[src]').evaluateAll(es=>es.map(e=>(e as HTMLScriptElement).src)).catch(()=>[]),errors,scope:'Assembly-only KO/EN × normal/large at1280×720;initial visible toast and guide maintain8px clearance before4s expiry;16 CSS atlas tiles/card reachability;real optical-camera drag/F focus. No flight/performance/full-accessibility claim.'};
  writeFileSync(join(artifacts,info.title.replace(/[^a-zA-Z0-9]+/g,'-')+'.json'),JSON.stringify(evidence,null,2));
  await info.attach('thumbnail-layout-evidence',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
  if(info.status!==info.expectedStatus)await page.screenshot({path:info.outputPath('failure.png'),fullPage:true}).catch(()=>{});
  expect(errors).toEqual([]);
},{auto:true}]});
test.use({viewport:{width:1280,height:720},actionTimeout:12000});
const getState=(page:Page)=>page.evaluate(()=>(window as any).__game.getState());
const act=(page:Page,name:string)=>page.locator(`[data-action="${name}"]`).first().click();
async function ready(page:Page){await page.waitForFunction(()=>{const g=(window as any).__game,s=g.getState();return !s.pending&&s.acceptedRevision===s.revision&&!g.scene.tween;},null,{timeout:45000});}
async function reachable(locator:Locator){
  await locator.scrollIntoViewIfNeeded();await expect(locator).toBeVisible();
  const r=await locator.evaluate(el=>{
    const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2),clipped:string[]=[];
    for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),q=p===document.body||p===document.documentElement?{left:0,top:0,right:innerWidth,bottom:innerHeight}:p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(b.top<q.top-1||b.bottom>q.bottom+1))clipped.push(`${p.className}:y`);if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(b.left<q.left-1||b.right>q.right+1))clipped.push(`${p.className}:x`);}
    return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,hit:hit===el||el.contains(hit),clipped};
  });
  expect(r.left).toBeGreaterThanOrEqual(-1);expect(r.right).toBeLessThanOrEqual(1281);expect(r.top).toBeGreaterThanOrEqual(-1);expect(r.bottom).toBeLessThanOrEqual(721);expect(r.hit).toBe(true);expect(r.clipped).toEqual([]);
  return r;
}

for(const language of ['ko','en'] as const)for(const scale of ['normal','large'] as const){
  test(`${language}-${scale} assembly thumbnails and optical-camera pointer focus remain usable`,async({page})=>{
    test.setTimeout(90000);const prefix=`${language}-${scale}`;
    await page.addInitScript(lang=>localStorage.setItem('orbital-language',lang),language);
    await page.goto('/?qa');await page.waitForFunction(()=>Boolean((window as any).__game?.getState().assetsReady));
    await act(page,'settings');await page.locator('#ui-scale').selectOption(scale);await act(page,'close-modal');
    await act(page,'missions');await page.locator('[data-design-profile="hardware"]').click();
    const missionClickedAt=await page.evaluate(()=>performance.now());
    await page.locator('[data-mission="earth"]').click();
    // Measure the real initial notification while it is still displayed. Never
    // hide it or wait for the four-second expiry to make the layout pass.
    await expect(page.locator('#toast-root .toast')).toBeVisible({timeout:2000});
    await expect(page.locator('.assembly-guide')).toBeVisible({timeout:2000});
    const initialNotice=await page.evaluate(start=>{
      const box=(selector:string)=>{const el=document.querySelector<HTMLElement>(selector)!;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,text:el.innerText,visible:r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0};};
      const toast=box('#toast-root .toast'),guide=box('.assembly-guide');
      return {elapsedFromMissionClickMs:performance.now()-start,toast,guide,gapPx:guide.top-toast.bottom};
    },missionClickedAt);
    writeFileSync(join(artifacts,`${prefix}-initial-toast-guide.json`),JSON.stringify(initialNotice,null,2));
    await page.screenshot({path:join(artifacts,`${prefix}-initial-toast-guide.png`)});
    expect(initialNotice.elapsedFromMissionClickMs).toBeLessThan(4000);expect(initialNotice.toast.visible).toBe(true);expect(initialNotice.guide.visible).toBe(true);
    expect(initialNotice.toast.text).toContain(language==='ko'?'부품 선반에서':'Drag hardware from the library');
    expect(initialNotice.gapPx,'visible toast bottom must be at least8px above the visible guide top').toBeGreaterThanOrEqual(8);
    await ready(page);
    await page.evaluate(()=>document.fonts.ready);await page.locator('[data-category="all"]').click();
    expect((await getState(page)).design.parts).toHaveLength(0);
    expect(await page.locator('body').evaluate(e=>e.classList.contains('large-ui'))).toBe(scale==='large');
    const response=await page.request.get('/data/hardware-thumbnails-v3.json');expect(response.ok()).toBe(true);const atlas=await response.json();
    expect(atlas.models).toHaveLength(16);expect(new Set(atlas.models).size).toBe(16);expect(atlas.catalogHash).toBe('25a47f24340365b5b52d62708ce987f7a90df4ee6559879b91464a2d24ae9a98');
    await expect(page.locator('.part-card[data-model]')).toHaveCount(16);await expect(page.locator('[data-model-thumb]')).toHaveCount(16);
    const decoded=await page.locator('[data-model-thumb]').evaluateAll(async els=>{
      const urls=[...new Set(els.map(e=>getComputedStyle(e).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1]))];
      return Promise.all(urls.map(async url=>{if(!url)throw new Error('Missing CSS thumbnail URL');const image=new Image();image.src=url;await image.decode();return {url,width:image.naturalWidth,height:image.naturalHeight,complete:image.complete};}));
    });
    expect(decoded).toHaveLength(1);expect(decoded[0]).toMatchObject({width:1024,height:1024,complete:true});expect(decoded[0].url).toContain('/assets/hardware/library-v3.webp');
    const cards=[];
    for(let i=0;i<atlas.models.length;i++){
      const id=atlas.models[i],card=page.locator(`.part-card[data-model="${id}"]`),bounds=await reachable(card);
      const facts=await card.evaluate(el=>{
        const thumb=el.querySelector<HTMLElement>('[data-model-thumb]')!,s=getComputedStyle(thumb),b=thumb.getBoundingClientRect(),name=el.querySelector<HTMLElement>('strong')!,n=name.getBoundingClientRect();
        return {id:(el as HTMLElement).dataset.model,thumbId:thumb.dataset.modelThumb,background:s.backgroundImage,size:s.backgroundSize,x:parseFloat(s.backgroundPositionX),y:parseFloat(s.backgroundPositionY),width:b.width,height:b.height,pointerEvents:s.pointerEvents,thumbHit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.part-card')===el,name:name.innerText,nameInside:n.left>=el.getBoundingClientRect().left&&n.right<=el.getBoundingClientRect().right+1,nameOverflow:name.scrollWidth>name.clientWidth+1,aria:el.getAttribute('aria-label')};
      });
      expect(facts.thumbId).toBe(id);expect(facts.size).toBe('400% 400%');expect(facts.x).toBeCloseTo((i%4)/3*100,3);expect(facts.y).toBeCloseTo(Math.floor(i/4)/3*100,3);
      expect(facts.width).toBe(40);expect(facts.height).toBe(40);expect(facts.pointerEvents).toBe('none');expect(facts.thumbHit).toBe(true);expect(facts.nameInside).toBe(true);expect(facts.nameOverflow,id+' name fits card').toBe(false);expect(facts.name.trim()).not.toBe('');expect(facts.aria).toBeTruthy();
      if(language==='en'){expect(facts.name).not.toMatch(/[가-힣]/);expect(facts.aria).not.toMatch(/[가-힣]/);}
      expect(facts.name).not.toMatch(/\uFFFD|\bundefined\b|\bNaN\b/);cards.push({bounds,...facts});
    }
    for(const action of ['hardware-buses','hardware-connections','camera-reset','camera-focus','view-front','view-top','view-side'])await reachable(page.locator(`[data-action="${action}"]`).first());
    await reachable(page.locator('.deck-action [data-action="plan"]'));
    const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth<=innerWidth+1,body:document.body.scrollWidth<=innerWidth+1}));expect(overflow).toEqual({document:true,body:true});
    await page.locator('.part-card[data-model]').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:join(artifacts,`${prefix}-assembly.png`)});

    // Exercise the real CSS-thumbnail hit target, placement ray and new camera geometry.
    await act(page,'view-front');await ready(page);
    const card=page.locator('[data-model="wide-mono-v2"]');await reachable(card);const thumbnail=await card.locator('[data-model-thumb]').boundingBox();expect(thumbnail).toBeTruthy();
    const target=await page.evaluate(()=>{const s=(window as any).__game.scene;return s.project(s.craft.position.clone().add({x:0,y:-.25,z:.65}));});
    expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.id,target)).toBe('universe');
    await page.mouse.move(thumbnail!.x+thumbnail!.width/2,thumbnail!.y+thumbnail!.height/2);await page.mouse.down();await page.mouse.move(target.x,target.y,{steps:18});await page.mouse.up();
    await expect.poll(async()=>(await getState(page)).design.parts.length).toBe(1);await ready(page);
    const part=(await getState(page)).design.parts[0];expect(part.modelId).toBe('wide-mono-v2');expect(part.face).toBe('pz');
    const beforeFocusDistance=await page.evaluate(()=>(window as any).__game.scene.controls.getDistance());
    await page.keyboard.press('f');await ready(page);
    const focus=await page.evaluate(id=>{
      const s=(window as any).__game.scene,group=s.parts.get(id),points:any[]=[];
      group.updateWorldMatrix(true,true);group.traverse((object:any)=>{if(!object.isMesh||!object.geometry)return;if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();const b=object.geometry.boundingBox;if(!b)return;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=b.min.clone().set(x,y,z).applyMatrix4(object.matrixWorld);points.push(s.project(p));}});
      const center=s.getPartScreen(id);return {id:s.selection,model:group.userData.hardwareModelId,distance:s.controls.getDistance(),minDistance:s.controls.minDistance,center,centerHit:document.elementFromPoint(center.x,center.y)?.id,bounds:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}};
    },part.id);
    // Fit distance is model-size dependent. Assert a real zoom and the complete
    // projected mesh, rather than borrowing the smaller radio's <1 m limit.
    expect(focus.id).toBe(part.id);expect(focus.model).toBe('wide-mono-v2');expect(focus.distance).toBeLessThan(beforeFocusDistance*.5);expect(focus.centerHit).toBe('universe');expect(focus.bounds.left).toBeGreaterThan(0);expect(focus.bounds.right).toBeLessThan(1280);expect(focus.bounds.top).toBeGreaterThan(0);expect(focus.bounds.bottom).toBeLessThan(720);
    await page.screenshot({path:join(artifacts,`${prefix}-optical-camera-focused.png`)});
    writeFileSync(join(artifacts,`${prefix}-details.json`),JSON.stringify({language,scale,initialNotice,atlas,decoded,cards,overflow,part,beforeFocusDistance,focus},null,2));
  });
}
