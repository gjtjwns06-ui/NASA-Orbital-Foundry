import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output='docs/qa/hardware';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1600,height:1400},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/__hardware-art-audit.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#10262f"></body></html>'}));
await page.goto('http://127.0.0.1:5173/__hardware-art-audit.html');
const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');
  const {RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
  const {createBus,createPart}=await import('/src/render/parts.ts');
  const {BUSES,HARDWARE_MODELS}=await import('/src/hardware/index.ts');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1600,1400);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;document.body.append(renderer.domElement);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dfE7e7');scene.environment=environment.texture;scene.environmentIntensity=.65;
  scene.add(new THREE.HemisphereLight(0xe9f6ff,0x76868b,1.4));const light=new THREE.DirectionalLight(0xffefdb,2.7);light.position.set(3,5,7);scene.add(light);
  const design={version:1,hardwareVersion:'hardware-2.0.0',busId:'pathfinder-d35-v1',missionId:'earth',name:'Art audit',parts:[],seed:1,plan:{}};
  const entries=[...Object.entries(BUSES).map(([id,d])=>({id,label:d.nameEn,group:createBus({...design,busId:id}),type:'bus'})),...Object.entries(HARDWARE_MODELS).map(([id,d])=>({id,label:d.nameEn,group:createPart({id:'a',modelId:id,kind:d.kind,face:'py',u:0,v:0,rotation:0},design),type:d.kind}))];
  const stats=[];renderer.setScissorTest(true);
  for(let i=0;i<entries.length;i++){
    const item=entries[i];scene.add(item.group);
    if(item.type==='bus')item.group.traverse(o=>{if(o.userData.bayCover)o.visible=false;});
    const bounds=new THREE.Box3().setFromObject(item.group),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const camera=new THREE.PerspectiveCamera(37,400/280,.0001,100);
    const direction=item.type==='bus'?new THREE.Vector3(1.1,1.5,1.7):new THREE.Vector3(.95,-.75,1.8);
    camera.position.copy(center).addScaledVector(direction.normalize(),size.length()*1.9);camera.lookAt(center);
    const x=i%4*400,y=1400-(Math.floor(i/4)+1)*280;
    renderer.setViewport(x,y,400,280);renderer.setScissor(x,y,400,280);renderer.render(scene,camera);
    const title=document.createElement('div');title.style.cssText=`position:absolute;left:${x+12}px;top:${Math.floor(i/4)*280+12}px;color:#16343c;font:600 14px Arial;background:#e6eeeecc;padding:5px 7px;border-radius:3px`;title.textContent=item.label;document.body.append(title);
    const subtitle=document.createElement('div');subtitle.style.cssText=`position:absolute;left:${x+12}px;top:${Math.floor(i/4)*280+251}px;color:#28545e;font:11px Arial`;subtitle.textContent=`${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)} m · camera fitted for audit`;document.body.append(subtitle);
    let triangles=0,meshes=0;item.group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
    stats.push({id:item.id,meshes,triangles,size:size.toArray()});scene.remove(item.group);
  }
  window.__hardwareAudit={renderer,scene,entries,environment};return stats;
});
await page.screenshot({path:`${output}/models-v2.png`});
await writeFile(`${output}/models-v2.json`,JSON.stringify({browser:await browser.version(),note:'Independent model thumbnails with fitted cameras, not a performance measurement or in-game size comparison.',models:result,errors},null,2));
await browser.close();console.log(JSON.stringify({models:result.length,errors,screenshot:`${output}/models-v2.png`}));
