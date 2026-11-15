import { describe, expect, it } from "vitest";
import {
  composeReminder,
  dueInfo,
  effectiveDue,
  eventsForCase,
  formatDueDate,
  isUrgent,
  nextEvent,
  parseIcs,
  prioritize,
  remindersFor,
} from "@/lib/deadlines";
import { ITEMS, type TimelineItem } from "@/lib/sample-case";

const NOW = new Date("2026-11-14T15:00:00");
const at = (iso: string) => new Date(iso).toISOString();

const flagged = ITEMS.filter((i) => i.flag !== "agrees");
const conflict = flagged.find((i) => i.flag === "conflict") as TimelineItem;
const gaps = flagged.filter((i) => i.flag === "missing");

describe("how urgent a deadline is", () => {
  it("labels overdue, today, tomorrow, soon and later", () => {
    expect(dueInfo(undefined, NOW)).toEqual({ kind: "none", label: "No deadline" });
    expect(dueInfo(at("2026-11-14T09:00:00"), NOW)).toEqual({
      kind: "overdue",
      label: "Overdue today",
    });
    expect(dueInfo(at("2026-11-12T09:00:00"), NOW)).toEqual({
      kind: "overdue",
      label: "Overdue by 2 days",
    });
    expect(dueInfo(at("2026-11-14T18:00:00"), NOW)).toEqual({ kind: "today", label: "Due today" });
    expect(dueInfo(at("2026-11-15T10:00:00"), NOW)).toEqual({
      kind: "soon",
      label: "Due tomorrow",
    });
    expect(dueInfo(at("2026-11-17T10:00:00"), NOW)).toEqual({
      kind: "soon",
      label: "Due in 3 days",
    });
    expect(dueInfo(at("2026-11-25T10:00:00"), NOW)).toEqual({
      kind: "later",
      label: "Due in 11 days",
    });
  });

  it("treats a missing or unreadable date as no deadline", () => {
    expect(dueInfo("not a date", NOW).kind).toBe("none");
    expect(dueInfo(null, NOW).kind).toBe("none");
  });

  it("calls overdue, today and soon urgent, but not later or none", () => {
    expect(isUrgent(dueInfo(at("2026-11-13T09:00:00"), NOW))).toBe(true);
    expect(isUrgent(dueInfo(at("2026-11-15T09:00:00"), NOW))).toBe(true);
    expect(isUrgent(dueInfo(at("2026-12-25T09:00:00"), NOW))).toBe(false);
    expect(isUrgent(dueInfo(undefined, NOW))).toBe(false);
  });

  it("formats a deadline with or without a time", () => {
    expect(formatDueDate(at("2026-11-15T15:00:00"))).toBe("Sun, Nov 15, 3:00 PM");
    expect(formatDueDate(at("2026-11-15T23:59:00"), true)).toBe("Sun, Nov 15");
  });

  it("lets an item's own deadline win over the case's", () => {
    expect(effectiveDue({ dueAt: "A" }, "B")).toBe("A");
    expect(effectiveDue({}, "B")).toBe("B");
    expect(effectiveDue({}, null)).toBeUndefined();
  });
});

describe("order on Review", () => {
  const [g1, g2] = gaps as [TimelineItem, TimelineItem];
  const withDue = (i: TimelineItem, dueAt: string): TimelineItem => ({ ...i, dueAt });

  it("puts the soonest deadline first, overdue at the very top", () => {
    const items = [
      withDue(g1, at("2026-11-20T09:00:00")),
      conflict,
      withDue(g2, at("2026-11-13T09:00:00")),
    ];
    expect(prioritize(items, {}, null).map((i) => i.id)).toEqual([g2.id, g1.id, conflict.id]);
  });

  it("falls back to conflicts before gaps when nothing has a deadline", () => {
    expect(prioritize([g1, conflict], {}, null)[0]?.id).toBe(conflict.id);
  });

  it("sinks items a person already confirmed or dismissed, but not follow-ups", () => {
    const urgent = withDue(g1, at("2026-11-14T16:00:00"));
    const ordered = prioritize([urgent, conflict], { [urgent.id]: "confirmed" }, null);
    expect(ordered.map((i) => i.id)).toEqual([conflict.id, urgent.id]);
    const followUp = prioritize([urgent, conflict], { [urgent.id]: "follow-up" }, null);
    expect(followUp[0]?.id).toBe(urgent.id);
  });

  it("lets items without their own deadline inherit the case deadline", () => {
    const own = withDue(g1, at("2026-11-30T09:00:00"));
    const ordered = prioritize([own, conflict], {}, at("2026-11-15T09:00:00"));
    expect(ordered[0]?.id).toBe(conflict.id); // inherits the sooner case deadline
  });
});

describe("reminders", () => {
  const dueSoon: TimelineItem = { ...(conflict as TimelineItem), dueAt: at("2026-11-15T09:00:00") };

  it("includes a flagged item due within a day or overdue", () => {
    const r = remindersFor([dueSoon], {}, null, NOW);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: "soon", dueAt: dueSoon.dueAt });
    const late = remindersFor([{ ...dueSoon, dueAt: at("2026-11-13T09:00:00") }], {}, null, NOW);
    expect(late[0]?.kind).toBe("overdue");
  });

  it("leaves out items due later, without a deadline, already decided, or agreeing", () => {
    expect(remindersFor([{ ...dueSoon, dueAt: at("2026-11-20T09:00:00") }], {}, null, NOW)).toEqual(
      [],
    );
    expect(remindersFor([conflict], {}, null, NOW)).toEqual([]);
    expect(remindersFor([dueSoon], { [dueSoon.id]: "confirmed" }, null, NOW)).toEqual([]);
    expect(remindersFor([dueSoon], { [dueSoon.id]: "dismissed" }, null, NOW)).toEqual([]);
    expect(remindersFor([dueSoon], { [dueSoon.id]: "follow-up" }, null, NOW)).toHaveLength(1);
    const agrees = ITEMS.find((i) => i.flag === "agrees") as TimelineItem;
    expect(remindersFor([{ ...agrees, dueAt: dueSoon.dueAt as string }], {}, null, NOW)).toEqual(
      [],
    );
  });

  it("uses the case deadline for items with none of their own", () => {
    expect(remindersFor([conflict], {}, at("2026-11-15T09:00:00"), NOW)).toHaveLength(1);
  });

  it("gives each reminder a stable key, so it can be sent once", () => {
    const a = remindersFor([dueSoon], {}, null, NOW)[0];
    const b = remindersFor([dueSoon], {}, null, new Date("2026-11-14T15:30:00"))[0];
    expect(a?.key).toBe(b?.key);
  });

  it("writes a neutral message that names the item, when, and where to act", () => {
    const text = composeReminder(remindersFor([dueSoon], {}, null, NOW), NOW);
    expect(text).toContain(dueSoon.label);
    expect(text).toContain("due tomorrow");
    expect(text).toContain("Open Review");
    expect(text).not.toMatch(/guilt|illegal|unlawful|violat|win|strategy/i);
    expect(composeReminder([], NOW)).toBe("Nothing flagged is due soon.");
  });

  it("caps a long list", () => {
    const many = Array.from({ length: 8 }, (_, n) => ({
      ...dueSoon,
      id: `x${n}`,
      label: `Item ${n}`,
    }));
    const text = composeReminder(remindersFor(many, {}, null, NOW), NOW);
    expect(text).toContain("...and 3 more.");
    expect(text).toContain("8 flagged items");
  });
});

describe("reading a calendar feed", () => {
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:a1",
    "SUMMARY:Rosales v. Terrell\\, opposition due",
    "DTSTART:20261116T150000Z",
    "DESCRIPTION:Case 5CIR-25-30650\\nFile by 3 PM",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:a2",
    "SUMMARY:Dentist",
    "DTSTART:20261115T100000Z",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:a3",
    "SUMMARY:Hearing in the Rosales matter",
    "DTSTART;VALUE=DATE:20261120",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:a4",
    "SUMMARY:Rosales status call",
    "DTSTART;TZID=America/Chicago:20261117T090000",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  it("reads titles, notes and times, including escaped text and a UTC time", () => {
    const [first] = parseIcs(ics);
    expect(first).toMatchObject({
      uid: "a1",
      summary: "Rosales v. Terrell, opposition due",
      start: "2026-11-16T15:00:00.000Z",
      allDay: false,
    });
    expect(first?.description).toBe("Case 5CIR-25-30650\nFile by 3 PM");
  });

  it("reads an all-day event as due by the end of that day", () => {
    const e = parseIcs(ics).find((x) => x.uid === "a3");
    expect(e?.allDay).toBe(true);
    expect(new Date(e?.start ?? "").getHours()).toBe(23);
    expect(new Date(e?.start ?? "").getDate()).toBe(20);
  });

  it("converts a time in a named zone (Central, standard time = UTC-6)", () => {
    expect(parseIcs(ics).find((x) => x.uid === "a4")?.start).toBe("2026-11-17T15:00:00.000Z");
  });

  it("unfolds long lines and ignores events with no start", () => {
    const folded =
      "BEGIN:VEVENT\r\nUID:z\r\nSUMMARY:Rosales very long\r\n  title here\r\nDTSTART:20261116T150000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:No start\r\nEND:VEVENT";
    const events = parseIcs(folded);
    expect(events).toHaveLength(1);
    expect(events[0]?.summary).toBe("Rosales very long title here");
  });

  it("returns nothing for text that is not a calendar", () => {
    expect(parseIcs("<html>not a calendar</html>")).toEqual([]);
    expect(parseIcs("")).toEqual([]);
  });

  it("keeps only events that mention the case, and finds the next one", () => {
    const mine = eventsForCase(parseIcs(ics), ["Rosales", "5CIR-25-30650"]);
    expect(mine.map((e) => e.uid).sort()).toEqual(["a1", "a3", "a4"]);
    expect(nextEvent(mine, NOW)?.uid).toBe("a1");
    expect(nextEvent(mine, new Date("2026-11-19T00:00:00Z"))?.uid).toBe("a3");
    expect(nextEvent(mine, new Date("2027-01-01T00:00:00Z"))).toBeUndefined();
    expect(eventsForCase(parseIcs(ics), ["nothing like this"])).toEqual([]);
  });
});
