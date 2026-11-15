import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMessage, whatsDue, type AgentLlm, type PipelineState } from "@/lib/agent/pipeline";
import { parseTeamNumbers } from "@/lib/channel/allowlist";
import { PhotonChannel } from "@/lib/channel/photon.server";
import { loadCalendar } from "@/lib/server/calendar.server";
import { runReminderCheck, type ReminderHost } from "@/lib/server/reminders.server";
import { ITEMS, type TimelineItem } from "@/lib/sample-case";

const NOW = new Date("2026-11-14T15:00:00");
const at = (iso: string) => new Date(iso).toISOString();
const flagged = ITEMS.filter((i) => i.flag !== "agrees");
const conflict = flagged.find((i) => i.flag === "conflict") as TimelineItem;
const gap = flagged.find((i) => i.flag === "missing") as TimelineItem;

function host(over: Partial<ReminderHost> = {}) {
  const notifyAll = vi.fn(async (_text: string) => ({ recipients: 2, accepted: 2 }));
  const h: ReminderHost = {
    channel: { notifyAll },
    state: { items: [{ ...conflict, dueAt: at("2026-11-15T09:00:00") }, gap] },
    decisions: {},
    sent: new Set(),
    ...over,
  };
  return { h, notifyAll };
}

describe("sending deadline reminders", () => {
  beforeEach(() => {
    delete process.env["CASE_CALENDAR_ICS_URLS"];
  });

  it("texts everyone about items due soon, once", async () => {
    const { h, notifyAll } = host();
    const first = await runReminderCheck(h, { now: NOW });
    expect(first).toMatchObject({ count: 1, recipients: 2, accepted: 2 });
    expect(notifyAll).toHaveBeenCalledTimes(1);
    expect(notifyAll.mock.calls[0]?.[0]).toContain(conflict.label);

    const second = await runReminderCheck(h, { now: new Date("2026-11-14T15:05:00") });
    expect(second.count).toBe(0);
    expect(notifyAll).toHaveBeenCalledTimes(1);
  });

  it("can resend on demand, ignoring what was already sent", async () => {
    const { h, notifyAll } = host();
    await runReminderCheck(h, { now: NOW });
    const again = await runReminderCheck(h, { now: NOW, includeAlreadySent: true });
    expect(again.count).toBe(1);
    expect(notifyAll).toHaveBeenCalledTimes(2);
  });

  it("does not count it as sent when nobody is on the line, so it tries again later", async () => {
    const notifyAll = vi.fn(async () => ({ recipients: 0, accepted: 0 }));
    const { h } = host({ channel: { notifyAll } });
    await runReminderCheck(h, { now: NOW });
    expect(h.sent.size).toBe(0);
    await runReminderCheck(h, { now: NOW });
    expect(notifyAll).toHaveBeenCalledTimes(2);
  });

  it("skips items a person already confirmed or dismissed, and sends nothing when none are due", async () => {
    const { h, notifyAll } = host({ decisions: { [conflict.id]: "confirmed" } });
    expect((await runReminderCheck(h, { now: NOW })).count).toBe(0);
    expect(notifyAll).not.toHaveBeenCalled();
    const none = host({ state: { items: [conflict, gap] } });
    expect((await runReminderCheck(none.h, { now: NOW })).text).toBeNull();
  });
});

describe("reading the calendar feed from the server", () => {
  const url = "https://calendar.example.test/private/SECRET-TOKEN/basic.ics";
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:1",
    "SUMMARY:Rosales v. Terrell - reply brief due",
    "DTSTART:20261116T150000Z",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:2",
    "SUMMARY:Unrelated dinner",
    "DTSTART:20261115T150000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["CASE_CALENDAR_ICS_URLS"];
  });

  it("is not configured without a link", async () => {
    const r = await loadCalendar(NOW, true);
    expect(r).toMatchObject({ configured: false, next: null, upcoming: [] });
  });

  it("finds the next deadline for this case and ignores other events", async () => {
    process.env["CASE_CALENDAR_ICS_URLS"] = url;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(ics, { status: 200 })),
    );
    const r = await loadCalendar(NOW, true);
    expect(r.configured).toBe(true);
    expect(r.next).toMatchObject({
      title: "Rosales v. Terrell - reply brief due",
      dueAt: "2026-11-16T15:00:00.000Z",
    });
    expect(r.upcoming).toHaveLength(1);
  });

  it("accepts webcal links and skips events in the past", async () => {
    process.env["CASE_CALENDAR_ICS_URLS"] = url.replace("https://", "webcal://");
    const fetchMock = vi.fn(async (_input: unknown) => new Response(ics, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await loadCalendar(new Date("2026-12-01T00:00:00Z"), true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^https:\/\//);
    expect(r.next).toBeNull();
  });

  it("refuses a plain http link to another host and never calls it", async () => {
    process.env["CASE_CALENDAR_ICS_URLS"] = "http://calendar.example.test/x.ics";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await loadCalendar(NOW, true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.configured).toBe(false);
  });

  it("says a feed failed without ever showing the link", async () => {
    process.env["CASE_CALENDAR_ICS_URLS"] = url;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 403 })),
    );
    const r = await loadCalendar(NOW, true);
    expect(r.error).toBe("The calendar could not be read.");
    expect(JSON.stringify(r)).not.toContain("SECRET-TOKEN");
    expect(JSON.stringify(errors.mock.calls)).not.toContain("SECRET-TOKEN");
    errors.mockRestore();
  });

  it("caches the answer for a few minutes", async () => {
    process.env["CASE_CALENDAR_ICS_URLS"] = url;
    const fetchMock = vi.fn(async () => new Response(ics, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await loadCalendar(NOW, true);
    await loadCalendar(new Date(NOW.getTime() + 60_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("What's due? over text", () => {
  const llm = {} as AgentLlm;
  const dueItem: TimelineItem = { ...conflict, dueAt: at("2026-11-15T09:00:00") };
  const state = (over: Partial<PipelineState> = {}): PipelineState => ({
    items: [dueItem, gap],
    pendingId: null,
    ...over,
  });

  it("lists flagged items that are waiting, soonest first, with the case deadline", () => {
    const text = whatsDue(
      state({
        caseDeadline: { title: "Reply brief due", dueAt: at("2026-11-16T15:00:00"), allDay: false },
      }),
      NOW,
    );
    expect(text).toContain("Next case deadline: Reply brief due");
    expect(text).toContain(`- ${dueItem.label} (due tomorrow`);
    expect(text.indexOf(dueItem.label)).toBeLessThan(text.indexOf(gap.label));
  });

  it("leaves out settled items and says so when nothing is set", () => {
    expect(whatsDue(state({ resolved: [dueItem.id] }), NOW)).toContain("No deadlines are set");
    expect(whatsDue(state({ items: [conflict] }), NOW)).toContain("No deadlines are set");
  });

  it("answers the command, and the phone's curly apostrophe", async () => {
    for (const t of ["What's due?", "What’s due", "deadlines", "Upcoming deadlines?"]) {
      const r = await handleMessage(state(), { text: t, attachments: [] }, llm, NOW);
      expect(r.replies[0]?.text).toContain(dueItem.label);
    }
  });

  it("does not treat a note that mentions a deadline as the command", async () => {
    const describe = vi.fn(async () => ({
      description: "Note about a deadline",
      lane: "events",
      start: 10,
      end: 15,
      confidence: 0.9,
    }));
    const compare = vi.fn(async () => ({
      verdict: "unclear",
      relatedId: null,
      reason: "",
      confidence: 0.1,
    }));
    const model = { describe, compare } as unknown as AgentLlm;
    const r = await handleMessage(
      state(),
      { text: "The filing deadline for the reply is Monday afternoon", attachments: [] },
      model,
      NOW,
    );
    expect(describe).toHaveBeenCalled();
    expect(r.replies[0]?.text).toContain("Reply CONFIRM or DISMISS");
  });
});

describe("texting everyone on the line", () => {
  const team = { team: parseTeamNumbers("+15550001111"), batchMs: 0 };
  const config = { apiKey: "pho_sk_test", projectId: "pho_prj_1", webhookSecret: "whsec_x" };
  const from = (space: string) => ({
    data: {
      object: {
        id: `msg_${space}`,
        status: "received",
        content: { type: "text", format: "plain", text: "hello" },
        sentBy: { kind: "human", id: "usr", handle: "+15550001111" },
        receivedBy: { kind: "agent", id: "agt" },
        space: { id: space, kind: "direct" },
      },
    },
  });

  it("sends one unthreaded text to each conversation", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const log: unknown[] = [];
    const channel = new PhotonChannel(
      config,
      (m) => log.push(m),
      fetchMock as unknown as typeof fetch,
      team,
    );
    channel.onMessage(async () => {});
    await channel.handleInbound(from("spc_A"));
    await channel.handleInbound(from("spc_B"));
    const r = await channel.notifyAll("Reminder: 1 flagged item.");
    expect(r).toEqual({ recipients: 2, accepted: 2 });
    const bodies = fetchMock.mock.calls.map((c) =>
      JSON.parse((c as unknown as [string, RequestInit])[1].body as string),
    );
    expect(bodies.map((b) => b.spaceId).sort()).toEqual(["spc_A", "spc_B"]);
    expect(bodies[0]).not.toHaveProperty("parentMessageId");
    expect(bodies[0].content.text).toBe("Reminder: 1 flagged item.");
    expect(log.at(-1)).toEqual({ from: "agent", text: "Reminder: 1 flagged item." });
  });

  it("reaches nobody, and sends nothing, when no one has texted the line", async () => {
    const fetchMock = vi.fn();
    const channel = new PhotonChannel(config, () => {}, fetchMock as unknown as typeof fetch, team);
    expect(await channel.notifyAll("hello")).toEqual({ recipients: 0, accepted: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts only the texts Photon accepted", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let n = 0;
    const fetchMock = vi.fn(async () => new Response("{}", { status: n++ === 0 ? 200 : 403 }));
    const channel = new PhotonChannel(config, () => {}, fetchMock as unknown as typeof fetch, team);
    channel.onMessage(async () => {});
    await channel.handleInbound(from("spc_A"));
    await channel.handleInbound(from("spc_B"));
    expect(await channel.notifyAll("x")).toEqual({ recipients: 2, accepted: 1 });
    errors.mockRestore();
  });
});
