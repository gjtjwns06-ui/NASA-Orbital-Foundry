import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

// Functional ownership audit only. Run after the exclusive timing window ends.
// Uses the real production UI; no renderer or simulation methods are replaced.
const output='docs/qa/hardware-art';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={prototypeOnly:true,browser:browser.version(),errors:[],checks:[],profiles:[]};
const check=(condition,label,data)=>{report.checks.push({label,passed:!!condition,data});if(!condition)throw new Error(label);};
let activePage;
try{
 for(const profile of ['hardware','legacy']){
  const page=activePage=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.setDefaultTimeout(90000);
  page.on('pageerror',error=>report.errors.push({profile,type:'page',message:error.message}));
  page.on('console',message=>{if(message.type()==='error')report.errors.push({profile,type:'console',message:message.text()});});
  await page.goto('http://127.0.0.1:4174/?qa');
  await page.waitForFunction(()=>window.__game?.getState().assetsReady);
  await page.locator('[data-action="missions"]').first().click();
  await page.locator(`[data-design-profile="${profile}"]`).click();
  await page.locator('[data-action="mission-transfer"]').click();
  await page.waitForFunction(()=>!window.__game.getState().pending&&!window.__game.scene.tween);
  const initial=await page.evaluate(()=>{
   const scene=window.__game.scene;
   const keys=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','bumpMap','aoMap','lightMap','displacementMap','envMap'];
   const collect=group=>{
    const geometries=new Set(),materials=new Set(),textures=new Set();
    group.traverse(object=>{if(!object.isMesh)return;geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const key of keys)if(material[key])textures.add(material[key]);}});
    return {geometries:[...geometries],materials:[...materials],textures:[...textures]};
   };
   const watch=resource=>{const state={uuid:resource.uuid,name:resource.name||'',count:0};resource.addEventListener('dispose',()=>state.count++);return state;};
   const originals=collect(scene.craft),records={};
   for(const key of Object.keys(originals))records[key]=originals[key].map(watch);
   window.__ownership={collect,watch,originals,records,cycles:[]};
   return {counts:Object.fromEntries(Object.entries(originals).map(([key,list])=>[key,list.length])),textures:records.textures.map(({uuid,name})=>({uuid,name})),resources:{...scene.renderer.info.memory,programs:scene.renderer.info.programs.length},design:window.__game.getState().design};
  });
  const evidence={profile,scripts:await page.locator('script[src]').evaluateAll(scripts=>scripts.map(script=>script.src)),initial,cycles:[]};
  report.profiles.push(evidence);
  const atlases=initial.textures.filter(texture=>texture.name.startsWith('original-hardware-'));
  check(profile==='hardware'?atlases.length===2:atlases.length===0,`${profile}: expected hardware atlas allocation`,atlases);
  await page.screenshot({path:`${output}/ownership-${profile}-before.png`});
  for(let cycle=0;cycle<(profile==='hardware'?3:1);cycle++){
   await page.locator('.tab[data-action="plan"]').click();
   await page.waitForFunction(()=>{const transfer=window.__game.transfer();return transfer&&!transfer.getState().pending&&transfer.getState().solution;});
   await page.locator('[data-transfer-action="view-mars"]').click();
   await page.waitForTimeout(150);
   const cloned=await page.evaluate(()=>{
    const audit=window.__ownership,scene=window.__game.transfer().scene,owned=audit.collect(scene.craft),record={};
    for(const key of Object.keys(owned))record[key]=owned[key].map(audit.watch);
    const aliases={materials:owned.materials.filter(value=>audit.originals.materials.includes(value)).length,textures:owned.textures.filter(value=>audit.originals.textures.includes(value)).length,geometries:owned.geometries.filter(value=>audit.originals.geometries.includes(value)).length};
    const sharedSources=owned.textures.filter(texture=>audit.originals.textures.some(original=>texture.source===original.source)).map(texture=>({uuid:texture.uuid,name:texture.name||''}));
    audit.cycles.push({owned,record});
    return {counts:Object.fromEntries(Object.entries(owned).map(([key,list])=>[key,list.length])),aliases,sharedSources,resources:{...scene.renderer.info.memory,programs:scene.renderer.info.programs.length}};
   });
   check(Object.values(cloned.aliases).every(count=>count===0),`${profile} cycle ${cycle+1}: transfer owns distinct geometry/material/texture objects`,cloned.aliases);
   check(cloned.sharedSources.length>0,`${profile} cycle ${cycle+1}: CPU sources are shared while texture objects differ`,cloned.sharedSources);
   if(profile==='hardware')check(cloned.sharedSources.filter(texture=>texture.name.startsWith('original-hardware-')).length===2,`hardware cycle ${cycle+1}: both atlas maps cloned`,cloned.sharedSources);
   if(profile==='hardware'&&cycle===1){
    const context=await page.evaluate(()=>{
     const scene=window.__game.transfer().scene,extension=scene.renderer.getContext().getExtension('WEBGL_lose_context');
     if(!extension)return null;
     const state=window.__ownership.context={lost:0,restored:0,environmentBefore:scene.environment.texture.uuid};
     scene.canvas.addEventListener('webglcontextlost',()=>state.lost++);
     scene.canvas.addEventListener('webglcontextrestored',()=>state.restored++);
     window.__ownership.extension=extension;extension.loseContext();return {supported:true};
    });
    check(context?.supported,'hardware: real transfer WebGL context loss is available');
    await page.waitForFunction(()=>window.__ownership.context.lost===1);
    await page.evaluate(()=>window.__ownership.extension.restoreContext());
    await page.waitForFunction(()=>window.__ownership.context.restored===1&&!window.__game.transfer().scene.lost);
    await page.waitForTimeout(250);
    evidence.context=await page.evaluate(()=>({...window.__ownership.context,environmentAfter:window.__game.transfer().scene.environment.texture.uuid}));
    check(evidence.context.environmentBefore!==evidence.context.environmentAfter,'hardware: PMREM environment regenerated after context restore',evidence.context);
    await page.screenshot({path:`${output}/ownership-transfer-restored.png`});
   }
   await page.locator('[data-transfer-action="edit"]').click();
   await page.waitForFunction(()=>!window.__game.transfer()&&window.__game.getState().mode==='build'&&!window.__game.getState().pending&&!window.__game.scene.tween);
   await page.waitForTimeout(100);
   const returned=await page.evaluate(()=>{
    const audit=window.__ownership,scene=window.__game.scene,current=audit.collect(scene.craft),last=audit.cycles.at(-1);
    return {originalDisposeEvents:structuredClone(audit.records),ownedDisposeEvents:structuredClone(last.record),originalsRetained:Object.fromEntries(Object.keys(current).map(key=>[key,audit.originals[key].every(value=>current[key].includes(value))])),resources:{...scene.renderer.info.memory,programs:scene.renderer.info.programs.length}};
   });
   const originalDisposed=Object.entries(returned.originalDisposeEvents).flatMap(([kind,records])=>records.filter(record=>record.count!==0).map(record=>({kind,...record})));
   const missingOwnedDisposal=Object.entries(returned.ownedDisposeEvents).flatMap(([kind,records])=>records.filter(record=>record.count!==1).map(record=>({kind,...record})));
   check(originalDisposed.length===0,`${profile} cycle ${cycle+1}: original assembly receives zero dispose events`,originalDisposed);
   check(missingOwnedDisposal.length===0,`${profile} cycle ${cycle+1}: every owned transfer resource disposed exactly once`,missingOwnedDisposal);
   check(Object.values(returned.originalsRetained).every(Boolean),`${profile} cycle ${cycle+1}: assembly reuses its original resources`,returned.originalsRetained);
   evidence.cycles.push({cloned,returned});
  }
  if(profile==='hardware'){
   const resources=evidence.cycles.map(cycle=>cycle.returned.resources);
   check(resources.every(value=>value.geometries===resources[0].geometries&&value.textures===resources[0].textures&&value.programs===resources[0].programs),'hardware: assembly GPU counts remain stable across three transfer cycles',resources);
   const radioId=initial.design.parts.find(part=>part.kind==='radio')?.id;
   if(radioId){await page.evaluate(id=>{window.__game.scene.setSelected(id);window.__game.scene.cb.select(id);},radioId);await page.keyboard.press('f');await page.waitForFunction(()=>!window.__game.scene.tween);await page.screenshot({path:`${output}/ownership-radio-after.png`});}
  }
  await page.screenshot({path:`${output}/ownership-${profile}-after.png`});
  await page.close();activePage=null;
 }
 check(report.errors.length===0,'no page or console errors',report.errors);
 report.completed=true;
}catch(error){report.completed=false;report.failure=error.stack;await activePage?.screenshot({path:`${output}/ownership-failure.png`}).catch(()=>{});throw error;}
finally{await browser.close();await writeFile(`${output}/ownership-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({completed:report.completed,checks:report.checks.length,profiles:report.profiles.map(({profile,cycles})=>({profile,cycles:cycles.length})),errors:report.errors,failure:report.failure}));}
