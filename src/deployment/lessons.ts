import {createDeploymentCraft} from './craft';
import {createDeploymentPlan} from './plan';
import {DEPLOYMENT_HARDWARE_VERSION} from './devices';
/** Authored recovery challenge. Every battery, panel and scheduled operation is
 * a normal design input; the runtime receives no special energy or success rule. */
export function createDeploymentRecoveryLesson(){const craft=createDeploymentCraft(),plan=createDeploymentPlan(),panel=craft.parts.find(p=>p.id==='recovery')!;craft.name='FIRST LIGHT / ECLIPSE RECOVERY';craft.parts.push({...structuredClone(panel),id:'recovery-right',u:.4},{...structuredClone(panel),id:'recovery-left',u:-.4});plan.actions=[{id:'late-wing',partId:'wing',desired:'deployed',earliestSeconds:4700,deadlineSeconds:9500,rateProfileId:'normal'},{id:'late-array',partId:'antenna',desired:'deployed',earliestSeconds:4900,deadlineSeconds:10000,rateProfileId:'normal'}];plan.operations=[{id:'draining-contact',kind:'downlink',startSeconds:1800,endSeconds:5200,stationId:'station-a'},{id:'late-contact',kind:'downlink',startSeconds:5500,endSeconds:7500,stationId:'station-e'}];return {craft,plan};}
/** Repair is a real placement edit: move the passive guide along the bus face.
 * Both drafts retain its real mass, cost and actual collision/shadow geometry. */
export function createDeploymentClearanceLesson(repaired=false){const craft=createDeploymentCraft(),plan=createDeploymentPlan();craft.name='FIRST LIGHT / CABLE CLEARANCE';craft.parts.push({id:'cable-guide',definition:{catalog:DEPLOYMENT_HARDWARE_VERSION,modelId:'passive-cable-guide-v1'},face:'pz',u:.484,v:repaired?.70:.59,rotation:0});return {craft,plan};}
