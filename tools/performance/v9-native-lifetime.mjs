// Read-only native allocation observer inherited from the accepted v8 retained-flight harness.
export async function installNativeLifetimeAudit(page){
 await page.addInitScript(()=>{
  const contexts=new WeakMap(),original=HTMLCanvasElement.prototype.getContext;let contextId=0,objectId=0;
  window.__nativeLifetimeSnapshot=gl=>{const record=contexts.get(gl);return record?{contextId:record.id,kinds:Object.fromEntries(Object.entries(record.kinds).map(([name,k])=>[name,{created:k.created,deleted:k.deleted,liveIds:[...k.live].sort((a,b)=>a-b)}]))}:null;};
  HTMLCanvasElement.prototype.getContext=function(...args){
   const gl=original.apply(this,args);if(!gl||!/^webgl2?$|experimental-webgl$/.test(String(args[0]))||contexts.has(gl))return gl;
   const record={id:++contextId,kinds:{}};contexts.set(gl,record);
   for(const name of ['Buffer','VertexArray','Program','Shader','Texture','Framebuffer','Renderbuffer']){
    if(!gl['create'+name])continue;
    const create=gl['create'+name].bind(gl),remove=gl['delete'+name].bind(gl),ids=new WeakMap(),kind=record.kinds[name]={created:0,deleted:0,live:new Set()};
    gl['create'+name]=(...params)=>{const object=create(...params);if(object){const id=++objectId;ids.set(object,id);kind.live.add(id);kind.created++;}return object;};
    gl['delete'+name]=object=>{const result=remove(object),id=object&&ids.get(object);if(id&&kind.live.delete(id))kind.deleted++;return result;};
   }
   return gl;
  };
 });
}
