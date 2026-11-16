import type {Design} from '../sim/types';
import {connectedInstruments,getBusDefinition,hardwareLinkConfiguration,hardwareLoadPower,hardwareSafePower,isHardwareDesign,resolveHardware} from '../hardware/resolve';
import {hardwareAttitudeLimits} from '../hardware/attitude';
import {freezeTransferInput,isTransferInputFrozen} from './immutable';

function compile(craft:Design){
 // The clone's resolver cache is private to this compilation. Mutating a public
 // resolveHardware(craft) result cannot poison the compiled constants.
 const snapshot=freezeTransferInput(structuredClone(craft));
 const loads={charge:[hardwareLoadPower(snapshot,'charge',false),hardwareLoadPower(snapshot,'charge',true)],observe:[hardwareLoadPower(snapshot,'observe',false),hardwareLoadPower(snapshot,'observe',true)],downlink:[hardwareLoadPower(snapshot,'downlink',false),hardwareLoadPower(snapshot,'downlink',true)]};
 return freezeTransferInput({loads,safeLoads:[hardwareSafePower(snapshot,false),hardwareSafePower(snapshot,true)],attitude:hardwareAttitudeLimits(snapshot),link:hardwareLinkConfiguration(snapshot),instruments:connectedInstruments(snapshot,'spectrometer'),conversionEfficiency:getBusDefinition(snapshot).conversionEfficiency,dataWriteRateBps:resolveHardware(snapshot).dataWriteRateBps});
}
export type CompiledTransferCraft=ReturnType<typeof compile>;
const compiled=new WeakMap<Design,CompiledTransferCraft>();
/** Returns shared deeply frozen constants for certified inputs. Never caches a
 * mutable editor design, and retains no runtime packet/history. */
export function compiledTransferCraft(craft:Design):CompiledTransferCraft|null {
 if(!isHardwareDesign(craft))return null;
 if(!isTransferInputFrozen(craft))return compile(craft);
 let value=compiled.get(craft);if(!value){value=compile(craft);compiled.set(craft,value);}return value;
}
