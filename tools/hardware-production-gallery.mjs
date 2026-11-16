import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output='docs/qa/hardware';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1600,height:1400},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 await page.goto((process.env.PLAYWRIGHT_BASE_URL||'http://127.0.0.1:4173')+'/?qa');await page.waitForFunction(()=>window.__game?.getState().assetsReady);
 await page.locator('[data-action="missions"]').first().click();await page.locator('[data-design-profile="hardware"]').click();await page.locator('[data-mission="earth"]').click();await page.waitForFunction(()=>!window.__game.scene.tween);
 const scripts=await page.locator('script[src]').evaluateAll(s=>s.map(e=>e.src));
 const result=await page.evaluate(()=>{
  const g=window.__game,s=g.scene,renderer=s.renderer,entries=[],d=structuredClone(g.getState().design);s.render=()=>{};
  const cloneOwned=object=>{const c=object.clone(true);c.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();const copy=m=>{const n=m.clone();for(const k of Object.keys(n))if(n[k]?.isTexture)n[k]=n[k].clone();return n;};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);}});c.position.set(0,0,0);c.quaternion.identity();c.scale.set(1,1,1);return c;};
  for(const [id,label] of [['surveyor-l18-v1','Surveyor L18'],['pathfinder-d35-v1','Pathfinder D35']]){d.busId=id;d.parts=[];g.setDesign(structuredClone(d));const group=cloneOwned(s.bus);group.traverse(o=>{if(o.userData.bayCover)o.visible=false;});entries.push({id,label,group,type:'bus'});}
  const models=[['tsp45-fixed-v2','solar','TSP-45 fixed array'],['tsp45-sixwing-v2','solarLarge','Six-wing array'],['bpx100-4s2p-v2','battery','BPX 100 Wh'],['bpx100-dual-v2','battery','Dual BPX'],['wide-mono-v2','camera','Wide camera'],['narrow-mono-v2','camera','Narrow camera'],['mars-spectra-v2','spectrometer','Mars spectrometer'],['ax100u-carrier-v1','radio','AX100U carrier'],['iris22-carrier-v1','radio','Iris carrier'],['uhf-dipole-pair-v1','antenna','UHF crossed dipoles'],['xband-reflector-1m-v1','antenna','X-band reflector'],['xact15-carrier-v1','adcs','XACT-15 carrier'],['xact50-carrier-v1','adcs','XACT-50 carrier'],['chemical230-v2','engine','Chemical engine'],['recorder-1p6-v2','storage','1.6 Gb recorder'],['recorder-8-v2','storage','8 Gb recorder']];
  for(const [id,kind,label] of models){d.parts=[{id:'audit',modelId:id,kind,face:['battery','radio','adcs','storage'].includes(kind)?'py':kind==='engine'?'ny':'pz',u:0,v:0,rotation:0}];g.setDesign(structuredClone(d));entries.push({id,label,type:kind,group:cloneOwned(s.parts.get('audit'))});}
  const scene=new s.scene.constructor(),Color=s.sun.color.constructor;scene.background=new Color('#dfe7e7');scene.environment=s.scene.environment;scene.environmentIntensity=.65;
  const hemi=s.hemi.clone();hemi.intensity=1.4;scene.add(hemi);const light=s.sun.clone();light.position.set(3,5,7);light.intensity=2.7;light.castShadow=false;scene.add(light);
  renderer.setPixelRatio(1);renderer.setSize(1600,1400);renderer.toneMappingExposure=1.25;renderer.setScissorTest(false);renderer.setClearColor('#dfe7e7',1);renderer.clear();renderer.setScissorTest(true);renderer.shadowMap.enabled=false;
  const canvas=renderer.domElement;Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',width:'1600px',height:'1400px',zIndex:'99999'});document.body.appendChild(canvas);
  const stats=[];
  for(let i=0;i<entries.length;i++){
   const item=entries[i];scene.add(item.group);item.group.updateMatrixWorld(true);const min=s.camera.position.clone().set(Infinity,Infinity,Infinity),max=min.clone().set(-Infinity,-Infinity,-Infinity);
   let triangles=0,meshes=0;item.group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=min.clone().set(x,y,z).applyMatrix4(o.matrixWorld);min.min(p);max.max(p);}}});
   const size=max.clone().sub(min),center=max.clone().add(min).multiplyScalar(.5),camera=new s.camera.constructor(37,400/280,size.length()*.02,size.length()*20),direction=s.camera.position.clone().set(...(item.type==='bus'?[1.1,1.5,1.7]:[.95,-.75,1.8]));camera.position.copy(center).addScaledVector(direction.normalize(),size.length()*1.9);camera.lookAt(center);
   const x=i%4*400,row=Math.floor(i/4),y=1400-(row+1)*280;renderer.setViewport(x,y,400,280);renderer.setScissor(x,y,400,280);renderer.render(scene,camera);
   const title=document.createElement('div');title.style.cssText=`position:fixed;z-index:100000;left:${x+12}px;top:${row*280+12}px;color:#16343c;font:600 14px Arial;background:#e6eeeecc;padding:5px 7px;border-radius:3px`;title.textContent=item.label;document.body.append(title);
   const subtitle=document.createElement('div');subtitle.style.cssText=`position:fixed;z-index:100000;left:${x+12}px;top:${row*280+251}px;color:#28545e;font:11px Arial`;subtitle.textContent=`${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)} m · fitted audit camera`;document.body.append(subtitle);
   stats.push({id:item.id,meshes,triangles,size:size.toArray()});scene.remove(item.group);
  }
  // Preserve the exact just-rendered buffer against app resize observers.
  const image=document.createElement('img');image.src=canvas.toDataURL();image.style.cssText='position:fixed;inset:0;width:1600px;height:1400px;z-index:99999';document.body.append(image);canvas.style.visibility='hidden';return stats;
 });
 await page.screenshot({path:`${output}/models-v2-production.png`});await writeFile(`${output}/models-v2-production.json`,JSON.stringify({browser:browser.version(),scripts,note:'Meshes extracted from frozen production, original scale; cameras individually fitted. This is not a performance measurement.',models:result,errors},null,2));console.log(JSON.stringify({models:result.length,errors,screenshot:`${output}/models-v2-production.png`}));
} finally {await browser.close();}

