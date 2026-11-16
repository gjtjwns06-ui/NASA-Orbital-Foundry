import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const assetDir='public/assets/hardware',dataDir='public/data',proofDir='docs/qa/hardware-art';
await Promise.all([mkdir(assetDir,{recursive:true}),mkdir(proofDir,{recursive:true})]);
const catalogue=JSON.parse(await readFile(`${dataDir}/hardware-catalog-v2.json`,'utf8'));
const source=(await readFile('src/render/parts.ts','utf8')).replace(/\r\n/g,'\n'),renderSourceSha256=createHash('sha256').update(source).digest('hex');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:4174/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady);
 await page.locator('[data-action="missions"]').first().click();await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await page.locator('[data-action="preset-balanced"]').click();await page.waitForFunction(()=>!window.__game.getState().pending&&!window.__game.scene.tween);
 await page.screenshot({path:`${proofDir}/closed-bus-final-default.png`});
 const scripts=await page.locator('script[src]').evaluateAll(s=>s.map(e=>e.src));
 const result=await page.evaluate(()=>{
  const g=window.__game,s=g.scene,renderer=s.renderer,d=structuredClone(g.getState().design),entries=[];s.render=()=>{};
  const models=[['tsp45-fixed-v2','solar'],['tsp45-sixwing-v2','solarLarge'],['bpx100-4s2p-v2','battery'],['bpx100-dual-v2','battery'],['wide-mono-v2','camera'],['narrow-mono-v2','camera'],['mars-spectra-v2','spectrometer'],['ax100u-carrier-v1','radio'],['iris22-carrier-v1','radio'],['uhf-dipole-pair-v1','antenna'],['xband-reflector-1m-v1','antenna'],['xact15-carrier-v1','adcs'],['xact50-carrier-v1','adcs'],['chemical230-v2','engine'],['recorder-1p6-v2','storage'],['recorder-8-v2','storage']];
  for(const [modelId,kind] of models){
   d.busId='pathfinder-d35-v1';d.parts=[{id:'thumbnail',modelId,kind,face:['battery','radio','adcs','storage'].includes(kind)?'py':kind==='engine'?'ny':'pz',u:0,v:0,rotation:0}];g.setDesign(structuredClone(d));
   const group=s.parts.get('thumbnail').clone(true);group.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();const clone=m=>{const copy=m.clone();for(const key of Object.keys(copy))if(copy[key]?.isTexture)copy[key]=copy[key].clone();return copy;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}});group.position.set(0,0,0);group.quaternion.identity();group.scale.set(1,1,1);entries.push({modelId,group});
  }
  const scene=new s.scene.constructor();scene.environment=s.scene.environment;scene.environmentIntensity=.72;scene.background=null;
  const hemi=s.hemi.clone();hemi.intensity=1.55;scene.add(hemi);const key=s.sun.clone();key.castShadow=false;key.intensity=2.6;key.position.set(3,5,7);scene.add(key);
  // Render into an RGBA target: the game's opaque default canvas cannot export
  // transparent pixels. No physical mesh scale/material is changed for the tile.
  const target=new s.environmentTarget.constructor(2048,2048,{depthBuffer:true,stencilBuffer:false,samples:0});target.texture.colorSpace=renderer.outputColorSpace;
  renderer.setPixelRatio(1);renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.clear();renderer.setScissorTest(true);renderer.autoClear=false;renderer.shadowMap.enabled=false;renderer.toneMappingExposure=1.2;
  const statistics=[];
  for(let i=0;i<entries.length;i++){
   const entry=entries[i];scene.add(entry.group);entry.group.updateMatrixWorld(true);const min=s.camera.position.clone().set(Infinity,Infinity,Infinity),max=min.clone().set(-Infinity,-Infinity,-Infinity);let meshes=0,triangles=0;
   entry.group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=min.clone().set(x,y,z).applyMatrix4(o.matrixWorld);min.min(p);max.max(p);}}});
   const size=max.clone().sub(min),center=max.clone().add(min).multiplyScalar(.5),camera=new s.camera.constructor(35,1,size.length()*.02,size.length()*20);camera.position.copy(center).addScaledVector(s.camera.position.clone().set(.95,-.75,1.8).normalize(),size.length()*1.8);camera.lookAt(center);
   const x=i%4*512,y=2048-(Math.floor(i/4)+1)*512;renderer.setViewport(x,y,512,512);renderer.setScissor(x,y,512,512);renderer.render(scene,camera);scene.remove(entry.group);statistics.push({modelId:entry.modelId,meshes,triangles,sizeMetres:size.toArray()});
  }
  const pixels=new Uint8Array(2048*2048*4);renderer.readRenderTargetPixels(target,0,0,2048,2048,pixels);
  const raw=document.createElement('canvas');raw.width=raw.height=2048;const rawContext=raw.getContext('2d'),rawImage=rawContext.createImageData(2048,2048);
  for(let y=0;y<2048;y++)rawImage.data.set(pixels.subarray((2047-y)*2048*4,(2048-y)*2048*4),y*2048*4);
  rawContext.putImageData(rawImage,0,0);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const context=canvas.getContext('2d');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(raw,0,0,1024,1024);
  const rgba=context.getImageData(0,0,1024,1024).data,tileCoverage=new Array(16).fill(0);let transparentPixels=0;
  for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){if(rgba[(y*1024+x)*4+3]===0)transparentPixels++;else tileCoverage[Math.floor(y/256)*4+Math.floor(x/256)]++;}
  renderer.setRenderTarget(null);target.dispose();
  return {data:canvas.toDataURL('image/webp',.9),models:models.map(m=>m[0]),statistics,transparentPixels,tileCoverage};
 });
 const bytes=Buffer.from(result.data.split(',')[1],'base64');if(bytes.length>400*1024)throw new Error('Thumbnail atlas exceeds400KiB.');if(result.models.length!==16||new Set(result.models).size!==16||result.tileCoverage.some(n=>n<100)||result.transparentPixels<500000)throw new Error('Incomplete or nontransparent atlas.');
 await writeFile(`${assetDir}/library-v3.webp`,bytes);
 const metadata={version:1,catalogHash:catalogue.sha256,image:'/assets/hardware/library-v3.webp',columns:4,rows:4,tileSizePx:256,models:result.models,renderSourceSha256};
 await writeFile(`${dataDir}/hardware-thumbnails-v3.json`,JSON.stringify(metadata,null,2));
 const proof={browser:browser.version(),scripts,source:'src/render/parts.ts normalized LF UTF-8',renderSourceSha256,tool:'tools/generate-hardware-thumbnails.mjs',originalProceduralModels:true,externalImagesOrAI:false,width:1024,height:1024,format:'WebP',alpha:true,sampling:'2x opaque 3D render with transparent background, canvas downsample; no MSAA gamma unpremultiplication',bytes:bytes.length,quality:.9,transparentPixels:result.transparentPixels,tileCoverage:result.tileCoverage,models:result.statistics,errors};
 await writeFile(`${proofDir}/thumbnail-provenance.json`,JSON.stringify(proof,null,2));
 console.log(JSON.stringify({models:16,bytes:bytes.length,transparentPixels:result.transparentPixels,errors,metadata:`${dataDir}/hardware-thumbnails-v3.json`}));
}finally{await browser.close();}

