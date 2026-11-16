import {createDeploymentController} from './deployment-worker-controller';
const controller=createDeploymentController(message=>self.postMessage(message));
self.onmessage=event=>{void controller.handle(event.data);};
