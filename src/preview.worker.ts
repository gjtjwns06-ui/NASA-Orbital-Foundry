import {trajectory,previewMission,evaluateDesign} from './sim';
import type {Design} from './sim';
self.onmessage=(event:MessageEvent<{revision:number;design:Design}>)=>{
 const {revision,design}=event.data;
 try{const path=trajectory(design,400);const preview=previewMission(design);self.postMessage({revision,path,preview,evaluation:evaluateDesign(design)});}
 catch(error){self.postMessage({revision,error:error instanceof Error?error.message:String(error)});}
};
