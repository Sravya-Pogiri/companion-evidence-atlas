import { createServerFn } from "@tanstack/react-start";
import type { Decisions } from "@/lib/deadlines";

// Server functions for deadlines. The page calls these; the calendar link and the Photon keys
// stay on the server.

export interface CaseCalendar {
  configured: boolean;
  next: { title: string; dueAt: string; allDay: boolean } | null;
  upcoming: { title: string; dueAt: string; allDay: boolean }[];
  error: string | null;
  checkedAt: string;
}

/** The next deadline for this case from the connected calendar feed(s), if there is one. */
export const getCaseCalendar = createServerFn({ method: "GET" }).handler(
  async (): Promise<CaseCalendar> => {
    const { loadCalendar } = await import("@/lib/server/calendar.server");
    const c = await loadCalendar();
    return {
      configured: c.configured,
      next: c.next,
      upcoming: c.upcoming,
      error: c.error ?? null,
      checkedAt: c.checkedAt,
    };
  },
);

/**
 * Set or clear one item's deadline on the server. Only has an effect in Photon mode, where the
 * case lives on the server (reminders are sent from there). Otherwise the page keeps it locally.
 */
export const setItemDueOnServer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): { id: string; dueAt: string | null } => {
    const o = (input ?? {}) as Record<string, unknown>;
    const id = typeof o["id"] === "string" ? o["id"].slice(0, 120) : "";
    const raw = o["dueAt"];
    const dueAt = typeof raw === "string" && !Number.isNaN(new Date(raw).getTime()) ? raw : null;
    if (!id) throw new Error("Missing item id.");
    return { id, dueAt };
  })
  .handler(async ({ data }): Promise<{ applied: boolean }> => {
    const { getPhotonRuntime } = await import("@/lib/server/channel.server");
    const rt = getPhotonRuntime();
    if (!rt) return { applied: false };
    rt.state.items = rt.state.items.map((i) => {
      if (i.id !== data.id) return i;
      const { dueAt: _old, ...rest } = i;
      return data.dueAt ? { ...rest, dueAt: data.dueAt } : rest;
    });
    return { applied: true };
  });

/** Copy the page's Review decisions up, so reminders skip items a person already settled. */
export const syncDecisions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): Decisions => {
    const o = (input ?? {}) as Record<string, unknown>;
    const out: Decisions = {};
    for (const [id, v] of Object.entries(o).slice(0, 200)) {
      if (v === "confirmed" || v === "dismissed" || v === "follow-up") out[id.slice(0, 120)] = v;
    }
    return out;
  })
  .handler(async ({ data }): Promise<{ applied: boolean }> => {
    const { getPhotonRuntime } = await import("@/lib/server/channel.server");
    const rt = getPhotonRuntime();
    if (!rt) return { applied: false };
    rt.decisions = data;
    return { applied: true };
  });

export type RemindersNow =
  | { ok: false; reason: "photon" }
  | { ok: true; count: number; recipients: number; accepted: number };

/** Text the reminder for everything due soon right now, to everyone who has texted the line. */
export const sendRemindersNow = createServerFn({ method: "POST" }).handler(
  async (): Promise<RemindersNow> => {
    const { getPhotonRuntime } = await import("@/lib/server/channel.server");
    const { runReminderCheck } = await import("@/lib/server/reminders.server");
    const rt = getPhotonRuntime();
    if (!rt) return { ok: false, reason: "photon" };
    const r = await runReminderCheck(rt, { includeAlreadySent: true });
    return { ok: true, count: r.count, recipients: r.recipients, accepted: r.accepted };
  },
);
