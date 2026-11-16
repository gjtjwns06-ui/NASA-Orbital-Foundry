import type {Design} from '../sim/types';
import {connectedInstruments,getBusDefinition,hardwareLinkConfiguration,hardwareLoadPower,hardwareSafePower,isHardwareDesign,resolveHardware} from '../hardware/resolve';
import {hardwareAttitudeLimits} from '../hardware/attitude';
import {freezeTransferInput} from './immutable';

function compile(craft:Design){
 // The clone's resolver cache is private to this compilation. Mutating a public
 // resolveHardware(craft) result cannot poison the compiled constants.
 const snapshot=freezeTransferInput(structuredClone(craft));
 const loads={charge:[hardwareLoadPower(snapshot,'charge',false),hardwareLoadPower(snapshot,'charge',true)],observe:[hardwareLoadPower(snapshot,'observe',false),hardwareLoadPower(snapshot,'observe',true)],downlink:[hardwareLoadPower(snapshot,'downlink',false),hardwareLoadPower(snapshot,'downlink',true)]};
 return freezeTransferInput({loads,safeLoads:[hardwareSafePower(snapshot,false),hardwareSafePower(snapshot,true)],attitude:hardwareAttitudeLimits(snapshot),link:hardwareLinkConfiguration(snapshot),instruments:connectedInstruments(snapshot,'spectrometer'),conversionEfficiency:getBusDefinition(snapshot).conversionEfficiency,dataWriteRateBps:resolveHardware(snapshot).dataWriteRateBps});
}
export type CompiledTransferCraft=ReturnType<typeof compile>;
const compiled=new WeakMap<Design,CompiledTransferCraft>();
function deeplyFrozen(value:unknown,seen=new WeakSet<object>()):boolean {if(value===null||typeof value!=='object'||seen.has(value))return true;if(!Object.isFrozen(value))return false;seen.add(value);return Object.values(value).every(child=>deeplyFrozen(child,seen));}
/** Returns shared deeply frozen constants for certified inputs. Never caches a
 * mutable editor design, and retains no runtime packet/history. */
export function compiledTransferCraft(craft:Design):CompiledTransferCraft|null {
 if(!isHardwareDesign(craft))return null;
 const cached=compiled.get(craft);if(cached)return cached;
 const value=compile(craft);if(deeplyFrozen(craft))compiled.set(craft,value);return value;
}
