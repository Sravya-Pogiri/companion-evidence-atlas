import { beforeEach, describe, expect, it } from "vitest";
import { fromAxis, splitLabel, splitTick, toAxis } from "@/lib/split-axis";
import { decide, getDecisions, resetDecisions } from "@/lib/review-store";
import {
  SAMPLE_ITEMS as ITEMS,
  formatTime,
  handoffItems,
  itemsAt,
  layoutLane,
  reviewQueue,
} from "@/lib/sample-case";

describe("sample case logic", () => {
  beforeEach(() => resetDecisions());

  it("formats axis points as their camera's time on the split analysis axis", () => {
    // Left part: dashcam 0:30-1:50; right part: bodycam 0:00-21:21; a gap between them.
    expect(toAxis("dashcam", 30)).toBe(0);
    expect(toAxis("dashcam", 94)).toBe(32);
    expect(toAxis("dashcam", 20)).toBeNull();
    expect(toAxis("bodycam", 0)).toBe(44);
    // Axis positions round to 0.1 units (about 1.7 bodycam seconds); items keep their exact second.
    expect(Math.abs(fromAxis(toAxis("bodycam", 520)!)!.t - 520)).toBeLessThan(2);
    expect(fromAxis(42)).toBeNull();
    expect(splitLabel(32)).toBe("1:34");
    expect(splitTick(44)).toBe("Bodycam 0:00");
    expect(formatTime(32)).toBe(splitLabel(32));
  });

  it("finds what is on the timeline at the playhead", () => {
    const ids = itemsAt(ITEMS, 50).map((i) => i.id);
    expect(ids).toContain("dashcam-approach");
    expect(ids).toContain("complaint-reason");
    expect(ids).not.toContain("activation-missing");
  });

  it("stacks overlapping items in one lane into separate rows", () => {
    const docs = ITEMS.filter((i) => i.lane === "documents");
    const { rows, rowOf } = layoutLane(docs);
    expect(rows).toBe(2);
    expect(new Set(Object.values(rowOf)).size).toBe(2);
  });

  it("queues conflicts and gaps for review but not agreeing items", () => {
    const ids = reviewQueue(ITEMS).map((i) => i.id);
    expect(ids[0]).toBe("complaint-reason");
    expect(ids).toContain("dispatch-missing");
    expect(ids).toContain("activation-missing");
    expect(ids).not.toContain("dashcam-approach");
  });

  it("hands off only confirmed items", () => {
    decide("complaint-reason", "confirmed");
    decide("activation-missing", "follow-up");
    decide("dispatch-missing", "dismissed");
    expect(handoffItems(ITEMS, getDecisions()).map((i) => i.id)).toEqual(["complaint-reason"]);
  });

  it("clears a decision when it is chosen twice", () => {
    decide("complaint-reason", "confirmed");
    decide("complaint-reason", "confirmed");
    expect(getDecisions()["complaint-reason"]).toBeUndefined();
  });
});
