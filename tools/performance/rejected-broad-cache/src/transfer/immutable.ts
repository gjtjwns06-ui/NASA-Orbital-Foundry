/** Freeze serializable model inputs. Runtime counters/resources remain mutable. */
const certifiedInputs=new WeakSet<object>();
export function freezeTransferInput<T>(value:T):T {
 const seen=new WeakSet<object>();
 const visit=(item:unknown):void=>{if(item===null||typeof item!=='object'||seen.has(item)||certifiedInputs.has(item))return;seen.add(item);for(const child of Object.values(item))visit(child);Object.freeze(item);certifiedInputs.add(item);};visit(value);return value;
}
/** Identity proof established only by the recursive freezer, not shallow checks. */
export function isTransferInputFrozen(value:unknown):boolean{return value!==null&&typeof value==='object'&&certifiedInputs.has(value);}
