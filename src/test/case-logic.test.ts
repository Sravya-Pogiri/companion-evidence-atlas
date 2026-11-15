import { beforeEach, describe, expect, it } from "vitest";
import { decide, getDecisions, resetDecisions } from "@/lib/review-store";
import {
  ITEMS,
  formatTime,
  handoffItems,
  itemsAt,
  layoutLane,
  reviewQueue,
} from "@/lib/sample-case";

describe("sample case logic", () => {
  beforeEach(() => resetDecisions());

  it("formats times on the 0:00 to 1:30 axis", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(45)).toBe("0:45");
    expect(formatTime(90)).toBe("1:30");
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
