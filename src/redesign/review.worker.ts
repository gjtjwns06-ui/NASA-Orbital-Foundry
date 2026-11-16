import {createReviewController} from './worker-controller';
const controller=createReviewController(response=>self.postMessage(response));
self.onmessage=event=>{void controller.handle(event.data);};
