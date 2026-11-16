/** Freeze serializable model inputs. Runtime counters/resources remain mutable. */
export function freezeTransferInput<T>(value:T):T {
 const seen=new WeakSet<object>();
 const visit=(item:unknown):void=>{if(item===null||typeof item!=='object'||seen.has(item))return;seen.add(item);for(const child of Object.values(item))visit(child);Object.freeze(item);};visit(value);return value;
}
