import type { TransferOperation } from "./transfer/types";

/** Edit a detached draft on a minute grid anchored to the encounter epoch.
 * Snap the absolute endpoint: an imported100-second block must still reach
 * a minute-aligned target. This function cannot mutate the executing schedule. */
export function editOperationOnGrid(
  operation: TransferOperation,
  deltaSeconds: number,
  resize: boolean,
  limits: { minimumStart: number; maximumEnd: number; gridOrigin: number },
): TransferOperation {
  const next = { ...operation };
  if (
    ![
      deltaSeconds,
      limits.minimumStart,
      limits.maximumEnd,
      limits.gridOrigin,
    ].every(Number.isFinite)
  )
    return next;
  const snap = (time: number) =>
    limits.gridOrigin + Math.round((time - limits.gridOrigin) / 60) * 60;
  if (resize)
    next.end = Math.min(
      limits.maximumEnd,
      Math.max(operation.start + 60, snap(operation.end + deltaSeconds)),
    );
  else {
    const duration = operation.end - operation.start;
    if (duration > limits.maximumEnd - limits.minimumStart) return next;
    next.start = Math.max(
      limits.minimumStart,
      Math.min(
        limits.maximumEnd - duration,
        snap(operation.start + deltaSeconds),
      ),
    );
    next.end = next.start + duration;
  }
  return next;
}
