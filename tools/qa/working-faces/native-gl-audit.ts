import type {Page} from '@playwright/test';

// Diagnostic instrumentation only. Calls the real native delete, records its
// error and creation context/generation, and never suppresses console warnings.
// Install before navigation so both the hidden campus and active transfer
// renderer are covered; an active-renderer-only probe misses shared ownership.
export async function installNativeDeletionAudit(page:Page){
 await page.addInitScript(()=>{
  const audit:any=(window as any).__allContextDeletionAudit={errors:[],contexts:[],contextLostNotifications:0};
  const wrapped=new WeakSet<object>(),owners=new WeakMap<object,any>();let serial=0;
  const original=HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).getContext=function(...args:any[]){
   const gl:any=(original as any).apply(this,args);
   if(!gl||!/^webgl2?$|experimental-webgl$/.test(String(args[0]))||wrapped.has(gl))return gl;
   wrapped.add(gl);const record={id:++serial,canvasId:this.id,generation:0,created:0,deletes:0,restores:0};audit.contexts.push(record);
   this.addEventListener('webglcontextrestored',()=>{record.generation++;record.restores++;});
   for(const kind of ['Texture','Framebuffer','Renderbuffer','Program','Buffer','VertexArray','Shader']){
    const createName='create'+kind,deleteName='delete'+kind;if(typeof gl[createName]!=='function')continue;
    const create=gl[createName].bind(gl),remove=gl[deleteName].bind(gl);
    gl[createName]=(...params:any[])=>{const object=create(...params);if(object)owners.set(object,{context:record.id,generation:record.generation,serial:++record.created,kind,createdAt:performance.now(),stack:new Error().stack});return object;};
    gl[deleteName]=(object:object)=>{
     const previous=gl.getError(),result=remove(object),error=gl.getError();record.deletes++;
     if(previous===gl.CONTEXT_LOST_WEBGL||error===gl.CONTEXT_LOST_WEBGL)audit.contextLostNotifications++;
     if((previous&&previous!==gl.CONTEXT_LOST_WEBGL)||(error&&error!==gl.CONTEXT_LOST_WEBGL))audit.errors.push({method:deleteName,context:record.id,canvasId:this.id,generation:record.generation,owner:owners.get(object)||null,previous,error,time:performance.now(),stack:new Error().stack});return result;
    };
   }
   return gl;
  };
 });
}
