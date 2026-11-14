import { describe, expect, it } from "vitest";
import {
  handleMessage,
  hasConclusion,
  whatsChanged,
  whatsMissing,
  type AgentLlm,
  type PipelineState,
} from "@/lib/agent/pipeline";
import type { Attachment } from "@/lib/channel/types";
import { ITEMS } from "@/lib/sample-case";

const NOW = new Date("2026-11-14T15:00:00");
const seed = (): PipelineState => ({ items: ITEMS, pendingId: null });

const note: Attachment = {
  id: "a1",
  kind: "audio",
  name: "Team voice note",
  url: "https://example.test/note",
  extractedText: "Signal came on right at the turn, about 0:55.",
};

function llm(over: Partial<AgentLlm> = {}): AgentLlm {
  return {
    describe: async () => ({
      description: "Dashcam: signal at the turn",
      lane: "events",
      start: 55,
      end: 60,
      confidence: 0.9,
    }),
    compare: async () => ({
      verdict: "conflict",
      relatedId: "bodycam-approach",
      reason:
        "The note says the signal came on at the turn, while the bodycam appears to show it on during the approach.",
      confidence: 0.8,
    }),
    ...over,
  };
}

async function send(
  state: PipelineState,
  text: string,
  model: AgentLlm,
  attachments: Attachment[] = [],
) {
  return handleMessage(state, { text, attachments }, model, NOW);
}

describe("message pipeline", () => {
  it("turns an attachment into a pending item and asks to file it", async () => {
    const r = await send(seed(), "", llm(), [note]);
    const item = r.state.items.find((i) => i.id === "item-a1");
    expect(item).toMatchObject({
      status: "pending",
      lane: "events",
      start: 55,
      end: 60,
      sourceLink: "https://example.test/note",
      sourceLabel: "Team voice note",
    });
    expect(r.state.pendingId).toBe("item-a1");
    expect(r.replies[0]?.text).toBe("File this as Dashcam: signal at the turn? Reply Y.");
  });

  it("files on Y and cites both sources when it finds a conflict", async () => {
    const asked = await send(seed(), "", llm(), [note]);
    const r = await send(asked.state, "Y", llm());
    const item = r.state.items.find((i) => i.id === "item-a1");
    expect(item).toMatchObject({
      status: "filed",
      flag: "conflict",
      relatedId: "bodycam-approach",
    });
    expect(item?.filedAt).toBeTruthy();
    expect(r.state.pendingId).toBeNull();
    const text = r.replies[0]?.text ?? "";
    expect(text).toContain("Possible conflict");
    expect(text).toContain("Team voice note");
    expect(text).toContain("Officer bodycam");
  });

  it("files an agreeing item neutrally and cites the source it lines up with", async () => {
    const asked = await send(seed(), "", llm(), [note]);
    const agrees = llm({
      compare: async () => ({
        verdict: "agrees",
        relatedId: "bodycam-approach",
        reason: "Both appear to show the signal lit.",
        confidence: 0.9,
      }),
    });
    const r = await send(asked.state, "Y", agrees);
    expect(r.state.items.find((i) => i.id === "item-a1")).toMatchObject({
      flag: "agrees",
      relatedId: "bodycam-approach",
    });
    expect(r.replies[0]?.text).toContain("consistent with Officer bodycam");
  });

  it("flags a gap without needing a related item", async () => {
    const asked = await send(seed(), "", llm(), [note]);
    const gap = llm({
      compare: async () => ({
        verdict: "missing",
        relatedId: null,
        reason: "The note refers to a dispatch call that is not in the record.",
        confidence: 0.8,
      }),
    });
    const r = await send(asked.state, "Y", gap);
    expect(r.state.items.find((i) => i.id === "item-a1")?.flag).toBe("missing");
    expect(r.replies[0]?.text).toContain("Possible gap");
  });

  it("says it can't tell on low confidence and files nothing", async () => {
    const model = llm({
      describe: async () => ({
        description: "Something",
        lane: "events",
        start: 10,
        end: 20,
        confidence: 0.3,
      }),
    });
    const r = await send(seed(), "", model, [note]);
    expect(r.replies[0]?.text).toContain("can't tell");
    expect(r.state.items).toEqual(ITEMS);
    expect(r.state.pendingId).toBeNull();
  });

  it("says it can't tell when no time or lane can be placed", async () => {
    const noTime = llm({
      describe: async () => ({
        description: "A photo",
        lane: "events",
        start: null,
        end: null,
        confidence: 0.9,
      }),
    });
    expect((await send(seed(), "", noTime, [note])).replies[0]?.text).toContain("can't tell");
    const badLane = llm({
      describe: async () => ({
        description: "A photo",
        lane: "nonsense",
        start: 5,
        end: 9,
        confidence: 0.9,
      }),
    });
    expect((await send(seed(), "", badLane, [note])).replies[0]?.text).toContain("can't tell");
  });

  it("does not flag when the comparison is unsure, and says so", async () => {
    const asked = await send(seed(), "", llm(), [note]);
    const unsure = llm({
      compare: async () => ({
        verdict: "conflict",
        relatedId: "bodycam-approach",
        reason: "Maybe.",
        confidence: 0.2,
      }),
    });
    const r = await send(asked.state, "yes", unsure);
    expect(r.state.items.find((i) => i.id === "item-a1")).toMatchObject({
      status: "filed",
      flag: "agrees",
    });
    expect(r.replies[0]?.text).toContain("can't tell");
  });

  it("ignores a related id that is not on the timeline", async () => {
    const asked = await send(seed(), "", llm(), [note]);
    const made = llm({
      compare: async () => ({
        verdict: "conflict",
        relatedId: "made-up",
        reason: "x",
        confidence: 0.9,
      }),
    });
    const r = await send(asked.state, "Y", made);
    expect(r.state.items.find((i) => i.id === "item-a1")?.flag).toBe("agrees");
    expect(r.replies[0]?.text).toContain("can't tell");
  });

  it("replaces model wording that states a legal conclusion", async () => {
    const asked = await send(seed(), "", llm(), [note]);
    const bad = llm({
      compare: async () => ({
        verdict: "conflict",
        relatedId: "bodycam-approach",
        reason: "The officer lied and the stop was illegal.",
        confidence: 0.9,
      }),
    });
    const r = await send(asked.state, "Y", bad);
    const text = r.replies[0]?.text ?? "";
    expect(text).not.toMatch(/lied|illegal/i);
    expect(text).toContain("Possible conflict");
  });

  it("falls back to the attachment name when the model's label states a conclusion", async () => {
    const bad = llm({
      describe: async () => ({
        description: "Proof the officer is guilty",
        lane: "events",
        start: 5,
        end: 9,
        confidence: 0.9,
      }),
    });
    const r = await send(seed(), "", bad, [note]);
    expect(r.replies[0]?.text).toBe("File this as Team voice note? Reply Y.");
  });

  it("reports a model failure in plain words and files nothing", async () => {
    const down = llm({
      describe: async () => {
        throw new Error("The analysis service is not set up yet.");
      },
    });
    const r = await send(seed(), "", down, [note]);
    expect(r.replies[0]?.text).toContain("not set up yet");
    expect(r.state.items).toEqual(ITEMS);
  });

  it("files even if the comparison fails, but says it is not flagged", async () => {
    const asked = await send(seed(), "", llm(), [note]);
    const down = llm({
      compare: async () => {
        throw new Error("The analysis service is busy.");
      },
    });
    const r = await send(asked.state, "Y", down);
    expect(r.state.items.find((i) => i.id === "item-a1")?.status).toBe("filed");
    expect(r.replies[0]?.text).toContain("not flagged");
  });

  it("drops an unconfirmed item on N and when a new attachment arrives", async () => {
    const asked = await send(seed(), "", llm(), [note]);
    const skipped = await send(asked.state, "N", llm());
    expect(skipped.state.items).toEqual(ITEMS);
    const again = await send(asked.state, "", llm(), [{ ...note, id: "a2" }]);
    expect(again.state.items.map((i) => i.id)).not.toContain("item-a1");
    expect(again.state.pendingId).toBe("item-a2");
  });

  it("handles Y with nothing pending", async () => {
    expect((await send(seed(), "Y", llm())).replies[0]?.text).toContain("nothing waiting");
  });

  it("can't read an attachment that has no text yet", async () => {
    const r = await send(seed(), "", llm(), [{ id: "a3", kind: "image", name: "IMG_1.jpg" }]);
    expect(r.replies[0]?.text).toContain("can't read");
    expect(r.state.pendingId).toBeNull();
  });

  it("answers What's missing? from the filed items", async () => {
    const r = await send(seed(), "What's missing?", llm());
    expect(r.replies[0]?.text).toMatch(/^Possible gaps:/);
    expect(r.replies[0]?.text).toContain("No dispatch audio");
    expect(whatsMissing([])).toContain("nothing filed in Bodycam");
  });

  it("answers What changed since yesterday? using filing times", async () => {
    expect(whatsChanged(ITEMS, NOW)).toBe("Nothing new has been filed since yesterday.");
    const asked = await send(seed(), "", llm(), [note]);
    const filed = await send(asked.state, "Y", llm());
    const r = await send(filed.state, "what changed since yesterday?", llm());
    expect(r.replies[0]?.text).toContain("1 item was filed");
    expect(r.replies[0]?.text).toContain("possible conflict");
    const old = filed.state.items.map((i) =>
      i.id === "item-a1" ? { ...i, filedAt: "2026-11-10T09:00:00" } : i,
    );
    expect(whatsChanged(old, NOW)).toBe("Nothing new has been filed since yesterday.");
  });

  it("only files one attachment at a time and says so", async () => {
    const r = await send(seed(), "", llm(), [note, { ...note, id: "a9" }]);
    expect(r.replies[0]?.text).toContain("only looked at the first");
  });

  it("flags conclusion wording", () => {
    expect(hasConclusion("This proves the stop was unlawful")).toBe(true);
    expect(hasConclusion("The signal appears to be on at about 0:45.")).toBe(false);
  });
});

describe("text notes as evidence", () => {
  const text = "Dashcam shows the left signal coming on at 0:55";

  it("treats a longer statement as a note and proposes filing it", async () => {
    let seen = "";
    const model = llm({
      describe: async (i) => {
        seen = `${i.attachmentName} | ${i.extractedText} | ${i.caption}`;
        return {
          description: "Dashcam: signal at 0:55",
          lane: "dashcam",
          start: 55,
          end: 60,
          confidence: 0.9,
        };
      },
    });
    const r = await send(seed(), text, model);
    expect(seen).toBe(`Text note from the case team | ${text} | `);
    expect(r.replies[0]?.text).toBe("File this as Dashcam: signal at 0:55? Reply Y.");
    const item = r.state.items.find((i) => i.id === r.state.pendingId);
    expect(item).toMatchObject({
      status: "pending",
      sourceLabel: "Text note from the case team",
      sourceLink: null,
    });
    expect(item?.extractedText).toBe(text);
  });

  it("files the note on Y and compares it with the rest of the case", async () => {
    const asked = await send(seed(), text, llm());
    const r = await send(asked.state, "Y", llm());
    expect(
      r.state.items.find((i) => i.sourceLabel === "Text note from the case team"),
    ).toMatchObject({
      status: "filed",
      flag: "conflict",
    });
    expect(r.replies[0]?.text).toContain("Text note from the case team");
  });

  it("does not treat short texts or questions as notes", async () => {
    let calls = 0;
    const model = llm({
      describe: async () => {
        calls += 1;
        throw new Error("should not be called");
      },
    });
    for (const t of ["hello", "ok thanks", "Is the dashcam clip filed yet?"]) {
      const r = await send(seed(), t, model);
      expect(r.replies[0]?.text).toContain("Send me evidence");
    }
    expect(calls).toBe(0);
  });

  it("says it can't tell for a note with no time and files nothing", async () => {
    const vague = llm({
      describe: async () => ({
        description: "A note",
        lane: "events",
        start: null,
        end: null,
        confidence: 0.9,
      }),
    });
    const r = await send(seed(), "I think we should look at this again soon", vague);
    expect(r.replies[0]?.text).toContain("can't tell");
    expect(r.state.items).toEqual(ITEMS);
  });

  it("reminds about a pending item on a short reply, but a new note replaces it", async () => {
    const asked = await send(seed(), text, llm());
    expect((await send(asked.state, "maybe", llm())).replies[0]?.text).toContain("still waiting");
    const again = await send(asked.state, "Bodycam shows the officer walking up at 1:10", llm());
    expect(again.state.items.filter((i) => i.status === "pending")).toHaveLength(1);
    expect(again.state.pendingId).not.toBe(asked.state.pendingId);
  });
});
