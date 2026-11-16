import type {Texture} from 'three';

type TextureStatus='idle'|'loading'|'ready'|'error'|'disposed';
type Options={load:()=>Promise<Texture>;validate:(texture:Texture)=>void;configure:(texture:Texture)=>void;changed:()=>void};

export type MarsSurfaceEligibility={hasSolution:boolean;inspectionEnabled:boolean;phase:string|null;view:string;phasePreview:boolean;contextLost:boolean;quality:string;maxTextureSize:number};
/** Preview cameras and lower settings deliberately keep the original small map. */
export function shouldLoadMarsSurfaceDetail(state:MarsSurfaceEligibility){
  return state.hasSolution&&state.inspectionEnabled&&state.phase==='mars-flyby'&&state.view==='mars'&&!state.phasePreview&&!state.contextLost&&state.quality==='high'&&state.maxTextureSize>=4096;
}

/** One renderer-owned texture. Switching views does not start duplicate loads;
 * a resolved request after disposal releases its own texture exactly once. */
export class LazySurfaceTexture {
  private status:TextureStatus='idle';
  private eligible=false;
  private owned:Texture|null=null;
  private requestCount=0;
  private generation=0;
  private error:string|null=null;
  constructor(private options:Options){}
  get texture(){return this.owned;}
  get activeTexture(){return this.eligible&&this.status==='ready'?this.owned:null;}
  setEligible(eligible:boolean) {
    if(this.status==='disposed')return;
    this.eligible=eligible;
    if(eligible&&this.status==='idle')this.start();
  }
  private start() {
    this.status='loading';this.requestCount++;const generation=++this.generation;
    this.options.changed();
    void Promise.resolve().then(()=>this.options.load()).then(texture=>{
      if(this.status==='disposed'||generation!==this.generation){texture.dispose();return;}
      try {this.options.validate(texture);this.options.configure(texture);}
      catch(error){texture.dispose();this.fail(error);return;}
      this.owned=texture;this.status='ready';this.options.changed();
    },error=>{
      if(this.status!=='disposed'&&generation===this.generation)this.fail(error);
    });
  }
  private fail(error:unknown){
    this.error=error instanceof Error?error.message:String(error);this.status='error';this.options.changed();
  }
  markContextRestored(){if(this.owned)this.owned.needsUpdate=true;}
  getState(){
    const image=this.owned?.image as {width?:number;height?:number}|undefined;
    return {status:this.status,eligible:this.eligible,active:!!this.activeTexture,cached:!!this.owned,requestCount:this.requestCount,
      width:image?.width??null,height:image?.height??null,error:this.error};
  }
  dispose(){
    if(this.status==='disposed')return;
    this.status='disposed';this.eligible=false;this.generation++;
    this.owned?.dispose();this.owned=null;
  }
}
