/** Orders controls within one flight separately from the flight/session ID.
 * An advance is demand from the current control epoch; only a deliberate
 * control barrier may start a new epoch. This prevents queued old time-warp
 * demand from reviving after a pause or remote-command transaction. */
export class TransferControlClock {
  requestId = 0;
  controlEpoch = 0;
  private barrierKey = "";

  begin(requestId: number): boolean {
    if (!Number.isSafeInteger(requestId) || requestId <= this.requestId)
      return false;
    this.requestId = requestId;
    this.controlEpoch = 0;
    this.barrierKey = "";
    return true;
  }

  sameSession(requestId: number): boolean {
    return requestId === this.requestId;
  }

  acceptAdvance(requestId: number, controlEpoch: number): boolean {
    return (
      this.sameSession(requestId) &&
      Number.isSafeInteger(controlEpoch) &&
      controlEpoch === this.controlEpoch
    );
  }

  acceptBarrier(requestId: number, controlEpoch: number, key: string): boolean {
    if (
      !this.sameSession(requestId) ||
      !Number.isSafeInteger(controlEpoch) ||
      controlEpoch < 1 ||
      controlEpoch < this.controlEpoch ||
      !key
    )
      return false;
    if (controlEpoch === this.controlEpoch) return key === this.barrierKey;
    this.controlEpoch = controlEpoch;
    this.barrierKey = key;
    return true;
  }
}
