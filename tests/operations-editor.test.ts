import { describe, it, expect } from "vitest";
import { editOperationOnGrid } from "../src/operations-editor";
import type { TransferOperation } from "../src/transfer/types";
describe("detached encounter timeline input", () => {
  const peri = 260 * 86400;
  const original: TransferOperation = {
    id: "encounter-science",
    kind: "observe",
    start: peri - 3600,
    end: peri - 3500,
  };
  const limits = {
    minimumStart: peri - 3600,
    maximumEnd: peri + 172800,
    gridOrigin: peri,
  };
  it("lets a100-second original reach the exact authored90-minute endpoint with a real-valued pointer delta", () => {
    const before = JSON.stringify(original);
    const next = editOperationOnGrid(original, 5300, true, limits);
    expect(next).toEqual({ ...original, end: peri + 1800 });
    expect(JSON.stringify(original)).toBe(before);
    for (const jitter of [-20, 20])
      expect(
        editOperationOnGrid(original, 5300 + jitter, true, limits).end,
      ).toBe(peri + 1800);
  });
  it("anchors keyboard edits to the same grid and preserves duration on movement", () => {
    expect(editOperationOnGrid(original, 60, true, limits).end).toBe(
      peri - 3420,
    );
    const moved = editOperationOnGrid(original, 120, false, limits);
    expect(moved.start).toBe(peri - 3480);
    expect(moved.end - moved.start).toBe(100);
  });
  it("cannot drag a draft into the retained past or beyond the mission end", () => {
    expect(editOperationOnGrid(original, -1e8, false, limits).start).toBe(
      limits.minimumStart,
    );
    expect(editOperationOnGrid(original, 1e8, true, limits).end).toBe(
      limits.maximumEnd,
    );
    expect(editOperationOnGrid(original, -1e8, true, limits).end).toBe(
      original.start + 60,
    );
    expect(editOperationOnGrid(original, NaN, true, limits)).toEqual(original);
  });
});
