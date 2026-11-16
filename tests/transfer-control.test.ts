import { describe, expect, it } from "vitest";
import { TransferControlClock } from "../src/transfer-control";

describe("same-flight control epochs", () => {
  it("prevents old warp continuation after a command barrier without rewinding accepted work", () => {
    const clock = new TransferControlClock();
    expect(clock.begin(1)).toBe(true);
    expect(clock.acceptBarrier(1, 1, "warp")).toBe(true);
    expect(clock.acceptAdvance(1, 1)).toBe(true);
    expect(clock.acceptBarrier(1, 2, "queue:action-1")).toBe(true);
    expect(clock.acceptAdvance(1, 1)).toBe(false);
    expect(clock.acceptBarrier(1, 1, "warp")).toBe(false);
    expect(clock.acceptAdvance(1, 2)).toBe(true);
  });
  it("accepts an exact transaction redelivery but rejects a different action in its epoch", () => {
    const clock = new TransferControlClock();
    clock.begin(1);
    expect(clock.acceptBarrier(1, 1, "queue:a")).toBe(true);
    expect(clock.acceptBarrier(1, 1, "queue:a")).toBe(true);
    expect(clock.acceptBarrier(1, 1, "queue:b")).toBe(false);
    expect(clock.acceptBarrier(1, 1, "warp")).toBe(false);
  });
  it("does not let an advance invent an epoch or a stale flight change the new session", () => {
    const clock = new TransferControlClock();
    clock.begin(1);
    expect(clock.acceptAdvance(1, 8)).toBe(false);
    expect(clock.acceptBarrier(1, 1, "pause")).toBe(true);
    expect(clock.begin(2)).toBe(true);
    expect(clock.begin(1)).toBe(false);
    expect(clock.acceptBarrier(1, 100, "pause")).toBe(false);
    expect(clock.acceptAdvance(2, 0)).toBe(true);
    for (const value of [NaN, Infinity, -1, 1.5])
      expect(clock.acceptBarrier(2, value, "pause")).toBe(false);
  });
});
