import type {ActuatorProfile,JointDefinition,LocalBox,MechanismTopology,Pose,RigidLinkDefinition,Vec3} from './types';
import {add,conjugate,freeze,rotate,sub} from './math';
import {compileTopology,initialJointStates,resolveDeploymentGeometry,uniformBoxMass} from './kinematics';
export const DEPLOYMENT_HARDWARE_VERSION='deployment-hardware-1.0.0' as const;
export const BASE_HARDWARE_CATALOG_HASH='25a47f24340365b5b52d62708ce987f7a90df4ee6559879b91464a2d24ae9a98';
/** Original passive cable-routing support; not a vendor flight component. Its
 * top arm can obstruct a nearby unfolding panel despite clear end poses. */
export const PASSIVE_CABLE_GUIDE=freeze({modelId:'passive-cable-guide-v1',massKg:.15,cost:3,boxes:[{id:'stem',centerM:[0,0,.17] as Vec3,halfM:[.006,.006,.17] as Vec3,renderRole:'support' as const},{id:'routing-arm',centerM:[.011,-.020,.34] as Vec3,halfM:[.017,.026,.006] as Vec3,renderRole:'support' as const}],provenance:'game-assumption',authored:['all dimensions','uniform proxy mass distribution','credit cost','passive cable support; no powered or RF function']});
/** Original regulated reversible drives. Rates/power are authored, not a motor
 * manufacturer torque-speed curve; independent mechanical feasibility required. */
export const ACTUATOR_PROFILES:Readonly<Record<string,ActuatorProfile>>=freeze({
 gentle:{id:'gentle',maximumRateRadS:Math.PI/180,accelerationRadS2:Math.PI/720,brakeDecelerationRadS2:Math.PI/180,activePowerW:4,releaseSeconds:1,releasePowerW:1,latchSeconds:2,latchPowerW:.5,provenance:'game-assumption'},
 normal:{id:'normal',maximumRateRadS:Math.PI/45,accelerationRadS2:Math.PI/120,brakeDecelerationRadS2:Math.PI/45,activePowerW:6,releaseSeconds:1,releasePowerW:1,latchSeconds:2,latchPowerW:.5,provenance:'game-assumption'}
});
export interface ArticulatedDevice {id:string;kind:'solar'|'rf';topology:MechanismTopology;deployJointOrder:string[];stowJointOrder:string[];interlock:'verified-all-joints';massKg:number;provenance:{sourceRating:string;authored:string[]}}
const identity=():Pose=>({positionM:[0,0,0],quaternion:[0,0,0,1]});
const box=(id:string,centerM:Vec3,halfM:Vec3,renderRole:LocalBox['renderRole'],contactRole?:LocalBox['contactRole']):LocalBox=>({id,centerM,halfM,renderRole,...(contactRole?{contactRole}:{})});
/** Original three-leaf topology. Hinge supports are physical volumes, not
 * blanket collision exemptions. Only pin-to-bearing contacts are exempted.
 * Dimensions/mass distribution are authored, never represented as vendor CAD. */
export function createArticulatedDevice(id:string,kind:'solar'|'rf',rootPose:Pose=identity()):ArticulatedDevice {
 const solar=kind==='solar',halfX=solar?.47:.10,halfY=solar?.104:.17,halfZ=solar?.012:.006,pivotX=halfX+.014,baseMass=solar?.885:.30,frameMass=solar?.20:.10,mechanismMass=solar?.25:.20,topology:MechanismTopology={version:'deployment-geometry-1',links:[],joints:[],contactExemptions:[]},rootId=id+':centre',lowerId=id+':lower',upperId=id+':upper';
 const panel=(linkId:string,variant:string):RigidLinkDefinition=>({id:linkId,partId:id,boxes:[box('substrate',[0,0,0],[halfX,halfY,halfZ],'panel-substrate')],massElements:[uniformBoxMass('panel-mass',baseMass,[0,0,0],[halfX,halfY,halfZ])],apertures:[{id:linkId+':aperture',centerM:[0,0,halfZ],normal:[0,0,1],tangentU:[1,0,0],tangentV:[0,1,0],widthM:halfX*2,heightM:halfY*2,kind,emittingBoxId:'substrate',...(solar?{peakPowerW:45}:{})}],render:{family:'panel',variant}});
 const centre=panel(rootId,solar?'authored-pv45-leaf':'authored-xband-array-leaf');centre.rootPose=structuredClone(rootPose);centre.massElements.push(uniformBoxMass('frame',frameMass,[0,0,0],[halfX,halfY,halfZ]));topology.links.push(centre);
 for(const [name,linkId,side,height,stowed] of [['lower',lowerId,1,.022,-Math.PI],['upper',upperId,-1,.046,Math.PI]] as const){const leaf=panel(linkId,solar?'authored-pv45-leaf':'authored-xband-array-leaf'),parentPivot:Vec3=[side*pivotX,0,height],childPivot:Vec3=[-side*pivotX,0,height],jointId=id+':'+name+'-hinge',joint:JointDefinition={id:jointId,partId:id,parentLinkId:rootId,childLinkId:linkId,pivotParentM:parentPivot,axisParent:[0,1,0],pivotChildM:childPivot,restQuaternion:[0,0,0,1],minimumRad:Math.min(0,stowed),maximumRad:Math.max(0,stowed),stowedRad:stowed,deployedRad:0};
  const rootBoxStart=centre.boxes.length,footMin=halfX-.02,footMax=pivotX+.005,footCenter=(footMin+footMax)/2,footHalf=(footMax-footMin)/2,columnCenter=(.006+height-.008)/2,columnHalf=(height-.008-.006)/2;
  for(const y of [-.072,.072]){centre.boxes.push(box(name+'-parent-foot-'+y,[side*footCenter,y,.007],[footHalf,.020,.003],'support'));centre.boxes.push(box(name+'-parent-column-'+y,[side*pivotX,y,columnCenter],[.005,.020,columnHalf],'support'));centre.boxes.push(box(name+'-parent-bearing-'+y,[side*pivotX,y,height],[.005,.020,.008],'parent-bearing','hinge-bearing'));}
  const pinId=name+'-pin';centre.boxes.push(box(pinId,parentPivot,[.003,.095,.003],'pin','hinge-bearing'));leaf.boxes.push(box('child-foot',[-side*footCenter,0,.007],[footHalf,.045,.003],'support'));leaf.boxes.push(box('child-column',[-side*pivotX,0,columnCenter],[.005,.045,columnHalf],'support'));
  leaf.boxes.push(box('child-bearing',childPivot,[.005,.045,.008],'child-bearing','hinge-bearing'));topology.contactExemptions.push({a:{linkId:rootId,boxId:pinId},b:{linkId,boxId:'child-bearing'},reason:'hinge-bearing'});
  for(const support of [...centre.boxes.slice(rootBoxStart),...leaf.boxes.slice(1)])support.jointId=jointId;
  centre.massElements.push(uniformBoxMass(name+'-fixed-mechanism',mechanismMass*.34,parentPivot,[.006,.095,.012]));leaf.massElements.push(uniformBoxMass('moving-mechanism',mechanismMass*.16,childPivot,[.006,.045,.012]));topology.links.push(leaf);topology.joints.push(joint);
 }
 return {id,kind,topology,deployJointOrder:[id+':upper-hinge',id+':lower-hinge'],stowJointOrder:[id+':lower-hinge',id+':upper-hinge'],interlock:'verified-all-joints',massKg:baseMass*3+frameMass+mechanismMass,provenance:{sourceRating:solar?'3 횞 TSP45W: published 45 W BOL and 0.885 kg each; no vendor CAD used':'Entire RF device is an authored educational design; not a flight product',authored:['all link dimensions and mass distributions','frame and reversible mechanism mass','hinge positions and supports','normally-open power/RF contact until all latches verified','regulated finite-power motor profiles']}};
}
/** A fixed array has actual full-span geometry; no fictitious folded envelope.
 * This draft helper removes hinges and their authored0.25kg mass. */
export function createFixedSolarDevice(id:string,rootPose:Pose=identity()):ArticulatedDevice {
 const articulated=createArticulatedDevice(id,'solar',rootPose),compiled=compileTopology(articulated.topology),view=resolveDeploymentGeometry(compiled,initialJointStates(compiled,'deployed')),fixed:RigidLinkDefinition={id:id+':fixed',partId:id,rootPose:structuredClone(rootPose),boxes:[],massElements:[],apertures:[],render:{family:'panel',variant:'fixed-pv135-v1'}};
 for(const [i,link]of articulated.topology.links.entries()){const pose=view.links.find(l=>l.linkId===link.id)!.pose,offset=rotate(conjugate(rootPose.quaternion),sub(pose.positionM,rootPose.positionM)),substrate=link.boxes[0],aperture=link.apertures[0],boxId='substrate-'+i;fixed.boxes.push({...structuredClone(substrate),id:boxId,centerM:add(offset,substrate.centerM)});fixed.massElements.push(uniformBoxMass('panel-'+i,.885,offset,substrate.halfM));fixed.apertures.push({...structuredClone(aperture),centerM:add(offset,aperture.centerM),emittingBoxId:boxId});}
 const half:Vec3=[1.438,.012,.010],center:Vec3=[0,0,-.022];fixed.boxes.push(box('fixed-spine',center,half,'support'));fixed.massElements.push(uniformBoxMass('fixed-frame',.20,center,half));
 const topology:MechanismTopology={version:'deployment-geometry-1',joints:[],contactExemptions:[],links:[fixed]};return {...articulated,topology,deployJointOrder:[],stowJointOrder:[],massKg:2.855,provenance:{...articulated.provenance,authored:['fixed original spanning support with uniform frame mass','actual full-span launch envelope; no compact folded shape','three source-derived45W ratings and masses; dimensions are not vendor CAD']}};
}
